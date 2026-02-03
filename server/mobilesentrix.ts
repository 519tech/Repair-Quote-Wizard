import OAuth from 'oauth-1.0a';
import crypto from 'crypto';

const MOBILESENTRIX_BASE_URL = process.env.MOBILESENTRIX_API_URL || 'https://www.mobilesentrix.ca';

// Error notification callback - set by routes.ts
let errorNotificationCallback: ((error: string, endpoint?: string) => void) | null = null;

export function setErrorNotificationCallback(callback: (error: string, endpoint?: string) => void): void {
  errorNotificationCallback = callback;
}

interface MobilesentrixProduct {
  entity_id: string;
  sku: string;
  new_sku?: string | null;
  name: string;
  price: string;
  customer_price?: number;
  is_in_stock?: number | boolean;
  in_stock_qty?: number;
  image_url?: string;
  default_image?: string;
  description?: string;
  status?: string;
}

interface MobilesentrixSearchResponse {
  products: MobilesentrixProduct[];
  total_count: number;
}

interface MobilesentrixPriceResult {
  sku: string;
  name: string;
  price: number;
  inStock: boolean;
  found: boolean;
  error?: string;
}

export class MobilesentrixApiError extends Error {
  public statusCode: number;
  
  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'MobilesentrixApiError';
    this.statusCode = statusCode;
  }
}

// OAuth 1.0a client using PLAINTEXT signature method
function getOAuthClient(): OAuth {
  const consumerKey = process.env.MOBILESENTRIX_CONSUMER_KEY;
  const consumerSecret = process.env.MOBILESENTRIX_CONSUMER_SECRET;

  if (!consumerKey || !consumerSecret) {
    throw new Error('Mobilesentrix API credentials not configured');
  }

  return new OAuth({
    consumer: {
      key: consumerKey,
      secret: consumerSecret,
    },
    signature_method: 'PLAINTEXT',
    hash_function(base_string, key) {
      // For PLAINTEXT, the signature is just the key
      return key;
    },
  });
}

// Store tokens from database for use in API calls
let cachedDbTokens: { key: string; secret: string } | null = null;

export function setDatabaseTokens(accessToken: string, accessTokenSecret: string): void {
  cachedDbTokens = { key: accessToken, secret: accessTokenSecret };
}

export function clearDatabaseTokens(): void {
  cachedDbTokens = null;
}

// 24-hour parts price cache
interface CachedPart {
  sku: string;
  name: string;
  price: number;
  inStock: boolean;
  found: boolean;
  cachedAt: number;
}

const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const partsCache = new Map<string, CachedPart>();

export function getCacheStatus(): { count: number; oldestCacheTime: number | null; cacheAgeHours: number | null } {
  if (partsCache.size === 0) {
    return { count: 0, oldestCacheTime: null, cacheAgeHours: null };
  }
  
  let oldestTime = Date.now();
  const values = Array.from(partsCache.values());
  for (const part of values) {
    if (part.cachedAt < oldestTime) {
      oldestTime = part.cachedAt;
    }
  }
  
  const ageHours = (Date.now() - oldestTime) / (1000 * 60 * 60);
  return { 
    count: partsCache.size, 
    oldestCacheTime: oldestTime, 
    cacheAgeHours: Math.round(ageHours * 10) / 10 
  };
}

export function clearPartsCache(): void {
  partsCache.clear();
  console.log('Parts cache cleared');
}

function isCacheValid(cachedPart: CachedPart): boolean {
  return (Date.now() - cachedPart.cachedAt) < CACHE_DURATION_MS;
}

export function getCachedPrice(sku: string): CachedPart | null {
  const cached = partsCache.get(sku);
  if (cached && isCacheValid(cached)) {
    return cached;
  }
  // Remove stale entry
  if (cached) {
    partsCache.delete(sku);
  }
  return null;
}

export function setCachedPrice(sku: string, data: Omit<CachedPart, 'cachedAt'>): void {
  partsCache.set(sku, {
    ...data,
    cachedAt: Date.now(),
  });
}

export async function fetchAndCacheMultipleSkus(skus: string[]): Promise<Map<string, CachedPart>> {
  const results = new Map<string, CachedPart>();
  
  // Dedupe and filter empty SKUs
  const uniqueSkus = Array.from(new Set(skus.filter(sku => sku && sku.trim())));
  const skusToFetch: string[] = [];
  
  // Check cache first
  for (const sku of uniqueSkus) {
    const cached = getCachedPrice(sku);
    if (cached) {
      results.set(sku, cached);
    } else {
      skusToFetch.push(sku);
    }
  }
  
  if (skusToFetch.length === 0) {
    console.log(`All ${uniqueSkus.length} SKUs found in cache`);
    return results;
  }
  
  console.log(`Fetching ${skusToFetch.length} SKUs from API (${results.size} from cache)`);
  
  // Batch fetch in groups of 10 to avoid overwhelming the API
  const batchSize = 10;
  for (let i = 0; i < skusToFetch.length; i += batchSize) {
    const batch = skusToFetch.slice(i, i + batchSize);
    
    // Fetch in parallel within each batch
    const fetchPromises = batch.map(async (sku) => {
      try {
        const result = await getProductBySku(sku);
        if (result.found) {
          // Only cache successful results for 24 hours
          const cached: CachedPart = {
            sku: result.sku,
            name: result.name,
            price: result.price,
            inStock: result.inStock,
            found: result.found,
            cachedAt: Date.now(),
          };
          setCachedPrice(sku, cached);
          return { sku, cached };
        } else {
          // Don't cache not-found results - might be temporary
          return { sku, cached: { sku, name: '', price: 0, inStock: false, found: false, cachedAt: 0 } };
        }
      } catch (error) {
        console.error(`Failed to fetch SKU ${sku}:`, error);
        // Don't cache errors - might be temporary API issues
        return { sku, cached: { sku, name: '', price: 0, inStock: false, found: false, cachedAt: 0 } };
      }
    });
    
    const batchResults = await Promise.all(fetchPromises);
    for (const { sku, cached } of batchResults) {
      results.set(sku, cached);
    }
    
    // Small delay between batches to be nice to the API
    if (i + batchSize < skusToFetch.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return results;
}

function getAccessToken(): { key: string; secret: string } | null {
  // First check database tokens (set by OAuth callback)
  if (cachedDbTokens) {
    return cachedDbTokens;
  }
  
  // Fall back to environment variables
  const accessToken = process.env.MOBILESENTRIX_ACCESS_TOKEN;
  const accessTokenSecret = process.env.MOBILESENTRIX_ACCESS_TOKEN_SECRET;
  
  if (!accessToken || !accessTokenSecret) {
    return null;
  }
  
  return { key: accessToken, secret: accessTokenSecret };
}

async function makeApiRequest(endpoint: string, method: string = 'GET'): Promise<any> {
  const oauth = getOAuthClient();
  const token = getAccessToken();
  
  if (!token) {
    throw new MobilesentrixApiError('Access token not configured. Please complete OAuth authorization.', 401);
  }
  
  const url = `${MOBILESENTRIX_BASE_URL}${endpoint}`;
  
  const requestData = {
    url,
    method,
  };

  const authHeader = oauth.toHeader(oauth.authorize(requestData, token));

  console.log(`Mobilesentrix API request: ${method} ${url}`);
  
  const response = await fetch(url, {
    method,
    headers: {
      ...authHeader,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    const errorMessage = `Mobilesentrix API error (${response.status}): ${errorText.substring(0, 200)}`;
    console.error(errorMessage);
    
    // Send error notification
    if (errorNotificationCallback) {
      errorNotificationCallback(errorMessage, endpoint);
    }
    
    throw new MobilesentrixApiError(errorMessage, response.status);
  }

  return response.json();
}

// Test the API connection by making a simple request
export async function testConnection(): Promise<{ success: boolean; message: string; responseTime?: number }> {
  const startTime = Date.now();
  
  try {
    if (!isMobilesentrixConfigured()) {
      return { success: false, message: 'API not configured. Please complete OAuth authorization.' };
    }
    
    // Try to fetch a single product to verify the connection works
    const endpoint = '/api/rest/products?limit=1';
    await makeApiRequest(endpoint);
    
    const responseTime = Date.now() - startTime;
    return { success: true, message: 'Connection successful', responseTime };
  } catch (error) {
    const errorMessage = error instanceof MobilesentrixApiError 
      ? error.message 
      : (error instanceof Error ? error.message : 'Unknown error');
    return { success: false, message: errorMessage };
  }
}

export async function searchProducts(query: string, page: number = 1, limit: number = 20): Promise<MobilesentrixSearchResponse> {
  const endpoint = `/api/rest/products?limit=${limit}&page=${page}`;
  
  const data = await makeApiRequest(endpoint);
  
  const products: MobilesentrixProduct[] = [];
  
  if (data && typeof data === 'object') {
    for (const key of Object.keys(data)) {
      const product = data[key];
      if (product && product.sku && product.name) {
        const lowerQuery = query.toLowerCase();
        const nameMatch = product.name.toLowerCase().includes(lowerQuery);
        const skuMatch = product.sku.toLowerCase().includes(lowerQuery);
        
        if (nameMatch || skuMatch) {
          products.push(product);
        }
      }
    }
  }
  
  return {
    products: products.slice(0, limit),
    total_count: products.length,
  };
}

export async function getProductBySku(sku: string): Promise<MobilesentrixPriceResult> {
  // Use the filter endpoint as per documentation
  const endpoint = `/api/rest/products?filter[1][attribute]=sku&filter[1][in][0]=${encodeURIComponent(sku)}`;
  
  try {
    const data = await makeApiRequest(endpoint);
    
    if (data && typeof data === 'object') {
      for (const key of Object.keys(data)) {
        const product = data[key];
        if (product && (product.sku === sku || product.new_sku === sku)) {
          const price = product.customer_price 
            ? product.customer_price 
            : parseFloat(product.price);
          
          const inStock = product.is_in_stock === 1 || 
                         product.is_in_stock === true || 
                         (product.in_stock_qty !== undefined && product.in_stock_qty > 0);
          
          return {
            sku: product.sku,
            name: product.name,
            price: isNaN(price) ? 0 : price,
            inStock,
            found: true,
          };
        }
      }
    }
    
    console.log(`SKU ${sku} not found in Mobilesentrix API`);
    return {
      sku,
      name: '',
      price: 0,
      inStock: false,
      found: false,
    };
  } catch (error) {
    if (error instanceof MobilesentrixApiError && error.statusCode === 404) {
      return {
        sku,
        name: '',
        price: 0,
        inStock: false,
        found: false,
      };
    }
    throw error;
  }
}

export async function getProductPrice(sku: string): Promise<number | null> {
  const result = await getProductBySku(sku);
  return result.found ? result.price : null;
}

export function isMobilesentrixConfigured(): boolean {
  const hasConsumerCreds = !!(process.env.MOBILESENTRIX_CONSUMER_KEY && process.env.MOBILESENTRIX_CONSUMER_SECRET);
  // Check database tokens first, then environment variables
  const hasAccessToken = !!cachedDbTokens || !!(process.env.MOBILESENTRIX_ACCESS_TOKEN && process.env.MOBILESENTRIX_ACCESS_TOKEN_SECRET);
  return hasConsumerCreds && hasAccessToken;
}

export function getMobilesentrixStatus(): { configured: boolean; missingCredentials: string[]; tokenSource?: string } {
  const missing: string[] = [];
  
  if (!process.env.MOBILESENTRIX_CONSUMER_KEY) missing.push('MOBILESENTRIX_CONSUMER_KEY');
  if (!process.env.MOBILESENTRIX_CONSUMER_SECRET) missing.push('MOBILESENTRIX_CONSUMER_SECRET');
  
  // Check database tokens first
  const hasDbTokens = !!cachedDbTokens;
  const hasEnvTokens = !!(process.env.MOBILESENTRIX_ACCESS_TOKEN && process.env.MOBILESENTRIX_ACCESS_TOKEN_SECRET);
  
  if (!hasDbTokens && !hasEnvTokens) {
    missing.push('MOBILESENTRIX_ACCESS_TOKEN');
    missing.push('MOBILESENTRIX_ACCESS_TOKEN_SECRET');
  }
  
  return {
    configured: missing.length === 0,
    missingCredentials: missing,
    tokenSource: hasDbTokens ? 'database' : hasEnvTokens ? 'environment' : undefined,
  };
}

// Generate the OAuth authorization URL for browser-based flow
export function getAuthorizationUrl(callbackUrl: string): string {
  const consumerKey = process.env.MOBILESENTRIX_CONSUMER_KEY;
  const consumerSecret = process.env.MOBILESENTRIX_CONSUMER_SECRET;
  
  if (!consumerKey || !consumerSecret) {
    throw new Error('Consumer key and secret are required');
  }
  
  // Build the authorization URL as per Mobilesentrix docs
  const params = new URLSearchParams({
    consumer: 'RepairQuote',
    authtype: '1',
    flowentry: 'SignIn',
    consumer_key: consumerKey,
    consumer_secret: consumerSecret,
    authorize_for: 'customer',
    callback: callbackUrl,
  });
  
  return `${MOBILESENTRIX_BASE_URL}/oauth/authorize/identifier?${params.toString()}`;
}

// Exchange oauth_token and oauth_verifier for access token
export async function exchangeTokens(oauthToken: string, oauthVerifier: string): Promise<{ accessToken: string; accessTokenSecret: string }> {
  const consumerKey = process.env.MOBILESENTRIX_CONSUMER_KEY;
  const consumerSecret = process.env.MOBILESENTRIX_CONSUMER_SECRET;
  
  if (!consumerKey || !consumerSecret) {
    throw new Error('Consumer key and secret are required');
  }
  
  const url = `${MOBILESENTRIX_BASE_URL}/oauth/authorize/identifiercallback`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      consumer_key: consumerKey,
      consumer_secret: consumerSecret,
      oauth_token: oauthToken,
      oauth_verifier: oauthVerifier,
    }),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Token exchange error:', errorText);
    throw new MobilesentrixApiError(`Failed to exchange tokens: ${errorText}`, response.status);
  }
  
  const data = await response.json();
  
  if (data.status !== 1 || !data.data?.access_token || !data.data?.access_token_secret) {
    throw new MobilesentrixApiError('Invalid response from token exchange', 400);
  }
  
  return {
    accessToken: data.data.access_token,
    accessTokenSecret: data.data.access_token_secret,
  };
}
