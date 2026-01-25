import { db } from "./db";
import { repairDeskTokens } from "@shared/schema";

const REPAIRDESK_API_BASE = "https://api.repairdesk.co/api/web/v1";

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

// Cache inventory data to avoid repeated API calls
let inventoryCache: Map<string, number> = new Map();
let cacheTimestamp: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function loadFullInventory(apiKey: string): Promise<Map<string, number>> {
  const stockMap = new Map<string, number>();
  let page = 1;
  let totalPages = 1;
  
  try {
    do {
      const response = await fetch(
        `${REPAIRDESK_API_BASE}/inventory?api_key=${encodeURIComponent(apiKey)}&page=${page}`,
        { headers: { "Content-Type": "application/json" } }
      );

      if (!response.ok) {
        console.error(`Failed to fetch inventory page ${page}:`, response.status);
        break;
      }

      const data = await response.json();
      
      if (data?.data?.inventoryListData && Array.isArray(data.data.inventoryListData)) {
        for (const item of data.data.inventoryListData) {
          if (item.sku) {
            const qty = parseInt(item.in_stock || "0", 10) || 0;
            stockMap.set(item.sku, qty);
          }
        }
      }
      
      if (data?.data?.pagination) {
        totalPages = data.data.pagination.total_pages || 1;
      }
      
      page++;
    } while (page <= totalPages);
    
    console.log(`RepairDesk: Loaded ${stockMap.size} SKUs from ${totalPages} pages`);
  } catch (error) {
    console.error("Error loading RepairDesk inventory:", error);
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

  // Refresh cache if expired
  const now = Date.now();
  if (now - cacheTimestamp > CACHE_TTL || inventoryCache.size === 0) {
    console.log("RepairDesk: Refreshing inventory cache...");
    inventoryCache = await loadFullInventory(apiKey);
    cacheTimestamp = now;
  }

  // Look up SKUs from cache
  for (const sku of skus) {
    const qty = inventoryCache.get(sku);
    if (qty !== undefined) {
      stockMap.set(sku, qty);
      console.log(`RepairDesk: SKU ${sku} has ${qty} in stock`);
    }
  }

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
