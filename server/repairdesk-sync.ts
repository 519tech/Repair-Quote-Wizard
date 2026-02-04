import { db } from "./db";
import { deviceServices, devices, services, repairDeskSyncHistory } from "@shared/schema";
import { eq, isNotNull, sql } from "drizzle-orm";
import { storage } from "./storage";
import { getCachedPrice, getProductBySku, isMobilesentrixConfigured } from "./mobilesentrix";

const REPAIRDESK_API_BASE = "https://api.repairdesk.co/api/web/v1";

interface SyncResult {
  deviceServiceId: string;
  repairDeskServiceId: number;
  deviceName: string;
  serviceName: string;
  calculatedPrice: number;
  success: boolean;
  error?: string;
}

interface SyncSummary {
  syncId: string;
  syncType: "manual" | "scheduled";
  status: "success" | "partial" | "failed";
  totalServices: number;
  syncedServices: number;
  failedServices: number;
  results: SyncResult[];
  startedAt: string;
  completedAt: string;
}

interface BrokenLink {
  deviceServiceId: string;
  deviceName: string;
  serviceName: string;
  repairDeskServiceId: number | null;
  issue: string;
}

function getApiKey(): string | null {
  return process.env.REPAIRDESK_API_KEY || null;
}

export function isRepairDeskSyncConfigured(): boolean {
  return !!getApiKey();
}

async function getSkuPrice(sku: string): Promise<{ price: number; found: boolean }> {
  const templates = await storage.getMessageTemplates();
  const pricingSourceSetting = templates.find(t => t.type === "pricing_source");
  const pricingSource = pricingSourceSetting?.content || "excel_upload";

  if (pricingSource === "excel_upload") {
    const supplierPart = await storage.getSupplierPartBySku(sku);
    if (supplierPart) {
      return { price: parseFloat(supplierPart.price), found: true };
    }
    return { price: 0, found: false };
  }

  const cached = getCachedPrice(sku);
  if (cached?.found) {
    return { price: parseFloat(String(cached.price)) || 0, found: true };
  }

  if (!isMobilesentrixConfigured()) {
    const supplierPart = await storage.getSupplierPartBySku(sku);
    if (supplierPart) {
      return { price: parseFloat(supplierPart.price), found: true };
    }
    return { price: 0, found: false };
  }

  try {
    const apiResult = await getProductBySku(sku);
    if (apiResult) {
      const price = parseFloat(apiResult.price) || 0;
      return { price, found: price > 0 };
    }
  } catch (error) {
    console.log(`Mobilesentrix API error for SKU ${sku}, trying fallback`);
  }

  const supplierPart = await storage.getSupplierPartBySku(sku);
  if (supplierPart) {
    return { price: parseFloat(supplierPart.price), found: true };
  }

  const customPart = await storage.getPartBySku(sku);
  if (customPart) {
    return { price: parseFloat(customPart.price), found: true };
  }

  return { price: 0, found: false };
}

async function calculateServicePrice(
  deviceServiceId: string
): Promise<{ price: number; error?: string }> {
  try {
    const dsWithRelations = await storage.getDeviceServiceWithRelations(deviceServiceId);
    if (!dsWithRelations) {
      return { price: 0, error: "Device service not found" };
    }

    const service = dsWithRelations.service;
    if (!service) {
      return { price: 0, error: "Service not found" };
    }

    const laborPrice = parseFloat(service.laborPrice || "0");
    const partsMarkup = parseFloat(service.partsMarkup || "1.0");
    const secondaryPartPercentage = (service.secondaryPartPercentage || 100) / 100;
    const additionalFee = (dsWithRelations as any).additionalFee || 0;

    if (service.labourOnly) {
      let finalPrice = laborPrice + additionalFee;
      if (!service.bypassRounding) {
        finalPrice = Math.round(finalPrice / 5) * 5 - 1;
        if (finalPrice < 0) finalPrice = laborPrice + additionalFee;
      }
      return { price: finalPrice };
    }

    const primarySkus: string[] = [];
    const primaryPartSku = (dsWithRelations as any).partSku;
    if (primaryPartSku) primarySkus.push(primaryPartSku);
    const alternativeSkus = (dsWithRelations as any).alternativePartSkus || [];
    if (alternativeSkus.length > 0) {
      primarySkus.push(...alternativeSkus);
    }

    const primaryPartOptions: { sku: string; price: number }[] = [];
    for (const sku of primarySkus) {
      const priceResult = await getSkuPrice(sku);
      if (priceResult.found) {
        primaryPartOptions.push({ sku, price: priceResult.price });
      }
    }

    let cheapestPrimaryPrice = 0;
    if (primaryPartOptions.length > 0) {
      cheapestPrimaryPrice = primaryPartOptions.reduce(
        (min, p) => (p.price < min ? p.price : min),
        primaryPartOptions[0].price
      );
    }

    const additionalParts = await storage.getDeviceServiceParts(deviceServiceId);
    let additionalPartsCost = 0;
    for (const ap of additionalParts) {
      if (!ap.isPrimary && ap.part?.sku) {
        const priceResult = await getSkuPrice(ap.part.sku);
        if (priceResult.found) {
          additionalPartsCost += priceResult.price * secondaryPartPercentage;
        }
      }
    }

    const totalPartCost = cheapestPrimaryPrice + additionalPartsCost;
    const markedUpPartCost = totalPartCost * partsMarkup;
    const rawTotal = laborPrice + markedUpPartCost + additionalFee;

    let totalPrice = rawTotal;
    if (!service.bypassRounding) {
      totalPrice = Math.round(rawTotal / 5) * 5 - 1;
      if (totalPrice < 0) totalPrice = rawTotal;
    }

    return { price: totalPrice };
  } catch (error: any) {
    return { price: 0, error: error.message || "Failed to calculate price" };
  }
}

async function updateRepairDeskServicePrice(
  repairDeskServiceId: number,
  price: number
): Promise<{ success: boolean; error?: string }> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { success: false, error: "No RepairDesk API key configured" };
  }

  try {
    const response = await fetch(
      `${REPAIRDESK_API_BASE}/problems/${repairDeskServiceId}?api_key=${encodeURIComponent(apiKey)}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          price: price.toFixed(2),
          online_price: price.toFixed(2),
        }),
      }
    );

    if (response.ok) {
      return { success: true };
    }

    const data = await response.json().catch(() => ({}));
    const errorMsg = data.message || `HTTP ${response.status}`;
    
    if (response.status === 404) {
      return { success: false, error: `Service ID ${repairDeskServiceId} not found in RepairDesk` };
    }
    
    return { success: false, error: errorMsg };
  } catch (error: any) {
    return { success: false, error: error.message || "Network error" };
  }
}

export async function syncAllPricesToRepairDesk(
  syncType: "manual" | "scheduled" = "manual"
): Promise<SyncSummary> {
  const startedAt = new Date().toISOString();
  const results: SyncResult[] = [];

  const linkedServices = await db
    .select({
      id: deviceServices.id,
      repairDeskServiceId: deviceServices.repairDeskServiceId,
      deviceName: devices.name,
      serviceName: services.name,
    })
    .from(deviceServices)
    .innerJoin(devices, eq(deviceServices.deviceId, devices.id))
    .innerJoin(services, eq(deviceServices.serviceId, services.id))
    .where(isNotNull(deviceServices.repairDeskServiceId));

  for (const ds of linkedServices) {
    if (!ds.repairDeskServiceId) continue;

    const priceResult = await calculateServicePrice(ds.id);
    
    if (priceResult.error) {
      results.push({
        deviceServiceId: ds.id,
        repairDeskServiceId: ds.repairDeskServiceId,
        deviceName: ds.deviceName,
        serviceName: ds.serviceName,
        calculatedPrice: 0,
        success: false,
        error: `Price calculation failed: ${priceResult.error}`,
      });
      continue;
    }

    const updateResult = await updateRepairDeskServicePrice(
      ds.repairDeskServiceId,
      priceResult.price
    );

    results.push({
      deviceServiceId: ds.id,
      repairDeskServiceId: ds.repairDeskServiceId,
      deviceName: ds.deviceName,
      serviceName: ds.serviceName,
      calculatedPrice: priceResult.price,
      success: updateResult.success,
      error: updateResult.error,
    });
  }

  const completedAt = new Date().toISOString();
  const syncedServices = results.filter((r) => r.success).length;
  const failedServices = results.filter((r) => !r.success).length;
  const totalServices = results.length;

  let status: "success" | "partial" | "failed";
  if (failedServices === 0 && totalServices > 0) {
    status = "success";
  } else if (syncedServices === 0 && totalServices > 0) {
    status = "failed";
  } else if (totalServices === 0) {
    status = "success";
  } else {
    status = "partial";
  }

  const [syncRecord] = await db
    .insert(repairDeskSyncHistory)
    .values({
      syncType,
      status,
      totalServices,
      syncedServices,
      failedServices,
      errorDetails: failedServices > 0 ? JSON.stringify(results.filter((r) => !r.success)) : null,
      completedAt,
    })
    .returning();

  return {
    syncId: syncRecord.id,
    syncType,
    status,
    totalServices,
    syncedServices,
    failedServices,
    results,
    startedAt,
    completedAt,
  };
}

export async function getSyncHistory(limit: number = 10): Promise<typeof repairDeskSyncHistory.$inferSelect[]> {
  return db
    .select()
    .from(repairDeskSyncHistory)
    .orderBy(sql`${repairDeskSyncHistory.startedAt} DESC`)
    .limit(limit);
}

export async function getLastSyncTime(): Promise<string | null> {
  const [lastSync] = await db
    .select()
    .from(repairDeskSyncHistory)
    .orderBy(sql`${repairDeskSyncHistory.startedAt} DESC`)
    .limit(1);
  return lastSync?.completedAt || lastSync?.startedAt || null;
}

export async function getBrokenLinks(): Promise<BrokenLink[]> {
  const brokenLinks: BrokenLink[] = [];

  const allLinkedServices = await db
    .select({
      id: deviceServices.id,
      repairDeskServiceId: deviceServices.repairDeskServiceId,
      deviceName: devices.name,
      serviceName: services.name,
      partSku: deviceServices.partSku,
      labourOnly: services.labourOnly,
    })
    .from(deviceServices)
    .innerJoin(devices, eq(deviceServices.deviceId, devices.id))
    .innerJoin(services, eq(deviceServices.serviceId, services.id))
    .where(isNotNull(deviceServices.repairDeskServiceId));

  for (const ds of allLinkedServices) {
    if (!ds.labourOnly && !ds.partSku) {
      brokenLinks.push({
        deviceServiceId: ds.id,
        deviceName: ds.deviceName,
        serviceName: ds.serviceName,
        repairDeskServiceId: ds.repairDeskServiceId,
        issue: "No part SKU assigned - price may be incorrect",
      });
    }
  }

  const recentFailures = await db
    .select()
    .from(repairDeskSyncHistory)
    .where(eq(repairDeskSyncHistory.status, "failed"))
    .orderBy(sql`${repairDeskSyncHistory.startedAt} DESC`)
    .limit(1);

  if (recentFailures.length > 0 && recentFailures[0].errorDetails) {
    try {
      const errors = JSON.parse(recentFailures[0].errorDetails);
      for (const err of errors) {
        if (err.error?.includes("not found in RepairDesk")) {
          brokenLinks.push({
            deviceServiceId: err.deviceServiceId,
            deviceName: err.deviceName,
            serviceName: err.serviceName,
            repairDeskServiceId: err.repairDeskServiceId,
            issue: `RepairDesk service ID ${err.repairDeskServiceId} not found`,
          });
        }
      }
    } catch (e) {
    }
  }

  return brokenLinks;
}

export async function getLinkedServicesCount(): Promise<number> {
  const [result] = await db
    .select({ count: sql<number>`count(*)` })
    .from(deviceServices)
    .where(isNotNull(deviceServices.repairDeskServiceId));
  return Number(result?.count) || 0;
}

let syncInterval: NodeJS.Timeout | null = null;

export function startScheduledSync(intervalDays: number = 2): void {
  if (syncInterval) {
    clearInterval(syncInterval);
  }

  const intervalMs = intervalDays * 24 * 60 * 60 * 1000;

  syncInterval = setInterval(async () => {
    console.log("RepairDesk scheduled sync starting...");
    try {
      const result = await syncAllPricesToRepairDesk("scheduled");
      console.log(
        `RepairDesk scheduled sync completed: ${result.syncedServices}/${result.totalServices} synced`
      );
    } catch (error) {
      console.error("RepairDesk scheduled sync failed:", error);
    }
  }, intervalMs);

  console.log(`RepairDesk scheduled sync configured: every ${intervalDays} days`);
}

export function stopScheduledSync(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
    console.log("RepairDesk scheduled sync stopped");
  }
}
