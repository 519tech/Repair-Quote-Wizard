import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  insertDeviceTypeSchema,
  insertDeviceSchema,
  insertPartSchema,
  insertServiceSchema,
  insertDeviceServiceSchema,
  insertQuoteRequestSchema,
  insertBrandSchema,
  insertBrandDeviceTypeSchema,
} from "@shared/schema";
import { z } from "zod";
import multer from "multer";
import * as XLSX from "xlsx";

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
  // Device Types
  app.get("/api/device-types", async (req, res) => {
    try {
      const types = await storage.getDeviceTypes();
      res.json(types);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch device types" });
    }
  });

  app.post("/api/device-types", async (req, res) => {
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

  app.patch("/api/device-types/:id", async (req, res) => {
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

  app.delete("/api/device-types/:id", async (req, res) => {
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

  app.post("/api/brands", async (req, res) => {
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

  app.patch("/api/brands/:id", async (req, res) => {
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

  app.delete("/api/brands/:id", async (req, res) => {
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

  app.post("/api/brand-device-types", async (req, res) => {
    try {
      const data = insertBrandDeviceTypeSchema.parse(req.body);
      const link = await storage.createBrandDeviceType(data);
      res.status(201).json(link);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to create brand-device-type link" });
    }
  });

  app.delete("/api/brand-device-types/:id", async (req, res) => {
    try {
      await storage.deleteBrandDeviceType(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete brand-device-type link" });
    }
  });

  // Devices
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

  app.post("/api/devices", async (req, res) => {
    try {
      const data = insertDeviceSchema.parse(req.body);
      const device = await storage.createDevice(data);
      res.status(201).json(device);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to create device" });
    }
  });

  app.patch("/api/devices/:id", async (req, res) => {
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

  app.delete("/api/devices/:id", async (req, res) => {
    try {
      await storage.deleteDevice(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete device" });
    }
  });

  // Parts
  app.get("/api/parts", async (req, res) => {
    try {
      const parts = await storage.getParts();
      res.json(parts);
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

  app.post("/api/parts", async (req, res) => {
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

  app.patch("/api/parts/:id", async (req, res) => {
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

  app.delete("/api/parts/:id", async (req, res) => {
    try {
      await storage.deletePart(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete part" });
    }
  });

  app.post("/api/parts/upload", upload.single('file'), async (req, res) => {
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

      const partsToUpsert: { sku: string; name: string; price: string }[] = [];
      const errors: string[] = [];

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length < 3) continue;

        const sku = String(row[0] || '').trim();
        const name = String(row[1] || '').trim();
        const priceRaw = row[2];

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

      const result = await storage.bulkUpsertParts(partsToUpsert);

      res.json({
        success: true,
        inserted: result.inserted,
        updated: result.updated,
        total: partsToUpsert.length,
        errors: errors.length > 0 ? errors : undefined
      });
    } catch (error: any) {
      console.error("Parts upload error:", error);
      res.status(500).json({ error: error.message || "Failed to process file" });
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

  app.post("/api/services", async (req, res) => {
    try {
      const data = insertServiceSchema.parse(req.body);
      const service = await storage.createService(data);
      res.status(201).json(service);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to create service" });
    }
  });

  app.patch("/api/services/:id", async (req, res) => {
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

  app.delete("/api/services/:id", async (req, res) => {
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
    laborPrice: z.string(),
    partSku: z.string().optional(),
    partId: z.string().optional(),
  });

  app.post("/api/device-services", async (req, res) => {
    try {
      const input = deviceServiceWithSkuSchema.parse(req.body);
      
      let partId = input.partId;
      if (input.partSku && !partId) {
        const part = await storage.getPartBySku(input.partSku);
        if (!part) {
          return res.status(400).json({ error: `Part with SKU '${input.partSku}' not found` });
        }
        partId = part.id;
      }
      
      const data = {
        deviceId: input.deviceId,
        serviceId: input.serviceId,
        laborPrice: input.laborPrice,
        partId: partId || null,
      };
      
      const deviceService = await storage.createDeviceService(data);
      res.status(201).json(deviceService);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to create device service" });
    }
  });

  app.patch("/api/device-services/:id", async (req, res) => {
    try {
      const input = deviceServiceWithSkuSchema.partial().parse(req.body);
      
      let partId = input.partId;
      if (input.partSku && !partId) {
        const part = await storage.getPartBySku(input.partSku);
        if (!part) {
          return res.status(400).json({ error: `Part with SKU '${input.partSku}' not found` });
        }
        partId = part.id;
      }
      
      const data: any = {};
      if (input.deviceId) data.deviceId = input.deviceId;
      if (input.serviceId) data.serviceId = input.serviceId;
      if (input.laborPrice) data.laborPrice = input.laborPrice;
      if (partId !== undefined) data.partId = partId || null;
      
      const deviceService = await storage.updateDeviceService(req.params.id, data);
      if (!deviceService) {
        return res.status(404).json({ error: "Device service not found" });
      }
      res.json(deviceService);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to update device service" });
    }
  });

  app.delete("/api/device-services/:id", async (req, res) => {
    try {
      await storage.deleteDeviceService(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete device service" });
    }
  });

  // Quote calculation endpoint - calculates price on server side
  app.get("/api/calculate-quote/:deviceServiceId", async (req, res) => {
    try {
      const deviceService = await storage.getDeviceServiceWithRelations(req.params.deviceServiceId);
      if (!deviceService) {
        return res.status(404).json({ error: "Device service not found" });
      }
      
      const laborPrice = parseFloat(deviceService.laborPrice);
      const partPrice = deviceService.part ? parseFloat(deviceService.part.price) : 0;
      const totalPrice = (laborPrice + partPrice).toFixed(2);
      
      res.json({
        deviceServiceId: deviceService.id,
        deviceName: deviceService.device.name,
        serviceName: deviceService.service.name,
        laborPrice: deviceService.laborPrice,
        partPrice: deviceService.part?.price || "0.00",
        partSku: deviceService.part?.sku || null,
        partName: deviceService.part?.name || null,
        totalPrice,
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
  });

  app.post("/api/quote-requests", async (req, res) => {
    try {
      const input = quoteRequestWithValidationSchema.parse(req.body);
      
      const deviceService = await storage.getDeviceServiceWithRelations(input.deviceServiceId);
      if (!deviceService) {
        return res.status(400).json({ error: "Device service not found" });
      }
      
      const laborPrice = parseFloat(deviceService.laborPrice);
      const partPrice = deviceService.part ? parseFloat(deviceService.part.price) : 0;
      const quotedPrice = (laborPrice + partPrice).toFixed(2);
      
      const quote = await storage.createQuoteRequest({
        customerName: input.customerName,
        customerEmail: input.customerEmail,
        customerPhone: input.customerPhone,
        deviceId: input.deviceId,
        deviceServiceId: input.deviceServiceId,
        quotedPrice,
      });
      
      res.status(201).json(quote);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to create quote request" });
    }
  });

  return httpServer;
}
