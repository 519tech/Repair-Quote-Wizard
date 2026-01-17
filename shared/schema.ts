import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, decimal } from "drizzle-orm/pg-core";
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
});

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
});

export const insertPartSchema = createInsertSchema(parts).omit({ id: true });
export type InsertPart = z.infer<typeof insertPartSchema>;
export type Part = typeof parts.$inferSelect;

// Services (screen replacement, battery replacement, etc.)
export const services = pgTable("services", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
  warranty: text("warranty"),
  repairTime: text("repair_time"),
  laborPrice: decimal("labor_price", { precision: 10, scale: 2 }).notNull().default("0"),
  partsMarkup: decimal("parts_markup", { precision: 5, scale: 2 }).notNull().default("1.0"),
  notes: text("notes"),
});

export const insertServiceSchema = createInsertSchema(services).omit({ id: true });
export type InsertService = z.infer<typeof insertServiceSchema>;
export type Service = typeof services.$inferSelect;

// Device-Service linking with optional parts
export const deviceServices = pgTable("device_services", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  deviceId: varchar("device_id").notNull().references(() => devices.id, { onDelete: "cascade" }),
  serviceId: varchar("service_id").notNull().references(() => services.id, { onDelete: "cascade" }),
  partId: varchar("part_id").references(() => parts.id, { onDelete: "set null" }),
});

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

// Quote requests from customers
export const quoteRequests = pgTable("quote_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  customerPhone: text("customer_phone"),
  deviceId: varchar("device_id").notNull().references(() => devices.id, { onDelete: "cascade" }),
  deviceServiceId: varchar("device_service_id").notNull().references(() => deviceServices.id, { onDelete: "cascade" }),
  quotedPrice: decimal("quoted_price", { precision: 10, scale: 2 }).notNull(),
  createdAt: text("created_at").notNull().default(sql`now()`),
});

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

// Extended types for frontend with relations
export type DeviceWithType = Device & { deviceType: DeviceType; brand: Brand | null };
export type BrandDeviceTypeWithRelations = BrandDeviceType & { brand: Brand; deviceType: DeviceType };
export type DeviceServiceWithRelations = DeviceService & { 
  device: Device & { deviceType?: DeviceType; brand?: Brand | null }; 
  service: Service; 
  part: Part | null;
};
