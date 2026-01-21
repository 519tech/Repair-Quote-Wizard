import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Smartphone, Tablet, Laptop, Monitor, Gamepad2, Watch, Headphones, Camera, ChevronRight, Check, Loader2, Wrench, Search, X } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { DeviceType, Device, DeviceServiceWithRelations, Brand, ServiceCategory, MessageTemplate } from "@shared/schema";

interface DeviceSearchResult {
  id: string;
  name: string;
  deviceTypeId: string;
  brandId: string | null;
  brand?: { id: string; name: string } | null;
  deviceType?: { id: string; name: string } | null;
}

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

export default function Home() {
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
  }>>([]);
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [sendingQuoteFor, setSendingQuoteFor] = useState<string | null>(null);
  const [quoteSentFor, setQuoteSentFor] = useState<Set<string>>(new Set());

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<DeviceSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [usedSearch, setUsedSearch] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      toast({
        title: "Quote Request Submitted",
        description: "We'll be in touch soon!",
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

  const [skippedBrandStep, setSkippedBrandStep] = useState(false);

  useEffect(() => {
    if (step === 2 && brandsFetched && !brandsLoading && brands.length === 0) {
      setSkippedBrandStep(true);
      setStep(3);
    }
  }, [step, brandsFetched, brandsLoading, brands.length]);

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

  const handleSkipBrand = () => {
    setSelectedBrandId(null);
    setSelectedDeviceId(null);
    setSelectedServiceId(null);
    setSkippedBrandStep(true);
    setStep(3);
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

  const fetchAllQuotesForServices = async (services: DeviceServiceWithRelations[]) => {
    setQuotesLoading(true);
    setAllQuotes([]);
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
              };
            }
          } catch {
            // Skip failed quotes
          }
          return null;
        })
      );
      setAllQuotes(quotes.filter((q): q is NonNullable<typeof q> => q !== null));
    } finally {
      setQuotesLoading(false);
    }
  };

  const handleCategorySelect = async (categoryId: string, services: DeviceServiceWithRelations[]) => {
    setSelectedCategoryId(categoryId);
    const filteredServices = categoryId === "other"
      ? services.filter(ds => !ds.service.category)
      : services.filter(ds => ds.service.category?.id === categoryId);
    await fetchAllQuotesForServices(filteredServices);
  };

  const handleDirectServicesView = async (services: DeviceServiceWithRelations[]) => {
    // When there's only one category or no categories, show all services with quotes
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
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Wrench className="h-6 w-6 text-primary" />
            <span className="text-xl font-semibold">RepairQuote</span>
          </div>
          <a href="/admin" className="text-sm text-muted-foreground hover:text-foreground" data-testid="link-admin">
            Admin
          </a>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Get Your Repair Quote</h1>
          <p className="text-muted-foreground">Fast, transparent pricing for device repairs</p>
        </div>

        {step < 4 && (
          <Card className="mb-8 border-2 border-primary/20">
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
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2"
                    onClick={clearSearch}
                    data-testid="button-clear-search"
                  >
                    <X className="h-4 w-4" />
                  </Button>
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

        <div className="flex items-center justify-center mb-8 gap-2">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step >= s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}
              >
                {step > s ? <Check className="h-4 w-4" /> : s}
              </div>
              {s < 4 && <div className={`w-6 h-0.5 ${step > s ? "bg-primary" : "bg-muted"}`} />}
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
                <p className="text-center py-8 text-muted-foreground">No device types available. Please contact admin.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {deviceTypes.map((type) => {
                    const Icon = iconMap[type.icon] || Smartphone;
                    return (
                      <Button
                        key={type.id}
                        variant="outline"
                        className="h-24 flex-col gap-2 hover-elevate"
                        onClick={() => handleTypeSelect(type.id)}
                        data-testid={`button-type-${type.id}`}
                      >
                        <Icon className="h-6 w-6" />
                        <span>{type.name}</span>
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
              <Button variant="secondary" className="mb-4" onClick={() => setStep(1)} data-testid="button-back-step1">
                Back to device types
              </Button>
              {brandsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : brands.length === 0 ? (
                <div className="text-center py-8 space-y-4">
                  <p className="text-muted-foreground">No specific brands configured. Proceed to select your device.</p>
                  <Button onClick={handleSkipBrand} data-testid="button-skip-brand">
                    Continue to Devices
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {brands.map((brand) => (
                    <Button
                      key={brand.id}
                      variant="outline"
                      className="h-16 hover-elevate"
                      onClick={() => handleBrandSelect(brand.id)}
                      data-testid={`button-brand-${brand.id}`}
                    >
                      {brand.name}
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
              <CardTitle>Select Your Device</CardTitle>
              <CardDescription>Choose your specific model</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="secondary" className="mb-4" onClick={() => setStep(skippedBrandStep ? 1 : 2)} data-testid="button-back-step2">
                {skippedBrandStep ? "Back to device types" : "Back to brands"}
              </Button>
              {devicesLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : devices.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">No devices available for this selection.</p>
              ) : (
                <div className="space-y-2">
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
                  <Button variant="secondary" className="mb-4" onClick={() => { if (usedSearch) { resetForm(); } else { setStep(3); } }} data-testid="button-back-step3">
                    {usedSearch ? "Start Over" : "Back to devices"}
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
                    <>
                      <Button variant="secondary" className="mb-4" onClick={() => { if (usedSearch) { resetForm(); } else { setStep(3); } }} data-testid="button-back-step3">
                        {usedSearch ? "Start Over" : "Back to devices"}
                      </Button>
                      <div className="space-y-2">
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
                    </>
                  );
                }

                // Show comparison view with all quotes
                return (
                  <>
                    <Button 
                      variant="secondary" 
                      className="mb-4" 
                      onClick={() => {
                        if (hasMultipleCategories && selectedCategoryId) {
                          setSelectedCategoryId(null);
                          setAllQuotes([]);
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
                          : "Back to devices"}
                    </Button>

                    {quotesLoading ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      </div>
                    ) : allQuotes.length > 0 ? (
                      <div className="space-y-4">
                        {[...allQuotes].sort((a, b) => {
                          // Sort unavailable quotes to the end
                          if (a.isAvailable !== b.isAvailable) {
                            return a.isAvailable ? -1 : 1;
                          }
                          // Then sort by price (lowest first)
                          return parseFloat(a.price) - parseFloat(b.price);
                        }).map((quote) => (
                          <div 
                            key={quote.serviceId} 
                            className={`border rounded-lg p-4 bg-card ${!quote.isAvailable ? 'opacity-60' : ''}`}
                            data-testid={`quote-card-${quote.serviceId}`}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                              <div className="flex-1">
                                <h3 className="font-semibold text-lg">{quote.serviceName}</h3>
                                {quote.serviceDescription && (
                                  <p className="text-sm text-muted-foreground mt-1">{quote.serviceDescription}</p>
                                )}
                                {quote.isAvailable && (
                                  <div className="flex flex-wrap gap-3 mt-3">
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
                              <div className="flex flex-col items-end gap-2 min-w-[140px]">
                                {quote.isAvailable ? (
                                  <>
                                    <p className="text-2xl font-bold text-primary">${quote.price}</p>
                                    <p className="text-xs text-muted-foreground">plus taxes</p>
                                    {quoteSentFor.has(quote.serviceId) ? (
                                      <div className="flex items-center gap-1 text-green-600 dark:text-green-400 text-sm">
                                        <Check className="h-4 w-4" />
                                        Quote Sent
                                      </div>
                                    ) : sendingQuoteFor === quote.serviceId ? (
                                      <Button 
                                        size="sm" 
                                        variant="outline"
                                        onClick={() => setSendingQuoteFor(null)}
                                        data-testid={`button-cancel-send-${quote.serviceId}`}
                                      >
                                        Cancel
                                      </Button>
                                    ) : (
                                      <Button 
                                        size="sm"
                                        onClick={() => setSendingQuoteFor(quote.serviceId)}
                                        data-testid={`button-send-quote-${quote.serviceId}`}
                                      >
                                        Send me quote
                                      </Button>
                                    )}
                                  </>
                                ) : (
                                  <p className="text-lg font-semibold text-muted-foreground">Not Available</p>
                                )}
                              </div>
                            </div>

                            {sendingQuoteFor === quote.serviceId && (
                              <form onSubmit={handleSendQuote} className="mt-4 pt-4 border-t space-y-3">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                  <div className="space-y-1">
                                    <Label htmlFor={`name-${quote.serviceId}`} className="text-xs">Name *</Label>
                                    <Input
                                      id={`name-${quote.serviceId}`}
                                      value={contactInfo.name}
                                      onChange={(e) => setContactInfo({ ...contactInfo, name: e.target.value })}
                                      required
                                      className="h-9"
                                      data-testid={`input-name-${quote.serviceId}`}
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label htmlFor={`email-${quote.serviceId}`} className="text-xs">Email *</Label>
                                    <Input
                                      id={`email-${quote.serviceId}`}
                                      type="email"
                                      value={contactInfo.email}
                                      onChange={(e) => setContactInfo({ ...contactInfo, email: e.target.value })}
                                      required
                                      className="h-9"
                                      data-testid={`input-email-${quote.serviceId}`}
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label htmlFor={`phone-${quote.serviceId}`} className="text-xs">Phone</Label>
                                    <Input
                                      id={`phone-${quote.serviceId}`}
                                      type="tel"
                                      value={contactInfo.phone}
                                      onChange={(e) => setContactInfo({ ...contactInfo, phone: e.target.value })}
                                      className="h-9"
                                      data-testid={`input-phone-${quote.serviceId}`}
                                    />
                                  </div>
                                </div>
                                <Button
                                  type="submit"
                                  size="sm"
                                  disabled={submitQuoteMutation.isPending}
                                  data-testid={`button-submit-${quote.serviceId}`}
                                >
                                  {submitQuoteMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    "Send My Quote"
                                  )}
                                </Button>
                              </form>
                            )}
                          </div>
                        ))}
                        
                        <div className="pt-4 border-t">
                          <Button variant="outline" className="w-full" onClick={resetForm} data-testid="button-new-quote">
                            Get Another Quote
                          </Button>
                        </div>
                      </div>
                    ) : (
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

        {/* Footer with disclaimer */}
        <div className="mt-8 pt-4 border-t text-xs text-muted-foreground text-center space-y-1 max-w-md mx-auto">
          <p>All prices are estimates only and subject to change. In-store verification of issues required.</p>
          {partsLastUpdated?.content && (
            <p>Prices last updated: {formatLastUpdated(partsLastUpdated.content)}</p>
          )}
        </div>
      </main>
    </div>
  );
}
