import { useShop } from "@/contexts/ShopContext";
import { Loader2, AlertCircle } from "lucide-react";
import { HomeWithShop } from "./home";

export default function ShopHome() {
  const { shop, isLoading, error } = useShop();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" data-testid="loading-shop">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !shop) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" data-testid="error-shop-not-found">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
          <h1 className="text-2xl font-bold mb-2">Shop Not Found</h1>
          <p className="text-muted-foreground">The repair shop you're looking for doesn't exist.</p>
        </div>
      </div>
    );
  }

  return <HomeWithShop shop={shop ? { name: shop.name, logoUrl: shop.logoUrl, brandColor: shop.brandColor } : null} />;
}
