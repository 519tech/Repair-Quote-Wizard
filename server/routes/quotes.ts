import type { Express } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { requireAdmin } from "../middleware";
import { sendQuoteEmail, sendCombinedQuoteEmail, sendAdminNotificationEmail, sendUnknownDeviceQuoteEmail, sendUnknownDeviceAdminNotification, withRetry } from "../gmail";
import { sendQuoteSms, sendCombinedQuoteSms, sendUnknownDeviceQuoteSms } from "../sms";
import { createLead } from "../repairdesk";
import { isMobilesentrixConfigured, getProductBySku, MobilesentrixApiError, getCachedPriceWithDb, setCachedPrice } from "../mobilesentrix";
import { logger } from "../logger";

async function roundPrice(price: number, bypassRounding: boolean = false): Promise<number> {
  if (bypassRounding) {
    return price;
  }

  const templates = await storage.getMessageTemplates();
  const modeSetting = templates.find(t => t.type === 'price_rounding_mode');
  const subtractSetting = templates.find(t => t.type === 'price_rounding_subtract');

  const mode = modeSetting?.content || "nearest5";
  const parsedSubtract = parseInt(subtractSetting?.content || "1", 10);
  const subtractAmount = isNaN(parsedSubtract) ? 1 : Math.max(0, Math.min(9, parsedSubtract));

  if (mode === "none") {
    return price;
  }

  let rounded: number;
  if (mode === "nearest10") {
    rounded = Math.round(price / 10) * 10;
  } else {
    rounded = Math.round(price / 5) * 5;
  }

  return Math.max(0, rounded - subtractAmount);
}

async function getSkuPrice(sku: string): Promise<{ price: number; name: string; found: boolean; source: 'api' | 'excel'; apiError?: string; fromCache?: boolean }> {
  const templates = await storage.getMessageTemplates();
  const pricingSourceSetting = templates.find(t => t.type === 'pricing_source');
  const pricingSource = pricingSourceSetting?.content || 'excel_upload';

  if (pricingSource === 'excel_upload') {
    try {
      const part = await storage.getSupplierPartBySku(sku);
      if (part) {
        return { price: parseFloat(part.price), name: part.name, found: true, source: 'excel' };
      }
      logger.info("SKU not found in supplier parts", { sku });
      return { price: 0, name: '', found: false, source: 'excel' };
    } catch (error: any) {
      logger.error("Error fetching SKU from database", { sku, error: error.message });
      return { price: 0, name: '', found: false, source: 'excel', apiError: error.message };
    }
  }

  const cached = await getCachedPriceWithDb(sku);
  if (cached) {
    return {
      price: parseFloat(String(cached.price)) || 0,
      name: cached.name,
      found: cached.found,
      source: 'api',
      fromCache: true
    };
  }

  if (!isMobilesentrixConfigured()) {
    logger.error('Mobilesentrix API not configured');
    return { price: 0, name: '', found: false, source: 'api', apiError: 'API not configured' };
  }

  try {
    const apiResult = await getProductBySku(sku);

    if (apiResult.found) {
      await setCachedPrice(sku, {
        sku: apiResult.sku || sku,
        name: apiResult.name,
        price: apiResult.price,
        inStock: apiResult.inStock,
        found: apiResult.found,
      });
      return { price: parseFloat(String(apiResult.price)) || 0, name: apiResult.name, found: true, source: 'api' };
    }
    logger.info("SKU not found in API, checking fallbacks", { sku });
    const customPart = await storage.getPartBySku(sku);
    if (customPart) {
      logger.info('Found custom part fallback', { sku, name: customPart.name, price: customPart.price });
      return { price: parseFloat(customPart.price), name: customPart.name, found: true, source: 'api' };
    }
    const fallbackSetting = templates.find(t => t.type === 'api_excel_fallback');
    const excelFallbackEnabled = fallbackSetting ? fallbackSetting.content === 'true' : true;
    if (excelFallbackEnabled) {
      const supplierPart = await storage.getSupplierPartBySku(sku);
      if (supplierPart) {
        logger.info('Found Excel fallback', { sku, name: supplierPart.name, price: supplierPart.price });
        return { price: parseFloat(supplierPart.price), name: supplierPart.name, found: true, source: 'excel' };
      }
    }
    return { price: 0, name: '', found: false, source: 'api' };
  } catch (error: any) {
    const errorMsg = error instanceof MobilesentrixApiError
      ? `API error ${error.statusCode}: ${error.message}`
      : error.message || 'Unknown API error';
    logger.error("Mobilesentrix API error", { sku, error: errorMsg });

    try {
      const customPart = await storage.getPartBySku(sku);
      if (customPart) {
        logger.info('API error but found custom part', { sku, name: customPart.name, price: customPart.price });
        return { price: parseFloat(customPart.price), name: customPart.name, found: true, source: 'api' };
      }
      const fallbackTemplates = await storage.getMessageTemplates();
      const fallbackSetting = fallbackTemplates.find(t => t.type === 'api_excel_fallback');
      const excelFallbackEnabled = fallbackSetting ? fallbackSetting.content === 'true' : true;
      if (excelFallbackEnabled) {
        const supplierPart = await storage.getSupplierPartBySku(sku);
        if (supplierPart) {
          logger.info('API error but found Excel fallback', { sku, name: supplierPart.name, price: supplierPart.price });
          return { price: parseFloat(supplierPart.price), name: supplierPart.name, found: true, source: 'excel' };
        }
      }
    } catch (dbError) {
      logger.error("Error checking fallback parts", { sku, error: String(dbError) });
    }

    return { price: 0, name: '', found: false, source: 'api', apiError: errorMsg };
  }
}

export { getSkuPrice };

export function registerQuoteRoutes(app: Express) {
  app.get("/api/calculate-quote/:deviceServiceId", async (req, res) => {
    try {
      const deviceService = await storage.getDeviceServiceWithRelations(req.params.deviceServiceId);
      if (!deviceService) {
        return res.status(404).json({ error: "Device service not found" });
      }

      const service = deviceService.service;

      const manualPriceOverride = (deviceService as any).manualPriceOverride;
      if (manualPriceOverride !== null && manualPriceOverride !== undefined && manualPriceOverride !== "") {
        const overridePrice = parseFloat(manualPriceOverride);
        if (!isNaN(overridePrice)) {
          const overridePrimarySkus: string[] = [];
          const overridePrimarySku = (deviceService as any).partSku;
          if (overridePrimarySku) overridePrimarySkus.push(overridePrimarySku);
          const overrideAltSkus = (deviceService as any).alternativePartSkus || [];
          if (overrideAltSkus.length > 0) overridePrimarySkus.push(...overrideAltSkus);
          const overrideAdditionalParts = await storage.getDeviceServiceParts(deviceService.id);
          const overrideAdditionalSkus = overrideAdditionalParts.filter(ap => !ap.isPrimary && ap.part?.sku).map(ap => ap.part!.sku);

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
            partSku: overridePrimarySku || null,
            partName: null,
            primaryPartSkus: overridePrimarySkus,
            additionalPartSkus: overrideAdditionalSkus,
            additionalPartsCount: overrideAdditionalSkus.length,
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

      const primaryPartSkusToFetch: string[] = [];

      const primaryPartSku = (deviceService as any).partSku;
      if (primaryPartSku) {
        primaryPartSkusToFetch.push(primaryPartSku);
      }

      const alternativeSkus = (deviceService as any).alternativePartSkus || [];
      if (alternativeSkus.length > 0) {
        primaryPartSkusToFetch.push(...alternativeSkus);
      }

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

      let cheapestPrimaryPart: typeof primaryPartOptions[0] | null = null;
      if (primaryPartOptions.length > 0) {
        cheapestPrimaryPart = primaryPartOptions.reduce((min, p) => p.price < min.price ? p : min, primaryPartOptions[0]);
      }

      const primaryPartCost = cheapestPrimaryPart?.price || 0;

      const additionalParts = await storage.getDeviceServiceParts(deviceService.id);
      let additionalPartsCost = 0;
      for (const ap of additionalParts) {
        if (ap.part?.sku && !ap.isPrimary) {
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

      const hasPart = primaryPartOptions.length > 0 || additionalParts.some(ap => !!ap.part);
      const isLabourOnly = service.labourOnly === true;
      const isAvailable = hasPart || isLabourOnly;

      const primaryPartSkus: string[] = primaryPartOptions.map(p => p.sku);

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
        primaryPartSkus,
        additionalPartSkus: secondaryPartSkus,
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
      logger.error('Calculate quote error', { error: String(error.message || error) });
      res.status(500).json({ error: "Failed to calculate quote", details: error.message });
    }
  });

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

      let quotedPrice: string;
      const manualPriceOverride = (deviceService as any).manualPriceOverride;
      if (manualPriceOverride !== null && manualPriceOverride !== undefined && manualPriceOverride !== "") {
        const overridePrice = parseFloat(manualPriceOverride);
        if (!isNaN(overridePrice)) {
          quotedPrice = overridePrice.toFixed(2);
        } else {
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

      if (input.optIn) {
        const singleTemplates = await storage.getMessageTemplates();
        const validSetting = singleTemplates.find(t => t.type === 'quote_valid_days');
        const quoteData = {
          customerName: input.customerName,
          customerEmail: input.customerEmail,
          customerPhone: input.customerPhone || '',
          deviceName: deviceService.device.name,
          serviceName: service.name,
          price: quotedPrice,
          repairTime: service.repairTime || undefined,
          warranty: service.warranty || undefined,
          quoteValidDays: validSetting ? parseInt(validSetting.content) : 7,
        };

        withRetry(() => sendQuoteEmail(quoteData), 'Quote customer email').catch(err => logger.error('Email send error (all retries failed)', { error: String(err) }));

        if (input.customerPhone) {
          withRetry(() => sendQuoteSms(quoteData), 'Quote customer SMS').catch(err => logger.error('SMS send error (all retries failed)', { error: String(err) }));
        }
      }

      withRetry(() => sendAdminNotificationEmail({
        customerName: input.customerName,
        customerEmail: input.customerEmail,
        customerPhone: input.customerPhone,
        deviceName: deviceService.device.name,
        services: [{
          serviceName: service.name,
          price: quotedPrice,
          repairTime: service.repairTime || undefined,
          warranty: service.warranty || undefined,
        }],
        grandTotal: quotedPrice,
        notes: input.notes,
      }), 'Quote admin notification').catch(err => logger.error('Admin notification error (all retries failed)', { error: String(err) }));

      res.status(201).json(quote);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to create quote request" });
    }
  });

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

        let quotedPrice: number;
        const manualPriceOverride = (deviceService as any).manualPriceOverride;
        if (manualPriceOverride !== null && manualPriceOverride !== undefined && manualPriceOverride !== "") {
          const overridePrice = parseFloat(manualPriceOverride);
          if (!isNaN(overridePrice)) {
            quotedPrice = overridePrice;
          } else {
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

      const discountAmount = input.multiServiceDiscount || 0;
      const finalTotal = grandTotal - discountAmount;

      const allTemplates = await storage.getMessageTemplates();
      const validDaysSetting = allTemplates.find(t => t.type === 'quote_valid_days');
      const quoteValidDays = validDaysSetting ? parseInt(validDaysSetting.content) : 7;

      withRetry(() => sendCombinedQuoteEmail({
        customerName: input.customerName,
        customerEmail: input.customerEmail,
        deviceName,
        services: servicesData,
        grandTotal: finalTotal.toFixed(2),
        multiServiceDiscount: discountAmount > 0 ? discountAmount.toFixed(2) : undefined,
        quoteValidDays,
      }), 'Combined quote customer email').catch(err => logger.error('Combined email send error (all retries failed)', { error: String(err) }));

      if (input.customerPhone) {
        withRetry(() => sendCombinedQuoteSms({
          customerName: input.customerName,
          customerPhone: input.customerPhone,
          deviceName,
          services: servicesData,
          grandTotal: finalTotal.toFixed(2),
          multiServiceDiscount: discountAmount > 0 ? discountAmount.toFixed(2) : undefined,
          quoteValidDays,
        }), 'Combined quote customer SMS').catch(err => logger.error('Combined SMS send error (all retries failed)', { error: String(err) }));
      }

      withRetry(() => sendAdminNotificationEmail({
        customerName: input.customerName,
        customerEmail: input.customerEmail,
        customerPhone: input.customerPhone,
        deviceName,
        services: servicesData,
        grandTotal: finalTotal.toFixed(2),
        multiServiceDiscount: discountAmount > 0 ? discountAmount.toFixed(2) : undefined,
        notes: input.notes,
      }), 'Combined quote admin notification').catch(err => logger.error('Admin notification error (all retries failed)', { error: String(err) }));

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
        }).catch(err => logger.error('RepairDesk lead creation error', { error: String(err) }));
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

      await storage.createUnknownDeviceQuote({
        customerName: input.customerName,
        customerEmail: input.customerEmail,
        customerPhone: input.customerPhone,
        deviceDescription: input.deviceDescription,
        issueDescription: input.issueDescription,
      });

      withRetry(() => sendUnknownDeviceQuoteEmail({
        customerName: input.customerName,
        customerEmail: input.customerEmail,
        deviceDescription: input.deviceDescription,
        issueDescription: input.issueDescription,
      }), 'Unknown device customer email').catch(err => logger.error('Unknown device email error (all retries failed)', { error: String(err) }));

      if (input.customerPhone) {
        withRetry(() => sendUnknownDeviceQuoteSms({
          customerName: input.customerName,
          customerPhone: input.customerPhone,
          deviceDescription: input.deviceDescription,
          issueDescription: input.issueDescription,
        }), 'Unknown device customer SMS').catch(err => logger.error('Unknown device SMS error (all retries failed)', { error: String(err) }));
      }

      withRetry(() => sendUnknownDeviceAdminNotification({
        customerName: input.customerName,
        customerEmail: input.customerEmail,
        customerPhone: input.customerPhone,
        deviceDescription: input.deviceDescription,
        issueDescription: input.issueDescription,
      }), 'Unknown device admin notification').catch(err => logger.error('Unknown device admin notification error (all retries failed)', { error: String(err) }));

      res.status(201).json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to submit quote request" });
    }
  });

  app.get("/api/unknown-device-quotes", requireAdmin, async (req, res) => {
    try {
      const quotes = await storage.getUnknownDeviceQuotes();
      res.json(quotes);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch unknown device quotes" });
    }
  });

  app.get("/api/submissions/search", requireAdmin, async (req, res) => {
    try {
      const query = (req.query.q as string || "").toLowerCase().trim();

      const quoteRequests = await storage.getQuoteRequests();
      const unknownQuotes = await storage.getUnknownDeviceQuotes();

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

      const allSubmissions = [...enrichedQuoteRequests, ...enrichedUnknownQuotes];

      const filtered = query
        ? allSubmissions.filter(s =>
            s.customerName.toLowerCase().includes(query) ||
            s.customerEmail.toLowerCase().includes(query) ||
            (s.customerPhone && s.customerPhone.toLowerCase().includes(query))
          )
        : allSubmissions;

      filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      res.json(filtered);
    } catch (error) {
      logger.error('Search submissions error', { error: String(error) });
      res.status(500).json({ error: "Failed to search submissions" });
    }
  });

  app.get("/api/internal/submissions", async (req, res) => {
    try {
      const query = (req.query.q as string || "").toLowerCase().trim();

      const quoteRequests = await storage.getQuoteRequests();
      const unknownQuotes = await storage.getUnknownDeviceQuotes();

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
            deviceServiceId: qr.deviceServiceId,
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

      const allSubmissions = [...enrichedQuoteRequests, ...enrichedUnknownQuotes];

      const filtered = query
        ? allSubmissions.filter(s =>
            s.customerName.toLowerCase().includes(query) ||
            s.customerEmail.toLowerCase().includes(query) ||
            (s.customerPhone && s.customerPhone.toLowerCase().includes(query))
          )
        : allSubmissions;

      filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      res.json(filtered);
    } catch (error) {
      logger.error('Internal submissions error', { error: String(error) });
      res.status(500).json({ error: "Failed to fetch submissions" });
    }
  });

  app.post("/api/quote-views", async (req, res) => {
    try {
      const schema = z.object({
        deviceServiceId: z.string(),
        calculatedPrice: z.string(),
      });
      const input = schema.parse(req.body);

      const ds = await storage.getDeviceServiceWithRelations(input.deviceServiceId);
      if (!ds) {
        return res.status(404).json({ error: "Device service not found" });
      }

      const view = await storage.createQuoteView({
        deviceId: ds.deviceId,
        deviceServiceId: input.deviceServiceId,
        serviceName: ds.service?.name || "Unknown Service",
        deviceName: ds.device?.name || "Unknown Device",
        calculatedPrice: input.calculatedPrice,
      });

      res.status(201).json(view);
    } catch (error: any) {
      logger.error('Quote view tracking error', { error: String(error) });
      res.status(400).json({ error: error.message || "Failed to track quote view" });
    }
  });

  app.get("/api/quote-views", async (req, res) => {
    try {
      const views = await storage.getQuoteViews();
      res.json(views);
    } catch (error) {
      logger.error('Get quote views error', { error: String(error) });
      res.status(500).json({ error: "Failed to fetch quote views" });
    }
  });
}
