import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, Trash2, Loader2, Wrench, ArrowLeft, Pencil, Search, Upload, LogOut, Lock, Check, X, Filter, Link2, Layers, ChevronLeft, ChevronRight, AlertTriangle, Settings, Mail, MessageSquare, Users, FileText, Phone, Clock, EyeOff, DollarSign, ArrowUp, ArrowDown, ExternalLink, Database, RefreshCw, AlertCircle } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/theme-toggle";
import { ImageInput } from "@/components/ImageInput";
import type { DeviceType, Device, Part, Service, ServiceCategory, DeviceServiceWithRelations, Brand, BrandDeviceType, MessageTemplate } from "@shared/schema";

type Submission = {
  id: string;
  type: 'quote' | 'unknown';
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  deviceName?: string;
  serviceName?: string;
  quotedPrice?: string;
  deviceDescription?: string;
  issueDescription?: string;
  notes?: string | null;
  createdAt: string;
};

function SubmissionsTab() {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data: submissions = [], isLoading } = useQuery<Submission[]>({
    queryKey: ["/api/submissions/search", debouncedQuery],
    queryFn: async () => {
      const url = debouncedQuery 
        ? `/api/submissions/search?q=${encodeURIComponent(debouncedQuery)}`
        : `/api/submissions/search`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch submissions');
      return res.json();
    },
  });

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Past Submissions
        </CardTitle>
        <CardDescription>View and search past quote submissions by name, email, or phone number</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-submissions-search"
          />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : submissions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {searchQuery ? "No submissions found matching your search." : "No submissions yet."}
          </div>
        ) : (
          <div className="border rounded-lg divide-y max-h-96 overflow-y-auto">
            {submissions.map((submission) => (
              <div key={submission.id} className="p-3 hover-elevate">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{submission.customerName}</span>
                      <Badge variant={submission.type === 'quote' ? 'default' : 'secondary'} className="text-xs">
                        {submission.type === 'quote' ? 'Quote' : 'Unknown Device'}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground space-y-0.5">
                      <div className="flex items-center gap-2">
                        <Mail className="h-3 w-3" />
                        <span>{submission.customerEmail}</span>
                      </div>
                      {submission.customerPhone && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-3 w-3" />
                          <span>{submission.customerPhone}</span>
                        </div>
                      )}
                    </div>
                    {submission.type === 'quote' ? (
                      <div className="mt-2 text-sm">
                        <span className="text-muted-foreground">Device:</span> {submission.deviceName}
                        <span className="mx-2">·</span>
                        <span className="text-muted-foreground">Service:</span> {submission.serviceName}
                        <span className="mx-2">·</span>
                        <span className="font-medium text-primary">${submission.quotedPrice}</span>
                      </div>
                    ) : (
                      <div className="mt-2 text-sm">
                        <div><span className="text-muted-foreground">Device:</span> {submission.deviceDescription}</div>
                        <div><span className="text-muted-foreground">Issue:</span> {submission.issueDescription}</div>
                      </div>
                    )}
                    {submission.notes && (
                      <div className="mt-1 text-xs text-muted-foreground italic">
                        Notes: {submission.notes}
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDate(submission.createdAt)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {submissions.length > 0 && (
          <p className="text-sm text-muted-foreground text-center">
            Showing {submissions.length} submission{submissions.length !== 1 ? 's' : ''}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function Admin() {
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const { data: authStatus, isLoading: authLoading } = useQuery<{ isAdmin: boolean; username: string | null }>({
    queryKey: ["/api/admin/me"],
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: { username: string; password: string }) => {
      const res = await apiRequest("POST", "/api/admin/login", credentials);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Login failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/me"] });
      setUsername("");
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
    loginMutation.mutate({ username, password });
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
              <CardDescription>Enter your credentials to access the admin panel</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter username"
                    required
                    data-testid="input-admin-username"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
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
        <div className="container mx-auto px-4 py-3 sm:py-4 flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <a href="/" className="flex items-center gap-1 sm:gap-2 text-muted-foreground hover:text-foreground shrink-0" data-testid="link-home">
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Back to Quote</span>
            </a>
            <div className="flex items-center gap-2 min-w-0">
              <Wrench className="h-5 w-5 sm:h-6 sm:w-6 text-primary shrink-0" />
              <span className="text-lg sm:text-xl font-semibold truncate">Admin</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {authStatus?.username && (
              <span className="text-sm text-muted-foreground hidden sm:inline">
                {authStatus.username}
              </span>
            )}
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

      <main className="container mx-auto px-2 sm:px-4 py-4 sm:py-8">
        <Tabs defaultValue="device-types" className="space-y-4 sm:space-y-6">
          <TabsList className="grid grid-cols-4 sm:flex sm:flex-wrap gap-1 h-auto w-full sm:w-auto">
            <TabsTrigger value="device-types" className="text-xs sm:text-sm px-2 sm:px-3" data-testid="tab-device-types">Types</TabsTrigger>
            <TabsTrigger value="devices" className="text-xs sm:text-sm px-2 sm:px-3" data-testid="tab-devices">Devices</TabsTrigger>
            <TabsTrigger value="categories" className="text-xs sm:text-sm px-2 sm:px-3" data-testid="tab-categories">Categories</TabsTrigger>
            <TabsTrigger value="services" className="text-xs sm:text-sm px-2 sm:px-3" data-testid="tab-services">Services</TabsTrigger>
            <TabsTrigger value="parts" className="text-xs sm:text-sm px-2 sm:px-3" data-testid="tab-parts">Parts</TabsTrigger>
            <TabsTrigger value="links" className="text-xs sm:text-sm px-2 sm:px-3" data-testid="tab-links">Links</TabsTrigger>
            <TabsTrigger value="submissions" className="text-xs sm:text-sm px-2 sm:px-3" data-testid="tab-submissions">History</TabsTrigger>
            <TabsTrigger value="settings" className="text-xs sm:text-sm px-2 sm:px-3" data-testid="tab-settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="device-types">
            <DeviceTypesTab toast={toast} />
          </TabsContent>
          
          <TabsContent value="devices">
            <DevicesTab toast={toast} />
          </TabsContent>

          <TabsContent value="categories">
            <ServiceCategoriesTab toast={toast} />
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

          <TabsContent value="submissions">
            <SubmissionsTab />
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
          <div className="overflow-x-auto">
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
          </div>
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
                <TableHead className="w-[60px]">Logo</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Device Types</TableHead>
                <TableHead className="w-[120px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {brands.map((brand) => {
                const linkedTypes = getLinkedTypes(brand.id);
                return (
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
                        <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(brand.id)} disabled={deleteMutation.isPending} data-testid={`button-delete-brand-${brand.id}`}><Trash2 className="h-4 w-4" /></Button>
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
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-4 w-4 ml-1" 
                                onClick={() => removeTypeLinkMutation.mutate(link.id)}
                                disabled={removeTypeLinkMutation.isPending}
                                data-testid={`button-remove-type-${link.id}`}
                              >
                                <X className="h-3 w-3" />
                              </Button>
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
  const [cloneFromDeviceId, setCloneFromDeviceId] = useState("");
  const [cloneDeviceSearch, setCloneDeviceSearch] = useState("");
  const [filterTypeId, setFilterTypeId] = useState("all");
  const [filterBrandId, setFilterBrandId] = useState("all");
  const [deviceSearch, setDeviceSearch] = useState("");
  const [bulkImporting, setBulkImporting] = useState(false);
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
    mutationFn: async (data: { name: string; deviceTypeId: string; brandId?: string; imageUrl?: string; cloneFromDeviceId?: string }) => {
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
    mutationFn: async ({ id, data }: { id: string; data: { serviceId?: string; partSku?: string; partId?: string; alternativePartSkus?: string[]; additionalFee?: number } }) => {
      const res = await apiRequest("PATCH", `/api/device-services/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/device-services"] });
      setEditLinkOpen(false);
      setEditLinkItem(null);
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
      cloneFromDeviceId: cloneFromDeviceId || undefined
    });
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
                      <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(device.id)} disabled={deleteMutation.isPending} data-testid={`button-delete-device-${device.id}`}><Trash2 className="h-4 w-4" /></Button>
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
                          {link.part || service?.labourOnly ? `$${totalPrice}` : <span className="text-muted-foreground">Not Available</span>}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleEditLink(link)} data-testid={`button-edit-link-${link.id}`}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => deleteLinkMutation.mutate(link.id)} disabled={deleteLinkMutation.isPending} data-testid={`button-delete-link-${link.id}`}><Trash2 className="h-4 w-4" /></Button>
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
      <Dialog open={editLinkOpen} onOpenChange={(open) => { setEditLinkOpen(open); if (!open) { setAdditionalPartSku(""); setLinkAlternativePartSkus([]); setLinkAlternativePartInfo({}); setLinkAltPartSearch(""); setLinkAdditionalFee(""); } }}>
        <DialogContent className="max-w-lg">
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
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6"
                          onClick={() => removeAdditionalPartMutation.mutate(ap.id)}
                          disabled={removeAdditionalPartMutation.isPending}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
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

type BrandServiceCategoryWithRelations = {
  id: string;
  brandId: string;
  categoryId: string;
  brand: Brand;
  category: ServiceCategory;
};

function ServiceCategoriesTab({ toast }: { toast: ReturnType<typeof useToast>["toast"] }) {
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
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-4">
        <div>
          <CardTitle>Service Categories</CardTitle>
          <CardDescription>Group services by category (e.g., Battery Replacement, Screen Replacement)</CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-category"><Plus className="h-4 w-4 mr-2" />Add Category</Button>
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
                        <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(category.id)} disabled={deleteMutation.isPending} data-testid={`button-delete-category-${category.id}`}><Trash2 className="h-4 w-4" /></Button>
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

function ServicesTab({ toast }: { toast: ReturnType<typeof useToast>["toast"] }) {
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
        <div className="flex flex-wrap gap-4">
          <Select value={filterCategoryId} onValueChange={setFilterCategoryId}>
            <SelectTrigger className="w-[180px]" data-testid="select-filter-category">
              <SelectValue placeholder="Filter by category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="none">No Category</SelectItem>
              {categories.map((cat) => (<SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>))}
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
  const [activeSubTab, setActiveSubTab] = useState<"supplier" | "custom">("supplier");
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState<Part | null>(null);
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [uploading, setUploading] = useState(false);
  const PARTS_PER_PAGE = 100;

  // Custom parts state
  const [customOpen, setCustomOpen] = useState(false);
  const [customSku, setCustomSku] = useState("");
  const [customName, setCustomName] = useState("");
  const [customPrice, setCustomPrice] = useState("");
  const [customSearchQuery, setCustomSearchQuery] = useState("");
  const [customDebouncedSearch, setCustomDebouncedSearch] = useState("");
  const [customPage, setCustomPage] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setCustomDebouncedSearch(customSearchQuery);
      setCustomPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [customSearchQuery]);

  // Supplier parts query (from Excel upload)
  const supplierPartsQueryUrl = useMemo(() => {
    const params = new URLSearchParams({ page: page.toString(), limit: PARTS_PER_PAGE.toString() });
    if (debouncedSearch) params.append('search', debouncedSearch);
    return `/api/supplier-parts?${params}`;
  }, [page, debouncedSearch]);

  const customPartsQueryUrl = useMemo(() => {
    const params = new URLSearchParams({ page: customPage.toString(), limit: PARTS_PER_PAGE.toString(), isCustom: 'true' });
    if (customDebouncedSearch) params.append('search', customDebouncedSearch);
    return `/api/parts?${params}`;
  }, [customPage, customDebouncedSearch]);
  
  // Query supplier parts from database (Excel uploads)
  const { data: supplierPartsData, isLoading, isFetching } = useQuery<{ parts: Array<{ id: string; sku: string; name: string; price: string }>; total: number }>({ 
    queryKey: [supplierPartsQueryUrl],
  });

  // Query for custom parts with search and pagination
  const { data: customPartsData, isLoading: customPartsLoading } = useQuery<{ parts: Part[]; total: number }>({ 
    queryKey: [customPartsQueryUrl]
  });

  const supplierParts = supplierPartsData?.parts || [];
  const totalSupplierParts = supplierPartsData?.total || 0;
  const totalSupplierPages = Math.ceil(totalSupplierParts / PARTS_PER_PAGE);
  const customParts = customPartsData?.parts || [];
  const totalCustomParts = customPartsData?.total || 0;
  const totalCustomPages = Math.ceil(totalCustomParts / PARTS_PER_PAGE);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      toast({ title: "Error", description: "Please upload an Excel file (.xlsx or .xls)", variant: "destructive" });
      return;
    }

    setUploading(true);

    try {
      // Parse Excel file on client side
      const XLSX = await import('xlsx');
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];

      // Expected columns: Product SKU, Product Name, Original Price, Discounted Price, Discount Percentage
      // We use: SKU (column 0), Name (column 1), Original Price (column 2)
      const headers = rawData[0];
      const dataRows = rawData.slice(1);

      const parts = dataRows
        .filter((row: any[]) => row[0] && row[1] && row[2] !== undefined)
        .map((row: any[]) => ({
          sku: String(row[0]).trim(),
          name: String(row[1]).trim(),
          price: parseFloat(row[2]) || 0,
        }));

      if (parts.length === 0) {
        toast({ title: "Error", description: "No valid parts found in Excel file", variant: "destructive" });
        return;
      }

      const res = await apiRequest('POST', '/api/supplier-parts/upload', { parts });
      const data = await res.json();
      
      if (res.ok) {
        queryClient.invalidateQueries({ predicate: (query) => String(query.queryKey[0]).startsWith('/api/supplier-parts') });
        toast({ 
          title: "Upload successful", 
          description: `${data.imported?.toLocaleString() || parts.length.toLocaleString()} parts imported` 
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
      queryClient.invalidateQueries({ predicate: (query) => String(query.queryKey[0]).startsWith('/api/parts') });
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
      queryClient.invalidateQueries({ predicate: (query) => String(query.queryKey[0]).startsWith('/api/parts') });
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
      queryClient.invalidateQueries({ predicate: (query) => String(query.queryKey[0]).startsWith('/api/parts') });
      toast({ title: "Part deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const clearSupplierPartsMutation = useMutation({
    mutationFn: async () => { await apiRequest("DELETE", "/api/parts/supplier/all"); },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (query) => String(query.queryKey[0]).startsWith('/api/parts') });
      toast({ title: "All supplier parts cleared" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Create custom part mutation (isCustom = true)
  const createCustomMutation = useMutation({
    mutationFn: async (data: { sku: string; name: string; price: string; isCustom: boolean }) => {
      const res = await apiRequest("POST", "/api/parts", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (query) => String(query.queryKey[0]).startsWith('/api/parts') });
      setCustomOpen(false);
      setCustomSku("");
      setCustomName("");
      setCustomPrice("");
      toast({ title: "Custom part created" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({ sku, name, price });
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createCustomMutation.mutate({ sku: customSku, name: customName, price: customPrice, isCustom: true });
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
    <div className="space-y-4">
      {/* Sub-tabs for Supplier vs Custom parts */}
      <div className="flex gap-2 border-b pb-2">
        <Button
          variant={activeSubTab === "supplier" ? "default" : "ghost"}
          onClick={() => setActiveSubTab("supplier")}
          data-testid="button-supplier-parts-tab"
        >
          Supplier Parts
          {totalSupplierParts > 0 && <Badge variant="secondary" className="ml-2">{totalSupplierParts.toLocaleString()}</Badge>}
        </Button>
        <Button
          variant={activeSubTab === "custom" ? "default" : "ghost"}
          onClick={() => setActiveSubTab("custom")}
          data-testid="button-custom-parts-tab"
        >
          Custom Parts
          {totalCustomParts > 0 && <Badge variant="secondary" className="ml-2">{totalCustomParts.toLocaleString()}</Badge>}
        </Button>
      </div>

      {/* Supplier Parts Tab - Excel Upload */}
      {activeSubTab === "supplier" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap space-y-0 pb-4">
            <div>
              <CardTitle>Supplier Parts (Excel Upload)</CardTitle>
              <CardDescription>Upload parts pricing from Mobilesentrix Excel export. Use the Settings tab to toggle between API and Excel pricing.</CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search SKU or name..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-[250px]"
                  data-testid="input-search-parts"
                />
                {isFetching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
              </div>
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={uploading}
                  data-testid="input-upload-supplier-parts"
                />
                <Button asChild variant="outline" disabled={uploading}>
                  <span>
                    {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                    {uploading ? "Uploading..." : "Upload Excel"}
                  </span>
                </Button>
              </label>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
            ) : supplierParts.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">
                  {debouncedSearch ? `No parts found for "${debouncedSearch}"` : "No supplier parts uploaded yet"}
                </p>
                {!debouncedSearch && (
                  <p className="text-sm text-muted-foreground">
                    Upload an Excel file with columns: Product SKU, Product Name, Original Price
                  </p>
                )}
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Price</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {supplierParts.map((part) => (
                      <TableRow key={part.id}>
                        <TableCell><Badge variant="outline">{part.sku}</Badge></TableCell>
                        <TableCell className="font-medium">{part.name}</TableCell>
                        <TableCell>${parseFloat(part.price).toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {totalSupplierPages > 1 && (
                  <div className="flex items-center justify-between mt-4 px-2">
                    <p className="text-sm text-muted-foreground">
                      Showing {(page - 1) * PARTS_PER_PAGE + 1}-{Math.min(page * PARTS_PER_PAGE, totalSupplierParts)} of {totalSupplierParts.toLocaleString()} parts
                    </p>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setPage(p => Math.max(1, p - 1))} 
                        disabled={page === 1}
                        data-testid="button-parts-prev-page"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </Button>
                      <span className="text-sm text-muted-foreground">Page {page} of {totalSupplierPages}</span>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setPage(p => Math.min(totalSupplierPages, p + 1))} 
                        disabled={page === totalSupplierPages}
                        data-testid="button-parts-next-page"
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Custom Parts Tab */}
      {activeSubTab === "custom" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap space-y-0 pb-4">
            <div>
              <CardTitle>Custom Parts</CardTitle>
              <CardDescription>Parts you add here are preserved when bulk uploading from Excel</CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search SKU or name..." 
                  value={customSearchQuery}
                  onChange={(e) => setCustomSearchQuery(e.target.value)}
                  className="pl-9 w-[200px]"
                  data-testid="input-search-custom-parts"
                />
              </div>
              <Dialog open={customOpen} onOpenChange={setCustomOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-add-custom-part"><Plus className="h-4 w-4 mr-2" />Add Custom Part</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add Custom Part</DialogTitle></DialogHeader>
                  <form onSubmit={handleCustomSubmit} className="space-y-4">
                    <div>
                      <Label htmlFor="customSku">SKU *</Label>
                      <Input id="customSku" value={customSku} onChange={(e) => setCustomSku(e.target.value)} required data-testid="input-custom-part-sku" />
                    </div>
                    <div>
                      <Label htmlFor="customName">Name *</Label>
                      <Input id="customName" value={customName} onChange={(e) => setCustomName(e.target.value)} required data-testid="input-custom-part-name" />
                    </div>
                    <div>
                      <Label htmlFor="customPrice">Price *</Label>
                      <Input id="customPrice" type="number" step="0.01" value={customPrice} onChange={(e) => setCustomPrice(e.target.value)} required data-testid="input-custom-part-price" />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setCustomOpen(false)}>Cancel</Button>
                      <Button type="submit" disabled={createCustomMutation.isPending} data-testid="button-create-custom-part">
                        {createCustomMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Create
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {customPartsLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
            ) : customParts.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">{customSearchQuery ? "No custom parts match your search" : "No custom parts yet. Custom parts are not overwritten during Excel imports."}</p>
            ) : (
              <>
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
                    {customParts.map((part) => (
                      <TableRow key={part.id}>
                        <TableCell><Badge variant="secondary">{part.sku}</Badge></TableCell>
                        <TableCell className="font-medium">{part.name}</TableCell>
                        <TableCell>${part.price}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(part)} data-testid={`button-edit-custom-part-${part.id}`}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(part.id)} disabled={deleteMutation.isPending} data-testid={`button-delete-custom-part-${part.id}`}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {totalCustomPages > 1 && (
                  <div className="flex items-center justify-between mt-4 px-2">
                    <p className="text-sm text-muted-foreground">
                      Showing {(customPage - 1) * PARTS_PER_PAGE + 1}-{Math.min(customPage * PARTS_PER_PAGE, totalCustomParts)} of {totalCustomParts.toLocaleString()} parts
                    </p>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setCustomPage(p => Math.max(1, p - 1))} 
                        disabled={customPage === 1}
                        data-testid="button-custom-parts-prev-page"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </Button>
                      <span className="text-sm text-muted-foreground">Page {customPage} of {totalCustomPages}</span>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setCustomPage(p => Math.min(totalCustomPages, p + 1))} 
                        disabled={customPage === totalCustomPages}
                        data-testid="button-custom-parts-next-page"
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Shared Edit Dialog */}
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
  );
}

function DeviceServicesTab({ toast }: { toast: ReturnType<typeof useToast>["toast"] }) {
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
  const [editRepairDeskServiceId, setEditRepairDeskServiceId] = useState<string>("");
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

  const dismissAlertMutation = useMutation({
    mutationFn: async ({ deviceServiceId, dismissType }: { deviceServiceId: string; dismissType: "1month" | "indefinite" }) => {
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
    return deviceServices.filter(ds => ds.partSku && !ds.part && !dismissedAlertIds.includes(ds.id));
  }, [deviceServices, dismissedAlertIds]);
  
  const missingPartLinks = useMemo(() => {
    return deviceServices.filter(ds => {
      const hasPart = ds.part !== null;
      const isLabourOnly = ds.service?.labourOnly === true;
      return !hasPart && !isLabourOnly && !ds.partSku && !dismissedAlertIds.includes(ds.id);
    });
  }, [deviceServices, dismissedAlertIds]);

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
    mutationFn: async ({ id, data }: { id: string; data: { deviceId?: string; serviceId?: string; partSku?: string; partId?: string; alternativePartSkus?: string[]; additionalFee?: number; repairDeskServiceId?: number | null } }) => {
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
    setEditRepairDeskServiceId((ds as any).repairDeskServiceId ? String((ds as any).repairDeskServiceId) : "");
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
        partSku: editPartSku || undefined,
        partId: editItem.partId || undefined,
        alternativePartSkus: editAlternativePartSkus.length > 0 ? editAlternativePartSkus : undefined,
        additionalFee: editAdditionalFee ? parseFloat(editAdditionalFee) : 0,
        repairDeskServiceId: editRepairDeskServiceId ? parseInt(editRepairDeskServiceId, 10) : null,
      },
    });
  };

  const selectedPart = filteredParts.find((p) => p.id === partId);
  
  const { data: skuPart } = useQuery<Part | null>({
    queryKey: [`/api/parts/sku/${encodeURIComponent(partSku)}`],
    enabled: partSku.length > 0
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-4">
        <div>
          <CardTitle>Device-Service Links</CardTitle>
          <CardDescription>Link devices to services with optional parts. Labor and markup come from the Service.</CardDescription>
        </div>
        <div className="flex gap-2">
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

        <Dialog open={editOpen} onOpenChange={(open) => { setEditOpen(open); if (!open) setAdditionalPartSku(""); }}>
          <DialogContent>
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

                {/* Additional Fee */}
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

                {/* RepairDesk Service ID */}
                <div className="space-y-2">
                  <Label htmlFor="edit-repairdesk-service-id">RepairDesk Service ID (optional)</Label>
                  <Input
                    id="edit-repairdesk-service-id"
                    type="number"
                    min="0"
                    placeholder="e.g. 44227"
                    value={editRepairDeskServiceId}
                    onChange={(e) => setEditRepairDeskServiceId(e.target.value)}
                    data-testid="input-edit-repairdesk-service-id"
                  />
                  <p className="text-xs text-muted-foreground">Link to a RepairDesk service for automatic price syncing every 2 days.</p>
                </div>
                
                {/* Additional Parts (Secondary) Section */}
                <div className="space-y-2 border-t pt-4">
                  <Label>Additional Parts (Secondary)</Label>
                  <p className="text-xs text-muted-foreground mb-2">These parts will be charged at {editItem?.service?.secondaryPartPercentage || 100}% of their cost</p>
                  
                  {/* List existing additional parts */}
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
                          <Button 
                            type="button" 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6"
                            onClick={() => dsRemoveAdditionalPartMutation.mutate(ap.id)}
                            disabled={dsRemoveAdditionalPartMutation.isPending}
                            data-testid={`button-remove-ds-additional-part-${ap.id}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
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
        <div className="flex flex-wrap gap-3 mb-4 items-end">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search service links..."
              value={serviceLinkSearch}
              onChange={(e) => setServiceLinkSearch(e.target.value)}
              className="pl-8 w-[200px]"
              data-testid="input-service-link-search"
            />
          </div>
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

        {/* Error section for orphaned SKUs (part was deleted but SKU is preserved) */}
        {orphanedSkuLinks.length > 0 && (
          <div className="mb-4 border border-orange-500/50 bg-orange-500/5 rounded-md p-4" data-testid="section-orphaned-sku-links">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              <h4 className="font-semibold text-orange-600">
                {orphanedSkuLinks.length} Service Link{orphanedSkuLinks.length !== 1 ? "s" : ""} with Missing Parts (SKU Preserved)
              </h4>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              These service links have a saved SKU but the part no longer exists in your parts list. Re-upload parts or assign a new part to fix.
            </p>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {orphanedSkuLinks.map((ds) => (
                <div 
                  key={ds.id} 
                  className="flex items-center justify-between text-sm py-1.5 px-2 bg-background rounded border gap-2"
                  data-testid={`orphaned-link-${ds.id}`}
                >
                  <span className="flex-1 min-w-0">
                    <span className="font-medium">{ds.device?.name || "Unknown"}</span>
                    <span className="text-muted-foreground"> ({ds.device?.brand?.name || "-"})</span>
                    <span className="mx-2">→</span>
                    <span>{ds.service?.name || "Unknown"}</span>
                  </span>
                  <Badge variant="outline" className="font-mono text-xs shrink-0">{ds.partSku}</Badge>
                  <div className="flex gap-1 shrink-0">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleEdit(ds)}
                      data-testid={`button-fix-orphaned-${ds.id}`}
                    >
                      Reassign Part
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`button-dismiss-orphaned-${ds.id}`}>
                          <X className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => dismissAlertMutation.mutate({ deviceServiceId: ds.id, dismissType: "1month" })} data-testid={`dismiss-1month-${ds.id}`}>
                          <Clock className="h-4 w-4 mr-2" />
                          Dismiss for 1 month
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => dismissAlertMutation.mutate({ deviceServiceId: ds.id, dismissType: "indefinite" })} data-testid={`dismiss-indefinite-${ds.id}`}>
                          <EyeOff className="h-4 w-4 mr-2" />
                          Dismiss indefinitely
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error section for service links with missing parts (no SKU at all) */}
        {missingPartLinks.length > 0 && (
          <div className="mb-4 border border-destructive/50 bg-destructive/5 rounded-md p-4" data-testid="section-missing-part-links">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <h4 className="font-semibold text-destructive">
                {missingPartLinks.length} Service Link{missingPartLinks.length !== 1 ? "s" : ""} Missing Parts
              </h4>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              These service links have no part assigned and the service is not marked as "Labour only". They will show as "Not Available" in the quote widget.
            </p>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {missingPartLinks.map((ds) => (
                <div 
                  key={ds.id} 
                  className="flex items-center justify-between text-sm py-1.5 px-2 bg-background rounded border gap-2"
                  data-testid={`error-link-${ds.id}`}
                >
                  <span className="flex-1 min-w-0">
                    <span className="font-medium">{ds.device?.name || "Unknown"}</span>
                    <span className="text-muted-foreground"> ({ds.device?.brand?.name || "-"})</span>
                    <span className="mx-2">→</span>
                    <span>{ds.service?.name || "Unknown"}</span>
                  </span>
                  <div className="flex gap-1 shrink-0">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleEdit(ds)}
                      data-testid={`button-fix-link-${ds.id}`}
                    >
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
                          <Clock className="h-4 w-4 mr-2" />
                          Dismiss for 1 month
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => dismissAlertMutation.mutate({ deviceServiceId: ds.id, dismissType: "indefinite" })} data-testid={`dismiss-indefinite-link-${ds.id}`}>
                          <EyeOff className="h-4 w-4 mr-2" />
                          Dismiss indefinitely
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

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

function DismissedAlertsSection({ toast }: { toast: ReturnType<typeof useToast>["toast"] }) {
  const { data: indefiniteAlerts = [], isLoading } = useQuery<DismissedAlertWithInfo[]>({
    queryKey: ["/api/dismissed-alerts/indefinite"],
  });
  
  const { data: deviceServices = [] } = useQuery<DeviceServiceWithRelations[]>({ 
    queryKey: ["/api/device-services"] 
  });
  
  const undismissMutation = useMutation({
    mutationFn: async (deviceServiceId: string) => {
      return apiRequest("DELETE", `/api/dismissed-alerts/${deviceServiceId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dismissed-alerts/indefinite"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dismissed-alerts/active-ids"] });
      toast({ title: "Alert restored" });
    },
    onError: () => {
      toast({ title: "Failed to restore alert", variant: "destructive" });
    },
  });

  const alertsWithInfo = useMemo(() => {
    return indefiniteAlerts.map(alert => {
      const ds = deviceServices.find(d => d.id === alert.deviceServiceId);
      return {
        ...alert,
        deviceName: ds?.device?.name || "Unknown Device",
        brandName: ds?.device?.brand?.name || "-",
        serviceName: ds?.service?.name || "Unknown Service",
      };
    });
  }, [indefiniteAlerts, deviceServices]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <EyeOff className="h-5 w-5" />
            Dismissed Missing Parts Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <EyeOff className="h-5 w-5" />
          Dismissed Missing Parts Alerts
        </CardTitle>
        <CardDescription>
          Service links that have been permanently dismissed from the "Missing Parts" warnings
        </CardDescription>
      </CardHeader>
      <CardContent>
        {alertsWithInfo.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No permanently dismissed alerts</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {alertsWithInfo.map((alert) => (
              <div 
                key={alert.id} 
                className="flex items-center justify-between text-sm py-2 px-3 bg-muted/50 rounded-md border gap-2"
                data-testid={`dismissed-alert-${alert.deviceServiceId}`}
              >
                <span className="flex-1 min-w-0">
                  <span className="font-medium">{alert.deviceName}</span>
                  <span className="text-muted-foreground"> ({alert.brandName})</span>
                  <span className="mx-2">→</span>
                  <span>{alert.serviceName}</span>
                </span>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => undismissMutation.mutate(alert.deviceServiceId)}
                  disabled={undismissMutation.isPending}
                  data-testid={`button-restore-alert-${alert.deviceServiceId}`}
                >
                  Restore
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MobilesentrixApiTest() {
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; responseTime?: number } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  
  const runTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const response = await fetch('/api/mobilesentrix/test', { credentials: 'include' });
      const result = await response.json();
      setTestResult(result);
    } catch (error) {
      setTestResult({ success: false, message: 'Failed to connect to test endpoint' });
    }
    setIsTesting(false);
  };
  
  return (
    <div className="p-3 rounded-lg border bg-muted/50 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">API Status</p>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={runTest}
          disabled={isTesting}
          data-testid="button-test-mobilesentrix-api"
        >
          {isTesting ? (
            <>
              <Loader2 className="h-3 w-3 mr-2 animate-spin" />
              Testing...
            </>
          ) : (
            <>
              <RefreshCw className="h-3 w-3 mr-2" />
              Test Connection
            </>
          )}
        </Button>
      </div>
      
      {testResult && (
        <div className={`p-2 rounded text-sm ${testResult.success ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
          {testResult.success ? (
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4" />
              <span>{testResult.message}</span>
              {testResult.responseTime && (
                <span className="text-xs opacity-70">({testResult.responseTime}ms)</span>
              )}
            </div>
          ) : (
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{testResult.message}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SettingsTab({ toast }: { toast: ReturnType<typeof useToast>["toast"] }) {
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [smsTemplate, setSmsTemplate] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [unknownDeviceEmail, setUnknownDeviceEmail] = useState("");
  const [unknownDeviceSms, setUnknownDeviceSms] = useState("");
  const [serviceItemTemplate, setServiceItemTemplate] = useState("");
  const [smsServiceItemTemplate, setSmsServiceItemTemplate] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [testPhone, setTestPhone] = useState("");

  // RepairDesk Integration (API Key based)
  const { data: repairDeskStatus, refetch: refetchRepairDeskStatus } = useQuery<{ connected: boolean; stockCheckEnabled: boolean }>({
    queryKey: ["/api/repairdesk/status"],
  });

  // RepairDesk Sync Status
  const { data: repairDeskSyncStatus, refetch: refetchSyncStatus } = useQuery<{ 
    configured: boolean; 
    connected: boolean; 
    linkedServicesCount: number; 
    lastSyncTime: string | null 
  }>({
    queryKey: ["/api/repairdesk/sync/status"],
  });

  const { data: repairDeskSyncHistory = [] } = useQuery<Array<{
    id: string;
    syncType: string;
    status: string;
    totalServices: number;
    syncedServices: number;
    failedServices: number;
    startedAt: string;
    completedAt: string | null;
  }>>({
    queryKey: ["/api/repairdesk/sync/history"],
  });

  const { data: repairDeskBrokenLinks = [] } = useQuery<Array<{
    deviceServiceId: string;
    deviceName: string;
    serviceName: string;
    repairDeskServiceId: number | null;
    issue: string;
  }>>({
    queryKey: ["/api/repairdesk/sync/broken-links"],
  });

  const triggerSyncMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/repairdesk/sync/trigger");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/repairdesk/sync/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/repairdesk/sync/history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/repairdesk/sync/broken-links"] });
      toast({ title: "Sync completed", description: `${data.syncedServices}/${data.totalServices} services synced successfully` });
    },
    onError: (error: Error) => {
      toast({ title: "Sync failed", description: error.message, variant: "destructive" });
    },
  });

  // Mobilesentrix Integration
  const { data: mobilesentrixStatus, refetch: refetchMobilesentrixStatus } = useQuery<{ configured: boolean; missingCredentials: string[] }>({
    queryKey: ["/api/mobilesentrix/status"],
  });

  // Pricing Source Setting
  const { data: pricingSourceSettings } = useQuery<{ source: string }>({
    queryKey: ["/api/settings/pricing-source"],
  });

  const updatePricingSource = useMutation({
    mutationFn: async (source: string) => {
      await apiRequest("POST", "/api/settings/pricing-source", { source });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/pricing-source"] });
      toast({ title: "Pricing source updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const { data: mobilesentrixAuthUrl } = useQuery<{ authUrl: string; callbackUrl: string }>({
    queryKey: ["/api/mobilesentrix/auth-url"],
    enabled: !!mobilesentrixStatus, // Always fetch when we have status (for reauthorization)
  });

  const toggleStockCheck = useMutation({
    mutationFn: async (enabled: boolean) => {
      await apiRequest("POST", "/api/repairdesk/stock-enabled", { enabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/repairdesk/status"] });
      toast({ title: "Setting updated" });
    },
  });

  // Multi-service discount settings
  const { data: multiDiscountSettings } = useQuery<{ enabled: boolean; amount: number }>({
    queryKey: ["/api/settings/multi-discount"],
  });

  const updateMultiDiscount = useMutation({
    mutationFn: async (data: { enabled?: boolean; amount?: number }) => {
      const current = multiDiscountSettings || { enabled: false, amount: 10 };
      await apiRequest("POST", "/api/settings/multi-discount", {
        enabled: data.enabled ?? current.enabled,
        amount: data.amount ?? current.amount
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/multi-discount"] });
      toast({ title: "Discount settings updated" });
    },
  });

  // Hide prices until contact setting
  const { data: hidePricesSettings } = useQuery<{ enabled: boolean }>({
    queryKey: ["/api/settings/hide-prices-until-contact"],
  });

  const updateHidePrices = useMutation({
    mutationFn: async (enabled: boolean) => {
      await apiRequest("POST", "/api/settings/hide-prices-until-contact", { enabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/hide-prices-until-contact"] });
      toast({ title: "Setting updated" });
    },
  });

  // Hide prices completely setting (only show in email/SMS)
  const { data: hidePricesCompletelySettings } = useQuery<{ enabled: boolean }>({
    queryKey: ["/api/settings/hide-prices-completely"],
  });

  const updateHidePricesCompletely = useMutation({
    mutationFn: async (enabled: boolean) => {
      await apiRequest("POST", "/api/settings/hide-prices-completely", { enabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/hide-prices-completely"] });
      toast({ title: "Setting updated" });
    },
  });

  // Price rounding settings
  const { data: roundingSettings } = useQuery<{ mode: string; subtractAmount: number }>({
    queryKey: ["/api/settings/price-rounding"],
  });

  const updateRounding = useMutation({
    mutationFn: async (data: { mode?: string; subtractAmount?: number }) => {
      await apiRequest("POST", "/api/settings/price-rounding", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/price-rounding"] });
      toast({ title: "Rounding settings updated" });
    },
  });

  // RepairDesk leads setting
  const { data: rdLeadsSettings } = useQuery<{ enabled: boolean }>({
    queryKey: ["/api/settings/repairdesk-leads"],
  });

  const updateRdLeads = useMutation({
    mutationFn: async (enabled: boolean) => {
      await apiRequest("POST", "/api/settings/repairdesk-leads", { enabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/repairdesk-leads"] });
      toast({ title: "Setting updated" });
    },
  });

  const { data: templates = [], isLoading } = useQuery<MessageTemplate[]>({
    queryKey: ["/api/message-templates"],
  });

  const defaults = {
    email_subject: "Your Repair Quote: {serviceName} - ${price} plus taxes",
    email_body: `Dear {customerName},

Thank you for requesting a repair quote from RepairQuote!

Here are your quote details:

Device: {deviceName}

{servicesList}

Total: $\{price} plus taxes

To proceed with this repair, please reply to this email or visit our store.

Thank you for choosing RepairQuote!

Best regards,
The RepairQuote Team`,
    sms: "Hi {customerName}! Your RepairQuote for {deviceName}: {servicesList}. Total: ${price} plus taxes. Reply for questions!",
    unknown_device_email: `Dear {customerName},

Thank you for contacting RepairQuote!

We have received your repair inquiry. Our team will review your device details and get back to you with a quote as soon as possible.

Your submitted information:
- Device Description: {deviceDescription}
- Issue: {issueDescription}

We will contact you shortly at this email address with a personalized quote.

Thank you for choosing RepairQuote!

Best regards,
The RepairQuote Team`,
    unknown_device_sms: "Hi {customerName}! We received your repair inquiry for: {deviceDescription}. We'll review and get back to you with a quote soon!",
    service_item_template: `{serviceName}
$\{servicePrice} plus taxes
{repairTime}
{warranty}`,
    sms_service_item_template: "{serviceName} (${servicePrice})"
  };

  useEffect(() => {
    const emailSubjectTemplate = templates.find(t => t.type === "email_subject");
    const emailBodyTemplate = templates.find(t => t.type === "email_body");
    const smsTemplateData = templates.find(t => t.type === "sms");
    const adminEmailData = templates.find(t => t.type === "admin_notification_email");
    const unknownDeviceEmailData = templates.find(t => t.type === "unknown_device_email");
    const unknownDeviceSmsData = templates.find(t => t.type === "unknown_device_sms");
    const serviceItemTemplateData = templates.find(t => t.type === "service_item_template");
    const smsServiceItemTemplateData = templates.find(t => t.type === "sms_service_item_template");
    
    setEmailSubject(emailSubjectTemplate?.content || defaults.email_subject);
    setEmailBody(emailBodyTemplate?.content || defaults.email_body);
    setSmsTemplate(smsTemplateData?.content || defaults.sms);
    setAdminEmail(adminEmailData?.content || "");
    setUnknownDeviceEmail(unknownDeviceEmailData?.content || defaults.unknown_device_email);
    setUnknownDeviceSms(unknownDeviceSmsData?.content || defaults.unknown_device_sms);
    setServiceItemTemplate(serviceItemTemplateData?.content || defaults.service_item_template);
    setSmsServiceItemTemplate(smsServiceItemTemplateData?.content || defaults.sms_service_item_template);
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
  const handleSaveAdminEmail = () => saveMutation.mutate({ type: "admin_notification_email", content: adminEmail });
  const handleSaveUnknownDeviceEmail = () => saveMutation.mutate({ type: "unknown_device_email", content: unknownDeviceEmail });
  const handleSaveUnknownDeviceSms = () => saveMutation.mutate({ type: "unknown_device_sms", content: unknownDeviceSms });
  const handleSaveServiceItemTemplate = () => saveMutation.mutate({ type: "service_item_template", content: serviceItemTemplate });
  const handleSaveSmsServiceItemTemplate = () => saveMutation.mutate({ type: "sms_service_item_template", content: smsServiceItemTemplate });

  const testEmailMutation = useMutation({
    mutationFn: async (email: string) => {
      const res = await apiRequest("POST", "/api/admin/test-email", { email });
      return res.json();
    },
    onSuccess: (data: { message: string }) => {
      toast({ title: "Success", description: data.message });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const testSmsMutation = useMutation({
    mutationFn: async (phone: string) => {
      const res = await apiRequest("POST", "/api/admin/test-sms", { phone });
      return res.json();
    },
    onSuccess: (data: { message: string }) => {
      toast({ title: "Success", description: data.message });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleSendTestEmail = () => {
    if (!testEmail) {
      toast({ title: "Error", description: "Please enter a test email address", variant: "destructive" });
      return;
    }
    testEmailMutation.mutate(testEmail);
  };

  const handleSendTestSms = () => {
    if (!testPhone) {
      toast({ title: "Error", description: "Please enter a test phone number", variant: "destructive" });
      return;
    }
    testSmsMutation.mutate(testPhone);
  };

  const macros = [
    { name: "{customerName}", description: "Customer's name" },
    { name: "{deviceName}", description: "Device name (e.g., iPhone 15 Pro)" },
    { name: "{serviceName}", description: "Service name(s) - comma-separated for multiple" },
    { name: "{serviceDescription}", description: "Service description(s) - semicolon-separated for multiple" },
    { name: "{multiServiceDiscount}", description: "Multi-service discount amount (e.g., $10.00)" },
    { name: "{price}", description: "Total quoted price (number only, add $ manually)" },
    { name: "{repairTime}", description: "Repair time(s) - comma-separated for multiple" },
    { name: "{warranty}", description: "Warranty info - comma-separated for multiple" },
    { name: "{servicesList}", description: "Formatted list of all selected services with details" },
  ];

  const unknownDeviceMacros = [
    { name: "{customerName}", description: "Customer's name" },
    { name: "{deviceDescription}", description: "Customer's device description" },
    { name: "{issueDescription}", description: "Customer's issue description" },
  ];

  const serviceItemMacros = [
    { name: "{serviceName}", description: "Name of the service" },
    { name: "{servicePrice}", description: "Price for this individual service" },
    { name: "{repairTime}", description: "Repair time for this service" },
    { name: "{warranty}", description: "Warranty for this service" },
    { name: "{serviceDescription}", description: "Description of the service" },
  ];

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <Tabs defaultValue="quote-settings" className="space-y-4">
      <TabsList className="grid grid-cols-3 sm:flex sm:flex-wrap gap-1 h-auto w-full sm:w-auto">
        <TabsTrigger value="quote-settings" className="text-xs sm:text-sm px-2 sm:px-3" data-testid="subtab-quote-settings">Settings</TabsTrigger>
        <TabsTrigger value="quote-templates" className="text-xs sm:text-sm px-2 sm:px-3" data-testid="subtab-quote-templates">Templates</TabsTrigger>
        <TabsTrigger value="repairdesk" className="text-xs sm:text-sm px-2 sm:px-3" data-testid="subtab-repairdesk">RepairDesk</TabsTrigger>
        <TabsTrigger value="mobilesentrix" className="text-xs sm:text-sm px-2 sm:px-3" data-testid="subtab-mobilesentrix">Mobilesentrix</TabsTrigger>
      </TabsList>

      {/* Quote Settings Sub-Tab */}
      <TabsContent value="quote-settings" className="space-y-6">
        {/* Multi-Service Discount */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5" />
              Multi-Service Discount
            </CardTitle>
            <CardDescription>Automatic discount when customers select multiple services</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <p className="font-medium text-sm">Enable Multi-Service Discount</p>
                <p className="text-xs text-muted-foreground">Apply discount when 2+ eligible services are selected</p>
              </div>
              <Switch
                checked={multiDiscountSettings?.enabled ?? false}
                onCheckedChange={(checked) => updateMultiDiscount.mutate({ enabled: checked })}
                disabled={updateMultiDiscount.isPending}
                data-testid="switch-multi-discount"
              />
            </div>
            
            {multiDiscountSettings?.enabled && (
              <div className="space-y-2">
                <Label htmlFor="discount-amount">Discount Amount ($)</Label>
                <div className="flex gap-2">
                  <Input
                    id="discount-amount"
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={multiDiscountSettings?.amount ?? 10}
                    className="w-32"
                    onBlur={(e) => {
                      const value = parseFloat(e.target.value);
                      if (!isNaN(value) && value >= 0) {
                        updateMultiDiscount.mutate({ amount: value });
                      }
                    }}
                    data-testid="input-discount-amount"
                  />
                  <span className="text-sm text-muted-foreground self-center">off total when multiple services selected</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Price Rounding Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Price Rounding
            </CardTitle>
            <CardDescription>Configure how quoted prices are rounded for display</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Rounding Mode</Label>
              <Select
                value={roundingSettings?.mode || "nearest5"}
                onValueChange={(value) => updateRounding.mutate({ mode: value })}
                disabled={updateRounding.isPending}
              >
                <SelectTrigger className="w-full sm:w-64" data-testid="select-rounding-mode">
                  <SelectValue placeholder="Select rounding mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No rounding (exact price)</SelectItem>
                  <SelectItem value="nearest5">Round to nearest $5</SelectItem>
                  <SelectItem value="nearest10">Round to nearest $10</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {roundingSettings?.mode === "none" 
                  ? "Prices will show exact calculated values" 
                  : roundingSettings?.mode === "nearest10"
                    ? "Prices will be rounded to the nearest $10 increment"
                    : "Prices will be rounded to the nearest $5 increment"}
              </p>
            </div>
            
            {roundingSettings?.mode !== "none" && (
              <div className="space-y-2">
                <Label htmlFor="subtract-amount">Subtract from Rounded Total ($)</Label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    id="subtract-amount"
                    type="number"
                    step="1"
                    min="0"
                    max="9"
                    defaultValue={roundingSettings?.subtractAmount ?? 1}
                    className="w-24"
                    onBlur={(e) => {
                      const value = parseInt(e.target.value);
                      if (!isNaN(value) && value >= 0 && value <= 9) {
                        updateRounding.mutate({ subtractAmount: value });
                      }
                    }}
                    data-testid="input-subtract-amount"
                  />
                  <span className="text-sm text-muted-foreground self-center">
                    {roundingSettings?.subtractAmount === 0 
                      ? "Prices end in $0 (e.g., $100, $150)" 
                      : roundingSettings?.subtractAmount === 1
                        ? "Prices end in $9 or $4 (e.g., $99, $149)"
                        : roundingSettings?.subtractAmount === 6
                          ? "Prices end in $4 or $9 (e.g., $94, $144)"
                          : `Prices end in ${10 - (roundingSettings?.subtractAmount || 1)} or ${5 - (roundingSettings?.subtractAmount || 1)}`}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Supplier Parts Pricing Source */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Supplier Parts Pricing Source
            </CardTitle>
            <CardDescription>Choose where to get pricing for supplier parts during quote calculations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div 
                className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${pricingSourceSettings?.source === "excel_upload" ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
                onClick={() => updatePricingSource.mutate("excel_upload")}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${pricingSourceSettings?.source === "excel_upload" ? "border-primary" : "border-muted-foreground"}`}>
                    {pricingSourceSettings?.source === "excel_upload" && <div className="w-2 h-2 rounded-full bg-primary" />}
                  </div>
                  <div>
                    <p className="font-medium text-sm">Excel Upload</p>
                    <p className="text-xs text-muted-foreground">Use pricing from uploaded Mobilesentrix Excel file (Parts tab)</p>
                  </div>
                </div>
              </div>
              <div 
                className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${pricingSourceSettings?.source === "mobilesentrix_api" ? "border-primary bg-primary/5" : "hover:bg-muted/50"} ${!mobilesentrixStatus?.configured ? "opacity-50" : ""}`}
                onClick={() => mobilesentrixStatus?.configured && updatePricingSource.mutate("mobilesentrix_api")}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${pricingSourceSettings?.source === "mobilesentrix_api" ? "border-primary" : "border-muted-foreground"}`}>
                    {pricingSourceSettings?.source === "mobilesentrix_api" && <div className="w-2 h-2 rounded-full bg-primary" />}
                  </div>
                  <div>
                    <p className="font-medium text-sm">Mobilesentrix API</p>
                    <p className="text-xs text-muted-foreground">Fetch live pricing from Mobilesentrix API (requires OAuth setup)</p>
                    {!mobilesentrixStatus?.configured && (
                      <p className="text-xs text-destructive mt-1">Not configured - complete OAuth setup in Mobilesentrix tab</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Current source: <Badge variant="outline">{pricingSourceSettings?.source === "mobilesentrix_api" ? "Mobilesentrix API" : "Excel Upload"}</Badge>
            </p>
          </CardContent>
        </Card>

        {/* Hide Prices Until Contact */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Quote Flow Settings
            </CardTitle>
            <CardDescription>Control when customers see pricing information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <p className="font-medium text-sm">Hide Prices Completely</p>
                <p className="text-xs text-muted-foreground">Prices are hidden on the website but shown in the SMS/email sent to customers</p>
              </div>
              <Switch
                checked={hidePricesCompletelySettings?.enabled ?? false}
                onCheckedChange={(checked) => updateHidePricesCompletely.mutate(checked)}
                disabled={updateHidePricesCompletely.isPending}
                data-testid="switch-hide-prices-completely"
              />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <p className="font-medium text-sm">Require Contact Info Before Showing Prices</p>
                <p className="text-xs text-muted-foreground">When enabled, customers must enter their contact details before seeing prices</p>
              </div>
              <Switch
                checked={hidePricesSettings?.enabled ?? false}
                onCheckedChange={(checked) => updateHidePrices.mutate(checked)}
                disabled={updateHidePrices.isPending || (hidePricesCompletelySettings?.enabled ?? false)}
                data-testid="switch-hide-prices"
              />
            </div>
          </CardContent>
        </Card>

        {/* Admin Notifications */}
        <Card>
          <CardHeader>
            <CardTitle>Admin Notifications</CardTitle>
            <CardDescription>Email address to receive quote submission notifications</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-email">Admin Email Address</Label>
              <Input 
                id="admin-email"
                type="email"
                value={adminEmail} 
                onChange={(e) => setAdminEmail(e.target.value)} 
                placeholder="admin@example.com"
                data-testid="input-admin-email"
              />
              <p className="text-sm text-muted-foreground">
                When set, all quote submissions (both known and unknown device quotes) will send a notification to this email.
              </p>
            </div>
            <Button onClick={handleSaveAdminEmail} disabled={saveMutation.isPending} data-testid="button-save-admin-email">
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Admin Email
            </Button>
          </CardContent>
        </Card>

        {/* Dismissed Alerts */}
        <DismissedAlertsSection toast={toast} />
      </TabsContent>

      {/* Quote Templates Sub-Tab */}
      <TabsContent value="quote-templates" className="space-y-6">
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
            <CardTitle>Service Item Template (Email)</CardTitle>
            <CardDescription>
              Format for each service in the {"{servicesList}"} placeholder for emails. Each service will be formatted using this template and separated by blank lines.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2 mb-4">
              {serviceItemMacros.map((macro) => (
                <Badge key={macro.name} variant="outline" className="text-sm">
                  {macro.name} - {macro.description}
                </Badge>
              ))}
            </div>
            <Textarea 
              value={serviceItemTemplate} 
              onChange={(e) => setServiceItemTemplate(e.target.value)} 
              placeholder="Enter service item template..."
              className="min-h-[120px] font-mono text-sm"
              data-testid="textarea-service-item-template"
            />
            <Button onClick={handleSaveServiceItemTemplate} disabled={saveMutation.isPending} data-testid="button-save-service-item-template">
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Service Item Template
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Service Item Template (SMS)</CardTitle>
            <CardDescription>
              Format for each service in the {"{servicesList}"} placeholder for SMS. Each service will be formatted using this template and separated by blank lines.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2 mb-4">
              {serviceItemMacros.map((macro) => (
                <Badge key={macro.name} variant="outline" className="text-sm">
                  {macro.name} - {macro.description}
                </Badge>
              ))}
            </div>
            <Textarea 
              value={smsServiceItemTemplate} 
              onChange={(e) => setSmsServiceItemTemplate(e.target.value)} 
              placeholder="Enter SMS service item template..."
              className="min-h-[120px] font-mono text-sm"
              data-testid="input-sms-service-item-template"
            />
            <Button onClick={handleSaveSmsServiceItemTemplate} disabled={saveMutation.isPending} data-testid="button-save-sms-service-item-template">
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save SMS Service Item Template
            </Button>
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

        <Card>
          <CardHeader>
            <CardTitle>"I Don't Know My Device" Email Template</CardTitle>
            <CardDescription>Email sent to customers who submit unknown device quote requests</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2 mb-4">
              {unknownDeviceMacros.map((macro) => (
                <Badge key={macro.name} variant="secondary" className="text-xs">
                  {macro.name} - {macro.description}
                </Badge>
              ))}
            </div>
            <Textarea 
              value={unknownDeviceEmail} 
              onChange={(e) => setUnknownDeviceEmail(e.target.value)} 
              placeholder="Enter email template..."
              className="min-h-[200px] font-mono text-sm"
              data-testid="textarea-unknown-device-email"
            />
            <Button onClick={handleSaveUnknownDeviceEmail} disabled={saveMutation.isPending} data-testid="button-save-unknown-device-email">
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Unknown Device Email
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>"I Don't Know My Device" SMS Template</CardTitle>
            <CardDescription>SMS sent to customers who submit unknown device quote requests</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2 mb-4">
              {unknownDeviceMacros.map((macro) => (
                <Badge key={macro.name} variant="secondary" className="text-xs">
                  {macro.name} - {macro.description}
                </Badge>
              ))}
            </div>
            <Textarea 
              value={unknownDeviceSms} 
              onChange={(e) => setUnknownDeviceSms(e.target.value)} 
              placeholder="Enter SMS template..."
              className="min-h-[80px]"
              data-testid="textarea-unknown-device-sms"
            />
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-sm text-muted-foreground">{unknownDeviceSms.length} characters (160 recommended max)</p>
              <Button onClick={handleSaveUnknownDeviceSms} disabled={saveMutation.isPending} data-testid="button-save-unknown-device-sms">
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save Unknown Device SMS
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Test Message Recipients</CardTitle>
            <CardDescription>Configure where test emails and SMS messages should be sent</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="test-email">Test Email Address</Label>
                <div className="flex gap-2">
                  <Input 
                    id="test-email"
                    type="email"
                    value={testEmail} 
                    onChange={(e) => setTestEmail(e.target.value)} 
                    placeholder="test@example.com"
                    data-testid="input-test-email"
                  />
                  <Button 
                    onClick={handleSendTestEmail} 
                    disabled={testEmailMutation.isPending}
                    variant="outline"
                    data-testid="button-send-test-email"
                  >
                    {testEmailMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
                    Send Test
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Send a test email with sample quote data to verify your email templates.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="test-phone">Test Phone Number</Label>
                <div className="flex gap-2">
                  <Input 
                    id="test-phone"
                    type="tel"
                    value={testPhone} 
                    onChange={(e) => setTestPhone(e.target.value)} 
                    placeholder="+1 (555) 123-4567"
                    data-testid="input-test-phone"
                  />
                  <Button 
                    onClick={handleSendTestSms} 
                    disabled={testSmsMutation.isPending}
                    variant="outline"
                    data-testid="button-send-test-sms"
                  >
                    {testSmsMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <MessageSquare className="h-4 w-4 mr-2" />}
                    Send Test
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Send a test SMS with sample quote data to verify your SMS templates.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* RepairDesk Integration Sub-Tab */}
      <TabsContent value="repairdesk" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              RepairDesk API Connection
            </CardTitle>
            <CardDescription>API key connection for real-time parts inventory status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              {repairDeskStatus?.connected ? (
                <>
                  <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    <Check className="h-3 w-3 mr-1" />
                    Connected
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    API key configured
                  </span>
                </>
              ) : (
                <>
                  <Badge variant="secondary" className="bg-muted">
                    Not Connected
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    Add REPAIRDESK_API_KEY to Secrets to enable
                  </span>
                </>
              )}
            </div>
            
            {repairDeskStatus?.connected && (
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                  <p className="font-medium text-sm">Show Stock Status</p>
                  <p className="text-xs text-muted-foreground">Display "In Stock" / "Parts order may be required" on quotes</p>
                </div>
                <Switch
                  checked={repairDeskStatus?.stockCheckEnabled ?? true}
                  onCheckedChange={(checked) => toggleStockCheck.mutate(checked)}
                  disabled={toggleStockCheck.isPending}
                  data-testid="switch-stock-check"
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              RepairDesk Lead Integration
            </CardTitle>
            <CardDescription>Automatically create leads in RepairDesk when customers request quotes</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <p className="font-medium text-sm">Create Lead on Quote Request</p>
                <p className="text-xs text-muted-foreground">When enabled, a lead will be created in RepairDesk for each quote submitted</p>
              </div>
              <Switch
                checked={rdLeadsSettings?.enabled ?? false}
                onCheckedChange={(checked) => updateRdLeads.mutate(checked)}
                disabled={updateRdLeads.isPending}
                data-testid="switch-repairdesk-leads"
              />
            </div>
            <p className="text-xs text-muted-foreground">Note: Requires RepairDesk API key to be configured</p>
          </CardContent>
        </Card>

        {/* RepairDesk Price Sync Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              RepairDesk Price Sync
            </CardTitle>
            <CardDescription>Automatically sync calculated prices to RepairDesk services every 2 days</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Connection Status */}
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <p className="font-medium text-sm">Sync Status</p>
                <p className="text-xs text-muted-foreground">
                  {repairDeskSyncStatus?.linkedServicesCount || 0} device-service links configured with RepairDesk IDs
                </p>
              </div>
              <div className="flex items-center gap-2">
                {repairDeskSyncStatus?.connected ? (
                  <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    <Check className="h-3 w-3 mr-1" />
                    Ready
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="bg-muted">
                    Not Configured
                  </Badge>
                )}
              </div>
            </div>

            {/* Last Sync Time */}
            {repairDeskSyncStatus?.lastSyncTime && (
              <div className="p-3 rounded-lg border">
                <p className="text-sm">
                  <span className="font-medium">Last Sync:</span>{" "}
                  {new Date(repairDeskSyncStatus.lastSyncTime).toLocaleString()}
                </p>
              </div>
            )}

            {/* Manual Sync Button */}
            <Button
              onClick={() => triggerSyncMutation.mutate()}
              disabled={triggerSyncMutation.isPending || !repairDeskSyncStatus?.connected || (repairDeskSyncStatus?.linkedServicesCount || 0) === 0}
              data-testid="button-trigger-sync"
            >
              {triggerSyncMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Sync Prices Now
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground">
              Prices automatically sync every 2 days. Click to sync immediately.
            </p>

            {/* Broken Links Warning */}
            {repairDeskBrokenLinks.length > 0 && (
              <div className="p-3 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-900/20">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <p className="font-medium text-sm text-amber-800 dark:text-amber-400">
                    {repairDeskBrokenLinks.length} Warning{repairDeskBrokenLinks.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <ul className="space-y-1 text-xs text-amber-700 dark:text-amber-300">
                  {repairDeskBrokenLinks.slice(0, 5).map((link) => (
                    <li key={link.deviceServiceId}>
                      {link.deviceName} - {link.serviceName}: {link.issue}
                    </li>
                  ))}
                  {repairDeskBrokenLinks.length > 5 && (
                    <li>...and {repairDeskBrokenLinks.length - 5} more</li>
                  )}
                </ul>
              </div>
            )}

            {/* Sync History */}
            {repairDeskSyncHistory.length > 0 && (
              <div className="space-y-2">
                <p className="font-medium text-sm">Recent Sync History</p>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {repairDeskSyncHistory.slice(0, 5).map((sync) => (
                    <div key={sync.id} className="flex items-center justify-between p-2 text-xs border rounded">
                      <div className="flex items-center gap-2">
                        <Badge variant={sync.status === "success" ? "secondary" : sync.status === "partial" ? "outline" : "destructive"} className="text-[10px]">
                          {sync.status}
                        </Badge>
                        <span>{sync.syncedServices}/{sync.totalServices} synced</span>
                        <span className="text-muted-foreground">({sync.syncType})</span>
                      </div>
                      <span className="text-muted-foreground">
                        {new Date(sync.startedAt).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              To link a service: Edit a device-service link and add the RepairDesk Service ID.
            </p>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Mobilesentrix Integration Sub-Tab */}
      <TabsContent value="mobilesentrix" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Mobilesentrix API Connection
            </CardTitle>
            <CardDescription>OAuth connection for real-time parts pricing from Mobilesentrix Canada</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              {mobilesentrixStatus?.configured ? (
                <>
                  <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    <Check className="h-3 w-3 mr-1" />
                    Connected
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    All OAuth credentials configured
                  </span>
                </>
              ) : (
                <>
                  <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                    Setup Required
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {mobilesentrixStatus?.missingCredentials?.length === 4 
                      ? "No credentials configured" 
                      : `Missing: ${mobilesentrixStatus?.missingCredentials?.join(", ")}`}
                  </span>
                </>
              )}
            </div>

            {!mobilesentrixStatus?.configured && (
              <div className="space-y-3 p-4 rounded-lg border bg-muted/50">
                <p className="text-sm font-medium">To connect Mobilesentrix:</p>
                {mobilesentrixStatus?.missingCredentials?.includes("MOBILESENTRIX_CONSUMER_KEY") ? (
                  <div className="text-sm text-muted-foreground">
                    <p>1. Add <code className="bg-muted px-1 py-0.5 rounded">MOBILESENTRIX_CONSUMER_KEY</code> and <code className="bg-muted px-1 py-0.5 rounded">MOBILESENTRIX_CONSUMER_SECRET</code> to Secrets</p>
                    <p className="mt-1">2. Refresh this page and complete OAuth authorization</p>
                  </div>
                ) : mobilesentrixAuthUrl?.authUrl ? (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Click below to authorize with your Mobilesentrix customer account:</p>
                    <Button 
                      onClick={() => window.open(mobilesentrixAuthUrl.authUrl, '_blank')}
                      data-testid="button-mobilesentrix-authorize"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Authorize with Mobilesentrix
                    </Button>
                    <p className="text-xs text-muted-foreground mt-2">
                      Authorization is automatic - tokens will be saved and you'll be redirected back.
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Loading authorization URL...</p>
                )}
              </div>
            )}

            {mobilesentrixStatus?.configured && (
              <div className="space-y-3">
                <div className="p-3 rounded-lg border bg-green-50 dark:bg-green-900/20">
                  <p className="text-sm text-green-700 dark:text-green-400">
                    Parts pricing will be fetched from Mobilesentrix API during quote calculations.
                  </p>
                </div>
                
                {/* API Status Test */}
                <MobilesentrixApiTest />
                
                {/* Reauthorize Button */}
                {mobilesentrixAuthUrl?.authUrl && (
                  <div className="pt-3 border-t">
                    <p className="text-sm text-muted-foreground mb-2">
                      If you're getting authentication errors, you may need to reauthorize:
                    </p>
                    <Button 
                      variant="outline"
                      onClick={() => window.open(mobilesentrixAuthUrl.authUrl, '_blank')}
                      data-testid="button-mobilesentrix-reauthorize"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Reauthorize with Mobilesentrix
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
