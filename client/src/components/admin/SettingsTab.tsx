import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { AlertCircle, AlertTriangle, Check, Database, DollarSign, ExternalLink, EyeOff, Layers, Link2, Loader2, Lock, Mail, MessageSquare, RefreshCw, Search, Users } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Device, Service, DeviceServiceWithRelations, MessageTemplate } from "@shared/schema";

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
                className="flex flex-col sm:flex-row sm:items-center justify-between text-sm py-2 px-3 bg-muted/50 rounded-md border gap-2"
                data-testid={`dismissed-alert-${alert.deviceServiceId}`}
              >
                <div className="flex-1 min-w-0">
                  <span className="font-medium">{alert.deviceName}</span>
                  <span className="text-muted-foreground"> ({alert.brandName})</span>
                  <span className="mx-1 sm:mx-2">→</span>
                  <span>{alert.serviceName}</span>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="self-end sm:self-auto shrink-0"
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

interface SkuValidationResult {
  sku: string;
  error?: string;
  affectedLinks: Array<{
    id: string;
    deviceName: string;
    brandName: string;
    serviceName: string;
    isPrimary: boolean;
  }>;
}

function SkuValidationCard() {
  const [isValidating, setIsValidating] = useState(false);
  const [progress, setProgress] = useState<{ checked: number; total: number; missing: SkuValidationResult[]; errors: string[] } | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  const startPolling = () => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const pollRes = await fetch('/api/mobilesentrix/validate-skus/progress', { credentials: 'include' });
        if (pollRes.ok) {
          const pollData = await pollRes.json();
          setProgress({ checked: pollData.checked, total: pollData.total, missing: pollData.missing, errors: pollData.errors });
          if (!pollData.inProgress && pollData.total > 0) {
            setIsValidating(false);
            stopPolling();
          }
        }
      } catch {}
    }, 2000);
  };

  const startValidation = async () => {
    setIsValidating(true);
    setProgress(null);
    try {
      const res = await fetch('/api/mobilesentrix/validate-skus', { method: 'POST', credentials: 'include' });
      if (res.status === 409) {
        setProgress(null);
        startPolling();
        return;
      }
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: `Request failed (${res.status})` }));
        setProgress({ checked: 0, total: 0, missing: [], errors: [errData.error || 'Failed to start validation'] });
        setIsValidating(false);
        return;
      }
      const data = await res.json();
      if (data.started) {
        setProgress({ checked: 0, total: data.total, missing: [], errors: [] });
        startPolling();
      } else if (data.total === 0) {
        setProgress({ checked: 0, total: 0, missing: [], errors: [] });
        setIsValidating(false);
      }
    } catch (error: any) {
      setProgress({ checked: 0, total: 0, missing: [], errors: [error.message || 'Failed to start validation'] });
      setIsValidating(false);
    }
  };

  const progressPercent = progress && progress.total > 0 ? Math.round((progress.checked / progress.total) * 100) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          SKU Validation
        </CardTitle>
        <CardDescription>Check all service link SKUs against the Mobilesentrix API to find parts that no longer exist</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Button
            onClick={startValidation}
            disabled={isValidating}
            data-testid="button-validate-skus"
          >
            {isValidating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Validating...
              </>
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" />
                Validate All SKUs
              </>
            )}
          </Button>
          {progress && progress.total > 0 && (
            <span className="text-sm text-muted-foreground">
              {progress.checked} / {progress.total} SKUs checked ({progressPercent}%)
            </span>
          )}
        </div>

        {isValidating && progress && progress.total > 0 && (
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        )}

        {progress && !isValidating && progress.total > 0 && (
          <div className="space-y-3">
            {progress.missing.length === 0 && progress.errors.length === 0 ? (
              <div className="p-3 rounded-lg border bg-green-50 dark:bg-green-900/20">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <p className="text-sm text-green-700 dark:text-green-400">
                    All {progress.total} SKUs verified - every part exists on Mobilesentrix
                  </p>
                </div>
              </div>
            ) : (
              <>
                {progress.missing.length > 0 && (
                  <div className="border border-orange-500/50 bg-orange-500/5 rounded-md p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <AlertTriangle className="h-5 w-5 text-orange-600" />
                      <h4 className="font-semibold text-orange-600">
                        {progress.missing.length} SKU{progress.missing.length !== 1 ? "s" : ""} Not Found on Mobilesentrix
                      </h4>
                    </div>
                    <div className="max-h-64 overflow-y-auto space-y-2">
                      {progress.missing.map((item) => (
                        <div key={item.sku} className="p-2 bg-background rounded border">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="font-mono text-xs">{item.sku}</Badge>
                            {item.error && <span className="text-xs text-destructive">{item.error}</span>}
                          </div>
                          <div className="text-xs text-muted-foreground space-y-0.5">
                            {item.affectedLinks.map((link) => (
                              <div key={`${item.sku}-${link.id}`}>
                                {link.brandName} {link.deviceName} / {link.serviceName}
                                {!link.isPrimary && <span className="text-orange-600 ml-1">(alt part)</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {progress.errors.length > 0 && (
                  <div className="p-3 rounded-lg border bg-destructive/5">
                    <p className="text-sm font-medium text-destructive mb-1">API Errors:</p>
                    {progress.errors.map((err, i) => (
                      <p key={i} className="text-xs text-destructive">{err}</p>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {progress && !isValidating && progress.total === 0 && (
          <div className="p-3 rounded-lg border bg-muted/50">
            <p className="text-sm text-muted-foreground">No SKUs found in service links to validate.</p>
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

function MobilesentrixSkuLookup() {
  const [sku, setSku] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState<{ found: boolean; sku?: string; name?: string; price?: number; inStock?: boolean; error?: string } | null>(null);

  const handleLookup = async () => {
    const trimmed = sku.trim();
    if (!trimmed) return;
    setIsSearching(true);
    setResult(null);
    try {
      const response = await fetch(`/api/mobilesentrix/sku/${encodeURIComponent(trimmed)}`, { credentials: 'include' });
      const data = await response.json();
      if (response.ok) {
        setResult(data);
      } else {
        setResult({ found: false, error: data.error || "Product not found" });
      }
    } catch {
      setResult({ found: false, error: "Failed to connect to API" });
    }
    setIsSearching(false);
  };

  return (
    <div className="p-3 rounded-lg border bg-muted/50 space-y-3">
      <p className="text-sm font-medium">SKU Lookup</p>
      <div className="flex gap-2">
        <Input
          placeholder="Enter SKU (e.g. 107182117424)"
          value={sku}
          onChange={(e) => setSku(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleLookup(); } }}
          className="h-9"
          data-testid="input-sku-lookup"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={handleLookup}
          disabled={isSearching || !sku.trim()}
          className="shrink-0 h-9"
          data-testid="button-sku-lookup"
        >
          {isSearching ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Search className="h-3 w-3" />
          )}
        </Button>
      </div>

      {result && (
        result.found ? (
          <div className="p-3 rounded border bg-background space-y-2">
            <p className="text-sm font-medium">{result.name}</p>
            <div className="flex flex-wrap gap-3 text-sm">
              <span>SKU: <code className="bg-muted px-1 py-0.5 rounded text-xs">{result.sku}</code></span>
              <span>Price: <span className="font-semibold text-primary">${result.price?.toFixed(2)}</span></span>
              <Badge variant={result.inStock ? "secondary" : "destructive"} className={result.inStock ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : ""}>
                {result.inStock ? "In Stock" : "Out of Stock"}
              </Badge>
            </div>
          </div>
        ) : (
          <div className="p-2 rounded text-sm bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{result.error}</span>
          </div>
        )
      )}
    </div>
  );
}

export function SettingsTab({ toast }: { toast: ReturnType<typeof useToast>["toast"] }) {
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

  // API Excel Fallback Setting
  const { data: apiExcelFallbackSettings } = useQuery<{ enabled: boolean }>({
    queryKey: ["/api/settings/api-excel-fallback"],
  });

  const updateApiExcelFallback = useMutation({
    mutationFn: async (enabled: boolean) => {
      await apiRequest("POST", "/api/settings/api-excel-fallback", { enabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/api-excel-fallback"] });
      toast({ title: "Excel fallback setting updated" });
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
      if (enabled) {
        await apiRequest("POST", "/api/settings/hide-prices-completely", { enabled: false });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/hide-prices-until-contact"] });
      queryClient.invalidateQueries({ queryKey: ["/api/settings/hide-prices-completely"] });
      queryClient.invalidateQueries({ queryKey: ["/api/settings/quote-flow"] });
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
      if (enabled) {
        await apiRequest("POST", "/api/settings/hide-prices-until-contact", { enabled: false });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/hide-prices-completely"] });
      queryClient.invalidateQueries({ queryKey: ["/api/settings/hide-prices-until-contact"] });
      queryClient.invalidateQueries({ queryKey: ["/api/settings/quote-flow"] });
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
      <TabsList className="grid grid-cols-2 sm:flex sm:flex-wrap gap-1 h-auto w-full sm:w-auto">
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
            <div className="flex items-center justify-between gap-4 p-3 rounded-lg border">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">Enable Multi-Service Discount</p>
                <p className="text-xs text-muted-foreground">Apply discount when 2+ eligible services are selected</p>
              </div>
              <Switch
                className="shrink-0"
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
            {pricingSourceSettings?.source === "mobilesentrix_api" && (
              <div className="flex items-center justify-between gap-4 p-3 rounded-lg border mt-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">Excel Fallback</p>
                  <p className="text-xs text-muted-foreground">When API is unavailable, fall back to Excel-uploaded prices</p>
                </div>
                <Switch
                  className="shrink-0"
                  data-testid="switch-api-excel-fallback"
                  checked={apiExcelFallbackSettings?.enabled ?? true}
                  onCheckedChange={(checked) => updateApiExcelFallback.mutate(checked)}
                />
              </div>
            )}
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
            <div className="flex items-center justify-between gap-4 p-3 rounded-lg border">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">Hide Prices Completely</p>
                <p className="text-xs text-muted-foreground">Prices are hidden on the website but shown in the SMS/email sent to customers</p>
              </div>
              <Switch
                className="shrink-0"
                checked={hidePricesCompletelySettings?.enabled ?? false}
                onCheckedChange={(checked) => updateHidePricesCompletely.mutate(checked)}
                disabled={updateHidePricesCompletely.isPending}
                data-testid="switch-hide-prices-completely"
              />
            </div>
            <div className="flex items-center justify-between gap-4 p-3 rounded-lg border">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">Require Contact Info Before Showing Prices</p>
                <p className="text-xs text-muted-foreground">When enabled, customers must enter their contact details before seeing prices</p>
              </div>
              <Switch
                className="shrink-0"
                checked={hidePricesSettings?.enabled ?? false}
                onCheckedChange={(checked) => updateHidePrices.mutate(checked)}
                disabled={updateHidePrices.isPending}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {macros.map((macro) => (
                <div key={macro.name} className="text-xs" data-testid={`macro-${macro.name}`}>
                  <code className="bg-muted px-1 py-0.5 rounded font-semibold">{macro.name}</code>
                  <span className="text-muted-foreground ml-1">{macro.description}</span>
                </div>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 mb-4">
              {serviceItemMacros.map((macro) => (
                <div key={macro.name} className="text-xs">
                  <code className="bg-muted px-1 py-0.5 rounded font-semibold">{macro.name}</code>
                  <span className="text-muted-foreground ml-1">{macro.description}</span>
                </div>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 mb-4">
              {serviceItemMacros.map((macro) => (
                <div key={macro.name} className="text-xs">
                  <code className="bg-muted px-1 py-0.5 rounded font-semibold">{macro.name}</code>
                  <span className="text-muted-foreground ml-1">{macro.description}</span>
                </div>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 mb-4">
              {unknownDeviceMacros.map((macro) => (
                <div key={macro.name} className="text-xs">
                  <code className="bg-muted px-1 py-0.5 rounded font-semibold">{macro.name}</code>
                  <span className="text-muted-foreground ml-1">{macro.description}</span>
                </div>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 mb-4">
              {unknownDeviceMacros.map((macro) => (
                <div key={macro.name} className="text-xs">
                  <code className="bg-muted px-1 py-0.5 rounded font-semibold">{macro.name}</code>
                  <span className="text-muted-foreground ml-1">{macro.description}</span>
                </div>
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
                <div className="flex flex-col sm:flex-row gap-2">
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
                    className="shrink-0"
                    data-testid="button-send-test-email"
                  >
                    {testEmailMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
                    Send Test
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Send a test email with sample quote data to verify your email templates.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="test-phone">Test Phone Number</Label>
                <div className="flex flex-col sm:flex-row gap-2">
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
                    className="shrink-0"
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
              <div className="flex items-center justify-between gap-4 p-3 rounded-lg border">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">Show Stock Status</p>
                  <p className="text-xs text-muted-foreground">Display "In Stock" / "Parts order may be required" on quotes</p>
                </div>
                <Switch
                  className="shrink-0"
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
            <div className="flex items-center justify-between gap-4 p-3 rounded-lg border">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">Create Lead on Quote Request</p>
                <p className="text-xs text-muted-foreground">When enabled, a lead will be created in RepairDesk for each quote submitted</p>
              </div>
              <Switch
                className="shrink-0"
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg border">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">Sync Status</p>
                <p className="text-xs text-muted-foreground">
                  {repairDeskSyncStatus?.linkedServicesCount || 0} device-service links configured with RepairDesk IDs
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
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
                    <div key={sync.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-2 text-xs border rounded gap-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={sync.status === "success" ? "secondary" : sync.status === "partial" ? "outline" : "destructive"} className="text-[10px]">
                          {sync.status}
                        </Badge>
                        <span>{sync.syncedServices}/{sync.totalServices} synced</span>
                        <span className="text-muted-foreground">({sync.syncType})</span>
                      </div>
                      <span className="text-muted-foreground shrink-0">
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
            <div className="flex flex-wrap items-center gap-2">
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
                  <span className="text-xs sm:text-sm text-muted-foreground">
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

                {/* SKU Lookup */}
                <MobilesentrixSkuLookup />
                
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

        {mobilesentrixStatus?.configured && <SkuValidationCard />}
      </TabsContent>
    </Tabs>
  );
}
