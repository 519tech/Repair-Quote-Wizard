import { useState, useEffect, useRef, useContext, createContext } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Loader2, X, Wrench, Package, Store } from "lucide-react";
import type { DeviceServiceWithRelations, ServiceCategory } from "@shared/schema";

interface ShopBranding {
  name: string;
  logoUrl: string | null;
  brandColor: string | null;
}

interface ShopContextValue {
  shop: ShopBranding | null;
}

const ShopContext = createContext<ShopContextValue | null>(null);

function useOptionalShop(): ShopBranding | null {
  const context = useContext(ShopContext);
  return context?.shop ?? null;
}

export function InternalWithShop({ shop }: { shop: ShopBranding | null }) {
  return (
    <ShopContext.Provider value={{ shop }}>
      <Internal />
    </ShopContext.Provider>
  );
}

interface DeviceSearchResult {
  id: string;
  name: string;
  deviceTypeId: string;
  brandId: string | null;
  brand?: { id: string; name: string } | null;
  deviceType?: { id: string; name: string } | null;
}

interface QuoteData {
  serviceId: string;
  serviceName: string;
  serviceDescription?: string;
  categoryId?: string;
  categoryName?: string;
  deviceName: string;
  price: string;
  repairTime?: string;
  warranty?: string;
  isAvailable: boolean;
  partSku?: string;
  primaryPartSkus?: string[];
  additionalPartSkus?: string[];
}

export default function Internal() {
  const shopBranding = useOptionalShop();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<DeviceSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<DeviceSearchResult | null>(null);
  const [allQuotes, setAllQuotes] = useState<QuoteData[]>([]);
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [stockData, setStockData] = useState<Record<string, number>>({});
  const [stockLoading, setStockLoading] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: deviceServices = [], isLoading: servicesLoading } = useQuery<DeviceServiceWithRelations[]>({
    queryKey: [`/api/device-services/by-device/${selectedDevice?.id}`],
    enabled: !!selectedDevice,
  });

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    if (searchQuery.length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/devices/search?q=${encodeURIComponent(searchQuery)}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data);
        }
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery]);

  const fetchAllQuotes = async (services: DeviceServiceWithRelations[]) => {
    setQuotesLoading(true);
    setStockLoading(true);
    setAllQuotes([]);
    setStockData({});
    try {
      const quotes = await Promise.all(
        services.map(async (ds) => {
          try {
            const res = await fetch(`/api/calculate-quote/${ds.id}`);
            if (res.ok) {
              const data = await res.json();
              return {
                serviceId: ds.id,
                serviceName: data.serviceName,
                serviceDescription: data.serviceDescription,
                categoryId: ds.service.category?.id,
                categoryName: ds.service.category?.name,
                deviceName: data.deviceName,
                price: data.totalPrice,
                repairTime: data.repairTime,
                warranty: data.warranty,
                isAvailable: data.isAvailable ?? true,
                partSku: data.partSku,
                primaryPartSkus: data.primaryPartSkus || [],
                additionalPartSkus: data.additionalPartSkus || [],
              };
            }
          } catch {
            // Skip failed quotes
          }
          return null;
        })
      );
      const validQuotes = quotes.filter((q): q is NonNullable<typeof q> => q !== null);
      setAllQuotes(validQuotes);
      
      // Fetch stock status for all SKUs
      const allSkus = new Set<string>();
      validQuotes.forEach(q => {
        // Collect all primary part SKUs
        if (q.primaryPartSkus?.length) {
          q.primaryPartSkus.forEach(sku => allSkus.add(sku));
        }
        // Collect all secondary part SKUs
        if (q.additionalPartSkus?.length) {
          q.additionalPartSkus.forEach(sku => allSkus.add(sku));
        }
      });
      const skus = Array.from(allSkus);
      if (skus.length > 0) {
        fetch('/api/repairdesk/stock-enabled')
          .then(res => res.json())
          .then(({ enabled }) => {
            if (!enabled) {
              setStockLoading(false);
              return;
            }
            return fetch('/api/repairdesk/check-stock', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ skus }),
            });
          })
          .then(res => res?.ok ? res.json() : {})
          .then(stockInfo => stockInfo && setStockData(stockInfo))
          .catch(() => console.log('Stock check not available'))
          .finally(() => setStockLoading(false));
      } else {
        setStockLoading(false);
      }
    } finally {
      setQuotesLoading(false);
    }
  };

  useEffect(() => {
    if (deviceServices.length > 0) {
      fetchAllQuotes(deviceServices);
    }
  }, [deviceServices]);

  const handleSearchSelect = (device: DeviceSearchResult) => {
    setSelectedDevice(device);
    setSearchQuery("");
    setSearchResults([]);
  };

  const clearSelection = () => {
    setSelectedDevice(null);
    setAllQuotes([]);
    setStockData({});
    setSearchQuery("");
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const sortCategories = (categories: string[]) => {
    const priority = ["screen replacement", "battery replacement"];
    return categories.sort((a, b) => {
      const aLower = a.toLowerCase();
      const bLower = b.toLowerCase();
      const aIndex = priority.findIndex(p => aLower.includes(p));
      const bIndex = priority.findIndex(p => bLower.includes(p));
      
      if (aIndex !== -1 && bIndex !== -1) {
        return aIndex - bIndex;
      }
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      return a.localeCompare(b);
    });
  };

  const groupedQuotes = () => {
    const groups: Record<string, QuoteData[]> = {};
    
    allQuotes.forEach(quote => {
      const categoryName = quote.categoryName || "Other Services";
      if (!groups[categoryName]) {
        groups[categoryName] = [];
      }
      groups[categoryName].push(quote);
    });

    Object.keys(groups).forEach(key => {
      groups[key].sort((a, b) => {
        if (a.isAvailable !== b.isAvailable) {
          return a.isAvailable ? -1 : 1;
        }
        return parseFloat(a.price) - parseFloat(b.price);
      });
    });

    const sortedCategories = sortCategories(Object.keys(groups));
    
    return sortedCategories.map(categoryName => ({
      categoryName,
      quotes: groups[categoryName],
    }));
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-primary" />
            <span className="font-semibold">Counter Lookup</span>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-4xl">
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search device model..."
              className="pl-10 pr-10 h-14 text-lg"
              data-testid="input-internal-search"
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                onClick={() => setSearchQuery("")}
                data-testid="button-clear-internal-search"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>

          {searchQuery.length >= 2 && (
            <div className="mt-2 border rounded-lg max-h-80 overflow-y-auto bg-card shadow-lg">
              {searchLoading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : searchResults.length === 0 ? (
                <p className="text-center py-6 text-muted-foreground">No devices found</p>
              ) : (
                <div className="p-2 space-y-1">
                  {searchResults.map((device) => (
                    <Button
                      key={device.id}
                      variant="ghost"
                      className="w-full justify-start text-left h-auto py-3 hover-elevate"
                      onClick={() => handleSearchSelect(device)}
                      data-testid={`button-internal-result-${device.id}`}
                    >
                      <div>
                        <div className="font-medium text-base">{device.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {device.brand?.name || "Unknown Brand"} · {device.deviceType?.name || "Unknown Type"}
                        </div>
                      </div>
                    </Button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {selectedDevice && (
          <div className="space-y-6">
            <Card>
              <CardHeader className="py-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <CardTitle className="text-xl">{selectedDevice.name}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {selectedDevice.brand?.name} · {selectedDevice.deviceType?.name}
                    </p>
                  </div>
                  <Button variant="outline" onClick={clearSelection} data-testid="button-clear-device">
                    <X className="h-4 w-4 mr-2" />
                    Clear
                  </Button>
                </div>
              </CardHeader>
            </Card>

            {(servicesLoading || quotesLoading) ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : allQuotes.length === 0 ? (
              <Card>
                <CardContent className="py-8">
                  <p className="text-center text-muted-foreground">No services available for this device.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {groupedQuotes().map(({ categoryName, quotes }) => (
                  <Card key={categoryName}>
                    <CardHeader className="py-3 border-b">
                      <CardTitle className="text-lg">{categoryName}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="divide-y">
                        {quotes.map((quote) => (
                          <div 
                            key={quote.serviceId} 
                            className={`p-4 flex items-center justify-between gap-4 ${!quote.isAvailable ? 'opacity-50 bg-muted/30' : ''}`}
                            data-testid={`internal-quote-${quote.serviceId}`}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="font-medium">{quote.serviceName}</div>
                              {quote.serviceDescription && (
                                <p className="text-sm text-muted-foreground truncate">{quote.serviceDescription}</p>
                              )}
                              {quote.isAvailable && (quote.repairTime || quote.warranty) && (
                                <div className="flex flex-wrap gap-2 mt-1">
                                  {quote.repairTime && (
                                    <Badge variant="secondary" className="text-xs">{quote.repairTime}</Badge>
                                  )}
                                  {quote.warranty && (
                                    <Badge variant="secondary" className="text-xs">{quote.warranty} warranty</Badge>
                                  )}
                                </div>
                              )}
                              {quote.isAvailable && (quote.primaryPartSkus?.length || 0) > 0 && (
                                <div className="mt-1">
                                  {stockLoading ? (
                                    <Badge variant="secondary" className="text-xs">
                                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                      Checking stock...
                                    </Badge>
                                  ) : (() => {
                                    // For primary parts: ANY in stock = show "In Stock"
                                    const anyPrimaryInStock = quote.primaryPartSkus?.some(sku => stockData[sku] && stockData[sku] > 0);
                                    // For secondary parts: ALL must be in stock (if any exist)
                                    const allSecondaryInStock = !quote.additionalPartSkus?.length || 
                                      quote.additionalPartSkus.every(sku => stockData[sku] && stockData[sku] > 0);
                                    
                                    if (Object.keys(stockData).length === 0) return null;
                                    
                                    if (anyPrimaryInStock && allSecondaryInStock) {
                                      return (
                                        <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                          <Package className="h-3 w-3 mr-1" />
                                          In Stock
                                        </Badge>
                                      );
                                    } else {
                                      return (
                                        <Badge variant="secondary" className="text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 whitespace-normal text-left">
                                          <Package className="h-3 w-3 mr-1 shrink-0" />
                                          Out of stock, parts order may be required. Contact us for confirmation
                                        </Badge>
                                      );
                                    }
                                  })()}
                                </div>
                              )}
                            </div>
                            <div className="text-right shrink-0">
                              {quote.isAvailable ? (
                                <span className="text-xl font-bold text-primary">${quote.price}</span>
                              ) : (
                                <span className="text-sm font-medium text-muted-foreground">Not Available</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {!selectedDevice && searchQuery.length < 2 && (
          <div className="text-center py-16 text-muted-foreground">
            <Search className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg">Search for a device to view all repair services</p>
          </div>
        )}
      </main>
    </div>
  );
}
