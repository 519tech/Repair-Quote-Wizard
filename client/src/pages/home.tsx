import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { ChevronRight, Check, Loader2, Search, X, Wrench, HelpCircle, Settings } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import type { Device, DeviceServiceWithRelations, Brand, DeviceType, MessageTemplate } from "@shared/schema";

type DeviceSearchResult = Device & {
  brand?: Brand | null;
  deviceType?: DeviceType;
};

export default function Home() {
  const { toast } = useToast();
  
  // Main flow: 'search' | 'services' | 'quote' | 'unknown' | 'success'
  const [view, setView] = useState<'search' | 'services' | 'quote' | 'unknown' | 'success'>('search');
  
  // Device search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<DeviceSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Selected device data
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<DeviceSearchResult | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  
  // Quote data
  const [allQuotes, setAllQuotes] = useState<Array<{
    serviceId: string;
    serviceName: string;
    serviceDescription?: string;
    deviceName: string;
    price: string;
    repairTime?: string;
    warranty?: string;
    isAvailable: boolean;
    hasPart: boolean;
    categoryId?: string;
  }>>([]);
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set());
  const [combinedQuoteSent, setCombinedQuoteSent] = useState(false);
  
  // Contact info
  const [contactInfo, setContactInfo] = useState({ name: "", email: "", phone: "" });
  const [notes, setNotes] = useState("");
  
  // Unknown device form
  const [unknownDeviceInfo, setUnknownDeviceInfo] = useState({ 
    name: "", 
    email: "", 
    phone: "",
    deviceDescription: "", 
    issueDescription: "" 
  });
  const [unknownQuoteSent, setUnknownQuoteSent] = useState(false);

  const { data: adminAuth } = useQuery<{ isAdmin: boolean }>({
    queryKey: ["/api/admin/auth"],
  });

  const { data: deviceServices = [], isLoading: servicesLoading } = useQuery<DeviceServiceWithRelations[]>({
    queryKey: [`/api/device-services/by-device/${selectedDeviceId}`],
    enabled: !!selectedDeviceId,
  });

  const { data: brandCategoryLinks = [] } = useQuery<{ id: string; brandId: string; categoryId: string }[]>({
    queryKey: ["/api/brand-service-categories"],
  });

  const { data: partsLastUpdated } = useQuery<MessageTemplate>({
    queryKey: ["/api/message-templates", "parts_last_updated"],
  });

  const formatLastUpdated = (isoDate: string | undefined) => {
    if (!isoDate) return null;
    try {
      const date = new Date(isoDate);
      return date.toLocaleDateString("en-US", { 
        year: "numeric", 
        month: "long", 
        day: "numeric" 
      });
    } catch {
      return null;
    }
  };

  // Search effect
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
          const results = await res.json();
          setSearchResults(results);
        }
      } catch (error) {
        console.error('Search failed:', error);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  // Combined quote mutation
  const submitCombinedQuoteMutation = useMutation({
    mutationFn: async (data: {
      customerName: string;
      customerEmail: string;
      customerPhone?: string;
      deviceId: string;
      deviceServiceIds: string[];
      notes?: string;
    }) => {
      const res = await apiRequest("POST", "/api/quote-requests/combined", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quote-requests"] });
      setCombinedQuoteSent(true);
      setView('success');
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Unknown device quote mutation
  const submitUnknownDeviceMutation = useMutation({
    mutationFn: async (data: {
      customerName: string;
      customerEmail: string;
      customerPhone?: string;
      deviceDescription: string;
      issueDescription: string;
    }) => {
      const res = await apiRequest("POST", "/api/unknown-device-quotes", data);
      return res.json();
    },
    onSuccess: () => {
      setUnknownQuoteSent(true);
      setView('success');
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults([]);
    setShowSearch(false);
  };

  const handleSelectDevice = async (device: DeviceSearchResult) => {
    setSelectedDevice(device);
    setSelectedDeviceId(device.id);
    clearSearch();
    setView('services');
  };

  const handleDirectServicesView = async (services: DeviceServiceWithRelations[]) => {
    setQuotesLoading(true);
    try {
      const quotes = await Promise.all(
        services.map(async (ds) => {
          try {
            const res = await fetch(`/api/calculate-quote/${ds.id}`);
            if (!res.ok) throw new Error('Quote calculation failed');
            const quote = await res.json();
            return {
              serviceId: ds.service.id,
              serviceName: ds.service.name,
              serviceDescription: ds.service.description || undefined,
              deviceName: ds.device.name,
              price: quote.totalPrice,
              repairTime: ds.service.repairTime || undefined,
              warranty: ds.service.warranty || undefined,
              isAvailable: quote.isAvailable,
              hasPart: quote.hasPart,
              categoryId: ds.service.category?.id,
            };
          } catch {
            return {
              serviceId: ds.service.id,
              serviceName: ds.service.name,
              serviceDescription: ds.service.description || undefined,
              deviceName: ds.device.name,
              price: "0.00",
              repairTime: ds.service.repairTime || undefined,
              warranty: ds.service.warranty || undefined,
              isAvailable: false,
              hasPart: false,
              categoryId: ds.service.category?.id,
            };
          }
        })
      );
      
      // Check if NO services are available (priced) - redirect to manual quote form
      // A service is available if it has parts linked OR is labour-only
      const anyServiceAvailable = quotes.some(q => q.isAvailable);
      if (!anyServiceAvailable && quotes.length > 0) {
        // No priced services available - pre-fill device info and go to manual quote form
        const deviceName = selectedDevice?.name || quotes[0]?.deviceName || "";
        const brandName = selectedDevice?.brand?.name || "";
        const fullDeviceName = brandName ? `${brandName} ${deviceName}` : deviceName;
        setUnknownDeviceInfo(prev => ({
          ...prev,
          deviceDescription: fullDeviceName
        }));
        setView('unknown');
        setAllQuotes(quotes);
        return;
      }
      
      setAllQuotes(quotes);
    } finally {
      setQuotesLoading(false);
    }
  };

  // Load quotes when device services are ready
  useEffect(() => {
    if (deviceServices.length > 0 && view === 'services' && allQuotes.length === 0) {
      handleDirectServicesView(deviceServices);
    }
  }, [deviceServices, view]);

  const toggleServiceSelection = (serviceId: string) => {
    const quote = allQuotes.find(q => q.serviceId === serviceId);
    if (!quote || !quote.isAvailable) return;
    
    setSelectedServices(prev => {
      const next = new Set(prev);
      if (next.has(serviceId)) {
        next.delete(serviceId);
      } else {
        // Single selection per category
        const quoteCategoryId = quote.categoryId;
        if (quoteCategoryId) {
          allQuotes.forEach(q => {
            if (q.categoryId === quoteCategoryId && q.serviceId !== serviceId) {
              next.delete(q.serviceId);
            }
          });
        }
        next.add(serviceId);
      }
      return next;
    });
  };

  const getSelectedQuotes = () => {
    return allQuotes.filter(q => selectedServices.has(q.serviceId));
  };

  const getGrandTotal = () => {
    return getSelectedQuotes().reduce((sum, q) => sum + parseFloat(q.price), 0);
  };

  const handleSendCombinedQuote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDeviceId || selectedServices.size === 0) return;
    
    const deviceServiceIds = deviceServices
      .filter(ds => selectedServices.has(ds.service.id))
      .map(ds => ds.id);

    submitCombinedQuoteMutation.mutate({
      customerName: contactInfo.name,
      customerEmail: contactInfo.email,
      customerPhone: contactInfo.phone || undefined,
      deviceId: selectedDeviceId,
      deviceServiceIds,
      notes: notes || undefined,
    });
  };

  const handleSubmitUnknownDevice = (e: React.FormEvent) => {
    e.preventDefault();
    submitUnknownDeviceMutation.mutate({
      customerName: unknownDeviceInfo.name,
      customerEmail: unknownDeviceInfo.email,
      customerPhone: unknownDeviceInfo.phone || undefined,
      deviceDescription: unknownDeviceInfo.deviceDescription,
      issueDescription: unknownDeviceInfo.issueDescription,
    });
  };

  const resetForm = () => {
    setView('search');
    setSearchQuery("");
    setSearchResults([]);
    setSelectedDeviceId(null);
    setSelectedDevice(null);
    setSelectedCategoryId(null);
    setAllQuotes([]);
    setSelectedServices(new Set());
    setCombinedQuoteSent(false);
    setContactInfo({ name: "", email: "", phone: "" });
    setNotes("");
    setUnknownDeviceInfo({ name: "", email: "", phone: "", deviceDescription: "", issueDescription: "" });
    setUnknownQuoteSent(false);
  };

  // Get categories for filtering
  const categories = Array.from(
    new Map(
      allQuotes
        .filter(q => q.categoryId)
        .map(q => [q.categoryId, q.categoryId])
    ).values()
  );

  const currentCategoryQuotes = selectedCategoryId 
    ? allQuotes.filter(q => q.categoryId === selectedCategoryId)
    : allQuotes.filter(q => !q.categoryId);

  const sortedQuotes = [...currentCategoryQuotes].sort((a, b) => {
    if (a.isAvailable && !b.isAvailable) return -1;
    if (!a.isAvailable && b.isAvailable) return 1;
    return parseFloat(a.price) - parseFloat(b.price);
  });

  // Handler for category selection - checks if category has any priced services
  const handleCategorySelect = (catId: string) => {
    const catQuotes = catId === "other" 
      ? allQuotes.filter(q => !q.categoryId)
      : allQuotes.filter(q => q.categoryId === catId);
    
    // Check if any service in this category is available (has parts OR is labour-only)
    const anyAvailable = catQuotes.some(q => q.isAvailable);
    
    if (!anyAvailable && catQuotes.length > 0) {
      // No priced services in this category - pre-fill device info and go to manual quote form
      const deviceName = selectedDevice?.name || catQuotes[0]?.deviceName || "";
      const brandName = selectedDevice?.brand?.name || "";
      const fullDeviceName = brandName ? `${brandName} ${deviceName}` : deviceName;
      setUnknownDeviceInfo(prev => ({
        ...prev,
        deviceDescription: fullDeviceName
      }));
      setView('unknown');
      return;
    }
    
    setSelectedCategoryId(catId);
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-lg mx-auto space-y-4">
        
        {/* Admin Button */}
        {adminAuth?.isAdmin && (
          <div className="flex justify-end">
            <Link href="/admin">
              <Button variant="outline" size="sm" data-testid="button-admin">
                <Settings className="h-4 w-4 mr-2" />
                Admin
              </Button>
            </Link>
          </div>
        )}

        {/* Search View */}
        {view === 'search' && (
          <Card>
            <CardHeader className="text-center">
              <img 
                src="https://519techservices.ca/cdn/shop/files/519_Tech_Services_Logo_2022_2k.png?v=1692217647&width=400" 
                alt="519 Tech Services" 
                className="h-16 mx-auto mb-2"
              />
              <CardTitle className="text-lg">Get a Repair Quote</CardTitle>
              <CardDescription className="text-xs">Search for your device to get instant pricing</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search your device model..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setShowSearch(true); }}
                  onFocus={() => setShowSearch(true)}
                  className="pl-9 pr-10 h-12 text-base"
                  data-testid="input-device-search"
                />
                {searchQuery && (
                  <div className="absolute right-0 top-0 h-full flex items-center pr-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={clearSearch}
                      data-testid="button-clear-search"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>

              {/* Search Results */}
              {showSearch && searchQuery.length >= 2 && (
                <div className="border rounded-md max-h-64 overflow-y-auto">
                  {searchLoading ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : searchResults.length === 0 ? (
                    <p className="text-center py-4 text-sm text-muted-foreground">No devices found</p>
                  ) : (
                    <div className="p-1 space-y-1">
                      {searchResults.map(device => (
                        <Button
                          key={device.id}
                          variant="ghost"
                          className="w-full justify-start text-left h-auto py-3 hover-elevate"
                          onClick={() => handleSelectDevice(device)}
                          data-testid={`device-result-${device.id}`}
                        >
                          <div>
                            <div className="font-medium">{device.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {device.brand?.name || "Unknown Brand"} · {device.deviceType?.name || "Unknown Type"}
                            </div>
                          </div>
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* I don't know my device button */}
              <div className="pt-4 border-t">
                <Button 
                  variant="default" 
                  className="w-full" 
                  onClick={() => setView('unknown')}
                  data-testid="button-unknown-device"
                >
                  <HelpCircle className="h-4 w-4 mr-2" />
                  I don't know what device I have
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Services View */}
        {view === 'services' && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-start gap-3">
                {selectedDevice && (
                  <div className="shrink-0">
                    {selectedDevice.imageUrl ? (
                      <img 
                        src={selectedDevice.imageUrl} 
                        alt={selectedDevice.name}
                        className="w-12 h-12 object-contain rounded-lg bg-muted p-1"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                        <Wrench className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  {selectedDevice && (
                    <p className="text-xs text-muted-foreground mb-1">
                      {selectedDevice.brand?.name && <span>{selectedDevice.brand.name} </span>}
                      <span className="font-medium text-foreground">{selectedDevice.name}</span>
                    </p>
                  )}
                  <CardTitle className="text-base">
                    {selectedCategoryId ? "Compare Options" : "Select Repair Category"}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {selectedCategoryId ? "Choose your preferred service" : "What needs to be fixed?"}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Button 
                variant="secondary" 
                size="sm"
                className="mb-4" 
                onClick={() => {
                  if (selectedCategoryId) {
                    setSelectedCategoryId(null);
                  } else {
                    resetForm();
                  }
                }}
                data-testid="button-back-services"
              >
                {selectedCategoryId ? "Add another service" : "Search again"}
              </Button>

              {servicesLoading || quotesLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : allQuotes.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">No services available for this device.</p>
              ) : !selectedCategoryId && categories.length > 0 ? (
                // Category selection
                <div className="space-y-2">
                  {categories.map(catId => {
                    const catQuotes = allQuotes.filter(q => q.categoryId === catId);
                    const catName = deviceServices.find(ds => ds.service.category?.id === catId)?.service.category?.name || "Other";
                    return (
                      <Button
                        key={catId}
                        variant="outline"
                        className="w-full justify-between"
                        onClick={() => handleCategorySelect(catId!)}
                        data-testid={`category-${catId}`}
                      >
                        <span>{catName}</span>
                        <span className="text-xs text-muted-foreground">
                          {catQuotes.length} option{catQuotes.length > 1 ? 's' : ''}
                        </span>
                      </Button>
                    );
                  })}
                  {allQuotes.filter(q => !q.categoryId).length > 0 && (
                    <Button
                      variant="outline"
                      className="w-full justify-between"
                      onClick={() => handleCategorySelect("other")}
                      data-testid="category-other"
                    >
                      <span>Other Services</span>
                      <span className="text-xs text-muted-foreground">
                        {allQuotes.filter(q => !q.categoryId).length} option{allQuotes.filter(q => !q.categoryId).length > 1 ? 's' : ''}
                      </span>
                    </Button>
                  )}
                </div>
              ) : (
                // Service selection
                <div className="space-y-3">
                  {(selectedCategoryId === "other" 
                    ? allQuotes.filter(q => !q.categoryId) 
                    : sortedQuotes
                  ).map(quote => (
                    <div
                      key={quote.serviceId}
                      onClick={() => toggleServiceSelection(quote.serviceId)}
                      className={`p-3 rounded-lg border transition-all cursor-pointer ${
                        !quote.isAvailable 
                          ? 'opacity-50 cursor-not-allowed' 
                          : selectedServices.has(quote.serviceId)
                            ? 'border-primary bg-primary/5'
                            : 'hover:border-primary/50'
                      }`}
                      data-testid={`service-${quote.serviceId}`}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={selectedServices.has(quote.serviceId)}
                          disabled={!quote.isAvailable}
                          className="mt-1"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start gap-2">
                            <p className="font-medium text-sm">{quote.serviceName}</p>
                            {quote.isAvailable ? (
                              <span className="font-bold text-primary shrink-0">${quote.price}</span>
                            ) : (
                              <span className="text-xs text-muted-foreground shrink-0">Not Available</span>
                            )}
                          </div>
                          {quote.isAvailable && (
                            <div className="flex gap-2 mt-1 text-xs text-muted-foreground">
                              {quote.repairTime && <span>{quote.repairTime}</span>}
                              {quote.warranty && <span>· {quote.warranty} warranty</span>}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Selected Services Summary */}
                  {selectedServices.size > 0 && (
                    <div className="sticky bottom-2 mt-4">
                      <Card className="shadow-lg border-primary/20">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <p className="text-sm text-muted-foreground">
                                {selectedServices.size} service{selectedServices.size > 1 ? 's' : ''} selected
                              </p>
                              <p className="text-xl font-bold text-primary">
                                Total: ${getGrandTotal().toFixed(2)}
                              </p>
                              <p className="text-xs text-muted-foreground">plus taxes</p>
                            </div>
                            <Button size="sm" onClick={() => setView('quote')} data-testid="button-continue-quote">
                              <ChevronRight className="h-4 w-4 mr-1" />
                              Continue
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Quote Summary View */}
        {view === 'quote' && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-start gap-3">
                {selectedDevice && (
                  <div className="shrink-0">
                    {selectedDevice.imageUrl ? (
                      <img 
                        src={selectedDevice.imageUrl} 
                        alt={selectedDevice.name}
                        className="w-12 h-12 object-contain rounded-lg bg-muted p-1"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                        <Wrench className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  {selectedDevice && (
                    <p className="text-xs text-muted-foreground mb-1">
                      {selectedDevice.brand?.name && <span>{selectedDevice.brand.name} </span>}
                      <span className="font-medium text-foreground">{selectedDevice.name}</span>
                    </p>
                  )}
                  <CardTitle className="text-lg">Your Repair Quote</CardTitle>
                  <CardDescription className="text-xs">Review and provide contact details</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Button 
                variant="secondary" 
                size="sm"
                className="mb-4" 
                onClick={() => setView('services')}
                data-testid="button-back-services-quote"
              >
                Back to services
              </Button>

              <div className="space-y-4">
                {/* Quote Summary */}
                <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                  <h3 className="font-semibold text-sm">Selected Services</h3>
                  <div className="space-y-1">
                    {getSelectedQuotes().map(q => (
                      <div key={q.serviceId} className="flex items-center justify-between py-1 border-b last:border-b-0 gap-2">
                        <div className="flex-1">
                          <p className="text-sm font-medium">{q.serviceName}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">${q.price}</span>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 text-muted-foreground hover:text-destructive"
                            onClick={() => {
                              toggleServiceSelection(q.serviceId);
                              if (selectedServices.size <= 1) {
                                setView('services');
                              }
                            }}
                            data-testid={`button-remove-${q.serviceId}`}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t">
                    <span className="font-semibold">Grand Total</span>
                    <div className="text-right">
                      <span className="text-xl font-bold text-primary">${getGrandTotal().toFixed(2)}</span>
                      <p className="text-xs text-muted-foreground">plus taxes</p>
                    </div>
                  </div>
                </div>

                {/* Contact Form */}
                <form onSubmit={handleSendCombinedQuote} className="space-y-3">
                  <h3 className="font-semibold text-sm">Send Quote To</h3>
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <Label htmlFor="quote-name" className="text-xs">Name *</Label>
                      <Input
                        id="quote-name"
                        value={contactInfo.name}
                        onChange={(e) => setContactInfo({ ...contactInfo, name: e.target.value })}
                        placeholder="Your name"
                        required
                        className="h-9"
                        data-testid="input-quote-name"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="quote-email" className="text-xs">Email *</Label>
                      <Input
                        id="quote-email"
                        type="email"
                        value={contactInfo.email}
                        onChange={(e) => setContactInfo({ ...contactInfo, email: e.target.value })}
                        placeholder="your@email.com"
                        required
                        className="h-9"
                        data-testid="input-quote-email"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="quote-phone" className="text-xs">Phone (optional)</Label>
                      <Input
                        id="quote-phone"
                        type="tel"
                        value={contactInfo.phone}
                        onChange={(e) => setContactInfo({ ...contactInfo, phone: e.target.value })}
                        placeholder="For SMS quote"
                        className="h-9"
                        data-testid="input-quote-phone"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="quote-notes" className="text-xs">Notes (optional)</Label>
                      <Textarea
                        id="quote-notes"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Any additional information..."
                        className="resize-none"
                        rows={2}
                        data-testid="input-quote-notes"
                      />
                    </div>
                  </div>
                  <Button
                    type="submit"
                    size="sm"
                    className="w-full"
                    disabled={submitCombinedQuoteMutation.isPending}
                    data-testid="button-send-quote"
                  >
                    {submitCombinedQuoteMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Check className="h-4 w-4 mr-2" />
                    )}
                    Send My Quote
                  </Button>
                </form>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Unknown Device View */}
        {view === 'unknown' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Request a Quote</CardTitle>
              <CardDescription className="text-xs">
                Tell us about your device and we'll get back to you with a quote
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                variant="secondary" 
                size="sm"
                className="mb-4" 
                onClick={() => setView('search')}
                data-testid="button-back-search"
              >
                Back to search
              </Button>

              <form onSubmit={handleSubmitUnknownDevice} className="space-y-4">
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label htmlFor="unknown-device" className="text-xs">What device do you have? *</Label>
                    <Input
                      id="unknown-device"
                      value={unknownDeviceInfo.deviceDescription}
                      onChange={(e) => setUnknownDeviceInfo({ ...unknownDeviceInfo, deviceDescription: e.target.value })}
                      placeholder="e.g., Samsung phone, black, about 2 years old"
                      required
                      className="h-9"
                      data-testid="input-unknown-device"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="unknown-issue" className="text-xs">What's the issue? *</Label>
                    <Textarea
                      id="unknown-issue"
                      value={unknownDeviceInfo.issueDescription}
                      onChange={(e) => setUnknownDeviceInfo({ ...unknownDeviceInfo, issueDescription: e.target.value })}
                      placeholder="Describe what's wrong with your device..."
                      required
                      className="resize-none"
                      rows={3}
                      data-testid="input-unknown-issue"
                    />
                  </div>
                </div>

                <div className="border-t pt-4 space-y-3">
                  <h3 className="font-semibold text-sm">Your Contact Info</h3>
                  <div className="space-y-1">
                    <Label htmlFor="unknown-name" className="text-xs">Name *</Label>
                    <Input
                      id="unknown-name"
                      value={unknownDeviceInfo.name}
                      onChange={(e) => setUnknownDeviceInfo({ ...unknownDeviceInfo, name: e.target.value })}
                      placeholder="Your name"
                      required
                      className="h-9"
                      data-testid="input-unknown-name"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="unknown-email" className="text-xs">Email *</Label>
                    <Input
                      id="unknown-email"
                      type="email"
                      value={unknownDeviceInfo.email}
                      onChange={(e) => setUnknownDeviceInfo({ ...unknownDeviceInfo, email: e.target.value })}
                      placeholder="your@email.com"
                      required
                      className="h-9"
                      data-testid="input-unknown-email"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="unknown-phone" className="text-xs">Phone (optional)</Label>
                    <Input
                      id="unknown-phone"
                      type="tel"
                      value={unknownDeviceInfo.phone}
                      onChange={(e) => setUnknownDeviceInfo({ ...unknownDeviceInfo, phone: e.target.value })}
                      placeholder="For faster response"
                      className="h-9"
                      data-testid="input-unknown-phone"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  size="sm"
                  className="w-full"
                  disabled={submitUnknownDeviceMutation.isPending}
                  data-testid="button-submit-unknown"
                >
                  {submitUnknownDeviceMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Check className="h-4 w-4 mr-2" />
                  )}
                  Request Quote
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Success View */}
        {view === 'success' && (
          <Card>
            <CardContent className="p-6">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 mx-auto rounded-full bg-green-100 dark:bg-green-950 flex items-center justify-center">
                  <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">
                    {unknownQuoteSent ? "Request Received!" : "Quote Sent!"}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {unknownQuoteSent 
                      ? "We'll review your request and get back to you soon."
                      : "Check your email for your repair quote details."
                    }
                  </p>
                </div>
                <Button variant="outline" onClick={resetForm} data-testid="button-new-quote">
                  Get Another Quote
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="pt-4 text-xs text-muted-foreground text-center space-y-1">
          <p>All prices are estimates only and subject to change. In-store verification required.</p>
          {partsLastUpdated?.content && (
            <p>Prices last updated: {formatLastUpdated(partsLastUpdated.content)}</p>
          )}
        </div>
      </div>
    </div>
  );
}
