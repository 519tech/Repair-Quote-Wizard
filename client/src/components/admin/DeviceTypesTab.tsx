import { useState } from "react";
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
import { Plus, Trash2, Loader2, Pencil, ArrowUp, ArrowDown, Settings, X } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ImageInput } from "@/components/ImageInput";
import type { DeviceType, Brand, BrandDeviceType } from "@shared/schema";

export function DeviceTypesTab({ toast }: { toast: ReturnType<typeof useToast>["toast"] }) {
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState<DeviceType | null>(null);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("smartphone");
  const [imageUrl, setImageUrl] = useState("");

  const { data: deviceTypes = [], isLoading } = useQuery<DeviceType[]>({
    queryKey: ["/api/device-types"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; icon: string; imageUrl?: string }) => {
      const res = await apiRequest("POST", "/api/device-types", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/device-types"] });
      setOpen(false);
      setName("");
      setIcon("smartphone");
      setImageUrl("");
      toast({ title: "Device type created" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name?: string; icon?: string; imageUrl?: string | null } }) => {
      const res = await apiRequest("PATCH", `/api/device-types/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/device-types"] });
      setEditOpen(false);
      setEditItem(null);
      toast({ title: "Device type updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/device-types/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/device-types"] });
      toast({ title: "Device type deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      await apiRequest("POST", "/api/device-types/reorder", { orderedIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/device-types"] });
      toast({ title: "Device types reordered" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleTypeMoveUp = (index: number) => {
    if (index === 0) return;
    const newOrder = [...deviceTypes];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    reorderMutation.mutate(newOrder.map(t => t.id));
  };

  const handleTypeMoveDown = (index: number) => {
    if (index === deviceTypes.length - 1) return;
    const newOrder = [...deviceTypes];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    reorderMutation.mutate(newOrder.map(t => t.id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({ name, icon, imageUrl: imageUrl || undefined });
  };

  const handleEdit = (type: DeviceType) => {
    setEditItem(type);
    setEditOpen(true);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editItem) return;
    updateMutation.mutate({ id: editItem.id, data: { name: editItem.name, icon: editItem.icon, imageUrl: (editItem as any).imageUrl } });
  };

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 space-y-0 pb-4">
        <div>
          <CardTitle>Device Types</CardTitle>
          <CardDescription>Manage categories like Smartphone, Tablet, Laptop</CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="self-end sm:self-auto" data-testid="button-add-device-type">
              <Plus className="h-4 w-4 mr-1" />
              Add Type
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>Add Device Type</DialogTitle>
                <DialogDescription>Create a new device category</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="type-name">Name</Label>
                  <Input id="type-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Smartphone" required data-testid="input-type-name" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type-icon">Icon</Label>
                  <Select value={icon} onValueChange={setIcon}>
                    <SelectTrigger data-testid="select-type-icon"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="smartphone">Smartphone</SelectItem>
                      <SelectItem value="tablet">Tablet</SelectItem>
                      <SelectItem value="laptop">Laptop</SelectItem>
                      <SelectItem value="desktop">Desktop</SelectItem>
                      <SelectItem value="gaming">Gaming Console</SelectItem>
                      <SelectItem value="watch">Smart Watch</SelectItem>
                      <SelectItem value="headphones">Headphones</SelectItem>
                      <SelectItem value="camera">Camera</SelectItem>
                      <SelectItem value="tv">TV / Display</SelectItem>
                      <SelectItem value="speaker">Speaker</SelectItem>
                      <SelectItem value="printer">Printer</SelectItem>
                      <SelectItem value="keyboard">Keyboard</SelectItem>
                      <SelectItem value="mouse">Mouse</SelectItem>
                      <SelectItem value="router">Router / Network</SelectItem>
                      <SelectItem value="harddrive">Hard Drive / Storage</SelectItem>
                      <SelectItem value="memory">Memory / RAM</SelectItem>
                      <SelectItem value="cpu">Processor / CPU</SelectItem>
                      <SelectItem value="battery">Battery</SelectItem>
                      <SelectItem value="cable">Cable / Charger</SelectItem>
                      <SelectItem value="tool">Tool / Accessory</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <ImageInput
                  value={imageUrl}
                  onChange={setImageUrl}
                  onError={(msg) => toast({ title: "Upload Error", description: msg, variant: "destructive" })}
                  label="Image"
                  placeholder="Enter image URL"
                  testIdPrefix="type-image"
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={createMutation.isPending} data-testid="button-save-type">
                  {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent>
            <form onSubmit={handleEditSubmit}>
              <DialogHeader>
                <DialogTitle>Edit Device Type</DialogTitle>
                <DialogDescription>Update device category</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={editItem?.name || ""} onChange={(e) => setEditItem(prev => prev ? {...prev, name: e.target.value} : null)} required data-testid="input-edit-type-name" />
                </div>
                <div className="space-y-2">
                  <Label>Icon</Label>
                  <Select value={editItem?.icon || "smartphone"} onValueChange={(v) => setEditItem(prev => prev ? {...prev, icon: v} : null)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="smartphone">Smartphone</SelectItem>
                      <SelectItem value="tablet">Tablet</SelectItem>
                      <SelectItem value="laptop">Laptop</SelectItem>
                      <SelectItem value="desktop">Desktop</SelectItem>
                      <SelectItem value="gaming">Gaming Console</SelectItem>
                      <SelectItem value="watch">Smart Watch</SelectItem>
                      <SelectItem value="headphones">Headphones</SelectItem>
                      <SelectItem value="camera">Camera</SelectItem>
                      <SelectItem value="tv">TV / Display</SelectItem>
                      <SelectItem value="speaker">Speaker</SelectItem>
                      <SelectItem value="printer">Printer</SelectItem>
                      <SelectItem value="keyboard">Keyboard</SelectItem>
                      <SelectItem value="mouse">Mouse</SelectItem>
                      <SelectItem value="router">Router / Network</SelectItem>
                      <SelectItem value="harddrive">Hard Drive / Storage</SelectItem>
                      <SelectItem value="memory">Memory / RAM</SelectItem>
                      <SelectItem value="cpu">Processor / CPU</SelectItem>
                      <SelectItem value="battery">Battery</SelectItem>
                      <SelectItem value="cable">Cable / Charger</SelectItem>
                      <SelectItem value="tool">Tool / Accessory</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <ImageInput
                  value={(editItem as any)?.imageUrl || ""}
                  onChange={(url) => setEditItem(prev => prev ? {...prev, imageUrl: url || null} as any : null)}
                  onError={(msg) => toast({ title: "Upload Error", description: msg, variant: "destructive" })}
                  label="Image"
                  placeholder="Enter image URL"
                  testIdPrefix="edit-type-image"
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={updateMutation.isPending} data-testid="button-update-type">
                  {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : deviceTypes.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">No device types yet. Add your first one!</p>
        ) : (
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Order</TableHead>
                <TableHead className="w-[60px]">Image</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Icon</TableHead>
                <TableHead className="w-[120px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deviceTypes.map((type, index) => (
                <TableRow key={type.id}>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleTypeMoveUp(index)} disabled={index === 0 || reorderMutation.isPending} data-testid={`button-move-up-type-${type.id}`}><ArrowUp className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleTypeMoveDown(index)} disabled={index === deviceTypes.length - 1 || reorderMutation.isPending} data-testid={`button-move-down-type-${type.id}`}><ArrowDown className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    {(type as any).imageUrl ? (
                      <img src={(type as any).imageUrl} alt={type.name} className="h-8 w-8 object-contain rounded" />
                    ) : (
                      <div className="h-8 w-8 bg-muted rounded flex items-center justify-center text-xs text-muted-foreground">-</div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{type.name}</TableCell>
                  <TableCell><Badge variant="secondary">{type.icon}</Badge></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(type)} data-testid={`button-edit-type-${type.id}`}><Pencil className="h-4 w-4" /></Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" disabled={deleteMutation.isPending} data-testid={`button-delete-type-${type.id}`}><Trash2 className="h-4 w-4" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>This will permanently delete this device type. This action cannot be undone.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteMutation.mutate(type.id)} data-testid={`confirm-delete-type-${type.id}`}>Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function BrandsTab({ toast }: { toast: ReturnType<typeof useToast>["toast"] }) {
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState<Brand | null>(null);
  const [name, setName] = useState("");
  const [logo, setLogo] = useState("");
  
  // Device type links management
  const [typesOpen, setTypesOpen] = useState(false);
  const [selectedBrandForTypes, setSelectedBrandForTypes] = useState<Brand | null>(null);
  const [selectedTypeId, setSelectedTypeId] = useState("");

  const { data: brands = [], isLoading } = useQuery<Brand[]>({ queryKey: ["/api/brands"] });
  const { data: deviceTypes = [] } = useQuery<DeviceType[]>({ queryKey: ["/api/device-types"] });
  const { data: brandDeviceTypeLinks = [] } = useQuery<BrandDeviceType[]>({ queryKey: ["/api/brand-device-types"] });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; logo?: string }) => {
      const res = await apiRequest("POST", "/api/brands", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/brands"] });
      setOpen(false);
      setName("");
      setLogo("");
      toast({ title: "Brand created" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name?: string; logo?: string | null } }) => {
      const res = await apiRequest("PATCH", `/api/brands/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/brands"] });
      setEditOpen(false);
      setEditItem(null);
      toast({ title: "Brand updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/brands/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/brands"] });
      toast({ title: "Brand deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Device type link mutations
  const addTypeLinkMutation = useMutation({
    mutationFn: async (data: { brandId: string; deviceTypeId: string }) => {
      const res = await apiRequest("POST", "/api/brand-device-types", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/brand-device-types"] });
      setSelectedTypeId("");
      toast({ title: "Device type linked" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const removeTypeLinkMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/brand-device-types/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/brand-device-types"] });
      toast({ title: "Device type unlinked" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const reorderBrandsMutation = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      await apiRequest("POST", "/api/brands/reorder", { orderedIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/brands"] });
      toast({ title: "Brands reordered" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleBrandMoveUp = (index: number) => {
    if (index === 0) return;
    const newOrder = [...brands];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    reorderBrandsMutation.mutate(newOrder.map(b => b.id));
  };

  const handleBrandMoveDown = (index: number) => {
    if (index === brands.length - 1) return;
    const newOrder = [...brands];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    reorderBrandsMutation.mutate(newOrder.map(b => b.id));
  };

  const getLinkedTypes = (brandId: string) => {
    return brandDeviceTypeLinks.filter(link => link.brandId === brandId);
  };

  const getUnlinkedTypes = (brandId: string) => {
    const linkedTypeIds = getLinkedTypes(brandId).map(link => link.deviceTypeId);
    return deviceTypes.filter(type => !linkedTypeIds.includes(type.id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({ name, logo: logo || undefined });
  };

  const handleEdit = (brand: Brand) => {
    setEditItem(brand);
    setEditOpen(true);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editItem) return;
    updateMutation.mutate({ id: editItem.id, data: { name: editItem.name, logo: editItem.logo } });
  };

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 space-y-0 pb-4">
        <div>
          <CardTitle>Brands</CardTitle>
          <CardDescription>Manage device brands like Apple, Samsung, Dell</CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="self-end sm:self-auto" data-testid="button-add-brand"><Plus className="h-4 w-4 mr-1" />Add Brand</Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>Add Brand</DialogTitle>
                <DialogDescription>Create a new device brand</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Apple" required data-testid="input-brand-name" />
                </div>
                <ImageInput
                  value={logo}
                  onChange={setLogo}
                  onError={(msg) => toast({ title: "Upload Error", description: msg, variant: "destructive" })}
                  label="Logo"
                  placeholder="Enter logo URL"
                  testIdPrefix="brand-logo"
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={createMutation.isPending} data-testid="button-save-brand">
                  {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent>
            <form onSubmit={handleEditSubmit}>
              <DialogHeader>
                <DialogTitle>Edit Brand</DialogTitle>
                <DialogDescription>Update brand details</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={editItem?.name || ""} onChange={(e) => setEditItem(prev => prev ? {...prev, name: e.target.value} : null)} required data-testid="input-edit-brand-name" />
                </div>
                <ImageInput
                  value={editItem?.logo || ""}
                  onChange={(url) => setEditItem(prev => prev ? {...prev, logo: url || null} : null)}
                  onError={(msg) => toast({ title: "Upload Error", description: msg, variant: "destructive" })}
                  label="Logo"
                  placeholder="Enter logo URL"
                  testIdPrefix="edit-brand-logo"
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={updateMutation.isPending} data-testid="button-update-brand">
                  {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : brands.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">No brands yet. Add your first one!</p>
        ) : (
          <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Order</TableHead>
                <TableHead className="w-[60px]">Logo</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Device Types</TableHead>
                <TableHead className="w-[120px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {brands.map((brand, index) => {
                const linkedTypes = getLinkedTypes(brand.id);
                return (
                  <TableRow key={brand.id}>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleBrandMoveUp(index)} disabled={index === 0 || reorderBrandsMutation.isPending} data-testid={`button-move-up-brand-${brand.id}`}><ArrowUp className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleBrandMoveDown(index)} disabled={index === brands.length - 1 || reorderBrandsMutation.isPending} data-testid={`button-move-down-brand-${brand.id}`}><ArrowDown className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      {brand.logo ? (
                        <img src={brand.logo} alt={brand.name} className="h-8 w-8 object-contain rounded" />
                      ) : (
                        <div className="h-8 w-8 bg-muted rounded flex items-center justify-center text-xs text-muted-foreground">-</div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{brand.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 flex-wrap">
                        {linkedTypes.length === 0 ? (
                          <span className="text-sm text-muted-foreground">No types linked</span>
                        ) : (
                          linkedTypes.map(link => {
                            const type = deviceTypes.find(t => t.id === link.deviceTypeId);
                            return type ? (
                              <Badge key={link.id} variant="secondary">{type.name}</Badge>
                            ) : null;
                          })
                        )}
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => { setSelectedBrandForTypes(brand); setTypesOpen(true); }}
                          data-testid={`button-manage-types-${brand.id}`}
                        >
                          <Settings className="h-3 w-3 mr-1" />
                          Manage
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(brand)} data-testid={`button-edit-brand-${brand.id}`}><Pencil className="h-4 w-4" /></Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" disabled={deleteMutation.isPending} data-testid={`button-delete-brand-${brand.id}`}><Trash2 className="h-4 w-4" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                              <AlertDialogDescription>This will permanently delete this brand. This action cannot be undone.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteMutation.mutate(brand.id)} data-testid={`confirm-delete-brand-${brand.id}`}>Delete</AlertDialogAction>
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

          {/* Manage Device Types Dialog */}
          <Dialog open={typesOpen} onOpenChange={(open) => { setTypesOpen(open); if (!open) setSelectedBrandForTypes(null); }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Manage Device Types for {selectedBrandForTypes?.name}</DialogTitle>
                <DialogDescription>Select which device types this brand makes</DialogDescription>
              </DialogHeader>
              {selectedBrandForTypes && (
                <div className="space-y-4">
                  {/* Currently linked types */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Linked Device Types</Label>
                    {getLinkedTypes(selectedBrandForTypes.id).length === 0 ? (
                      <p className="text-sm text-muted-foreground">No device types linked yet</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {getLinkedTypes(selectedBrandForTypes.id).map(link => {
                          const type = deviceTypes.find(t => t.id === link.deviceTypeId);
                          return type ? (
                            <Badge key={link.id} variant="secondary" className="flex items-center gap-1">
                              {type.name}
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-4 w-4 ml-1" 
                                    disabled={removeTypeLinkMutation.isPending}
                                    data-testid={`button-remove-type-${link.id}`}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                    <AlertDialogDescription>This will remove this device type from the brand. This action cannot be undone.</AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => removeTypeLinkMutation.mutate(link.id)} data-testid={`confirm-remove-type-${link.id}`}>Remove</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </Badge>
                          ) : null;
                        })}
                      </div>
                    )}
                  </div>

                  {/* Add new type */}
                  {getUnlinkedTypes(selectedBrandForTypes.id).length > 0 && (
                    <div className="space-y-2 border-t pt-4">
                      <Label className="text-sm font-medium">Add Device Type</Label>
                      <div className="flex gap-2">
                        <Select value={selectedTypeId} onValueChange={setSelectedTypeId}>
                          <SelectTrigger className="flex-1" data-testid="select-add-device-type">
                            <SelectValue placeholder="Select type to add..." />
                          </SelectTrigger>
                          <SelectContent>
                            {getUnlinkedTypes(selectedBrandForTypes.id).map(type => (
                              <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button 
                          onClick={() => addTypeLinkMutation.mutate({ brandId: selectedBrandForTypes.id, deviceTypeId: selectedTypeId })}
                          disabled={!selectedTypeId || addTypeLinkMutation.isPending}
                          data-testid="button-add-type-link"
                        >
                          {addTypeLinkMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </DialogContent>
          </Dialog>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function BrandDeviceTypeLinksTab({ toast }: { toast: ReturnType<typeof useToast>["toast"] }) {
  const [open, setOpen] = useState(false);
  const [brandId, setBrandId] = useState("");
  const [deviceTypeId, setDeviceTypeId] = useState("");

  const { data: links = [], isLoading } = useQuery<BrandDeviceType[]>({ queryKey: ["/api/brand-device-types"] });
  const { data: brands = [] } = useQuery<Brand[]>({ queryKey: ["/api/brands"] });
  const { data: deviceTypes = [] } = useQuery<DeviceType[]>({ queryKey: ["/api/device-types"] });

  const createMutation = useMutation({
    mutationFn: async (data: { brandId: string; deviceTypeId: string }) => {
      const res = await apiRequest("POST", "/api/brand-device-types", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/brand-device-types"] });
      setOpen(false);
      setBrandId("");
      setDeviceTypeId("");
      toast({ title: "Brand-Type link created" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/brand-device-types/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/brand-device-types"] });
      toast({ title: "Brand-Type link deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({ brandId, deviceTypeId });
  };

  const getBrandName = (id: string) => brands.find((b) => b.id === id)?.name || "Unknown";
  const getTypeName = (id: string) => deviceTypes.find((t) => t.id === id)?.name || "Unknown";

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 space-y-0 pb-4">
        <div>
          <CardTitle>Brand-Type Links</CardTitle>
          <CardDescription>Link brands to device types (e.g., Apple makes Smartphones and Laptops)</CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="self-end sm:self-auto" data-testid="button-add-brand-link"><Plus className="h-4 w-4 mr-1" />Add Link</Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>Add Brand-Type Link</DialogTitle>
                <DialogDescription>Link a brand to a device type</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Brand</Label>
                  <Select value={brandId} onValueChange={setBrandId} required>
                    <SelectTrigger data-testid="select-brand"><SelectValue placeholder="Select brand" /></SelectTrigger>
                    <SelectContent>
                      {brands.map((brand) => (<SelectItem key={brand.id} value={brand.id}>{brand.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Device Type</Label>
                  <Select value={deviceTypeId} onValueChange={setDeviceTypeId} required>
                    <SelectTrigger data-testid="select-type-for-brand"><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent>
                      {deviceTypes.map((type) => (<SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={createMutation.isPending || !brandId || !deviceTypeId} data-testid="button-save-brand-link">
                  {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : links.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">No brand-type links yet. Create one to enable brand selection!</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Brand</TableHead>
                <TableHead>Device Type</TableHead>
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {links.map((link) => (
                <TableRow key={link.id}>
                  <TableCell className="font-medium">{getBrandName(link.brandId)}</TableCell>
                  <TableCell><Badge variant="secondary">{getTypeName(link.deviceTypeId)}</Badge></TableCell>
                  <TableCell>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" disabled={deleteMutation.isPending} data-testid={`button-delete-brand-link-${link.id}`}><Trash2 className="h-4 w-4" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                          <AlertDialogDescription>This will permanently delete this brand-type link. This action cannot be undone.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteMutation.mutate(link.id)} data-testid={`confirm-delete-brand-link-${link.id}`}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
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
