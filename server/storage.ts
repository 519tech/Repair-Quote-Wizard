import {
  deviceTypes,
  devices,
  parts,
  services,
  deviceServices,
  quoteRequests,
  type DeviceType,
  type InsertDeviceType,
  type Device,
  type InsertDevice,
  type Part,
  type InsertPart,
  type Service,
  type InsertService,
  type DeviceService,
  type InsertDeviceService,
  type QuoteRequest,
  type InsertQuoteRequest,
  type DeviceServiceWithRelations,
} from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

export interface IStorage {
  // Device Types
  getDeviceTypes(): Promise<DeviceType[]>;
  getDeviceType(id: string): Promise<DeviceType | undefined>;
  createDeviceType(data: InsertDeviceType): Promise<DeviceType>;
  updateDeviceType(id: string, data: Partial<InsertDeviceType>): Promise<DeviceType | undefined>;
  deleteDeviceType(id: string): Promise<void>;

  // Devices
  getDevices(): Promise<Device[]>;
  getDevicesByType(typeId: string): Promise<Device[]>;
  getDevice(id: string): Promise<Device | undefined>;
  createDevice(data: InsertDevice): Promise<Device>;
  updateDevice(id: string, data: Partial<InsertDevice>): Promise<Device | undefined>;
  deleteDevice(id: string): Promise<void>;

  // Parts
  getParts(): Promise<Part[]>;
  getPart(id: string): Promise<Part | undefined>;
  getPartBySku(sku: string): Promise<Part | undefined>;
  createPart(data: InsertPart): Promise<Part>;
  updatePart(id: string, data: Partial<InsertPart>): Promise<Part | undefined>;
  deletePart(id: string): Promise<void>;

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

  // Devices
  async getDevices(): Promise<Device[]> {
    return db.select().from(devices);
  }

  async getDevicesByType(typeId: string): Promise<Device[]> {
    return db.select().from(devices).where(eq(devices.deviceTypeId, typeId));
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
        device: true,
        service: true,
        part: true,
      },
    });
    return results;
  }

  async getDeviceServicesByDevice(deviceId: string): Promise<DeviceServiceWithRelations[]> {
    const results = await db.query.deviceServices.findMany({
      where: eq(deviceServices.deviceId, deviceId),
      with: {
        device: true,
        service: true,
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
        service: true,
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
}

export const storage = new DatabaseStorage();
