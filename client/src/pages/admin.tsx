import { useState } from "react";
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
import { Plus, Trash2, Loader2, Wrench, ArrowLeft, Pencil } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/theme-toggle";
import type { DeviceType, Device, Part, Service, DeviceServiceWithRelations } from "@shared/schema";

export default function Admin() {
  const { toast } = useToast();

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

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="device-types" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
            <TabsTrigger value="device-types" data-testid="tab-device-types">Types</TabsTrigger>
            <TabsTrigger value="devices" data-testid="tab-devices">Devices</TabsTrigger>
            <TabsTrigger value="services" data-testid="tab-services">Services</TabsTrigger>
            <TabsTrigger value="parts" data-testid="tab-parts">Parts</TabsTrigger>
            <TabsTrigger value="links" data-testid="tab-links">Links</TabsTrigger>
          </TabsList>

          <TabsContent value="device-types">
            <DeviceTypesTab toast={toast} />
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

function DevicesTab({ toast }: { toast: ReturnType<typeof useToast>["toast"] }) {
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState<Device | null>(null);
  const [name, setName] = useState("");
  const [deviceTypeId, setDeviceTypeId] = useState("");

  const { data: devices = [], isLoading } = useQuery<Device[]>({ queryKey: ["/api/devices"] });
  const { data: deviceTypes = [] } = useQuery<DeviceType[]>({ queryKey: ["/api/device-types"] });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; deviceTypeId: string }) => {
      const res = await apiRequest("POST", "/api/devices", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/devices"] });
      setOpen(false);
      setName("");
      setDeviceTypeId("");
      toast({ title: "Device created" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name?: string; deviceTypeId?: string } }) => {
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
    createMutation.mutate({ name, deviceTypeId });
  };

  const handleEdit = (device: Device) => {
    setEditItem(device);
    setEditOpen(true);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editItem) return;
    updateMutation.mutate({ id: editItem.id, data: { name: editItem.name, deviceTypeId: editItem.deviceTypeId } });
  };

  const getTypeName = (typeId: string) => deviceTypes.find((t) => t.id === typeId)?.name || "Unknown";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-4">
        <div>
          <CardTitle>Devices</CardTitle>
          <CardDescription>Manage specific device models</CardDescription>
        </div>
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
              </div>
              <DialogFooter>
                <Button type="submit" disabled={createMutation.isPending || !deviceTypeId} data-testid="button-save-device">
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
              </div>
              <DialogFooter>
                <Button type="submit" disabled={updateMutation.isPending} data-testid="button-update-device">
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
        ) : devices.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">No devices yet. Add your first one!</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="w-[120px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {devices.map((device) => (
                <TableRow key={device.id}>
                  <TableCell className="font-medium">{device.name}</TableCell>
                  <TableCell><Badge variant="secondary">{getTypeName(device.deviceTypeId)}</Badge></TableCell>
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
  const [basePrice, setBasePrice] = useState("");

  const { data: services = [], isLoading } = useQuery<Service[]>({ queryKey: ["/api/services"] });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string; basePrice: string }) => {
      const res = await apiRequest("POST", "/api/services", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      setOpen(false);
      setName("");
      setDescription("");
      setBasePrice("");
      toast({ title: "Service created" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name?: string; description?: string; basePrice?: string } }) => {
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
    createMutation.mutate({ name, description: description || undefined, basePrice });
  };

  const handleEdit = (service: Service) => {
    setEditItem(service);
    setEditOpen(true);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editItem) return;
    updateMutation.mutate({ id: editItem.id, data: { name: editItem.name, description: editItem.description || undefined, basePrice: editItem.basePrice } });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-4">
        <div>
          <CardTitle>Services</CardTitle>
          <CardDescription>Manage repair service types</CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-service"><Plus className="h-4 w-4 mr-2" />Add Service</Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>Add Service</DialogTitle>
                <DialogDescription>Create a new repair service</DialogDescription>
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
                <div className="space-y-2">
                  <Label>Base Price ($)</Label>
                  <Input type="number" step="0.01" min="0" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} placeholder="0.00" required data-testid="input-service-price" />
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
          <DialogContent>
            <form onSubmit={handleEditSubmit}>
              <DialogHeader>
                <DialogTitle>Edit Service</DialogTitle>
                <DialogDescription>Update repair service</DialogDescription>
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
                <div className="space-y-2">
                  <Label>Base Price ($)</Label>
                  <Input type="number" step="0.01" min="0" value={editItem?.basePrice || ""} onChange={(e) => setEditItem(prev => prev ? {...prev, basePrice: e.target.value} : null)} required data-testid="input-edit-service-price" />
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
                <TableHead>Description</TableHead>
                <TableHead>Base Price</TableHead>
                <TableHead className="w-[120px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {services.map((service) => (
                <TableRow key={service.id}>
                  <TableCell className="font-medium">{service.name}</TableCell>
                  <TableCell className="text-muted-foreground">{service.description || "-"}</TableCell>
                  <TableCell>${service.basePrice}</TableCell>
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

  const { data: parts = [], isLoading } = useQuery<Part[]>({ queryKey: ["/api/parts"] });

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
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-4">
        <div>
          <CardTitle>Parts</CardTitle>
          <CardDescription>Manage parts inventory with SKU and pricing</CardDescription>
        </div>
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
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : parts.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">No parts yet. Add your first one!</p>
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
              {parts.map((part) => (
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
  const [laborPrice, setLaborPrice] = useState("");
  const [partSku, setPartSku] = useState("");
  const [partId, setPartId] = useState<string | undefined>();

  const { data: deviceServices = [], isLoading } = useQuery<DeviceServiceWithRelations[]>({ queryKey: ["/api/device-services"] });
  const { data: devices = [] } = useQuery<Device[]>({ queryKey: ["/api/devices"] });
  const { data: services = [] } = useQuery<Service[]>({ queryKey: ["/api/services"] });
  const { data: parts = [] } = useQuery<Part[]>({ queryKey: ["/api/parts"] });

  const createMutation = useMutation({
    mutationFn: async (data: { deviceId: string; serviceId: string; laborPrice: string; partSku?: string; partId?: string }) => {
      const res = await apiRequest("POST", "/api/device-services", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/device-services"] });
      setOpen(false);
      setDeviceId("");
      setServiceId("");
      setLaborPrice("");
      setPartSku("");
      setPartId(undefined);
      toast({ title: "Device-service link created" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { deviceId?: string; serviceId?: string; laborPrice?: string; partSku?: string; partId?: string } }) => {
      const res = await apiRequest("PATCH", `/api/device-services/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/device-services"] });
      setEditOpen(false);
      setEditItem(null);
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      deviceId,
      serviceId,
      laborPrice,
      partSku: partSku || undefined,
      partId: partId === "none" ? undefined : partId,
    });
  };

  const handleEdit = (ds: DeviceServiceWithRelations) => {
    setEditItem(ds);
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
        laborPrice: editItem.laborPrice,
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
          <CardDescription>Link services to devices with pricing and optional parts</CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-link"><Plus className="h-4 w-4 mr-2" />Add Link</Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>Add Device-Service Link</DialogTitle>
                <DialogDescription>Connect a service to a device with custom pricing</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Device</Label>
                  <Select value={deviceId} onValueChange={setDeviceId} required>
                    <SelectTrigger data-testid="select-link-device"><SelectValue placeholder="Select device" /></SelectTrigger>
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
                      {services.map((service) => (<SelectItem key={service.id} value={service.id}>{service.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Labor Price ($)</Label>
                  <Input type="number" step="0.01" min="0" value={laborPrice} onChange={(e) => setLaborPrice(e.target.value)} placeholder="0.00" required data-testid="input-labor-price" />
                </div>
                <div className="space-y-2">
                  <Label>Part SKU (optional - enter SKU to auto-lookup)</Label>
                  <Input value={partSku} onChange={(e) => { setPartSku(e.target.value); setPartId(undefined); }} placeholder="e.g., SCR-IP15-BLK" data-testid="input-part-sku-link" />
                  {partSku && skuPart && (
                    <p className="text-sm text-green-600">Found: {skuPart.name} (${skuPart.price})</p>
                  )}
                  {partSku && !skuPart && (
                    <p className="text-sm text-destructive">SKU not found</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Or Select Part from List</Label>
                  <Select value={partId} onValueChange={(v) => { setPartId(v); setPartSku(""); }}>
                    <SelectTrigger data-testid="select-link-part"><SelectValue placeholder="No part required" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No part required</SelectItem>
                      {parts.map((part) => (<SelectItem key={part.id} value={part.id}>{part.sku} - {part.name} (${part.price})</SelectItem>))}
                    </SelectContent>
                  </Select>
                  {selectedPart && <p className="text-sm text-muted-foreground">Part price ${selectedPart.price} will be added to quote</p>}
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
                  <Label>Device</Label>
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
                      {services.map((service) => (<SelectItem key={service.id} value={service.id}>{service.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Labor Price ($)</Label>
                  <Input type="number" step="0.01" min="0" value={editItem?.laborPrice || ""} onChange={(e) => setEditItem(prev => prev ? {...prev, laborPrice: e.target.value} : null)} required data-testid="input-edit-labor-price" />
                </div>
                <div className="space-y-2">
                  <Label>Part</Label>
                  <Select value={editItem?.partId || "none"} onValueChange={(v) => setEditItem(prev => prev ? {...prev, partId: v === "none" ? null : v} : null)}>
                    <SelectTrigger><SelectValue placeholder="No part required" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No part required</SelectItem>
                      {parts.map((part) => (<SelectItem key={part.id} value={part.id}>{part.sku} - {part.name} (${part.price})</SelectItem>))}
                    </SelectContent>
                  </Select>
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
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : deviceServices.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">No links yet. Create one to offer services!</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Device</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Labor</TableHead>
                <TableHead>Part</TableHead>
                <TableHead>Total</TableHead>
                <TableHead className="w-[120px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deviceServices.map((ds) => {
                const partPrice = ds.part ? parseFloat(ds.part.price) : 0;
                const laborPriceNum = parseFloat(ds.laborPrice);
                const total = (partPrice + laborPriceNum).toFixed(2);
                return (
                  <TableRow key={ds.id}>
                    <TableCell className="font-medium">{ds.device?.name || "Unknown"}</TableCell>
                    <TableCell>{ds.service?.name || "Unknown"}</TableCell>
                    <TableCell>${ds.laborPrice}</TableCell>
                    <TableCell>
                      {ds.part ? (<Badge variant="outline">{ds.part.sku} (${ds.part.price})</Badge>) : (<span className="text-muted-foreground">-</span>)}
                    </TableCell>
                    <TableCell className="font-semibold text-primary">${total}</TableCell>
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
        )}
      </CardContent>
    </Card>
  );
}
