import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Building2, Plus, Settings, Trash2, LogOut, Eye, Store, Users, Package, Wrench } from "lucide-react";
import type { Shop } from "@shared/schema";

interface AuthResponse {
  authenticated: boolean;
  username: string;
  shopId: string | null;
  isSuperAdmin: boolean;
}

interface ShopStats {
  deviceTypes: number;
  brands: number;
  devices: number;
  services: number;
  parts: number;
  quoteRequests: number;
}

export default function SuperAdmin() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    domain: "",
    email: "",
    logoUrl: "",
    brandColor: "#3b82f6",
    openphoneApiKey: "",
    repairDeskApiKey: "",
  });

  const { data: auth, isLoading: authLoading } = useQuery<AuthResponse>({
    queryKey: ["/api/admin/me"],
    select: (data: any) => ({
      authenticated: data.isAdmin === true,
      username: data.username,
      shopId: data.shopId,
      isSuperAdmin: data.isSuperAdmin === true,
    }),
  });

  const { data: shops = [], isLoading: shopsLoading } = useQuery<Shop[]>({
    queryKey: ["/api/super-admin/shops"],
    enabled: auth?.isSuperAdmin === true,
  });

  const createShopMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest("POST", "/api/super-admin/shops", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/shops"] });
      setIsCreateOpen(false);
      resetForm();
      toast({ title: "Shop created", description: "New shop has been created successfully." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create shop", variant: "destructive" });
    },
  });

  const updateShopMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      return apiRequest("PATCH", `/api/super-admin/shops/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/shops"] });
      setIsEditOpen(false);
      setSelectedShop(null);
      resetForm();
      toast({ title: "Shop updated", description: "Shop settings have been saved." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update shop", variant: "destructive" });
    },
  });

  const deleteShopMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/super-admin/shops/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/shops"] });
      toast({ title: "Shop deleted", description: "Shop has been permanently deleted." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete shop", variant: "destructive" });
    },
  });

  const impersonateMutation = useMutation({
    mutationFn: async (shopId: string) => {
      return apiRequest("POST", `/api/super-admin/impersonate/${shopId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/auth"] });
      setLocation("/admin");
      toast({ title: "Impersonating shop", description: "You are now viewing the shop admin panel." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to impersonate shop", variant: "destructive" });
    },
  });

  const stopImpersonateMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/super-admin/stop-impersonate");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/auth"] });
      toast({ title: "Stopped impersonation", description: "You are back to super admin mode." });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/admin/logout");
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      setLocation("/admin");
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      slug: "",
      domain: "",
      email: "",
      logoUrl: "",
      brandColor: "#3b82f6",
      openphoneApiKey: "",
      repairDeskApiKey: "",
    });
  };

  const openEditDialog = (shop: Shop) => {
    setSelectedShop(shop);
    setFormData({
      name: shop.name,
      slug: shop.slug,
      domain: shop.domain || "",
      email: shop.email || "",
      logoUrl: shop.logoUrl || "",
      brandColor: shop.brandColor || "#3b82f6",
      openphoneApiKey: shop.openphoneApiKey || "",
      repairDeskApiKey: shop.repairDeskApiKey || "",
    });
    setIsEditOpen(true);
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!auth?.authenticated || !auth?.isSuperAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>You need super admin privileges to access this page.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setLocation("/admin")} data-testid="button-go-admin">
              Go to Admin Panel
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Building2 className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-semibold">Super Admin Dashboard</h1>
          </div>
          <div className="flex items-center gap-2">
            {auth.shopId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => stopImpersonateMutation.mutate()}
                data-testid="button-stop-impersonate"
              >
                <Eye className="h-4 w-4 mr-2" />
                Stop Impersonating
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocation("/admin")}
              data-testid="button-admin-panel"
            >
              <Settings className="h-4 w-4 mr-2" />
              Admin Panel
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => logoutMutation.mutate()}
              data-testid="button-logout"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="shops">
          <TabsList className="mb-6">
            <TabsTrigger value="shops" data-testid="tab-shops">
              <Store className="h-4 w-4 mr-2" />
              Shops
            </TabsTrigger>
          </TabsList>

          <TabsContent value="shops">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold">Manage Shops</h2>
                <p className="text-muted-foreground">Create and manage tenant shops</p>
              </div>
              <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-create-shop">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Shop
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Shop</DialogTitle>
                    <DialogDescription>Add a new tenant shop to the platform.</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="name">Shop Name</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="My Repair Shop"
                        data-testid="input-shop-name"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="slug">URL Slug</Label>
                      <Input
                        id="slug"
                        value={formData.slug}
                        onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })}
                        placeholder="my-repair-shop"
                        data-testid="input-shop-slug"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="email">Shop Email (required)</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="admin@myshop.com"
                        data-testid="input-shop-email"
                      />
                      <p className="text-xs text-muted-foreground">A temporary password will be sent to this email.</p>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="domain">Custom Domain (optional)</Label>
                      <Input
                        id="domain"
                        value={formData.domain}
                        onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                        placeholder="quotes.myshop.com"
                        data-testid="input-shop-domain"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="brandColor">Brand Color</Label>
                      <div className="flex gap-2">
                        <Input
                          id="brandColor"
                          type="color"
                          value={formData.brandColor}
                          onChange={(e) => setFormData({ ...formData, brandColor: e.target.value })}
                          className="w-16 h-10 p-1"
                          data-testid="input-brand-color"
                        />
                        <Input
                          value={formData.brandColor}
                          onChange={(e) => setFormData({ ...formData, brandColor: e.target.value })}
                          placeholder="#3b82f6"
                          data-testid="input-brand-color-text"
                        />
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                    <Button
                      onClick={() => createShopMutation.mutate(formData)}
                      disabled={!formData.name || !formData.slug || !formData.email || createShopMutation.isPending}
                      data-testid="button-confirm-create"
                    >
                      {createShopMutation.isPending ? "Creating..." : "Create Shop"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {shopsLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {shops.map((shop) => (
                  <ShopCard
                    key={shop.id}
                    shop={shop}
                    onEdit={() => openEditDialog(shop)}
                    onDelete={() => deleteShopMutation.mutate(shop.id)}
                    onImpersonate={() => impersonateMutation.mutate(shop.id)}
                    isDeleting={deleteShopMutation.isPending}
                  />
                ))}
                {shops.length === 0 && (
                  <Card className="col-span-full">
                    <CardContent className="py-12 text-center text-muted-foreground">
                      No shops yet. Create your first shop to get started.
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Shop: {selectedShop?.name}</DialogTitle>
              <DialogDescription>Update shop settings and configuration.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-name">Shop Name</Label>
                  <Input
                    id="edit-name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    data-testid="input-edit-name"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-slug">URL Slug</Label>
                  <Input
                    id="edit-slug"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })}
                    data-testid="input-edit-slug"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-domain">Custom Domain</Label>
                <Input
                  id="edit-domain"
                  value={formData.domain}
                  onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                  placeholder="quotes.myshop.com"
                  data-testid="input-edit-domain"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-logo">Logo URL</Label>
                <Input
                  id="edit-logo"
                  value={formData.logoUrl}
                  onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
                  placeholder="https://..."
                  data-testid="input-edit-logo"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-color">Brand Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="edit-color"
                    type="color"
                    value={formData.brandColor}
                    onChange={(e) => setFormData({ ...formData, brandColor: e.target.value })}
                    className="w-16 h-10 p-1"
                    data-testid="input-edit-color"
                  />
                  <Input
                    value={formData.brandColor}
                    onChange={(e) => setFormData({ ...formData, brandColor: e.target.value })}
                    data-testid="input-edit-color-text"
                  />
                </div>
              </div>
              <div className="border-t pt-4 mt-2">
                <h3 className="font-semibold mb-3">API Integrations</h3>
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-openphone">OpenPhone API Key</Label>
                    <Input
                      id="edit-openphone"
                      type="password"
                      value={formData.openphoneApiKey}
                      onChange={(e) => setFormData({ ...formData, openphoneApiKey: e.target.value })}
                      placeholder="Enter OpenPhone API key"
                      data-testid="input-edit-openphone"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-repairdesk">RepairDesk API Key</Label>
                    <Input
                      id="edit-repairdesk"
                      type="password"
                      value={formData.repairDeskApiKey}
                      onChange={(e) => setFormData({ ...formData, repairDeskApiKey: e.target.value })}
                      placeholder="Enter RepairDesk API key"
                      data-testid="input-edit-repairdesk"
                    />
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
              <Button
                onClick={() => selectedShop && updateShopMutation.mutate({ id: selectedShop.id, data: formData })}
                disabled={!formData.name || !formData.slug || updateShopMutation.isPending}
                data-testid="button-save-shop"
              >
                {updateShopMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}

function ShopCard({
  shop,
  onEdit,
  onDelete,
  onImpersonate,
  isDeleting,
}: {
  shop: Shop;
  onEdit: () => void;
  onDelete: () => void;
  onImpersonate: () => void;
  isDeleting: boolean;
}) {
  const { data: stats } = useQuery<ShopStats>({
    queryKey: ["/api/super-admin/shops", shop.id, "stats"],
    enabled: !!shop.id,
  });

  const isDefaultShop = shop.id === "default-shop";

  return (
    <Card className="hover-elevate" data-testid={`card-shop-${shop.id}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            {shop.logoUrl ? (
              <img src={shop.logoUrl} alt={shop.name} className="w-10 h-10 rounded object-cover" />
            ) : (
              <div
                className="w-10 h-10 rounded flex items-center justify-center text-white font-bold"
                style={{ backgroundColor: shop.brandColor || "#3b82f6" }}
              >
                {shop.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <CardTitle className="text-lg">{shop.name}</CardTitle>
              <CardDescription className="text-sm">/{shop.slug}</CardDescription>
            </div>
          </div>
          {isDefaultShop && <Badge variant="secondary">Default</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {shop.domain && (
          <p className="text-sm text-muted-foreground truncate">{shop.domain}</p>
        )}

        {stats && (
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-muted rounded p-2">
              <div className="text-lg font-semibold">{stats.devices}</div>
              <div className="text-xs text-muted-foreground">Devices</div>
            </div>
            <div className="bg-muted rounded p-2">
              <div className="text-lg font-semibold">{stats.services}</div>
              <div className="text-xs text-muted-foreground">Services</div>
            </div>
            <div className="bg-muted rounded p-2">
              <div className="text-lg font-semibold">{stats.quoteRequests}</div>
              <div className="text-xs text-muted-foreground">Quotes</div>
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={onImpersonate}
            data-testid={`button-impersonate-${shop.id}`}
          >
            <Eye className="h-4 w-4 mr-1" />
            View
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={onEdit}
            data-testid={`button-edit-${shop.id}`}
          >
            <Settings className="h-4 w-4 mr-1" />
            Edit
          </Button>
          {!isDefaultShop && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive"
                  disabled={isDeleting}
                  data-testid={`button-delete-${shop.id}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Shop?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete "{shop.name}" and all its data including devices, services, parts, and quotes. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={onDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    data-testid="button-confirm-delete"
                  >
                    Delete Shop
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
