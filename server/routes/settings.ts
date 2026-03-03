import type { Express } from "express";
import { storage } from "../storage";
import { requireAdmin } from "../middleware";
import { insertMessageTemplateSchema } from "@shared/schema";
import { logger } from "../logger";

export function registerSettingsRoutes(app: Express) {
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

  app.get("/api/settings/quote-flow", async (req, res) => {
    try {
      const templates = await storage.getMessageTemplates();
      const get = (type: string) => templates.find(t => t.type === type);

      const quoteValidDays = get('quote_valid_days');

      res.json({
        multiDiscount: {
          enabled: get('multi_discount_enabled')?.content === 'true',
          amount: get('multi_discount_amount') ? parseFloat(get('multi_discount_amount')!.content) : 10,
        },
        hidePricesUntilContact: get('hide_prices_until_contact')?.content === 'true',
        hidePricesCompletely: get('hide_prices_completely')?.content === 'true',
        pricingSource: get('pricing_source')?.content || 'excel_upload',
        partsLastUpdated: get('parts_last_updated') || null,
        quoteValidDays: quoteValidDays ? parseInt(quoteValidDays.content) : 7,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get quote settings" });
    }
  });

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

      await storage.upsertMessageTemplate({
        type: 'multi_discount_enabled',
        content: enabled ? 'true' : 'false'
      });

      await storage.upsertMessageTemplate({
        type: 'multi_discount_amount',
        content: String(amount)
      });

      res.json({ success: true, enabled, amount });
    } catch (error) {
      logger.error('Multi-discount settings error', { error: String(error) });
      res.status(500).json({ error: "Failed to update settings" });
    }
  });

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
      logger.error('Hide prices setting error', { error: String(error) });
      res.status(500).json({ error: "Failed to update setting" });
    }
  });

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
      logger.error('Hide prices completely setting error', { error: String(error) });
      res.status(500).json({ error: "Failed to update setting" });
    }
  });

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
      logger.error('RepairDesk leads setting error', { error: String(error) });
      res.status(500).json({ error: "Failed to update setting" });
    }
  });

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
      logger.error('Price rounding setting error', { error: String(error) });
      res.status(500).json({ error: "Failed to update setting" });
    }
  });

  app.get("/api/settings/pricing-source", async (req, res) => {
    try {
      const templates = await storage.getMessageTemplates();
      const setting = templates.find(t => t.type === 'pricing_source');
      res.json({
        source: setting?.content || "excel_upload"
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
      logger.error('Pricing source setting error', { error: String(error) });
      res.status(500).json({ error: "Failed to update setting" });
    }
  });

  app.get("/api/settings/api-excel-fallback", async (req, res) => {
    try {
      const templates = await storage.getMessageTemplates();
      const setting = templates.find(t => t.type === 'api_excel_fallback');
      res.json({ enabled: setting ? setting.content === 'true' : true });
    } catch (error) {
      res.status(500).json({ error: "Failed to get setting" });
    }
  });

  app.post("/api/settings/api-excel-fallback", requireAdmin, async (req, res) => {
    try {
      const { enabled } = req.body;
      await storage.upsertMessageTemplate({
        type: 'api_excel_fallback',
        content: enabled ? 'true' : 'false'
      });
      res.json({ success: true, enabled });
    } catch (error) {
      logger.error('API Excel fallback setting error', { error: String(error) });
      res.status(500).json({ error: "Failed to update setting" });
    }
  });

  app.get("/api/settings/quote-valid-days", async (req, res) => {
    try {
      const templates = await storage.getMessageTemplates();
      const setting = templates.find(t => t.type === 'quote_valid_days');
      res.json({ days: setting ? parseInt(setting.content) : 7 });
    } catch (error) {
      res.json({ days: 7 });
    }
  });

  app.post("/api/settings/quote-valid-days", requireAdmin, async (req, res) => {
    try {
      const { days } = req.body;
      const value = Math.max(1, Math.min(365, parseInt(days) || 7));
      await storage.upsertMessageTemplate({
        type: 'quote_valid_days',
        content: String(value)
      });
      res.json({ success: true, days: value });
    } catch (error) {
      logger.error('Quote valid days setting error', { error: String(error) });
      res.status(500).json({ error: "Failed to update setting" });
    }
  });

  app.get("/api/settings/ai", requireAdmin, async (req, res) => {
    try {
      const templates = await storage.getMessageTemplates();
      const geminiKey = templates.find(t => t.type === 'gemini_api_key');
      const aiProvider = templates.find(t => t.type === 'ai_provider');
      res.json({
        geminiKeySet: !!geminiKey?.content,
        aiProvider: aiProvider?.content || 'replit',
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get AI settings" });
    }
  });

  app.post("/api/settings/ai", requireAdmin, async (req, res) => {
    try {
      const { geminiApiKey, aiProvider } = req.body;
      if (geminiApiKey !== undefined) {
        await storage.upsertMessageTemplate({
          type: 'gemini_api_key',
          content: geminiApiKey || '',
        });
      }
      if (aiProvider) {
        if (aiProvider === 'gemini') {
          const templates = await storage.getMessageTemplates();
          const existingKey = templates.find(t => t.type === 'gemini_api_key');
          const hasKey = !!existingKey?.content || !!geminiApiKey;
          if (!hasKey) {
            return res.status(400).json({ error: "Cannot switch to Gemini without an API key configured" });
          }
        }
        await storage.upsertMessageTemplate({
          type: 'ai_provider',
          content: aiProvider,
        });
      }
      res.json({ success: true });
    } catch (error) {
      logger.error('AI settings update error', { error: String(error) });
      res.status(500).json({ error: "Failed to update AI settings" });
    }
  });

  app.post("/api/settings/ai/test-gemini", requireAdmin, async (req, res) => {
    try {
      const templates = await storage.getMessageTemplates();
      const geminiKey = templates.find(t => t.type === 'gemini_api_key');
      if (!geminiKey?.content) {
        return res.status(400).json({ error: "Gemini API key not configured" });
      }
      const { GoogleGenerativeAI } = await import("@google/generative-ai");
      const genAI = new GoogleGenerativeAI(geminiKey.content);
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      const result = await model.generateContent("Say 'OK' if you can read this.");
      const text = result.response.text();
      res.json({ success: true, response: text.trim() });
    } catch (error: any) {
      logger.error('Gemini test error', { error: String(error) });
      res.status(400).json({ error: error.message || "Gemini API test failed" });
    }
  });
}
