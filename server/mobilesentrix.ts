import OAuth from 'oauth-1.0a';
import crypto from 'crypto';

const MOBILESENTRIX_BASE_URL = process.env.MOBILESENTRIX_API_URL || 'https://www.mobilesentrix.ca';

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
    signature_method: 'HMAC-SHA256',
    hash_function(base_string, key) {
      return crypto
        .createHmac('sha256', key)
        .update(base_string)
        .digest('base64');
    },
  });
}

function getAccessToken(): { key: string; secret: string } | null {
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
  const url = `${MOBILESENTRIX_BASE_URL}${endpoint}`;
  
  const requestData = {
    url,
    method,
  };

  const authHeader = oauth.toHeader(oauth.authorize(requestData, token || undefined));

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
    console.error(`Mobilesentrix API error (${response.status}):`, errorText);
    throw new MobilesentrixApiError(
      `Mobilesentrix API error (${response.status}): ${errorText.substring(0, 200)}`,
      response.status
    );
  }

  return response.json();
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
  const hasAccessToken = !!(process.env.MOBILESENTRIX_ACCESS_TOKEN && process.env.MOBILESENTRIX_ACCESS_TOKEN_SECRET);
  return hasConsumerCreds && hasAccessToken;
}

export function getMobilesentrixStatus(): { configured: boolean; missingCredentials: string[] } {
  const missing: string[] = [];
  
  if (!process.env.MOBILESENTRIX_CONSUMER_KEY) missing.push('MOBILESENTRIX_CONSUMER_KEY');
  if (!process.env.MOBILESENTRIX_CONSUMER_SECRET) missing.push('MOBILESENTRIX_CONSUMER_SECRET');
  if (!process.env.MOBILESENTRIX_ACCESS_TOKEN) missing.push('MOBILESENTRIX_ACCESS_TOKEN');
  if (!process.env.MOBILESENTRIX_ACCESS_TOKEN_SECRET) missing.push('MOBILESENTRIX_ACCESS_TOKEN_SECRET');
  
  return {
    configured: missing.length === 0,
    missingCredentials: missing,
  };
}
