import OAuth from 'oauth-1.0a';
import crypto from 'crypto';

const MOBILESENTRIX_BASE_URL = process.env.MOBILESENTRIX_API_URL || 'https://www.mobilesentrix.ca';

interface MobilesentrixProduct {
  entity_id: string;
  sku: string;
  name: string;
  price: string;
  special_price?: string;
  qty?: string;
  is_in_stock?: boolean;
  image?: string;
  description?: string;
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

async function makeApiRequest(endpoint: string, method: string = 'GET'): Promise<any> {
  const oauth = getOAuthClient();
  const url = `${MOBILESENTRIX_BASE_URL}${endpoint}`;
  
  const requestData = {
    url,
    method,
  };

  const authHeader = oauth.toHeader(oauth.authorize(requestData));

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
  const endpoint = `/rest/V1/pos/products?searchCriteria[filter_groups][0][filters][0][field]=name&searchCriteria[filter_groups][0][filters][0][value]=%25${encodeURIComponent(query)}%25&searchCriteria[filter_groups][0][filters][0][condition_type]=like&searchCriteria[pageSize]=${limit}&searchCriteria[currentPage]=${page}`;
  
  const data = await makeApiRequest(endpoint);
  return {
    products: data.items || [],
    total_count: data.total_count || 0,
  };
}

export async function getProductBySku(sku: string): Promise<MobilesentrixPriceResult> {
  const endpoint = `/rest/V1/pos/products/${encodeURIComponent(sku)}`;
  
  try {
    const product = await makeApiRequest(endpoint);
    
    const price = product.special_price 
      ? parseFloat(product.special_price) 
      : parseFloat(product.price);
    
    return {
      sku: product.sku,
      name: product.name,
      price: isNaN(price) ? 0 : price,
      inStock: product.is_in_stock !== false && (product.qty === undefined || parseInt(product.qty) > 0),
      found: true,
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
  return !!(process.env.MOBILESENTRIX_CONSUMER_KEY && process.env.MOBILESENTRIX_CONSUMER_SECRET);
}
