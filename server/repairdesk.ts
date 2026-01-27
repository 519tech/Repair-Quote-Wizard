import { db } from "./db";
import { repairDeskTokens } from "@shared/schema";

const REPAIRDESK_API_BASE = "https://api.repairdesk.co/api/web/v1";

// Cache for stock data - stores { quantity, timestamp }
const stockCache = new Map<string, { qty: number; ts: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache

interface InventoryItem {
  sku: string;
  name: string;
  in_stock: string;  // RepairDesk returns as string
  quantity?: number;
  store_id?: string;
}

function getApiKey(): string | null {
  return process.env.REPAIRDESK_API_KEY || null;
}

// Fetch a single page of inventory
async function fetchInventoryPage(apiKey: string, page: number): Promise<{ items: InventoryItem[]; totalPages: number }> {
  try {
    const response = await fetch(
      `${REPAIRDESK_API_BASE}/inventory?api_key=${encodeURIComponent(apiKey)}&page=${page}`,
      { headers: { "Content-Type": "application/json" } }
    );

    if (!response.ok) {
      console.error(`Failed to fetch inventory page ${page}:`, response.status);
      return { items: [], totalPages: 0 };
    }

    const data = await response.json();
    const items = data?.data?.inventoryListData || [];
    const totalPages = data?.data?.pagination?.total_pages || 1;
    return { items, totalPages };
  } catch (error) {
    console.error(`Error fetching page ${page}:`, error);
    return { items: [], totalPages: 0 };
  }
}

// Search for specific SKUs with parallel page fetching
async function searchSkuInPages(apiKey: string, targetSkus: Set<string>): Promise<Map<string, number>> {
  const stockMap = new Map<string, number>();
  const foundSkus = new Set<string>();
  const startTime = Date.now();
  
  try {
    // First, get page 1 to know total pages
    const firstResult = await fetchInventoryPage(apiKey, 1);
    const totalPages = firstResult.totalPages;
    
    // Process page 1 results
    for (const item of firstResult.items) {
      if (item.sku && targetSkus.has(item.sku) && !foundSkus.has(item.sku)) {
        const qty = parseInt(item.in_stock || "0", 10) || 0;
        stockMap.set(item.sku, qty);
        foundSkus.add(item.sku);
        // Cache the result
        stockCache.set(item.sku, { qty, ts: Date.now() });
      }
    }
    
    if (foundSkus.size >= targetSkus.size) {
      console.log(`RepairDesk: All ${foundSkus.size} SKUs found on page 1 in ${Date.now() - startTime}ms`);
      return stockMap;
    }
    
    // Fetch remaining pages in parallel (batches of 5)
    const BATCH_SIZE = 5;
    for (let batchStart = 2; batchStart <= totalPages && foundSkus.size < targetSkus.size; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE - 1, totalPages);
      const pagePromises: Promise<{ items: InventoryItem[]; totalPages: number }>[] = [];
      
      for (let page = batchStart; page <= batchEnd; page++) {
        pagePromises.push(fetchInventoryPage(apiKey, page));
      }
      
      const results = await Promise.all(pagePromises);
      
      for (const result of results) {
        for (const item of result.items) {
          if (item.sku && targetSkus.has(item.sku) && !foundSkus.has(item.sku)) {
            const qty = parseInt(item.in_stock || "0", 10) || 0;
            stockMap.set(item.sku, qty);
            foundSkus.add(item.sku);
            // Cache the result
            stockCache.set(item.sku, { qty, ts: Date.now() });
          }
        }
      }
      
      // Stop early if all SKUs found
      if (foundSkus.size >= targetSkus.size) {
        console.log(`RepairDesk: All ${foundSkus.size} SKUs found in ${Date.now() - startTime}ms`);
        break;
      }
    }
    
    if (foundSkus.size < targetSkus.size) {
      const notFound = Array.from(targetSkus).filter(s => !foundSkus.has(s));
      console.log(`RepairDesk: ${notFound.length} SKUs not found after searching all pages in ${Date.now() - startTime}ms`);
    }
  } catch (error) {
    console.error("Error searching RepairDesk inventory:", error);
  }
  
  return stockMap;
}

export async function checkInventoryBySku(skus: string[]): Promise<Map<string, number>> {
  const stockMap = new Map<string, number>();

  if (skus.length === 0) {
    return stockMap;
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    console.log("No RepairDesk API key configured");
    return stockMap;
  }

  const now = Date.now();
  const uncachedSkus: string[] = [];
  
  // Check cache first
  for (const sku of skus) {
    const cached = stockCache.get(sku);
    if (cached && (now - cached.ts) < CACHE_TTL_MS) {
      stockMap.set(sku, cached.qty);
    } else {
      uncachedSkus.push(sku);
    }
  }
  
  if (uncachedSkus.length === 0) {
    console.log(`RepairDesk: All ${skus.length} SKUs served from cache`);
    return stockMap;
  }
  
  console.log(`RepairDesk: ${stockMap.size} from cache, ${uncachedSkus.length} to fetch`);
  
  // Search for uncached SKUs
  const targetSkus = new Set(uncachedSkus);
  const results = await searchSkuInPages(apiKey, targetSkus);
  
  // Merge results
  results.forEach((qty, sku) => {
    stockMap.set(sku, qty);
  });
  
  return stockMap;
}

export async function isRepairDeskConnected(): Promise<boolean> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return false;
  }
  
  // Verify the API key works by making a test request
  try {
    const response = await fetch(`${REPAIRDESK_API_BASE}/inventory?api_key=${encodeURIComponent(apiKey)}&limit=1`, {
      headers: {
        "Content-Type": "application/json",
      },
    });
    return response.ok;
  } catch (error) {
    console.error("Error verifying RepairDesk connection:", error);
    return false;
  }
}

export async function disconnectRepairDesk(): Promise<void> {
  // With API key approach, disconnection just means removing the key
  // The user would need to remove the REPAIRDESK_API_KEY secret
  // We can clear any stored OAuth tokens if they exist
  await db.delete(repairDeskTokens);
}

// Lead creation interfaces
interface LeadSummary {
  firstName: string;
  lastName: string;
  email: string;
  mobile?: string;
  referredBy?: string;
}

interface LeadDevice {
  repairType?: string;
  device?: string;
  price: string;
  repairProdItems: { id: string; name: string }[];
  additionalProblem?: string;
  customerNotes?: string;
}

interface CreateLeadRequest {
  summary: LeadSummary;
  devices: LeadDevice[];
}

interface CreateLeadResponse {
  success: boolean;
  statusCode: number;
  message: string;
  data?: {
    id: number;
    order_id: string;
    customer_id: number;
  };
}

export async function createLead(request: CreateLeadRequest): Promise<CreateLeadResponse> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { success: false, statusCode: 401, message: "No RepairDesk API key configured" };
  }

  try {
    const response = await fetch(
      `${REPAIRDESK_API_BASE}/appointment/create?api_key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      }
    );

    const data = await response.json();
    
    if (response.ok && data.success) {
      console.log(`RepairDesk: Lead created successfully - ${data.data?.order_id}`);
      return data;
    } else {
      console.error("RepairDesk lead creation failed:", data);
      return { 
        success: false, 
        statusCode: response.status, 
        message: data.message || "Failed to create lead" 
      };
    }
  } catch (error) {
    console.error("Error creating RepairDesk lead:", error);
    return { success: false, statusCode: 500, message: "Error connecting to RepairDesk" };
  }
}
