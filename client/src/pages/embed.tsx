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
import type { DeviceType, Device, DeviceServiceWithRelations, Brand, ServiceCategory } from "@shared/schema";

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

  const handleServiceSelect = (service: DeviceServiceWithRelations) => {
    setSelectedServiceId(service.id);
    setStep(5);
  };

  const handleContactSubmitAndGetQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDeviceId || !selectedServiceId) return;

    setQuoteLoading(true);
    try {
      const res = await fetch(`/api/calculate-quote/${selectedServiceId}`);
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

        submitQuoteMutation.mutate({
          customerName: contactInfo.name,
          customerEmail: contactInfo.email,
          customerPhone: contactInfo.phone || undefined,
          deviceId: selectedDeviceId,
          deviceServiceId: selectedServiceId,
          optIn: optInQuote,
        });
        setStep(6);
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
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-9 w-9"
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

        <div className="flex items-center justify-center mb-6 gap-2">
          {[1, 2, 3, 4, 5, 6].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                  step >= s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}
              >
                {step > s ? <Check className="h-3 w-3" /> : s}
              </div>
              {s < 6 && <div className={`w-4 h-0.5 ${step > s ? "bg-primary" : "bg-muted"}`} />}
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
                  <Button variant="outline" className="w-full justify-start" onClick={() => setStep(1)} data-testid="button-back-step1">
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
              <CardTitle>{selectedCategoryId ? "Select Service Type" : "Select Repair Category"}</CardTitle>
              <CardDescription>{selectedCategoryId ? "Choose your preferred service option" : "What needs to be fixed?"}</CardDescription>
            </CardHeader>
            <CardContent>
              {servicesLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : deviceServices.length === 0 ? (
                <>
                  <Button variant="outline" className="w-full justify-start mb-4" onClick={() => { if (usedSearch) { resetForm(); } else { setStep(3); } }} data-testid="button-back-step3">
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

                if (hasMultipleCategories && !selectedCategoryId) {
                  return (
                    <div className="space-y-2">
                      <Button variant="outline" className="w-full justify-start" onClick={() => { if (usedSearch) { resetForm(); } else { setStep(3); } }} data-testid="button-back-step3">
                        {usedSearch ? "Start Over" : "Back"}
                      </Button>
                      {categories.map((cat) => (
                        <Button
                          key={cat.id}
                          variant="outline"
                          className="w-full justify-between hover-elevate"
                          onClick={() => setSelectedCategoryId(cat.id)}
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
                          onClick={() => setSelectedCategoryId("other")}
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

                const filteredServices = selectedCategoryId
                  ? selectedCategoryId === "other"
                    ? uncategorized
                    : deviceServices.filter(ds => ds.service.category?.id === selectedCategoryId)
                  : deviceServices;

                return (
                  <div className="space-y-2">
                    <Button 
                      variant="outline" 
                      className="w-full justify-start" 
                      onClick={() => {
                        if (hasMultipleCategories && selectedCategoryId) {
                          setSelectedCategoryId(null);
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
                    {filteredServices.map((ds) => (
                      <Button
                        key={ds.id}
                        variant="outline"
                        className="w-full justify-start hover-elevate"
                        onClick={() => handleServiceSelect(ds)}
                        data-testid={`button-service-${ds.id}`}
                      >
                        <div className="text-left">
                          <div className="font-medium">{ds.service.name}</div>
                          {ds.service.description && (
                            <div className="text-xs text-muted-foreground">{ds.service.description}</div>
                          )}
                        </div>
                        <ChevronRight className="h-4 w-4 ml-auto" />
                      </Button>
                    ))}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        )}

        {step === 5 && (
          <Card>
            <CardHeader>
              <CardTitle>Your Contact Information</CardTitle>
              <CardDescription>Enter your details to receive your repair quote</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleContactSubmitAndGetQuote} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={contactInfo.name}
                    onChange={(e) => setContactInfo({ ...contactInfo, name: e.target.value })}
                    required
                    data-testid="input-customer-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={contactInfo.email}
                    onChange={(e) => setContactInfo({ ...contactInfo, email: e.target.value })}
                    required
                    data-testid="input-customer-email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone (optional)</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={contactInfo.phone}
                    onChange={(e) => setContactInfo({ ...contactInfo, phone: e.target.value })}
                    data-testid="input-customer-phone"
                  />
                </div>
                <div className="pt-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="optInQuote" 
                      checked={optInQuote} 
                      onCheckedChange={(checked) => setOptInQuote(checked === true)}
                      data-testid="checkbox-optin-quote"
                    />
                    <Label htmlFor="optInQuote" className="text-sm font-normal cursor-pointer">
                      I agree to receive my quote via email and SMS
                    </Label>
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setStep(4)} data-testid="button-back-step4">
                    Back
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={quoteLoading}
                    data-testid="button-submit-quote"
                  >
                    {quoteLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Get My Quote"
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {step === 6 && quoteResult && (
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <Check className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Your Repair Quote</CardTitle>
              <CardDescription>We've received your request and will be in touch soon</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-primary/10 rounded-lg p-6 mb-6 text-center">
                <p className="text-sm text-muted-foreground mb-1">{quoteResult.deviceName}</p>
                <p className="font-medium mb-2">{quoteResult.serviceName}</p>
                {quoteResult.serviceDescription && (
                  <p className="text-sm text-muted-foreground mb-3">{quoteResult.serviceDescription}</p>
                )}
                <p className="text-4xl font-bold text-primary">${quoteResult.price}</p>
                <p className="text-sm text-muted-foreground mt-1">plus taxes</p>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-6">
                {quoteResult.repairTime && (
                  <div className="bg-muted rounded-lg p-4 text-center">
                    <p className="text-xs text-muted-foreground mb-1">Repair Time</p>
                    <p className="font-semibold">{quoteResult.repairTime}</p>
                  </div>
                )}
                {quoteResult.warranty && (
                  <div className="bg-muted rounded-lg p-4 text-center">
                    <p className="text-xs text-muted-foreground mb-1">Warranty</p>
                    <p className="font-semibold">{quoteResult.warranty}</p>
                  </div>
                )}
              </div>
              <Button className="w-full" onClick={resetForm} data-testid="button-new-quote">
                <RotateCcw className="h-4 w-4 mr-2" />
                Get Another Quote
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
