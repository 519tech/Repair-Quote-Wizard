import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import ShopLogin from "@/pages/shop-login";
import ShopHome from "@/pages/shop-home";
import ShopInternal from "@/pages/shop-internal";
import ShopEmbed from "@/pages/shop-embed";
import Admin from "@/pages/admin";
import SuperAdmin from "@/pages/super-admin";
import { ShopProvider } from "@/contexts/ShopContext";

function ShopRoute({ 
  slug, 
  page 
}: { 
  slug: string; 
  page: "home" | "internal" | "embed"; 
}) {
  return (
    <ShopProvider slug={slug}>
      {page === "home" && <ShopHome />}
      {page === "internal" && <ShopInternal />}
      {page === "embed" && <ShopEmbed />}
    </ShopProvider>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={ShopLogin} />
      <Route path="/admin" component={Admin} />
      <Route path="/super-admin" component={SuperAdmin} />
      <Route path="/:slug">
        {(params) => <ShopRoute slug={params.slug} page="home" />}
      </Route>
      <Route path="/:slug/internal">
        {(params) => <ShopRoute slug={params.slug} page="internal" />}
      </Route>
      <Route path="/:slug/embed">
        {(params) => <ShopRoute slug={params.slug} page="embed" />}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
