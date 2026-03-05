import type { Express } from "express";
import { storage } from "../storage";
import { requireAdmin } from "../middleware";
import { insertPartSchema } from "@shared/schema";
import { logger } from "../logger";

export function registerPartRoutes(app: Express) {
  app.get("/api/parts", requireAdmin, async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 100;
      const search = req.query.search as string | undefined;
      const isCustom = req.query.isCustom === 'true' ? true : req.query.isCustom === 'false' ? false : undefined;

      if (req.query.page || req.query.limit || req.query.search || req.query.isCustom !== undefined) {
        const result = await storage.getPartsPaginated({ page, limit, search, isCustom });
        res.json(result);
      } else {
        const parts = await storage.getParts();
        res.json(parts);
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch parts" });
    }
  });

  app.get("/api/parts/sku/:sku", requireAdmin, async (req, res) => {
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

  app.get("/api/supplier-parts/sku/:sku", requireAdmin, async (req, res) => {
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

      await storage.upsertMessageTemplate({
        type: 'parts_last_updated',
        content: new Date().toISOString()
      });

      res.json({ success: true, ...result });
    } catch (error: any) {
      logger.error('Supplier parts upload error', { error: String(error) });
      res.status(500).json({ error: error.message || "Failed to upload supplier parts" });
    }
  });

  app.delete("/api/parts/supplier/all", requireAdmin, async (req, res) => {
    try {
      await storage.clearAllSupplierParts();
      res.json({ success: true });
    } catch (error: any) {
      logger.error('Error clearing supplier parts', { error: String(error) });
      res.status(500).json({ error: "Failed to clear supplier parts" });
    }
  });
}
