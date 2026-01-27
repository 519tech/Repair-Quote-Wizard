import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

interface ShopSettings {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  logoUrl: string | null;
  brandColor: string | null;
  quoteSettings: {
    roundPrices?: boolean;
    hidePrices?: boolean;
    discountPercentage?: number;
  } | null;
}

interface ShopContextType {
  shop: ShopSettings | null;
  isLoading: boolean;
  error: Error | null;
  slug: string;
}

const ShopContext = createContext<ShopContextType | null>(null);

export function ShopProvider({ 
  children, 
  slug 
}: { 
  children: ReactNode; 
  slug: string;
}) {
  const { data: shop, isLoading, error } = useQuery<ShopSettings>({
    queryKey: ["/api/shops/by-slug", slug],
    queryFn: async () => {
      const response = await fetch(`/api/shops/by-slug/${slug}`);
      if (!response.ok) {
        throw new Error("Shop not found");
      }
      return response.json();
    },
    enabled: !!slug,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (shop?.brandColor) {
      document.documentElement.style.setProperty("--shop-brand-color", shop.brandColor);
    }
  }, [shop?.brandColor]);

  return (
    <ShopContext.Provider value={{ shop: shop ?? null, isLoading, error: error as Error | null, slug }}>
      {children}
    </ShopContext.Provider>
  );
}

export function useShop() {
  const context = useContext(ShopContext);
  if (!context) {
    throw new Error("useShop must be used within a ShopProvider");
  }
  return context;
}
