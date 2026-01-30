import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, decimal, unique, boolean, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Device types (smartphone, tablet, laptop, etc.)
export const deviceTypes = pgTable("device_types", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  icon: text("icon").notNull().default("smartphone"),
});

export const deviceTypesRelations = relations(deviceTypes, ({ many }) => ({
  devices: many(devices),
  brandDeviceTypes: many(brandDeviceTypes),
}));

export const insertDeviceTypeSchema = createInsertSchema(deviceTypes).omit({ id: true });
export type InsertDeviceType = z.infer<typeof insertDeviceTypeSchema>;
export type DeviceType = typeof deviceTypes.$inferSelect;

// Brands (Apple, Samsung, Google, Dell, etc.)
export const brands = pgTable("brands", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  logo: text("logo"),
});

export const brandsRelations = relations(brands, ({ many }) => ({
  devices: many(devices),
  brandDeviceTypes: many(brandDeviceTypes),
  brandServiceCategories: many(brandServiceCategories),
}));

export const insertBrandSchema = createInsertSchema(brands).omit({ id: true });
export type InsertBrand = z.infer<typeof insertBrandSchema>;
export type Brand = typeof brands.$inferSelect;

// Brand-DeviceType linking (which brands make which device types)
export const brandDeviceTypes = pgTable("brand_device_types", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  brandId: varchar("brand_id").notNull().references(() => brands.id, { onDelete: "cascade" }),
  deviceTypeId: varchar("device_type_id").notNull().references(() => deviceTypes.id, { onDelete: "cascade" }),
});

export const brandDeviceTypesRelations = relations(brandDeviceTypes, ({ one }) => ({
  brand: one(brands, {
    fields: [brandDeviceTypes.brandId],
    references: [brands.id],
  }),
  deviceType: one(deviceTypes, {
    fields: [brandDeviceTypes.deviceTypeId],
    references: [deviceTypes.id],
  }),
}));

export const insertBrandDeviceTypeSchema = createInsertSchema(brandDeviceTypes).omit({ id: true });
export type InsertBrandDeviceType = z.infer<typeof insertBrandDeviceTypeSchema>;
export type BrandDeviceType = typeof brandDeviceTypes.$inferSelect;

// Devices (iPhone 15, Samsung Galaxy S24, MacBook Pro, etc.)
export const devices = pgTable("devices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  deviceTypeId: varchar("device_type_id").notNull().references(() => deviceTypes.id, { onDelete: "cascade" }),
  brandId: varchar("brand_id").references(() => brands.id, { onDelete: "set null" }),
  imageUrl: text("image_url"),
}, (table) => [
  unique("devices_name_brand_type_unique").on(table.name, table.brandId, table.deviceTypeId),
]);

export const devicesRelations = relations(devices, ({ one, many }) => ({
  deviceType: one(deviceTypes, {
    fields: [devices.deviceTypeId],
    references: [deviceTypes.id],
  }),
  brand: one(brands, {
    fields: [devices.brandId],
    references: [brands.id],
  }),
  deviceServices: many(deviceServices),
}));

export const insertDeviceSchema = createInsertSchema(devices).omit({ id: true });
export type InsertDevice = z.infer<typeof insertDeviceSchema>;
export type Device = typeof devices.$inferSelect;

// Parts inventory with SKU and pricing
export const parts = pgTable("parts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sku: text("sku").notNull().unique(),
  name: text("name").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  isCustom: boolean("is_custom").notNull().default(false),
});

export const insertPartSchema = createInsertSchema(parts).omit({ id: true });
export type InsertPart = z.infer<typeof insertPartSchema>;
export type Part = typeof parts.$inferSelect;

// Supplier parts (imported from Excel - Mobilesentrix price list)
export const supplierParts = pgTable("supplier_parts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sku: text("sku").notNull().unique(),
  name: text("name").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
});

export const insertSupplierPartSchema = createInsertSchema(supplierParts).omit({ id: true });
export type InsertSupplierPart = z.infer<typeof insertSupplierPartSchema>;
export type SupplierPart = typeof supplierParts.$inferSelect;

// Service categories (Battery Replacement, Screen Replacement, etc.)
export const serviceCategories = pgTable("service_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
  imageUrl: text("image_url"),
  displayOrder: integer("display_order").notNull().default(0),
});

export const serviceCategoriesRelations = relations(serviceCategories, ({ many }) => ({
  services: many(services),
  brandServiceCategories: many(brandServiceCategories),
}));

export const insertServiceCategorySchema = createInsertSchema(serviceCategories).omit({ id: true });
export type InsertServiceCategory = z.infer<typeof insertServiceCategorySchema>;
export type ServiceCategory = typeof serviceCategories.$inferSelect;

// Brand-ServiceCategory linking (which categories apply to which brands)
export const brandServiceCategories = pgTable("brand_service_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  brandId: varchar("brand_id").notNull().references(() => brands.id, { onDelete: "cascade" }),
  categoryId: varchar("category_id").notNull().references(() => serviceCategories.id, { onDelete: "cascade" }),
});

export const brandServiceCategoriesRelations = relations(brandServiceCategories, ({ one }) => ({
  brand: one(brands, {
    fields: [brandServiceCategories.brandId],
    references: [brands.id],
  }),
  category: one(serviceCategories, {
    fields: [brandServiceCategories.categoryId],
    references: [serviceCategories.id],
  }),
}));

export const insertBrandServiceCategorySchema = createInsertSchema(brandServiceCategories).omit({ id: true });
export type InsertBrandServiceCategory = z.infer<typeof insertBrandServiceCategorySchema>;
export type BrandServiceCategory = typeof brandServiceCategories.$inferSelect;
export type BrandServiceCategoryWithRelations = BrandServiceCategory & { brand: Brand; category: ServiceCategory };

// Services (Original, Aftermarket, Premium, Budget, etc.)
export const services = pgTable("services", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
  categoryId: varchar("category_id").references(() => serviceCategories.id, { onDelete: "set null" }),
  brandId: varchar("brand_id").references(() => brands.id, { onDelete: "set null" }),
  warranty: text("warranty"),
  repairTime: text("repair_time"),
  laborPrice: decimal("labor_price", { precision: 10, scale: 2 }).notNull().default("0"),
  partsMarkup: decimal("parts_markup", { precision: 5, scale: 2 }).notNull().default("1.0"),
  secondaryPartPercentage: integer("secondary_part_percentage").notNull().default(100),
  notes: text("notes"),
  labourOnly: boolean("labour_only").notNull().default(false),
  imageUrl: text("image_url"),
  bypassMultiDiscount: boolean("bypass_multi_discount").notNull().default(false),
  bypassRounding: boolean("bypass_rounding").notNull().default(false),
});

export const servicesRelations = relations(services, ({ one }) => ({
  category: one(serviceCategories, {
    fields: [services.categoryId],
    references: [serviceCategories.id],
  }),
  brand: one(brands, {
    fields: [services.brandId],
    references: [brands.id],
  }),
}));

export const insertServiceSchema = createInsertSchema(services).omit({ id: true });
export type InsertService = z.infer<typeof insertServiceSchema>;
export type Service = typeof services.$inferSelect;

// Device-Service linking with optional parts
export const deviceServices = pgTable("device_services", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  deviceId: varchar("device_id").notNull().references(() => devices.id, { onDelete: "cascade" }),
  serviceId: varchar("service_id").notNull().references(() => services.id, { onDelete: "cascade" }),
  partId: varchar("part_id").references(() => parts.id, { onDelete: "set null" }),
  partSku: varchar("part_sku"), // Stored separately so it persists when part is deleted
  alternativePartSkus: text("alternative_part_skus").array(), // Alternative primary parts (cheapest used)
  additionalFee: real("additional_fee").default(0), // Extra fee for specific device-service combos (e.g., Samsung charge port)
}, (table) => [
  unique("device_services_device_service_unique").on(table.deviceId, table.serviceId),
]);

export const deviceServicesRelations = relations(deviceServices, ({ one }) => ({
  device: one(devices, {
    fields: [deviceServices.deviceId],
    references: [devices.id],
  }),
  service: one(services, {
    fields: [deviceServices.serviceId],
    references: [services.id],
  }),
  part: one(parts, {
    fields: [deviceServices.partId],
    references: [parts.id],
  }),
}));

export const insertDeviceServiceSchema = createInsertSchema(deviceServices).omit({ id: true });
export type InsertDeviceService = z.infer<typeof insertDeviceServiceSchema>;
export type DeviceService = typeof deviceServices.$inferSelect;

// Junction table for multiple parts per device-service link
export const deviceServiceParts = pgTable("device_service_parts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  deviceServiceId: varchar("device_service_id").notNull().references(() => deviceServices.id, { onDelete: "cascade" }),
  partId: varchar("part_id").references(() => parts.id, { onDelete: "set null" }),
  partSku: varchar("part_sku"),
  isPrimary: boolean("is_primary").notNull().default(false),
});

export const deviceServicePartsRelations = relations(deviceServiceParts, ({ one }) => ({
  deviceService: one(deviceServices, {
    fields: [deviceServiceParts.deviceServiceId],
    references: [deviceServices.id],
  }),
  part: one(parts, {
    fields: [deviceServiceParts.partId],
    references: [parts.id],
  }),
}));

export const insertDeviceServicePartSchema = createInsertSchema(deviceServiceParts).omit({ id: true });
export type InsertDeviceServicePart = z.infer<typeof insertDeviceServicePartSchema>;
export type DeviceServicePart = typeof deviceServiceParts.$inferSelect;

// Quote requests from customers
export const quoteRequests = pgTable("quote_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  customerPhone: text("customer_phone"),
  deviceId: varchar("device_id").notNull().references(() => devices.id, { onDelete: "cascade" }),
  deviceServiceId: varchar("device_service_id").notNull().references(() => deviceServices.id, { onDelete: "cascade" }),
  quotedPrice: decimal("quoted_price", { precision: 10, scale: 2 }).notNull(),
  notes: text("notes"),
  createdAt: text("created_at").notNull().default(sql`now()`),
});

// Unknown device quote requests (when customer doesn't know their device)
export const unknownDeviceQuotes = pgTable("unknown_device_quotes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  customerPhone: text("customer_phone"),
  deviceDescription: text("device_description").notNull(),
  issueDescription: text("issue_description").notNull(),
  createdAt: text("created_at").notNull().default(sql`now()`),
});

export const insertUnknownDeviceQuoteSchema = createInsertSchema(unknownDeviceQuotes).omit({ id: true, createdAt: true });
export type InsertUnknownDeviceQuote = z.infer<typeof insertUnknownDeviceQuoteSchema>;
export type UnknownDeviceQuote = typeof unknownDeviceQuotes.$inferSelect;

export const quoteRequestsRelations = relations(quoteRequests, ({ one }) => ({
  device: one(devices, {
    fields: [quoteRequests.deviceId],
    references: [devices.id],
  }),
  deviceService: one(deviceServices, {
    fields: [quoteRequests.deviceServiceId],
    references: [deviceServices.id],
  }),
}));

export const insertQuoteRequestSchema = createInsertSchema(quoteRequests).omit({ id: true, createdAt: true });
export type InsertQuoteRequest = z.infer<typeof insertQuoteRequestSchema>;
export type QuoteRequest = typeof quoteRequests.$inferSelect;

// Message templates for email/SMS
export const messageTemplates = pgTable("message_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull().unique(), // 'email_body', 'email_subject', 'sms'
  content: text("content").notNull(),
});

export const insertMessageTemplateSchema = createInsertSchema(messageTemplates).omit({ id: true });
export type InsertMessageTemplate = z.infer<typeof insertMessageTemplateSchema>;
export type MessageTemplate = typeof messageTemplates.$inferSelect;

// Dismissed service link alerts (for hiding missing parts warnings)
export const dismissedServiceLinkAlerts = pgTable("dismissed_service_link_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  deviceServiceId: varchar("device_service_id").notNull().references(() => deviceServices.id, { onDelete: "cascade" }),
  dismissType: text("dismiss_type").notNull(), // "1month" or "indefinite"
  dismissedAt: text("dismissed_at").notNull().default(sql`now()`),
  expiresAt: text("expires_at"), // null for indefinite, timestamp for 1month
});

export const insertDismissedAlertSchema = createInsertSchema(dismissedServiceLinkAlerts).omit({ id: true, dismissedAt: true });
export type InsertDismissedAlert = z.infer<typeof insertDismissedAlertSchema>;
export type DismissedServiceLinkAlert = typeof dismissedServiceLinkAlerts.$inferSelect;

// RepairDesk OAuth tokens storage
export const repairDeskTokens = pgTable("repairdesk_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull().default(sql`now()`),
});

export const insertRepairDeskTokenSchema = createInsertSchema(repairDeskTokens).omit({ id: true, createdAt: true });
export type InsertRepairDeskToken = z.infer<typeof insertRepairDeskTokenSchema>;
export type RepairDeskToken = typeof repairDeskTokens.$inferSelect;

// Extended types for frontend with relations
export type DeviceWithType = Device & { deviceType: DeviceType; brand: Brand | null };
export type BrandDeviceTypeWithRelations = BrandDeviceType & { brand: Brand; deviceType: DeviceType };
export type ServiceWithCategory = Service & { category: ServiceCategory | null };
export type DeviceServicePartWithPart = DeviceServicePart & { part: Part | null };
export type DeviceServiceWithRelations = DeviceService & { 
  device: Device & { deviceType?: DeviceType; brand?: Brand | null }; 
  service: ServiceWithCategory; 
  part: Part | null;
  additionalParts?: DeviceServicePartWithPart[];
};

// Auth models
export * from "./models/auth";
