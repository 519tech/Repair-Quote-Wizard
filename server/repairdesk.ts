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

// Search for specific SKUs by paginating through inventory until found
async function searchSkuInPages(apiKey: string, targetSkus: Set<string>): Promise<Map<string, number>> {
  const stockMap = new Map<string, number>();
  const foundSkus = new Set<string>();
  let page = 1;
  let totalPages = 1;
  
  try {
    // Paginate until all SKUs found or no more pages
    while (foundSkus.size < targetSkus.size && page <= totalPages) {
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
          if (item.sku && targetSkus.has(item.sku) && !foundSkus.has(item.sku)) {
            const qty = parseInt(item.in_stock || "0", 10) || 0;
            stockMap.set(item.sku, qty);
            foundSkus.add(item.sku);
            console.log(`RepairDesk: SKU ${item.sku} found on page ${page} with ${qty} in stock`);
          }
        }
      }
      
      if (data?.data?.pagination && page === 1) {
        totalPages = data.data.pagination.total_pages || 1;
      }
      
      // Stop early if all SKUs found
      if (foundSkus.size >= targetSkus.size) {
        console.log(`RepairDesk: All ${foundSkus.size} SKUs found by page ${page}`);
        break;
      }
      
      page++;
    }
    
    if (foundSkus.size < targetSkus.size) {
      const notFound = [...targetSkus].filter(s => !foundSkus.has(s));
      console.log(`RepairDesk: ${notFound.length} SKUs not found after ${page - 1} pages`);
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

  // Search for specific SKUs page by page
  const targetSkus = new Set(skus);
  const results = await searchSkuInPages(apiKey, targetSkus);
  
  return results;
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
