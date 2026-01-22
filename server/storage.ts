import {
  deviceTypes,
  devices,
  parts,
  services,
  serviceCategories,
  deviceServices,
  quoteRequests,
  unknownDeviceQuotes,
  brands,
  brandDeviceTypes,
  brandServiceCategories,
  messageTemplates,
  type DeviceType,
  type InsertDeviceType,
  type Device,
  type InsertDevice,
  type Part,
  type InsertPart,
  type Service,
  type InsertService,
  type ServiceCategory,
  type InsertServiceCategory,
  type DeviceService,
  type InsertDeviceService,
  type QuoteRequest,
  type InsertQuoteRequest,
  type UnknownDeviceQuote,
  type InsertUnknownDeviceQuote,
  type DeviceServiceWithRelations,
  type Brand,
  type InsertBrand,
  type BrandDeviceType,
  type InsertBrandDeviceType,
  type BrandDeviceTypeWithRelations,
  type BrandServiceCategory,
  type InsertBrandServiceCategory,
  type BrandServiceCategoryWithRelations,
  type MessageTemplate,
  type InsertMessageTemplate,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, ilike, sql } from "drizzle-orm";

export interface IStorage {
  // Device Types
  getDeviceTypes(): Promise<DeviceType[]>;
  getDeviceType(id: string): Promise<DeviceType | undefined>;
  createDeviceType(data: InsertDeviceType): Promise<DeviceType>;
  updateDeviceType(id: string, data: Partial<InsertDeviceType>): Promise<DeviceType | undefined>;
  deleteDeviceType(id: string): Promise<void>;

  // Brands
  getBrands(): Promise<Brand[]>;
  getBrand(id: string): Promise<Brand | undefined>;
  createBrand(data: InsertBrand): Promise<Brand>;
  updateBrand(id: string, data: Partial<InsertBrand>): Promise<Brand | undefined>;
  deleteBrand(id: string): Promise<void>;

  // Brand-DeviceType Links
  getBrandDeviceTypes(): Promise<BrandDeviceTypeWithRelations[]>;
  getBrandsByDeviceType(deviceTypeId: string): Promise<Brand[]>;
  createBrandDeviceType(data: InsertBrandDeviceType): Promise<BrandDeviceType>;
  deleteBrandDeviceType(id: string): Promise<void>;

  // Brand-ServiceCategory Links
  getBrandServiceCategories(): Promise<BrandServiceCategoryWithRelations[]>;
  getCategoriesByBrand(brandId: string): Promise<ServiceCategory[]>;
  createBrandServiceCategory(data: InsertBrandServiceCategory): Promise<BrandServiceCategory>;
  deleteBrandServiceCategory(id: string): Promise<void>;

  // Devices
  getDevices(): Promise<Device[]>;
  getDevicesByType(typeId: string): Promise<Device[]>;
  getDevicesByTypeAndBrand(typeId: string, brandId: string): Promise<Device[]>;
  getDevice(id: string): Promise<Device | undefined>;
  createDevice(data: InsertDevice): Promise<Device>;
  updateDevice(id: string, data: Partial<InsertDevice>): Promise<Device | undefined>;
  deleteDevice(id: string): Promise<void>;

  // Parts
  getParts(): Promise<Part[]>;
  getPartsPaginated(options: { page: number; limit: number; search?: string }): Promise<{ parts: Part[]; total: number }>;
  getPart(id: string): Promise<Part | undefined>;
  getPartBySku(sku: string): Promise<Part | undefined>;
  deleteAllParts(): Promise<void>;
  createPart(data: InsertPart): Promise<Part>;
  updatePart(id: string, data: Partial<InsertPart>): Promise<Part | undefined>;
  deletePart(id: string): Promise<void>;
  bulkUpsertParts(partsData: InsertPart[]): Promise<{ inserted: number; updated: number }>;

  // Service Categories
  getServiceCategories(): Promise<ServiceCategory[]>;
  getServiceCategory(id: string): Promise<ServiceCategory | undefined>;
  createServiceCategory(data: InsertServiceCategory): Promise<ServiceCategory>;
  updateServiceCategory(id: string, data: Partial<InsertServiceCategory>): Promise<ServiceCategory | undefined>;
  deleteServiceCategory(id: string): Promise<void>;

  // Services
  getServices(): Promise<Service[]>;
  getService(id: string): Promise<Service | undefined>;
  createService(data: InsertService): Promise<Service>;
  updateService(id: string, data: Partial<InsertService>): Promise<Service | undefined>;
  deleteService(id: string): Promise<void>;

  // Device Services (links)
  getDeviceServices(): Promise<DeviceServiceWithRelations[]>;
  getDeviceServicesByDevice(deviceId: string): Promise<DeviceServiceWithRelations[]>;
  getDeviceService(id: string): Promise<DeviceService | undefined>;
  getDeviceServiceWithRelations(id: string): Promise<DeviceServiceWithRelations | undefined>;
  createDeviceService(data: InsertDeviceService): Promise<DeviceService>;
  updateDeviceService(id: string, data: Partial<InsertDeviceService>): Promise<DeviceService | undefined>;
  deleteDeviceService(id: string): Promise<void>;

  // Quote Requests
  getQuoteRequests(): Promise<QuoteRequest[]>;
  createQuoteRequest(data: InsertQuoteRequest): Promise<QuoteRequest>;

  // Unknown Device Quotes
  getUnknownDeviceQuotes(): Promise<UnknownDeviceQuote[]>;
  createUnknownDeviceQuote(data: InsertUnknownDeviceQuote): Promise<UnknownDeviceQuote>;

  // Message Templates
  getMessageTemplates(): Promise<MessageTemplate[]>;
  getMessageTemplate(type: string): Promise<MessageTemplate | undefined>;
  upsertMessageTemplate(data: InsertMessageTemplate): Promise<MessageTemplate>;
}

export class DatabaseStorage implements IStorage {
  // Device Types
  async getDeviceTypes(): Promise<DeviceType[]> {
    return db.select().from(deviceTypes);
  }

  async getDeviceType(id: string): Promise<DeviceType | undefined> {
    const [type] = await db.select().from(deviceTypes).where(eq(deviceTypes.id, id));
    return type || undefined;
  }

  async createDeviceType(data: InsertDeviceType): Promise<DeviceType> {
    const [type] = await db.insert(deviceTypes).values(data).returning();
    return type;
  }

  async updateDeviceType(id: string, data: Partial<InsertDeviceType>): Promise<DeviceType | undefined> {
    const [type] = await db.update(deviceTypes).set(data).where(eq(deviceTypes.id, id)).returning();
    return type || undefined;
  }

  async deleteDeviceType(id: string): Promise<void> {
    await db.delete(deviceTypes).where(eq(deviceTypes.id, id));
  }

  // Brands
  async getBrands(): Promise<Brand[]> {
    return db.select().from(brands);
  }

  async getBrand(id: string): Promise<Brand | undefined> {
    const [brand] = await db.select().from(brands).where(eq(brands.id, id));
    return brand || undefined;
  }

  async createBrand(data: InsertBrand): Promise<Brand> {
    const [brand] = await db.insert(brands).values(data).returning();
    return brand;
  }

  async updateBrand(id: string, data: Partial<InsertBrand>): Promise<Brand | undefined> {
    const [brand] = await db.update(brands).set(data).where(eq(brands.id, id)).returning();
    return brand || undefined;
  }

  async deleteBrand(id: string): Promise<void> {
    await db.delete(brands).where(eq(brands.id, id));
  }

  // Brand-DeviceType Links
  async getBrandDeviceTypes(): Promise<BrandDeviceTypeWithRelations[]> {
    const results = await db.query.brandDeviceTypes.findMany({
      with: {
        brand: true,
        deviceType: true,
      },
    });
    return results;
  }

  async getBrandsByDeviceType(deviceTypeId: string): Promise<Brand[]> {
    const links = await db.query.brandDeviceTypes.findMany({
      where: eq(brandDeviceTypes.deviceTypeId, deviceTypeId),
      with: {
        brand: true,
      },
    });
    return links.map((link) => link.brand);
  }

  async createBrandDeviceType(data: InsertBrandDeviceType): Promise<BrandDeviceType> {
    const [link] = await db.insert(brandDeviceTypes).values(data).returning();
    return link;
  }

  async deleteBrandDeviceType(id: string): Promise<void> {
    await db.delete(brandDeviceTypes).where(eq(brandDeviceTypes.id, id));
  }

  // Brand-ServiceCategory Links
  async getBrandServiceCategories(): Promise<BrandServiceCategoryWithRelations[]> {
    const results = await db.query.brandServiceCategories.findMany({
      with: {
        brand: true,
        category: true,
      },
    });
    return results;
  }

  async getCategoriesByBrand(brandId: string): Promise<ServiceCategory[]> {
    const links = await db.query.brandServiceCategories.findMany({
      where: eq(brandServiceCategories.brandId, brandId),
      with: {
        category: true,
      },
    });
    return links.map((link) => link.category);
  }

  async createBrandServiceCategory(data: InsertBrandServiceCategory): Promise<BrandServiceCategory> {
    const [link] = await db.insert(brandServiceCategories).values(data).returning();
    return link;
  }

  async deleteBrandServiceCategory(id: string): Promise<void> {
    await db.delete(brandServiceCategories).where(eq(brandServiceCategories.id, id));
  }

  // Devices
  async getDevices(): Promise<Device[]> {
    return db.select().from(devices);
  }

  async getDevicesByType(typeId: string): Promise<Device[]> {
    return db.select().from(devices).where(eq(devices.deviceTypeId, typeId));
  }

  async getDevicesByTypeAndBrand(typeId: string, brandId: string): Promise<Device[]> {
    return db.select().from(devices).where(
      and(eq(devices.deviceTypeId, typeId), eq(devices.brandId, brandId))
    );
  }

  async getDevice(id: string): Promise<Device | undefined> {
    const [device] = await db.select().from(devices).where(eq(devices.id, id));
    return device || undefined;
  }

  async createDevice(data: InsertDevice): Promise<Device> {
    const [device] = await db.insert(devices).values(data).returning();
    return device;
  }

  async updateDevice(id: string, data: Partial<InsertDevice>): Promise<Device | undefined> {
    const [device] = await db.update(devices).set(data).where(eq(devices.id, id)).returning();
    return device || undefined;
  }

  async deleteDevice(id: string): Promise<void> {
    await db.delete(devices).where(eq(devices.id, id));
  }

  // Parts
  async getParts(): Promise<Part[]> {
    return db.select().from(parts);
  }

  async getPartsPaginated(options: { page: number; limit: number; search?: string }): Promise<{ parts: Part[]; total: number }> {
    const { page, limit, search } = options;
    const offset = (page - 1) * limit;
    
    let query = db.select().from(parts);
    let countQuery = db.select({ count: sql<number>`count(*)` }).from(parts);
    
    if (search) {
      const searchPattern = `%${search}%`;
      query = query.where(or(
        ilike(parts.sku, searchPattern),
        ilike(parts.name, searchPattern)
      )) as typeof query;
      countQuery = countQuery.where(or(
        ilike(parts.sku, searchPattern),
        ilike(parts.name, searchPattern)
      )) as typeof countQuery;
    }
    
    const [countResult] = await countQuery;
    const total = Number(countResult?.count || 0);
    
    const result = await query.orderBy(parts.sku).limit(limit).offset(offset);
    
    return { parts: result, total };
  }

  async deleteAllParts(): Promise<void> {
    await db.delete(parts);
  }

  async getPart(id: string): Promise<Part | undefined> {
    const [part] = await db.select().from(parts).where(eq(parts.id, id));
    return part || undefined;
  }

  async getPartBySku(sku: string): Promise<Part | undefined> {
    const [part] = await db.select().from(parts).where(eq(parts.sku, sku));
    return part || undefined;
  }

  async createPart(data: InsertPart): Promise<Part> {
    const [part] = await db.insert(parts).values(data).returning();
    return part;
  }

  async updatePart(id: string, data: Partial<InsertPart>): Promise<Part | undefined> {
    const [part] = await db.update(parts).set(data).where(eq(parts.id, id)).returning();
    return part || undefined;
  }

  async deletePart(id: string): Promise<void> {
    await db.delete(parts).where(eq(parts.id, id));
  }

  async bulkUpsertParts(partsData: InsertPart[]): Promise<{ inserted: number; updated: number }> {
    let inserted = 0;
    let updated = 0;
    
    for (const partData of partsData) {
      const existing = await this.getPartBySku(partData.sku);
      if (existing) {
        await db.update(parts).set({ name: partData.name, price: partData.price }).where(eq(parts.sku, partData.sku));
        updated++;
      } else {
        await db.insert(parts).values(partData);
        inserted++;
      }
    }
    
    return { inserted, updated };
  }

  // Service Categories
  async getServiceCategories(): Promise<ServiceCategory[]> {
    return db.select().from(serviceCategories);
  }

  async getServiceCategory(id: string): Promise<ServiceCategory | undefined> {
    const [category] = await db.select().from(serviceCategories).where(eq(serviceCategories.id, id));
    return category || undefined;
  }

  async createServiceCategory(data: InsertServiceCategory): Promise<ServiceCategory> {
    const [category] = await db.insert(serviceCategories).values(data).returning();
    return category;
  }

  async updateServiceCategory(id: string, data: Partial<InsertServiceCategory>): Promise<ServiceCategory | undefined> {
    const [category] = await db.update(serviceCategories).set(data).where(eq(serviceCategories.id, id)).returning();
    return category || undefined;
  }

  async deleteServiceCategory(id: string): Promise<void> {
    await db.delete(serviceCategories).where(eq(serviceCategories.id, id));
  }

  // Services
  async getServices(): Promise<Service[]> {
    return db.select().from(services);
  }

  async getService(id: string): Promise<Service | undefined> {
    const [service] = await db.select().from(services).where(eq(services.id, id));
    return service || undefined;
  }

  async createService(data: InsertService): Promise<Service> {
    const [service] = await db.insert(services).values(data).returning();
    return service;
  }

  async updateService(id: string, data: Partial<InsertService>): Promise<Service | undefined> {
    const [service] = await db.update(services).set(data).where(eq(services.id, id)).returning();
    return service || undefined;
  }

  async deleteService(id: string): Promise<void> {
    await db.delete(services).where(eq(services.id, id));
  }

  // Device Services (links)
  async getDeviceServices(): Promise<DeviceServiceWithRelations[]> {
    const results = await db.query.deviceServices.findMany({
      with: {
        device: {
          with: {
            deviceType: true,
            brand: true,
          },
        },
        service: {
          with: {
            category: true,
          },
        },
        part: true,
      },
    });
    return results;
  }

  async getDeviceServicesByDevice(deviceId: string): Promise<DeviceServiceWithRelations[]> {
    const results = await db.query.deviceServices.findMany({
      where: eq(deviceServices.deviceId, deviceId),
      with: {
        device: {
          with: {
            deviceType: true,
            brand: true,
          },
        },
        service: {
          with: {
            category: true,
          },
        },
        part: true,
      },
    });
    return results;
  }

  async getDeviceService(id: string): Promise<DeviceService | undefined> {
    const [ds] = await db.select().from(deviceServices).where(eq(deviceServices.id, id));
    return ds || undefined;
  }

  async createDeviceService(data: InsertDeviceService): Promise<DeviceService> {
    const [ds] = await db.insert(deviceServices).values(data).returning();
    return ds;
  }

  async getDeviceServiceWithRelations(id: string): Promise<DeviceServiceWithRelations | undefined> {
    const result = await db.query.deviceServices.findFirst({
      where: eq(deviceServices.id, id),
      with: {
        device: true,
        service: {
          with: {
            category: true,
          },
        },
        part: true,
      },
    });
    return result || undefined;
  }

  async updateDeviceService(id: string, data: Partial<InsertDeviceService>): Promise<DeviceService | undefined> {
    const [ds] = await db.update(deviceServices).set(data).where(eq(deviceServices.id, id)).returning();
    return ds || undefined;
  }

  async deleteDeviceService(id: string): Promise<void> {
    await db.delete(deviceServices).where(eq(deviceServices.id, id));
  }

  // Quote Requests
  async getQuoteRequests(): Promise<QuoteRequest[]> {
    return db.select().from(quoteRequests);
  }

  async createQuoteRequest(data: InsertQuoteRequest): Promise<QuoteRequest> {
    const [quote] = await db.insert(quoteRequests).values(data).returning();
    return quote;
  }

  // Unknown Device Quotes
  async getUnknownDeviceQuotes(): Promise<UnknownDeviceQuote[]> {
    return db.select().from(unknownDeviceQuotes);
  }

  async createUnknownDeviceQuote(data: InsertUnknownDeviceQuote): Promise<UnknownDeviceQuote> {
    const [quote] = await db.insert(unknownDeviceQuotes).values(data).returning();
    return quote;
  }

  // Message Templates
  async getMessageTemplates(): Promise<MessageTemplate[]> {
    return db.select().from(messageTemplates);
  }

  async getMessageTemplate(type: string): Promise<MessageTemplate | undefined> {
    const [template] = await db.select().from(messageTemplates).where(eq(messageTemplates.type, type));
    return template || undefined;
  }

  async upsertMessageTemplate(data: InsertMessageTemplate): Promise<MessageTemplate> {
    const existing = await this.getMessageTemplate(data.type);
    if (existing) {
      const [updated] = await db.update(messageTemplates).set({ content: data.content }).where(eq(messageTemplates.type, data.type)).returning();
      return updated;
    }
    const [template] = await db.insert(messageTemplates).values(data).returning();
    return template;
  }
}

export const storage = new DatabaseStorage();
