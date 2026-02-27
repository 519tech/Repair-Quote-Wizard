import type { Express } from "express";
import { storage } from "../storage";
import { requireAdmin } from "../middleware";
import { isRepairDeskConnected, checkInventoryBySku } from "../repairdesk";
import { syncAllPricesToRepairDesk, getSyncHistory, getLastSyncTime, getBrokenLinks, getLinkedServicesCount, isRepairDeskSyncConfigured, startScheduledSync } from "../repairdesk-sync";
import { searchProducts, getProductBySku, isMobilesentrixConfigured, getMobilesentrixStatus, MobilesentrixApiError, setDatabaseTokens, testConnection, getCacheStatus, clearPartsCache, fetchAndCacheMultipleSkus } from "../mobilesentrix";

let skuValidationInProgress = false;
let skuValidationProgress = { checked: 0, total: 0, missing: [] as any[], errors: [] as string[] };

export function registerIntegrationRoutes(app: Express) {
  app.get("/api/mobilesentrix/status", requireAdmin, async (req, res) => {
    const status = getMobilesentrixStatus();
    res.json(status);
  });

  app.get("/api/mobilesentrix/test", requireAdmin, async (req, res) => {
    try {
      const result = await testConnection();
      res.json(result);
    } catch (error: any) {
      res.json({ success: false, message: error.message || "Connection test failed" });
    }
  });

  app.get("/api/mobilesentrix/auth-url", requireAdmin, async (req, res) => {
    try {
      const consumerKey = process.env.MOBILESENTRIX_CONSUMER_KEY;
      const consumerSecret = process.env.MOBILESENTRIX_CONSUMER_SECRET;

      if (!consumerKey || !consumerSecret) {
        return res.status(400).json({ error: "Consumer Key and Secret not configured" });
      }

      const baseUrl = process.env.MOBILESENTRIX_API_URL || 'https://www.mobilesentrix.ca';
      const isDev = process.env.NODE_ENV === 'development';
      const host = req.get('host') || '';
      const protocol = req.get('x-forwarded-proto') || (req.secure ? 'https' : 'http');
      const devUrl = `${protocol}://${host}`;
      const appBaseUrl = isDev ? devUrl : (process.env.APP_BASE_URL || 'https://quote.519techservices.ca');
      const callbackUrl = `${appBaseUrl}/api/mobilesentrix/callback`;

      const authUrl = `${baseUrl}/oauth/authorize/identifier?consumer=${encodeURIComponent('519 Tech Services')}&authtype=1&flowentry=SignIn&consumer_key=${encodeURIComponent(consumerKey)}&consumer_secret=${encodeURIComponent(consumerSecret)}&authorize_for=customer&callback=${encodeURIComponent(callbackUrl)}`;

      res.json({ authUrl, callbackUrl });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to generate auth URL" });
    }
  });

  app.get("/api/mobilesentrix/callback", async (req, res) => {
    try {
      const oauthToken = req.query.oauth_token as string;
      const oauthVerifier = req.query.oauth_verifier as string;

      if (!oauthToken || !oauthVerifier) {
        return res.status(400).send(`
          <html><body>
            <h1>OAuth Error</h1>
            <p>Missing oauth_token or oauth_verifier in callback.</p>
            <p>Please try the authorization again.</p>
          </body></html>
        `);
      }

      const consumerKey = process.env.MOBILESENTRIX_CONSUMER_KEY;
      const consumerSecret = process.env.MOBILESENTRIX_CONSUMER_SECRET;
      const baseUrl = process.env.MOBILESENTRIX_API_URL || 'https://www.mobilesentrix.ca';

      const response = await fetch(`${baseUrl}/oauth/authorize/identifiercallback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consumer_key: consumerKey,
          consumer_secret: consumerSecret,
          oauth_token: oauthToken,
          oauth_verifier: oauthVerifier,
        }),
      });

      const data = await response.json() as any;

      if (data.status === 1 && data.data?.access_token && data.data?.access_token_secret) {
        await storage.upsertMessageTemplate({
          type: 'mobilesentrix_access_token',
          content: data.data.access_token
        });
        await storage.upsertMessageTemplate({
          type: 'mobilesentrix_access_token_secret',
          content: data.data.access_token_secret
        });

        setDatabaseTokens(data.data.access_token, data.data.access_token_secret);

        res.send(`
          <html>
          <head><title>Mobilesentrix Authorization Complete</title></head>
          <body style="font-family: system-ui, sans-serif; padding: 40px; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #22c55e;">✓ Authorization Successful!</h1>
            <p>Your Mobilesentrix account has been connected automatically.</p>
            <div style="background: #f1f5f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="color: #22c55e; font-weight: bold;">✓ Access tokens saved to database</p>
              <p style="color: #64748b; font-size: 14px;">The connection is now active. You can close this window.</p>
            </div>
            <a href="/admin" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">Return to Admin Panel</a>
          </body>
          </html>
        `);
      } else {
        res.status(400).send(`
          <html><body>
            <h1>OAuth Error</h1>
            <p>Failed to obtain access token.</p>
            <pre>${JSON.stringify(data, null, 2)}</pre>
          </body></html>
        `);
      }
    } catch (error: any) {
      res.status(500).send(`
        <html><body>
          <h1>OAuth Error</h1>
          <p>${error.message}</p>
        </body></html>
      `);
    }
  });

  app.get("/api/mobilesentrix/search", requireAdmin, async (req, res) => {
    try {
      if (!isMobilesentrixConfigured()) {
        return res.status(400).json({ error: "Mobilesentrix API not configured" });
      }

      const query = req.query.q as string;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      if (!query || query.length < 2) {
        return res.status(400).json({ error: "Search query must be at least 2 characters" });
      }

      const result = await searchProducts(query, page, limit);
      res.json({
        products: result.products.map(p => ({
          sku: p.sku,
          name: p.name,
          price: p.special_price || p.price,
          inStock: p.is_in_stock !== false,
        })),
        total: result.total_count,
        page,
        limit,
      });
    } catch (error: any) {
      console.error('Mobilesentrix search error:', error);
      if (error instanceof MobilesentrixApiError) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      res.status(500).json({ error: error.message || "Failed to search Mobilesentrix products" });
    }
  });

  app.get("/api/mobilesentrix/sku/:sku", requireAdmin, async (req, res) => {
    try {
      if (!isMobilesentrixConfigured()) {
        return res.status(400).json({ error: "Mobilesentrix API not configured" });
      }

      const result = await getProductBySku(req.params.sku);
      if (!result.found) {
        return res.status(404).json({ error: "Product not found", sku: req.params.sku });
      }
      res.json(result);
    } catch (error: any) {
      console.error('Mobilesentrix SKU lookup error:', error);
      res.status(500).json({ error: error.message || "Failed to lookup product" });
    }
  });

  app.get("/api/mobilesentrix/cache-status", async (req, res) => {
    try {
      const status = getCacheStatus();
      res.json(status);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to get cache status" });
    }
  });

  app.post("/api/mobilesentrix/clear-cache", requireAdmin, async (req, res) => {
    try {
      clearPartsCache();
      res.json({ success: true, message: "Cache cleared" });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to clear cache" });
    }
  });

  app.get("/api/mobilesentrix/validate-skus/progress", requireAdmin, async (req, res) => {
    res.json({
      inProgress: skuValidationInProgress,
      ...skuValidationProgress,
    });
  });

  app.post("/api/mobilesentrix/validate-skus", requireAdmin, async (req, res) => {
    if (skuValidationInProgress) {
      return res.status(409).json({ error: "Validation already in progress" });
    }

    try {
      if (!isMobilesentrixConfigured()) {
        return res.status(400).json({ error: "Mobilesentrix API is not configured" });
      }

      const allDeviceServices = await storage.getDeviceServices();
      const allParts = await storage.getParts();
      const customSkus = new Set(allParts.filter(p => p.isCustom).map(p => p.sku));

      const skuToLinks = new Map<string, Array<{ id: string; deviceName: string; brandName: string; serviceName: string; isPrimary: boolean }>>();

      for (const ds of allDeviceServices) {
        const deviceName = ds.device?.name || "Unknown";
        const brandName = ds.device?.brand?.name || "";
        const serviceName = ds.service?.name || "Unknown";

        if (ds.partSku && !customSkus.has(ds.partSku)) {
          if (!skuToLinks.has(ds.partSku)) skuToLinks.set(ds.partSku, []);
          skuToLinks.get(ds.partSku)!.push({ id: ds.id, deviceName, brandName, serviceName, isPrimary: true });
        }

        const altSkus = (ds as any).alternativePartSkus;
        if (Array.isArray(altSkus)) {
          for (const altSku of altSkus) {
            if (altSku && altSku.trim() && !customSkus.has(altSku)) {
              if (!skuToLinks.has(altSku)) skuToLinks.set(altSku, []);
              skuToLinks.get(altSku)!.push({ id: ds.id, deviceName, brandName, serviceName, isPrimary: false });
            }
          }
        }
      }

      const uniqueSkus = Array.from(skuToLinks.keys());
      if (uniqueSkus.length === 0) {
        return res.json({ checked: 0, total: 0, missing: [], errors: [] });
      }

      skuValidationInProgress = true;
      skuValidationProgress = { checked: 0, total: uniqueSkus.length, missing: [], errors: [] };

      res.json({ started: true, total: uniqueSkus.length });

      const batchSize = 5;
      const delayBetweenBatches = 1500;

      for (let i = 0; i < uniqueSkus.length; i += batchSize) {
        const batch = uniqueSkus.slice(i, i + batchSize);

        const results = await Promise.allSettled(
          batch.map(async (sku) => {
            try {
              const result = await getProductBySku(sku);
              return { sku, found: result.found, name: result.name };
            } catch (error: any) {
              return { sku, found: false, error: error.message };
            }
          })
        );

        for (const result of results) {
          skuValidationProgress.checked++;
          if (result.status === 'fulfilled') {
            const val = result.value;
            if (!val.found) {
              const links = skuToLinks.get(val.sku) || [];
              skuValidationProgress.missing.push({
                sku: val.sku,
                error: (val as any).error || undefined,
                affectedLinks: links,
              });
            }
          } else {
            skuValidationProgress.errors.push(result.reason?.message || 'Unknown error');
          }
        }

        if (i + batchSize < uniqueSkus.length) {
          await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
        }
      }

      skuValidationInProgress = false;
      console.log(`SKU validation complete: ${skuValidationProgress.checked} checked, ${skuValidationProgress.missing.length} missing`);
    } catch (error: any) {
      skuValidationInProgress = false;
      skuValidationProgress.errors.push(error.message);
      console.error("SKU validation error:", error);
    }
  });

  app.post("/api/prefetch-category-parts", async (req, res) => {
    try {
      const { deviceId, categoryId } = req.body;

      if (!deviceId || typeof deviceId !== 'string') {
        return res.status(400).json({ error: "deviceId is required and must be a string" });
      }

      if (categoryId && typeof categoryId !== 'string') {
        return res.status(400).json({ error: "categoryId must be a string if provided" });
      }

      const templates = await storage.getMessageTemplates();
      const pricingSourceSetting = templates.find(t => t.type === 'pricing_source');
      const pricingSource = pricingSourceSetting?.content || 'excel_upload';

      if (pricingSource === 'excel_upload') {
        return res.json({
          success: true,
          message: "Using Excel pricing - no prefetch needed",
          source: 'excel',
          skusFetched: 0
        });
      }

      if (!isMobilesentrixConfigured()) {
        return res.json({
          success: false,
          message: "API not configured",
          source: 'api',
          skusFetched: 0
        });
      }

      const deviceServices = await storage.getDeviceServicesByDevice(deviceId);

      const filteredServices = categoryId
        ? deviceServices.filter(ds => ds.service.categoryId === categoryId)
        : deviceServices;

      const skusToFetch: string[] = [];

      for (const ds of filteredServices) {
        if (ds.partSku) {
          skusToFetch.push(ds.partSku);
        }

        if (ds.alternativePartSkus && Array.isArray(ds.alternativePartSkus)) {
          for (const altSku of ds.alternativePartSkus) {
            if (altSku && typeof altSku === 'string') {
              skusToFetch.push(altSku);
            }
          }
        }

        const additionalParts = await storage.getDeviceServiceParts(ds.id);
        for (const ap of additionalParts) {
          if (ap.part?.sku) {
            skusToFetch.push(ap.part.sku);
          }
        }
      }

      const uniqueSkus = [...new Set(skusToFetch)];

      if (uniqueSkus.length === 0) {
        return res.json({
          success: true,
          message: "No parts to prefetch",
          source: 'api',
          skusFetched: 0
        });
      }

      console.log(`Prefetching ${uniqueSkus.length} SKUs for device ${deviceId}${categoryId ? ` category ${categoryId}` : ''}`);
      const results = await fetchAndCacheMultipleSkus(uniqueSkus);

      const foundCount = Array.from(results.values()).filter(r => r.found).length;

      res.json({
        success: true,
        message: `Prefetched ${results.size} SKUs (${foundCount} found)`,
        source: 'api',
        skusFetched: results.size,
        skusFound: foundCount,
        cacheStatus: getCacheStatus()
      });
    } catch (error: any) {
      console.error('Prefetch error:', error);
      res.status(500).json({ error: error.message || "Failed to prefetch parts" });
    }
  });

  app.get("/api/repairdesk/status", requireAdmin, async (req, res) => {
    try {
      const connected = await isRepairDeskConnected();
      const templates = await storage.getMessageTemplates();
      const stockSetting = templates.find(t => t.type === 'stock_check_enabled');
      const stockCheckEnabled = stockSetting ? stockSetting.content === 'true' : true;
      res.json({ connected, stockCheckEnabled });
    } catch (error) {
      res.status(500).json({ error: "Failed to check RepairDesk status" });
    }
  });

  app.get("/api/repairdesk/stock-enabled", async (req, res) => {
    try {
      const templates = await storage.getMessageTemplates();
      const stockSetting = templates.find(t => t.type === 'stock_check_enabled');
      const enabled = stockSetting ? stockSetting.content === 'true' : true;
      const connected = await isRepairDeskConnected();
      res.json({ enabled: enabled && connected });
    } catch (error) {
      res.json({ enabled: false });
    }
  });

  app.post("/api/repairdesk/stock-enabled", requireAdmin, async (req, res) => {
    try {
      const { enabled } = req.body;
      await storage.upsertMessageTemplate({
        type: 'stock_check_enabled',
        content: enabled ? 'true' : 'false'
      });
      res.json({ success: true, enabled });
    } catch (error) {
      res.status(500).json({ error: "Failed to update setting" });
    }
  });

  app.post("/api/repairdesk/check-stock", async (req, res) => {
    try {
      const templates = await storage.getMessageTemplates();
      const stockSetting = templates.find(t => t.type === 'stock_check_enabled');
      const stockCheckEnabled = stockSetting ? stockSetting.content === 'true' : true;

      if (!stockCheckEnabled) {
        return res.json({});
      }

      const { skus } = req.body;
      if (!Array.isArray(skus)) {
        return res.status(400).json({ error: "skus must be an array" });
      }

      if (skus.length > 50) {
        return res.status(400).json({ error: "Maximum 50 SKUs per request" });
      }

      const stockMap = await checkInventoryBySku(skus);
      const result: Record<string, number> = {};
      stockMap.forEach((qty, sku) => {
        result[sku] = qty;
      });
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to check stock" });
    }
  });

  app.get("/api/repairdesk/sync/status", requireAdmin, async (req, res) => {
    try {
      const configured = isRepairDeskSyncConfigured();
      const connected = configured ? await isRepairDeskConnected() : false;
      const linkedServicesCount = await getLinkedServicesCount();
      const lastSyncTime = await getLastSyncTime();

      res.json({
        configured,
        connected,
        linkedServicesCount,
        lastSyncTime,
      });
    } catch (error) {
      console.error("Failed to get RepairDesk sync status:", error);
      res.status(500).json({ error: "Failed to get sync status" });
    }
  });

  app.post("/api/repairdesk/sync/trigger", requireAdmin, async (req, res) => {
    try {
      const result = await syncAllPricesToRepairDesk("manual");
      res.json(result);
    } catch (error) {
      console.error("Failed to trigger RepairDesk sync:", error);
      res.status(500).json({ error: "Failed to trigger sync" });
    }
  });

  app.get("/api/repairdesk/sync/history", requireAdmin, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const history = await getSyncHistory(limit);
      res.json(history);
    } catch (error) {
      console.error("Failed to get sync history:", error);
      res.status(500).json({ error: "Failed to get sync history" });
    }
  });

  app.get("/api/repairdesk/sync/broken-links", requireAdmin, async (req, res) => {
    try {
      const brokenLinks = await getBrokenLinks();
      res.json(brokenLinks);
    } catch (error) {
      console.error("Failed to get broken links:", error);
      res.status(500).json({ error: "Failed to get broken links" });
    }
  });

  app.get("/api/repairdesk/sync/calculated-prices", requireAdmin, async (req, res) => {
    try {
      const { getCalculatedPrices } = await import("../repairdesk-sync");
      const prices = await getCalculatedPrices();
      res.json(prices);
    } catch (error) {
      console.error("Failed to get calculated prices:", error);
      res.status(500).json({ error: "Failed to get calculated prices" });
    }
  });

  if (isRepairDeskSyncConfigured()) {
    startScheduledSync(2);
  }
}
