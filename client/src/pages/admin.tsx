import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Loader2, Wrench, ArrowLeft, Pencil, Search, Upload, LogOut, Lock, Check, X, Filter } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/theme-toggle";
import { ImageInput } from "@/components/ImageInput";
import type { DeviceType, Device, Part, Service, DeviceServiceWithRelations, Brand, BrandDeviceType, MessageTemplate } from "@shared/schema";

export default function Admin() {
  const { toast } = useToast();
  const [password, setPassword] = useState("");

  const { data: authStatus, isLoading: authLoading } = useQuery<{ isAdmin: boolean }>({
    queryKey: ["/api/admin/me"],
  });

  const loginMutation = useMutation({
    mutationFn: async (password: string) => {
      const res = await apiRequest("POST", "/api/admin/login", { password });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Login failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/me"] });
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
    loginMutation.mutate(password);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!authStatus?.isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <a href="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground" data-testid="link-home">
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Back to Quote</span>
              </a>
              <div className="flex items-center gap-2">
                <Wrench className="h-6 w-6 text-primary" />
                <span className="text-xl font-semibold">Admin Panel</span>
              </div>
            </div>
            <ThemeToggle />
          </div>
        </header>

        <main className="container mx-auto px-4 py-8 flex items-center justify-center">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <Lock className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Admin Login</CardTitle>
              <CardDescription>Enter your admin password to continue</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter admin password"
                    required
                    data-testid="input-admin-password"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loginMutation.isPending} data-testid="button-admin-login">
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
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <a href="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground" data-testid="link-home">
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Back to Quote</span>
            </a>
            <div className="flex items-center gap-2">
              <Wrench className="h-6 w-6 text-primary" />
              <span className="text-xl font-semibold">Admin Panel</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
              title="Logout"
              data-testid="button-admin-logout"
            >
              <LogOut className="h-4 w-4" />
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="device-types" className="space-y-6">
          <TabsList className="flex flex-wrap gap-1 h-auto">
            <TabsTrigger value="device-types" data-testid="tab-device-types">Types</TabsTrigger>
            <TabsTrigger value="brands" data-testid="tab-brands">Brands</TabsTrigger>
            <TabsTrigger value="brand-links" data-testid="tab-brand-links">Brand Links</TabsTrigger>
            <TabsTrigger value="devices" data-testid="tab-devices">Devices</TabsTrigger>
            <TabsTrigger value="services" data-testid="tab-services">Services</TabsTrigger>
            <TabsTrigger value="parts" data-testid="tab-parts">Parts</TabsTrigger>
            <TabsTrigger value="links" data-testid="tab-links">Service Links</TabsTrigger>
            <TabsTrigger value="settings" data-testid="tab-settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="device-types">
            <DeviceTypesTab toast={toast} />
          </TabsContent>

          <TabsContent value="brands">
            <BrandsTab toast={toast} />
          </TabsContent>

          <TabsContent value="brand-links">
            <BrandDeviceTypeLinksTab toast={toast} />
          </TabsContent>

          <TabsContent value="devices">
            <DevicesTab toast={toast} />
          </TabsContent>

          <TabsContent value="services">
            <ServicesTab toast={toast} />
          </TabsContent>

          <TabsContent value="parts">
            <PartsTab toast={toast} />
          </TabsContent>

          <TabsContent value="links">
            <DeviceServicesTab toast={toast} />
          </TabsContent>

          <TabsContent value="settings">
            <SettingsTab toast={toast} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function DeviceTypesTab({ toast }: { toast: ReturnType<typeof useToast>["toast"] }) {
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState<DeviceType | null>(null);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("smartphone");

  const { data: deviceTypes = [], isLoading } = useQuery<DeviceType[]>({
    queryKey: ["/api/device-types"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; icon: string }) => {
      const res = await apiRequest("POST", "/api/device-types", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/device-types"] });
      setOpen(false);
      setName("");
      setIcon("smartphone");
      toast({ title: "Device type created" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name?: string; icon?: string } }) => {
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({ name, icon });
  };

  const handleEdit = (type: DeviceType) => {
    setEditItem(type);
    setEditOpen(true);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editItem) return;
    updateMutation.mutate({ id: editItem.id, data: { name: editItem.name, icon: editItem.icon } });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-4">
        <div>
          <CardTitle>Device Types</CardTitle>
          <CardDescription>Manage categories like Smartphone, Tablet, Laptop</CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-device-type">
              <Plus className="h-4 w-4 mr-2" />
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
                    </SelectContent>
                  </Select>
                </div>
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
                    </SelectContent>
                  </Select>
                </div>
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Icon</TableHead>
                <TableHead className="w-[120px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deviceTypes.map((type) => (
                <TableRow key={type.id}>
                  <TableCell className="font-medium">{type.name}</TableCell>
                  <TableCell><Badge variant="secondary">{type.icon}</Badge></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(type)} data-testid={`button-edit-type-${type.id}`}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(type.id)} disabled={deleteMutation.isPending} data-testid={`button-delete-type-${type.id}`}><Trash2 className="h-4 w-4" /></Button>
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

function BrandsTab({ toast }: { toast: ReturnType<typeof useToast>["toast"] }) {
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState<Brand | null>(null);
  const [name, setName] = useState("");
  const [logo, setLogo] = useState("");

  const { data: brands = [], isLoading } = useQuery<Brand[]>({ queryKey: ["/api/brands"] });

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
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-4">
        <div>
          <CardTitle>Brands</CardTitle>
          <CardDescription>Manage device brands like Apple, Samsung, Dell</CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-brand"><Plus className="h-4 w-4 mr-2" />Add Brand</Button>
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">Logo</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="w-[120px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {brands.map((brand) => (
                <TableRow key={brand.id}>
                  <TableCell>
                    {brand.logo ? (
                      <img src={brand.logo} alt={brand.name} className="h-8 w-8 object-contain rounded" />
                    ) : (
                      <div className="h-8 w-8 bg-muted rounded flex items-center justify-center text-xs text-muted-foreground">-</div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{brand.name}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(brand)} data-testid={`button-edit-brand-${brand.id}`}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(brand.id)} disabled={deleteMutation.isPending} data-testid={`button-delete-brand-${brand.id}`}><Trash2 className="h-4 w-4" /></Button>
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

function BrandDeviceTypeLinksTab({ toast }: { toast: ReturnType<typeof useToast>["toast"] }) {
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
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-4">
        <div>
          <CardTitle>Brand-Type Links</CardTitle>
          <CardDescription>Link brands to device types (e.g., Apple makes Smartphones and Laptops)</CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-brand-link"><Plus className="h-4 w-4 mr-2" />Add Link</Button>
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
                    <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(link.id)} disabled={deleteMutation.isPending} data-testid={`button-delete-brand-link-${link.id}`}><Trash2 className="h-4 w-4" /></Button>
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

function DevicesTab({ toast }: { toast: ReturnType<typeof useToast>["toast"] }) {
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [editItem, setEditItem] = useState<Device | null>(null);
  const [name, setName] = useState("");
  const [deviceTypeId, setDeviceTypeId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [filterTypeId, setFilterTypeId] = useState("all");
  const [filterBrandId, setFilterBrandId] = useState("all");
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkResults, setBulkResults] = useState<{ created: number; errors: string[] } | null>(null);

  const { data: devices = [], isLoading } = useQuery<Device[]>({ queryKey: ["/api/devices"] });
  const { data: deviceTypes = [] } = useQuery<DeviceType[]>({ queryKey: ["/api/device-types"] });
  const { data: brands = [] } = useQuery<Brand[]>({ queryKey: ["/api/brands"] });

  const filteredDevices = devices.filter((device) => {
    if (filterTypeId !== "all" && device.deviceTypeId !== filterTypeId) return false;
    if (filterBrandId !== "all") {
      if (filterBrandId === "none" && device.brandId !== null) return false;
      if (filterBrandId !== "none" && device.brandId !== filterBrandId) return false;
    }
    return true;
  });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; deviceTypeId: string; brandId?: string; imageUrl?: string }) => {
      const res = await apiRequest("POST", "/api/devices", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/devices"] });
      setOpen(false);
      setName("");
      setDeviceTypeId("");
      setBrandId("");
      setImageUrl("");
      toast({ title: "Device created" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name?: string; deviceTypeId?: string; brandId?: string | null; imageUrl?: string | null } }) => {
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({ 
      name, 
      deviceTypeId, 
      brandId: brandId && brandId !== "none" ? brandId : undefined,
      imageUrl: imageUrl || undefined 
    });
  };

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
        imageUrl: editItem.imageUrl 
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
      const rows = XLSX.utils.sheet_to_json<{ Brand?: string; Type?: string; "Model Name"?: string; "Image URL"?: string }>(sheet);

      const devices = rows.map((row) => ({
        brand: row.Brand || row["Brand"] || "",
        type: row.Type || row["Type"] || "",
        modelName: row["Model Name"] || "",
        imageUrl: row["Image URL"] || "",
      }));

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

  const downloadTemplate = () => {
    window.open("/api/devices/template", "_blank");
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
                  label="Device Image"
                  placeholder="Enter image URL"
                  testIdPrefix="device-image"
                />
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
                  label="Device Image"
                  placeholder="Enter image URL"
                  testIdPrefix="edit-device-image"
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={updateMutation.isPending} data-testid="button-update-device">
                  {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        <div className="flex flex-wrap gap-4">
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
                <TableHead className="w-[120px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDevices.map((device) => (
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
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(device)} data-testid={`button-edit-device-${device.id}`}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(device.id)} disabled={deleteMutation.isPending} data-testid={`button-delete-device-${device.id}`}><Trash2 className="h-4 w-4" /></Button>
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

function ServicesTab({ toast }: { toast: ReturnType<typeof useToast>["toast"] }) {
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState<Service | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [warranty, setWarranty] = useState("");
  const [repairTime, setRepairTime] = useState("");
  const [laborPrice, setLaborPrice] = useState("");
  const [partsMarkup, setPartsMarkup] = useState("1.0");
  const [notes, setNotes] = useState("");

  const { data: services = [], isLoading } = useQuery<Service[]>({ queryKey: ["/api/services"] });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string; warranty?: string; repairTime?: string; laborPrice: string; partsMarkup: string; notes?: string }) => {
      const res = await apiRequest("POST", "/api/services", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      setOpen(false);
      setName("");
      setDescription("");
      setWarranty("");
      setRepairTime("");
      setLaborPrice("");
      setPartsMarkup("1.0");
      setNotes("");
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
      description: description || undefined, 
      warranty: warranty || undefined,
      repairTime: repairTime || undefined,
      laborPrice, 
      partsMarkup,
      notes: notes || undefined
    });
  };

  const handleEdit = (service: Service) => {
    setEditItem(service);
    setEditOpen(true);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editItem) return;
    updateMutation.mutate({ 
      id: editItem.id, 
      data: { 
        name: editItem.name, 
        description: editItem.description || undefined, 
        warranty: editItem.warranty || undefined,
        repairTime: editItem.repairTime || undefined,
        laborPrice: editItem.laborPrice,
        partsMarkup: editItem.partsMarkup,
        notes: editItem.notes || undefined
      } 
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-4">
        <div>
          <CardTitle>Services</CardTitle>
          <CardDescription>Manage repair service types with pricing</CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-service"><Plus className="h-4 w-4 mr-2" />Add Service</Button>
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
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Screen Replacement" required data-testid="input-service-name" />
                </div>
                <div className="space-y-2">
                  <Label>Description (optional)</Label>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description" data-testid="input-service-description" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Labor Price ($)</Label>
                    <Input type="number" step="0.01" min="0" value={laborPrice} onChange={(e) => setLaborPrice(e.target.value)} placeholder="0.00" required data-testid="input-service-labor-price" />
                  </div>
                  <div className="space-y-2">
                    <Label>Parts Markup (multiplier)</Label>
                    <Input type="number" step="0.01" min="1" value={partsMarkup} onChange={(e) => setPartsMarkup(e.target.value)} placeholder="1.0" required data-testid="input-service-parts-markup" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
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
                  <Label>Description (optional)</Label>
                  <Textarea value={editItem?.description || ""} onChange={(e) => setEditItem(prev => prev ? {...prev, description: e.target.value} : null)} data-testid="input-edit-service-description" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Labor Price ($)</Label>
                    <Input type="number" step="0.01" min="0" value={editItem?.laborPrice || ""} onChange={(e) => setEditItem(prev => prev ? {...prev, laborPrice: e.target.value} : null)} required data-testid="input-edit-service-labor-price" />
                  </div>
                  <div className="space-y-2">
                    <Label>Parts Markup (multiplier)</Label>
                    <Input type="number" step="0.01" min="1" value={editItem?.partsMarkup || ""} onChange={(e) => setEditItem(prev => prev ? {...prev, partsMarkup: e.target.value} : null)} required data-testid="input-edit-service-parts-markup" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
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
              </div>
              <DialogFooter>
                <Button type="submit" disabled={updateMutation.isPending} data-testid="button-update-service">
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
        ) : services.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">No services yet. Add your first one!</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Labor</TableHead>
                <TableHead>Markup</TableHead>
                <TableHead>Warranty</TableHead>
                <TableHead>Repair Time</TableHead>
                <TableHead className="w-[120px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {services.map((service) => (
                <TableRow key={service.id}>
                  <TableCell className="font-medium">{service.name}</TableCell>
                  <TableCell>${service.laborPrice}</TableCell>
                  <TableCell>{service.partsMarkup}x</TableCell>
                  <TableCell>{service.warranty || "-"}</TableCell>
                  <TableCell>{service.repairTime || "-"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(service)} data-testid={`button-edit-service-${service.id}`}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(service.id)} disabled={deleteMutation.isPending} data-testid={`button-delete-service-${service.id}`}><Trash2 className="h-4 w-4" /></Button>
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

function PartsTab({ toast }: { toast: ReturnType<typeof useToast>["toast"] }) {
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState<Part | null>(null);
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [uploading, setUploading] = useState(false);

  const { data: parts = [], isLoading } = useQuery<Part[]>({ queryKey: ["/api/parts"] });

  const filteredParts = useMemo(() => 
    parts.filter(part => 
      part.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      part.name.toLowerCase().includes(searchQuery.toLowerCase())
    ), [parts, searchQuery]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      toast({ title: "Error", description: "Please upload an Excel file (.xlsx or .xls)", variant: "destructive" });
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/parts/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ["/api/parts"] });
        toast({ 
          title: "Upload successful", 
          description: `${data.inserted} new parts added, ${data.updated} parts updated` 
        });
      } else {
        toast({ title: "Upload failed", description: data.error, variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Upload failed", description: error.message || "Failed to upload file", variant: "destructive" });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const createMutation = useMutation({
    mutationFn: async (data: { sku: string; name: string; price: string }) => {
      const res = await apiRequest("POST", "/api/parts", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/parts"] });
      setOpen(false);
      setSku("");
      setName("");
      setPrice("");
      toast({ title: "Part created" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { sku?: string; name?: string; price?: string } }) => {
      const res = await apiRequest("PATCH", `/api/parts/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/parts"] });
      setEditOpen(false);
      setEditItem(null);
      toast({ title: "Part updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/parts/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/parts"] });
      toast({ title: "Part deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({ sku, name, price });
  };

  const handleEdit = (part: Part) => {
    setEditItem(part);
    setEditOpen(true);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editItem) return;
    updateMutation.mutate({ id: editItem.id, data: { sku: editItem.sku, name: editItem.name, price: editItem.price } });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap space-y-0 pb-4">
        <div>
          <CardTitle>Parts</CardTitle>
          <CardDescription>Manage parts inventory with SKU and pricing</CardDescription>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search SKU or name..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-[200px]"
              data-testid="input-search-parts"
            />
          </div>
          <label htmlFor="file-upload">
            <Button variant="outline" asChild disabled={uploading}>
              <span className="cursor-pointer">
                {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                Upload Excel
              </span>
            </Button>
          </label>
          <input 
            id="file-upload" 
            type="file" 
            accept=".xlsx,.xls" 
            onChange={handleFileUpload}
            className="hidden"
            data-testid="input-upload-parts"
          />
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-part"><Plus className="h-4 w-4 mr-2" />Add Part</Button>
            </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>Add Part</DialogTitle>
                <DialogDescription>Add a new part to inventory</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>SKU</Label>
                  <Input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="e.g., SCR-IP15-BLK" required data-testid="input-part-sku" />
                </div>
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., iPhone 15 Screen" required data-testid="input-part-name" />
                </div>
                <div className="space-y-2">
                  <Label>Price ($)</Label>
                  <Input type="number" step="0.01" min="0" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" required data-testid="input-part-price" />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={createMutation.isPending} data-testid="button-save-part">
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
                <DialogTitle>Edit Part</DialogTitle>
                <DialogDescription>Update part details</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>SKU</Label>
                  <Input value={editItem?.sku || ""} onChange={(e) => setEditItem(prev => prev ? {...prev, sku: e.target.value} : null)} required data-testid="input-edit-part-sku" />
                </div>
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={editItem?.name || ""} onChange={(e) => setEditItem(prev => prev ? {...prev, name: e.target.value} : null)} required data-testid="input-edit-part-name" />
                </div>
                <div className="space-y-2">
                  <Label>Price ($)</Label>
                  <Input type="number" step="0.01" min="0" value={editItem?.price || ""} onChange={(e) => setEditItem(prev => prev ? {...prev, price: e.target.value} : null)} required data-testid="input-edit-part-price" />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={updateMutation.isPending} data-testid="button-update-part">
                  {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : filteredParts.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">{searchQuery ? "No parts match your search" : "No parts yet. Add your first one!"}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Price</TableHead>
                <TableHead className="w-[120px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredParts.map((part) => (
                <TableRow key={part.id}>
                  <TableCell><Badge variant="outline">{part.sku}</Badge></TableCell>
                  <TableCell className="font-medium">{part.name}</TableCell>
                  <TableCell>${part.price}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(part)} data-testid={`button-edit-part-${part.id}`}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(part.id)} disabled={deleteMutation.isPending} data-testid={`button-delete-part-${part.id}`}><Trash2 className="h-4 w-4" /></Button>
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

function DeviceServicesTab({ toast }: { toast: ReturnType<typeof useToast>["toast"] }) {
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState<DeviceServiceWithRelations | null>(null);
  const [deviceId, setDeviceId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [partSku, setPartSku] = useState("");
  const [partSearch, setPartSearch] = useState("");
  const [partId, setPartId] = useState<string | undefined>();
  const [editPartSku, setEditPartSku] = useState("");
  const [editPartSearch, setEditPartSearch] = useState("");

  const [filterBrand, setFilterBrand] = useState<string>("all");
  const [filterDevice, setFilterDevice] = useState<string>("all");
  const [filterService, setFilterService] = useState<string>("all");

  const [inlineEditId, setInlineEditId] = useState<string | null>(null);
  const [inlineEditSku, setInlineEditSku] = useState("");

  const { data: deviceServices = [], isLoading } = useQuery<DeviceServiceWithRelations[]>({ queryKey: ["/api/device-services"] });
  const { data: devices = [] } = useQuery<Device[]>({ queryKey: ["/api/devices"] });
  const { data: services = [] } = useQuery<Service[]>({ queryKey: ["/api/services"] });
  const { data: parts = [] } = useQuery<Part[]>({ queryKey: ["/api/parts"] });
  const { data: brands = [] } = useQuery<Brand[]>({ queryKey: ["/api/brands"] });

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
    return deviceServices.filter(ds => {
      if (filterBrand !== "all" && ds.device?.brand?.name !== filterBrand) return false;
      if (filterDevice !== "all" && ds.device?.name !== filterDevice) return false;
      if (filterService !== "all" && ds.service?.name !== filterService) return false;
      return true;
    });
  }, [deviceServices, filterBrand, filterDevice, filterService]);

  const filteredParts = useMemo(() => 
    parts.filter(p => 
      p.sku.toLowerCase().includes(partSearch.toLowerCase()) ||
      p.name.toLowerCase().includes(partSearch.toLowerCase())
    ), [parts, partSearch]);

  const editFilteredParts = useMemo(() => 
    parts.filter(p => 
      p.sku.toLowerCase().includes(editPartSearch.toLowerCase()) ||
      p.name.toLowerCase().includes(editPartSearch.toLowerCase())
    ), [parts, editPartSearch]);

  const editSkuPart = useMemo(() => 
    parts.find(p => p.sku.toLowerCase() === editPartSku.toLowerCase()), 
    [parts, editPartSku]);

  const inlineSkuPart = useMemo(() => 
    parts.find(p => p.sku.toLowerCase() === inlineEditSku.toLowerCase()), 
    [parts, inlineEditSku]);

  const createMutation = useMutation({
    mutationFn: async (data: { deviceId: string; serviceId: string; partSku?: string; partId?: string }) => {
      const res = await apiRequest("POST", "/api/device-services", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/device-services"] });
      setOpen(false);
      setDeviceId("");
      setServiceId("");
      setPartSku("");
      setPartSearch("");
      setPartId(undefined);
      toast({ title: "Device-service link created" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { deviceId?: string; serviceId?: string; partSku?: string; partId?: string } }) => {
      const res = await apiRequest("PATCH", `/api/device-services/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/device-services"] });
      setEditOpen(false);
      setEditItem(null);
      setEditPartSku("");
      setEditPartSearch("");
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

  const handleInlineEdit = (ds: DeviceServiceWithRelations) => {
    setInlineEditId(ds.id);
    setInlineEditSku(ds.part?.sku || "");
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
    });
  };

  const handleEdit = (ds: DeviceServiceWithRelations) => {
    setEditItem(ds);
    setEditPartSku(ds.part?.sku || "");
    setEditPartSearch("");
    setEditOpen(true);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editItem) return;
    updateMutation.mutate({
      id: editItem.id,
      data: {
        deviceId: editItem.deviceId,
        serviceId: editItem.serviceId,
        partSku: editPartSku || undefined,
        partId: editItem.partId || undefined,
      },
    });
  };

  const selectedPart = parts.find((p) => p.id === partId);
  const skuPart = parts.find((p) => p.sku === partSku);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-4">
        <div>
          <CardTitle>Device-Service Links</CardTitle>
          <CardDescription>Link devices to services with optional parts. Labor and markup come from the Service.</CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-link"><Plus className="h-4 w-4 mr-2" />Add Link</Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>Add Device-Service Link</DialogTitle>
                <DialogDescription>Select model, service, and optionally a part</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Model (Device)</Label>
                  <Select value={deviceId} onValueChange={setDeviceId} required>
                    <SelectTrigger data-testid="select-link-device"><SelectValue placeholder="Select device model" /></SelectTrigger>
                    <SelectContent>
                      {devices.map((device) => (<SelectItem key={device.id} value={device.id}>{device.name}</SelectItem>))}
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
                    <p className="text-sm text-green-600">Found: {skuPart.name} (${skuPart.price})</p>
                  )}
                  {partSku && !skuPart && partSku.length > 0 && (
                    <p className="text-sm text-destructive">SKU not found</p>
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
                        {filteredParts.slice(0, 50).map((part) => (<SelectItem key={part.id} value={part.id}>{part.sku} - {part.name} (${part.price})</SelectItem>))}
                        {filteredParts.length > 50 && <p className="px-2 py-1 text-sm text-muted-foreground">Showing first 50 results...</p>}
                      </SelectContent>
                    </Select>
                  )}
                  {partSearch.length === 0 && !partSku && (
                    <p className="text-sm text-muted-foreground">Enter SKU above or type to search by name</p>
                  )}
                  {selectedPart && <p className="text-sm text-muted-foreground">Part cost ${selectedPart.price} will be marked up per service settings</p>}
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

        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent>
            <form onSubmit={handleEditSubmit}>
              <DialogHeader>
                <DialogTitle>Edit Device-Service Link</DialogTitle>
                <DialogDescription>Update link details</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Model (Device)</Label>
                  <Select value={editItem?.deviceId || ""} onValueChange={(v) => setEditItem(prev => prev ? {...prev, deviceId: v} : null)}>
                    <SelectTrigger><SelectValue placeholder="Select device" /></SelectTrigger>
                    <SelectContent>
                      {devices.map((device) => (<SelectItem key={device.id} value={device.id}>{device.name}</SelectItem>))}
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
                    <p className="text-sm text-green-600">Found: {editSkuPart.name} (${editSkuPart.price})</p>
                  )}
                  {editPartSku && !editSkuPart && editPartSku.length > 0 && (
                    <p className="text-sm text-destructive">SKU not found</p>
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
                        {editFilteredParts.slice(0, 50).map((part) => (<SelectItem key={part.id} value={part.id}>{part.sku} - {part.name} (${part.price})</SelectItem>))}
                        {editFilteredParts.length > 50 && <p className="px-2 py-1 text-sm text-muted-foreground">Showing first 50 results...</p>}
                      </SelectContent>
                    </Select>
                  )}
                  {editPartSearch.length === 0 && !editPartSku && (
                    <p className="text-sm text-muted-foreground">Enter SKU above or type to search by name</p>
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
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-3 mb-4 items-end">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Filters:</span>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Brand</Label>
            <Select value={filterBrand} onValueChange={setFilterBrand}>
              <SelectTrigger className="w-[140px]" data-testid="filter-brand">
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
          <div className="space-y-1">
            <Label className="text-xs">Device</Label>
            <Select value={filterDevice} onValueChange={setFilterDevice}>
              <SelectTrigger className="w-[160px]" data-testid="filter-device">
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
          <div className="space-y-1">
            <Label className="text-xs">Service</Label>
            <Select value={filterService} onValueChange={setFilterService}>
              <SelectTrigger className="w-[180px]" data-testid="filter-service">
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
          {(filterBrand !== "all" || filterDevice !== "all" || filterService !== "all") && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => { setFilterBrand("all"); setFilterDevice("all"); setFilterService("all"); }}
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
                            className="cursor-pointer hover:bg-muted/50 px-2 py-1 rounded min-w-[80px] min-h-[28px] flex items-center"
                            onClick={() => handleInlineEdit(ds)}
                            data-testid={`cell-sku-${ds.id}`}
                          >
                            {ds.part ? (
                              <Badge variant="outline" className="font-mono">{ds.part.sku}</Badge>
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
                          <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(ds.id)} disabled={deleteMutation.isPending} data-testid={`button-delete-link-${ds.id}`}><Trash2 className="h-4 w-4" /></Button>
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
  );
}

function SettingsTab({ toast }: { toast: ReturnType<typeof useToast>["toast"] }) {
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [smsTemplate, setSmsTemplate] = useState("");

  const { data: templates = [], isLoading } = useQuery<MessageTemplate[]>({
    queryKey: ["/api/message-templates"],
  });

  const defaults = {
    email_subject: "Your Repair Quote: {serviceName} - ${price} plus taxes",
    email_body: `Dear {customerName},

Thank you for requesting a repair quote from RepairQuote!

Here are your quote details:

Device: {deviceName}
Service: {serviceName}
Estimated Price: $\{price} plus taxes
{repairTime}
{warranty}

To proceed with this repair, please reply to this email or visit our store.

Thank you for choosing RepairQuote!

Best regards,
The RepairQuote Team`,
    sms: "Hi {customerName}! Your RepairQuote: {serviceName} for {deviceName} - ${price} plus taxes. {repairTime}. {warranty}. Reply for questions!"
  };

  useEffect(() => {
    const emailSubjectTemplate = templates.find(t => t.type === "email_subject");
    const emailBodyTemplate = templates.find(t => t.type === "email_body");
    const smsTemplateData = templates.find(t => t.type === "sms");
    
    setEmailSubject(emailSubjectTemplate?.content || defaults.email_subject);
    setEmailBody(emailBodyTemplate?.content || defaults.email_body);
    setSmsTemplate(smsTemplateData?.content || defaults.sms);
  }, [templates]);

  const saveMutation = useMutation({
    mutationFn: async (data: { type: string; content: string }) => {
      const res = await apiRequest("PUT", "/api/message-templates", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/message-templates"] });
      toast({ title: "Template saved" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleSaveEmailSubject = () => saveMutation.mutate({ type: "email_subject", content: emailSubject });
  const handleSaveEmailBody = () => saveMutation.mutate({ type: "email_body", content: emailBody });
  const handleSaveSms = () => saveMutation.mutate({ type: "sms", content: smsTemplate });

  const macros = [
    { name: "{customerName}", description: "Customer's name" },
    { name: "{deviceName}", description: "Device name (e.g., iPhone 15 Pro)" },
    { name: "{serviceName}", description: "Service name (e.g., Screen Replacement)" },
    { name: "{price}", description: "Quoted price (number only, add $ manually)" },
    { name: "{repairTime}", description: "Estimated repair time" },
    { name: "{warranty}", description: "Warranty information" },
  ];

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Available Macros</CardTitle>
          <CardDescription>Use these placeholders in your message templates</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {macros.map((macro) => (
              <Badge key={macro.name} variant="secondary" className="text-sm" data-testid={`macro-${macro.name}`}>
                {macro.name} - {macro.description}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Email Subject Template</CardTitle>
          <CardDescription>Subject line for quote emails</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input 
            value={emailSubject} 
            onChange={(e) => setEmailSubject(e.target.value)} 
            placeholder="Enter email subject..."
            data-testid="input-email-subject"
          />
          <Button onClick={handleSaveEmailSubject} disabled={saveMutation.isPending} data-testid="button-save-email-subject">
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Save Subject
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Email Body Template</CardTitle>
          <CardDescription>Main content of quote emails</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea 
            value={emailBody} 
            onChange={(e) => setEmailBody(e.target.value)} 
            placeholder="Enter email body..."
            className="min-h-[250px] font-mono text-sm"
            data-testid="textarea-email-body"
          />
          <Button onClick={handleSaveEmailBody} disabled={saveMutation.isPending} data-testid="button-save-email-body">
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Save Body
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>SMS Template</CardTitle>
          <CardDescription>Text message content for quotes (keep it concise)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea 
            value={smsTemplate} 
            onChange={(e) => setSmsTemplate(e.target.value)} 
            placeholder="Enter SMS template..."
            className="min-h-[100px]"
            data-testid="textarea-sms"
          />
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm text-muted-foreground">{smsTemplate.length} characters (160 recommended max)</p>
            <Button onClick={handleSaveSms} disabled={saveMutation.isPending} data-testid="button-save-sms">
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save SMS
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
