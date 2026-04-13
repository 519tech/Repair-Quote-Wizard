import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import { setDatabaseTokens, setErrorNotificationCallback, loadDbCacheIntoMemory } from "./mobilesentrix";
import { sendApiErrorNotification } from "./gmail";
import { logger } from "./logger";
import "./middleware";

import { registerAdminRoutes } from "./routes/admin";
import { registerDeviceRoutes } from "./routes/devices";
import { registerPartRoutes } from "./routes/parts";
import { registerServiceRoutes } from "./routes/services";
import { registerQuoteRoutes } from "./routes/quotes";
import { registerIntegrationRoutes } from "./routes/integrations";
import { registerSettingsRoutes } from "./routes/settings";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  registerObjectStorageRoutes(app);

  try {
    const accessToken = await storage.getMessageTemplate('mobilesentrix_access_token');
    const accessTokenSecret = await storage.getMessageTemplate('mobilesentrix_access_token_secret');
    if (accessToken?.content && accessTokenSecret?.content) {
      setDatabaseTokens(accessToken.content, accessTokenSecret.content);
    }
  } catch (error) {
  }

  await loadDbCacheIntoMemory();

  setErrorNotificationCallback((errorMessage, endpoint) => {
    sendApiErrorNotification('Mobilesentrix API', errorMessage, endpoint).catch(err => {
      logger.error('Failed to send API error notification', { error: String(err) });
    });
  });

  registerAdminRoutes(app);
  registerDeviceRoutes(app);
  registerPartRoutes(app);
  registerServiceRoutes(app);
  registerQuoteRoutes(app);
  registerIntegrationRoutes(app);
  registerSettingsRoutes(app);

  return httpServer;
}
