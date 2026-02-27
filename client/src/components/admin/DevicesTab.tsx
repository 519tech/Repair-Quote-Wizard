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
import { Plus, Trash2, Loader2, Pencil, Search, Upload, Layers, DollarSign, Wand2, Calendar, X } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ImageInput } from "@/components/ImageInput";
import type { DeviceType, Device, Part, Service, DeviceServiceWithRelations, Brand } from "@shared/schema";

export function DevicesTab({ toast }: { toast: ReturnType<typeof useToast>["toast"] }) {
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [editItem, setEditItem] = useState<Device | null>(null);
  const [name, setName] = useState("");
  const [deviceTypeId, setDeviceTypeId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [cloneFromDeviceId, setCloneFromDeviceId] = useState("");
  const [cloneDeviceSearch, setCloneDeviceSearch] = useState("");
  const [releaseDate, setReleaseDate] = useState("");
  const [detectingReleaseDate, setDetectingReleaseDate] = useState(false);
  const [detectingEditReleaseDate, setDetectingEditReleaseDate] = useState(false);
  const [filterTypeId, setFilterTypeId] = useState("all");
  const [filterBrandId, setFilterBrandId] = useState("all");
  const [deviceSearch, setDeviceSearch] = useState("");
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkDetecting, setBulkDetecting] = useState(false);
  const [bulkResults, setBulkResults] = useState<{ created: number; errors: string[] } | null>(null);

  // Service links management state
  const [linksOpen, setLinksOpen] = useState(false);
  const [linksDevice, setLinksDevice] = useState<Device | null>(null);
  const [addLinkOpen, setAddLinkOpen] = useState(false);
  const [editLinkOpen, setEditLinkOpen] = useState(false);
  const [editLinkItem, setEditLinkItem] = useState<DeviceServiceWithRelations | null>(null);
  const [linkServiceId, setLinkServiceId] = useState("");
  const [linkPartSku, setLinkPartSku] = useState("");
  const [linkPartSearch, setLinkPartSearch] = useState("");
  const [linkPartId, setLinkPartId] = useState<string | undefined>();
  const [debouncedLinkPartSearch, setDebouncedLinkPartSearch] = useState("");
  const [additionalPartSku, setAdditionalPartSku] = useState("");
  const [linkAlternativePartSkus, setLinkAlternativePartSkus] = useState<string[]>([]);
  const [linkAlternativePartInfo, setLinkAlternativePartInfo] = useState<Record<string, { name: string; price: string }>>({});
  const [linkAltPartSearch, setLinkAltPartSearch] = useState("");
  const [linkAdditionalFee, setLinkAdditionalFee] = useState<string>("");
  const [linkManualPriceOverride, setLinkManualPriceOverride] = useState<string>("");
  const [debouncedLinkAltPartSearch, setDebouncedLinkAltPartSearch] = useState("");

  // Bulk add links state
  const [bulkLinkOpen, setBulkLinkOpen] = useState(false);
  const [bulkLinkTypeId, setBulkLinkTypeId] = useState("all");
  const [bulkLinkBrandId, setBulkLinkBrandId] = useState("all");
  const [bulkLinkSelectedServices, setBulkLinkSelectedServices] = useState<Set<string>>(new Set());

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedLinkPartSearch(linkPartSearch), 300);
    return () => clearTimeout(timer);
  }, [linkPartSearch]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedLinkAltPartSearch(linkAltPartSearch), 300);
    return () => clearTimeout(timer);
  }, [linkAltPartSearch]);

  const { data: devices = [], isLoading } = useQuery<Device[]>({ queryKey: ["/api/devices"] });
  const { data: deviceTypes = [] } = useQuery<DeviceType[]>({ queryKey: ["/api/device-types"] });
  const { data: brands = [] } = useQuery<Brand[]>({ queryKey: ["/api/brands"] });
  const { data: services = [] } = useQuery<Service[]>({ queryKey: ["/api/services"] });
  const { data: allDeviceServices = [] } = useQuery<DeviceServiceWithRelations[]>({ queryKey: ["/api/device-services"] });

  // Parts search for link dialog
  const linkPartSearchUrl = useMemo(() => {
    if (!debouncedLinkPartSearch) return null;
    const params = new URLSearchParams({ page: "1", limit: "50", search: debouncedLinkPartSearch });
    return `/api/parts?${params}`;
  }, [debouncedLinkPartSearch]);

  const { data: linkSearchedParts } = useQuery<{ parts: Part[]; total: number }>({
    queryKey: [linkPartSearchUrl || "/api/parts-disabled-link"],
    enabled: !!linkPartSearchUrl
  });

  const linkFilteredParts = linkSearchedParts?.parts || [];

  // Get service links for the current device
  const deviceServiceLinks = useMemo(() => {
    if (!linksDevice) return [];
    return allDeviceServices.filter(ds => ds.deviceId === linksDevice.id);
  }, [allDeviceServices, linksDevice]);

  // SKU lookup for link dialog
  const { data: linkSkuPart } = useQuery<Part | null>({
    queryKey: [`/api/parts/sku/${encodeURIComponent(linkPartSku)}`],
    enabled: linkPartSku.length > 0
  });

  // Additional part SKU lookup
  const { data: additionalSkuPart } = useQuery<Part | null>({
    queryKey: [`/api/parts/sku/${encodeURIComponent(additionalPartSku)}`],
    enabled: additionalPartSku.length > 0
  });

  // Alternative part SKU search for link dialog
  const linkAltPartSearchUrl = useMemo(() => {
    if (!debouncedLinkAltPartSearch) return null;
    const params = new URLSearchParams({ page: "1", limit: "50", search: debouncedLinkAltPartSearch });
    return `/api/parts?${params}`;
  }, [debouncedLinkAltPartSearch]);

  const { data: linkAltSearchedParts } = useQuery<{ parts: Part[]; total: number }>({
    queryKey: [linkAltPartSearchUrl || "/api/parts-disabled-link-alt"],
    enabled: !!linkAltPartSearchUrl
  });

  const linkAltFilteredParts = (linkAltSearchedParts?.parts || []).filter(
    p => !linkAlternativePartSkus.includes(p.sku) && p.sku !== linkPartSku
  );

  // Query for additional parts for the current edit link
  const { data: additionalParts = [], refetch: refetchAdditionalParts } = useQuery<{ id: string; partId: string | null; partSku: string | null; isPrimary: boolean; part: Part | null }[]>({
    queryKey: [`/api/device-services/${editLinkItem?.id}/parts`],
    enabled: !!editLinkItem?.id
  });

  const addAdditionalPartMutation = useMutation({
    mutationFn: async ({ deviceServiceId, partId, partSku }: { deviceServiceId: string; partId?: string; partSku?: string }) => {
      await apiRequest("POST", `/api/device-services/${deviceServiceId}/parts`, { partId, partSku, isPrimary: false });
    },
    onSuccess: () => {
      refetchAdditionalParts();
      setAdditionalPartSku("");
      toast({ title: "Additional part added" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const removeAdditionalPartMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/device-service-parts/${id}`);
    },
    onSuccess: () => {
      refetchAdditionalParts();
      toast({ title: "Part removed" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const filteredDevices = devices.filter((device) => {
    if (filterTypeId !== "all" && device.deviceTypeId !== filterTypeId) return false;
    if (filterBrandId !== "all") {
      if (filterBrandId === "none" && device.brandId !== null) return false;
      if (filterBrandId !== "none" && device.brandId !== filterBrandId) return false;
    }
    if (deviceSearch) {
      const search = deviceSearch.toLowerCase();
      const brand = brands.find(b => b.id === device.brandId);
      const deviceType = deviceTypes.find(t => t.id === device.deviceTypeId);
      const searchText = `${device.name} ${brand?.name || ""} ${deviceType?.name || ""}`.toLowerCase();
      if (!searchText.includes(search)) return false;
    }
    return true;
  });

  // Devices for bulk link adding
  const bulkLinkDevices = useMemo(() => {
    return devices.filter(device => {
      if (bulkLinkTypeId !== "all" && device.deviceTypeId !== bulkLinkTypeId) return false;
      if (bulkLinkBrandId !== "all" && device.brandId !== bulkLinkBrandId) return false;
      return true;
    });
  }, [devices, bulkLinkTypeId, bulkLinkBrandId]);

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; deviceTypeId: string; brandId?: string; imageUrl?: string; releaseDate?: string; cloneFromDeviceId?: string }) => {
      const { cloneFromDeviceId, ...deviceData } = data;
      const res = await apiRequest("POST", "/api/devices", deviceData);
      const newDevice = await res.json();
      
      // Clone service links if a source device was selected
      let cloneResult = null;
      if (cloneFromDeviceId) {
        const cloneRes = await apiRequest("POST", "/api/device-services/clone", {
          sourceDeviceId: cloneFromDeviceId,
          targetDeviceId: newDevice.id
        });
        cloneResult = await cloneRes.json();
      }
      
      return { device: newDevice, cloneResult };
    },
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/devices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/device-services"] });
      setOpen(false);
      setName("");
      setDeviceTypeId("");
      setBrandId("");
      setImageUrl("");
      setReleaseDate("");
      setCloneFromDeviceId("");
      setCloneDeviceSearch("");
      if (variables.cloneFromDeviceId && result.cloneResult) {
        toast({ 
          title: "Device created with cloned service links",
          description: `Cloned ${result.cloneResult.created} service links${result.cloneResult.skipped > 0 ? ` (${result.cloneResult.skipped} skipped)` : ""}`
        });
      } else {
        toast({ title: "Device created" });
      }
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name?: string; deviceTypeId?: string; brandId?: string | null; imageUrl?: string | null; releaseDate?: string | null } }) => {
      const res = await apiRequest("PATCH", `/api/devices/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/devices"] });
      setEditOpen(false);
      setEditItem(null);
      toast({ title: "Device updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/devices/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/devices"] });
      toast({ title: "Device deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Service link mutations
  const createLinkMutation = useMutation({
    mutationFn: async (data: { deviceId: string; serviceId: string; partSku?: string; partId?: string }) => {
      const res = await apiRequest("POST", "/api/device-services", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/device-services"] });
      setAddLinkOpen(false);
      setLinkServiceId("");
      setLinkPartSku("");
      setLinkPartSearch("");
      setLinkPartId(undefined);
      toast({ title: "Service link created" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateLinkMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { serviceId?: string; partSku?: string; partId?: string; alternativePartSkus?: string[]; additionalFee?: number; manualPriceOverride?: string | null } }) => {
      const res = await apiRequest("PATCH", `/api/device-services/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/device-services"] });
      setEditLinkOpen(false);
      setEditLinkItem(null);
      setLinkManualPriceOverride("");
      toast({ title: "Service link updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteLinkMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/device-services/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/device-services"] });
      toast({ title: "Service link deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const bulkLinkMutation = useMutation({
    mutationFn: async (data: { deviceIds: string[]; serviceIds: string[] }) => {
      const results = { created: 0, skipped: 0, errors: [] as string[] };
      for (const deviceId of data.deviceIds) {
        for (const serviceId of data.serviceIds) {
          try {
            await apiRequest("POST", "/api/device-services", { deviceId, serviceId });
            results.created++;
          } catch (error: any) {
            if (error.message?.includes("already exists")) {
              results.skipped++;
            } else {
              results.errors.push(error.message);
            }
          }
        }
      }
      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ["/api/device-services"] });
      setBulkLinkOpen(false);
      setBulkLinkSelectedServices(new Set());
      setBulkLinkTypeId("all");
      setBulkLinkBrandId("all");
      toast({
        title: "Bulk links created",
        description: `Created ${results.created} links${results.skipped > 0 ? `, ${results.skipped} already existed` : ""}${results.errors.length > 0 ? `, ${results.errors.length} errors` : ""}`
      });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleBulkLinkOpen = () => {
    setBulkLinkTypeId("all");
    setBulkLinkBrandId("all");
    setBulkLinkSelectedServices(new Set());
    setBulkLinkOpen(true);
  };

  const toggleBulkLinkService = (serviceId: string) => {
    setBulkLinkSelectedServices(prev => {
      const next = new Set(prev);
      if (next.has(serviceId)) {
        next.delete(serviceId);
      } else {
        next.add(serviceId);
      }
      return next;
    });
  };

  const handleBulkLinkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    bulkLinkMutation.mutate({
      deviceIds: bulkLinkDevices.map(d => d.id),
      serviceIds: Array.from(bulkLinkSelectedServices)
    });
  };

  const handleManageLinks = (device: Device) => {
    setLinksDevice(device);
    setLinksOpen(true);
  };

  const handleAddLink = () => {
    setLinkServiceId("");
    setLinkPartSku("");
    setLinkPartSearch("");
    setLinkPartId(undefined);
    setAddLinkOpen(true);
  };

  const handleAddLinkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!linksDevice) return;
    createLinkMutation.mutate({
      deviceId: linksDevice.id,
      serviceId: linkServiceId,
      partSku: linkPartSku || undefined,
      partId: linkPartId === "none" ? undefined : linkPartId,
    });
  };

  const handleEditLink = async (link: DeviceServiceWithRelations) => {
    setEditLinkItem(link);
    setLinkPartSku(link.part?.sku || link.partSku || "");
    setLinkPartSearch("");
    const altSkus = (link as any).alternativePartSkus || [];
    setLinkAlternativePartSkus(altSkus);
    setLinkAltPartSearch("");
    setLinkAdditionalFee((link as any).additionalFee ? String((link as any).additionalFee) : "");
    setLinkManualPriceOverride((link as any).manualPriceOverride ? String((link as any).manualPriceOverride) : "");
    setEditLinkOpen(true);
    
    // Fetch part info for existing alternative SKUs
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
      setLinkAlternativePartInfo(infoMap);
    } else {
      setLinkAlternativePartInfo({});
    }
  };

  const handleEditLinkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editLinkItem) return;
    updateLinkMutation.mutate({
      id: editLinkItem.id,
      data: {
        serviceId: editLinkItem.serviceId,
        partSku: linkPartSku || undefined,
        alternativePartSkus: linkAlternativePartSkus,
        additionalFee: linkAdditionalFee ? parseFloat(linkAdditionalFee) : 0,
        manualPriceOverride: linkManualPriceOverride ? linkManualPriceOverride : null,
      },
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({ 
      name, 
      deviceTypeId, 
      brandId: brandId && brandId !== "none" ? brandId : undefined,
      imageUrl: imageUrl || undefined,
      releaseDate: releaseDate || undefined,
      cloneFromDeviceId: cloneFromDeviceId || undefined
    });
  };

  const detectReleaseDate = async (deviceName: string, brandName: string | undefined, setter: (date: string) => void, setLoading: (v: boolean) => void) => {
    if (!deviceName) {
      toast({ title: "Enter a device name first", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/devices/detect-release-date", {
        modelName: deviceName,
        brandName
      });
      const data = await res.json();
      if (data.releaseDate) {
        setter(data.releaseDate);
        toast({ title: "Release date detected", description: data.releaseDate });
      } else {
        toast({ title: "Could not detect release date", description: "Please enter it manually", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Detection failed", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Filter devices for the clone dropdown based on search
  const cloneSourceDevices = useMemo(() => {
    if (!cloneDeviceSearch) return [];
    const search = cloneDeviceSearch.toLowerCase();
    return devices.filter(d => {
      const brand = brands.find(b => b.id === d.brandId);
      const deviceType = deviceTypes.find(t => t.id === d.deviceTypeId);
      const searchText = `${d.name} ${brand?.name || ""} ${deviceType?.name || ""}`.toLowerCase();
      return searchText.includes(search);
    }).slice(0, 20);
  }, [devices, brands, deviceTypes, cloneDeviceSearch]);

  const handleEdit = (device: Device) => {
    setEditItem(device);
    setEditOpen(true);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editItem) return;
    updateMutation.mutate({ 
      id: editItem.id, 
      data: { 
        name: editItem.name, 
        deviceTypeId: editItem.deviceTypeId, 
        brandId: editItem.brandId,
        imageUrl: editItem.imageUrl,
        releaseDate: (editItem as any).releaseDate || null
      } 
    });
  };

  const getTypeName = (typeId: string) => deviceTypes.find((t) => t.id === typeId)?.name || "Unknown";
  const getBrandName = (brandId: string | null) => brandId ? (brands.find((b) => b.id === brandId)?.name || "Unknown") : "-";

  const handleBulkImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setBulkImporting(true);
    setBulkResults(null);

    try {
      const XLSX = await import("xlsx");
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);

      const devices = rows.map((row) => {
        const getField = (keys: string[]) => {
          for (const key of keys) {
            const val = row[key] || row[key.toLowerCase()] || row[key.toUpperCase()];
            if (val !== undefined && val !== null && val !== "") return String(val).trim();
          }
          return "";
        };
        
        return {
          brand: getField(["Brand", "brand", "BRAND", "Make", "make", "Manufacturer"]),
          type: getField(["Type", "type", "TYPE", "Device Type", "device type", "Category", "category"]),
          modelName: getField(["Model Name", "Model", "model", "MODEL", "Device", "device", "DEVICE", "Device Name", "Device Model", "Name", "name"]),
          imageUrl: getField(["Image URL", "Image", "image", "IMAGE", "ImageUrl", "imageUrl", "Picture", "Photo", "URL"]),
        };
      });

      const res = await apiRequest("POST", "/api/devices/bulk-import", { devices });
      const result = await res.json();
      setBulkResults(result);
      queryClient.invalidateQueries({ queryKey: ["/api/devices"] });
      
      if (result.created > 0) {
        toast({ title: `Imported ${result.created} device(s)` });
      }
    } catch (error: any) {
      toast({ title: "Import failed", description: error.message, variant: "destructive" });
    } finally {
      setBulkImporting(false);
      e.target.value = "";
    }
  };

  const downloadTemplate = async () => {
    try {
      const res = await fetch("/api/devices/template", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to download template");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "device-import-template.xlsx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast({ title: "Error", description: "Failed to download template", variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 space-y-0 pb-4">
        <div className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Devices</CardTitle>
            <CardDescription>Manage specific device models</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleBulkLinkOpen} data-testid="button-bulk-add-links">
              <Layers className="h-4 w-4 mr-2" />Bulk Add Links
            </Button>
            <Dialog open={bulkOpen} onOpenChange={(o) => { setBulkOpen(o); if (!o) setBulkResults(null); }}>
              <DialogTrigger asChild>
                <Button variant="outline" data-testid="button-bulk-import-device"><Upload className="h-4 w-4 mr-2" />Bulk Import</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Bulk Import Devices</DialogTitle>
                  <DialogDescription>Upload an Excel file to import multiple devices at once</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={downloadTemplate} data-testid="button-download-template">
                      Download Sample Template
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Label>Upload Excel File (.xlsx)</Label>
                    <Input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleBulkImport}
                      disabled={bulkImporting}
                      data-testid="input-bulk-file"
                    />
                    {bulkImporting && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Importing...
                      </div>
                    )}
                  </div>
                  {bulkResults && (
                    <div className="space-y-2 p-3 rounded-md bg-muted">
                      <p className="font-medium">Import Results:</p>
                      <p className="text-sm text-green-600">{bulkResults.created} device(s) created</p>
                      {bulkResults.errors.length > 0 && (
                        <div className="text-sm text-destructive space-y-1">
                          {bulkResults.errors.slice(0, 5).map((err, i) => (
                            <p key={i}>{err}</p>
                          ))}
                          {bulkResults.errors.length > 5 && (
                            <p>...and {bulkResults.errors.length - 5} more errors</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setBulkOpen(false)}>Close</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button
              variant="outline"
              disabled={bulkDetecting}
              data-testid="button-bulk-detect-dates"
              onClick={async () => {
                const devicesWithoutDate = devices.filter(d => !d.releaseDate);
                if (devicesWithoutDate.length === 0) {
                  toast({ title: "All devices already have release dates" });
                  return;
                }
                if (!confirm(`Auto-detect release dates for ${devicesWithoutDate.length} devices without dates? This may take a few minutes.`)) return;
                setBulkDetecting(true);
                try {
                  const res = await apiRequest("POST", "/api/devices/bulk-detect-release-dates");
                  const data = await res.json();
                  const desc = data.skippedRateLimit > 0
                    ? `${data.updated} updated, ${data.failed} failed (${data.skippedRateLimit} hit rate limits). Click again to retry remaining.`
                    : `${data.updated} updated, ${data.failed} failed out of ${data.total} devices`;
                  toast({
                    title: "Bulk Detection Complete",
                    description: desc,
                  });
                  queryClient.invalidateQueries({ queryKey: ["/api/devices"] });
                } catch (error: any) {
                  toast({ title: "Bulk detection failed", description: error.message, variant: "destructive" });
                } finally {
                  setBulkDetecting(false);
                }
              }}
            >
              {bulkDetecting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Calendar className="h-4 w-4 mr-2" />}
              {bulkDetecting ? "Detecting..." : "Auto-Detect Dates"}
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-device"><Plus className="h-4 w-4 mr-2" />Add Device</Button>
              </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>Add Device</DialogTitle>
                <DialogDescription>Create a new device model</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., iPhone 15 Pro" required data-testid="input-device-name" />
                </div>
                <div className="space-y-2">
                  <Label>Device Type</Label>
                  <Select value={deviceTypeId} onValueChange={setDeviceTypeId} required>
                    <SelectTrigger data-testid="select-device-type"><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent>
                      {deviceTypes.map((type) => (<SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Brand</Label>
                  <Select value={brandId} onValueChange={setBrandId}>
                    <SelectTrigger data-testid="select-device-brand"><SelectValue placeholder="Select brand (optional)" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No brand</SelectItem>
                      {brands.map((brand) => (<SelectItem key={brand.id} value={brand.id}>{brand.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <ImageInput
                  value={imageUrl}
                  onChange={setImageUrl}
                  onError={(msg) => toast({ title: "Upload Error", description: msg, variant: "destructive" })}
                  label="Device Image"
                  placeholder="Enter image URL"
                  testIdPrefix="device-image"
                />
                <div className="space-y-2">
                  <Label>Release Date</Label>
                  <div className="flex gap-2">
                    <Input
                      type="date"
                      value={releaseDate}
                      onChange={(e) => setReleaseDate(e.target.value)}
                      data-testid="input-device-release-date"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="default"
                      disabled={detectingReleaseDate || !name}
                      onClick={() => {
                        const brandName = brandId && brandId !== "none" ? brands.find(b => b.id === brandId)?.name : undefined;
                        detectReleaseDate(name, brandName, setReleaseDate, setDetectingReleaseDate);
                      }}
                      data-testid="button-detect-release-date"
                    >
                      {detectingReleaseDate ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Wand2 className="h-4 w-4 mr-1" />}
                      Auto-detect
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Used for sorting devices (newest first). Click Auto-detect to look up automatically.</p>
                </div>
                <div className="space-y-2 pt-2 border-t">
                  <Label>Clone Service Links From (Optional)</Label>
                  <p className="text-xs text-muted-foreground">Copy all service links from an existing device. Parts will need to be assigned separately.</p>
                  <Input 
                    value={cloneDeviceSearch} 
                    onChange={(e) => {
                      setCloneDeviceSearch(e.target.value);
                      if (!e.target.value) setCloneFromDeviceId("");
                    }} 
                    placeholder="Search for a device to clone from..." 
                    data-testid="input-clone-device-search" 
                  />
                  {cloneDeviceSearch && cloneSourceDevices.length > 0 && !cloneFromDeviceId && (
                    <div className="border rounded-md max-h-40 overflow-y-auto">
                      {cloneSourceDevices.map((device) => {
                        const brand = brands.find(b => b.id === device.brandId);
                        const deviceType = deviceTypes.find(t => t.id === device.deviceTypeId);
                        return (
                          <div 
                            key={device.id} 
                            className="px-3 py-2 cursor-pointer hover-elevate"
                            onClick={() => {
                              setCloneFromDeviceId(device.id);
                              setCloneDeviceSearch(`${brand?.name || ""} ${device.name}`.trim());
                            }}
                            data-testid={`clone-option-${device.id}`}
                          >
                            <span className="font-medium">{device.name}</span>
                            {brand && <span className="text-muted-foreground"> - {brand.name}</span>}
                            <span className="text-xs text-muted-foreground ml-2">({deviceType?.name})</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {cloneFromDeviceId && (
                    <div className="flex items-center gap-2 text-sm">
                      <Badge variant="secondary">
                        {(() => {
                          const device = devices.find(d => d.id === cloneFromDeviceId);
                          const brand = brands.find(b => b.id === device?.brandId);
                          return `${brand?.name || ""} ${device?.name || ""}`.trim();
                        })()}
                      </Badge>
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => { setCloneFromDeviceId(""); setCloneDeviceSearch(""); }}
                        data-testid="button-clear-clone"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={createMutation.isPending || !deviceTypeId} data-testid="button-save-device">
                  {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
            </Dialog>
          </div>
        </div>
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent>
            <form onSubmit={handleEditSubmit}>
              <DialogHeader>
                <DialogTitle>Edit Device</DialogTitle>
                <DialogDescription>Update device model</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={editItem?.name || ""} onChange={(e) => setEditItem(prev => prev ? {...prev, name: e.target.value} : null)} required data-testid="input-edit-device-name" />
                </div>
                <div className="space-y-2">
                  <Label>Device Type</Label>
                  <Select value={editItem?.deviceTypeId || ""} onValueChange={(v) => setEditItem(prev => prev ? {...prev, deviceTypeId: v} : null)}>
                    <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent>
                      {deviceTypes.map((type) => (<SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Brand</Label>
                  <Select value={editItem?.brandId || "none"} onValueChange={(v) => setEditItem(prev => prev ? {...prev, brandId: v === "none" ? null : v} : null)}>
                    <SelectTrigger><SelectValue placeholder="Select brand" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No brand</SelectItem>
                      {brands.map((brand) => (<SelectItem key={brand.id} value={brand.id}>{brand.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <ImageInput
                  value={editItem?.imageUrl || ""}
                  onChange={(url) => setEditItem(prev => prev ? {...prev, imageUrl: url || null} : null)}
                  onError={(msg) => toast({ title: "Upload Error", description: msg, variant: "destructive" })}
                  label="Device Image"
                  placeholder="Enter image URL"
                  testIdPrefix="edit-device-image"
                />
                <div className="space-y-2">
                  <Label>Release Date</Label>
                  <div className="flex gap-2">
                    <Input
                      type="date"
                      value={(editItem as any)?.releaseDate || ""}
                      onChange={(e) => setEditItem(prev => prev ? {...prev, releaseDate: e.target.value} : null)}
                      data-testid="input-edit-device-release-date"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="default"
                      disabled={detectingEditReleaseDate || !editItem?.name}
                      onClick={() => {
                        if (!editItem) return;
                        const brandName = editItem.brandId ? brands.find(b => b.id === editItem.brandId)?.name : undefined;
                        detectReleaseDate(editItem.name, brandName, (date) => setEditItem(prev => prev ? {...prev, releaseDate: date} : null), setDetectingEditReleaseDate);
                      }}
                      data-testid="button-edit-detect-release-date"
                    >
                      {detectingEditReleaseDate ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Wand2 className="h-4 w-4 mr-1" />}
                      Auto-detect
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Used for sorting devices (newest first)</p>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={updateMutation.isPending} data-testid="button-update-device">
                  {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        <div className="flex flex-wrap gap-4 items-center">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search devices..."
              value={deviceSearch}
              onChange={(e) => setDeviceSearch(e.target.value)}
              className="pl-8 w-[200px]"
              data-testid="input-device-search"
            />
          </div>
          <Select value={filterTypeId} onValueChange={setFilterTypeId}>
            <SelectTrigger className="w-[180px]" data-testid="select-filter-type">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {deviceTypes.map((type) => (<SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>))}
            </SelectContent>
          </Select>
          <Select value={filterBrandId} onValueChange={setFilterBrandId}>
            <SelectTrigger className="w-[180px]" data-testid="select-filter-brand">
              <SelectValue placeholder="Filter by brand" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Brands</SelectItem>
              <SelectItem value="none">No Brand</SelectItem>
              {brands.map((brand) => (<SelectItem key={brand.id} value={brand.id}>{brand.name}</SelectItem>))}
            </SelectContent>
          </Select>
          {(deviceSearch || filterTypeId !== "all" || filterBrandId !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setDeviceSearch(""); setFilterTypeId("all"); setFilterBrandId("all"); }}
              data-testid="button-clear-device-filters"
            >
              <X className="h-4 w-4 mr-1" /> Clear
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : filteredDevices.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">{devices.length === 0 ? "No devices yet. Add your first one!" : "No devices match your filters."}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">Image</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Brand</TableHead>
                <TableHead className="w-[50px]">Links</TableHead>
                <TableHead className="w-[120px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDevices.map((device) => {
                const linkCount = allDeviceServices.filter(ds => ds.deviceId === device.id).length;
                return (
                <TableRow key={device.id}>
                  <TableCell>
                    {device.imageUrl ? (
                      <img src={device.imageUrl} alt={device.name} className="h-8 w-8 object-contain rounded" />
                    ) : (
                      <div className="h-8 w-8 bg-muted rounded flex items-center justify-center text-xs text-muted-foreground">-</div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{device.name}</TableCell>
                  <TableCell><Badge variant="secondary">{getTypeName(device.deviceTypeId)}</Badge></TableCell>
                  <TableCell>{getBrandName(device.brandId)}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => handleManageLinks(device)} data-testid={`button-manage-links-${device.id}`}>
                      {linkCount}
                    </Button>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(device)} data-testid={`button-edit-device-${device.id}`}><Pencil className="h-4 w-4" /></Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" disabled={deleteMutation.isPending} data-testid={`button-delete-device-${device.id}`}><Trash2 className="h-4 w-4" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>This will permanently delete this device and all its service links. This action cannot be undone.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteMutation.mutate(device.id)} data-testid={`confirm-delete-device-${device.id}`}>Delete</AlertDialogAction>
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
        )}
      </CardContent>

      {/* Manage Service Links Dialog */}
      <Dialog open={linksOpen} onOpenChange={setLinksOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Service Links for {linksDevice?.name}</DialogTitle>
            <DialogDescription>Manage which services are available for this device</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="flex justify-end mb-4">
              <Button onClick={handleAddLink} data-testid="button-add-device-link">
                <Plus className="h-4 w-4 mr-2" />Add Service Link
              </Button>
            </div>
            {deviceServiceLinks.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No service links yet. Add one to enable quotes for this device.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Service</TableHead>
                    <TableHead>Part SKU</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deviceServiceLinks.map((link) => {
                    const service = services.find(s => s.id === link.serviceId);
                    const partPrice = link.part?.price || 0;
                    const totalPrice = service ? (Number(service.laborPrice) + Number(partPrice) * Number(service.partsMarkup)).toFixed(2) : "N/A";
                    return (
                      <TableRow key={link.id}>
                        <TableCell className="font-medium">{link.service?.name || "Unknown"}</TableCell>
                        <TableCell>
                          {link.part ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="cursor-help underline decoration-dotted">{link.part.sku}</span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="font-medium">{link.part.name}</p>
                                <p className="text-xs text-muted-foreground">${link.part.price}</p>
                              </TooltipContent>
                            </Tooltip>
                          ) : link.partSku ? (
                            <span>{link.partSku}</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                          {!link.part && link.partSku && <Badge variant="outline" className="ml-2 text-orange-600 border-orange-600">missing</Badge>}
                        </TableCell>
                        <TableCell>
                          {(link as any).manualPriceOverride ? (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span>${Number((link as any).manualPriceOverride).toFixed(2)}</span>
                              <Badge variant="secondary" className="text-xs"><DollarSign className="h-3 w-3 mr-0.5" />Override</Badge>
                            </div>
                          ) : link.part || service?.labourOnly ? `$${totalPrice}` : <span className="text-muted-foreground">Not Available</span>}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleEditLink(link)} data-testid={`button-edit-link-${link.id}`}><Pencil className="h-4 w-4" /></Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" disabled={deleteLinkMutation.isPending} data-testid={`button-delete-link-${link.id}`}><Trash2 className="h-4 w-4" /></Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                  <AlertDialogDescription>This will permanently delete this service link. This action cannot be undone.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deleteLinkMutation.mutate(link.id)} data-testid={`confirm-delete-link-${link.id}`}>Delete</AlertDialogAction>
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
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinksOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Service Link Dialog */}
      <Dialog open={addLinkOpen} onOpenChange={setAddLinkOpen}>
        <DialogContent>
          <form onSubmit={handleAddLinkSubmit}>
            <DialogHeader>
              <DialogTitle>Add Service Link</DialogTitle>
              <DialogDescription>Link a service to {linksDevice?.name}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Service</Label>
                <Select value={linkServiceId} onValueChange={setLinkServiceId} required>
                  <SelectTrigger data-testid="select-add-link-service"><SelectValue placeholder="Select service" /></SelectTrigger>
                  <SelectContent>
                    {services.map((service) => (<SelectItem key={service.id} value={service.id}>{service.name} (${service.laborPrice} + {service.partsMarkup}x)</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Part SKU (optional)</Label>
                <Input value={linkPartSku} onChange={(e) => { setLinkPartSku(e.target.value); setLinkPartId(undefined); }} placeholder="Enter SKU" data-testid="input-add-link-sku" />
                {linkPartSku && linkSkuPart && (
                  <p className="text-sm text-green-600">Found: {linkSkuPart.name} (${linkSkuPart.price})</p>
                )}
                {linkPartSku && !linkSkuPart && linkPartSku.length > 0 && (
                  <p className="text-sm text-destructive">SKU not found</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Or Search Part by Name</Label>
                <Input value={linkPartSearch} onChange={(e) => setLinkPartSearch(e.target.value)} placeholder="Type to search parts..." data-testid="input-add-link-part-search" />
                {linkPartSearch.length > 0 && (
                  <Select value={linkPartId} onValueChange={(v) => { setLinkPartId(v); setLinkPartSku(""); }}>
                    <SelectTrigger><SelectValue placeholder="Select from results" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No part required</SelectItem>
                      {linkFilteredParts.map((part) => (<SelectItem key={part.id} value={part.id}>{part.sku} - {part.name} (${part.price})</SelectItem>))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={createLinkMutation.isPending || !linkServiceId} data-testid="button-save-add-link">
                {createLinkMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Service Link Dialog */}
      <Dialog open={editLinkOpen} onOpenChange={(open) => { setEditLinkOpen(open); if (!open) { setAdditionalPartSku(""); setLinkAlternativePartSkus([]); setLinkAlternativePartInfo({}); setLinkAltPartSearch(""); setLinkAdditionalFee(""); setLinkManualPriceOverride(""); } }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <form onSubmit={handleEditLinkSubmit}>
            <DialogHeader>
              <DialogTitle>Edit Service Link</DialogTitle>
              <DialogDescription>Update parts for {editLinkItem?.service?.name}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Service</Label>
                <Input value={editLinkItem?.service?.name || ""} disabled />
                {editLinkItem?.service?.secondaryPartPercentage !== undefined && editLinkItem.service.secondaryPartPercentage !== 100 && (
                  <p className="text-xs text-muted-foreground">Secondary parts charged at {editLinkItem.service.secondaryPartPercentage}%</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Primary Part SKU</Label>
                <Input value={linkPartSku} onChange={(e) => setLinkPartSku(e.target.value)} placeholder="Enter SKU" data-testid="input-edit-link-sku" />
                {linkPartSku && linkSkuPart && (
                  <p className="text-sm text-green-600">Found: {linkSkuPart.name} (${linkSkuPart.price})</p>
                )}
                {linkPartSku && !linkSkuPart && linkPartSku.length > 0 && (
                  <p className="text-sm text-destructive">SKU not found</p>
                )}
              </div>
              
              {/* Additional Parts Section */}
              <div className="space-y-2 border-t pt-4">
                <Label>Additional Parts (Secondary)</Label>
                <p className="text-xs text-muted-foreground mb-2">These parts will be charged at {editLinkItem?.service?.secondaryPartPercentage || 100}% of their cost</p>
                
                {/* List existing additional parts */}
                {additionalParts.filter(ap => !ap.isPrimary).length > 0 && (
                  <div className="space-y-1 mb-2">
                    {additionalParts.filter(ap => !ap.isPrimary).map((ap) => (
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
                              disabled={removeAdditionalPartMutation.isPending}
                              data-testid={`button-remove-additional-part-${ap.id}`}
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
                              <AlertDialogAction onClick={() => removeAdditionalPartMutation.mutate(ap.id)} data-testid={`confirm-remove-additional-part-${ap.id}`}>Remove</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Add new additional part */}
                <div className="flex gap-2">
                  <Input 
                    value={additionalPartSku} 
                    onChange={(e) => setAdditionalPartSku(e.target.value)} 
                    placeholder="Enter additional part SKU" 
                    className="flex-1"
                    data-testid="input-additional-part-sku" 
                  />
                  <Button 
                    type="button"
                    size="sm"
                    disabled={!additionalSkuPart || addAdditionalPartMutation.isPending}
                    onClick={() => {
                      if (additionalSkuPart && editLinkItem) {
                        addAdditionalPartMutation.mutate({
                          deviceServiceId: editLinkItem.id,
                          partId: additionalSkuPart.id,
                          partSku: additionalSkuPart.sku,
                        });
                      }
                    }}
                    data-testid="button-add-additional-part"
                  >
                    {addAdditionalPartMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  </Button>
                </div>
                {additionalPartSku && additionalSkuPart && (
                  <p className="text-sm text-green-600">Found: {additionalSkuPart.name} (${additionalSkuPart.price})</p>
                )}
                {additionalPartSku && !additionalSkuPart && additionalPartSku.length > 0 && (
                  <p className="text-sm text-destructive">SKU not found</p>
                )}
              </div>

              {/* Additional Fee */}
              <div className="space-y-2">
                <Label htmlFor="link-additional-fee">Additional Fee ($)</Label>
                <Input
                  id="link-additional-fee"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={linkAdditionalFee}
                  onChange={(e) => setLinkAdditionalFee(e.target.value)}
                  data-testid="input-link-additional-fee"
                />
                <p className="text-xs text-muted-foreground">Extra fee for this specific device-service combination (e.g., Samsung charge port). Added to total before rounding.</p>
              </div>

              {/* Manual Price Override */}
              <div className="space-y-2">
                <Label htmlFor="link-manual-price-override">Manual Price Override ($)</Label>
                <Input
                  id="link-manual-price-override"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 129.99"
                  value={linkManualPriceOverride}
                  onChange={(e) => setLinkManualPriceOverride(e.target.value)}
                  data-testid="input-link-manual-price-override"
                />
                <p className="text-xs text-muted-foreground">If set, bypasses all price calculations (labor, parts, markup, rounding) and displays this exact price to customers.</p>
              </div>
              
              {/* Alternative Primary Parts Section */}
              <div className="space-y-2 border-t pt-4">
                <Label>Alternative Primary Parts ({linkAlternativePartSkus.length}/10)</Label>
                <p className="text-xs text-muted-foreground">Add alternative parts that can be used instead of the primary part. The cheapest available option will be used for pricing.</p>
                
                {/* Display selected alternative parts */}
                {linkAlternativePartSkus.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {linkAlternativePartSkus.map((sku) => (
                      <Tooltip key={sku}>
                        <TooltipTrigger asChild>
                          <Badge variant="secondary" className="cursor-help" data-testid={`badge-link-alt-sku-${sku}`}>
                            {sku}
                            <button
                              type="button"
                              className="ml-1 hover:text-destructive"
                              data-testid={`button-remove-link-alt-sku-${sku}`}
                              onClick={() => {
                                setLinkAlternativePartSkus(prev => prev.filter(s => s !== sku));
                                setLinkAlternativePartInfo(prev => {
                                  const newInfo = { ...prev };
                                  delete newInfo[sku];
                                  return newInfo;
                                });
                              }}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        </TooltipTrigger>
                        {linkAlternativePartInfo[sku] && (
                          <TooltipContent>
                            <p className="font-medium">{linkAlternativePartInfo[sku].name}</p>
                            <p className="text-xs text-muted-foreground">${linkAlternativePartInfo[sku].price}</p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    ))}
                  </div>
                )}
                
                {/* Search to add alternative parts */}
                <div className="relative">
                  <Input
                    value={linkAltPartSearch}
                    onChange={(e) => setLinkAltPartSearch(e.target.value)}
                    placeholder="Search to add alternative part..."
                    data-testid="input-link-alt-part-search"
                  />
                  {linkAltFilteredParts.length > 0 && linkAltPartSearch && (
                    <div className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-40 overflow-y-auto">
                      {linkAlternativePartSkus.length >= 10 ? (
                        <p className="px-3 py-2 text-sm text-muted-foreground">Maximum 10 alternative parts allowed</p>
                      ) : linkAltFilteredParts.slice(0, 10).map((p) => (
                        <div
                          key={p.id}
                          className="px-3 py-2 hover-elevate cursor-pointer text-sm"
                          data-testid={`option-link-alt-part-${p.sku}`}
                          onClick={() => {
                            if (!linkAlternativePartSkus.includes(p.sku) && linkAlternativePartSkus.length < 10) {
                              setLinkAlternativePartSkus(prev => [...prev, p.sku]);
                              setLinkAlternativePartInfo(prev => ({
                                ...prev,
                                [p.sku]: { name: p.name, price: p.price }
                              }));
                            }
                            setLinkAltPartSearch("");
                          }}
                        >
                          <span className="font-medium">{p.sku}</span>
                          <span className="ml-2 text-muted-foreground">{p.name} (${p.price})</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={updateLinkMutation.isPending} data-testid="button-save-edit-link">
                {updateLinkMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Bulk Add Service Links Dialog */}
      <Dialog open={bulkLinkOpen} onOpenChange={setBulkLinkOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <form onSubmit={handleBulkLinkSubmit}>
            <DialogHeader>
              <DialogTitle>Bulk Add Service Links</DialogTitle>
              <DialogDescription>Link multiple services to multiple devices at once. No parts will be attached.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Device Type</Label>
                  <Select value={bulkLinkTypeId} onValueChange={setBulkLinkTypeId}>
                    <SelectTrigger data-testid="select-bulk-link-type"><SelectValue placeholder="All Types" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      {deviceTypes.map((type) => (<SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Brand</Label>
                  <Select value={bulkLinkBrandId} onValueChange={setBulkLinkBrandId}>
                    <SelectTrigger data-testid="select-bulk-link-brand"><SelectValue placeholder="All Brands" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Brands</SelectItem>
                      {brands.map((brand) => (<SelectItem key={brand.id} value={brand.id}>{brand.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="p-3 bg-muted rounded-md">
                <p className="text-sm font-medium mb-1">Target Devices: {bulkLinkDevices.length}</p>
                <p className="text-xs text-muted-foreground">
                  {bulkLinkTypeId !== "all" && `Type: ${deviceTypes.find(t => t.id === bulkLinkTypeId)?.name}`}
                  {bulkLinkTypeId !== "all" && bulkLinkBrandId !== "all" && " / "}
                  {bulkLinkBrandId !== "all" && `Brand: ${brands.find(b => b.id === bulkLinkBrandId)?.name}`}
                  {bulkLinkTypeId === "all" && bulkLinkBrandId === "all" && "All devices"}
                </p>
              </div>
              <div className="space-y-2">
                <Label>Select Services to Link</Label>
                <div className="border rounded-md max-h-60 overflow-y-auto">
                  {services.map((service) => (
                    <div
                      key={service.id}
                      className="flex items-center gap-3 px-3 py-2 border-b last:border-b-0 hover-elevate cursor-pointer"
                      onClick={() => toggleBulkLinkService(service.id)}
                    >
                      <input
                        type="checkbox"
                        checked={bulkLinkSelectedServices.has(service.id)}
                        onChange={() => toggleBulkLinkService(service.id)}
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
                <p className="text-sm text-muted-foreground">{bulkLinkSelectedServices.size} service(s) selected</p>
              </div>
              <div className="p-3 bg-primary/10 rounded-md">
                <p className="text-sm font-medium">
                  This will create up to {bulkLinkDevices.length * bulkLinkSelectedServices.size} links
                </p>
                <p className="text-xs text-muted-foreground">Existing links will be skipped automatically</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setBulkLinkOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={bulkLinkMutation.isPending || bulkLinkSelectedServices.size === 0 || bulkLinkDevices.length === 0} data-testid="button-bulk-link-submit">
                {bulkLinkMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : `Create ${bulkLinkDevices.length * bulkLinkSelectedServices.size} Links`}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

