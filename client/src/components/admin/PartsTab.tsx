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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, Loader2, Pencil, Search, Upload, ChevronLeft, ChevronRight } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Part } from "@shared/schema";

export function PartsTab({ toast }: { toast: ReturnType<typeof useToast>["toast"] }) {
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
      queryClient.invalidateQueries({ predicate: (query) => {
        const key = String(query.queryKey[0]);
        return key.startsWith('/api/parts') || key.startsWith('/api/supplier-parts');
      }});
      toast({ title: "All uploaded supplier parts cleared" });
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
          size="sm"
          onClick={() => setActiveSubTab("supplier")}
          data-testid="button-supplier-parts-tab"
        >
          Supplier
          {totalSupplierParts > 0 && <Badge variant="secondary" className="ml-1 text-[10px]">{totalSupplierParts.toLocaleString()}</Badge>}
        </Button>
        <Button
          variant={activeSubTab === "custom" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveSubTab("custom")}
          data-testid="button-custom-parts-tab"
        >
          Custom
          {totalCustomParts > 0 && <Badge variant="secondary" className="ml-1 text-[10px]">{totalCustomParts.toLocaleString()}</Badge>}
        </Button>
      </div>

      {/* Supplier Parts Tab - Excel Upload */}
      {activeSubTab === "supplier" && (
        <Card>
          <CardHeader className="flex flex-col gap-3 space-y-0 pb-4">
            <div>
              <CardTitle>Supplier Parts (Excel Upload)</CardTitle>
              <CardDescription>Upload parts pricing from Mobilesentrix Excel export. Use the Settings tab to toggle between API and Excel pricing.</CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative flex-1 min-w-0 sm:flex-none">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search SKU or name..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-full sm:w-[250px]"
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
                <Button asChild variant="outline" size="sm" disabled={uploading}>
                  <span>
                    {uploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
                    {uploading ? "Uploading..." : "Upload"}
                  </span>
                </Button>
              </label>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-destructive" data-testid="button-clear-supplier-parts">
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete All
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete all uploaded parts?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will remove all Excel-uploaded supplier parts. Custom parts will not be affected. You can re-upload the Excel file anytime.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => clearSupplierPartsMutation.mutate()}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      data-testid="button-confirm-clear-supplier-parts"
                    >
                      Delete All Uploaded Parts
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
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
          <CardHeader className="flex flex-col gap-3 space-y-0 pb-4">
            <div>
              <CardTitle>Custom Parts</CardTitle>
              <CardDescription>Parts you add here are preserved when bulk uploading from Excel</CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative flex-1 min-w-0 sm:flex-none">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search SKU or name..." 
                  value={customSearchQuery}
                  onChange={(e) => setCustomSearchQuery(e.target.value)}
                  className="pl-9 w-full sm:w-[200px]"
                  data-testid="input-search-custom-parts"
                />
              </div>
              <Dialog open={customOpen} onOpenChange={setCustomOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" data-testid="button-add-custom-part"><Plus className="h-4 w-4 mr-1" />Add Part</Button>
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
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" disabled={deleteMutation.isPending} data-testid={`button-delete-custom-part-${part.id}`}><Trash2 className="h-4 w-4" /></Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                  <AlertDialogDescription>This will permanently delete this custom part. This action cannot be undone.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deleteMutation.mutate(part.id)} data-testid={`confirm-delete-custom-part-${part.id}`}>Delete</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
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

