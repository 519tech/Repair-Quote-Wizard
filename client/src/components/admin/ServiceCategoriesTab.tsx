import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, Loader2, Pencil, ArrowUp, ArrowDown } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ImageInput } from "@/components/ImageInput";
import type { Service, ServiceCategory, Brand } from "@shared/schema";

type BrandServiceCategoryWithRelations = {
  id: string;
  brandId: string;
  categoryId: string;
  brand: Brand;
  category: ServiceCategory;
};

export function ServiceCategoriesTab({ toast }: { toast: ReturnType<typeof useToast>["toast"] }) {
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState<ServiceCategory | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkCategory, setLinkCategory] = useState<ServiceCategory | null>(null);
  const [selectedBrandId, setSelectedBrandId] = useState<string>("");

  const { data: categories = [], isLoading } = useQuery<ServiceCategory[]>({ queryKey: ["/api/service-categories"] });
  const { data: brands = [] } = useQuery<Brand[]>({ queryKey: ["/api/brands"] });
  const { data: brandCategoryLinks = [] } = useQuery<BrandServiceCategoryWithRelations[]>({ queryKey: ["/api/brand-service-categories"] });

  const getLinkedBrands = (categoryId: string) => {
    return brandCategoryLinks.filter(link => link.categoryId === categoryId).map(link => link.brand);
  };

  const getLinkedBrandIds = (categoryId: string) => {
    return new Set(brandCategoryLinks.filter(link => link.categoryId === categoryId).map(link => link.brandId));
  };

  const getLinkId = (categoryId: string, brandId: string) => {
    const link = brandCategoryLinks.find(l => l.categoryId === categoryId && l.brandId === brandId);
    return link?.id;
  };

  const createLinkMutation = useMutation({
    mutationFn: async (data: { brandId: string; categoryId: string }) => {
      const res = await apiRequest("POST", "/api/brand-service-categories", data);
      if (!res.ok) throw new Error("Failed to link brand");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/brand-service-categories"] });
      setSelectedBrandId("");
      toast({ title: "Brand linked to category" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteLinkMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/brand-service-categories/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/brand-service-categories"] });
      toast({ title: "Brand unlinked from category" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleAddLink = () => {
    if (!linkCategory || !selectedBrandId) return;
    createLinkMutation.mutate({ brandId: selectedBrandId, categoryId: linkCategory.id });
  };

  const handleRemoveLink = (categoryId: string, brandId: string) => {
    const linkId = getLinkId(categoryId, brandId);
    if (linkId) deleteLinkMutation.mutate(linkId);
  };

  const openLinkDialog = (category: ServiceCategory) => {
    setLinkCategory(category);
    setSelectedBrandId("");
    setLinkOpen(true);
  };

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string; imageUrl?: string }) => {
      const res = await apiRequest("POST", "/api/service-categories", data);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to create category");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-categories"] });
      setOpen(false);
      setName("");
      setDescription("");
      setImageUrl("");
      toast({ title: "Service category created" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ServiceCategory> }) => {
      const res = await apiRequest("PATCH", `/api/service-categories/${id}`, data);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to update category");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-categories"] });
      setEditOpen(false);
      setEditItem(null);
      toast({ title: "Service category updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/service-categories/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-categories"] });
      toast({ title: "Service category deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      await apiRequest("POST", "/api/service-categories/reorder", { orderedIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-categories"] });
      toast({ title: "Categories reordered" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newOrder = [...categories];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    reorderMutation.mutate(newOrder.map(c => c.id));
  };

  const handleMoveDown = (index: number) => {
    if (index === categories.length - 1) return;
    const newOrder = [...categories];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    reorderMutation.mutate(newOrder.map(c => c.id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({ name, description: description || undefined, imageUrl: imageUrl || undefined });
  };

  const handleEdit = (category: ServiceCategory) => {
    setEditItem(category);
    setEditOpen(true);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editItem) return;
    updateMutation.mutate({ id: editItem.id, data: { name: editItem.name, description: editItem.description || undefined, imageUrl: editItem.imageUrl || undefined } });
  };

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 space-y-0 pb-4">
        <div>
          <CardTitle>Service Categories</CardTitle>
          <CardDescription>Group services by category (e.g., Battery Replacement, Screen Replacement)</CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="self-end sm:self-auto" data-testid="button-add-category"><Plus className="h-4 w-4 mr-1" />Add Category</Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>Add Service Category</DialogTitle>
                <DialogDescription>Create a new category to group related services</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Battery Replacement" required data-testid="input-category-name" />
                </div>
                <div className="space-y-2">
                  <Label>Description (optional)</Label>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description of this category" data-testid="input-category-description" />
                </div>
                <ImageInput
                  value={imageUrl}
                  onChange={setImageUrl}
                  label="Image (optional)"
                  placeholder="Enter image URL"
                  testIdPrefix="category-image"
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-category">
                  {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : categories.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">No service categories yet. Add one to group your services.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Order</TableHead>
                <TableHead className="w-16">Image</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((category, index) => (
                  <TableRow key={category.id}>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleMoveUp(index)} 
                          disabled={index === 0 || reorderMutation.isPending}
                          data-testid={`button-move-up-category-${category.id}`}
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleMoveDown(index)} 
                          disabled={index === categories.length - 1 || reorderMutation.isPending}
                          data-testid={`button-move-down-category-${category.id}`}
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      {category.imageUrl ? (
                        <img src={category.imageUrl} alt={category.name} className="h-10 w-10 object-contain rounded" />
                      ) : (
                        <div className="h-10 w-10 bg-muted rounded flex items-center justify-center text-muted-foreground text-xs">-</div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{category.name}</TableCell>
                    <TableCell className="text-muted-foreground">{category.description || "-"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(category)} data-testid={`button-edit-category-${category.id}`}><Pencil className="h-4 w-4" /></Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" disabled={deleteMutation.isPending} data-testid={`button-delete-category-${category.id}`}><Trash2 className="h-4 w-4" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                              <AlertDialogDescription>This will permanently delete this service category. This action cannot be undone.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteMutation.mutate(category.id)} data-testid={`confirm-delete-category-${category.id}`}>Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        )}

        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent>
            <form onSubmit={handleEditSubmit}>
              <DialogHeader>
                <DialogTitle>Edit Service Category</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={editItem?.name || ""} onChange={(e) => setEditItem(editItem ? { ...editItem, name: e.target.value } : null)} required data-testid="input-edit-category-name" />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea value={editItem?.description || ""} onChange={(e) => setEditItem(editItem ? { ...editItem, description: e.target.value } : null)} data-testid="input-edit-category-description" />
                </div>
                <ImageInput
                  value={editItem?.imageUrl || ""}
                  onChange={(url) => setEditItem(editItem ? { ...editItem, imageUrl: url } : null)}
                  label="Image (optional)"
                  placeholder="Enter image URL"
                  testIdPrefix="edit-category-image"
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={updateMutation.isPending} data-testid="button-update-category">
                  {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

              </CardContent>
    </Card>
  );
}


export function ServicesListTab({ toast }: { toast: ReturnType<typeof useToast>["toast"] }) {
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState<Service | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [brandId, setBrandId] = useState<string | null>(null);
  const [warranty, setWarranty] = useState("");
  const [repairTime, setRepairTime] = useState("");
  const [laborPrice, setLaborPrice] = useState("");
  const [partsMarkup, setPartsMarkup] = useState("1.0");
  const [secondaryPartPercentage, setSecondaryPartPercentage] = useState("50");
  const [notes, setNotes] = useState("");
  const [labourOnly, setLabourOnly] = useState(false);
  const [bypassMultiDiscount, setBypassMultiDiscount] = useState(false);
  const [bypassRounding, setBypassRounding] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [filterCategoryId, setFilterCategoryId] = useState("all");
  const [filterBrandId, setFilterBrandId] = useState("all");

  // Inline editing state
  const [inlineEditingService, setInlineEditingService] = useState<{ id: string; field: string; value: string } | null>(null);

  const { data: services = [], isLoading } = useQuery<Service[]>({ queryKey: ["/api/services"] });
  const { data: categories = [] } = useQuery<ServiceCategory[]>({ queryKey: ["/api/service-categories"] });
  const { data: brands = [] } = useQuery<Brand[]>({ queryKey: ["/api/brands"] });

  const filteredServices = useMemo(() => {
    let result = services;
    if (filterCategoryId === "none") result = result.filter(s => !s.categoryId);
    else if (filterCategoryId !== "all") result = result.filter(s => s.categoryId === filterCategoryId);
    if (filterBrandId === "none") result = result.filter(s => !s.brandId);
    else if (filterBrandId !== "all") result = result.filter(s => s.brandId === filterBrandId);
    // Sort by name to maintain consistent order
    return [...result].sort((a, b) => a.name.localeCompare(b.name));
  }, [services, filterCategoryId, filterBrandId]);

  const getCategoryName = (catId: string | null) => {
    if (!catId) return "-";
    const cat = categories.find(c => c.id === catId);
    return cat?.name || "-";
  };

  const getBrandName = (bId: string | null) => {
    if (!bId) return "-";
    const brand = brands.find(b => b.id === bId);
    return brand?.name || "-";
  };

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; categoryId?: string; brandId?: string; description?: string; warranty?: string; repairTime?: string; laborPrice: string; partsMarkup: string; secondaryPartPercentage?: number; notes?: string; labourOnly?: boolean; bypassMultiDiscount?: boolean; bypassRounding?: boolean; imageUrl?: string }) => {
      const res = await apiRequest("POST", "/api/services", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      setOpen(false);
      setName("");
      setDescription("");
      setCategoryId(null);
      setBrandId(null);
      setWarranty("");
      setRepairTime("");
      setLaborPrice("");
      setPartsMarkup("1.0");
      setSecondaryPartPercentage("50");
      setNotes("");
      setLabourOnly(false);
      setBypassMultiDiscount(false);
      setBypassRounding(false);
      setImageUrl("");
      toast({ title: "Service created" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Service> }) => {
      const res = await apiRequest("PATCH", `/api/services/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      setEditOpen(false);
      setEditItem(null);
      toast({ title: "Service updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/services/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      toast({ title: "Service deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({ 
      name, 
      categoryId: categoryId || undefined,
      brandId: brandId || undefined,
      description: description || undefined, 
      warranty: warranty || undefined,
      repairTime: repairTime || undefined,
      laborPrice, 
      partsMarkup,
      secondaryPartPercentage: secondaryPartPercentage === "" ? 50 : parseInt(secondaryPartPercentage),
      notes: notes || undefined,
      labourOnly,
      bypassMultiDiscount,
      bypassRounding,
      imageUrl: imageUrl || undefined
    });
  };

  const handleEdit = (service: Service) => {
    setEditItem(service);
    setEditOpen(true);
  };

  // Inline editing handlers
  const inlineUpdateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Service> }) => {
      const res = await apiRequest("PATCH", `/api/services/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      setInlineEditingService(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const startInlineEdit = (service: Service, field: string) => {
    const value = String(service[field as keyof Service] || "");
    setInlineEditingService({ id: service.id, field, value });
  };

  const handleInlineChange = (value: string) => {
    if (inlineEditingService) {
      setInlineEditingService({ ...inlineEditingService, value });
    }
  };

  const saveInlineEdit = () => {
    if (!inlineEditingService) return;
    const { id, field, value } = inlineEditingService;
    inlineUpdateMutation.mutate({ id, data: { [field]: value } });
  };

  const cancelInlineEdit = () => {
    setInlineEditingService(null);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editItem) return;
    updateMutation.mutate({ 
      id: editItem.id, 
      data: { 
        name: editItem.name, 
        categoryId: editItem.categoryId || undefined,
        brandId: editItem.brandId || undefined,
        description: editItem.description || undefined, 
        warranty: editItem.warranty || undefined,
        repairTime: editItem.repairTime || undefined,
        laborPrice: editItem.laborPrice,
        partsMarkup: editItem.partsMarkup,
        secondaryPartPercentage: editItem.secondaryPartPercentage ?? 100,
        notes: editItem.notes || undefined,
        labourOnly: editItem.labourOnly,
        bypassMultiDiscount: editItem.bypassMultiDiscount,
        bypassRounding: editItem.bypassRounding,
        imageUrl: editItem.imageUrl || undefined
      } 
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 space-y-0 pb-4">
        <div>
          <CardTitle>Services</CardTitle>
          <CardDescription>Manage repair service types with pricing</CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="self-end sm:self-auto" data-testid="button-add-service"><Plus className="h-4 w-4 mr-1" />Add Service</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>Add Service</DialogTitle>
                <DialogDescription>Create a new repair service with pricing</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Original OEM" required data-testid="input-service-name" />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={categoryId || ""} onValueChange={(v) => setCategoryId(v || null)}>
                    <SelectTrigger data-testid="select-service-category">
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Brand (optional)</Label>
                  <Select value={brandId || "_none"} onValueChange={(v) => setBrandId(v === "_none" ? null : v)}>
                    <SelectTrigger data-testid="select-service-brand">
                      <SelectValue placeholder="Select a brand" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">No brand</SelectItem>
                      {brands.map(brand => (
                        <SelectItem key={brand.id} value={brand.id}>{brand.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Description (optional)</Label>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description" data-testid="input-service-description" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Labor Price ($)</Label>
                    <Input type="number" step="0.01" min="0" value={laborPrice} onChange={(e) => setLaborPrice(e.target.value)} placeholder="0.00" required data-testid="input-service-labor-price" />
                  </div>
                  <div className="space-y-2">
                    <Label>Parts Markup (multiplier)</Label>
                    <Input type="number" step="0.01" min="1" value={partsMarkup} onChange={(e) => setPartsMarkup(e.target.value)} placeholder="1.0" required data-testid="input-service-parts-markup" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Secondary Part % (for additional parts)</Label>
                  <Input type="number" step="1" min="0" max="100" value={secondaryPartPercentage} onChange={(e) => setSecondaryPartPercentage(e.target.value)} placeholder="50" data-testid="input-service-secondary-part-percentage" />
                  <p className="text-xs text-muted-foreground">When a repair needs multiple parts, secondary parts are charged at this % of their cost (e.g., 50% means a $10 secondary part adds $5)</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Warranty (optional)</Label>
                    <Input value={warranty} onChange={(e) => setWarranty(e.target.value)} placeholder="e.g., 90 days" data-testid="input-service-warranty" />
                  </div>
                  <div className="space-y-2">
                    <Label>Repair Time (optional)</Label>
                    <Input value={repairTime} onChange={(e) => setRepairTime(e.target.value)} placeholder="e.g., 1-2 hours" data-testid="input-service-repair-time" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Notes (optional)</Label>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Internal notes about this service" data-testid="input-service-notes" />
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="labour-only" checked={labourOnly} onCheckedChange={(checked) => setLabourOnly(checked === true)} data-testid="checkbox-labour-only" />
                  <Label htmlFor="labour-only" className="text-sm font-normal cursor-pointer">Labour only (no parts required - will show price even without parts)</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="bypass-discount" checked={bypassMultiDiscount} onCheckedChange={(checked) => setBypassMultiDiscount(checked === true)} data-testid="checkbox-bypass-discount" />
                  <Label htmlFor="bypass-discount" className="text-sm font-normal cursor-pointer">Bypass multi-service discount (this service won't trigger discount)</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="bypass-rounding" checked={bypassRounding} onCheckedChange={(checked) => setBypassRounding(checked === true)} data-testid="checkbox-bypass-rounding" />
                  <Label htmlFor="bypass-rounding" className="text-sm font-normal cursor-pointer">Bypass price rounding (show exact calculated price)</Label>
                </div>
                <ImageInput
                  value={imageUrl}
                  onChange={setImageUrl}
                  label="Image (optional)"
                  placeholder="Enter image URL"
                  testIdPrefix="service-image"
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={createMutation.isPending} data-testid="button-save-service">
                  {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleEditSubmit}>
              <DialogHeader>
                <DialogTitle>Edit Service</DialogTitle>
                <DialogDescription>Update repair service details</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={editItem?.name || ""} onChange={(e) => setEditItem(prev => prev ? {...prev, name: e.target.value} : null)} required data-testid="input-edit-service-name" />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={editItem?.categoryId || ""} onValueChange={(v) => setEditItem(prev => prev ? {...prev, categoryId: v || null} : null)}>
                    <SelectTrigger data-testid="select-edit-service-category">
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Brand (optional)</Label>
                  <Select value={editItem?.brandId || "_none"} onValueChange={(v) => setEditItem(prev => prev ? {...prev, brandId: v === "_none" ? null : v} : null)}>
                    <SelectTrigger data-testid="select-edit-service-brand">
                      <SelectValue placeholder="Select a brand" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">No brand</SelectItem>
                      {brands.map(brand => (
                        <SelectItem key={brand.id} value={brand.id}>{brand.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Description (optional)</Label>
                  <Textarea value={editItem?.description || ""} onChange={(e) => setEditItem(prev => prev ? {...prev, description: e.target.value} : null)} data-testid="input-edit-service-description" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Labor Price ($)</Label>
                    <Input type="number" step="0.01" min="0" value={editItem?.laborPrice || ""} onChange={(e) => setEditItem(prev => prev ? {...prev, laborPrice: e.target.value} : null)} required data-testid="input-edit-service-labor-price" />
                  </div>
                  <div className="space-y-2">
                    <Label>Parts Markup (multiplier)</Label>
                    <Input type="number" step="0.01" min="1" value={editItem?.partsMarkup || ""} onChange={(e) => setEditItem(prev => prev ? {...prev, partsMarkup: e.target.value} : null)} required data-testid="input-edit-service-parts-markup" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Secondary Part % (for additional parts)</Label>
                  <Input type="number" step="1" min="0" max="100" value={editItem?.secondaryPartPercentage ?? 100} onChange={(e) => setEditItem(prev => prev ? {...prev, secondaryPartPercentage: e.target.value === "" ? 50 : parseInt(e.target.value)} : null)} data-testid="input-edit-service-secondary-part-percentage" />
                  <p className="text-xs text-muted-foreground">When a repair needs multiple parts, secondary parts are charged at this % of their cost</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Warranty (optional)</Label>
                    <Input value={editItem?.warranty || ""} onChange={(e) => setEditItem(prev => prev ? {...prev, warranty: e.target.value} : null)} data-testid="input-edit-service-warranty" />
                  </div>
                  <div className="space-y-2">
                    <Label>Repair Time (optional)</Label>
                    <Input value={editItem?.repairTime || ""} onChange={(e) => setEditItem(prev => prev ? {...prev, repairTime: e.target.value} : null)} data-testid="input-edit-service-repair-time" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Notes (optional)</Label>
                  <Textarea value={editItem?.notes || ""} onChange={(e) => setEditItem(prev => prev ? {...prev, notes: e.target.value} : null)} data-testid="input-edit-service-notes" />
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="edit-labour-only" checked={editItem?.labourOnly || false} onCheckedChange={(checked) => setEditItem(prev => prev ? {...prev, labourOnly: checked === true} : null)} data-testid="checkbox-edit-labour-only" />
                  <Label htmlFor="edit-labour-only" className="text-sm font-normal cursor-pointer">Labour only (no parts required - will show price even without parts)</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="edit-bypass-discount" checked={editItem?.bypassMultiDiscount || false} onCheckedChange={(checked) => setEditItem(prev => prev ? {...prev, bypassMultiDiscount: checked === true} : null)} data-testid="checkbox-edit-bypass-discount" />
                  <Label htmlFor="edit-bypass-discount" className="text-sm font-normal cursor-pointer">Bypass multi-service discount (this service won't trigger discount)</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="edit-bypass-rounding" checked={editItem?.bypassRounding || false} onCheckedChange={(checked) => setEditItem(prev => prev ? {...prev, bypassRounding: checked === true} : null)} data-testid="checkbox-edit-bypass-rounding" />
                  <Label htmlFor="edit-bypass-rounding" className="text-sm font-normal cursor-pointer">Bypass price rounding (show exact calculated price)</Label>
                </div>
                <ImageInput
                  value={editItem?.imageUrl || ""}
                  onChange={(url) => setEditItem(prev => prev ? {...prev, imageUrl: url} : null)}
                  label="Image (optional)"
                  placeholder="Enter image URL"
                  testIdPrefix="edit-service-image"
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={updateMutation.isPending} data-testid="button-update-service">
                  {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        <div className="flex flex-wrap gap-2 sm:gap-4">
          <Select value={filterCategoryId} onValueChange={setFilterCategoryId}>
            <SelectTrigger className="w-[calc(50%-0.25rem)] sm:w-[180px]" data-testid="select-filter-category">
              <SelectValue placeholder="Filter by category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="none">No Category</SelectItem>
              {categories.map((cat) => (<SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>))}
            </SelectContent>
          </Select>
          <Select value={filterBrandId} onValueChange={setFilterBrandId}>
            <SelectTrigger className="w-[calc(50%-0.25rem)] sm:w-[180px]" data-testid="select-filter-brand">
              <SelectValue placeholder="Filter by brand" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Brands</SelectItem>
              <SelectItem value="none">No Brand</SelectItem>
              {brands.map((brand) => (<SelectItem key={brand.id} value={brand.id}>{brand.name}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : filteredServices.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">{services.length === 0 ? "No services yet. Add your first one!" : "No services match your filter."}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Image</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Brand</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Labor</TableHead>
                <TableHead>Markup</TableHead>
                <TableHead>Warranty</TableHead>
                <TableHead>Repair Time</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="w-[120px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredServices.map((service) => (
                <TableRow key={service.id}>
                  <TableCell>
                    {service.imageUrl ? (
                      <img src={service.imageUrl} alt={service.name} className="h-10 w-10 object-contain rounded" />
                    ) : (
                      <div className="h-10 w-10 bg-muted rounded flex items-center justify-center text-muted-foreground text-xs">-</div>
                    )}
                  </TableCell>
                  <TableCell><Badge variant="secondary">{getCategoryName(service.categoryId)}</Badge></TableCell>
                  <TableCell><Badge variant="outline">{getBrandName(service.brandId)}</Badge></TableCell>
                  <TableCell className="font-medium">{service.name}</TableCell>
                  <TableCell>
                    {inlineEditingService?.id === service.id && inlineEditingService?.field === "laborPrice" ? (
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={inlineEditingService.value}
                        onChange={(e) => handleInlineChange(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveInlineEdit();
                          else if (e.key === "Escape") cancelInlineEdit();
                        }}
                        onBlur={saveInlineEdit}
                        className="h-8 w-20"
                        autoFocus
                        data-testid={`input-inline-labor-${service.id}`}
                      />
                    ) : (
                      <div
                        className="cursor-pointer hover:bg-muted/50 px-2 py-1 rounded min-w-[60px]"
                        onClick={() => startInlineEdit(service, "laborPrice")}
                        data-testid={`cell-labor-${service.id}`}
                      >
                        ${service.laborPrice}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {inlineEditingService?.id === service.id && inlineEditingService?.field === "partsMarkup" ? (
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={inlineEditingService.value}
                        onChange={(e) => handleInlineChange(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveInlineEdit();
                          else if (e.key === "Escape") cancelInlineEdit();
                        }}
                        onBlur={saveInlineEdit}
                        className="h-8 w-16"
                        autoFocus
                        data-testid={`input-inline-markup-${service.id}`}
                      />
                    ) : (
                      <div
                        className="cursor-pointer hover:bg-muted/50 px-2 py-1 rounded min-w-[40px]"
                        onClick={() => startInlineEdit(service, "partsMarkup")}
                        data-testid={`cell-markup-${service.id}`}
                      >
                        {service.partsMarkup}x
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {inlineEditingService?.id === service.id && inlineEditingService?.field === "warranty" ? (
                      <Input
                        value={inlineEditingService.value}
                        onChange={(e) => handleInlineChange(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveInlineEdit();
                          else if (e.key === "Escape") cancelInlineEdit();
                        }}
                        onBlur={saveInlineEdit}
                        className="h-8 w-24"
                        placeholder="e.g. 90 days"
                        autoFocus
                        data-testid={`input-inline-warranty-${service.id}`}
                      />
                    ) : (
                      <div
                        className="cursor-pointer hover:bg-muted/50 px-2 py-1 rounded min-w-[60px]"
                        onClick={() => startInlineEdit(service, "warranty")}
                        data-testid={`cell-warranty-${service.id}`}
                      >
                        {service.warranty || <span className="text-muted-foreground italic">Click to add</span>}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {inlineEditingService?.id === service.id && inlineEditingService?.field === "repairTime" ? (
                      <Input
                        value={inlineEditingService.value}
                        onChange={(e) => handleInlineChange(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveInlineEdit();
                          else if (e.key === "Escape") cancelInlineEdit();
                        }}
                        onBlur={saveInlineEdit}
                        className="h-8 w-24"
                        placeholder="e.g. 1-2 hours"
                        autoFocus
                        data-testid={`input-inline-repairtime-${service.id}`}
                      />
                    ) : (
                      <div
                        className="cursor-pointer hover:bg-muted/50 px-2 py-1 rounded min-w-[60px]"
                        onClick={() => startInlineEdit(service, "repairTime")}
                        data-testid={`cell-repairtime-${service.id}`}
                      >
                        {service.repairTime || <span className="text-muted-foreground italic">Click to add</span>}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {service.labourOnly ? (
                      <Badge variant="outline" data-testid={`badge-labour-only-${service.id}`}>Labour Only</Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">Parts Required</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(service)} data-testid={`button-edit-service-${service.id}`}><Pencil className="h-4 w-4" /></Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" disabled={deleteMutation.isPending} data-testid={`button-delete-service-${service.id}`}><Trash2 className="h-4 w-4" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>This will permanently delete this service. This action cannot be undone.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteMutation.mutate(service.id)} data-testid={`confirm-delete-service-${service.id}`}>Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

