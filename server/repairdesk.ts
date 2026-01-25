import { db } from "./db";
import { repairDeskTokens } from "@shared/schema";

const REPAIRDESK_API_BASE = "https://api.repairdesk.co/api/web/v1";

interface InventoryItem {
  sku: string;
  name: string;
  quantity: number;
  store_id?: string;
}

function getApiKey(): string | null {
  return process.env.REPAIRDESK_API_KEY || null;
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

  try {
    // RepairDesk API uses api_key query parameter for authentication
    const response = await fetch(`${REPAIRDESK_API_BASE}/inventory?api_key=${encodeURIComponent(apiKey)}`, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.error("Failed to fetch inventory from RepairDesk:", response.status, await response.text());
      return stockMap;
    }

    const data = await response.json();
    const items: InventoryItem[] = data.data || data || [];

    for (const item of items) {
      if (item.sku && skus.includes(item.sku)) {
        const currentQty = stockMap.get(item.sku) || 0;
        stockMap.set(item.sku, currentQty + (item.quantity || 0));
      }
    }
  } catch (error) {
    console.error("Error checking RepairDesk inventory:", error);
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
