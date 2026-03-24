import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, Loader2, Pencil, Search, Filter, Link2, Layers, AlertTriangle, DollarSign, ExternalLink, X, Clock, EyeOff, Check, Calendar } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { DeviceType, Device, Part, Service, DeviceServiceWithRelations, Brand } from "@shared/schema";

export function DeviceServicesTab({ toast }: { toast: ReturnType<typeof useToast>["toast"] }) {
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState<DeviceServiceWithRelations | null>(null);
  const [deviceId, setDeviceId] = useState("");
  const [deviceSearch, setDeviceSearch] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [partSku, setPartSku] = useState("");
  const [partSearch, setPartSearch] = useState("");
  const [partId, setPartId] = useState<string | undefined>();
  const [alternativePartSkus, setAlternativePartSkus] = useState<string[]>([]);
  const [alternativePartInfo, setAlternativePartInfo] = useState<Record<string, { name: string; price: string }>>({});
  const [altPartSearch, setAltPartSearch] = useState("");
  const [editPartSku, setEditPartSku] = useState("");
  const [editPartSearch, setEditPartSearch] = useState("");
  const [editDeviceSearch, setEditDeviceSearch] = useState("");
  const [editAlternativePartSkus, setEditAlternativePartSkus] = useState<string[]>([]);
  const [editAlternativePartInfo, setEditAlternativePartInfo] = useState<Record<string, { name: string; price: string }>>({});
  const [editAltPartSearch, setEditAltPartSearch] = useState("");
  const [editAdditionalFee, setEditAdditionalFee] = useState<string>("");
  const [editManualPriceOverride, setEditManualPriceOverride] = useState<string>("");
  const [additionalPartSku, setAdditionalPartSku] = useState("");
  const [debouncedPartSearch, setDebouncedPartSearch] = useState("");
  const [debouncedEditPartSearch, setDebouncedEditPartSearch] = useState("");
  const [debouncedAltPartSearch, setDebouncedAltPartSearch] = useState("");
  const [debouncedEditAltPartSearch, setDebouncedEditAltPartSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedPartSearch(partSearch), 300);
    return () => clearTimeout(timer);
  }, [partSearch]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedEditPartSearch(editPartSearch), 300);
    return () => clearTimeout(timer);
  }, [editPartSearch]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedAltPartSearch(altPartSearch), 300);
    return () => clearTimeout(timer);
  }, [altPartSearch]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedEditAltPartSearch(editAltPartSearch), 300);
    return () => clearTimeout(timer);
  }, [editAltPartSearch]);

  const [filterBrand, setFilterBrand] = useState<string>("all");
  const [filterDevice, setFilterDevice] = useState<string>("all");
  const [filterService, setFilterService] = useState<string>("all");
  const [serviceLinkSearch, setServiceLinkSearch] = useState("");

  const [inlineEditId, setInlineEditId] = useState<string | null>(null);
  const [inlineEditSku, setInlineEditSku] = useState("");

  // Bulk add state
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkSelectedServices, setBulkSelectedServices] = useState<Set<string>>(new Set());
  const [bulkTypeId, setBulkTypeId] = useState("all");
  const [bulkBrandId, setBulkBrandId] = useState("all");
  const [bulkPartSku, setBulkPartSku] = useState("");

  const toggleBulkService = (serviceId: string) => {
    setBulkSelectedServices(prev => {
      const next = new Set(prev);
      if (next.has(serviceId)) {
        next.delete(serviceId);
      } else {
        next.add(serviceId);
      }
      return next;
    });
  };

  const { data: deviceServices = [], isLoading } = useQuery<DeviceServiceWithRelations[]>({ queryKey: ["/api/device-services"] });
  const { data: devices = [] } = useQuery<Device[]>({ queryKey: ["/api/devices"] });
  const { data: services = [] } = useQuery<Service[]>({ queryKey: ["/api/services"] });
  const { data: deviceTypes = [] } = useQuery<DeviceType[]>({ queryKey: ["/api/device-types"] });
  const { data: brands = [] } = useQuery<Brand[]>({ queryKey: ["/api/brands"] });
  const { data: dismissedAlertIds = [] } = useQuery<string[]>({ queryKey: ["/api/dismissed-alerts/active-ids"] });

  const [selectedAlertIds, setSelectedAlertIds] = useState<Set<string>>(new Set());
  const [missingPartsFilterBrand, setMissingPartsFilterBrand_] = useState("all");
  const [missingPartsFilterService, setMissingPartsFilterService_] = useState("all");
  const setMissingPartsFilterBrand = (v: string) => { setMissingPartsFilterBrand_(v); setSelectedAlertIds(new Set()); };
  const setMissingPartsFilterService = (v: string) => { setMissingPartsFilterService_(v); setSelectedAlertIds(new Set()); };

  const dismissAlertMutation = useMutation({
    mutationFn: async ({ deviceServiceId, dismissType }: { deviceServiceId: string; dismissType: "1month" | "3months" | "indefinite" }) => {
      return apiRequest("POST", "/api/dismissed-alerts", { deviceServiceId, dismissType });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dismissed-alerts/active-ids"] });
      toast({ title: "Alert dismissed" });
    },
    onError: () => {
      toast({ title: "Failed to dismiss alert", variant: "destructive" });
    },
  });

  const bulkDismissMutation = useMutation({
    mutationFn: async ({ deviceServiceIds, dismissType }: { deviceServiceIds: string[]; dismissType: "1month" | "3months" | "indefinite" }) => {
      return apiRequest("POST", "/api/dismissed-alerts/bulk", { deviceServiceIds, dismissType });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/dismissed-alerts/active-ids"] });
      setSelectedAlertIds(new Set());
      toast({ title: `${variables.deviceServiceIds.length} alert(s) dismissed` });
    },
    onError: () => {
      toast({ title: "Failed to bulk dismiss alerts", variant: "destructive" });
    },
  });

  // Filter devices based on search
  const filteredDevices = useMemo(() => {
    if (!deviceSearch.trim()) return devices;
    const search = deviceSearch.toLowerCase();
    return devices.filter(d => d.name.toLowerCase().includes(search));
  }, [devices, deviceSearch]);

  const editFilteredDevices = useMemo(() => {
    if (!editDeviceSearch.trim()) return devices;
    const search = editDeviceSearch.toLowerCase();
    return devices.filter(d => d.name.toLowerCase().includes(search));
  }, [devices, editDeviceSearch]);
  
  const partSearchUrl = useMemo(() => {
    if (!debouncedPartSearch) return null;
    const params = new URLSearchParams({ page: "1", limit: "50", search: debouncedPartSearch });
    return `/api/parts?${params}`;
  }, [debouncedPartSearch]);
  
  const { data: searchedParts } = useQuery<{ parts: Part[]; total: number }>({ 
    queryKey: [partSearchUrl || "/api/parts-disabled"],
    enabled: !!partSearchUrl
  });
  
  const editPartSearchUrl = useMemo(() => {
    if (!debouncedEditPartSearch) return null;
    const params = new URLSearchParams({ page: "1", limit: "50", search: debouncedEditPartSearch });
    return `/api/parts?${params}`;
  }, [debouncedEditPartSearch]);
  
  const { data: editSearchedParts } = useQuery<{ parts: Part[]; total: number }>({ 
    queryKey: [editPartSearchUrl || "/api/parts-disabled-edit"],
    enabled: !!editPartSearchUrl
  });

  const altPartSearchUrl = useMemo(() => {
    if (!debouncedAltPartSearch) return null;
    const params = new URLSearchParams({ page: "1", limit: "50", search: debouncedAltPartSearch });
    return `/api/parts?${params}`;
  }, [debouncedAltPartSearch]);
  
  const { data: altSearchedParts } = useQuery<{ parts: Part[]; total: number }>({ 
    queryKey: [altPartSearchUrl || "/api/parts-disabled-alt"],
    enabled: !!altPartSearchUrl
  });

  const editAltPartSearchUrl = useMemo(() => {
    if (!debouncedEditAltPartSearch) return null;
    const params = new URLSearchParams({ page: "1", limit: "50", search: debouncedEditAltPartSearch });
    return `/api/parts?${params}`;
  }, [debouncedEditAltPartSearch]);
  
  const { data: editAltSearchedParts } = useQuery<{ parts: Part[]; total: number }>({ 
    queryKey: [editAltPartSearchUrl || "/api/parts-disabled-edit-alt"],
    enabled: !!editAltPartSearchUrl
  });

  // Additional parts for the current edit item
  const { data: dsAdditionalParts = [], refetch: refetchDsAdditionalParts } = useQuery<{ id: string; partId: string | null; partSku: string | null; isPrimary: boolean; part: Part | null }[]>({
    queryKey: [`/api/device-services/${editItem?.id}/parts`],
    enabled: !!editItem?.id
  });

  // Additional part SKU lookup
  const { data: dsAdditionalSkuPart } = useQuery<Part | null>({
    queryKey: [`/api/parts/sku/${encodeURIComponent(additionalPartSku)}`],
    enabled: additionalPartSku.length > 0
  });

  const uniqueBrands = useMemo(() => {
    const brandSet = new Set<string>();
    deviceServices.forEach(ds => {
      if (ds.device?.brand?.name) brandSet.add(ds.device.brand.name);
    });
    return Array.from(brandSet).sort();
  }, [deviceServices]);

  const uniqueDevices = useMemo(() => {
    const deviceSet = new Set<string>();
    deviceServices.forEach(ds => {
      if (ds.device?.name) deviceSet.add(ds.device.name);
    });
    return Array.from(deviceSet).sort();
  }, [deviceServices]);

  const uniqueServices = useMemo(() => {
    const serviceSet = new Set<string>();
    deviceServices.forEach(ds => {
      if (ds.service?.name) serviceSet.add(ds.service.name);
    });
    return Array.from(serviceSet).sort();
  }, [deviceServices]);

  const filteredDeviceServices = useMemo(() => {
    const filtered = deviceServices.filter(ds => {
      if (filterBrand !== "all" && ds.device?.brand?.name !== filterBrand) return false;
      if (filterDevice !== "all" && ds.device?.name !== filterDevice) return false;
      if (filterService !== "all" && ds.service?.name !== filterService) return false;
      if (serviceLinkSearch) {
        const search = serviceLinkSearch.toLowerCase();
        const searchText = `${ds.device?.name || ""} ${ds.device?.brand?.name || ""} ${ds.service?.name || ""} ${ds.part?.sku || ""} ${ds.part?.name || ""}`.toLowerCase();
        if (!searchText.includes(search)) return false;
      }
      return true;
    });
    // Sort by device name, then service name to maintain consistent order
    return filtered.sort((a, b) => {
      const deviceCompare = (a.device?.name || "").localeCompare(b.device?.name || "");
      if (deviceCompare !== 0) return deviceCompare;
      return (a.service?.name || "").localeCompare(b.service?.name || "");
    });
  }, [deviceServices, filterBrand, filterDevice, filterService, serviceLinkSearch]);

  const filteredParts = searchedParts?.parts || [];
  const editFilteredParts = editSearchedParts?.parts || [];

  // Compute service links with errors:
  // 1. Orphaned SKU: partSku exists but part was deleted (partId is null but partSku is set)
  // 2. Missing part: no part assigned AND service is NOT labour-only
  const errorLinks = useMemo(() => {
    return deviceServices.filter(ds => {
      if ((ds as any).manualPriceOverride) return false;
      const hasPart = ds.part !== null;
      const hasOrphanedSku = ds.partSku && !hasPart; // SKU was set but part was deleted
      const isLabourOnly = ds.service?.labourOnly === true;
      const needsPartButMissing = !hasPart && !isLabourOnly && !ds.partSku;
      return hasOrphanedSku || needsPartButMissing;
    });
  }, [deviceServices]);
  
  // Separate orphaned SKU errors from missing part errors for better messaging
  // Filter out dismissed alerts
  const orphanedSkuLinks = useMemo(() => {
    return deviceServices.filter(ds => ds.partSku && !ds.part && !(ds as any).manualPriceOverride && !dismissedAlertIds.includes(ds.id));
  }, [deviceServices, dismissedAlertIds]);
  
  const missingPartLinks = useMemo(() => {
    return deviceServices.filter(ds => {
      if ((ds as any).manualPriceOverride) return false;
      const hasPart = ds.part !== null;
      const isLabourOnly = ds.service?.labourOnly === true;
      return !hasPart && !isLabourOnly && !ds.partSku && !dismissedAlertIds.includes(ds.id);
    });
  }, [deviceServices, dismissedAlertIds]);

  const totalMissingCount = orphanedSkuLinks.length + missingPartLinks.length;

  const filteredOrphanedSkuLinks = useMemo(() => {
    return orphanedSkuLinks.filter(ds => {
      if (missingPartsFilterBrand !== "all" && ds.device?.brand?.name !== missingPartsFilterBrand) return false;
      if (missingPartsFilterService !== "all" && ds.service?.name !== missingPartsFilterService) return false;
      return true;
    });
  }, [orphanedSkuLinks, missingPartsFilterBrand, missingPartsFilterService]);

  const filteredMissingPartLinks = useMemo(() => {
    return missingPartLinks.filter(ds => {
      if (missingPartsFilterBrand !== "all" && ds.device?.brand?.name !== missingPartsFilterBrand) return false;
      if (missingPartsFilterService !== "all" && ds.service?.name !== missingPartsFilterService) return false;
      return true;
    });
  }, [missingPartLinks, missingPartsFilterBrand, missingPartsFilterService]);

  const missingPartsBrands = useMemo(() => {
    const all = [...orphanedSkuLinks, ...missingPartLinks];
    return [...new Set(all.map(ds => ds.device?.brand?.name).filter(Boolean))] as string[];
  }, [orphanedSkuLinks, missingPartLinks]);

  const missingPartsServices = useMemo(() => {
    const all = [...orphanedSkuLinks, ...missingPartLinks];
    return [...new Set(all.map(ds => ds.service?.name).filter(Boolean))] as string[];
  }, [orphanedSkuLinks, missingPartLinks]);

  const toggleAlertSelection = (id: string) => {
    setSelectedAlertIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllInSection = (items: DeviceServiceWithRelations[]) => {
    const ids = items.map(ds => ds.id);
    const allSelected = ids.every(id => selectedAlertIds.has(id));
    setSelectedAlertIds(prev => {
      const next = new Set(prev);
      if (allSelected) {
        ids.forEach(id => next.delete(id));
      } else {
        ids.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const handleBulkDismiss = (dismissType: "1month" | "3months" | "indefinite") => {
    const ids = Array.from(selectedAlertIds);
    if (ids.length === 0) return;
    bulkDismissMutation.mutate({ deviceServiceIds: ids, dismissType });
  };

  const { data: editSkuPartData } = useQuery<Part | null>({
    queryKey: [`/api/parts/sku/${encodeURIComponent(editPartSku)}`],
    enabled: editPartSku.length > 0
  });
  const editSkuPart = editSkuPartData || undefined;

  const { data: inlineSkuPartData } = useQuery<Part | null>({
    queryKey: [`/api/parts/sku/${encodeURIComponent(inlineEditSku)}`],
    enabled: inlineEditSku.length > 0
  });
  const inlineSkuPart = inlineSkuPartData || undefined;

  // Compute devices for bulk add based on selected filters
  const bulkDevices = useMemo(() => {
    return devices.filter(d => {
      if (bulkTypeId !== "all" && d.deviceTypeId !== bulkTypeId) return false;
      if (bulkBrandId !== "all" && d.brandId !== bulkBrandId) return false;
      return true;
    });
  }, [devices, bulkTypeId, bulkBrandId]);

  const bulkMutation = useMutation({
    mutationFn: async (data: { serviceIds: string[]; deviceIds: string[]; partSku?: string }) => {
      const res = await apiRequest("POST", "/api/device-services/bulk", data);
      return res.json();
    },
    onSuccess: (result: { created: number; skipped: number; total: number }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/device-services"] });
      setBulkOpen(false);
      setBulkSelectedServices(new Set());
      setBulkTypeId("all");
      setBulkBrandId("all");
      setBulkPartSku("");
      toast({ 
        title: "Bulk add complete",
        description: `Created ${result.created} links, skipped ${result.skipped} duplicates`
      });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleBulkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (bulkSelectedServices.size === 0 || bulkDevices.length === 0) return;
    bulkMutation.mutate({
      serviceIds: Array.from(bulkSelectedServices),
      deviceIds: bulkDevices.map(d => d.id),
      partSku: bulkPartSku || undefined,
    });
  };

  const createMutation = useMutation({
    mutationFn: async (data: { deviceId: string; serviceId: string; partSku?: string; partId?: string; alternativePartSkus?: string[] }) => {
      const res = await apiRequest("POST", "/api/device-services", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/device-services"] });
      setOpen(false);
      setDeviceId("");
      setDeviceSearch("");
      setServiceId("");
      setPartSku("");
      setPartSearch("");
      setPartId(undefined);
      setAlternativePartSkus([]);
      setAlternativePartInfo({});
      setAltPartSearch("");
      toast({ title: "Device-service link created" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { deviceId?: string; serviceId?: string; partSku?: string; partId?: string; alternativePartSkus?: string[]; additionalFee?: number; manualPriceOverride?: string | null } }) => {
      const res = await apiRequest("PATCH", `/api/device-services/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/device-services"] });
      setEditOpen(false);
      setEditItem(null);
      setEditPartSku("");
      setEditPartSearch("");
      setEditAlternativePartSkus([]);
      setEditAlternativePartInfo({});
      setEditAltPartSearch("");
      setEditAdditionalFee("");
      setEditRepairDeskServiceId("");
      setEditManualPriceOverride("");
      toast({ title: "Link updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/device-services/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/device-services"] });
      toast({ title: "Link deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const inlineUpdateMutation = useMutation({
    mutationFn: async ({ id, partSku }: { id: string; partSku: string }) => {
      const res = await apiRequest("PATCH", `/api/device-services/${id}`, { partSku: partSku || undefined });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/device-services"] });
      setInlineEditId(null);
      setInlineEditSku("");
      toast({ title: "SKU updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const dsAddAdditionalPartMutation = useMutation({
    mutationFn: async ({ deviceServiceId, partId, partSku }: { deviceServiceId: string; partId?: string; partSku?: string }) => {
      await apiRequest("POST", `/api/device-services/${deviceServiceId}/parts`, { partId, partSku, isPrimary: false });
    },
    onSuccess: () => {
      refetchDsAdditionalParts();
      setAdditionalPartSku("");
      toast({ title: "Additional part added" });
    },
    onError: (error: Error) => {
      toast({ title: "Error adding part", description: error.message, variant: "destructive" });
    },
  });

  const dsRemoveAdditionalPartMutation = useMutation({
    mutationFn: async (partId: string) => {
      await apiRequest("DELETE", `/api/device-service-parts/${partId}`);
    },
    onSuccess: () => {
      refetchDsAdditionalParts();
      toast({ title: "Part removed" });
    },
    onError: (error: Error) => {
      toast({ title: "Error removing part", description: error.message, variant: "destructive" });
    },
  });

  const handleInlineEdit = (ds: DeviceServiceWithRelations) => {
    setInlineEditId(ds.id);
    setInlineEditSku(ds.part?.sku || ds.partSku || "");
  };

  const handleInlineSave = (id: string) => {
    inlineUpdateMutation.mutate({ id, partSku: inlineEditSku });
  };

  const handleInlineCancel = () => {
    setInlineEditId(null);
    setInlineEditSku("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      deviceId,
      serviceId,
      partSku: partSku || undefined,
      partId: partId === "none" ? undefined : partId,
      alternativePartSkus: alternativePartSkus.length > 0 ? alternativePartSkus : undefined,
    });
  };

  const handleEdit = async (ds: DeviceServiceWithRelations) => {
    setEditItem(ds);
    setEditPartSku(ds.part?.sku || ds.partSku || "");
    setEditPartSearch("");
    setEditDeviceSearch("");
    const altSkus = (ds as any).alternativePartSkus || [];
    setEditAlternativePartSkus(altSkus);
    setEditAltPartSearch("");
    setEditAdditionalFee((ds as any).additionalFee ? String((ds as any).additionalFee) : "");
    setEditManualPriceOverride((ds as any).manualPriceOverride ? String((ds as any).manualPriceOverride) : "");
    setEditOpen(true);
    
    // Fetch part info for existing alternative SKUs to populate tooltips
    if (altSkus.length > 0) {
      const infoMap: Record<string, { name: string; price: string }> = {};
      for (const sku of altSkus) {
        try {
          const res = await fetch(`/api/parts/sku/${encodeURIComponent(sku)}`);
          if (res.ok) {
            const part = await res.json();
            if (part) {
              infoMap[sku] = { name: part.name, price: part.price };
            }
          }
        } catch {}
      }
      setEditAlternativePartInfo(infoMap);
    } else {
      setEditAlternativePartInfo({});
    }
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editItem) return;
    updateMutation.mutate({
      id: editItem.id,
      data: {
        deviceId: editItem.deviceId,
        serviceId: editItem.serviceId,
        partSku: editPartSku || null,
        partId: editPartSku ? (editItem.partId || null) : null,
        alternativePartSkus: editAlternativePartSkus.length > 0 ? editAlternativePartSkus : undefined,
        additionalFee: editAdditionalFee ? parseFloat(editAdditionalFee) : 0,
        manualPriceOverride: editManualPriceOverride ? editManualPriceOverride : null,
      },
    });
  };

  const selectedPart = filteredParts.find((p) => p.id === partId);
  
  const { data: skuPart } = useQuery<Part | null>({
    queryKey: [`/api/parts/sku/${encodeURIComponent(partSku)}`],
    enabled: partSku.length > 0
  });

  return (
    <>
    <Tabs defaultValue="service-links" className="space-y-4">
      <TabsList className="grid grid-cols-2 sm:flex sm:flex-wrap gap-1 h-auto w-full sm:w-auto">
        <TabsTrigger value="service-links" className="text-xs sm:text-sm px-2 sm:px-3" data-testid="subtab-service-links">Service Links</TabsTrigger>
        <TabsTrigger value="missing-parts" className="text-xs sm:text-sm px-2 sm:px-3" data-testid="subtab-missing-parts">
          Missing Parts
          {totalMissingCount > 0 && (
            <span className="ml-1.5 inline-flex items-center justify-center h-5 min-w-5 px-1 text-xs font-medium rounded-full bg-destructive text-destructive-foreground" data-testid="badge-missing-parts-count">{totalMissingCount}</span>
          )}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="service-links">
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 space-y-0 pb-4">
        <div>
          <CardTitle>Device-Service Links</CardTitle>
          <CardDescription>Link devices to services with optional parts. Labor and markup come from the Service.</CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="button-add-link"><Plus className="h-4 w-4 mr-1" />Add Link</Button>
            </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>Add Device-Service Link</DialogTitle>
                <DialogDescription>Select model, service, and optionally a part</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Model (Device)</Label>
                  <Input 
                    value={deviceSearch} 
                    onChange={(e) => setDeviceSearch(e.target.value)} 
                    placeholder="Search devices..." 
                    data-testid="input-device-search-link"
                  />
                  <Select value={deviceId} onValueChange={setDeviceId} required>
                    <SelectTrigger data-testid="select-link-device"><SelectValue placeholder="Select device model" /></SelectTrigger>
                    <SelectContent>
                      {filteredDevices.slice(0, 50).map((device) => (<SelectItem key={device.id} value={device.id}>{device.name}</SelectItem>))}
                      {filteredDevices.length > 50 && <p className="px-2 py-1 text-sm text-muted-foreground">Showing first 50. Refine search.</p>}
                      {filteredDevices.length === 0 && <p className="px-2 py-1 text-sm text-muted-foreground">No devices found</p>}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Service</Label>
                  <Select value={serviceId} onValueChange={setServiceId} required>
                    <SelectTrigger data-testid="select-link-service"><SelectValue placeholder="Select service" /></SelectTrigger>
                    <SelectContent>
                      {services.map((service) => (<SelectItem key={service.id} value={service.id}>{service.name} (${service.laborPrice} + {service.partsMarkup}x markup)</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Part SKU (optional)</Label>
                  <Input value={partSku} onChange={(e) => { setPartSku(e.target.value); setPartId(undefined); }} placeholder="Enter SKU to auto-lookup" data-testid="input-part-sku-link" />
                  {partSku && skuPart && (
                    <p className="text-sm text-green-600">Found in custom parts: {skuPart.name} (${skuPart.price})</p>
                  )}
                  {partSku && !skuPart && partSku.length > 0 && (
                    <p className="text-sm text-muted-foreground">SKU will be saved - pricing lookup uses selected source</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Or Search Part by Name</Label>
                  <Input value={partSearch} onChange={(e) => setPartSearch(e.target.value)} placeholder="Type to search parts..." data-testid="input-part-search-link" />
                  {partSearch.length > 0 && (
                    <Select value={partId} onValueChange={(v) => { setPartId(v); setPartSku(""); }}>
                      <SelectTrigger data-testid="select-link-part"><SelectValue placeholder="Select from results" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No part required</SelectItem>
                        {filteredParts.map((part) => (<SelectItem key={part.id} value={part.id}>{part.sku} - {part.name} (${part.price})</SelectItem>))}
                        {(searchedParts?.total || 0) > 50 && <p className="px-2 py-1 text-sm text-muted-foreground">Showing first 50 results. Refine your search.</p>}
                      </SelectContent>
                    </Select>
                  )}
                  {partSearch.length === 0 && !partSku && (
                    <p className="text-sm text-muted-foreground">Enter SKU above or type to search by name</p>
                  )}
                  {selectedPart && <p className="text-sm text-muted-foreground">Part cost ${selectedPart.price} will be marked up per service settings</p>}
                </div>
                <div className="space-y-2">
                  <Label>Alternative Primary Parts ({alternativePartSkus.length}/10)</Label>
                  <p className="text-sm text-muted-foreground">Quote will use cheapest available part. Stock shows "In Stock" if ANY is available.</p>
                  <Input 
                    value={altPartSearch} 
                    onChange={(e) => setAltPartSearch(e.target.value)} 
                    placeholder="Search alternative parts..." 
                    data-testid="input-alt-part-search" 
                  />
                  {altPartSearch.length > 0 && altSearchedParts?.parts && (
                    <div className="max-h-32 overflow-y-auto border rounded p-2 space-y-1">
                      {alternativePartSkus.length >= 10 ? (
                        <p className="p-1 text-sm text-muted-foreground">Maximum 10 alternative parts allowed</p>
                      ) : altSearchedParts.parts.map((part) => (
                        <div 
                          key={part.id} 
                          className="flex items-center gap-2 text-sm cursor-pointer hover-elevate p-1 rounded"
                          onClick={() => {
                            if (!alternativePartSkus.includes(part.sku) && alternativePartSkus.length < 10) {
                              setAlternativePartSkus([...alternativePartSkus, part.sku]);
                              setAlternativePartInfo(prev => ({ ...prev, [part.sku]: { name: part.name, price: part.price } }));
                            }
                          }}
                        >
                          <Plus className="h-3 w-3" />
                          <span>{part.sku} - {part.name} (${part.price})</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {alternativePartSkus.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {alternativePartSkus.map((sku) => (
                        <Tooltip key={sku}>
                          <TooltipTrigger asChild>
                            <Badge variant="secondary" className="flex items-center gap-1 cursor-help">
                              {sku}
                              <X 
                                className="h-3 w-3 cursor-pointer" 
                                onClick={(e) => { e.stopPropagation(); setAlternativePartSkus(alternativePartSkus.filter(s => s !== sku)); }} 
                              />
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            {alternativePartInfo[sku] ? (
                              <>
                                <p className="font-medium">{alternativePartInfo[sku].name}</p>
                                <p className="text-xs text-muted-foreground">${alternativePartInfo[sku].price}</p>
                              </>
                            ) : (
                              <p className="text-muted-foreground">Part details not available</p>
                            )}
                          </TooltipContent>
                        </Tooltip>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={createMutation.isPending || !deviceId || !serviceId} data-testid="button-save-link">
                  {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

          <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="button-bulk-add"><Layers className="h-4 w-4 mr-2" />Bulk Add</Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleBulkSubmit}>
                <DialogHeader>
                  <DialogTitle>Bulk Add Service Links</DialogTitle>
                  <DialogDescription>Link a service to multiple devices at once. Filter by device type and/or brand.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Device Type</Label>
                      <Select value={bulkTypeId} onValueChange={setBulkTypeId}>
                        <SelectTrigger data-testid="select-bulk-type"><SelectValue placeholder="All Types" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Types</SelectItem>
                          {deviceTypes.map((type) => (<SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Brand</Label>
                      <Select value={bulkBrandId} onValueChange={setBulkBrandId}>
                        <SelectTrigger data-testid="select-bulk-brand"><SelectValue placeholder="All Brands" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Brands</SelectItem>
                          {brands.map((brand) => (<SelectItem key={brand.id} value={brand.id}>{brand.name}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="p-3 bg-muted rounded-md">
                    <p className="text-sm font-medium mb-1">Target Devices: {bulkDevices.length}</p>
                    <p className="text-xs text-muted-foreground">
                      {bulkTypeId !== "all" && `Type: ${deviceTypes.find(t => t.id === bulkTypeId)?.name}`}
                      {bulkTypeId !== "all" && bulkBrandId !== "all" && " / "}
                      {bulkBrandId !== "all" && `Brand: ${brands.find(b => b.id === bulkBrandId)?.name}`}
                      {bulkTypeId === "all" && bulkBrandId === "all" && "All devices"}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Select Services to Link</Label>
                    <div className="border rounded-md max-h-60 overflow-y-auto">
                      {services.map((service) => (
                        <div
                          key={service.id}
                          className="flex items-center gap-3 px-3 py-2 border-b last:border-b-0 hover-elevate cursor-pointer"
                          onClick={() => toggleBulkService(service.id)}
                        >
                          <input
                            type="checkbox"
                            checked={bulkSelectedServices.has(service.id)}
                            onChange={() => toggleBulkService(service.id)}
                            className="h-4 w-4"
                            data-testid={`checkbox-bulk-service-${service.id}`}
                          />
                          <div className="flex-1">
                            <p className="text-sm font-medium">{service.name}</p>
                            <p className="text-xs text-muted-foreground">${service.laborPrice} + {service.partsMarkup}x markup</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground">{bulkSelectedServices.size} service(s) selected</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Part SKU (optional)</Label>
                    <Input value={bulkPartSku} onChange={(e) => setBulkPartSku(e.target.value)} placeholder="Enter SKU if parts are needed" data-testid="input-bulk-part-sku" />
                  </div>
                  <div className="p-3 bg-primary/10 rounded-md">
                    <p className="text-sm font-medium">
                      This will create up to {bulkDevices.length * bulkSelectedServices.size} links
                    </p>
                    <p className="text-xs text-muted-foreground">Existing links will be skipped automatically</p>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" type="button" onClick={() => setBulkOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={bulkMutation.isPending || bulkSelectedServices.size === 0 || bulkDevices.length === 0} data-testid="button-bulk-submit">
                    {bulkMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : `Create ${bulkDevices.length * bulkSelectedServices.size} Links`}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2 sm:gap-3 mb-4 items-end">
          <div className="relative w-full sm:w-auto">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search service links..."
              value={serviceLinkSearch}
              onChange={(e) => setServiceLinkSearch(e.target.value)}
              className="pl-8 w-full sm:w-[200px]"
              data-testid="input-service-link-search"
            />
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Filters:</span>
          </div>
          <div className="space-y-1 w-[calc(33%-0.375rem)] sm:w-auto">
            <Label className="text-xs">Brand</Label>
            <Select value={filterBrand} onValueChange={setFilterBrand}>
              <SelectTrigger className="w-full sm:w-[140px]" data-testid="filter-brand">
                <SelectValue placeholder="All Brands" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Brands</SelectItem>
                {uniqueBrands.map((brand) => (
                  <SelectItem key={brand} value={brand}>{brand}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 w-[calc(33%-0.375rem)] sm:w-auto">
            <Label className="text-xs">Device</Label>
            <Select value={filterDevice} onValueChange={setFilterDevice}>
              <SelectTrigger className="w-full sm:w-[160px]" data-testid="filter-device">
                <SelectValue placeholder="All Devices" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Devices</SelectItem>
                {uniqueDevices.map((device) => (
                  <SelectItem key={device} value={device}>{device}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 w-[calc(33%-0.375rem)] sm:w-auto">
            <Label className="text-xs">Service</Label>
            <Select value={filterService} onValueChange={setFilterService}>
              <SelectTrigger className="w-full sm:w-[180px]" data-testid="filter-service">
                <SelectValue placeholder="All Services" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Services</SelectItem>
                {uniqueServices.map((service) => (
                  <SelectItem key={service} value={service}>{service}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {(serviceLinkSearch || filterBrand !== "all" || filterDevice !== "all" || filterService !== "all") && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => { setServiceLinkSearch(""); setFilterBrand("all"); setFilterDevice("all"); setFilterService("all"); }}
              data-testid="button-clear-filters"
            >
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : deviceServices.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">No links yet. Create one to offer services!</p>
        ) : filteredDeviceServices.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">No results match your filters.</p>
        ) : (
          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold">Device Type</TableHead>
                  <TableHead className="font-semibold">Brand</TableHead>
                  <TableHead className="font-semibold">Device Model</TableHead>
                  <TableHead className="font-semibold">Service</TableHead>
                  <TableHead className="font-semibold">Part SKU</TableHead>
                  <TableHead className="font-semibold text-right">Total Price</TableHead>
                  <TableHead className="w-[100px] font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDeviceServices.map((ds) => {
                  const partCost = ds.part ? parseFloat(ds.part.price) : 0;
                  const laborPrice = parseFloat(ds.service?.laborPrice || "0");
                  const partsMarkup = parseFloat(ds.service?.partsMarkup || "1");
                  const markedUpPart = partCost * partsMarkup;
                  const rawTotal = laborPrice + markedUpPart;
                  const roundedToFive = Math.round(rawTotal / 5) * 5;
                  const totalPrice = Math.max(4, roundedToFive - 1);
                  const isEditing = inlineEditId === ds.id;
                  
                  return (
                    <TableRow key={ds.id} className="hover:bg-muted/30">
                      <TableCell className="text-muted-foreground">{ds.device?.deviceType?.name || "-"}</TableCell>
                      <TableCell className="text-muted-foreground">{ds.device?.brand?.name || "-"}</TableCell>
                      <TableCell className="font-medium">{ds.device?.name || "Unknown"}</TableCell>
                      <TableCell>{ds.service?.name || "Unknown"}</TableCell>
                      <TableCell>
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <Input 
                              value={inlineEditSku} 
                              onChange={(e) => setInlineEditSku(e.target.value)} 
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && (inlineEditSku.length === 0 || inlineSkuPart)) {
                                  handleInlineSave(ds.id);
                                } else if (e.key === "Escape") {
                                  handleInlineCancel();
                                }
                              }}
                              onBlur={() => {
                                if (inlineEditSku.length === 0 || inlineSkuPart) {
                                  handleInlineSave(ds.id);
                                }
                              }}
                              className="h-8 w-32"
                              placeholder="Enter SKU"
                              autoFocus
                              data-testid={`input-inline-sku-${ds.id}`}
                            />
                            {inlineEditSku && inlineSkuPart && (
                              <span className="text-xs text-green-600">${inlineSkuPart.price}</span>
                            )}
                            {inlineEditSku && !inlineSkuPart && inlineEditSku.length > 0 && (
                              <span className="text-xs text-destructive">?</span>
                            )}
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-7 w-7" 
                              onClick={() => handleInlineSave(ds.id)}
                              disabled={inlineUpdateMutation.isPending || (inlineEditSku.length > 0 && !inlineSkuPart)}
                              data-testid={`button-inline-save-${ds.id}`}
                            >
                              {inlineUpdateMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3 text-green-600" />}
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-7 w-7" 
                              onClick={handleInlineCancel}
                              data-testid={`button-inline-cancel-${ds.id}`}
                            >
                              <X className="h-3 w-3 text-destructive" />
                            </Button>
                          </div>
                        ) : (
                          <div 
                            className="cursor-pointer hover:bg-muted/50 px-2 py-1 rounded min-w-[80px] min-h-[28px] flex items-center gap-1"
                            onClick={() => handleInlineEdit(ds)}
                            data-testid={`cell-sku-${ds.id}`}
                          >
                            {ds.part ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge variant="outline" className="font-mono cursor-help">{ds.part.sku}</Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="font-medium">{ds.part.name}</p>
                                  <p className="text-xs text-muted-foreground">${ds.part.price}</p>
                                </TooltipContent>
                              </Tooltip>
                            ) : ds.partSku ? (
                              <Badge variant="outline" className="font-mono text-orange-600 border-orange-500/50">
                                {ds.partSku} <span className="text-xs ml-1">(missing)</span>
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm italic">Click to add</span>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-semibold text-primary text-right">${totalPrice.toFixed(2)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(ds)} data-testid={`button-edit-link-${ds.id}`}><Pencil className="h-4 w-4" /></Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" disabled={deleteMutation.isPending} data-testid={`button-delete-link-${ds.id}`}><Trash2 className="h-4 w-4" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                <AlertDialogDescription>This will permanently delete this device-service link. This action cannot be undone.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteMutation.mutate(ds.id)} data-testid={`confirm-delete-link-${ds.id}`}>Delete</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
        {filteredDeviceServices.length > 0 && (
          <p className="text-sm text-muted-foreground mt-2">
            Showing {filteredDeviceServices.length} of {deviceServices.length} links
          </p>
        )}
      </CardContent>
    </Card>
      </TabsContent>

      <TabsContent value="missing-parts">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Missing Parts ({totalMissingCount})
            </CardTitle>
            <CardDescription>Service links that need parts assigned or have orphaned SKUs. Fix these to show accurate pricing in the quote widget.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {totalMissingCount === 0 ? (
              <div className="text-center py-8 text-muted-foreground" data-testid="text-no-missing-parts">
                All service links have valid parts assigned. Nothing to fix.
              </div>
            ) : (
              <>
                <div className="flex flex-col sm:flex-row gap-2" data-testid="section-missing-parts-filters">
                  <Select value={missingPartsFilterBrand} onValueChange={setMissingPartsFilterBrand}>
                    <SelectTrigger className="w-full sm:w-48" data-testid="select-missing-filter-brand">
                      <SelectValue placeholder="Filter by brand" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Brands</SelectItem>
                      {missingPartsBrands.map(b => (
                        <SelectItem key={b} value={b}>{b}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={missingPartsFilterService} onValueChange={setMissingPartsFilterService}>
                    <SelectTrigger className="w-full sm:w-48" data-testid="select-missing-filter-service">
                      <SelectValue placeholder="Filter by service" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Services</SelectItem>
                      {missingPartsServices.map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {(missingPartsFilterBrand !== "all" || missingPartsFilterService !== "all") && (
                    <Button variant="ghost" size="sm" onClick={() => { setMissingPartsFilterBrand("all"); setMissingPartsFilterService("all"); }} data-testid="button-clear-missing-filters">
                      <X className="h-4 w-4 mr-1" /> Clear
                    </Button>
                  )}
                </div>

                {selectedAlertIds.size > 0 && (
                  <div className="sticky top-0 z-10 flex flex-col sm:flex-row items-start sm:items-center gap-2 p-3 rounded-lg border bg-card shadow-sm" data-testid="section-bulk-actions">
                    <span className="text-sm font-medium shrink-0">{selectedAlertIds.size} selected</span>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleBulkDismiss("1month")} disabled={bulkDismissMutation.isPending} data-testid="button-bulk-dismiss-1month">
                        <Clock className="h-3.5 w-3.5 mr-1" /> Dismiss 1 month
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleBulkDismiss("3months")} disabled={bulkDismissMutation.isPending} data-testid="button-bulk-dismiss-3months">
                        <Calendar className="h-3.5 w-3.5 mr-1" /> Dismiss 3 months
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleBulkDismiss("indefinite")} disabled={bulkDismissMutation.isPending} data-testid="button-bulk-dismiss-indefinite">
                        <EyeOff className="h-3.5 w-3.5 mr-1" /> Dismiss permanently
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setSelectedAlertIds(new Set())} data-testid="button-clear-selection">
                        <X className="h-3.5 w-3.5 mr-1" /> Clear
                      </Button>
                    </div>
                    {bulkDismissMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  </div>
                )}

                {filteredOrphanedSkuLinks.length > 0 && (
                  <div className="border border-orange-500/50 bg-orange-500/5 rounded-md p-4" data-testid="section-orphaned-sku-links">
                    <div className="flex items-center gap-3 mb-3">
                      <Checkbox
                        checked={filteredOrphanedSkuLinks.every(ds => selectedAlertIds.has(ds.id))}
                        onCheckedChange={() => selectAllInSection(filteredOrphanedSkuLinks)}
                        data-testid="checkbox-select-all-orphaned"
                      />
                      <AlertTriangle className="h-5 w-5 text-orange-600" />
                      <h4 className="font-semibold text-orange-600">
                        {filteredOrphanedSkuLinks.length} Service Link{filteredOrphanedSkuLinks.length !== 1 ? "s" : ""} with Missing Parts (SKU Preserved)
                      </h4>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3 ml-9">
                      These service links have a saved SKU but the part no longer exists in your parts list. Re-upload parts or assign a new part to fix.
                    </p>
                    <div className="space-y-1">
                      {filteredOrphanedSkuLinks.map((ds) => (
                        <div
                          key={ds.id}
                          className="flex items-center text-sm py-2 px-2 bg-background rounded border gap-2"
                          data-testid={`orphaned-link-${ds.id}`}
                        >
                          <Checkbox
                            checked={selectedAlertIds.has(ds.id)}
                            onCheckedChange={() => toggleAlertSelection(ds.id)}
                            data-testid={`checkbox-orphaned-${ds.id}`}
                          />
                          <span className="flex-1 min-w-0">
                            <span className="font-medium">{ds.device?.name || "Unknown"}</span>
                            <span className="text-muted-foreground"> ({ds.device?.brand?.name || "-"})</span>
                            <span className="mx-2">→</span>
                            <span>{ds.service?.name || "Unknown"}</span>
                          </span>
                          <Badge variant="outline" className="font-mono text-xs shrink-0">{ds.partSku}</Badge>
                          <div className="flex gap-1 shrink-0">
                            <Button variant="outline" size="sm" onClick={() => handleEdit(ds)} data-testid={`button-fix-orphaned-${ds.id}`}>
                              Reassign
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`button-dismiss-orphaned-${ds.id}`}>
                                  <X className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => dismissAlertMutation.mutate({ deviceServiceId: ds.id, dismissType: "1month" })} data-testid={`dismiss-1month-${ds.id}`}>
                                  <Clock className="h-4 w-4 mr-2" /> Dismiss for 1 month
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => dismissAlertMutation.mutate({ deviceServiceId: ds.id, dismissType: "3months" })} data-testid={`dismiss-3months-${ds.id}`}>
                                  <Calendar className="h-4 w-4 mr-2" /> Dismiss for 3 months
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => dismissAlertMutation.mutate({ deviceServiceId: ds.id, dismissType: "indefinite" })} data-testid={`dismiss-indefinite-${ds.id}`}>
                                  <EyeOff className="h-4 w-4 mr-2" /> Dismiss indefinitely
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {filteredMissingPartLinks.length > 0 && (
                  <div className="border border-destructive/50 bg-destructive/5 rounded-md p-4" data-testid="section-missing-part-links">
                    <div className="flex items-center gap-3 mb-3">
                      <Checkbox
                        checked={filteredMissingPartLinks.every(ds => selectedAlertIds.has(ds.id))}
                        onCheckedChange={() => selectAllInSection(filteredMissingPartLinks)}
                        data-testid="checkbox-select-all-missing"
                      />
                      <AlertTriangle className="h-5 w-5 text-destructive" />
                      <h4 className="font-semibold text-destructive">
                        {filteredMissingPartLinks.length} Service Link{filteredMissingPartLinks.length !== 1 ? "s" : ""} Missing Parts
                      </h4>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3 ml-9">
                      These service links have no part assigned and the service is not marked as "Labour only". They will show as "Not Available" in the quote widget.
                    </p>
                    <div className="space-y-1">
                      {filteredMissingPartLinks.map((ds) => (
                        <div
                          key={ds.id}
                          className="flex items-center text-sm py-2 px-2 bg-background rounded border gap-2"
                          data-testid={`error-link-${ds.id}`}
                        >
                          <Checkbox
                            checked={selectedAlertIds.has(ds.id)}
                            onCheckedChange={() => toggleAlertSelection(ds.id)}
                            data-testid={`checkbox-missing-${ds.id}`}
                          />
                          <span className="flex-1 min-w-0">
                            <span className="font-medium">{ds.device?.name || "Unknown"}</span>
                            <span className="text-muted-foreground"> ({ds.device?.brand?.name || "-"})</span>
                            <span className="mx-2">→</span>
                            <span>{ds.service?.name || "Unknown"}</span>
                          </span>
                          <div className="flex gap-1 shrink-0">
                            <Button variant="outline" size="sm" onClick={() => handleEdit(ds)} data-testid={`button-fix-link-${ds.id}`}>
                              Assign Part
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`button-dismiss-link-${ds.id}`}>
                                  <X className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => dismissAlertMutation.mutate({ deviceServiceId: ds.id, dismissType: "1month" })} data-testid={`dismiss-1month-link-${ds.id}`}>
                                  <Clock className="h-4 w-4 mr-2" /> Dismiss for 1 month
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => dismissAlertMutation.mutate({ deviceServiceId: ds.id, dismissType: "3months" })} data-testid={`dismiss-3months-link-${ds.id}`}>
                                  <Calendar className="h-4 w-4 mr-2" /> Dismiss for 3 months
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => dismissAlertMutation.mutate({ deviceServiceId: ds.id, dismissType: "indefinite" })} data-testid={`dismiss-indefinite-link-${ds.id}`}>
                                  <EyeOff className="h-4 w-4 mr-2" /> Dismiss indefinitely
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {filteredOrphanedSkuLinks.length === 0 && filteredMissingPartLinks.length === 0 && (
                  <p className="text-center py-4 text-muted-foreground">No items match the current filters.</p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>

      <Dialog open={editOpen} onOpenChange={(open) => { setEditOpen(open); if (!open) setAdditionalPartSku(""); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <form onSubmit={handleEditSubmit}>
            <DialogHeader>
              <DialogTitle>Edit Device-Service Link</DialogTitle>
              <DialogDescription>Update link details</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Model (Device)</Label>
                <Input 
                  value={editDeviceSearch} 
                  onChange={(e) => setEditDeviceSearch(e.target.value)} 
                  placeholder="Search devices..." 
                  data-testid="input-edit-device-search-link"
                />
                <Select value={editItem?.deviceId || ""} onValueChange={(v) => setEditItem(prev => prev ? {...prev, deviceId: v} : null)}>
                  <SelectTrigger><SelectValue placeholder="Select device" /></SelectTrigger>
                  <SelectContent>
                    {editFilteredDevices.slice(0, 50).map((device) => (<SelectItem key={device.id} value={device.id}>{device.name}</SelectItem>))}
                    {editFilteredDevices.length > 50 && <p className="px-2 py-1 text-sm text-muted-foreground">Showing first 50. Refine search.</p>}
                    {editFilteredDevices.length === 0 && <p className="px-2 py-1 text-sm text-muted-foreground">No devices found</p>}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Service</Label>
                <Select value={editItem?.serviceId || ""} onValueChange={(v) => setEditItem(prev => prev ? {...prev, serviceId: v} : null)}>
                  <SelectTrigger><SelectValue placeholder="Select service" /></SelectTrigger>
                  <SelectContent>
                    {services.map((service) => (<SelectItem key={service.id} value={service.id}>{service.name} (${service.laborPrice} + {service.partsMarkup}x markup)</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Part SKU (optional)</Label>
                <Input 
                  value={editPartSku} 
                  onChange={(e) => { 
                    setEditPartSku(e.target.value); 
                    setEditItem(prev => prev ? {...prev, partId: null} : null); 
                  }} 
                  placeholder="Enter SKU to auto-lookup" 
                  data-testid="input-edit-part-sku" 
                />
                {editPartSku && editSkuPart && (
                  <p className="text-sm text-green-600">Found in custom parts: {editSkuPart.name} (${editSkuPart.price})</p>
                )}
                {editPartSku && !editSkuPart && editPartSku.length > 0 && (
                  <p className="text-sm text-muted-foreground">SKU will be saved - pricing lookup uses selected source</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Or Search Part by Name</Label>
                <Input 
                  value={editPartSearch} 
                  onChange={(e) => setEditPartSearch(e.target.value)} 
                  placeholder="Type to search parts..." 
                  data-testid="input-edit-part-search" 
                />
                {editPartSearch.length > 0 && (
                  <Select 
                    value={editItem?.partId || "none"} 
                    onValueChange={(v) => { 
                      setEditItem(prev => prev ? {...prev, partId: v === "none" ? null : v} : null); 
                      setEditPartSku(""); 
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Select from results" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No part required</SelectItem>
                      {editFilteredParts.map((part) => (<SelectItem key={part.id} value={part.id}>{part.sku} - {part.name} (${part.price})</SelectItem>))}
                      {(editSearchedParts?.total || 0) > 50 && <p className="px-2 py-1 text-sm text-muted-foreground">Showing first 50 results. Refine your search.</p>}
                    </SelectContent>
                  </Select>
                )}
                {editPartSearch.length === 0 && !editPartSku && (
                  <p className="text-sm text-muted-foreground">Enter SKU above or type to search by name</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Alternative Primary Parts ({editAlternativePartSkus.length}/10)</Label>
                <p className="text-sm text-muted-foreground">Quote will use cheapest available part. Stock shows "In Stock" if ANY is available.</p>
                <Input 
                  value={editAltPartSearch} 
                  onChange={(e) => setEditAltPartSearch(e.target.value)} 
                  placeholder="Search alternative parts..." 
                  data-testid="input-edit-alt-part-search" 
                />
                {editAltPartSearch.length > 0 && editAltSearchedParts?.parts && (
                  <div className="max-h-32 overflow-y-auto border rounded p-2 space-y-1">
                    {editAlternativePartSkus.length >= 10 ? (
                      <p className="p-1 text-sm text-muted-foreground">Maximum 10 alternative parts allowed</p>
                    ) : editAltSearchedParts.parts.map((part) => (
                      <div 
                        key={part.id} 
                        className="flex items-center gap-2 text-sm cursor-pointer hover-elevate p-1 rounded"
                        onClick={() => {
                          if (!editAlternativePartSkus.includes(part.sku) && editAlternativePartSkus.length < 10) {
                            setEditAlternativePartSkus([...editAlternativePartSkus, part.sku]);
                            setEditAlternativePartInfo(prev => ({ ...prev, [part.sku]: { name: part.name, price: part.price } }));
                          }
                        }}
                      >
                        <Plus className="h-3 w-3" />
                        <span>{part.sku} - {part.name} (${part.price})</span>
                      </div>
                    ))}
                  </div>
                )}
                {editAlternativePartSkus.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {editAlternativePartSkus.map((sku) => (
                      <Tooltip key={sku}>
                        <TooltipTrigger asChild>
                          <Badge variant="secondary" className="flex items-center gap-1 cursor-help">
                            {sku}
                            <X 
                              className="h-3 w-3 cursor-pointer" 
                              onClick={(e) => { e.stopPropagation(); setEditAlternativePartSkus(editAlternativePartSkus.filter(s => s !== sku)); }} 
                            />
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          {editAlternativePartInfo[sku] ? (
                            <>
                              <p className="font-medium">{editAlternativePartInfo[sku].name}</p>
                              <p className="text-xs text-muted-foreground">${editAlternativePartInfo[sku].price}</p>
                            </>
                          ) : (
                            <p className="text-muted-foreground">Part details not available</p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-additional-fee">Additional Fee ($)</Label>
                <Input
                  id="edit-additional-fee"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={editAdditionalFee}
                  onChange={(e) => setEditAdditionalFee(e.target.value)}
                  data-testid="input-edit-additional-fee"
                />
                <p className="text-xs text-muted-foreground">Extra fee for this specific device-service combination. Added to total before rounding.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-manual-price-override">Manual Price Override (optional)</Label>
                <Input
                  id="edit-manual-price-override"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 129.99"
                  value={editManualPriceOverride}
                  onChange={(e) => setEditManualPriceOverride(e.target.value)}
                  data-testid="input-edit-manual-price-override"
                />
                <p className="text-xs text-muted-foreground">If set, bypasses all price calculations (labor, parts, markup, rounding) and displays this exact price to customers.</p>
              </div>

              
              <div className="space-y-2 border-t pt-4">
                <Label>Additional Parts (Secondary)</Label>
                <p className="text-xs text-muted-foreground mb-2">These parts will be charged at {editItem?.service?.secondaryPartPercentage || 100}% of their cost</p>
                
                {dsAdditionalParts.filter(ap => !ap.isPrimary).length > 0 && (
                  <div className="space-y-1 mb-2">
                    {dsAdditionalParts.filter(ap => !ap.isPrimary).map((ap) => (
                      <div key={ap.id} className="flex items-center justify-between p-2 bg-muted rounded text-sm">
                        <span>
                          {ap.part ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="cursor-help underline decoration-dotted">{ap.part.sku}</span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="font-medium">{ap.part.name}</p>
                                <p className="text-xs text-muted-foreground">${ap.part.price}</p>
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <span>{ap.partSku || "Unknown"}</span>
                          )}
                          {ap.part && <span className="ml-2 text-muted-foreground">({ap.part.name} - ${ap.part.price})</span>}
                        </span>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              type="button" 
                              variant="ghost" 
                              size="icon" 
                              className="h-6 w-6"
                              disabled={dsRemoveAdditionalPartMutation.isPending}
                              data-testid={`button-remove-ds-additional-part-${ap.id}`}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                              <AlertDialogDescription>This will remove this additional part from the service link. This action cannot be undone.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => dsRemoveAdditionalPartMutation.mutate(ap.id)} data-testid={`confirm-remove-ds-additional-part-${ap.id}`}>Remove</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="flex gap-2">
                  <Input 
                    value={additionalPartSku} 
                    onChange={(e) => setAdditionalPartSku(e.target.value)} 
                    placeholder="Enter additional part SKU" 
                    className="flex-1"
                    data-testid="input-ds-additional-part-sku" 
                  />
                  <Button 
                    type="button"
                    size="sm"
                    disabled={!dsAdditionalSkuPart || dsAddAdditionalPartMutation.isPending}
                    onClick={() => {
                      if (dsAdditionalSkuPart && editItem) {
                        dsAddAdditionalPartMutation.mutate({
                          deviceServiceId: editItem.id,
                          partId: dsAdditionalSkuPart.id,
                          partSku: dsAdditionalSkuPart.sku,
                        });
                      }
                    }}
                    data-testid="button-add-ds-additional-part"
                  >
                    {dsAddAdditionalPartMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  </Button>
                </div>
                {additionalPartSku && dsAdditionalSkuPart && (
                  <p className="text-sm text-green-600">Found: {dsAdditionalSkuPart.name} (${dsAdditionalSkuPart.price})</p>
                )}
                {additionalPartSku && !dsAdditionalSkuPart && additionalPartSku.length > 0 && (
                  <p className="text-sm text-destructive">SKU not found</p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={updateMutation.isPending} data-testid="button-update-link">
                {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

type DismissedAlertWithInfo = {
  id: string;
  deviceServiceId: string;
  dismissType: string;
  dismissedAt: string;
  expiresAt: string | null;
  deviceName?: string;
  brandName?: string;
  serviceName?: string;
};

