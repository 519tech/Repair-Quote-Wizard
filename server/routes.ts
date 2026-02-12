import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  insertDeviceTypeSchema,
  insertDeviceSchema,
  insertPartSchema,
  insertServiceCategorySchema,
  insertServiceSchema,
  insertDeviceServiceSchema,
  insertQuoteRequestSchema,
  insertBrandSchema,
  insertBrandDeviceTypeSchema,
  insertBrandServiceCategorySchema,
  insertMessageTemplateSchema,
} from "@shared/schema";
import { z } from "zod";
import multer from "multer";
import * as XLSX from "xlsx";
import bcrypt from "bcrypt";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { sendQuoteEmail, sendCombinedQuoteEmail, sendAdminNotificationEmail, sendUnknownDeviceQuoteEmail, sendUnknownDeviceAdminNotification, sendTestEmail } from "./gmail";
import { sendQuoteSms, sendCombinedQuoteSms, sendUnknownDeviceQuoteSms, sendTestSms } from "./sms";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import { isRepairDeskConnected, disconnectRepairDesk, checkInventoryBySku, createLead } from "./repairdesk";
import { syncAllPricesToRepairDesk, getSyncHistory, getLastSyncTime, getBrokenLinks, getLinkedServicesCount, isRepairDeskSyncConfigured, startScheduledSync } from "./repairdesk-sync";
import { searchProducts, getProductBySku, getProductPrice, isMobilesentrixConfigured, getMobilesentrixStatus, MobilesentrixApiError, setDatabaseTokens, setErrorNotificationCallback, testConnection, getCachedPrice, setCachedPrice, getCacheStatus, clearPartsCache, fetchAndCacheMultipleSkus } from "./mobilesentrix";
import { sendApiErrorNotification } from "./gmail";
import OpenAI from "openai";

let deviceSearchCache: {
  devices: any[];
  brands: Map<string, any>;
  types: Map<string, any>;
  timestamp: number;
} | null = null;
const DEVICE_CACHE_TTL = 2 * 60 * 1000;

async function getDeviceSearchData() {
  const now = Date.now();
  if (deviceSearchCache && (now - deviceSearchCache.timestamp) < DEVICE_CACHE_TTL) {
    return deviceSearchCache;
  }
  const [allDevices, allBrands, allTypes] = await Promise.all([
    storage.getDevices(),
    storage.getBrands(),
    storage.getDeviceTypes(),
  ]);
  deviceSearchCache = {
    devices: allDevices,
    brands: new Map(allBrands.map(b => [b.id, b])),
    types: new Map(allTypes.map(t => [t.id, t])),
    timestamp: now,
  };
  return deviceSearchCache;
}

function invalidateDeviceSearchCache() {
  deviceSearchCache = null;
}

// Extend express-session types
declare module "express-session" {
  interface SessionData {
    userId?: string;
    username?: string;
    isAdmin?: boolean;
  }
}

// Admin authentication middleware
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.isAdmin) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ];
    if (allowedTypes.includes(file.mimetype) || file.originalname.endsWith('.xlsx') || file.originalname.endsWith('.xls')) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files (.xlsx, .xls) are allowed'));
    }
  }
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Setup session middleware
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    tableName: "sessions",
  });
  
  app.set("trust proxy", 1);
  app.use(session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 1 week
    },
  }));

  // Register Object Storage routes for file uploads
  registerObjectStorageRoutes(app);

  // Load Mobilesentrix tokens from database on startup
  try {
    const accessToken = await storage.getMessageTemplate('mobilesentrix_access_token');
    const accessTokenSecret = await storage.getMessageTemplate('mobilesentrix_access_token_secret');
    if (accessToken?.content && accessTokenSecret?.content) {
      setDatabaseTokens(accessToken.content, accessTokenSecret.content);
      console.log('Mobilesentrix tokens loaded from database');
    }
  } catch (error) {
    console.log('No Mobilesentrix tokens found in database, will use environment variables if available');
  }
  
  // Set up Mobilesentrix API error notification callback
  setErrorNotificationCallback((errorMessage, endpoint) => {
    sendApiErrorNotification('Mobilesentrix API', errorMessage, endpoint).catch(err => {
      console.error('Failed to send API error notification:', err);
    });
  });

  // Admin login with username/password
  app.post("/api/admin/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ error: "Username and password required" });
      }
      
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ error: "Invalid username or password" });
      }
      
      const validPassword = await bcrypt.compare(password, user.passwordHash);
      if (!validPassword) {
        return res.status(401).json({ error: "Invalid username or password" });
      }
      
      req.session.userId = user.id;
      req.session.username = user.username;
      req.session.isAdmin = true;
      
      res.json({ success: true, username: user.username });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  app.post("/api/admin/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Logout failed" });
      }
      res.clearCookie("connect.sid");
      res.json({ success: true });
    });
  });

  app.get("/api/admin/me", (req, res) => {
    res.json({ 
      isAdmin: req.session?.isAdmin === true,
      username: req.session?.username || null,
    });
  });

  // Test Email Endpoint
  app.post("/api/admin/test-email", async (req, res) => {
    if (!req.session?.isAdmin) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: "Email is required" });
    }
    
    try {
      const success = await sendTestEmail(email);
      if (success) {
        res.json({ success: true, message: `Test email sent to ${email}` });
      } else {
        res.status(500).json({ error: "Failed to send test email" });
      }
    } catch (error: any) {
      console.error('Test email error:', error);
      res.status(500).json({ error: error.message || "Failed to send test email" });
    }
  });

  // Test SMS Endpoint
  app.post("/api/admin/test-sms", async (req, res) => {
    if (!req.session?.isAdmin) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    const { phone } = req.body;
    if (!phone || typeof phone !== 'string') {
      return res.status(400).json({ error: "Phone number is required" });
    }
    
    try {
      const success = await sendTestSms(phone);
      if (success) {
        res.json({ success: true, message: `Test SMS sent to ${phone}` });
      } else {
        res.status(500).json({ error: "Failed to send test SMS" });
      }
    } catch (error: any) {
      console.error('Test SMS error:', error);
      res.status(500).json({ error: error.message || "Failed to send test SMS" });
    }
  });

  // Device Types
  app.get("/api/device-types", async (req, res) => {
    try {
      const types = await storage.getDeviceTypes();
      res.json(types);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch device types" });
    }
  });

  app.post("/api/device-types", requireAdmin, async (req, res) => {
    try {
      const data = insertDeviceTypeSchema.parse(req.body);
      const type = await storage.createDeviceType(data);
      invalidateDeviceSearchCache();
      res.status(201).json(type);
    } catch (error: any) {
      if (error.message?.includes("unique constraint")) {
        res.status(400).json({ error: `A device type with the name "${req.body.name}" already exists` });
      } else {
        res.status(400).json({ error: error.message || "Failed to create device type" });
      }
    }
  });

  app.patch("/api/device-types/:id", requireAdmin, async (req, res) => {
    try {
      const data = insertDeviceTypeSchema.partial().parse(req.body);
      const type = await storage.updateDeviceType(req.params.id, data);
      if (!type) {
        return res.status(404).json({ error: "Device type not found" });
      }
      invalidateDeviceSearchCache();
      res.json(type);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to update device type" });
    }
  });

  app.delete("/api/device-types/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteDeviceType(req.params.id);
      invalidateDeviceSearchCache();
      res.status(204).send();
    } catch (error: any) {
      console.error("Delete device type error:", error);
      res.status(500).json({ error: error.message || "Failed to delete device type" });
    }
  });

  app.post("/api/device-types/reorder", requireAdmin, async (req, res) => {
    try {
      const { orderedIds } = req.body;
      if (!Array.isArray(orderedIds)) {
        return res.status(400).json({ error: "orderedIds must be an array" });
      }
      await storage.reorderDeviceTypes(orderedIds);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to reorder device types" });
    }
  });

  // Brands
  app.get("/api/brands", async (req, res) => {
    try {
      const brands = await storage.getBrands();
      res.json(brands);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch brands" });
    }
  });

  app.get("/api/brands/by-type/:deviceTypeId", async (req, res) => {
    try {
      const brands = await storage.getBrandsByDeviceType(req.params.deviceTypeId);
      res.json(brands);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch brands" });
    }
  });

  app.post("/api/brands", requireAdmin, async (req, res) => {
    try {
      const data = insertBrandSchema.parse(req.body);
      const brand = await storage.createBrand(data);
      invalidateDeviceSearchCache();
      res.status(201).json(brand);
    } catch (error: any) {
      if (error.message?.includes("unique constraint")) {
        res.status(400).json({ error: `A brand with the name "${req.body.name}" already exists` });
      } else {
        res.status(400).json({ error: error.message || "Failed to create brand" });
      }
    }
  });

  app.patch("/api/brands/:id", requireAdmin, async (req, res) => {
    try {
      const data = insertBrandSchema.partial().parse(req.body);
      const brand = await storage.updateBrand(req.params.id, data);
      if (!brand) {
        return res.status(404).json({ error: "Brand not found" });
      }
      invalidateDeviceSearchCache();
      res.json(brand);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to update brand" });
    }
  });

  app.delete("/api/brands/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteBrand(req.params.id);
      invalidateDeviceSearchCache();
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete brand" });
    }
  });

  app.post("/api/brands/reorder", requireAdmin, async (req, res) => {
    try {
      const { orderedIds } = req.body;
      if (!Array.isArray(orderedIds)) {
        return res.status(400).json({ error: "orderedIds must be an array" });
      }
      await storage.reorderBrands(orderedIds);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to reorder brands" });
    }
  });

  // Brand-DeviceType Links
  app.get("/api/brand-device-types", async (req, res) => {
    try {
      const links = await storage.getBrandDeviceTypes();
      res.json(links);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch brand-device-type links" });
    }
  });

  app.post("/api/brand-device-types", requireAdmin, async (req, res) => {
    try {
      const data = insertBrandDeviceTypeSchema.parse(req.body);
      const link = await storage.createBrandDeviceType(data);
      res.status(201).json(link);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to create brand-device-type link" });
    }
  });

  app.delete("/api/brand-device-types/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteBrandDeviceType(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete brand-device-type link" });
    }
  });

  // Brand-ServiceCategory Links
  app.get("/api/brand-service-categories", async (req, res) => {
    try {
      const links = await storage.getBrandServiceCategories();
      res.json(links);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch brand-service-category links" });
    }
  });

  app.get("/api/brand-service-categories/by-brand/:brandId", async (req, res) => {
    try {
      const categories = await storage.getCategoriesByBrand(req.params.brandId);
      res.json(categories);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch categories for brand" });
    }
  });

  app.post("/api/brand-service-categories", requireAdmin, async (req, res) => {
    try {
      const data = insertBrandServiceCategorySchema.parse(req.body);
      const link = await storage.createBrandServiceCategory(data);
      res.status(201).json(link);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to create brand-service-category link" });
    }
  });

  app.delete("/api/brand-service-categories/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteBrandServiceCategory(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete brand-service-category link" });
    }
  });

  // Devices
  app.get("/api/devices/search", async (req, res) => {
    try {
      const query = (req.query.q as string || "").toLowerCase().trim();
      if (!query || query.length < 2) {
        return res.json([]);
      }
      const cached = await getDeviceSearchData();
      const queryWords = query.split(/\s+/).filter(w => w.length > 0);
      
      const results = cached.devices
        .map(device => ({
          ...device,
          brand: device.brandId ? cached.brands.get(device.brandId) : null,
          deviceType: cached.types.get(device.deviceTypeId),
        }))
        .filter(device => {
          const deviceName = device.name.toLowerCase();
          const brandName = device.brand?.name?.toLowerCase() || "";
          const typeName = device.deviceType?.name?.toLowerCase() || "";
          const fullText = `${brandName} ${deviceName} ${typeName}`;
          return queryWords.every(word => fullText.includes(word));
        })
        .slice(0, 20);
      
      res.json(results);
    } catch (error) {
      res.status(500).json({ error: "Failed to search devices" });
    }
  });

  app.get("/api/devices", async (req, res) => {
    try {
      const typeId = req.query.typeId as string | undefined;
      const brandId = req.query.brandId as string | undefined;
      let devices;
      if (typeId && brandId) {
        devices = await storage.getDevicesByTypeAndBrand(typeId, brandId);
      } else if (typeId) {
        devices = await storage.getDevicesByType(typeId);
      } else {
        devices = await storage.getDevices();
      }
      res.json(devices);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch devices" });
    }
  });

  app.get("/api/devices/:typeId", async (req, res) => {
    try {
      const devices = await storage.getDevicesByType(req.params.typeId);
      res.json(devices);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch devices" });
    }
  });

  app.post("/api/devices", requireAdmin, async (req, res) => {
    try {
      const data = insertDeviceSchema.parse(req.body);
      const device = await storage.createDevice(data);
      invalidateDeviceSearchCache();
      res.status(201).json(device);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to create device" });
    }
  });

  app.patch("/api/devices/:id", requireAdmin, async (req, res) => {
    try {
      const data = insertDeviceSchema.partial().parse(req.body);
      const device = await storage.updateDevice(req.params.id, data);
      if (!device) {
        return res.status(404).json({ error: "Device not found" });
      }
      invalidateDeviceSearchCache();
      res.json(device);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to update device" });
    }
  });

  app.delete("/api/devices/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteDevice(req.params.id);
      invalidateDeviceSearchCache();
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete device" });
    }
  });

  app.post("/api/devices/detect-release-date", requireAdmin, async (req, res) => {
    try {
      const { modelName, brandName } = req.body;
      if (!modelName) {
        return res.status(400).json({ error: "modelName is required" });
      }

      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });

      const prompt = `What is the release date of the ${brandName ? brandName + " " : ""}${modelName}? Reply with ONLY the date in YYYY-MM-DD format (e.g., 2024-09-20). If you can only determine the month, use the 1st of that month. If you can only determine the year, use January 1st. If you cannot determine the release date at all, reply with "unknown".`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a device release date lookup assistant. You respond with only the release date in YYYY-MM-DD format or 'unknown'. No explanations." },
          { role: "user", content: prompt },
        ],
        max_tokens: 20,
      });

      const result = response.choices[0]?.message?.content?.trim() || "unknown";
      console.log(`Release date detection for "${brandName ? brandName + ' ' : ''}${modelName}": AI returned "${result}"`);
      const dateMatch = result.match(/^\d{4}-\d{2}-\d{2}$/);

      if (dateMatch) {
        res.json({ releaseDate: dateMatch[0] });
      } else {
        res.json({ releaseDate: null, message: "Could not determine release date" });
      }
    } catch (error: any) {
      console.error("Release date detection error:", error);
      res.status(500).json({ error: "Failed to detect release date" });
    }
  });

  app.post("/api/devices/bulk-detect-release-dates", requireAdmin, async (req, res) => {
    try {
      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });

      const allDevices = await storage.getDevices();
      const brands = await storage.getBrands();
      const brandMap = new Map(brands.map(b => [b.id, b.name]));

      const devicesWithoutDate = allDevices.filter(d => !d.releaseDate);
      const total = devicesWithoutDate.length;

      if (total === 0) {
        return res.json({ message: "All devices already have release dates", updated: 0, failed: 0, total: 0 });
      }

      let updated = 0;
      let failed = 0;
      let skippedRateLimit = 0;
      const results: Array<{ name: string; date: string | null; error?: string }> = [];

      const detectWithRetry = async (deviceName: string, brandName: string, maxRetries = 3): Promise<string> => {
        for (let attempt = 0; attempt < maxRetries; attempt++) {
          try {
            const prompt = `What is the release date of the ${brandName ? brandName + " " : ""}${deviceName}? Reply with ONLY the date in YYYY-MM-DD format (e.g., 2024-09-20). If you can only determine the month, use the 1st of that month. If you can only determine the year, use January 1st. If you cannot determine the release date at all, reply with "unknown".`;
            const response = await openai.chat.completions.create({
              model: "gpt-4o-mini",
              messages: [
                { role: "system", content: "You are a device release date lookup assistant. You respond with only the release date in YYYY-MM-DD format or 'unknown'. No explanations." },
                { role: "user", content: prompt },
              ],
              max_tokens: 20,
            });
            return response.choices[0]?.message?.content?.trim() || "unknown";
          } catch (err: any) {
            const isRateLimit = err.status === 429 || err.message?.includes("rate") || err.message?.includes("429");
            if (isRateLimit && attempt < maxRetries - 1) {
              const waitTime = Math.pow(2, attempt + 1) * 5000;
              console.log(`Rate limited on "${brandName} ${deviceName}", waiting ${waitTime / 1000}s before retry ${attempt + 2}/${maxRetries}`);
              await new Promise(resolve => setTimeout(resolve, waitTime));
            } else {
              throw err;
            }
          }
        }
        return "unknown";
      };

      for (let i = 0; i < devicesWithoutDate.length; i++) {
        const device = devicesWithoutDate[i];
        const brandName = brandMap.get(device.brandId) || "";

        try {
          const result = await detectWithRetry(device.name, brandName);
          const dateMatch = result.match(/^\d{4}-\d{2}-\d{2}$/);

          if (dateMatch) {
            await storage.updateDevice(device.id, { releaseDate: dateMatch[0] });
            updated++;
            results.push({ name: `${brandName} ${device.name}`, date: dateMatch[0] });
            console.log(`Bulk detect [${i + 1}/${devicesWithoutDate.length}]: ${brandName} ${device.name} -> ${dateMatch[0]}`);
          } else {
            failed++;
            results.push({ name: `${brandName} ${device.name}`, date: null, error: `AI returned: ${result}` });
            console.log(`Bulk detect [${i + 1}/${devicesWithoutDate.length}]: ${brandName} ${device.name} -> unknown (${result})`);
          }
        } catch (err: any) {
          failed++;
          const isRateLimit = err.status === 429 || err.message?.includes("rate") || err.message?.includes("429");
          if (isRateLimit) skippedRateLimit++;
          results.push({ name: `${brandName} ${device.name}`, date: null, error: err.message });
          console.error(`Bulk detect error [${i + 1}/${devicesWithoutDate.length}] for ${device.name}:`, err.message);
        }

        await new Promise(resolve => setTimeout(resolve, 1500));
      }

      invalidateDeviceSearchCache();
      res.json({ message: "Bulk detection complete", total, updated, failed, skippedRateLimit, results });
    } catch (error: any) {
      console.error("Bulk release date detection error:", error);
      res.status(500).json({ error: "Failed to run bulk detection" });
    }
  });

  // Device bulk import template
  app.get("/api/devices/template", requireAdmin, async (req, res) => {
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();
      const wsData = [
        ["Brand", "Type", "Model Name", "Image URL"],
        ["Apple", "smartphone", "iPhone 15 Pro", "https://example.com/iphone15.jpg"],
        ["Samsung", "smartphone", "Galaxy S24", ""],
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      ws["!cols"] = [{ wch: 15 }, { wch: 15 }, { wch: 25 }, { wch: 50 }];
      XLSX.utils.book_append_sheet(wb, ws, "Devices");
      const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=device-import-template.xlsx");
      res.send(buffer);
    } catch (error) {
      console.error("Template generation error:", error);
      res.status(500).json({ error: "Failed to generate template" });
    }
  });

  // Device bulk import
  app.post("/api/devices/bulk-import", requireAdmin, async (req, res) => {
    try {
      const { devices: deviceRows } = req.body;
      if (!Array.isArray(deviceRows) || deviceRows.length === 0) {
        return res.status(400).json({ error: "No devices to import" });
      }

      const brands = await storage.getBrands();
      const deviceTypes = await storage.getDeviceTypes();
      
      const results = { created: 0, errors: [] as string[] };
      
      for (const row of deviceRows) {
        try {
          const brandName = row.brand?.trim();
          const typeName = row.type?.trim()?.toLowerCase();
          const modelName = row.modelName?.trim();
          const imageUrl = row.imageUrl?.trim();
          
          if (!modelName) {
            results.errors.push(`Row skipped: missing model name`);
            continue;
          }
          
          const deviceType = deviceTypes.find((t) => t.name.toLowerCase() === typeName);
          if (!deviceType) {
            results.errors.push(`Row "${modelName}": device type "${typeName}" not found`);
            continue;
          }
          
          let brandId: string | null = null;
          if (brandName) {
            const brand = brands.find((b) => b.name.toLowerCase() === brandName.toLowerCase());
            if (!brand) {
              results.errors.push(`Row "${modelName}": brand "${brandName}" not found`);
              continue;
            }
            brandId = brand.id;
          }
          
          await storage.createDevice({
            name: modelName,
            deviceTypeId: deviceType.id,
            brandId,
            imageUrl: imageUrl || null,
          });
          results.created++;
        } catch (err: any) {
          if (err.message?.includes("unique constraint") || err.message?.includes("duplicate")) {
            results.errors.push(`Row "${row.modelName}": device already exists`);
          } else {
            results.errors.push(`Row "${row.modelName}": ${err.message}`);
          }
        }
      }
      
      invalidateDeviceSearchCache();
      res.json(results);
    } catch (error: any) {
      console.error("Bulk import error:", error);
      res.status(500).json({ error: error.message || "Failed to import devices" });
    }
  });

  // Parts
  app.get("/api/parts", async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 100;
      const search = req.query.search as string | undefined;
      const isCustom = req.query.isCustom === 'true' ? true : req.query.isCustom === 'false' ? false : undefined;
      
      // If pagination params provided, use paginated query
      if (req.query.page || req.query.limit || req.query.search || req.query.isCustom !== undefined) {
        const result = await storage.getPartsPaginated({ page, limit, search, isCustom });
        res.json(result);
      } else {
        // Legacy: return all parts (for backwards compatibility with other parts of the app)
        const parts = await storage.getParts();
        res.json(parts);
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch parts" });
    }
  });

  app.get("/api/parts/sku/:sku", async (req, res) => {
    try {
      const part = await storage.getPartBySku(req.params.sku);
      if (!part) {
        return res.status(404).json({ error: "Part not found" });
      }
      res.json(part);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch part" });
    }
  });

  app.post("/api/parts", requireAdmin, async (req, res) => {
    try {
      const data = insertPartSchema.parse(req.body);
      const part = await storage.createPart(data);
      res.status(201).json(part);
    } catch (error: any) {
      if (error.message?.includes("unique constraint")) {
        res.status(400).json({ error: `A part with SKU "${req.body.sku}" already exists` });
      } else {
        res.status(400).json({ error: error.message || "Failed to create part" });
      }
    }
  });

  app.patch("/api/parts/:id", requireAdmin, async (req, res) => {
    try {
      const data = insertPartSchema.partial().parse(req.body);
      const part = await storage.updatePart(req.params.id, data);
      if (!part) {
        return res.status(404).json({ error: "Part not found" });
      }
      res.json(part);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to update part" });
    }
  });

  app.delete("/api/parts/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deletePart(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete part" });
    }
  });

  // Supplier Parts (Excel upload) - for pricing when not using Mobilesentrix API
  app.get("/api/supplier-parts", requireAdmin, async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const search = req.query.search as string | undefined;
      
      const result = await storage.getSupplierPartsPaginated({ page, limit, search });
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch supplier parts" });
    }
  });

  app.get("/api/supplier-parts/count", requireAdmin, async (req, res) => {
    try {
      const count = await storage.getSupplierPartCount();
      res.json({ count });
    } catch (error) {
      res.status(500).json({ error: "Failed to count supplier parts" });
    }
  });

  app.get("/api/supplier-parts/sku/:sku", async (req, res) => {
    try {
      const part = await storage.getSupplierPartBySku(req.params.sku);
      if (!part) {
        return res.status(404).json({ error: "Part not found" });
      }
      res.json(part);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch supplier part" });
    }
  });

  app.post("/api/supplier-parts/upload", requireAdmin, async (req, res) => {
    try {
      const { parts: partsData } = req.body;
      if (!Array.isArray(partsData) || partsData.length === 0) {
        return res.status(400).json({ error: "Parts data is required" });
      }

      // Validate and transform the data
      const validParts = partsData
        .filter((p: any) => p.sku && p.name && p.price !== undefined)
        .map((p: any) => ({
          sku: String(p.sku).trim(),
          name: String(p.name).trim(),
          price: String(parseFloat(p.price).toFixed(2)),
        }));

      if (validParts.length === 0) {
        return res.status(400).json({ error: "No valid parts found in data" });
      }

      const result = await storage.bulkReplaceSupplierParts(validParts);
      
      // Save the last updated timestamp
      await storage.upsertMessageTemplate({
        type: 'parts_last_updated',
        content: new Date().toISOString()
      });
      
      res.json({ success: true, ...result });
    } catch (error: any) {
      console.error("Supplier parts upload error:", error);
      res.status(500).json({ error: error.message || "Failed to upload supplier parts" });
    }
  });

  // Mobilesentrix API Integration (all supplier pricing comes from this API)
  app.get("/api/mobilesentrix/status", requireAdmin, async (req, res) => {
    const status = getMobilesentrixStatus();
    res.json(status);
  });

  // Test Mobilesentrix API connection
  app.get("/api/mobilesentrix/test", requireAdmin, async (req, res) => {
    try {
      const result = await testConnection();
      res.json(result);
    } catch (error: any) {
      res.json({ success: false, message: error.message || "Connection test failed" });
    }
  });

  // Generate OAuth authorization URL for Mobilesentrix
  app.get("/api/mobilesentrix/auth-url", requireAdmin, async (req, res) => {
    try {
      const consumerKey = process.env.MOBILESENTRIX_CONSUMER_KEY;
      const consumerSecret = process.env.MOBILESENTRIX_CONSUMER_SECRET;
      
      if (!consumerKey || !consumerSecret) {
        return res.status(400).json({ error: "Consumer Key and Secret not configured" });
      }
      
      const baseUrl = process.env.MOBILESENTRIX_API_URL || 'https://www.mobilesentrix.ca';
      // Use custom domain for callback URL - detect dev vs production
      // In development, use the request host; in production, use the custom domain
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

  // OAuth callback - receives oauth_token and oauth_verifier
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
      
      // Exchange for access token
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
        // Success - automatically save tokens to database
        await storage.upsertMessageTemplate({
          type: 'mobilesentrix_access_token',
          content: data.data.access_token
        });
        await storage.upsertMessageTemplate({
          type: 'mobilesentrix_access_token_secret',
          content: data.data.access_token_secret
        });
        
        // Also load them into memory immediately so API works right away
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

  // Cache status endpoint - shows how many parts are cached
  app.get("/api/mobilesentrix/cache-status", async (req, res) => {
    try {
      const status = getCacheStatus();
      res.json(status);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to get cache status" });
    }
  });

  // Clear cache endpoint (admin only)
  app.post("/api/mobilesentrix/clear-cache", requireAdmin, async (req, res) => {
    try {
      clearPartsCache();
      res.json({ success: true, message: "Cache cleared" });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to clear cache" });
    }
  });

  // Validate all service link SKUs against Mobilesentrix API
  let skuValidationInProgress = false;
  let skuValidationProgress = { checked: 0, total: 0, missing: [] as any[], errors: [] as string[] };

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
      const skuToLinks = new Map<string, Array<{ id: string; deviceName: string; brandName: string; serviceName: string; isPrimary: boolean }>>();

      for (const ds of allDeviceServices) {
        const deviceName = ds.device?.name || "Unknown";
        const brandName = ds.device?.brand?.name || "";
        const serviceName = ds.service?.name || "Unknown";

        if (ds.partSku) {
          if (!skuToLinks.has(ds.partSku)) skuToLinks.set(ds.partSku, []);
          skuToLinks.get(ds.partSku)!.push({ id: ds.id, deviceName, brandName, serviceName, isPrimary: true });
        }

        const altSkus = (ds as any).alternativePartSkus;
        if (Array.isArray(altSkus)) {
          for (const altSku of altSkus) {
            if (altSku && altSku.trim()) {
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

  // Pre-fetch parts for services in a category (for a specific device)
  // This is called when user selects a category to pre-load prices
  app.post("/api/prefetch-category-parts", async (req, res) => {
    try {
      const { deviceId, categoryId } = req.body;
      
      // Input validation
      if (!deviceId || typeof deviceId !== 'string') {
        return res.status(400).json({ error: "deviceId is required and must be a string" });
      }
      
      if (categoryId && typeof categoryId !== 'string') {
        return res.status(400).json({ error: "categoryId must be a string if provided" });
      }
      
      // Check pricing source - only prefetch for API mode
      const templates = await storage.getMessageTemplates();
      const pricingSourceSetting = templates.find(t => t.type === 'pricing_source');
      const pricingSource = pricingSourceSetting?.content || 'excel_upload';
      
      if (pricingSource === 'excel_upload') {
        // Excel mode doesn't need prefetching
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
      
      // Get all device services for this device (optionally filtered by category)
      const deviceServices = await storage.getDeviceServicesByDevice(deviceId);
      
      // Filter by category if provided
      const filteredServices = categoryId 
        ? deviceServices.filter(ds => ds.service.categoryId === categoryId)
        : deviceServices;
      
      // Collect all SKUs that need to be fetched
      const skusToFetch: string[] = [];
      
      for (const ds of filteredServices) {
        // Get primary part SKU
        if (ds.partSku) {
          skusToFetch.push(ds.partSku);
        }
        
        // Get alternative primary part SKUs
        if (ds.alternativePartSkus && Array.isArray(ds.alternativePartSkus)) {
          for (const altSku of ds.alternativePartSkus) {
            if (altSku && typeof altSku === 'string') {
              skusToFetch.push(altSku);
            }
          }
        }
        
        // Get additional parts SKUs
        const additionalParts = await storage.getDeviceServiceParts(ds.id);
        for (const ap of additionalParts) {
          if (ap.part?.sku) {
            skusToFetch.push(ap.part.sku);
          }
        }
      }
      
      // Remove duplicates
      const uniqueSkus = [...new Set(skusToFetch)];
      
      if (uniqueSkus.length === 0) {
        return res.json({ 
          success: true, 
          message: "No parts to prefetch",
          source: 'api',
          skusFetched: 0 
        });
      }
      
      // Fetch and cache all SKUs
      console.log(`Prefetching ${uniqueSkus.length} SKUs for device ${deviceId}${categoryId ? ` category ${categoryId}` : ''}`);
      const results = await fetchAndCacheMultipleSkus(uniqueSkus);
      
      // Count how many were found
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

  // Service Categories
  app.get("/api/service-categories", async (req, res) => {
    try {
      const categories = await storage.getServiceCategories();
      res.json(categories);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch service categories" });
    }
  });

  app.post("/api/service-categories", requireAdmin, async (req, res) => {
    try {
      const data = insertServiceCategorySchema.parse(req.body);
      const category = await storage.createServiceCategory(data);
      res.status(201).json(category);
    } catch (error: any) {
      if (error.code === "23505") {
        return res.status(400).json({ error: "A service category with this name already exists" });
      }
      res.status(400).json({ error: error.message || "Failed to create service category" });
    }
  });

  app.patch("/api/service-categories/:id", requireAdmin, async (req, res) => {
    try {
      const data = insertServiceCategorySchema.partial().parse(req.body);
      const category = await storage.updateServiceCategory(req.params.id, data);
      if (!category) {
        return res.status(404).json({ error: "Service category not found" });
      }
      res.json(category);
    } catch (error: any) {
      if (error.code === "23505") {
        return res.status(400).json({ error: "A service category with this name already exists" });
      }
      res.status(400).json({ error: error.message || "Failed to update service category" });
    }
  });

  app.delete("/api/service-categories/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteServiceCategory(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete service category" });
    }
  });

  app.post("/api/service-categories/reorder", requireAdmin, async (req, res) => {
    try {
      const { orderedIds } = req.body;
      if (!Array.isArray(orderedIds)) {
        return res.status(400).json({ error: "orderedIds must be an array" });
      }
      await storage.reorderServiceCategories(orderedIds);
      res.status(200).json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to reorder service categories" });
    }
  });

  // Services
  app.get("/api/services", async (req, res) => {
    try {
      const services = await storage.getServices();
      res.json(services);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch services" });
    }
  });

  app.post("/api/services", requireAdmin, async (req, res) => {
    try {
      const data = insertServiceSchema.parse(req.body);
      const service = await storage.createService(data);
      res.status(201).json(service);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to create service" });
    }
  });

  app.patch("/api/services/:id", requireAdmin, async (req, res) => {
    try {
      const data = insertServiceSchema.partial().parse(req.body);
      const service = await storage.updateService(req.params.id, data);
      if (!service) {
        return res.status(404).json({ error: "Service not found" });
      }
      res.json(service);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to update service" });
    }
  });

  app.delete("/api/services/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteService(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete service" });
    }
  });

  // Device Services (links)
  app.get("/api/device-services", async (req, res) => {
    try {
      const deviceId = req.query.deviceId as string | undefined;
      const deviceServices = deviceId
        ? await storage.getDeviceServicesByDevice(deviceId)
        : await storage.getDeviceServices();
      res.json(deviceServices);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch device services" });
    }
  });

  app.get("/api/device-services/by-device/:deviceId", async (req, res) => {
    try {
      const deviceServices = await storage.getDeviceServicesByDevice(req.params.deviceId);
      res.json(deviceServices);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch device services" });
    }
  });

  app.get("/api/device-services/:deviceId", async (req, res) => {
    try {
      const deviceServices = await storage.getDeviceServicesByDevice(req.params.deviceId);
      res.json(deviceServices);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch device services" });
    }
  });

  const deviceServiceWithSkuSchema = z.object({
    deviceId: z.string(),
    serviceId: z.string(),
    partSku: z.string().optional(),
    partId: z.string().optional(),
    alternativePartSkus: z.array(z.string()).optional(),
    additionalFee: z.number().optional(),
    repairDeskServiceId: z.number().nullable().optional(),
    manualPriceOverride: z.string().nullable().optional(), // If set, bypasses all pricing calculations
  });

  app.post("/api/device-services", requireAdmin, async (req, res) => {
    try {
      const input = deviceServiceWithSkuSchema.parse(req.body);
      
      let partId = input.partId;
      let partSku = input.partSku || null;
      
      if (input.partSku && !partId) {
        // Try to find part in local database, but allow SKU even if not found
        // (SKU may exist in supplier parts table for pricing)
        const part = await storage.getPartBySku(input.partSku);
        if (part) {
          partId = part.id;
          partSku = part.sku;
        } else {
          // Allow storing SKU even without a matching part in database
          partSku = input.partSku;
        }
      } else if (partId && !partSku) {
        // If partId provided but no SKU, look up the SKU
        const part = await storage.getPart(partId);
        if (part) {
          partSku = part.sku;
        }
      }
      
      const data = {
        deviceId: input.deviceId,
        serviceId: input.serviceId,
        partId: partId || null,
        partSku: partSku,
        alternativePartSkus: input.alternativePartSkus || null,
      };
      
      const deviceService = await storage.createDeviceService(data);
      res.status(201).json(deviceService);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to create device service" });
    }
  });

  // Bulk create device-services (link a service to multiple devices)
  app.post("/api/device-services/bulk", requireAdmin, async (req, res) => {
    try {
      const schema = z.object({
        serviceIds: z.array(z.string()),
        deviceIds: z.array(z.string()),
        partSku: z.string().optional(),
        partId: z.string().optional(),
      });
      const input = schema.parse(req.body);
      
      let partId = input.partId || null;
      let partSku = input.partSku || null;
      
      if (input.partSku && !partId) {
        const part = await storage.getPartBySku(input.partSku);
        if (part) {
          partId = part.id;
          partSku = part.sku;
        }
      } else if (partId && !partSku) {
        const part = await storage.getPart(partId);
        if (part) {
          partSku = part.sku;
        }
      }
      
      const created: any[] = [];
      const skipped: string[] = [];
      
      for (const serviceId of input.serviceIds) {
        for (const deviceId of input.deviceIds) {
          try {
            const deviceService = await storage.createDeviceService({
              deviceId,
              serviceId,
              partId,
              partSku,
            });
            created.push(deviceService);
          } catch (error: any) {
            // Skip duplicates
            if (error.message?.includes("duplicate") || error.code === '23505') {
              skipped.push(`${deviceId}-${serviceId}`);
            } else {
              throw error;
            }
          }
        }
      }
      
      res.status(201).json({ 
        created: created.length, 
        skipped: skipped.length,
        total: input.deviceIds.length * input.serviceIds.length
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to bulk create device services" });
    }
  });

  // Clone service links from one device to another (without parts)
  app.post("/api/device-services/clone", requireAdmin, async (req, res) => {
    try {
      const schema = z.object({
        sourceDeviceId: z.string(),
        targetDeviceId: z.string(),
      });
      const input = schema.parse(req.body);
      
      // Validate source and target are different
      if (input.sourceDeviceId === input.targetDeviceId) {
        return res.status(400).json({ error: "Source and target device cannot be the same" });
      }
      
      // Validate source device exists
      const sourceDevice = await storage.getDevice(input.sourceDeviceId);
      if (!sourceDevice) {
        return res.status(400).json({ error: "Source device not found" });
      }
      
      // Validate target device exists
      const targetDevice = await storage.getDevice(input.targetDeviceId);
      if (!targetDevice) {
        return res.status(400).json({ error: "Target device not found" });
      }
      
      // Get all service links from source device
      const sourceLinks = await storage.getDeviceServicesByDevice(input.sourceDeviceId);
      
      if (sourceLinks.length === 0) {
        return res.json({ created: 0, skipped: 0, message: "Source device has no service links to clone" });
      }
      
      let created = 0;
      let skipped = 0;
      
      for (const link of sourceLinks) {
        try {
          // Clone link without part ID (user will need to assign parts separately)
          await storage.createDeviceService({
            deviceId: input.targetDeviceId,
            serviceId: link.serviceId,
            partId: null, // Don't copy parts
          });
          created++;
        } catch (error: any) {
          // Skip duplicates
          if (error.message?.includes("duplicate") || error.code === '23505') {
            skipped++;
          } else {
            throw error;
          }
        }
      }
      
      res.status(201).json({ 
        created, 
        skipped,
        total: sourceLinks.length,
        message: `Cloned ${created} service links (${skipped} already existed)`
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to clone device services" });
    }
  });

  app.patch("/api/device-services/:id", requireAdmin, async (req, res) => {
    try {
      const input = deviceServiceWithSkuSchema.partial().parse(req.body);
      
      let partId = input.partId;
      let partSku = input.partSku;
      
      if (input.partSku && !partId) {
        // Try to find part in local database, but allow SKU even if not found
        // (SKU may exist in supplier parts table for pricing)
        const part = await storage.getPartBySku(input.partSku);
        if (part) {
          partId = part.id;
          partSku = part.sku;
        } else {
          // Allow storing SKU even without a matching part in database
          partSku = input.partSku;
        }
      } else if (partId && !partSku) {
        // If partId provided but no SKU, look up the SKU
        const part = await storage.getPart(partId);
        if (part) {
          partSku = part.sku;
        }
      }
      
      const data: any = {};
      if (input.deviceId) data.deviceId = input.deviceId;
      if (input.serviceId) data.serviceId = input.serviceId;
      if (partId !== undefined) data.partId = partId || null;
      if (partSku !== undefined) data.partSku = partSku || null;
      if (input.alternativePartSkus !== undefined) data.alternativePartSkus = input.alternativePartSkus || null;
      if (input.additionalFee !== undefined) data.additionalFee = input.additionalFee;
      if (input.repairDeskServiceId !== undefined) data.repairDeskServiceId = input.repairDeskServiceId;
      if (input.manualPriceOverride !== undefined) data.manualPriceOverride = input.manualPriceOverride;
      
      const deviceService = await storage.updateDeviceService(req.params.id, data);
      if (!deviceService) {
        return res.status(404).json({ error: "Device service not found" });
      }
      res.json(deviceService);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to update device service" });
    }
  });

  app.delete("/api/device-services/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteDeviceService(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete device service" });
    }
  });

  app.post("/api/device-services/bulk-delete", requireAdmin, async (req, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "ids array is required" });
      }
      let deleted = 0;
      for (const id of ids) {
        await storage.deleteDeviceService(id);
        deleted++;
      }
      res.json({ deleted });
    } catch (error) {
      res.status(500).json({ error: "Failed to bulk delete device services" });
    }
  });

  // Device Service Parts (additional parts for a device-service link)
  app.get("/api/device-services/:id/parts", requireAdmin, async (req, res) => {
    try {
      const parts = await storage.getDeviceServiceParts(req.params.id);
      res.json(parts);
    } catch (error) {
      res.status(500).json({ error: "Failed to get device service parts" });
    }
  });

  app.post("/api/device-services/:id/parts", requireAdmin, async (req, res) => {
    try {
      const schema = z.object({
        partId: z.string().optional(),
        partSku: z.string().optional(),
        isPrimary: z.boolean().optional(),
      }).refine(data => data.partId || data.partSku, {
        message: "Either partId or partSku is required",
      });
      
      const data = schema.parse(req.body);
      
      const part = await storage.addDeviceServicePart({
        deviceServiceId: req.params.id,
        partId: data.partId,
        partSku: data.partSku,
        isPrimary: data.isPrimary || false,
      });
      res.json(part);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request", details: error.errors });
      }
      res.status(500).json({ error: "Failed to add part to device service" });
    }
  });

  app.delete("/api/device-service-parts/:id", requireAdmin, async (req, res) => {
    try {
      await storage.removeDeviceServicePart(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to remove part from device service" });
    }
  });

  app.delete("/api/device-services/:id/parts", requireAdmin, async (req, res) => {
    try {
      await storage.clearDeviceServiceParts(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to clear device service parts" });
    }
  });

  // Dynamic price rounding based on settings
  async function roundPrice(price: number, bypassRounding: boolean = false): Promise<number> {
    // If bypass is set, return the raw price without any rounding
    if (bypassRounding) {
      return price;
    }
    
    const templates = await storage.getMessageTemplates();
    const modeSetting = templates.find(t => t.type === 'price_rounding_mode');
    const subtractSetting = templates.find(t => t.type === 'price_rounding_subtract');
    
    const mode = modeSetting?.content || "nearest5";
    const parsedSubtract = parseInt(subtractSetting?.content || "1", 10);
    // Clamp subtract amount to valid range 0-9, default to 1 if invalid
    const subtractAmount = isNaN(parsedSubtract) ? 1 : Math.max(0, Math.min(9, parsedSubtract));
    
    if (mode === "none") {
      return price;
    }
    
    let rounded: number;
    if (mode === "nearest10") {
      rounded = Math.round(price / 10) * 10;
    } else {
      // Default to nearest5
      rounded = Math.round(price / 5) * 5;
    }
    
    // Always subtract, never increase price. Minimum result is 0.
    return Math.max(0, rounded - subtractAmount);
  }

  // Helper function to get SKU price based on pricing source setting (API or Excel upload)
  // Uses 24-hour cache for API mode to reduce API calls
  async function getSkuPrice(sku: string): Promise<{ price: number; name: string; found: boolean; source: 'api' | 'excel'; apiError?: string; fromCache?: boolean }> {
    // Check pricing source setting
    const templates = await storage.getMessageTemplates();
    const pricingSourceSetting = templates.find(t => t.type === 'pricing_source');
    const pricingSource = pricingSourceSetting?.content || 'excel_upload';
    
    if (pricingSource === 'excel_upload') {
      // Get price from uploaded supplier parts (Excel) - always works as backup
      try {
        const part = await storage.getSupplierPartBySku(sku);
        if (part) {
          return { price: parseFloat(part.price), name: part.name, found: true, source: 'excel' };
        }
        console.log(`SKU ${sku} not found in uploaded supplier parts`);
        return { price: 0, name: '', found: false, source: 'excel' };
      } catch (error: any) {
        console.error(`Error fetching SKU ${sku} from database:`, error.message);
        return { price: 0, name: '', found: false, source: 'excel', apiError: error.message };
      }
    }
    
    // API mode - check cache first (24-hour cache)
    const cached = getCachedPrice(sku);
    if (cached) {
      return { 
        price: parseFloat(String(cached.price)) || 0, 
        name: cached.name, 
        found: cached.found, 
        source: 'api',
        fromCache: true 
      };
    }
    
    // Get price from Mobilesentrix API
    if (!isMobilesentrixConfigured()) {
      console.error('Mobilesentrix API not configured - cannot fetch prices');
      return { price: 0, name: '', found: false, source: 'api', apiError: 'API not configured' };
    }
    
    try {
      const apiResult = await getProductBySku(sku);
      
      if (apiResult.found) {
        // Only cache successful results for 24 hours
        setCachedPrice(sku, {
          sku: apiResult.sku || sku,
          name: apiResult.name,
          price: apiResult.price,
          inStock: apiResult.inStock,
          found: apiResult.found,
        });
        return { price: parseFloat(String(apiResult.price)) || 0, name: apiResult.name, found: true, source: 'api' };
      }
      // SKU not found in Mobilesentrix API - fall back to custom parts
      console.log(`SKU ${sku} not found in Mobilesentrix API, checking custom parts...`);
      const customPart = await storage.getPartBySku(sku);
      if (customPart) {
        console.log(`Found custom part for SKU ${sku}: ${customPart.name} @ $${customPart.price}`);
        return { price: parseFloat(customPart.price), name: customPart.name, found: true, source: 'api' };
      }
      return { price: 0, name: '', found: false, source: 'api' };
    } catch (error: any) {
      // Don't cache errors - might be temporary API issues
      const errorMsg = error instanceof MobilesentrixApiError 
        ? `API error ${error.statusCode}: ${error.message}` 
        : error.message || 'Unknown API error';
      console.error(`Mobilesentrix API error for SKU ${sku}:`, errorMsg);
      
      // Fall back to custom parts on API error
      try {
        const customPart = await storage.getPartBySku(sku);
        if (customPart) {
          console.log(`API error but found custom part for SKU ${sku}: ${customPart.name} @ $${customPart.price}`);
          return { price: parseFloat(customPart.price), name: customPart.name, found: true, source: 'api' };
        }
      } catch (dbError) {
        console.error(`Error checking custom parts for SKU ${sku}:`, dbError);
      }
      
      return { price: 0, name: '', found: false, source: 'api', apiError: errorMsg };
    }
  }

  // Quote calculation endpoint - calculates price on server side
  // Formula: Labor price + (parts cost × parts markup), rounded to nearest 5 minus 1
  // If manualPriceOverride is set, bypasses all calculations and returns that exact price
  app.get("/api/calculate-quote/:deviceServiceId", async (req, res) => {
    try {
      const deviceService = await storage.getDeviceServiceWithRelations(req.params.deviceServiceId);
      if (!deviceService) {
        return res.status(404).json({ error: "Device service not found" });
      }
      
      const service = deviceService.service;
      
      // Check for manual price override - bypasses all calculations
      const manualPriceOverride = (deviceService as any).manualPriceOverride;
      if (manualPriceOverride !== null && manualPriceOverride !== undefined && manualPriceOverride !== "") {
        const overridePrice = parseFloat(manualPriceOverride);
        if (!isNaN(overridePrice)) {
          return res.json({
            deviceServiceId: deviceService.id,
            deviceName: deviceService.device.name,
            serviceName: service.name,
            serviceDescription: service.description,
            warranty: service.warranty,
            repairTime: service.repairTime,
            laborPrice: "0.00",
            partsMarkup: "1.0",
            secondaryPartPercentage: 100,
            partCost: "0.00",
            partSku: null,
            partName: null,
            primaryPartSkus: [],
            additionalPartSkus: [],
            additionalPartsCount: 0,
            additionalPartsCost: "0.00",
            totalPartCost: "0.00",
            totalPrice: overridePrice.toFixed(2),
            hasPart: true,
            isLabourOnly: false,
            isAvailable: true,
            bypassMultiDiscount: service.bypassMultiDiscount || false,
            isManualPriceOverride: true,
          });
        }
      }
      
      const laborPrice = parseFloat(service.laborPrice || "0");
      const partsMarkup = parseFloat(service.partsMarkup || "1.0");
      const secondaryPartPercentage = (service.secondaryPartPercentage || 100) / 100;
      
      // Collect all primary part SKUs (main part + alternatives)
      const primaryPartSkusToFetch: string[] = [];
      
      // Add primary part SKU from device service
      const primaryPartSku = (deviceService as any).partSku;
      if (primaryPartSku) {
        primaryPartSkusToFetch.push(primaryPartSku);
      }
      
      // Add alternative primary parts
      const alternativeSkus = (deviceService as any).alternativePartSkus || [];
      if (alternativeSkus.length > 0) {
        primaryPartSkusToFetch.push(...alternativeSkus);
      }
      
      // Fetch prices for all primary parts from Mobilesentrix API (or database fallback)
      const primaryPartOptions: { sku: string; price: number; name: string }[] = [];
      for (const sku of primaryPartSkusToFetch) {
        const priceResult = await getSkuPrice(sku);
        if (priceResult.found) {
          primaryPartOptions.push({
            sku,
            price: priceResult.price,
            name: priceResult.name,
          });
        }
      }
      
      // Use the cheapest primary part option
      let cheapestPrimaryPart: typeof primaryPartOptions[0] | null = null;
      if (primaryPartOptions.length > 0) {
        cheapestPrimaryPart = primaryPartOptions.reduce((min, p) => p.price < min.price ? p : min, primaryPartOptions[0]);
      }
      
      const primaryPartCost = cheapestPrimaryPart?.price || 0;
      
      // Get additional parts and calculate their cost at secondary percentage
      const additionalParts = await storage.getDeviceServiceParts(deviceService.id);
      let additionalPartsCost = 0;
      for (const ap of additionalParts) {
        if (ap.part?.sku && !ap.isPrimary) {
          // Fetch price from Mobilesentrix API for secondary parts too
          const priceResult = await getSkuPrice(ap.part.sku);
          if (priceResult.found) {
            additionalPartsCost += priceResult.price * secondaryPartPercentage;
          }
        }
      }
      
      const totalPartCost = primaryPartCost + additionalPartsCost;
      const markedUpPartCost = totalPartCost * partsMarkup;
      const additionalFee = (deviceService as any).additionalFee || 0;
      const rawTotal = laborPrice + markedUpPartCost + additionalFee;
      const totalPrice = await roundPrice(rawTotal, service.bypassRounding === true);
      
      // Check if service has parts or is labour-only
      const hasPart = primaryPartOptions.length > 0 || additionalParts.some(ap => !!ap.part);
      const isLabourOnly = service.labourOnly === true;
      // Service is available if it has parts OR is marked as labour-only
      const isAvailable = hasPart || isLabourOnly;
      
      // Collect all PRIMARY part SKUs for stock checking (any in stock = show in stock)
      const primaryPartSkus: string[] = primaryPartOptions.map(p => p.sku);
      
      // Collect SECONDARY part SKUs separately
      const secondaryPartSkus: string[] = [];
      for (const ap of additionalParts) {
        if (ap.part?.sku && !ap.isPrimary) {
          secondaryPartSkus.push(ap.part.sku);
        }
      }
      
      res.json({
        deviceServiceId: deviceService.id,
        deviceName: deviceService.device.name,
        serviceName: service.name,
        serviceDescription: service.description,
        warranty: service.warranty,
        repairTime: service.repairTime,
        laborPrice: service.laborPrice,
        partsMarkup: service.partsMarkup,
        secondaryPartPercentage: service.secondaryPartPercentage,
        partCost: (typeof cheapestPrimaryPart?.price === 'number' ? cheapestPrimaryPart.price.toFixed(2) : "0.00"),
        partSku: cheapestPrimaryPart?.sku || null,
        partName: cheapestPrimaryPart?.name || null,
        primaryPartSkus, // All primary part SKUs (for stock: any in stock = in stock)
        additionalPartSkus: secondaryPartSkus, // Secondary parts (all must be in stock)
        additionalPartsCount: additionalParts.filter(ap => !ap.isPrimary).length,
        additionalPartsCost: additionalPartsCost.toFixed(2),
        totalPartCost: totalPartCost.toFixed(2),
        totalPrice: totalPrice.toFixed(2),
        hasPart,
        isLabourOnly,
        isAvailable,
        bypassMultiDiscount: service.bypassMultiDiscount || false,
      });
    } catch (error: any) {
      console.error('Calculate quote error:', error.message || error);
      res.status(500).json({ error: "Failed to calculate quote", details: error.message });
    }
  });

  // Quote Requests
  app.get("/api/quote-requests", async (req, res) => {
    try {
      const quotes = await storage.getQuoteRequests();
      res.json(quotes);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch quote requests" });
    }
  });

  const quoteRequestWithValidationSchema = z.object({
    customerName: z.string().min(1),
    customerEmail: z.string().email(),
    customerPhone: z.string().optional(),
    deviceId: z.string(),
    deviceServiceId: z.string(),
    optIn: z.boolean().optional(),
    notes: z.string().optional(),
  });

  app.post("/api/quote-requests", async (req, res) => {
    try {
      const input = quoteRequestWithValidationSchema.parse(req.body);
      
      const deviceService = await storage.getDeviceServiceWithRelations(input.deviceServiceId);
      if (!deviceService) {
        return res.status(400).json({ error: "Device service not found" });
      }
      
      const service = deviceService.service;
      
      // Check for manual price override first - bypasses all calculations
      let quotedPrice: string;
      const manualPriceOverride = (deviceService as any).manualPriceOverride;
      if (manualPriceOverride !== null && manualPriceOverride !== undefined && manualPriceOverride !== "") {
        const overridePrice = parseFloat(manualPriceOverride);
        if (!isNaN(overridePrice)) {
          quotedPrice = overridePrice.toFixed(2);
        } else {
          // Fallback to calculation if override is invalid
          const laborPrice = parseFloat(service.laborPrice || "0");
          const partsMarkup = parseFloat(service.partsMarkup || "1.0");
          let partCost = 0;
          const primaryPartSku = (deviceService as any).partSku;
          if (primaryPartSku) {
            const priceResult = await getSkuPrice(primaryPartSku);
            if (priceResult.found) {
              partCost = priceResult.price;
            }
          }
          const markedUpPartCost = partCost * partsMarkup;
          const additionalFee = (deviceService as any).additionalFee || 0;
          const rawTotal = laborPrice + markedUpPartCost + additionalFee;
          quotedPrice = (await roundPrice(rawTotal, service.bypassRounding === true)).toFixed(2);
        }
      } else {
        // Normal price calculation
        const laborPrice = parseFloat(service.laborPrice || "0");
        const partsMarkup = parseFloat(service.partsMarkup || "1.0");
        let partCost = 0;
        const primaryPartSku = (deviceService as any).partSku;
        if (primaryPartSku) {
          const priceResult = await getSkuPrice(primaryPartSku);
          if (priceResult.found) {
            partCost = priceResult.price;
          }
        }
        const markedUpPartCost = partCost * partsMarkup;
        const additionalFee = (deviceService as any).additionalFee || 0;
        const rawTotal = laborPrice + markedUpPartCost + additionalFee;
        quotedPrice = (await roundPrice(rawTotal, service.bypassRounding === true)).toFixed(2);
      }
      
      const quote = await storage.createQuoteRequest({
        customerName: input.customerName,
        customerEmail: input.customerEmail,
        customerPhone: input.customerPhone,
        deviceId: input.deviceId,
        deviceServiceId: input.deviceServiceId,
        quotedPrice,
        notes: input.notes,
      });

      // Send quote via email and SMS if user opted in
      if (input.optIn) {
        const quoteData = {
          customerName: input.customerName,
          customerEmail: input.customerEmail,
          customerPhone: input.customerPhone || '',
          deviceName: deviceService.device.name,
          serviceName: service.name,
          price: quotedPrice,
          repairTime: service.repairTime || undefined,
          warranty: service.warranty || undefined,
        };

        // Send email (async, don't block response)
        sendQuoteEmail(quoteData).catch(err => console.error('Email send error:', err));

        // Send SMS via Zapier webhook if phone provided
        if (input.customerPhone) {
          sendQuoteSms(quoteData).catch(err => console.error('SMS send error:', err));
        }
      }
      
      res.status(201).json(quote);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to create quote request" });
    }
  });

  // Combined Quote Request (multiple services)
  const combinedQuoteRequestSchema = z.object({
    customerName: z.string().min(1),
    customerEmail: z.string().email(),
    customerPhone: z.string().optional(),
    deviceId: z.string(),
    deviceServiceIds: z.array(z.string()).min(1),
    notes: z.string().optional(),
    multiServiceDiscount: z.number().optional(),
  });

  app.post("/api/quote-requests/combined", async (req, res) => {
    try {
      const input = combinedQuoteRequestSchema.parse(req.body);
      
      // Fetch all device services and calculate prices
      const servicesData: Array<{
        serviceName: string;
        serviceDescription?: string;
        price: string;
        repairTime?: string;
        warranty?: string;
      }> = [];
      let grandTotal = 0;
      let deviceName = '';

      for (const deviceServiceId of input.deviceServiceIds) {
        const deviceService = await storage.getDeviceServiceWithRelations(deviceServiceId);
        if (!deviceService) {
          return res.status(400).json({ error: `Device service ${deviceServiceId} not found` });
        }
        
        deviceName = deviceService.device.name;
        const service = deviceService.service;
        
        // Check for manual price override first - bypasses all calculations
        let quotedPrice: number;
        const manualPriceOverride = (deviceService as any).manualPriceOverride;
        if (manualPriceOverride !== null && manualPriceOverride !== undefined && manualPriceOverride !== "") {
          const overridePrice = parseFloat(manualPriceOverride);
          if (!isNaN(overridePrice)) {
            quotedPrice = overridePrice;
          } else {
            // Fallback to calculation if override is invalid
            const laborPrice = parseFloat(service.laborPrice || "0");
            const partsMarkup = parseFloat(service.partsMarkup || "1.0");
            let partCost = 0;
            const primaryPartSku = (deviceService as any).partSku;
            if (primaryPartSku) {
              const priceResult = await getSkuPrice(primaryPartSku);
              if (priceResult.found) {
                partCost = priceResult.price;
              }
            }
            const markedUpPartCost = partCost * partsMarkup;
            const additionalFee = (deviceService as any).additionalFee || 0;
            const rawTotal = laborPrice + markedUpPartCost + additionalFee;
            quotedPrice = await roundPrice(rawTotal, service.bypassRounding === true);
          }
        } else {
          // Normal price calculation
          const laborPrice = parseFloat(service.laborPrice || "0");
          const partsMarkup = parseFloat(service.partsMarkup || "1.0");
          let partCost = 0;
          const primaryPartSku = (deviceService as any).partSku;
          if (primaryPartSku) {
            const priceResult = await getSkuPrice(primaryPartSku);
            if (priceResult.found) {
              partCost = priceResult.price;
            }
          }
          const markedUpPartCost = partCost * partsMarkup;
          const additionalFee = (deviceService as any).additionalFee || 0;
          const rawTotal = laborPrice + markedUpPartCost + additionalFee;
          quotedPrice = await roundPrice(rawTotal, service.bypassRounding === true);
        }
        
        servicesData.push({
          serviceName: service.name,
          serviceDescription: service.description || undefined,
          price: quotedPrice.toFixed(2),
          repairTime: service.repairTime || undefined,
          warranty: service.warranty || undefined,
        });
        
        grandTotal += quotedPrice;
        
        // Create individual quote request record
        await storage.createQuoteRequest({
          customerName: input.customerName,
          customerEmail: input.customerEmail,
          customerPhone: input.customerPhone,
          deviceId: input.deviceId,
          deviceServiceId: deviceServiceId,
          quotedPrice: quotedPrice.toFixed(2),
          notes: input.notes,
        });
      }

      // Apply multi-service discount
      const discountAmount = input.multiServiceDiscount || 0;
      const finalTotal = grandTotal - discountAmount;

      // Send combined email
      sendCombinedQuoteEmail({
        customerName: input.customerName,
        customerEmail: input.customerEmail,
        deviceName,
        services: servicesData,
        grandTotal: finalTotal.toFixed(2),
        multiServiceDiscount: discountAmount > 0 ? discountAmount.toFixed(2) : undefined,
      }).catch(err => console.error('Combined email send error:', err));

      // Send combined SMS if phone provided
      if (input.customerPhone) {
        sendCombinedQuoteSms({
          customerName: input.customerName,
          customerPhone: input.customerPhone,
          deviceName,
          services: servicesData,
          grandTotal: finalTotal.toFixed(2),
          multiServiceDiscount: discountAmount > 0 ? discountAmount.toFixed(2) : undefined,
        }).catch(err => console.error('Combined SMS send error:', err));
      }

      // Send admin notification email
      sendAdminNotificationEmail({
        customerName: input.customerName,
        customerEmail: input.customerEmail,
        customerPhone: input.customerPhone,
        deviceName,
        services: servicesData,
        grandTotal: finalTotal.toFixed(2),
        multiServiceDiscount: discountAmount > 0 ? discountAmount.toFixed(2) : undefined,
        notes: input.notes,
      }).catch(err => console.error('Admin notification error:', err));

      // Create RepairDesk lead if enabled
      const templates = await storage.getMessageTemplates();
      const rdLeadSetting = templates.find(t => t.type === 'repairdesk_leads_enabled');
      if (rdLeadSetting && rdLeadSetting.content === 'true') {
        const nameParts = input.customerName.trim().split(/\s+/);
        const firstName = nameParts[0] || input.customerName;
        const lastName = nameParts.slice(1).join(' ') || '';
        
        const servicesList = servicesData.map(s => 
          `- ${s.serviceName}: $${s.price}${s.repairTime ? ` (${s.repairTime})` : ''}${s.warranty ? ` - ${s.warranty} warranty` : ''}`
        ).join('\n');
        const discountLine = discountAmount > 0 ? `\nMulti-Service Discount: -$${discountAmount.toFixed(2)}` : '';
        const leadNotes = `Quote from Website

Customer Information:
- Name: ${input.customerName}
- Email: ${input.customerEmail}
- Phone: ${input.customerPhone || 'Not provided'}

Device: ${deviceName}

Selected Services:
${servicesList}
${discountLine}
Grand Total: $${finalTotal.toFixed(2)} plus taxes

${input.notes ? `Customer Notes:\n${input.notes}` : ''}`.trim();

        createLead({
          summary: {
            firstName,
            lastName,
            email: input.customerEmail,
            mobile: input.customerPhone,
            referredBy: 'Website Quote',
          },
          devices: [{
            price: finalTotal.toFixed(2),
            repairProdItems: servicesData.map((s, idx) => ({
              id: String(idx + 1),
              name: s.serviceName,
            })),
            additionalProblem: servicesData.map(s => s.serviceName).join(', '),
            customerNotes: leadNotes,
          }],
        }).catch(err => console.error('RepairDesk lead creation error:', err));
      }

      res.status(201).json({ 
        success: true, 
        servicesCount: servicesData.length,
        grandTotal: finalTotal.toFixed(2)
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to create combined quote request" });
    }
  });

  // Unknown Device Quote Request
  const unknownDeviceQuoteSchema = z.object({
    customerName: z.string().min(1),
    customerEmail: z.string().email(),
    customerPhone: z.string().optional(),
    deviceDescription: z.string().min(1),
    issueDescription: z.string().min(1),
  });

  app.post("/api/unknown-device-quotes", async (req, res) => {
    try {
      const input = unknownDeviceQuoteSchema.parse(req.body);
      
      // Create the unknown device quote record
      await storage.createUnknownDeviceQuote({
        customerName: input.customerName,
        customerEmail: input.customerEmail,
        customerPhone: input.customerPhone,
        deviceDescription: input.deviceDescription,
        issueDescription: input.issueDescription,
      });

      // Send confirmation email to customer
      sendUnknownDeviceQuoteEmail({
        customerName: input.customerName,
        customerEmail: input.customerEmail,
        deviceDescription: input.deviceDescription,
        issueDescription: input.issueDescription,
      }).catch(err => console.error('Unknown device email error:', err));

      // Send SMS confirmation if phone provided
      if (input.customerPhone) {
        sendUnknownDeviceQuoteSms({
          customerName: input.customerName,
          customerPhone: input.customerPhone,
          deviceDescription: input.deviceDescription,
          issueDescription: input.issueDescription,
        }).catch(err => console.error('Unknown device SMS error:', err));
      }

      // Send admin notification
      sendUnknownDeviceAdminNotification({
        customerName: input.customerName,
        customerEmail: input.customerEmail,
        customerPhone: input.customerPhone,
        deviceDescription: input.deviceDescription,
        issueDescription: input.issueDescription,
      }).catch(err => console.error('Unknown device admin notification error:', err));

      res.status(201).json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to submit quote request" });
    }
  });

  // Get unknown device quotes
  app.get("/api/unknown-device-quotes", requireAdmin, async (req, res) => {
    try {
      const quotes = await storage.getUnknownDeviceQuotes();
      res.json(quotes);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch unknown device quotes" });
    }
  });

  // Search all past submissions (combines quote requests and unknown device quotes)
  app.get("/api/submissions/search", requireAdmin, async (req, res) => {
    try {
      const query = (req.query.q as string || "").toLowerCase().trim();
      
      // Get all quote requests with device/service info
      const quoteRequests = await storage.getQuoteRequests();
      const unknownQuotes = await storage.getUnknownDeviceQuotes();
      
      // Get device and service info for quote requests
      const enrichedQuoteRequests = await Promise.all(
        quoteRequests.map(async (qr) => {
          const device = await storage.getDevice(qr.deviceId);
          const deviceService = await storage.getDeviceServiceWithRelations(qr.deviceServiceId);
          return {
            id: qr.id,
            type: 'quote' as const,
            customerName: qr.customerName,
            customerEmail: qr.customerEmail,
            customerPhone: qr.customerPhone,
            deviceName: device?.name || 'Unknown Device',
            serviceName: deviceService?.service.name || 'Unknown Service',
            quotedPrice: qr.quotedPrice,
            notes: qr.notes,
            createdAt: qr.createdAt,
          };
        })
      );
      
      const enrichedUnknownQuotes = unknownQuotes.map((uq) => ({
        id: uq.id,
        type: 'unknown' as const,
        customerName: uq.customerName,
        customerEmail: uq.customerEmail,
        customerPhone: uq.customerPhone,
        deviceDescription: uq.deviceDescription,
        issueDescription: uq.issueDescription,
        createdAt: uq.createdAt,
      }));
      
      // Combine and filter
      const allSubmissions = [...enrichedQuoteRequests, ...enrichedUnknownQuotes];
      
      // Filter by search query if provided
      const filtered = query
        ? allSubmissions.filter(s => 
            s.customerName.toLowerCase().includes(query) ||
            s.customerEmail.toLowerCase().includes(query) ||
            (s.customerPhone && s.customerPhone.toLowerCase().includes(query))
          )
        : allSubmissions;
      
      // Sort by date (newest first)
      filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      res.json(filtered);
    } catch (error) {
      console.error('Search submissions error:', error);
      res.status(500).json({ error: "Failed to search submissions" });
    }
  });

  // Message Templates
  app.get("/api/message-templates", async (req, res) => {
    try {
      const templates = await storage.getMessageTemplates();
      res.json(templates);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch message templates" });
    }
  });

  app.get("/api/message-templates/:type", async (req, res) => {
    try {
      const template = await storage.getMessageTemplate(req.params.type);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      res.json(template);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch message template" });
    }
  });

  app.put("/api/message-templates", requireAdmin, async (req, res) => {
    try {
      const data = insertMessageTemplateSchema.parse(req.body);
      const template = await storage.upsertMessageTemplate(data);
      res.json(template);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to update message template" });
    }
  });

  // Dismissed Service Link Alerts Routes
  app.get("/api/dismissed-alerts", requireAdmin, async (req, res) => {
    try {
      const alerts = await storage.getDismissedAlerts();
      res.json(alerts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch dismissed alerts" });
    }
  });

  app.get("/api/dismissed-alerts/active-ids", requireAdmin, async (req, res) => {
    try {
      const ids = await storage.getActiveDismissedAlertIds();
      res.json(ids);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch active dismissed alert IDs" });
    }
  });

  app.get("/api/dismissed-alerts/indefinite", requireAdmin, async (req, res) => {
    try {
      const alerts = await storage.getIndefinitelyDismissedAlerts();
      res.json(alerts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch indefinitely dismissed alerts" });
    }
  });

  app.post("/api/dismissed-alerts", requireAdmin, async (req, res) => {
    try {
      const { deviceServiceId, dismissType } = req.body;
      if (!deviceServiceId || !dismissType || !["1month", "indefinite"].includes(dismissType)) {
        return res.status(400).json({ error: "Invalid request body" });
      }
      const alert = await storage.dismissAlert(deviceServiceId, dismissType);
      res.json(alert);
    } catch (error) {
      res.status(500).json({ error: "Failed to dismiss alert" });
    }
  });

  app.delete("/api/dismissed-alerts/:deviceServiceId", requireAdmin, async (req, res) => {
    try {
      await storage.undismissAlert(req.params.deviceServiceId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to undismiss alert" });
    }
  });

  // RepairDesk API Routes (using API key authentication)
  app.get("/api/repairdesk/status", requireAdmin, async (req, res) => {
    try {
      const connected = await isRepairDeskConnected();
      // Get stock check enabled setting
      const templates = await storage.getMessageTemplates();
      const stockSetting = templates.find(t => t.type === 'stock_check_enabled');
      const stockCheckEnabled = stockSetting ? stockSetting.content === 'true' : true; // Default enabled
      res.json({ connected, stockCheckEnabled });
    } catch (error) {
      res.status(500).json({ error: "Failed to check RepairDesk status" });
    }
  });

  // Public endpoint to check if stock checking is enabled
  app.get("/api/repairdesk/stock-enabled", async (req, res) => {
    try {
      const templates = await storage.getMessageTemplates();
      const stockSetting = templates.find(t => t.type === 'stock_check_enabled');
      const enabled = stockSetting ? stockSetting.content === 'true' : true; // Default enabled
      const connected = await isRepairDeskConnected();
      res.json({ enabled: enabled && connected });
    } catch (error) {
      res.json({ enabled: false });
    }
  });

  // Toggle stock check enabled setting
  app.post("/api/repairdesk/stock-enabled", requireAdmin, async (req, res) => {
    try {
      const { enabled } = req.body;
      const templates = await storage.getMessageTemplates();
      const existing = templates.find(t => t.type === 'stock_check_enabled');
      
      await storage.upsertMessageTemplate({
        type: 'stock_check_enabled',
        content: enabled ? 'true' : 'false'
      });
      res.json({ success: true, enabled });
    } catch (error) {
      res.status(500).json({ error: "Failed to update setting" });
    }
  });

  app.get("/api/settings/quote-flow", async (req, res) => {
    try {
      const templates = await storage.getMessageTemplates();
      const get = (type: string) => templates.find(t => t.type === type);

      res.json({
        multiDiscount: {
          enabled: get('multi_discount_enabled')?.content === 'true',
          amount: get('multi_discount_amount') ? parseFloat(get('multi_discount_amount')!.content) : 10,
        },
        hidePricesUntilContact: get('hide_prices_until_contact')?.content === 'true',
        hidePricesCompletely: get('hide_prices_completely')?.content === 'true',
        pricingSource: get('pricing_source')?.content || 'excel_upload',
        partsLastUpdated: get('parts_last_updated') || null,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get quote settings" });
    }
  });

  // Multi-service discount settings
  app.get("/api/settings/multi-discount", async (req, res) => {
    try {
      const templates = await storage.getMessageTemplates();
      const enabledSetting = templates.find(t => t.type === 'multi_discount_enabled');
      const amountSetting = templates.find(t => t.type === 'multi_discount_amount');
      
      res.json({
        enabled: enabledSetting ? enabledSetting.content === 'true' : false,
        amount: amountSetting ? parseFloat(amountSetting.content) : 10
      });
    } catch (error) {
      res.json({ enabled: false, amount: 10 });
    }
  });

  app.post("/api/settings/multi-discount", requireAdmin, async (req, res) => {
    try {
      const { enabled, amount } = req.body;
      
      // Upsert enabled setting
      await storage.upsertMessageTemplate({
        type: 'multi_discount_enabled',
        content: enabled ? 'true' : 'false'
      });
      
      // Upsert amount setting
      await storage.upsertMessageTemplate({
        type: 'multi_discount_amount',
        content: String(amount)
      });
      
      res.json({ success: true, enabled, amount });
    } catch (error) {
      console.error('Multi-discount settings error:', error);
      res.status(500).json({ error: "Failed to update settings" });
    }
  });

  // Hide prices until contact setting
  app.get("/api/settings/hide-prices-until-contact", async (req, res) => {
    try {
      const templates = await storage.getMessageTemplates();
      const setting = templates.find(t => t.type === 'hide_prices_until_contact');
      res.json({ enabled: setting ? setting.content === 'true' : false });
    } catch (error) {
      res.status(500).json({ error: "Failed to get setting" });
    }
  });

  app.post("/api/settings/hide-prices-until-contact", requireAdmin, async (req, res) => {
    try {
      const { enabled } = req.body;
      await storage.upsertMessageTemplate({
        type: 'hide_prices_until_contact',
        content: enabled ? 'true' : 'false'
      });
      res.json({ success: true, enabled });
    } catch (error) {
      console.error('Hide prices setting error:', error);
      res.status(500).json({ error: "Failed to update setting" });
    }
  });

  // Hide prices completely (only show in email/SMS)
  app.get("/api/settings/hide-prices-completely", async (req, res) => {
    try {
      const templates = await storage.getMessageTemplates();
      const setting = templates.find(t => t.type === 'hide_prices_completely');
      res.json({ enabled: setting ? setting.content === 'true' : false });
    } catch (error) {
      res.status(500).json({ error: "Failed to get setting" });
    }
  });

  app.post("/api/settings/hide-prices-completely", requireAdmin, async (req, res) => {
    try {
      const { enabled } = req.body;
      await storage.upsertMessageTemplate({
        type: 'hide_prices_completely',
        content: enabled ? 'true' : 'false'
      });
      res.json({ success: true, enabled });
    } catch (error) {
      console.error('Hide prices completely setting error:', error);
      res.status(500).json({ error: "Failed to update setting" });
    }
  });

  // RepairDesk lead creation setting
  app.get("/api/settings/repairdesk-leads", async (req, res) => {
    try {
      const templates = await storage.getMessageTemplates();
      const setting = templates.find(t => t.type === 'repairdesk_leads_enabled');
      res.json({ enabled: setting ? setting.content === 'true' : false });
    } catch (error) {
      res.status(500).json({ error: "Failed to get setting" });
    }
  });

  app.post("/api/settings/repairdesk-leads", requireAdmin, async (req, res) => {
    try {
      const { enabled } = req.body;
      await storage.upsertMessageTemplate({
        type: 'repairdesk_leads_enabled',
        content: enabled ? 'true' : 'false'
      });
      res.json({ success: true, enabled });
    } catch (error) {
      console.error('RepairDesk leads setting error:', error);
      res.status(500).json({ error: "Failed to update setting" });
    }
  });

  // Price rounding settings
  app.get("/api/settings/price-rounding", async (req, res) => {
    try {
      const templates = await storage.getMessageTemplates();
      const modeSetting = templates.find(t => t.type === 'price_rounding_mode');
      const subtractSetting = templates.find(t => t.type === 'price_rounding_subtract');
      res.json({
        mode: modeSetting?.content || "nearest5",
        subtractAmount: parseInt(subtractSetting?.content || "1", 10)
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get rounding settings" });
    }
  });

  app.post("/api/settings/price-rounding", requireAdmin, async (req, res) => {
    try {
      const { mode, subtractAmount } = req.body;
      
      // Validate mode
      const validModes = ["none", "nearest5", "nearest10"];
      if (mode !== undefined) {
        if (!validModes.includes(mode)) {
          return res.status(400).json({ error: "Invalid rounding mode. Must be: none, nearest5, or nearest10" });
        }
        await storage.upsertMessageTemplate({
          type: 'price_rounding_mode',
          content: mode,
          subject: null,
        });
      }
      
      // Validate subtractAmount
      if (subtractAmount !== undefined) {
        const parsed = parseInt(subtractAmount, 10);
        if (isNaN(parsed) || parsed < 0 || parsed > 9) {
          return res.status(400).json({ error: "Invalid subtract amount. Must be a number between 0 and 9" });
        }
        await storage.upsertMessageTemplate({
          type: 'price_rounding_subtract',
          content: String(parsed),
          subject: null,
        });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Price rounding setting error:', error);
      res.status(500).json({ error: "Failed to update setting" });
    }
  });

  // Pricing Source Setting (mobilesentrix_api or excel_upload)
  app.get("/api/settings/pricing-source", async (req, res) => {
    try {
      const templates = await storage.getMessageTemplates();
      const setting = templates.find(t => t.type === 'pricing_source');
      res.json({
        source: setting?.content || "excel_upload" // Default to Excel upload
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get pricing source setting" });
    }
  });

  app.post("/api/settings/pricing-source", requireAdmin, async (req, res) => {
    try {
      const { source } = req.body;
      
      const validSources = ["mobilesentrix_api", "excel_upload"];
      if (!validSources.includes(source)) {
        return res.status(400).json({ error: "Invalid source. Must be: mobilesentrix_api or excel_upload" });
      }
      
      await storage.upsertMessageTemplate({
        type: 'pricing_source',
        content: source,
      });
      
      res.json({ success: true, source });
    } catch (error) {
      console.error('Pricing source setting error:', error);
      res.status(500).json({ error: "Failed to update setting" });
    }
  });

  app.post("/api/repairdesk/check-stock", async (req, res) => {
    try {
      // Check if stock checking is enabled
      const templates = await storage.getMessageTemplates();
      const stockSetting = templates.find(t => t.type === 'stock_check_enabled');
      const stockCheckEnabled = stockSetting ? stockSetting.content === 'true' : true;
      
      if (!stockCheckEnabled) {
        return res.json({}); // Return empty if disabled
      }

      const { skus } = req.body;
      if (!Array.isArray(skus)) {
        return res.status(400).json({ error: "skus must be an array" });
      }
      
      // Limit the number of SKUs per request to prevent abuse
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

  // RepairDesk Sync API Routes
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

  // Get calculated prices for all linked services (for manual reference)
  app.get("/api/repairdesk/sync/calculated-prices", requireAdmin, async (req, res) => {
    try {
      const { getCalculatedPrices } = await import("./repairdesk-sync");
      const prices = await getCalculatedPrices();
      res.json(prices);
    } catch (error) {
      console.error("Failed to get calculated prices:", error);
      res.status(500).json({ error: "Failed to get calculated prices" });
    }
  });

  // Start scheduled sync on server startup (every 2 days)
  if (isRepairDeskSyncConfigured()) {
    startScheduledSync(2);
  }

  return httpServer;
}
