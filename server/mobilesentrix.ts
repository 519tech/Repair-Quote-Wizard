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
