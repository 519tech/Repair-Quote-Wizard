import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Smartphone, Tablet, Laptop, Monitor, Gamepad2, Watch, Headphones, Camera, ChevronRight, Check, Loader2, RotateCcw, Search, X } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { DeviceType, Device, DeviceServiceWithRelations, Brand, ServiceCategory, MessageTemplate } from "@shared/schema";

type DeviceSearchResult = Device & {
  brand?: Brand | null;
  deviceType?: DeviceType;
};

const iconMap: Record<string, typeof Smartphone> = {
  smartphone: Smartphone,
  tablet: Tablet,
  laptop: Laptop,
  desktop: Monitor,
  gaming: Gamepad2,
  watch: Watch,
  headphones: Headphones,
  camera: Camera,
};

export default function Embed() {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [contactInfo, setContactInfo] = useState({ name: "", email: "", phone: "" });
  const [optInQuote, setOptInQuote] = useState(false);
  const [quoteResult, setQuoteResult] = useState<{ price: string; serviceName: string; deviceName: string; serviceDescription?: string; repairTime?: string; warranty?: string } | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [showContactForm, setShowContactForm] = useState(false);
  const [quoteSent, setQuoteSent] = useState(false);
  
  // Multiple quotes for comparison view
  const [allQuotes, setAllQuotes] = useState<Array<{
    serviceId: string;
    serviceName: string;
    serviceDescription?: string;
    deviceName: string;
    price: string;
    repairTime?: string;
    warranty?: string;
    isAvailable: boolean;
    categoryId?: string;
  }>>([]);
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [sendingQuoteFor, setSendingQuoteFor] = useState<string | null>(null);
  const [quoteSentFor, setQuoteSentFor] = useState<Set<string>>(new Set());
  
  // Multi-select for combined quotes
  const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set());
  const [showCombinedQuoteForm, setShowCombinedQuoteForm] = useState(false);
  const [combinedQuoteSent, setCombinedQuoteSent] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<DeviceSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [usedSearch, setUsedSearch] = useState(false);

  const { data: deviceTypes = [], isLoading: typesLoading } = useQuery<DeviceType[]>({
    queryKey: ["/api/device-types"],
  });

  const { data: brands = [], isLoading: brandsLoading, isFetched: brandsFetched } = useQuery<Brand[]>({
    queryKey: [`/api/brands/by-type/${selectedTypeId}`],
    enabled: !!selectedTypeId,
  });

  const { data: devices = [], isLoading: devicesLoading } = useQuery<Device[]>({
    queryKey: selectedBrandId 
      ? [`/api/devices?typeId=${selectedTypeId}&brandId=${selectedBrandId}`]
      : [`/api/devices?typeId=${selectedTypeId}`],
    enabled: !!selectedTypeId && (brandsFetched && brands.length === 0 ? true : !!selectedBrandId),
  });

  const { data: deviceServices = [], isLoading: servicesLoading } = useQuery<DeviceServiceWithRelations[]>({
    queryKey: [`/api/device-services/by-device/${selectedDeviceId}`],
    enabled: !!selectedDeviceId,
  });

  const { data: brandCategoryLinks = [] } = useQuery<{ id: string; brandId: string; categoryId: string }[]>({
    queryKey: ["/api/brand-service-categories"],
  });

  // Get the last time parts were updated
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

  const submitQuoteMutation = useMutation({
    mutationFn: async (data: {
      customerName: string;
      customerEmail: string;
      customerPhone?: string;
      deviceId: string;
      deviceServiceId: string;
      optIn?: boolean;
    }) => {
      const res = await apiRequest("POST", "/api/quote-requests", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quote-requests"] });
    },
  });

  const [skippedBrandStep, setSkippedBrandStep] = useState(false);

  useEffect(() => {
    if (brandsFetched && brands.length === 0 && step === 2) {
      setSkippedBrandStep(true);
      setStep(3);
    }
  }, [brandsFetched, brands, step]);

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

  const handleSearchSelect = (device: DeviceSearchResult) => {
    setSelectedTypeId(device.deviceTypeId);
    setSelectedBrandId(device.brandId);
    setSelectedDeviceId(device.id);
    setSelectedCategoryId(null);
    setSelectedServiceId(null);
    setSearchQuery("");
    setSearchResults([]);
    setShowSearch(false);
    setUsedSearch(true);
    setStep(4);
  };

  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults([]);
    setShowSearch(false);
  };

  const handleTypeSelect = (typeId: string) => {
    setSelectedTypeId(typeId);
    setSelectedBrandId(null);
    setSelectedDeviceId(null);
    setSelectedServiceId(null);
    setSkippedBrandStep(false);
    setStep(2);
  };

  const handleBrandSelect = (brandId: string) => {
    setSelectedBrandId(brandId);
    setSelectedDeviceId(null);
    setSelectedServiceId(null);
    setSkippedBrandStep(false);
    setStep(3);
  };

  const handleDeviceSelect = (deviceId: string) => {
    setSelectedDeviceId(deviceId);
    setSelectedCategoryId(null);
    setSelectedServiceId(null);
    setStep(4);
  };

  const handleServiceSelect = async (service: DeviceServiceWithRelations) => {
    setSelectedServiceId(service.id);
    setQuoteLoading(true);
    try {
      const res = await fetch(`/api/calculate-quote/${service.id}`);
      if (res.ok) {
        const data = await res.json();
        setQuoteResult({ 
          price: data.totalPrice, 
          serviceName: data.serviceName,
          deviceName: data.deviceName,
          serviceDescription: data.serviceDescription,
          repairTime: data.repairTime,
          warranty: data.warranty
        });
        setStep(5);
      } else {
        toast({
          title: "Error",
          description: "Failed to calculate quote. Please try again.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to calculate quote. Please try again.",
        variant: "destructive",
      });
    } finally {
      setQuoteLoading(false);
    }
  };

  const fetchAllQuotesForServices = async (services: DeviceServiceWithRelations[], append = false) => {
    setQuotesLoading(true);
    if (!append) {
      setAllQuotes([]);
    }
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
                deviceName: data.deviceName,
                price: data.totalPrice,
                repairTime: data.repairTime,
                warranty: data.warranty,
                isAvailable: data.isAvailable ?? true,
                categoryId: ds.service.category?.id || "uncategorized",
              };
            }
          } catch {
            // Skip failed quotes
          }
          return null;
        })
      );
      const newQuotes = quotes.filter((q): q is NonNullable<typeof q> => q !== null);
      if (append) {
        setAllQuotes(prev => {
          const existingIds = new Set(prev.map(q => q.serviceId));
          const uniqueNew = newQuotes.filter(q => !existingIds.has(q.serviceId));
          return [...prev, ...uniqueNew];
        });
      } else {
        setAllQuotes(newQuotes);
      }
    } finally {
      setQuotesLoading(false);
    }
  };

  const handleCategorySelect = async (categoryId: string, services: DeviceServiceWithRelations[]) => {
    setSelectedCategoryId(categoryId);
    const filteredServices = categoryId === "other"
      ? services.filter(ds => !ds.service.category)
      : services.filter(ds => ds.service.category?.id === categoryId);
    // Append quotes so selections from other categories are preserved
    await fetchAllQuotesForServices(filteredServices, true);
  };

  const handleDirectServicesView = async (services: DeviceServiceWithRelations[]) => {
    await fetchAllQuotesForServices(services);
  };

  const handleSendQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDeviceId || !sendingQuoteFor) return;

    submitQuoteMutation.mutate({
      customerName: contactInfo.name,
      customerEmail: contactInfo.email,
      customerPhone: contactInfo.phone || undefined,
      deviceId: selectedDeviceId,
      deviceServiceId: sendingQuoteFor,
      optIn: true,
    });
    setQuoteSentFor(prev => new Set(prev).add(sendingQuoteFor));
    setSendingQuoteFor(null);
    setContactInfo({ name: "", email: "", phone: "" });
    toast({
      title: "Quote Sent",
      description: "Your quote has been sent to your email/phone!",
    });
  };

  // Multi-select helpers
  const toggleServiceSelection = (serviceId: string) => {
    const quote = allQuotes.find(q => q.serviceId === serviceId);
    if (!quote) return;

    setSelectedServices(prev => {
      const next = new Set(prev);
      if (next.has(serviceId)) {
        // Deselecting - just remove it
        next.delete(serviceId);
      } else {
        // Selecting - remove any other selection from the same category first
        // (categoryId now always has a value - either the real ID or "uncategorized")
        const sameCategory = allQuotes.filter(q => q.categoryId === quote.categoryId);
        sameCategory.forEach(q => next.delete(q.serviceId));
        next.add(serviceId);
      }
      return next;
    });
  };

  const getSelectedQuotes = () => allQuotes.filter(q => selectedServices.has(q.serviceId) && q.isAvailable);
  
  const getGrandTotal = () => {
    return getSelectedQuotes().reduce((sum, q) => sum + parseFloat(q.price), 0);
  };

  const submitCombinedQuoteMutation = useMutation({
    mutationFn: async (data: {
      customerName: string;
      customerEmail: string;
      customerPhone?: string;
      deviceId: string;
      deviceServiceIds: string[];
    }) => {
      const res = await apiRequest("POST", "/api/quote-requests/combined", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quote-requests"] });
      setCombinedQuoteSent(true);
      setShowCombinedQuoteForm(false);
      toast({
        title: "Quote Sent",
        description: "Your combined quote has been sent!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSendCombinedQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDeviceId || selectedServices.size === 0) return;

    submitCombinedQuoteMutation.mutate({
      customerName: contactInfo.name,
      customerEmail: contactInfo.email,
      customerPhone: contactInfo.phone || undefined,
      deviceId: selectedDeviceId,
      deviceServiceIds: Array.from(selectedServices),
    });
  };

  const resetForm = () => {
    setStep(1);
    setSelectedTypeId(null);
    setSelectedBrandId(null);
    setSelectedDeviceId(null);
    setSelectedCategoryId(null);
    setSelectedServiceId(null);
    setContactInfo({ name: "", email: "", phone: "" });
    setOptInQuote(false);
    setQuoteResult(null);
    setSkippedBrandStep(false);
    setSearchQuery("");
    setSearchResults([]);
    setShowSearch(false);
    setUsedSearch(false);
    setShowContactForm(false);
    setQuoteSent(false);
    setAllQuotes([]);
    setSendingQuoteFor(null);
    setQuoteSentFor(new Set());
    setSelectedServices(new Set());
    setShowCombinedQuoteForm(false);
    setCombinedQuoteSent(false);
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-xl mx-auto">
        {step < 4 && (
          <Card className="mb-6 border-2 border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Search className="h-5 w-5" />
                Quick Search
              </CardTitle>
              <CardDescription>Find your device instantly</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setShowSearch(true); }}
                  onFocus={() => setShowSearch(true)}
                  placeholder="Type your device model (e.g. iPhone 15, Galaxy S24)..."
                  className="pl-9 pr-9 h-12 text-base"
                  data-testid="input-device-search"
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    onClick={clearSearch}
                    data-testid="button-clear-search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              {showSearch && searchQuery.length >= 2 && (
                <div className="mt-3 border rounded-md max-h-64 overflow-y-auto">
                  {searchLoading ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : searchResults.length === 0 ? (
                    <p className="text-center py-4 text-sm text-muted-foreground">No devices found</p>
                  ) : (
                    <div className="p-1 space-y-1">
                      {searchResults.map((device) => (
                        <Button
                          key={device.id}
                          variant="ghost"
                          className="w-full justify-start text-left h-auto py-3 hover-elevate"
                          onClick={() => handleSearchSelect(device)}
                          data-testid={`button-search-result-${device.id}`}
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
            </CardContent>
          </Card>
        )}

        <div className="flex items-center justify-center mb-6 gap-2">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                  step >= s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}
              >
                {step > s ? <Check className="h-3 w-3" /> : s}
              </div>
              {s < 4 && <div className={`w-4 h-0.5 ${step > s ? "bg-primary" : "bg-muted"}`} />}
            </div>
          ))}
        </div>

        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Select Device Type</CardTitle>
              <CardDescription>What type of device needs repair?</CardDescription>
            </CardHeader>
            <CardContent>
              {typesLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : deviceTypes.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">No device types available.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {deviceTypes.map((type) => {
                    const Icon = iconMap[type.icon] || Smartphone;
                    return (
                      <Button
                        key={type.id}
                        variant="outline"
                        className="h-20 flex-col gap-2 hover-elevate"
                        onClick={() => handleTypeSelect(type.id)}
                        data-testid={`button-type-${type.id}`}
                      >
                        <Icon className="h-5 w-5" />
                        <span className="text-sm">{type.name}</span>
                      </Button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Select Brand</CardTitle>
              <CardDescription>Choose the brand of your device</CardDescription>
            </CardHeader>
            <CardContent>
              {brandsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : brands.length === 0 ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-2">
                  <Button variant="secondary" className="w-full justify-start" onClick={() => setStep(1)} data-testid="button-back-step1">
                    Back
                  </Button>
                  {brands.map((brand) => (
                    <Button
                      key={brand.id}
                      variant="outline"
                      className="w-full justify-between hover-elevate"
                      onClick={() => handleBrandSelect(brand.id)}
                      data-testid={`button-brand-${brand.id}`}
                    >
                      <span>{brand.name}</span>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>Select Device</CardTitle>
              <CardDescription>Choose your specific device model</CardDescription>
            </CardHeader>
            <CardContent>
              {devicesLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : devices.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">No devices available for this selection.</p>
              ) : (
                <div className="space-y-2">
                  <Button 
                    variant="outline" 
                    className="w-full justify-start" 
                    onClick={() => setStep(skippedBrandStep ? 1 : 2)} 
                    data-testid="button-back-step2"
                  >
                    Back
                  </Button>
                  {devices.map((device) => (
                    <Button
                      key={device.id}
                      variant="outline"
                      className="w-full justify-between hover-elevate"
                      onClick={() => handleDeviceSelect(device.id)}
                      data-testid={`button-device-${device.id}`}
                    >
                      <span>{device.name}</span>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {step === 4 && (
          <Card>
            <CardHeader>
              <CardTitle>{selectedCategoryId ? "Compare Service Options" : "Select Repair Category"}</CardTitle>
              <CardDescription>{selectedCategoryId ? "All available options for your repair" : "What needs to be fixed?"}</CardDescription>
            </CardHeader>
            <CardContent>
              {servicesLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : deviceServices.length === 0 ? (
                <>
                  <Button variant="secondary" className="w-full justify-start mb-4" onClick={() => { if (usedSearch) { resetForm(); } else { setStep(3); } }} data-testid="button-back-step3">
                    {usedSearch ? "Start Over" : "Back"}
                  </Button>
                  <p className="text-center py-8 text-muted-foreground">No services available for this device.</p>
                </>
              ) : (() => {
                const allCategories = Array.from(
                  new Map(
                    deviceServices
                      .filter(ds => ds.service.category)
                      .map(ds => [ds.service.category!.id, ds.service.category!])
                  ).values()
                );
                
                const categories = allCategories.filter(cat => {
                  const linksForCategory = brandCategoryLinks.filter(l => l.categoryId === cat.id);
                  if (linksForCategory.length === 0) return true;
                  if (!selectedBrandId) return false;
                  return linksForCategory.some(l => l.brandId === selectedBrandId);
                });
                
                const uncategorized = deviceServices.filter(ds => !ds.service.category);
                const hasMultipleCategories = categories.length > 1 || (categories.length > 0 && uncategorized.length > 0);

                // Show category selection if multiple categories exist and none selected
                if (hasMultipleCategories && !selectedCategoryId) {
                  return (
                    <div className="space-y-2">
                      <Button variant="secondary" className="w-full justify-start" onClick={() => { if (usedSearch) { resetForm(); } else { setStep(3); } }} data-testid="button-back-step3">
                        {usedSearch ? "Start Over" : "Back"}
                      </Button>
                      {categories.map((cat) => (
                        <Button
                          key={cat.id}
                          variant="outline"
                          className="w-full justify-between hover-elevate"
                          onClick={() => handleCategorySelect(cat.id, deviceServices)}
                          data-testid={`button-category-${cat.id}`}
                        >
                          <div className="text-left">
                            <div className="font-medium">{cat.name}</div>
                            {cat.description && (
                              <div className="text-xs text-muted-foreground">{cat.description}</div>
                            )}
                          </div>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      ))}
                      {uncategorized.length > 0 && (
                        <Button
                          variant="outline"
                          className="w-full justify-between hover-elevate"
                          onClick={() => handleCategorySelect("other", deviceServices)}
                          data-testid="button-category-other"
                        >
                          <div className="text-left">
                            <div className="font-medium">Other Services</div>
                          </div>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  );
                }

                // Show comparison view with all quotes
                return (
                  <>
                    <Button 
                      variant="secondary" 
                      className="w-full justify-start mb-4" 
                      onClick={() => {
                        if (hasMultipleCategories && selectedCategoryId) {
                          setSelectedCategoryId(null);
                          // Don't clear allQuotes - preserve them for multi-category selections
                          setSendingQuoteFor(null);
                        } else if (usedSearch) {
                          resetForm();
                        } else {
                          setStep(3);
                        }
                      }} 
                      data-testid="button-back-step3"
                    >
                      {hasMultipleCategories && selectedCategoryId 
                        ? "Back to categories" 
                        : usedSearch 
                          ? "Start Over" 
                          : "Back"}
                    </Button>

                    {quotesLoading ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      </div>
                    ) : allQuotes.length > 0 ? (() => {
                      // Filter to only show quotes from the current category
                      const currentCategoryQuotes = selectedCategoryId 
                        ? allQuotes.filter(q => q.categoryId === selectedCategoryId || q.categoryId === "uncategorized" && selectedCategoryId === "other")
                        : allQuotes;
                      
                      // Get selected quotes from OTHER categories (not the current one)
                      const otherCategorySelectedQuotes = selectedCategoryId
                        ? getSelectedQuotes().filter(q => q.categoryId !== selectedCategoryId && !(q.categoryId === "uncategorized" && selectedCategoryId === "other"))
                        : [];
                      
                      return (
                      <div className="space-y-4">
                        {[...currentCategoryQuotes].sort((a, b) => {
                          if (a.isAvailable !== b.isAvailable) {
                            return a.isAvailable ? -1 : 1;
                          }
                          return parseFloat(a.price) - parseFloat(b.price);
                        }).map((quote) => (
                          <div 
                            key={quote.serviceId} 
                            className={`border rounded-lg p-4 bg-card ${!quote.isAvailable ? 'opacity-60' : ''} ${selectedServices.has(quote.serviceId) ? 'ring-2 ring-primary border-primary' : ''}`}
                            data-testid={`quote-card-${quote.serviceId}`}
                          >
                            <div className="flex gap-3">
                              {quote.isAvailable && (
                                <div className="flex items-start pt-1">
                                  <Checkbox
                                    id={`select-${quote.serviceId}`}
                                    checked={selectedServices.has(quote.serviceId)}
                                    onCheckedChange={() => toggleServiceSelection(quote.serviceId)}
                                    data-testid={`checkbox-select-${quote.serviceId}`}
                                  />
                                </div>
                              )}
                              <div className="flex-1">
                                <label 
                                  htmlFor={`select-${quote.serviceId}`}
                                  className={`font-semibold ${quote.isAvailable ? 'cursor-pointer' : ''}`}
                                >
                                  {quote.serviceName}
                                </label>
                                {quote.serviceDescription && (
                                  <p className="text-sm text-muted-foreground mt-1">{quote.serviceDescription}</p>
                                )}
                                {quote.isAvailable && (
                                  <div className="flex flex-wrap gap-2 mt-2">
                                    {quote.repairTime && (
                                      <span className="text-xs bg-muted px-2 py-1 rounded">
                                        {quote.repairTime}
                                      </span>
                                    )}
                                    {quote.warranty && (
                                      <span className="text-xs bg-muted px-2 py-1 rounded">
                                        {quote.warranty} warranty
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                              <div className="text-right shrink-0">
                                {quote.isAvailable ? (
                                  <>
                                    <p className="text-xl font-bold text-primary">${quote.price}</p>
                                    <p className="text-xs text-muted-foreground">plus taxes</p>
                                  </>
                                ) : (
                                  <p className="text-sm font-medium text-muted-foreground">Not Available</p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}

                        {/* Selected Services Summary */}
                        {selectedServices.size > 0 && (
                          <div className="sticky bottom-2">
                            <Card className="shadow-lg border-primary/20">
                              <CardContent className="p-4">
                                {/* Show previously selected services from other categories */}
                                {otherCategorySelectedQuotes.length > 0 && (
                                  <div className="mb-3 pb-3 border-b">
                                    <p className="text-xs text-muted-foreground mb-2">Previously selected:</p>
                                    {otherCategorySelectedQuotes.map(q => (
                                      <div key={q.serviceId} className="flex items-center justify-between text-sm py-1 gap-2">
                                        <span className="text-muted-foreground flex-1">{q.serviceName}</span>
                                        <span className="font-medium">${q.price}</span>
                                        <Button 
                                          variant="ghost" 
                                          size="icon" 
                                          className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                          onClick={() => toggleServiceSelection(q.serviceId)}
                                          data-testid={`button-remove-${q.serviceId}`}
                                        >
                                          <X className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    ))}
                                  </div>
                                )}
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
                                  <Button size="sm" onClick={() => setStep(5)} data-testid="button-continue-to-quote">
                                    <ChevronRight className="h-4 w-4 mr-1" />
                                    Continue
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          </div>
                        )}
                        
                        <div className="pt-4 border-t">
                          <Button variant="outline" className="w-full" onClick={resetForm} data-testid="button-new-quote">
                            Get Another Quote
                          </Button>
                        </div>
                      </div>
                      )
                    })() : (
                      // Auto-fetch quotes if none loaded yet (for single category case)
                      (() => {
                        const servicesToFetch = selectedCategoryId
                          ? selectedCategoryId === "other"
                            ? uncategorized
                            : deviceServices.filter(ds => ds.service.category?.id === selectedCategoryId)
                          : deviceServices;
                        
                        if (servicesToFetch.length > 0 && !quotesLoading) {
                          handleDirectServicesView(servicesToFetch);
                        }
                        return (
                          <div className="flex justify-center py-8">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                          </div>
                        );
                      })()
                    )}
                  </>
                );
              })()}
            </CardContent>
          </Card>
        )}

        {/* Step 5: Quote Summary & Contact Form */}
        {step === 5 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Your Repair Quote</CardTitle>
              <CardDescription className="text-xs">Review and provide contact details</CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                variant="secondary" 
                size="sm"
                className="mb-4" 
                onClick={() => setStep(4)}
                data-testid="button-back-step4"
              >
                Back to services
              </Button>

              {combinedQuoteSent ? (
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg text-center">
                    <div className="flex items-center justify-center gap-2 text-green-700 dark:text-green-400 mb-2">
                      <Check className="h-5 w-5" />
                      <span className="font-semibold">Quote Sent!</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Check your email{contactInfo.phone ? " and phone" : ""} for your quote.
                    </p>
                  </div>
                  <Button variant="outline" size="sm" className="w-full" onClick={resetForm} data-testid="button-new-quote-success">
                    Get Another Quote
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Quote Summary */}
                  <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                    <h3 className="font-semibold text-sm">Selected Services</h3>
                    <div className="space-y-1">
                      {getSelectedQuotes().map(q => (
                        <div key={q.serviceId} className="flex items-center justify-between py-1 border-b last:border-b-0 gap-2">
                          <div className="flex-1">
                            <p className="text-sm font-medium">{q.serviceName}</p>
                            <p className="text-xs text-muted-foreground">{q.deviceName}</p>
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
                                  setStep(4);
                                }
                              }}
                              data-testid={`button-remove-summary-${q.serviceId}`}
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
              )}
            </CardContent>
          </Card>
        )}

        {/* Footer with disclaimer */}
        <div className="mt-6 pt-4 border-t text-xs text-muted-foreground text-center space-y-1">
          <p>All prices are estimates only and subject to change. In-store verification of issues required.</p>
          {partsLastUpdated?.content && (
            <p>Prices last updated: {formatLastUpdated(partsLastUpdated.content)}</p>
          )}
        </div>
      </div>
    </div>
  );
}
