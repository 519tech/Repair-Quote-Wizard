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
      res.json(type);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to update device type" });
    }
  });

  app.delete("/api/device-types/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteDeviceType(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Delete device type error:", error);
      res.status(500).json({ error: error.message || "Failed to delete device type" });
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
      res.json(brand);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to update brand" });
    }
  });

  app.delete("/api/brands/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteBrand(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete brand" });
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
      const allDevices = await storage.getDevices();
      const allBrands = await storage.getBrands();
      const allTypes = await storage.getDeviceTypes();
      
      const brandsMap = new Map(allBrands.map(b => [b.id, b]));
      const typesMap = new Map(allTypes.map(t => [t.id, t]));
      
      // Split query into words for flexible matching
      const queryWords = query.split(/\s+/).filter(w => w.length > 0);
      
      const results = allDevices
        .map(device => ({
          ...device,
          brand: device.brandId ? brandsMap.get(device.brandId) : null,
          deviceType: typesMap.get(device.deviceTypeId),
        }))
        .filter(device => {
          const deviceName = device.name.toLowerCase();
          const brandName = device.brand?.name?.toLowerCase() || "";
          const typeName = device.deviceType?.name?.toLowerCase() || "";
          const fullText = `${brandName} ${deviceName} ${typeName}`;
          
          // All query words must be found somewhere in the full text
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
      res.json(device);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to update device" });
    }
  });

  app.delete("/api/devices/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteDevice(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete device" });
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

  // Delete all supplier parts (preserves custom parts)
  app.delete("/api/parts/supplier/all", requireAdmin, async (req, res) => {
    try {
      await storage.deleteAllParts();
      res.json({ success: true, message: "All supplier parts deleted" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete supplier parts" });
    }
  });

  // Supplier callback endpoint for real-time parts pricing updates
  app.post("/api/supplier/parts-callback", async (req, res) => {
    try {
      const apiKey = req.headers["x-api-key"] || req.query.api_key;
      const expectedKey = process.env.SUPPLIER_API_KEY;
      
      if (!expectedKey || apiKey !== expectedKey) {
        return res.status(401).json({ error: "Invalid API key" });
      }

      const schema = z.object({
        sku: z.string(),
        name: z.string().optional(),
        price: z.union([z.string(), z.number()]),
      });

      const data = schema.parse(req.body);
      const priceStr = typeof data.price === 'number' ? data.price.toFixed(2) : data.price;
      
      // Try to find existing part by SKU
      const existingPart = await storage.getPartBySku(data.sku);
      
      if (existingPart) {
        // Update existing part price
        await storage.updatePart(existingPart.id, { price: priceStr });
        res.json({ success: true, action: "updated", sku: data.sku, price: priceStr });
      } else if (data.name) {
        // Create new part if name is provided
        await storage.createPart({ sku: data.sku, name: data.name, price: priceStr, isCustom: false });
        res.json({ success: true, action: "created", sku: data.sku, price: priceStr });
      } else {
        res.status(404).json({ error: "Part not found and no name provided to create" });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data format", details: error.errors });
      }
      res.status(500).json({ error: "Failed to process supplier callback" });
    }
  });

  // Endpoint to query supplier for part pricing (for admin use)
  app.get("/api/supplier/query/:sku", requireAdmin, async (req, res) => {
    try {
      const supplierUrl = process.env.SUPPLIER_API_URL;
      const supplierKey = process.env.SUPPLIER_API_KEY;
      
      if (!supplierUrl) {
        return res.status(400).json({ error: "Supplier API URL not configured" });
      }

      const sku = req.params.sku;
      const response = await fetch(`${supplierUrl}?sku=${encodeURIComponent(sku)}`, {
        headers: supplierKey ? { "Authorization": `Bearer ${supplierKey}` } : {},
      });

      if (!response.ok) {
        return res.status(response.status).json({ error: "Failed to query supplier" });
      }

      const data = await response.json();
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to query supplier API" });
    }
  });

  app.post("/api/parts/upload", requireAdmin, upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        return res.status(400).json({ error: "Excel file has no sheets" });
      }

      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

      if (rows.length < 2) {
        return res.status(400).json({ error: "Excel file must have a header row and at least one data row" });
      }

      const headerRow = rows[0];
      if (!headerRow) {
        return res.status(400).json({ error: "Missing header row" });
      }

      const headers = headerRow.map((h: any) => String(h || '').trim().toLowerCase());
      
      const skuIndex = headers.findIndex((h: string) => h === 'product sku' || h === 'sku');
      const nameIndex = headers.findIndex((h: string) => h === 'product name' || h === 'name');
      const priceIndex = headers.findIndex((h: string) => h === 'original price' || h === 'price');

      if (skuIndex === -1) {
        return res.status(400).json({ error: "Missing required column: 'Product SKU' or 'SKU'" });
      }
      if (nameIndex === -1) {
        return res.status(400).json({ error: "Missing required column: 'Product Name' or 'Name'" });
      }
      if (priceIndex === -1) {
        return res.status(400).json({ error: "Missing required column: 'Original Price' or 'Price'" });
      }

      const partsToUpsert: { sku: string; name: string; price: string }[] = [];
      const errors: string[] = [];

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;

        const sku = String(row[skuIndex] || '').trim();
        const name = String(row[nameIndex] || '').trim();
        const priceRaw = row[priceIndex];

        if (!sku) {
          errors.push(`Row ${i + 1}: Missing SKU`);
          continue;
        }
        if (!name) {
          errors.push(`Row ${i + 1}: Missing name`);
          continue;
        }

        let price: string;
        if (typeof priceRaw === 'number') {
          price = priceRaw.toFixed(2);
        } else if (typeof priceRaw === 'string') {
          const parsed = parseFloat(priceRaw.replace(/[^0-9.-]/g, ''));
          if (isNaN(parsed)) {
            errors.push(`Row ${i + 1}: Invalid price "${priceRaw}"`);
            continue;
          }
          price = parsed.toFixed(2);
        } else {
          errors.push(`Row ${i + 1}: Missing or invalid price`);
          continue;
        }

        partsToUpsert.push({ sku, name, price });
      }

      if (partsToUpsert.length === 0) {
        return res.status(400).json({ 
          error: "No valid parts found in file", 
          details: errors.length > 0 ? errors : undefined 
        });
      }

      // Delete all existing parts before inserting new ones
      await storage.deleteAllParts();
      
      const result = await storage.bulkUpsertParts(partsToUpsert);

      // Update the parts_last_updated timestamp
      await storage.upsertMessageTemplate({ 
        type: "parts_last_updated", 
        content: new Date().toISOString() 
      });

      res.json({
        success: true,
        inserted: result.inserted,
        deleted: true,
        total: partsToUpsert.length,
        errors: errors.length > 0 ? errors : undefined
      });
    } catch (error: any) {
      console.error("Parts upload error:", error);
      res.status(500).json({ error: error.message || "Failed to process file" });
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
  });

  app.post("/api/device-services", requireAdmin, async (req, res) => {
    try {
      const input = deviceServiceWithSkuSchema.parse(req.body);
      
      let partId = input.partId;
      let partSku = input.partSku || null;
      
      if (input.partSku && !partId) {
        const part = await storage.getPartBySku(input.partSku);
        if (!part) {
          return res.status(400).json({ error: `Part with SKU '${input.partSku}' not found` });
        }
        partId = part.id;
        partSku = part.sku; // Store the SKU
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
        const part = await storage.getPartBySku(input.partSku);
        if (!part) {
          return res.status(400).json({ error: `Part with SKU '${input.partSku}' not found` });
        }
        partId = part.id;
        partSku = part.sku;
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
  async function roundPrice(price: number): Promise<number> {
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

  // Quote calculation endpoint - calculates price on server side
  // Formula: Labor price + (parts cost × parts markup), rounded to nearest 5 minus 1
  app.get("/api/calculate-quote/:deviceServiceId", async (req, res) => {
    try {
      const deviceService = await storage.getDeviceServiceWithRelations(req.params.deviceServiceId);
      if (!deviceService) {
        return res.status(404).json({ error: "Device service not found" });
      }
      
      const service = deviceService.service;
      const laborPrice = parseFloat(service.laborPrice || "0");
      const partsMarkup = parseFloat(service.partsMarkup || "1.0");
      const secondaryPartPercentage = (service.secondaryPartPercentage || 100) / 100;
      
      // Collect all primary part options (main part + alternatives)
      const primaryPartOptions: { sku: string; price: number; name: string }[] = [];
      if (deviceService.part) {
        primaryPartOptions.push({
          sku: deviceService.part.sku,
          price: parseFloat(deviceService.part.price),
          name: deviceService.part.name,
        });
      }
      
      // Add alternative primary parts
      const alternativeSkus = (deviceService as any).alternativePartSkus || [];
      if (alternativeSkus.length > 0) {
        const allParts = await storage.getParts();
        for (const altSku of alternativeSkus) {
          const altPart = allParts.find(p => p.sku === altSku);
          if (altPart) {
            primaryPartOptions.push({
              sku: altPart.sku,
              price: parseFloat(altPart.price),
              name: altPart.name,
            });
          }
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
        if (ap.part && !ap.isPrimary) {
          additionalPartsCost += parseFloat(ap.part.price) * secondaryPartPercentage;
        }
      }
      
      const totalPartCost = primaryPartCost + additionalPartsCost;
      const markedUpPartCost = totalPartCost * partsMarkup;
      const rawTotal = laborPrice + markedUpPartCost;
      const totalPrice = await roundPrice(rawTotal);
      
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
        partCost: cheapestPrimaryPart?.price?.toFixed(2) || "0.00",
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
    } catch (error) {
      res.status(500).json({ error: "Failed to calculate quote" });
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
      const laborPrice = parseFloat(service.laborPrice || "0");
      const partsMarkup = parseFloat(service.partsMarkup || "1.0");
      const partCost = deviceService.part ? parseFloat(deviceService.part.price) : 0;
      const markedUpPartCost = partCost * partsMarkup;
      const rawTotal = laborPrice + markedUpPartCost;
      const quotedPrice = (await roundPrice(rawTotal)).toFixed(2);
      
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
        const laborPrice = parseFloat(service.laborPrice || "0");
        const partsMarkup = parseFloat(service.partsMarkup || "1.0");
        const partCost = deviceService.part ? parseFloat(deviceService.part.price) : 0;
        const markedUpPartCost = partCost * partsMarkup;
        const rawTotal = laborPrice + markedUpPartCost;
        const quotedPrice = await roundPrice(rawTotal);
        
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
            customerNotes: input.notes,
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

  return httpServer;
}
