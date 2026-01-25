import { db } from "./db";
import { repairDeskTokens } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

const REPAIRDESK_API_BASE = "https://api.repairdesk.co";
const REPAIRDESK_OAUTH_BASE = "https://api.repairdesk.co/v1/oauth2";

interface RepairDeskToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

interface InventoryItem {
  sku: string;
  name: string;
  quantity: number;
  store_id?: string;
}

export function getRepairDeskAuthUrl(redirectUri: string, state: string): string {
  const clientId = process.env.REPAIRDESK_CLIENT_ID;
  if (!clientId) {
    throw new Error("REPAIRDESK_CLIENT_ID is not configured");
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    state: state,
  });

  return `${REPAIRDESK_OAUTH_BASE}/authorize?${params.toString()}`;
}

export async function exchangeCodeForToken(code: string, redirectUri: string): Promise<RepairDeskToken> {
  const clientId = process.env.REPAIRDESK_CLIENT_ID;
  const clientSecret = process.env.REPAIRDESK_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("RepairDesk credentials not configured");
  }

  const response = await fetch(`${REPAIRDESK_OAUTH_BASE}/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code: code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to exchange code for token: ${error}`);
  }

  const data = await response.json();
  const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();

  const token: RepairDeskToken = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: expiresAt,
  };

  await db.delete(repairDeskTokens);
  await db.insert(repairDeskTokens).values({
    accessToken: token.accessToken,
    refreshToken: token.refreshToken,
    expiresAt: token.expiresAt,
  });

  return token;
}

export async function getStoredToken(): Promise<RepairDeskToken | null> {
  const tokens = await db.select().from(repairDeskTokens).orderBy(desc(repairDeskTokens.createdAt)).limit(1);
  
  if (tokens.length === 0) {
    return null;
  }

  const token = tokens[0];
  return {
    accessToken: token.accessToken,
    refreshToken: token.refreshToken,
    expiresAt: token.expiresAt,
  };
}

export async function refreshAccessToken(): Promise<RepairDeskToken | null> {
  const currentToken = await getStoredToken();
  if (!currentToken) {
    return null;
  }

  const clientId = process.env.REPAIRDESK_CLIENT_ID;
  const clientSecret = process.env.REPAIRDESK_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("RepairDesk credentials not configured");
  }

  const response = await fetch(`${REPAIRDESK_OAUTH_BASE}/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      grant_type: "refresh_token",
      refresh_token: currentToken.refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!response.ok) {
    await db.delete(repairDeskTokens);
    return null;
  }

  const data = await response.json();
  const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();

  const token: RepairDeskToken = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: expiresAt,
  };

  await db.delete(repairDeskTokens);
  await db.insert(repairDeskTokens).values({
    accessToken: token.accessToken,
    refreshToken: token.refreshToken,
    expiresAt: token.expiresAt,
  });

  return token;
}

async function getValidToken(): Promise<string | null> {
  let token = await getStoredToken();
  if (!token) {
    return null;
  }

  const expiresAt = new Date(token.expiresAt);
  const now = new Date();
  const fiveMinutes = 5 * 60 * 1000;

  if (expiresAt.getTime() - now.getTime() < fiveMinutes) {
    token = await refreshAccessToken();
    if (!token) {
      return null;
    }
  }

  return token.accessToken;
}

export async function checkInventoryBySku(skus: string[]): Promise<Map<string, number>> {
  const stockMap = new Map<string, number>();

  if (skus.length === 0) {
    return stockMap;
  }

  const accessToken = await getValidToken();
  if (!accessToken) {
    console.log("No valid RepairDesk token available");
    return stockMap;
  }

  try {
    const response = await fetch(`${REPAIRDESK_API_BASE}/api/web/v1/inventory`, {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.error("Failed to fetch inventory from RepairDesk:", response.status);
      return stockMap;
    }

    const data = await response.json();
    const items: InventoryItem[] = data.data || data || [];

    for (const item of items) {
      if (item.sku && skus.includes(item.sku)) {
        const currentQty = stockMap.get(item.sku) || 0;
        stockMap.set(item.sku, currentQty + (item.quantity || 0));
      }
    }
  } catch (error) {
    console.error("Error checking RepairDesk inventory:", error);
  }

  return stockMap;
}

export async function isRepairDeskConnected(): Promise<boolean> {
  const token = await getStoredToken();
  return token !== null;
}

export async function disconnectRepairDesk(): Promise<void> {
  const token = await getStoredToken();
  
  if (token) {
    const clientId = process.env.REPAIRDESK_CLIENT_ID;
    const clientSecret = process.env.REPAIRDESK_CLIENT_SECRET;

    if (clientId && clientSecret) {
      try {
        await fetch(`${REPAIRDESK_OAUTH_BASE}/revoke`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            token: token.accessToken,
            token_type_hint: "access_token",
            client_id: clientId,
            client_secret: clientSecret,
          }),
        });
      } catch (error) {
        console.error("Error revoking RepairDesk token:", error);
      }
    }
  }

  await db.delete(repairDeskTokens);
}
