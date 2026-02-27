import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import { setDatabaseTokens, setErrorNotificationCallback } from "./mobilesentrix";
import { sendApiErrorNotification } from "./gmail";
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
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    tableName: "sessions",
  });

  app.set("trust proxy", 1);
  app.use(session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET || "dev-only-secret-not-for-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  }));

  registerObjectStorageRoutes(app);

  try {
    const accessToken = await storage.getMessageTemplate('mobilesentrix_access_token');
    const accessTokenSecret = await storage.getMessageTemplate('mobilesentrix_access_token_secret');
    if (accessToken?.content && accessTokenSecret?.content) {
      setDatabaseTokens(accessToken.content, accessTokenSecret.content);
      console.log('Mobilesentrix tokens loaded from database');
    }
  } catch (error) {
    console.log('No Mobilesentrix tokens found in database, will use environment variables if available');
  }

  setErrorNotificationCallback((errorMessage, endpoint) => {
    sendApiErrorNotification('Mobilesentrix API', errorMessage, endpoint).catch(err => {
      console.error('Failed to send API error notification:', err);
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
