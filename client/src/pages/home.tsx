import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import { Link } from "wouter";
import type { MessageTemplate } from "@shared/schema";
import { useQuoteWizard } from "@/hooks/use-quote-wizard";
import {
  SearchView,
  ServicesView,
  QuoteView,
  ContactView,
  UnknownDeviceView,
  SuccessView,
  WizardFooter,
} from "@/components/quote-wizard";

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

        {w.view === 'search' && <SearchView w={w} />}
        {w.view === 'services' && <ServicesView w={w} hidePricesUntilContact={hidePricesUntilContact} hidePricesCompletely={hidePricesCompletely} />}
        {w.view === 'quote' && <QuoteView w={w} hidePricesCompletely={hidePricesCompletely} hidePricesUntilContact={hidePricesUntilContact} quoteValidDays={quoteFlowSettings?.quoteValidDays ?? 7} />}
        {w.view === 'contact' && <ContactView w={w} hidePricesUntilContact={hidePricesUntilContact} hidePricesCompletely={hidePricesCompletely} />}
        {w.view === 'unknown' && <UnknownDeviceView w={w} />}
        {w.view === 'success' && <SuccessView w={w} />}

        <WizardFooter
          pricingSource={pricingSource}
          partsLastUpdated={partsLastUpdated}
          formatLastUpdated={w.formatLastUpdated}
        />
      </div>
    </main>
  );
}
