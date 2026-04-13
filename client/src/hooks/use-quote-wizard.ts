import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Device, DeviceServiceWithRelations, Brand, DeviceType, MessageTemplate } from "@shared/schema";

const trackedQuoteViews = new Set<string>();

export type DeviceSearchResult = Device & {
  brand?: Brand | null;
  deviceType?: DeviceType;
};

export type QuoteItem = {
  deviceServiceId: string;
  serviceId: string;
  serviceName: string;
  serviceDescription?: string;
  serviceImageUrl?: string;
  deviceName: string;
  price: string;
  repairTime?: string;
  warranty?: string;
  isAvailable: boolean;
  hasPart: boolean;
  categoryId?: string;
  categoryName?: string;
  categoryDescription?: string;
  categoryImageUrl?: string;
  partSku?: string;
  primaryPartSkus?: string[];
  additionalPartSkus?: string[];
  inStock?: boolean;
  bypassMultiDiscount?: boolean;
};

export type ViewState = 'search' | 'services' | 'quote' | 'contact' | 'unknown' | 'success';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[0-9\s\-\(\)\+]+$/;

export function validateEmail(email: string): string | null {
  if (!email) return "Email is required";
  if (!EMAIL_REGEX.test(email)) return "Please enter a valid email address";
  return null;
}

export function validatePhone(phone: string): string | null {
  if (!phone) return null;
  if (!PHONE_REGEX.test(phone)) return "Phone number can only contain digits, spaces, dashes, parentheses, and +";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) return "Phone number is too short";
  if (digits.length > 15) return "Phone number is too long";
  return null;
}

export function sanitizePhone(phone: string): string {
  return phone.replace(/[^0-9\s\-\(\)\+]/g, "");
}

export interface QuoteWizardSettings {
  multiDiscountSettings?: { enabled: boolean; amount: number };
  hidePricesUntilContact: boolean;
  hidePricesCompletely: boolean;
  pricingSource: string;
  partsLastUpdated?: MessageTemplate | null;
}

export function useQuoteWizard(settings: QuoteWizardSettings) {
  const { toast } = useToast();

  const [view, setView] = useState<ViewState>('search');
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<DeviceSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<DeviceSearchResult | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  const [pickerTypeId, setPickerTypeId] = useState<string | null>(null);
  const [pickerBrandId, setPickerBrandId] = useState<string | null>(null);

  const [allQuotes, setAllQuotes] = useState<QuoteItem[]>([]);
  const [stockData, setStockData] = useState<Record<string, number>>({});
  const [stockLoading, setStockLoading] = useState(false);
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set());
  const [combinedQuoteSent, setCombinedQuoteSent] = useState(false);
  const [autoSentQuote, setAutoSentQuote] = useState(false);
  const [contactCollectedEarly, setContactCollectedEarly] = useState(false);
  const [pendingCategoryId, setPendingCategoryId] = useState<string | null>(null);

  const [contactInfo, setContactInfo] = useState({ name: "", email: "", phone: "" });
  const [notes, setNotes] = useState("");

  const [unknownDeviceInfo, setUnknownDeviceInfo] = useState({
    name: "",
    email: "",
    phone: "",
    deviceDescription: "",
    issueDescription: ""
  });
  const [unknownQuoteSent, setUnknownQuoteSent] = useState(false);

  const [contactErrors, setContactErrors] = useState<{ email?: string; phone?: string }>({});
  const [unknownErrors, setUnknownErrors] = useState<{ email?: string; phone?: string }>({});

  const { multiDiscountSettings, hidePricesUntilContact, hidePricesCompletely } = settings;

  const { data: deviceServices = [], isLoading: servicesLoading } = useQuery<DeviceServiceWithRelations[]>({
    queryKey: [`/api/device-services/by-device/${selectedDeviceId}`],
    enabled: !!selectedDeviceId,
  });

  const { data: brandCategoryLinks = [] } = useQuery<{ id: string; brandId: string; categoryId: string }[]>({
    queryKey: ["/api/brand-service-categories"],
  });

  const { data: serviceCategoriesData = [] } = useQuery<{ id: string; name: string; description?: string; imageUrl?: string; displayOrder: number }[]>({
    queryKey: ["/api/service-categories"],
  });

  const { data: pickerDeviceTypes = [] } = useQuery<(DeviceType & { imageUrl?: string })[]>({
    queryKey: ["/api/device-types"],
  });

  const { data: pickerBrands = [], isLoading: pickerBrandsLoading, isFetched: pickerBrandsFetched } = useQuery<Brand[]>({
    queryKey: ["/api/brands/by-type", pickerTypeId],
    enabled: !!pickerTypeId,
  });

  const { data: pickerDevices = [], isLoading: pickerDevicesLoading, isFetched: pickerDevicesFetched } = useQuery<DeviceSearchResult[]>({
    queryKey: [`/api/devices?typeId=${pickerTypeId}&brandId=${pickerBrandId}`],
    enabled: !!pickerTypeId && !!pickerBrandId,
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

  useEffect(() => {
    const titles: Record<string, string> = {
      search: "Get a Repair Quote | 519 Tech Services",
      services: "Select Repair Services | 519 Tech Services",
      quote: "Your Repair Quote | 519 Tech Services",
      contact: "Contact Details | 519 Tech Services",
      unknown: "Describe Your Device | 519 Tech Services",
      success: "Quote Submitted | 519 Tech Services",
    };
    document.title = titles[view] || "Get a Repair Quote | 519 Tech Services";
  }, [view]);

  const handlePickerTypeClick = async (typeId: string, typeName: string) => {
    try {
      const res = await fetch(`/api/brands/by-type/${typeId}`);
      if (res.ok) {
        const linkedBrands = await res.json();
        if (linkedBrands.length === 0) {
          setUnknownDeviceInfo(prev => ({
            ...prev,
            deviceDescription: typeName,
          }));
          setView('unknown');
          return;
        }
      }
    } catch {}
    setPickerTypeId(typeId);
    setPickerBrandId(null);
  };

  useEffect(() => {
    if (pickerTypeId && pickerBrandId && pickerDevicesFetched && !pickerDevicesLoading && pickerDevices.length === 0) {
      const typeName = pickerDeviceTypes.find(t => t.id === pickerTypeId)?.name || "";
      const brandName = pickerBrands.find(b => b.id === pickerBrandId)?.name || "";
      setUnknownDeviceInfo(prev => ({
        ...prev,
        deviceDescription: [brandName, typeName].filter(Boolean).join(" "),
      }));
      setPickerTypeId(null);
      setPickerBrandId(null);
      setView('unknown');
    }
  }, [pickerTypeId, pickerBrandId, pickerDevices, pickerDevicesLoading, pickerDevicesFetched]);

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
    }, 200);
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  const submitCombinedQuoteMutation = useMutation({
    mutationFn: async (data: {
      customerName: string;
      customerEmail: string;
      customerPhone?: string;
      deviceId: string;
      deviceServiceIds: string[];
      notes?: string;
      multiServiceDiscount?: number;
    }) => {
      const res = await apiRequest("POST", "/api/quote-requests/combined", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quote-requests"] });
      setCombinedQuoteSent(true);
      if (!autoSentQuote) {
        setView('success');
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

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
    setPickerTypeId(null);
    setPickerBrandId(null);
    setView('services');
  };

  const handleDirectServicesView = async (services: DeviceServiceWithRelations[]) => {
    setQuotesLoading(true);
    try {
      const deviceServiceIds = services.map(ds => ds.id);
      let batchResults: any[] = [];
      try {
        const res = await fetch('/api/calculate-quotes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deviceServiceIds }),
        });
        if (!res.ok) throw new Error('Batch quote calculation failed');
        batchResults = await res.json();
      } catch {
        batchResults = [];
      }

      const resultMap = new Map<string, any>();
      for (const r of batchResults) {
        if (r?.deviceServiceId) resultMap.set(r.deviceServiceId, r);
      }

      const quotes = services.map((ds) => {
        const quote = resultMap.get(ds.id);
        if (quote) {
          return {
            deviceServiceId: ds.id,
            serviceId: ds.service.id,
            serviceName: ds.service.name,
            serviceDescription: ds.service.description || undefined,
            serviceImageUrl: ds.service.imageUrl || undefined,
            deviceName: ds.device.name,
            price: quote.totalPrice,
            repairTime: ds.service.repairTime || undefined,
            warranty: ds.service.warranty || undefined,
            isAvailable: quote.isAvailable,
            hasPart: quote.hasPart,
            categoryId: ds.service.category?.id,
            categoryName: ds.service.category?.name,
            categoryDescription: ds.service.category?.description || undefined,
            categoryImageUrl: ds.service.category?.imageUrl || undefined,
            partSku: quote.partSku || undefined,
            primaryPartSkus: quote.primaryPartSkus || [],
            additionalPartSkus: quote.additionalPartSkus || [],
            bypassMultiDiscount: quote.bypassMultiDiscount || false,
          };
        }
        return {
          deviceServiceId: ds.id,
          serviceId: ds.service.id,
          serviceName: ds.service.name,
          serviceDescription: ds.service.description || undefined,
          serviceImageUrl: ds.service.imageUrl || undefined,
          deviceName: ds.device.name,
          price: "0.00",
          repairTime: ds.service.repairTime || undefined,
          warranty: ds.service.warranty || undefined,
          isAvailable: false,
          hasPart: false,
          categoryId: ds.service.category?.id,
          categoryName: ds.service.category?.name,
          categoryDescription: ds.service.category?.description || undefined,
          categoryImageUrl: ds.service.category?.imageUrl || undefined,
          partSku: undefined,
          primaryPartSkus: [],
          additionalPartSkus: [],
          bypassMultiDiscount: false,
        };
      });

      const anyServiceAvailable = quotes.some(q => q.isAvailable);
      if (!anyServiceAvailable && quotes.length > 0) {
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
        const quoteCategoryId = quote.categoryId;
        if (quoteCategoryId) {
          allQuotes.forEach(q => {
            if (q.categoryId === quoteCategoryId && q.serviceId !== serviceId) {
              next.delete(q.serviceId);
            }
          });
        }
        next.add(serviceId);

        if (!trackedQuoteViews.has(quote.deviceServiceId)) {
          trackedQuoteViews.add(quote.deviceServiceId);
          fetch("/api/quote-views", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ deviceServiceId: quote.deviceServiceId, calculatedPrice: quote.price }),
          }).catch(() => {});
        }
      }
      return next;
    });
  };

  const handleContinueToQuote = () => {
    setView('quote');
  };

  const getSelectedQuotes = () => {
    return allQuotes.filter(q => selectedServices.has(q.serviceId));
  };

  const getMultiServiceDiscount = () => {
    if (!multiDiscountSettings?.enabled) return 0;
    const selectedQuotes = getSelectedQuotes();
    const eligibleCount = selectedQuotes.filter(q => !q.bypassMultiDiscount).length;
    if (eligibleCount >= 2) {
      return multiDiscountSettings.amount || 0;
    }
    return 0;
  };

  const getSubtotal = () => {
    return getSelectedQuotes().reduce((sum, q) => sum + parseFloat(q.price), 0);
  };

  const getGrandTotal = () => {
    return getSubtotal() - getMultiServiceDiscount();
  };

  const validateContactForm = (): boolean => {
    const emailError = validateEmail(contactInfo.email);
    const phoneError = validatePhone(contactInfo.phone);
    setContactErrors({ email: emailError || undefined, phone: phoneError || undefined });
    return !emailError && !phoneError;
  };

  const validateUnknownForm = (): boolean => {
    const emailError = validateEmail(unknownDeviceInfo.email);
    const phoneError = validatePhone(unknownDeviceInfo.phone);
    setUnknownErrors({ email: emailError || undefined, phone: phoneError || undefined });
    return !emailError && !phoneError;
  };

  const handleSendCombinedQuote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDeviceId || selectedServices.size === 0) return;
    if (!validateContactForm()) return;

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
      multiServiceDiscount: getMultiServiceDiscount(),
    });
  };

  const handleViewAndSendQuote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactInfo.name || !contactInfo.email) return;
    if (!validateContactForm()) return;
    if (!selectedDeviceId || selectedServices.size === 0) return;

    setView('quote');
    setAutoSentQuote(true);

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
      multiServiceDiscount: getMultiServiceDiscount(),
    });
  };

  const handleContinueWithEarlyContact = () => {
    if (!selectedDeviceId || selectedServices.size === 0) return;
    setView('quote');
    setAutoSentQuote(true);
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
      multiServiceDiscount: getMultiServiceDiscount(),
    });
  };

  const handleSubmitUnknownDevice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateUnknownForm()) return;
    submitUnknownDeviceMutation.mutate({
      customerName: unknownDeviceInfo.name,
      customerEmail: unknownDeviceInfo.email,
      customerPhone: unknownDeviceInfo.phone || undefined,
      deviceDescription: unknownDeviceInfo.deviceDescription,
      issueDescription: unknownDeviceInfo.issueDescription,
    });
  };

  const handleEarlyContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactInfo.name || !contactInfo.email) return;
    if (!validateContactForm()) return;
    setContactCollectedEarly(true);
    if (pendingCategoryId) {
      setView('services');
      proceedWithCategorySelect(pendingCategoryId);
      setPendingCategoryId(null);
    }
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
    setAutoSentQuote(false);
    setContactCollectedEarly(false);
    setPendingCategoryId(null);
    setContactInfo({ name: "", email: "", phone: "" });
    setNotes("");
    setUnknownDeviceInfo({ name: "", email: "", phone: "", deviceDescription: "", issueDescription: "" });
    setUnknownQuoteSent(false);
    setContactErrors({});
    setUnknownErrors({});
  };

  const categories = [...serviceCategoriesData].sort((a, b) => {
    return (a.displayOrder ?? 999) - (b.displayOrder ?? 999);
  });

  const currentCategoryQuotes = selectedCategoryId
    ? allQuotes.filter(q => q.categoryId === selectedCategoryId)
    : allQuotes.filter(q => !q.categoryId);

  const sortedQuotes = [...currentCategoryQuotes].sort((a, b) => {
    if (a.isAvailable && !b.isAvailable) return -1;
    if (!a.isAvailable && b.isAvailable) return 1;
    return parseFloat(a.price) - parseFloat(b.price);
  });

  const proceedWithCategorySelect = (catId: string) => {
    const catQuotes = catId === "other"
      ? allQuotes.filter(q => !q.categoryId)
      : allQuotes.filter(q => q.categoryId === catId);

    setCategoryLoading(true);

    if (selectedDevice?.id) {
      fetch('/api/prefetch-category-parts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: selectedDevice.id,
          categoryId: catId !== "other" ? catId : null
        })
      }).catch(err => console.log('Prefetch error (non-critical):', err));
    }

    const allSkus = new Set<string>();
    catQuotes.forEach(q => {
      if (q.primaryPartSkus && q.primaryPartSkus.length > 0) {
        q.primaryPartSkus.forEach((sku: string) => allSkus.add(sku));
      }
      if (q.additionalPartSkus && q.additionalPartSkus.length > 0) {
        q.additionalPartSkus.forEach((sku: string) => allSkus.add(sku));
      }
    });
    const skus = Array.from(allSkus);

    if (skus.length > 0) {
      setStockLoading(true);
      fetch('/api/repairdesk/stock-enabled')
        .then(res => res.json())
        .then(({ enabled }) => {
          if (!enabled) return null;
          return fetch('/api/repairdesk/check-stock', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ skus }),
          });
        })
        .then(res => res?.ok ? res.json() : {})
        .then(stockInfo => stockInfo && setStockData(prev => ({ ...prev, ...stockInfo })))
        .catch(() => console.log('Stock check not available'))
        .finally(() => setStockLoading(false));
    }

    setTimeout(() => {
      setCategoryLoading(false);
      setSelectedCategoryId(catId);
    }, 5000);
  };

  const handleCategorySelect = (catId: string) => {
    const catQuotes = catId === "other"
      ? allQuotes.filter(q => !q.categoryId)
      : allQuotes.filter(q => q.categoryId === catId);

    if (catQuotes.length === 0) {
      const deviceName = selectedDevice?.name || "";
      const brandName = selectedDevice?.brand?.name || "";
      const fullDeviceName = brandName ? `${brandName} ${deviceName}` : deviceName;
      const categoryName = serviceCategoriesData.find(c => c.id === catId)?.name || "Repair";
      setUnknownDeviceInfo(prev => ({
        ...prev,
        deviceDescription: fullDeviceName,
        issueDescription: `Interested in: ${categoryName}`
      }));
      setView('unknown');
      return;
    }

    const anyAvailable = catQuotes.some(q => q.isAvailable);

    if (!anyAvailable && catQuotes.length > 0) {
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

    if ((hidePricesUntilContact || hidePricesCompletely) && !contactCollectedEarly) {
      setPendingCategoryId(catId);
      setView('contact');
      return;
    }

    proceedWithCategorySelect(catId);
  };

  const handleNotListedClick = () => {
    const deviceName = selectedDevice?.name || "";
    const brandName = selectedDevice?.brand?.name || "";
    const fullDeviceName = brandName ? `${brandName} ${deviceName}` : deviceName;
    setUnknownDeviceInfo(prev => ({
      ...prev,
      deviceDescription: fullDeviceName
    }));
    setView('unknown');
  };

  const updateContactInfo = (field: string, value: string) => {
    if (field === 'phone') {
      value = sanitizePhone(value);
    }
    setContactInfo(prev => ({ ...prev, [field]: value }));
    if (field === 'email' && contactErrors.email) {
      setContactErrors(prev => ({ ...prev, email: undefined }));
    }
    if (field === 'phone' && contactErrors.phone) {
      setContactErrors(prev => ({ ...prev, phone: undefined }));
    }
  };

  const updateUnknownInfo = (field: string, value: string) => {
    if (field === 'phone') {
      value = sanitizePhone(value);
    }
    setUnknownDeviceInfo(prev => ({ ...prev, [field]: value }));
    if (field === 'email' && unknownErrors.email) {
      setUnknownErrors(prev => ({ ...prev, email: undefined }));
    }
    if (field === 'phone' && unknownErrors.phone) {
      setUnknownErrors(prev => ({ ...prev, phone: undefined }));
    }
  };

  return {
    view,
    setView,
    searchQuery,
    setSearchQuery,
    searchResults,
    searchLoading,
    showSearch,
    setShowSearch,

    selectedDevice,
    selectedDeviceId,
    selectedCategoryId,
    setSelectedCategoryId,
    categoryLoading,

    pickerTypeId,
    setPickerTypeId,
    pickerBrandId,
    setPickerBrandId,
    pickerDeviceTypes,
    pickerBrands,
    pickerBrandsLoading,
    pickerDevices,
    pickerDevicesLoading,

    allQuotes,
    stockData,
    stockLoading,
    quotesLoading,
    selectedServices,
    setSelectedServices,
    combinedQuoteSent,
    autoSentQuote,
    contactCollectedEarly,
    pendingCategoryId,
    setPendingCategoryId,

    contactInfo,
    updateContactInfo,
    notes,
    setNotes,
    contactErrors,

    unknownDeviceInfo,
    updateUnknownInfo,
    unknownQuoteSent,
    unknownErrors,

    deviceServices,
    servicesLoading,
    serviceCategoriesData,
    brandCategoryLinks,

    categories,
    currentCategoryQuotes,
    sortedQuotes,

    submitCombinedQuoteMutation,
    submitUnknownDeviceMutation,

    clearSearch,
    handleSelectDevice,
    toggleServiceSelection,
    handleContinueToQuote,
    handleContinueWithEarlyContact,
    getSelectedQuotes,
    getMultiServiceDiscount,
    getSubtotal,
    getGrandTotal,
    handleSendCombinedQuote,
    handleViewAndSendQuote,
    handleSubmitUnknownDevice,
    handleEarlyContactSubmit,
    handleCategorySelect,
    handleNotListedClick,
    handlePickerTypeClick,
    resetForm,
    formatLastUpdated,

    settings,
  };
}
