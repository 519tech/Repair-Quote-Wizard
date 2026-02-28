import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Wrench, ArrowLeft, LogOut, Lock } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/theme-toggle";
import { SubmissionsTab } from "@/components/admin/SubmissionsTab";
import { DeviceTypesTab, BrandsTab } from "@/components/admin/DeviceTypesTab";
import { DevicesTab } from "@/components/admin/DevicesTab";
import { ServiceCategoriesTab, ServicesListTab } from "@/components/admin/ServiceCategoriesTab";
import { PartsTab } from "@/components/admin/PartsTab";
import { DeviceServicesTab } from "@/components/admin/DeviceServicesTab";
import { SettingsTab } from "@/components/admin/SettingsTab";

export default function Admin() {
  useEffect(() => {
    document.title = "Admin Panel | 519 Tech Services";
  }, []);
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
          <TabsList className="grid grid-cols-3 sm:flex sm:flex-wrap gap-1 h-auto w-full sm:w-auto">
            <TabsTrigger value="device-types" className="text-xs sm:text-sm px-2 sm:px-3" data-testid="tab-device-types">Types</TabsTrigger>
            <TabsTrigger value="brands" className="text-xs sm:text-sm px-2 sm:px-3" data-testid="tab-brands">Brands</TabsTrigger>
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

          <TabsContent value="brands">
            <BrandsTab toast={toast} />
          </TabsContent>
          
          <TabsContent value="devices">
            <DevicesTab toast={toast} />
          </TabsContent>

          <TabsContent value="categories">
            <ServiceCategoriesTab toast={toast} />
          </TabsContent>

          <TabsContent value="services">
            <ServicesListTab toast={toast} />
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
