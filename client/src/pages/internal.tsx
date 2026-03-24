import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Loader2, X, Wrench, Package, FileText, Eye, Mail, Phone, Clock, Lock, LogOut, Send } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { DeviceServiceWithRelations } from "@shared/schema";

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
  bypassMultiDiscount?: boolean;
}

type Submission = {
  id: string;
  type: 'quote' | 'unknown';
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  deviceName?: string;
  serviceName?: string;
  quotedPrice?: string;
  deviceServiceId?: string;
  deviceDescription?: string;
  issueDescription?: string;
  notes?: string | null;
  createdAt: string;
};

type QuoteViewEntry = {
  id: string;
  deviceId: string;
  deviceServiceId: string;
  serviceName: string;
  deviceName: string;
  calculatedPrice: string;
  viewedAt: string;
};

function formatDate(dateStr: string) {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

function CounterLookupTab() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<DeviceSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<DeviceSearchResult | null>(null);
  const [allQuotes, setAllQuotes] = useState<QuoteData[]>([]);
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [stockData, setStockData] = useState<Record<string, number>>({});
  const [stockLoading, setStockLoading] = useState(false);
  const [selectedServiceIds, setSelectedServiceIds] = useState<Set<string>>(new Set());
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const { data: deviceServices = [], isLoading: servicesLoading } = useQuery<DeviceServiceWithRelations[]>({
    queryKey: [`/api/device-services/by-device/${selectedDevice?.id}`],
    enabled: !!selectedDevice,
  });

  const { data: serviceCategoriesData = [] } = useQuery<{ id: string; name: string; displayOrder: number }[]>({
    queryKey: ["/api/service-categories"],
  });

  const { data: quoteFlowSettings } = useQuery<{ multiDiscount: { enabled: boolean; amount: number } }>({
    queryKey: ["/api/settings/quote-flow"],
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
    }, 200);
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
                bypassMultiDiscount: data.bypassMultiDiscount || false,
              };
            }
          } catch {}
          return null;
        })
      );
      const validQuotes = quotes.filter((q): q is NonNullable<typeof q> => q !== null);
      setAllQuotes(validQuotes);

      const allSkus = new Set<string>();
      validQuotes.forEach(q => {
        if (q.primaryPartSkus?.length) {
          q.primaryPartSkus.forEach((sku: string) => allSkus.add(sku));
        }
        if (q.additionalPartSkus?.length) {
          q.additionalPartSkus.forEach((sku: string) => allSkus.add(sku));
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
          .catch(() => {})
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
    fetch('/api/prefetch-category-parts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: device.id }),
    }).catch(() => {});
  };

  const clearSelection = () => {
    setSelectedDevice(null);
    setAllQuotes([]);
    setStockData({});
    setSearchQuery("");
    setSelectedServiceIds(new Set());
    setCustomerName("");
    setCustomerEmail("");
    setCustomerPhone("");
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const toggleService = (serviceId: string) => {
    setSelectedServiceIds(prev => {
      const next = new Set(prev);
      if (next.has(serviceId)) {
        next.delete(serviceId);
      } else {
        next.add(serviceId);
      }
      return next;
    });
  };

  const selectedQuotes = allQuotes.filter(q => selectedServiceIds.has(q.serviceId) && q.isAvailable);
  const subtotal = selectedQuotes.reduce((sum, q) => sum + parseFloat(q.price), 0);
  const multiDiscountSettings = quoteFlowSettings?.multiDiscount;
  const eligibleCount = selectedQuotes.filter(q => !q.bypassMultiDiscount).length;
  const multiServiceDiscount = (multiDiscountSettings?.enabled && eligibleCount >= 2) ? (multiDiscountSettings.amount || 0) : 0;
  const grandTotal = subtotal - multiServiceDiscount;

  const submitQuoteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/quote-requests/combined", {
        customerName,
        customerEmail: customerEmail || undefined,
        customerPhone: customerPhone || undefined,
        deviceId: selectedDevice!.id,
        deviceServiceIds: selectedQuotes.map(q => q.serviceId),
        multiServiceDiscount: multiServiceDiscount > 0 ? multiServiceDiscount : undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/internal/submissions"] });
      setSelectedServiceIds(new Set());
      setCustomerName("");
      setCustomerEmail("");
      setCustomerPhone("");
      toast({
        title: "Quote sent",
        description: "The quote has been sent to the customer successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send quote",
        variant: "destructive",
      });
    },
  });

  const groupedQuotes = () => {
    const groups: Record<string, { categoryName: string; quotes: QuoteData[] }> = {};
    allQuotes.forEach(quote => {
      const categoryId = quote.categoryId || "other";
      const categoryName = quote.categoryName || "Other Services";
      if (!groups[categoryId]) {
        groups[categoryId] = { categoryName, quotes: [] };
      }
      groups[categoryId].quotes.push(quote);
    });
    Object.keys(groups).forEach(key => {
      groups[key].quotes.sort((a, b) => {
        if (a.isAvailable !== b.isAvailable) return a.isAvailable ? -1 : 1;
        return parseFloat(a.price) - parseFloat(b.price);
      });
    });
    const sortedCategoryIds = Object.keys(groups).sort((a, b) => {
      const aOrder = serviceCategoriesData.find(c => c.id === a)?.displayOrder ?? 999;
      const bOrder = serviceCategoriesData.find(c => c.id === b)?.displayOrder ?? 999;
      return aOrder - bOrder;
    });
    return sortedCategoryIds.map(categoryId => ({
      categoryName: groups[categoryId].categoryName,
      quotes: groups[categoryId].quotes,
    }));
  };

  return (
    <div>
      <div className="mb-6">
        <div className="relative" role="search">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" aria-hidden="true" />
          <Input
            ref={inputRef}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search device model..."
            className="pl-10 pr-10 h-14 text-lg"
            data-testid="input-internal-search"
            aria-label="Search for a device model"
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
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                {groupedQuotes().map(({ categoryName, quotes }) => (
                  <Card key={categoryName} className="bg-[#187908]/[0.03]">
                    <CardHeader className="py-3 border-b">
                      <CardTitle className="text-lg">{categoryName}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="divide-y">
                        {quotes.map((quote) => (
                          <div
                            key={quote.serviceId}
                            className={`p-4 flex items-center gap-3 ${!quote.isAvailable ? 'opacity-50 bg-muted/30' : 'cursor-pointer hover:bg-muted/20'}`}
                            data-testid={`internal-quote-${quote.serviceId}`}
                            onClick={() => quote.isAvailable && toggleService(quote.serviceId)}
                          >
                            {quote.isAvailable && (
                              <Checkbox
                                checked={selectedServiceIds.has(quote.serviceId)}
                                onCheckedChange={() => toggleService(quote.serviceId)}
                                onClick={(e) => e.stopPropagation()}
                                data-testid={`checkbox-service-${quote.serviceId}`}
                                className="shrink-0"
                              />
                            )}
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
                                    const anyPrimaryInStock = quote.primaryPartSkus?.some(sku => stockData[sku] && stockData[sku] > 0);
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
                                          Parts order may be required
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

              {selectedQuotes.length > 0 && (
                <div className="lg:col-span-1">
                  <Card className="sticky top-4">
                    <CardHeader className="py-4 border-b">
                      <CardTitle className="text-lg">Send Quote</CardTitle>
                      <CardDescription>
                        {selectedQuotes.length} service{selectedQuotes.length !== 1 ? 's' : ''} selected
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 space-y-4">
                      <div className="space-y-2">
                        {selectedQuotes.map(q => (
                          <div key={q.serviceId} className="flex justify-between text-sm" data-testid={`selected-service-${q.serviceId}`}>
                            <span className="truncate mr-2">{q.serviceName}</span>
                            <span className="font-medium shrink-0">${q.price}</span>
                          </div>
                        ))}
                        {multiServiceDiscount > 0 && (
                          <>
                            <div className="border-t pt-2 flex justify-between text-sm text-muted-foreground">
                              <span>Subtotal</span>
                              <span>${subtotal.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-sm text-green-600">
                              <span>Multi-Service Discount</span>
                              <span>-${multiServiceDiscount.toFixed(2)}</span>
                            </div>
                          </>
                        )}
                        <div className={`${multiServiceDiscount > 0 ? '' : 'border-t pt-2'} flex justify-between font-semibold`}>
                          <span>Total</span>
                          <span data-testid="text-quote-total">${grandTotal.toFixed(2)}</span>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <Label htmlFor="customer-name">Name *</Label>
                          <Input
                            id="customer-name"
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                            placeholder="Customer name"
                            autoComplete="off"
                            data-lpignore="true"
                            data-1p-ignore="true"
                            data-testid="input-customer-name"
                          />
                        </div>
                        <div>
                          <Label htmlFor="customer-email">Email</Label>
                          <Input
                            id="customer-email"
                            type="email"
                            value={customerEmail}
                            onChange={(e) => setCustomerEmail(e.target.value)}
                            placeholder="customer@example.com (optional)"
                            autoComplete="off"
                            data-lpignore="true"
                            data-1p-ignore="true"
                            data-testid="input-customer-email"
                          />
                        </div>
                        <div>
                          <Label htmlFor="customer-phone">Phone</Label>
                          <Input
                            id="customer-phone"
                            type="tel"
                            value={customerPhone}
                            onChange={(e) => setCustomerPhone(e.target.value)}
                            placeholder="Phone number (optional)"
                            autoComplete="off"
                            data-lpignore="true"
                            data-1p-ignore="true"
                            data-testid="input-customer-phone"
                          />
                        </div>
                      </div>

                      <Button
                        className="w-full"
                        disabled={!customerName.trim() || submitQuoteMutation.isPending}
                        onClick={() => submitQuoteMutation.mutate()}
                        data-testid="button-send-quote"
                      >
                        {submitQuoteMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <Send className="h-4 w-4 mr-2" />
                            Send Quote
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              )}
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
    </div>
  );
}

function QuoteHistoryTab() {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data: submissions = [], isLoading } = useQuery<Submission[]>({
    queryKey: ["/api/internal/submissions", debouncedQuery],
    queryFn: async () => {
      const url = debouncedQuery
        ? `/api/internal/submissions?q=${encodeURIComponent(debouncedQuery)}`
        : `/api/internal/submissions`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch submissions');
      return res.json();
    },
  });

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, email, or phone..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
          data-testid="input-quote-history-search"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : submissions.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {searchQuery ? "No submissions found matching your search." : "No submissions yet."}
        </div>
      ) : (
        <div className="border rounded-lg divide-y max-h-[600px] overflow-y-auto">
          {submissions.map((submission) => (
            <div key={submission.id} className="p-4 hover:bg-muted/30 transition-colors" data-testid={`submission-${submission.id}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">{submission.customerName}</span>
                    <Badge variant={submission.type === 'quote' ? 'default' : 'secondary'} className="text-xs">
                      {submission.type === 'quote' ? 'Quote' : 'Unknown Device'}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Mail className="h-3 w-3" />
                      <span>{submission.customerEmail}</span>
                    </div>
                    {submission.customerPhone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-3 w-3" />
                        <span>{submission.customerPhone}</span>
                      </div>
                    )}
                  </div>
                  {submission.type === 'quote' ? (
                    <div className="mt-2 text-sm">
                      <span className="text-muted-foreground">Device:</span> {submission.deviceName}
                      <span className="mx-2">·</span>
                      <span className="text-muted-foreground">Service:</span> {submission.serviceName}
                      <span className="mx-2">·</span>
                      <span className="font-medium text-primary">${submission.quotedPrice}</span>
                    </div>
                  ) : (
                    <div className="mt-2 text-sm">
                      <div><span className="text-muted-foreground">Device:</span> {submission.deviceDescription}</div>
                      <div><span className="text-muted-foreground">Issue:</span> {submission.issueDescription}</div>
                    </div>
                  )}
                  {submission.notes && (
                    <div className="mt-1 text-xs text-muted-foreground italic">
                      Notes: {submission.notes}
                    </div>
                  )}
                </div>
                <div className="text-xs text-muted-foreground whitespace-nowrap">
                  {formatDate(submission.createdAt)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {submissions.length > 0 && (
        <p className="text-sm text-muted-foreground text-center">
          Showing {submissions.length} submission{submissions.length !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
}

function UnconfirmedQuotesTab() {
  const [dateRange, setDateRange] = useState("7");

  const { data: allViews = [], isLoading } = useQuery<QuoteViewEntry[]>({
    queryKey: ["/api/quote-views"],
  });

  const { data: submissions = [] } = useQuery<Submission[]>({
    queryKey: ["/api/internal/submissions"],
    queryFn: async () => {
      const res = await fetch("/api/internal/submissions");
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
  });

  const confirmedServiceIds = new Set(
    submissions
      .filter(s => s.type === 'quote' && s.deviceServiceId)
      .map(s => s.deviceServiceId!)
  );

  const filteredViews = allViews.filter(view => {
    if (confirmedServiceIds.has(view.deviceServiceId)) return false;
    if (dateRange === "all") return true;
    const viewDate = new Date(view.viewedAt);
    const now = new Date();
    const daysAgo = parseInt(dateRange);
    const cutoff = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    return viewDate >= cutoff;
  });

  const groupedByDevice = filteredViews.reduce((acc, view) => {
    const key = `${view.deviceName}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(view);
    return acc;
  }, {} as Record<string, QuoteViewEntry[]>);

  const totalViews = filteredViews.length;
  const uniqueDevices = Object.keys(groupedByDevice).length;
  const uniqueServices = new Set(filteredViews.map(v => v.serviceName)).size;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex gap-4">
          <div className="text-center px-4 py-2 bg-primary/10 rounded-lg">
            <div className="text-2xl font-bold text-primary" data-testid="text-total-views">{totalViews}</div>
            <div className="text-xs text-muted-foreground">Total Views</div>
          </div>
          <div className="text-center px-4 py-2 bg-primary/10 rounded-lg">
            <div className="text-2xl font-bold text-primary" data-testid="text-unique-devices">{uniqueDevices}</div>
            <div className="text-xs text-muted-foreground">Devices</div>
          </div>
          <div className="text-center px-4 py-2 bg-primary/10 rounded-lg">
            <div className="text-2xl font-bold text-primary" data-testid="text-unique-services">{uniqueServices}</div>
            <div className="text-xs text-muted-foreground">Services</div>
          </div>
        </div>
        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-[160px]" data-testid="select-date-range">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
            <SelectItem value="all">All time</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filteredViews.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Eye className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p>No quote views recorded for this period.</p>
        </div>
      ) : (
        <div className="border rounded-lg divide-y max-h-[600px] overflow-y-auto">
          {filteredViews
            .sort((a, b) => new Date(b.viewedAt).getTime() - new Date(a.viewedAt).getTime())
            .map((view) => (
            <div key={view.id} className="p-4 hover:bg-muted/30 transition-colors" data-testid={`quote-view-${view.id}`}>
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{view.deviceName}</div>
                  <div className="text-sm text-muted-foreground">{view.serviceName}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-lg font-bold text-primary">${view.calculatedPrice}</div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {formatDate(view.viewedAt)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {filteredViews.length > 0 && (
        <p className="text-sm text-muted-foreground text-center">
          Showing {filteredViews.length} unconfirmed quote view{filteredViews.length !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
}

export default function Internal() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("lookup");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const { data: authStatus, isLoading: authLoading } = useQuery<{ isAdmin: boolean; username: string | null }>({
    queryKey: ["/api/admin/me"],
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: { username: string; password: string }) => {
      const res = await apiRequest("POST", "/api/admin/login", credentials);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Login failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/me"] });
      setUsername("");
      setPassword("");
      toast({ title: "Logged in successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/logout", {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/me"] });
      toast({ title: "Logged out" });
    },
  });

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({ username, password });
  };

  useEffect(() => {
    const titles: Record<string, string> = {
      lookup: "Counter Lookup | 519 Tech Services",
      history: "Quote History | 519 Tech Services",
      unconfirmed: "Unconfirmed Quotes | 519 Tech Services",
    };
    document.title = titles[activeTab] || titles.lookup;
  }, [activeTab]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!authStatus?.isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        <header className="sticky top-0 z-50 mx-4 mt-4">
          <div className="glass-nav px-4 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-primary" />
              <span className="font-semibold">Internal Tools</span>
            </div>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8 flex items-center justify-center">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <Lock className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Staff Login</CardTitle>
              <CardDescription>Enter your credentials to access internal tools</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4" autoComplete="off">
                <div className="space-y-2">
                  <Label htmlFor="internal-username">Username</Label>
                  <Input
                    id="internal-username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter username"
                    required
                    autoComplete="off"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    data-testid="input-internal-username"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="internal-password">Password</Label>
                  <Input
                    id="internal-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    required
                    autoComplete="off"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    data-testid="input-internal-password"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loginMutation.isPending} data-testid="button-internal-login">
                  {loginMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Login"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <header className="sticky top-0 z-50 mx-4 mt-4">
        <div className="glass-nav px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-primary" />
            <span className="font-semibold">Internal Tools</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{authStatus.username}</span>
            <Button variant="ghost" size="sm" onClick={() => logoutMutation.mutate()} data-testid="button-internal-logout">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-4xl">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full mb-6" data-testid="tabs-internal">
            <TabsTrigger value="lookup" className="flex-1 gap-2" data-testid="tab-lookup">
              <Search className="h-4 w-4" />
              Counter Lookup
            </TabsTrigger>
            <TabsTrigger value="history" className="flex-1 gap-2" data-testid="tab-history">
              <FileText className="h-4 w-4" />
              Quote History
            </TabsTrigger>
            <TabsTrigger value="unconfirmed" className="flex-1 gap-2" data-testid="tab-unconfirmed">
              <Eye className="h-4 w-4" />
              Unconfirmed Quotes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="lookup">
            <CounterLookupTab />
          </TabsContent>

          <TabsContent value="history">
            <QuoteHistoryTab />
          </TabsContent>

          <TabsContent value="unconfirmed">
            <UnconfirmedQuotesTab />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
