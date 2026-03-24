import { useQuery } from "@tanstack/react-query";
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

export default function Embed() {
  const { data: partsLastUpdated } = useQuery<MessageTemplate>({
    queryKey: ["/api/message-templates", "parts_last_updated"],
  });

  const { data: multiDiscountSettings } = useQuery<{ enabled: boolean; amount: number }>({
    queryKey: ["/api/settings/multi-discount"],
  });

  const { data: hidePricesSettings } = useQuery<{ enabled: boolean }>({
    queryKey: ["/api/settings/hide-prices-until-contact"],
  });
  const hidePricesUntilContact = hidePricesSettings?.enabled ?? false;

  const { data: hidePricesCompletelySettings } = useQuery<{ enabled: boolean }>({
    queryKey: ["/api/settings/hide-prices-completely"],
  });
  const hidePricesCompletely = hidePricesCompletelySettings?.enabled ?? false;

  const { data: pricingSourceSettings } = useQuery<{ source: string }>({
    queryKey: ["/api/settings/pricing-source"],
  });
  const pricingSource = pricingSourceSettings?.source ?? "excel_upload";

  const { data: quoteValidDaysSettings } = useQuery<{ days: number }>({
    queryKey: ["/api/settings/quote-valid-days"],
  });
  const quoteValidDays = quoteValidDaysSettings?.days ?? 7;

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

        {w.view === 'search' && <SearchView w={w} />}
        {w.view === 'services' && <ServicesView w={w} hidePricesUntilContact={hidePricesUntilContact} hidePricesCompletely={hidePricesCompletely} />}
        {w.view === 'quote' && <QuoteView w={w} hidePricesCompletely={hidePricesCompletely} hidePricesUntilContact={hidePricesUntilContact} quoteValidDays={quoteValidDays} />}
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
