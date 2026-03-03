import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { ChevronRight, ChevronLeft, Check, CheckCircle, Loader2, Search, X, Wrench, HelpCircle, Settings, Package, Mail, Plus, Smartphone, Tablet, Laptop, Monitor, Gamepad2, Watch, Headphones, Camera, Tv, Speaker, Printer, Keyboard, Mouse, Router, HardDrive, MemoryStick, Cpu, Battery, Cable, PenTool, CircleHelp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import type { MessageTemplate } from "@shared/schema";
import { useQuoteWizard } from "@/hooks/use-quote-wizard";

export default function Home() {
  const { data: adminAuth } = useQuery<{ isAdmin: boolean }>({
    queryKey: ["/api/admin/auth"],
  });

  const { data: quoteFlowSettings } = useQuery<{
    multiDiscount: { enabled: boolean; amount: number };
    hidePricesUntilContact: boolean;
    hidePricesCompletely: boolean;
    pricingSource: string;
    partsLastUpdated: MessageTemplate | null;
    quoteValidDays: number;
  }>({
    queryKey: ["/api/settings/quote-flow"],
  });

  const multiDiscountSettings = quoteFlowSettings?.multiDiscount;
  const hidePricesUntilContact = quoteFlowSettings?.hidePricesUntilContact ?? false;
  const hidePricesCompletely = quoteFlowSettings?.hidePricesCompletely ?? false;
  const pricingSource = quoteFlowSettings?.pricingSource ?? "excel_upload";
  const partsLastUpdated = quoteFlowSettings?.partsLastUpdated;

  const w = useQuoteWizard({
    multiDiscountSettings,
    hidePricesUntilContact,
    hidePricesCompletely,
    pricingSource,
    partsLastUpdated,
  });

  return (
    <main className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <div className="max-w-3xl mx-auto space-y-4">

        {adminAuth?.isAdmin && (
          <div className="flex justify-end">
            <Link href="/admin">
              <Button variant="outline" size="sm" data-testid="button-admin">
                <Settings className="h-4 w-4 mr-2" aria-hidden="true" />
                Admin
              </Button>
            </Link>
          </div>
        )}

        {w.view === 'search' && (
          <SearchView w={w} />
        )}

        {w.view === 'services' && (
          <ServicesView w={w} hidePricesUntilContact={hidePricesUntilContact} hidePricesCompletely={hidePricesCompletely} />
        )}

        {w.view === 'quote' && (
          <QuoteView w={w} hidePricesCompletely={hidePricesCompletely} hidePricesUntilContact={hidePricesUntilContact} quoteValidDays={quoteFlowSettings?.quoteValidDays ?? 7} />
        )}

        {w.view === 'contact' && (
          <ContactView w={w} hidePricesUntilContact={hidePricesUntilContact} hidePricesCompletely={hidePricesCompletely} />
        )}

        {w.view === 'unknown' && (
          <UnknownDeviceView w={w} />
        )}

        {w.view === 'success' && (
          <SuccessView w={w} />
        )}

        <div className="pt-4 text-xs text-muted-foreground text-center space-y-1">
          <p>The prices shown are estimates and may change. A final quote will be confirmed after in-store inspection.</p>
          <p>
            Prices last updated:{" "}
            {pricingSource === "mobilesentrix_api" ? (
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                <span className="text-green-600 dark:text-green-400 font-medium">Live</span>
              </span>
            ) : partsLastUpdated?.content ? (
              w.formatLastUpdated(partsLastUpdated.content)
            ) : (
              "Not available"
            )}
          </p>
        </div>
      </div>
    </main>
  );
}

type WizardProps = { w: ReturnType<typeof useQuoteWizard> };

function SearchView({ w }: WizardProps) {
  return (
    <Card>
      <CardHeader className="text-center">
        <img
          src="https://519techservices.ca/cdn/shop/files/519_Tech_Services_Logo_2022_2k.png?v=1692217647&width=400"
          alt="519 Tech Services - Device Repair Specialists"
          className="h-16 w-auto mx-auto mb-2"
        />
        <h1 className="text-lg font-semibold leading-none tracking-tight text-pretty">Get a Repair Quote</h1>
        <CardDescription className="text-xs">Search for your device to get instant pricing</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!w.pickerTypeId && (
          <>
            <div className="relative" role="search">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <Input
                placeholder="Search your device model…"
                value={w.searchQuery}
                onChange={(e) => { w.setSearchQuery(e.target.value); w.setShowSearch(true); }}
                onFocus={() => w.setShowSearch(true)}
                className="pl-9 pr-10 h-12 text-base"
                name="device-search"
                autoComplete="off"
                data-testid="input-device-search"
                aria-label="Search for your device model"
              />
              {w.searchQuery && (
                <div className="absolute right-0 top-0 h-full flex items-center pr-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={w.clearSearch}
                    aria-label="Clear search"
                    data-testid="button-clear-search"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            {w.showSearch && w.searchQuery.length >= 2 && (
              <div className="border rounded-md max-h-64 overflow-y-auto">
                {w.searchLoading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" />
                  </div>
                ) : w.searchResults.length === 0 ? (
                  <div className="text-center py-4">
                    <button
                      type="button"
                      onClick={() => { w.setShowSearch(false); w.setView('unknown'); }}
                      className="text-sm text-primary hover:underline"
                      data-testid="link-device-not-listed"
                    >
                      Your device not listed?
                    </button>
                  </div>
                ) : (
                  <div className="p-1 space-y-1">
                    {w.searchResults.map(device => (
                      <Button
                        key={device.id}
                        variant="ghost"
                        className="w-full justify-start text-left h-auto py-3 hover-elevate"
                        onClick={() => w.handleSelectDevice(device)}
                        data-testid={`device-result-${device.id}`}
                      >
                        <div>
                          <div className="font-medium">{device.name}</div>
                        </div>
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {!(w.showSearch && w.searchQuery.length >= 2) && (
          <PickerFlow w={w} />
        )}

        {!w.selectedDevice && (
          <div className="pt-4 border-t">
            <Button
              variant="default"
              className="w-full"
              onClick={() => w.setView('unknown')}
              data-testid="button-unknown-device"
            >
              <HelpCircle className="h-4 w-4 mr-2" aria-hidden="true" />
              I don't know what device I have
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PickerFlow({ w }: WizardProps) {
  return (
    <div className="space-y-3">
      {(w.pickerTypeId || w.pickerBrandId) && (
        <div className="flex items-center gap-1 text-sm text-muted-foreground flex-wrap">
          <button
            type="button"
            className="hover:text-foreground transition-colors"
            onClick={() => { w.setPickerTypeId(null); w.setPickerBrandId(null); }}
            data-testid="picker-nav-types"
          >
            Device Type
          </button>
          {w.pickerTypeId && (
            <>
              <ChevronRight className="h-3 w-3" aria-hidden="true" />
              <button
                type="button"
                className="hover:text-foreground transition-colors"
                onClick={() => { w.setPickerBrandId(null); }}
                data-testid="picker-nav-brands"
              >
                {w.pickerDeviceTypes.find(t => t.id === w.pickerTypeId)?.name || "Brand"}
              </button>
            </>
          )}
          {w.pickerBrandId && (
            <>
              <ChevronRight className="h-3 w-3" aria-hidden="true" />
              <span className="text-foreground">
                {w.pickerBrands.find(b => b.id === w.pickerBrandId)?.name || "Model"}
              </span>
            </>
          )}
        </div>
      )}

      {!w.pickerTypeId && (
        <>
          <p className="text-sm text-muted-foreground text-center">Or browse by category</p>
          <div className="grid grid-cols-2 gap-2">
            {w.pickerDeviceTypes.map(type => {
              const IconComponent = {
                smartphone: Smartphone, tablet: Tablet, laptop: Laptop, desktop: Monitor,
                gaming: Gamepad2, watch: Watch, headphones: Headphones, camera: Camera,
                tv: Tv, speaker: Speaker, printer: Printer, keyboard: Keyboard,
                mouse: Mouse, router: Router, harddrive: HardDrive, memory: MemoryStick,
                cpu: Cpu, battery: Battery, cable: Cable, tool: PenTool, other: CircleHelp,
              }[type.icon] || Smartphone;
              return (
                <button
                  key={type.id}
                  type="button"
                  className="flex flex-col items-center gap-2 p-3 rounded-lg border transition-all hover:border-primary/50 hover-elevate"
                  onClick={() => w.handlePickerTypeClick(type.id, type.name)}
                  data-testid={`picker-type-${type.id}`}
                >
                  {type.imageUrl ? (
                    <img src={type.imageUrl} alt={type.name} className="h-10 w-10 object-contain" loading="lazy" />
                  ) : (
                    <IconComponent className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
                  )}
                  <span className="text-sm font-medium text-center">{type.name}</span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {w.pickerTypeId && !w.pickerBrandId && (
        <>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => w.setPickerTypeId(null)} aria-label="Back to device types" data-testid="picker-back-to-types">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <p className="text-sm font-medium">Select a brand</p>
          </div>
          {w.pickerBrandsLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : w.pickerBrands.length === 0 ? (
            <p className="text-center py-6 text-sm text-muted-foreground">No brands found for this category</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {w.pickerBrands.map(brand => (
                <button
                  key={brand.id}
                  type="button"
                  className="flex flex-col items-center gap-2 p-3 rounded-lg border transition-all hover:border-primary/50 hover-elevate"
                  onClick={() => w.setPickerBrandId(brand.id)}
                  data-testid={`picker-brand-${brand.id}`}
                >
                  {brand.logo ? (
                    <img src={brand.logo} alt={brand.name} className="h-10 w-10 object-contain" loading="lazy" />
                  ) : (
                    <div className="h-10 w-10 bg-muted rounded-md flex items-center justify-center text-lg font-bold text-muted-foreground">
                      {brand.name.charAt(0)}
                    </div>
                  )}
                  <span className="text-sm font-medium text-center">{brand.name}</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {w.pickerTypeId && w.pickerBrandId && (
        <>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => w.setPickerBrandId(null)} aria-label="Back to brands" data-testid="picker-back-to-brands">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <p className="text-sm font-medium">Select your model</p>
          </div>
          {w.pickerDevicesLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : w.pickerDevices.length === 0 ? (
            <p className="text-center py-6 text-sm text-muted-foreground">No models found</p>
          ) : (
            <div className="border rounded-md max-h-64 overflow-y-auto">
              <div className="p-1 space-y-1">
                {w.pickerDevices.map(device => (
                  <Button
                    key={device.id}
                    variant="ghost"
                    className="w-full justify-start text-left h-auto py-3 hover-elevate"
                    onClick={() => w.handleSelectDevice(device)}
                    data-testid={`picker-device-${device.id}`}
                  >
                    <div className="flex items-center gap-3">
                      {device.imageUrl ? (
                        <img src={device.imageUrl} alt={device.name} className="h-8 w-8 object-contain rounded" loading="lazy" />
                      ) : null}
                      <span className="font-medium">{device.name}</span>
                    </div>
                  </Button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ServicesView({ w, hidePricesUntilContact, hidePricesCompletely }: WizardProps & { hidePricesUntilContact: boolean; hidePricesCompletely: boolean }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          {w.selectedDevice && (
            <div className="shrink-0">
              {w.selectedDevice.imageUrl ? (
                <img
                  src={w.selectedDevice.imageUrl}
                  alt={w.selectedDevice.name}
                  className="w-12 h-12 object-contain rounded-lg bg-muted p-1"
                  loading="lazy"
                />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                  <Wrench className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                </div>
              )}
            </div>
          )}
          <div className="flex-1 min-w-0">
            {w.selectedDevice && (
              <p className="text-xs text-muted-foreground mb-1">
                {w.selectedDevice.brand?.name && <span>{w.selectedDevice.brand.name} </span>}
                <span className="font-medium text-foreground">{w.selectedDevice.name}</span>
              </p>
            )}
            <CardTitle className="text-base text-pretty">
              {w.selectedCategoryId ? "Compare Options" : "Select Repair Category"}
            </CardTitle>
            <CardDescription className="text-xs">
              {w.selectedCategoryId ? "Choose your preferred service" : "What needs to be fixed?"}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-2 mb-4">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              if (w.selectedCategoryId) {
                w.setSelectedCategoryId(null);
              } else {
                w.resetForm();
              }
            }}
            data-testid="button-back-services"
          >
            Back
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              w.resetForm();
            }}
            data-testid="button-start-over"
          >
            <X className="h-4 w-4 mr-1" aria-hidden="true" />
            Start over
          </Button>
        </div>

        {w.servicesLoading || w.quotesLoading || w.categoryLoading ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-full border-4 border-muted animate-pulse" />
              <Loader2 className="absolute inset-0 m-auto h-8 w-8 animate-spin text-primary" aria-hidden="true" />
            </div>
            <p className="text-sm text-muted-foreground animate-pulse">
              {w.categoryLoading ? "Loading repair options…" : "Loading services…"}
            </p>
          </div>
        ) : !w.selectedCategoryId && w.categories.length > 0 ? (
          <div className="space-y-3">
            {w.categories.map(cat => {
              const catQuotes = w.allQuotes.filter(q => q.categoryId === cat.id);
              const hasServices = catQuotes.length > 0;
              const availableQuotes = catQuotes.filter(q => q.isAvailable);
              const lowestPrice = availableQuotes.length > 0 ? Math.min(...availableQuotes.map(q => parseFloat(q.price))) : null;
              return (
                <div
                  key={cat.id}
                  className="p-3 rounded-lg border transition-all cursor-pointer hover:border-primary/50 hover-elevate"
                  onClick={() => w.handleCategorySelect(cat.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); w.handleCategorySelect(cat.id); } }}
                  role="button"
                  tabIndex={0}
                  data-testid={`category-${cat.id}`}
                >
                  <div className="flex items-center gap-3">
                    {cat.imageUrl ? (
                      <img
                        src={cat.imageUrl}
                        alt={cat.name}
                        className="w-12 h-12 object-contain rounded-lg bg-muted p-1 shrink-0"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <Wrench className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-2">
                        <p className="font-medium">{cat.name}</p>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {hasServices ? `${catQuotes.length} option${catQuotes.length > 1 ? 's' : ''}` : 'Request Quote'}
                        </span>
                      </div>
                      {cat.description && (
                        <p className="text-xs text-muted-foreground mt-1">{cat.description}</p>
                      )}
                      {lowestPrice !== null && (
                        <p className="text-xs text-primary font-medium mt-1" data-testid={`text-starting-price-${cat.id}`}>Starting from ${lowestPrice.toFixed(2)}</p>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
                  </div>
                </div>
              );
            })}
            {w.allQuotes.filter(q => !q.categoryId).length > 0 && (
              <div
                className="p-3 rounded-lg border transition-all cursor-pointer hover:border-primary/50 hover-elevate"
                onClick={() => w.handleCategorySelect("other")}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); w.handleCategorySelect("other"); } }}
                role="button"
                tabIndex={0}
                data-testid="category-other"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Wrench className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-2">
                      <p className="font-medium">Other Services</p>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {w.allQuotes.filter(q => !q.categoryId).length} option{w.allQuotes.filter(q => !q.categoryId).length > 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
                </div>
              </div>
            )}

            <div
              className="p-3 rounded-lg border border-dashed transition-all cursor-pointer hover:border-primary/50 hover-elevate"
              onClick={w.handleNotListedClick}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); w.handleNotListedClick(); } }}
              role="button"
              tabIndex={0}
              data-testid="category-not-listed"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <HelpCircle className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium">Other / Not Listed</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Describe your issue and we'll provide a custom quote
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
              </div>
            </div>
          </div>
        ) : (
          <ServicesList w={w} hidePricesUntilContact={hidePricesUntilContact} hidePricesCompletely={hidePricesCompletely} />
        )}
      </CardContent>
    </Card>
  );
}

function ServicesList({ w, hidePricesUntilContact, hidePricesCompletely }: WizardProps & { hidePricesUntilContact: boolean; hidePricesCompletely: boolean }) {
  return (
    <div className="space-y-3">
      {(w.selectedCategoryId === "other"
        ? w.allQuotes.filter(q => !q.categoryId)
        : w.sortedQuotes
      ).map(quote => (
        <div
          key={quote.serviceId}
          onClick={() => w.toggleServiceSelection(quote.serviceId)}
          onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && quote.isAvailable) { e.preventDefault(); w.toggleServiceSelection(quote.serviceId); } }}
          role="button"
          tabIndex={quote.isAvailable ? 0 : -1}
          className={`p-3 rounded-lg border transition-all cursor-pointer ${
            !quote.isAvailable
              ? 'opacity-50 cursor-not-allowed'
              : w.selectedServices.has(quote.serviceId)
                ? 'border-primary bg-primary/5'
                : 'hover:border-primary/50'
          }`}
          data-testid={`service-${quote.serviceId}`}
        >
          <div className="flex items-start gap-3">
            <Checkbox
              checked={w.selectedServices.has(quote.serviceId)}
              disabled={!quote.isAvailable}
              className="mt-1"
            />
            {quote.serviceImageUrl ? (
              <img
                src={quote.serviceImageUrl}
                alt={quote.serviceName}
                className="w-10 h-10 object-contain rounded-lg bg-muted p-1 shrink-0"
                loading="lazy"
              />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <Wrench className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start gap-2">
                <p className="font-medium text-sm">{quote.serviceName}</p>
                {quote.isAvailable ? (
                  (!hidePricesCompletely && (!hidePricesUntilContact || w.contactCollectedEarly)) && <span className="font-bold text-primary shrink-0">${quote.price}</span>
                ) : (
                  <span className="text-xs text-muted-foreground shrink-0">Not Available</span>
                )}
              </div>
              {quote.serviceDescription && (
                <p className="text-xs text-muted-foreground mt-1">{quote.serviceDescription}</p>
              )}
              {quote.isAvailable && (
                <StockBadge quote={quote} stockLoading={w.stockLoading} stockData={w.stockData} />
              )}
            </div>
          </div>
        </div>
      ))}

      {w.selectedServices.size > 0 && (
        <div className="sticky bottom-2 mt-4">
          <Card className="shadow-lg border-primary/20">
            <CardContent className="p-3 sm:p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center justify-between sm:block gap-2">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {w.selectedServices.size} service{w.selectedServices.size > 1 ? 's' : ''} selected
                    </p>
                    {!hidePricesCompletely && (!hidePricesUntilContact || w.contactCollectedEarly) && (
                      <>
                        {w.getMultiServiceDiscount() > 0 && (
                          <p className="text-xs text-green-600 font-medium">Multi-service discount: -${w.getMultiServiceDiscount().toFixed(2)}</p>
                        )}
                        <p className="text-xl font-bold text-primary">
                          Total: ${w.getGrandTotal().toFixed(2)}
                        </p>
                        <p className="text-xs text-muted-foreground">plus taxes</p>
                      </>
                    )}
                  </div>
                  <Button size="sm" className="sm:hidden" onClick={() => w.contactCollectedEarly ? w.handleContinueWithEarlyContact() : w.handleContinueToQuote()} data-testid="button-continue-quote-mobile">
                    <ChevronRight className="h-4 w-4 mr-1" aria-hidden="true" />
                    Continue
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => w.setSelectedCategoryId(null)}
                    data-testid="button-add-another-service"
                  >
                    <Plus className="h-4 w-4 mr-1" aria-hidden="true" />
                    Add another service
                  </Button>
                  <Button size="sm" className="hidden sm:inline-flex" onClick={() => w.contactCollectedEarly ? w.handleContinueWithEarlyContact() : w.handleContinueToQuote()} data-testid="button-continue-quote">
                    <ChevronRight className="h-4 w-4 mr-1" aria-hidden="true" />
                    Continue
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function StockBadge({ quote, stockLoading, stockData }: { quote: ReturnType<typeof useQuoteWizard>['allQuotes'][0]; stockLoading: boolean; stockData: Record<string, number> }) {
  if (!quote.primaryPartSkus?.length) return null;

  if (stockLoading) {
    return (
      <div className="flex flex-wrap gap-2 mt-1 text-xs text-muted-foreground items-center">
        {quote.repairTime && <span>{quote.repairTime}</span>}
        {quote.warranty && <span>· {quote.warranty} warranty</span>}
        <span className="flex items-center gap-1 text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
          <span>Checking stock…</span>
        </span>
      </div>
    );
  }

  const anyPrimaryInStock = quote.primaryPartSkus?.some(sku => stockData[sku] && stockData[sku] > 0);
  const allSecondaryInStock = !quote.additionalPartSkus?.length ||
    quote.additionalPartSkus.every(sku => stockData[sku] && stockData[sku] > 0);

  return (
    <div className="flex flex-wrap gap-2 mt-1 text-xs text-muted-foreground items-center">
      {quote.repairTime && <span>{quote.repairTime}</span>}
      {quote.warranty && <span>· {quote.warranty} warranty</span>}
      {Object.keys(stockData).length > 0 && (
        anyPrimaryInStock && allSecondaryInStock ? (
          <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs">
            In Stock
          </Badge>
        ) : (
          <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-xs whitespace-normal text-left">
            Parts order may be required. Contact us for confirmation
          </Badge>
        )
      )}
    </div>
  );
}

function QuoteView({ w, hidePricesCompletely, hidePricesUntilContact, quoteValidDays }: WizardProps & { hidePricesCompletely: boolean; hidePricesUntilContact: boolean; quoteValidDays: number }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          {w.selectedDevice && (
            <div className="shrink-0">
              {w.selectedDevice.imageUrl ? (
                <img
                  src={w.selectedDevice.imageUrl}
                  alt={w.selectedDevice.name}
                  className="w-12 h-12 object-contain rounded-lg bg-muted p-1"
                />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                  <Wrench className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                </div>
              )}
            </div>
          )}
          <div className="flex-1 min-w-0">
            {w.selectedDevice && (
              <p className="text-xs text-muted-foreground mb-1">
                {w.selectedDevice.brand?.name && <span>{w.selectedDevice.brand.name} </span>}
                <span className="font-medium text-foreground">{w.selectedDevice.name}</span>
              </p>
            )}
            <CardTitle className="text-lg text-pretty">Your Repair Quote</CardTitle>
            <CardDescription className="text-xs">Review your selected services</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Button
          variant="secondary"
          size="sm"
          className="mb-4"
          onClick={() => w.setView('services')}
          data-testid="button-back-services-quote"
        >
          Back to services
        </Button>

        <div className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
            <h3 className="font-semibold text-sm">Selected Services</h3>
            <div className="space-y-2">
              {w.getSelectedQuotes().map(q => (
                <div key={q.serviceId} className="py-2 border-b last:border-b-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      {q.categoryName && (
                        <p className="text-xs text-muted-foreground mb-0.5">{q.categoryName}</p>
                      )}
                      <p className="text-sm font-medium">{q.serviceName}</p>
                      {q.serviceDescription && (
                        <p className="text-xs text-muted-foreground mt-0.5">{q.serviceDescription}</p>
                      )}
                      <QuoteStockBadge quote={q} stockLoading={w.stockLoading} stockData={w.stockData} />
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {!hidePricesCompletely && <span className="font-semibold">${q.price}</span>}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                        aria-label="Remove service"
                        onClick={() => {
                          w.toggleServiceSelection(q.serviceId);
                          if (w.selectedServices.size <= 1) {
                            w.setView('services');
                          }
                        }}
                        data-testid={`button-remove-${q.serviceId}`}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {!hidePricesCompletely && w.getMultiServiceDiscount() > 0 && (
              <div className="flex justify-between items-center pt-2 text-green-600">
                <span className="text-sm font-medium">Multi-Service Discount</span>
                <span className="font-semibold">-${w.getMultiServiceDiscount().toFixed(2)}</span>
              </div>
            )}
            {!hidePricesCompletely && (
              <div className="flex justify-between items-center pt-2 border-t">
                <span className="font-semibold">Grand Total</span>
                <div className="text-right">
                  <span className="text-xl font-bold text-primary">${w.getGrandTotal().toFixed(2)}</span>
                  <p className="text-xs text-muted-foreground">plus taxes</p>
                  <p className="text-xs text-muted-foreground">prices include labour</p>
                </div>
              </div>
            )}
            <p className="text-sm font-medium text-center pt-3" data-testid="text-contact-help">
              Having issues with getting a quote?{" "}
              <a href="https://519techservices.ca/pages/contact-us-elmira-on" target="_blank" rel="noopener noreferrer" className="underline text-primary hover:text-primary/80">Contact us</a>
            </p>
            <p className="text-xs text-muted-foreground text-center pt-2" data-testid="text-quote-validity">
              This quote is valid for {quoteValidDays} days
            </p>
          </div>

          {w.autoSentQuote ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                {w.submitCombinedQuoteMutation.isPending ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin text-green-600" aria-hidden="true" />
                    <span className="text-sm text-green-700 dark:text-green-300">Sending your quote…</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" aria-hidden="true" />
                    <div>
                      <p className="font-medium text-green-700 dark:text-green-300 text-sm">Quote Sent!</p>
                      <p className="text-xs text-muted-foreground">
                        Check your email{w.contactInfo.phone ? ' and phone' : ''} for details.
                      </p>
                    </div>
                  </>
                )}
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={w.resetForm}
                data-testid="button-start-new-quote"
              >
                Start New Quote
              </Button>
            </div>
          ) : w.contactCollectedEarly && w.contactInfo.name && w.contactInfo.email ? (
            <Button
              className="w-full"
              onClick={() => w.handleSendCombinedQuote({ preventDefault: () => {} } as React.FormEvent)}
              disabled={w.submitCombinedQuoteMutation.isPending}
              data-testid="button-send-me-quote"
            >
              {w.submitCombinedQuoteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Mail className="h-4 w-4 mr-2" aria-hidden="true" />
              )}
              Send Quote
            </Button>
          ) : (
            <Button
              className="w-full"
              onClick={() => w.setView('contact')}
              data-testid="button-send-me-quote"
            >
              <Mail className="h-4 w-4 mr-2" aria-hidden="true" />
              Send Me Quote
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function QuoteStockBadge({ quote, stockLoading, stockData }: { quote: ReturnType<typeof useQuoteWizard>['allQuotes'][0]; stockLoading: boolean; stockData: Record<string, number> }) {
  if (!quote.primaryPartSkus?.length) return null;

  if (stockLoading) {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
        <span>Checking stock...</span>
      </span>
    );
  }

  const anyPrimaryInStock = quote.primaryPartSkus?.some(sku => stockData[sku] && stockData[sku] > 0);
  const allSecondaryInStock = !quote.additionalPartSkus?.length ||
    quote.additionalPartSkus.every(sku => stockData[sku] && stockData[sku] > 0);

  if (Object.keys(stockData).length === 0) return null;

  if (anyPrimaryInStock && allSecondaryInStock) {
    return (
      <Badge variant="secondary" className="text-xs py-0 px-1.5 mt-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
        <Package className="h-3 w-3 mr-1" aria-hidden="true" />
        In Stock
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="text-xs py-0 px-1.5 mt-1 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 whitespace-normal text-left">
      <Package className="h-3 w-3 mr-1 shrink-0" aria-hidden="true" />
      Parts order may be required. Contact us for confirmation
    </Badge>
  );
}

function ContactView({ w, hidePricesUntilContact, hidePricesCompletely }: WizardProps & { hidePricesUntilContact: boolean; hidePricesCompletely: boolean }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          {w.selectedDevice && (
            <div className="shrink-0">
              {w.selectedDevice.imageUrl ? (
                <img
                  src={w.selectedDevice.imageUrl}
                  alt={w.selectedDevice.name}
                  className="w-12 h-12 object-contain rounded-lg bg-muted p-1"
                />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                  <Wrench className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                </div>
              )}
            </div>
          )}
          <div className="flex-1 min-w-0">
            {w.pendingCategoryId ? (
              <>
                <p className="text-xs text-muted-foreground mb-1">
                  {w.selectedDevice?.brand?.name && <span>{w.selectedDevice.brand.name} </span>}
                  <span className="font-medium text-foreground">{w.selectedDevice?.name}</span>
                </p>
                <CardTitle className="text-lg text-pretty">Enter Your Details</CardTitle>
                <CardDescription className="text-xs">We need your contact info to prepare your quote</CardDescription>
              </>
            ) : (
              <>
                <p className="text-xs text-muted-foreground mb-1">
                  {w.getSelectedQuotes().length} service{w.getSelectedQuotes().length > 1 ? 's' : ''}{!hidePricesUntilContact && !hidePricesCompletely && <> · <span className="font-semibold text-primary">${w.getGrandTotal().toFixed(2)}</span> plus taxes</>}
                </p>
                <CardTitle className="text-lg text-pretty">Send Your Quote</CardTitle>
                <CardDescription className="text-xs">Enter your contact details</CardDescription>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Button
          variant="secondary"
          size="sm"
          className="mb-4"
          onClick={() => {
            if (w.pendingCategoryId) {
              w.setPendingCategoryId(null);
              w.setView('services');
            } else {
              w.setView('quote');
            }
          }}
          data-testid="button-back-quote"
        >
          {w.pendingCategoryId ? "Back to categories" : "Back to quote"}
        </Button>

        <form onSubmit={w.pendingCategoryId ? w.handleEarlyContactSubmit : w.handleSendCombinedQuote} className="space-y-3">
          <div className="space-y-2">
            <div className="space-y-1">
              <Label htmlFor="quote-name" className="text-xs">Name *</Label>
              <Input
                id="quote-name"
                name="name"
                autoComplete="name"
                value={w.contactInfo.name}
                onChange={(e) => w.updateContactInfo('name', e.target.value)}
                placeholder="Your name…"
                required
                className="h-9"
                data-testid="input-quote-name"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="quote-email" className="text-xs">Email *</Label>
              <Input
                id="quote-email"
                type="email"
                name="email"
                autoComplete="email"
                spellCheck={false}
                value={w.contactInfo.email}
                onChange={(e) => w.updateContactInfo('email', e.target.value)}
                placeholder="your@email.com"
                required
                className={`h-9 ${w.contactErrors.email ? 'border-red-500' : ''}`}
                data-testid="input-quote-email"
              />
              {w.contactErrors.email && (
                <p className="text-xs text-red-500" data-testid="error-quote-email">{w.contactErrors.email}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="quote-phone" className="text-xs">Phone (optional)</Label>
              <Input
                id="quote-phone"
                type="tel"
                name="phone"
                autoComplete="tel"
                inputMode="tel"
                value={w.contactInfo.phone}
                onChange={(e) => w.updateContactInfo('phone', e.target.value)}
                placeholder="e.g. 226-555-1234"
                className={`h-9 ${w.contactErrors.phone ? 'border-red-500' : ''}`}
                data-testid="input-quote-phone"
              />
              {w.contactErrors.phone && (
                <p className="text-xs text-red-500" data-testid="error-quote-phone">{w.contactErrors.phone}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="quote-notes" className="text-xs">Notes (optional)</Label>
              <Textarea
                id="quote-notes"
                name="notes"
                autoComplete="off"
                value={w.notes}
                onChange={(e) => w.setNotes(e.target.value)}
                placeholder="Any additional information…"
                className="resize-none"
                rows={2}
                data-testid="input-quote-notes"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground" data-testid="text-contact-consent">By continuing, you agree to receive SMS or email communication from 519 Tech Services for the purpose of delivering your repair quote.</p>
          <Button
            type="submit"
            className="w-full"
            disabled={!w.pendingCategoryId && w.submitCombinedQuoteMutation.isPending}
            data-testid="button-send-quote"
          >
            {!w.pendingCategoryId && w.submitCombinedQuoteMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : w.pendingCategoryId ? (
              <ChevronRight className="h-4 w-4 mr-2" aria-hidden="true" />
            ) : (
              <Check className="h-4 w-4 mr-2" aria-hidden="true" />
            )}
            {w.pendingCategoryId ? "View Repair Options" : "Send My Quote"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function UnknownDeviceView({ w }: WizardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg text-pretty">Request a Quote</CardTitle>
        <CardDescription className="text-xs">
          Tell us about your device and we'll get back to you with a quote
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          variant="secondary"
          size="sm"
          className="mb-4"
          onClick={() => w.setView('search')}
          data-testid="button-back-search"
        >
          Back to search
        </Button>

        <form onSubmit={w.handleSubmitUnknownDevice} className="space-y-4">
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="unknown-device" className="text-xs">What device do you have? *</Label>
              <Input
                id="unknown-device"
                name="device-description"
                autoComplete="off"
                value={w.unknownDeviceInfo.deviceDescription}
                onChange={(e) => w.updateUnknownInfo('deviceDescription', e.target.value)}
                placeholder="e.g., Samsung phone, black, about 2 years old"
                required
                className="h-9"
                data-testid="input-unknown-device"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="unknown-issue" className="text-xs">What's the issue? *</Label>
              <Textarea
                id="unknown-issue"
                name="issue-description"
                autoComplete="off"
                value={w.unknownDeviceInfo.issueDescription}
                onChange={(e) => w.updateUnknownInfo('issueDescription', e.target.value)}
                placeholder="Describe what's wrong with your device, provide model number if possible…"
                required
                className="resize-none"
                rows={3}
                data-testid="input-unknown-issue"
              />
            </div>
          </div>

          <div className="border-t pt-4 space-y-3">
            <h3 className="font-semibold text-sm">Your Contact Info</h3>
            <div className="space-y-1">
              <Label htmlFor="unknown-name" className="text-xs">Name *</Label>
              <Input
                id="unknown-name"
                name="name"
                autoComplete="name"
                value={w.unknownDeviceInfo.name}
                onChange={(e) => w.updateUnknownInfo('name', e.target.value)}
                placeholder="Your name"
                required
                className="h-9"
                data-testid="input-unknown-name"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="unknown-email" className="text-xs">Email *</Label>
              <Input
                id="unknown-email"
                type="email"
                name="email"
                autoComplete="email"
                spellCheck={false}
                value={w.unknownDeviceInfo.email}
                onChange={(e) => w.updateUnknownInfo('email', e.target.value)}
                placeholder="your@email.com"
                required
                className={`h-9 ${w.unknownErrors.email ? 'border-red-500' : ''}`}
                data-testid="input-unknown-email"
              />
              {w.unknownErrors.email && (
                <p className="text-xs text-red-500" data-testid="error-unknown-email">{w.unknownErrors.email}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="unknown-phone" className="text-xs">Phone (optional)</Label>
              <Input
                id="unknown-phone"
                type="tel"
                name="phone"
                autoComplete="tel"
                value={w.unknownDeviceInfo.phone}
                onChange={(e) => w.updateUnknownInfo('phone', e.target.value)}
                placeholder="e.g. 226-555-1234"
                className={`h-9 ${w.unknownErrors.phone ? 'border-red-500' : ''}`}
                data-testid="input-unknown-phone"
              />
              {w.unknownErrors.phone && (
                <p className="text-xs text-red-500" data-testid="error-unknown-phone">{w.unknownErrors.phone}</p>
              )}
            </div>
          </div>

          <p className="text-xs text-muted-foreground" data-testid="text-contact-consent">By continuing, you agree to receive SMS or email communication from 519 Tech Services for the purpose of delivering your repair quote.</p>
          <Button
            type="submit"
            size="sm"
            className="w-full"
            disabled={w.submitUnknownDeviceMutation.isPending}
            data-testid="button-submit-unknown"
          >
            {w.submitUnknownDeviceMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Check className="h-4 w-4 mr-2" aria-hidden="true" />
            )}
            Request Quote
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function SuccessView({ w }: WizardProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-green-100 dark:bg-green-950 flex items-center justify-center">
            <Check className="h-8 w-8 text-green-600 dark:text-green-400" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-pretty">
              {w.unknownQuoteSent ? "Request Received!" : "Quote Sent!"}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {w.unknownQuoteSent
                ? "We'll review your request and get back to you soon."
                : "Check your email for your repair quote details."
              }
            </p>
          </div>
          <Button variant="outline" onClick={w.resetForm} data-testid="button-new-quote">
            Get Another Quote
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
