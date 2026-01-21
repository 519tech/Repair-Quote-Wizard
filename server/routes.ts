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
import { sendQuoteEmail, sendCombinedQuoteEmail } from "./gmail";
import { sendQuoteSms, sendCombinedQuoteSms } from "./sms";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";

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
  // Register Object Storage routes for file uploads
  registerObjectStorageRoutes(app);

  // Admin authentication endpoints
  app.post("/api/admin/login", async (req, res) => {
    try {
      const { password } = req.body;
      const adminPassword = process.env.ADMIN_PASSWORD;
      
      if (!adminPassword) {
        return res.status(500).json({ error: "Admin password not configured" });
      }
      
      if (password === adminPassword) {
        req.session.isAdmin = true;
        res.json({ success: true });
      } else {
        res.status(401).json({ error: "Invalid password" });
      }
    } catch (error) {
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
    res.json({ isAdmin: req.session?.isAdmin === true });
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
          return deviceName.includes(query) || brandName.includes(query) || typeName.includes(query);
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
      
      // If pagination params provided, use paginated query
      if (req.query.page || req.query.limit || req.query.search) {
        const result = await storage.getPartsPaginated({ page, limit, search });
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
        serviceId: z.string(),
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
      
      for (const deviceId of input.deviceIds) {
        try {
          const deviceService = await storage.createDeviceService({
            deviceId,
            serviceId: input.serviceId,
            partId,
            partSku,
          });
          created.push(deviceService);
        } catch (error: any) {
          // Skip duplicates
          if (error.message?.includes("duplicate") || error.code === '23505') {
            skipped.push(deviceId);
          } else {
            throw error;
          }
        }
      }
      
      res.status(201).json({ 
        created: created.length, 
        skipped: skipped.length,
        total: input.deviceIds.length 
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

  // Round price to nearest 5 minus 1 (so prices end in 9 or 4, like $99, $84, $149)
  function roundToNearestFiveMinus1(price: number): number {
    const rounded = Math.round(price / 5) * 5;
    return Math.max(4, rounded - 1);
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
      const partCost = deviceService.part ? parseFloat(deviceService.part.price) : 0;
      const markedUpPartCost = partCost * partsMarkup;
      const rawTotal = laborPrice + markedUpPartCost;
      const totalPrice = roundToNearestFiveMinus1(rawTotal);
      
      // Check if service has parts or is labour-only
      const hasPart = !!deviceService.part;
      const isLabourOnly = service.labourOnly === true;
      // Service is available if it has parts OR is marked as labour-only
      const isAvailable = hasPart || isLabourOnly;
      
      res.json({
        deviceServiceId: deviceService.id,
        deviceName: deviceService.device.name,
        serviceName: service.name,
        serviceDescription: service.description,
        warranty: service.warranty,
        repairTime: service.repairTime,
        laborPrice: service.laborPrice,
        partsMarkup: service.partsMarkup,
        partCost: deviceService.part?.price || "0.00",
        partSku: deviceService.part?.sku || null,
        partName: deviceService.part?.name || null,
        totalPrice: totalPrice.toFixed(2),
        hasPart,
        isLabourOnly,
        isAvailable,
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
      const quotedPrice = roundToNearestFiveMinus1(rawTotal).toFixed(2);
      
      const quote = await storage.createQuoteRequest({
        customerName: input.customerName,
        customerEmail: input.customerEmail,
        customerPhone: input.customerPhone,
        deviceId: input.deviceId,
        deviceServiceId: input.deviceServiceId,
        quotedPrice,
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
  });

  app.post("/api/quote-requests/combined", async (req, res) => {
    try {
      const input = combinedQuoteRequestSchema.parse(req.body);
      
      // Fetch all device services and calculate prices
      const servicesData: Array<{
        serviceName: string;
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
        const quotedPrice = roundToNearestFiveMinus1(rawTotal);
        
        servicesData.push({
          serviceName: service.name,
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
        });
      }

      // Send combined email
      sendCombinedQuoteEmail({
        customerName: input.customerName,
        customerEmail: input.customerEmail,
        deviceName,
        services: servicesData,
        grandTotal: grandTotal.toFixed(2),
      }).catch(err => console.error('Combined email send error:', err));

      // Send combined SMS if phone provided
      if (input.customerPhone) {
        sendCombinedQuoteSms({
          customerName: input.customerName,
          customerPhone: input.customerPhone,
          deviceName,
          services: servicesData,
          grandTotal: grandTotal.toFixed(2),
        }).catch(err => console.error('Combined SMS send error:', err));
      }

      res.status(201).json({ 
        success: true, 
        servicesCount: servicesData.length,
        grandTotal: grandTotal.toFixed(2)
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to create combined quote request" });
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

  return httpServer;
}
