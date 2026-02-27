import type { Request, Response, NextFunction } from "express";
import multer from "multer";
import session from "express-session";
import { storage } from "./storage";

declare module "express-session" {
  interface SessionData {
    userId?: string;
    username?: string;
    isAdmin?: boolean;
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.isAdmin) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

export const upload = multer({
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

let deviceSearchCache: {
  devices: any[];
  brands: Map<string, any>;
  types: Map<string, any>;
  timestamp: number;
} | null = null;
const DEVICE_CACHE_TTL = 2 * 60 * 1000;

export async function getDeviceSearchData() {
  const now = Date.now();
  if (deviceSearchCache && (now - deviceSearchCache.timestamp) < DEVICE_CACHE_TTL) {
    return deviceSearchCache;
  }
  const [allDevices, allBrands, allTypes] = await Promise.all([
    storage.getDevices(),
    storage.getBrands(),
    storage.getDeviceTypes(),
  ]);
  deviceSearchCache = {
    devices: allDevices,
    brands: new Map(allBrands.map(b => [b.id, b])),
    types: new Map(allTypes.map(t => [t.id, t])),
    timestamp: now,
  };
  return deviceSearchCache;
}

export function invalidateDeviceSearchCache() {
  deviceSearchCache = null;
}
