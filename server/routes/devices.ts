import type { Express } from "express";
import { z } from "zod";
import * as XLSX from "xlsx";
import { storage } from "../storage";
import { requireAdmin, upload, getDeviceSearchData, invalidateDeviceSearchCache } from "../middleware";
import { logger } from "../logger";
import {
  insertDeviceTypeSchema,
  insertDeviceSchema,
  insertBrandSchema,
  insertBrandDeviceTypeSchema,
  insertBrandServiceCategorySchema,
} from "@shared/schema";
import OpenAI from "openai";

export function registerDeviceRoutes(app: Express) {
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
      if (error.code === "23505") {
        return res.status(400).json({ error: "A device type with this name already exists" });
      }
      res.status(400).json({ error: error.message || "Failed to create device type" });
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
    } catch (error) {
      res.status(500).json({ error: "Failed to delete device type" });
    }
  });

  app.post("/api/device-types/reorder", requireAdmin, async (req, res) => {
    try {
      const { orderedIds } = req.body;
      if (!Array.isArray(orderedIds)) {
        return res.status(400).json({ error: "orderedIds must be an array" });
      }
      await storage.reorderDeviceTypes(orderedIds);
      res.status(200).json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to reorder device types" });
    }
  });

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
      if (error.code === "23505") {
        return res.status(400).json({ error: "A brand with this name already exists" });
      }
      res.status(400).json({ error: error.message || "Failed to create brand" });
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

  app.post("/api/brands/reorder", requireAdmin, async (req, res) => {
    try {
      const { orderedIds } = req.body;
      if (!Array.isArray(orderedIds)) {
        return res.status(400).json({ error: "orderedIds must be an array" });
      }
      await storage.reorderBrands(orderedIds);
      res.status(200).json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to reorder brands" });
    }
  });

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
      res.status(400).json({ error: error.message || "Failed to create link" });
    }
  });

  app.delete("/api/brand-device-types/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteBrandDeviceType(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete link" });
    }
  });

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
      const links = await storage.getBrandServiceCategoriesByBrand(req.params.brandId);
      res.json(links);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch brand service categories" });
    }
  });

  app.post("/api/brand-service-categories", requireAdmin, async (req, res) => {
    try {
      const data = insertBrandServiceCategorySchema.parse(req.body);
      const link = await storage.createBrandServiceCategory(data);
      res.status(201).json(link);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to create link" });
    }
  });

  app.delete("/api/brand-service-categories/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteBrandServiceCategory(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete link" });
    }
  });

  app.get("/api/devices/search", async (req, res) => {
    try {
      const query = (req.query.q as string || "").toLowerCase().trim();
      if (!query || query.length < 2) {
        return res.json([]);
      }

      const { devices, brands, types } = await getDeviceSearchData();

      const terms = query.split(/\s+/).filter(Boolean);
      const results = devices
        .map(d => {
          const brand = brands.get(d.brandId);
          const type = types.get(d.deviceTypeId);
          const searchStr = `${brand?.name || ''} ${d.name} ${type?.name || ''}`.toLowerCase();
          const allMatch = terms.every(t => searchStr.includes(t));
          if (!allMatch) return null;

          let score = 0;
          const brandName = (brand?.name || '').toLowerCase();
          const deviceName = d.name.toLowerCase();
          if (deviceName === query) score += 100;
          if (deviceName.startsWith(query)) score += 50;
          if (deviceName.includes(query)) score += 20;
          if (brandName.includes(terms[0])) score += 10;

          return {
            id: d.id,
            name: d.name,
            brand: brand?.name || '',
            deviceType: type?.name || '',
            deviceTypeId: d.deviceTypeId,
            score,
          };
        })
        .filter(Boolean)
        .sort((a, b) => b!.score - a!.score)
        .slice(0, 20);

      res.json(results);
    } catch (error) {
      res.status(500).json({ error: "Search failed" });
    }
  });

  app.get("/api/devices", async (req, res) => {
    try {
      const brandId = req.query.brandId as string | undefined;
      const typeId = req.query.typeId as string | undefined;

      let devices;
      if (brandId && typeId) {
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
      const { deviceName, brandName } = req.body;
      if (!deviceName) {
        return res.status(400).json({ error: "Device name is required" });
      }

      const openai = new OpenAI();
      const prompt = `What is the release date of the ${brandName ? brandName + ' ' : ''}${deviceName}? 
Reply with ONLY a date in YYYY-MM-DD format. If you're not sure of the exact day, use the 1st of the month.
If you cannot determine the release date at all, reply with "UNKNOWN".
Do not include any other text.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 20,
        temperature: 0,
      });

      const result = response.choices[0]?.message?.content?.trim();

      if (!result || result === "UNKNOWN") {
        return res.json({ releaseDate: null, message: "Could not determine release date" });
      }

      const dateMatch = result.match(/^\d{4}-\d{2}-\d{2}$/);
      if (dateMatch) {
        return res.json({ releaseDate: dateMatch[0] });
      }

      res.json({ releaseDate: null, message: "Could not parse release date" });
    } catch (error: any) {
      logger.error('Release date detection error', { error: String(error) });
      res.status(500).json({ error: error.message || "Failed to detect release date" });
    }
  });

  app.post("/api/devices/bulk-detect-release-dates", requireAdmin, async (req, res) => {
    try {
      const { devices: deviceList } = req.body;
      if (!Array.isArray(deviceList) || deviceList.length === 0) {
        return res.status(400).json({ error: "devices array is required" });
      }

      if (deviceList.length > 50) {
        return res.status(400).json({ error: "Maximum 50 devices per batch" });
      }

      const openai = new OpenAI();
      const deviceDescriptions = deviceList.map((d: any, i: number) =>
        `${i + 1}. ${d.brandName ? d.brandName + ' ' : ''}${d.deviceName}`
      ).join('\n');

      const prompt = `For each device below, provide the release date in YYYY-MM-DD format. If unsure of the exact day, use the 1st of the month. If completely unknown, write "UNKNOWN".

Reply with ONLY numbered lines in this exact format:
1. YYYY-MM-DD
2. UNKNOWN
3. YYYY-MM-DD

Devices:
${deviceDescriptions}`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: deviceList.length * 20,
        temperature: 0,
      });

      const result = response.choices[0]?.message?.content?.trim();
      if (!result) {
        return res.json({ results: deviceList.map(() => ({ releaseDate: null })) });
      }

      const lines = result.split('\n');
      const results = deviceList.map((device: any, index: number) => {
        const line = lines[index]?.trim();
        if (!line) return { deviceId: device.id, releaseDate: null };

        const dateMatch = line.match(/\d{4}-\d{2}-\d{2}/);
        if (dateMatch) {
          return { deviceId: device.id, releaseDate: dateMatch[0] };
        }
        return { deviceId: device.id, releaseDate: null };
      });

      for (const r of results) {
        if (r.releaseDate && r.deviceId) {
          await storage.updateDevice(r.deviceId, { releaseDate: r.releaseDate });
        }
      }

      invalidateDeviceSearchCache();
      res.json({ results });
    } catch (error: any) {
      logger.error('Bulk release date detection error', { error: String(error) });
      res.status(500).json({ error: error.message || "Failed to detect release dates" });
    }
  });

  app.get("/api/devices/template", requireAdmin, async (req, res) => {
    try {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([
        ["Device Name", "Brand", "Device Type", "Release Date (YYYY-MM-DD)"],
        ["iPhone 15 Pro Max", "Apple", "Smartphone", "2023-09-22"],
        ["Galaxy S24 Ultra", "Samsung", "Smartphone", "2024-01-17"],
      ]);
      ws['!cols'] = [{ width: 25 }, { width: 15 }, { width: 15 }, { width: 25 }];
      XLSX.utils.book_append_sheet(wb, ws, "Devices");
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="device-import-template.xlsx"');
      res.send(Buffer.from(buffer));
    } catch (error: any) {
      logger.error('Template generation error', { error: String(error) });
      res.status(500).json({ error: "Failed to generate template" });
    }
  });

  app.post("/api/devices/bulk-import", requireAdmin, upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

      if (rows.length < 2) {
        return res.status(400).json({ error: "File must have a header row and at least one data row" });
      }

      const allBrands = await storage.getBrands();
      const allTypes = await storage.getDeviceTypes();
      const brandMap = new Map(allBrands.map(b => [b.name.toLowerCase(), b]));
      const typeMap = new Map(allTypes.map(t => [t.name.toLowerCase(), t]));

      let created = 0;
      let skipped = 0;
      const errors: string[] = [];

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const deviceName = String(row[0] || '').trim();
        const brandName = String(row[1] || '').trim();
        const typeName = String(row[2] || '').trim();
        const releaseDate = String(row[3] || '').trim();

        if (!deviceName || !brandName || !typeName) {
          errors.push(`Row ${i + 1}: Missing required fields`);
          skipped++;
          continue;
        }

        const brand = brandMap.get(brandName.toLowerCase());
        const deviceType = typeMap.get(typeName.toLowerCase());

        if (!brand) {
          errors.push(`Row ${i + 1}: Brand "${brandName}" not found`);
          skipped++;
          continue;
        }
        if (!deviceType) {
          errors.push(`Row ${i + 1}: Device type "${typeName}" not found`);
          skipped++;
          continue;
        }

        try {
          await storage.createDevice({
            name: deviceName,
            brandId: brand.id,
            deviceTypeId: deviceType.id,
            releaseDate: releaseDate || null,
          });
          created++;
        } catch (error: any) {
          if (error.message?.includes("duplicate") || error.code === '23505') {
            skipped++;
          } else {
            errors.push(`Row ${i + 1}: ${error.message}`);
            skipped++;
          }
        }
      }

      invalidateDeviceSearchCache();
      res.json({ created, skipped, errors: errors.slice(0, 10), totalRows: rows.length - 1 });
    } catch (error: any) {
      logger.error('Bulk import error', { error: String(error) });
      res.status(500).json({ error: error.message || "Failed to import devices" });
    }
  });
}
