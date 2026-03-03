import type { Express } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { requireAdmin } from "../middleware";
import { insertServiceCategorySchema, insertServiceSchema } from "@shared/schema";

export function registerServiceRoutes(app: Express) {
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
    partSku: z.string().nullable().optional(),
    partId: z.string().nullable().optional(),
    alternativePartSkus: z.array(z.string()).optional(),
    additionalFee: z.number().optional(),
    repairDeskServiceId: z.number().nullable().optional(),
    manualPriceOverride: z.string().nullable().optional(),
  });

  app.post("/api/device-services", requireAdmin, async (req, res) => {
    try {
      const input = deviceServiceWithSkuSchema.parse(req.body);

      let partId = input.partId;
      let partSku = input.partSku || null;

      if (input.partSku && !partId) {
        const part = await storage.getPartBySku(input.partSku);
        if (part) {
          partId = part.id;
          partSku = part.sku;
        } else {
          partSku = input.partSku;
        }
      } else if (partId && !partSku) {
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

  app.post("/api/device-services/clone", requireAdmin, async (req, res) => {
    try {
      const schema = z.object({
        sourceDeviceId: z.string(),
        targetDeviceId: z.string(),
      });
      const input = schema.parse(req.body);

      if (input.sourceDeviceId === input.targetDeviceId) {
        return res.status(400).json({ error: "Source and target device cannot be the same" });
      }

      const sourceDevice = await storage.getDevice(input.sourceDeviceId);
      if (!sourceDevice) {
        return res.status(400).json({ error: "Source device not found" });
      }

      const targetDevice = await storage.getDevice(input.targetDeviceId);
      if (!targetDevice) {
        return res.status(400).json({ error: "Target device not found" });
      }

      const sourceLinks = await storage.getDeviceServicesByDevice(input.sourceDeviceId);

      if (sourceLinks.length === 0) {
        return res.json({ created: 0, skipped: 0, message: "Source device has no service links to clone" });
      }

      let created = 0;
      let skipped = 0;

      for (const link of sourceLinks) {
        try {
          await storage.createDeviceService({
            deviceId: input.targetDeviceId,
            serviceId: link.serviceId,
            partId: null,
          });
          created++;
        } catch (error: any) {
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
        if (part) {
          partId = part.id;
          partSku = part.sku;
        } else {
          partSku = input.partSku;
        }
      } else if (partId && !partSku) {
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
      if (!deviceServiceId || !dismissType || !["1month", "3months", "indefinite"].includes(dismissType)) {
        return res.status(400).json({ error: "Invalid request body" });
      }
      const alert = await storage.dismissAlert(deviceServiceId, dismissType);
      res.json(alert);
    } catch (error) {
      res.status(500).json({ error: "Failed to dismiss alert" });
    }
  });

  app.post("/api/dismissed-alerts/bulk", requireAdmin, async (req, res) => {
    try {
      const { deviceServiceIds, dismissType } = req.body;
      if (!Array.isArray(deviceServiceIds) || deviceServiceIds.length === 0) {
        return res.status(400).json({ error: "deviceServiceIds array is required" });
      }
      if (!dismissType || !["1month", "3months", "indefinite"].includes(dismissType)) {
        return res.status(400).json({ error: "Invalid dismissType" });
      }
      const results = [];
      for (const id of deviceServiceIds) {
        const alert = await storage.dismissAlert(id, dismissType);
        results.push(alert);
      }
      res.json({ success: true, count: results.length });
    } catch (error) {
      res.status(500).json({ error: "Failed to bulk dismiss alerts" });
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
}
