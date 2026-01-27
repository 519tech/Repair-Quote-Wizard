import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Store, Search, ArrowRight } from "lucide-react";

interface Shop {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  brandColor: string | null;
}

export default function ShopLogin() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: shops, isLoading } = useQuery<Shop[]>({
    queryKey: ["/api/shops/public-list"],
  });

  const filteredShops = shops?.filter(shop => 
    shop.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    shop.slug.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const handleShopSelect = (slug: string) => {
    setLocation(`/${slug}`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" data-testid="loading-shops">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto text-center mb-12">
          <h1 className="text-4xl font-bold mb-4" data-testid="text-page-title">
            RepairQuote
          </h1>
          <p className="text-lg text-muted-foreground" data-testid="text-page-description">
            Select your repair shop to get started
          </p>
        </div>

        <div className="max-w-md mx-auto mb-8">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search shops..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-shop-search"
            />
          </div>
        </div>

        <div className="max-w-2xl mx-auto">
          {filteredShops.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Store className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground" data-testid="text-no-shops">
                  {searchQuery ? "No shops found matching your search" : "No shops available"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredShops.map((shop) => (
                <Card 
                  key={shop.id}
                  className="hover-elevate cursor-pointer transition-all"
                  onClick={() => handleShopSelect(shop.slug)}
                  data-testid={`card-shop-${shop.slug}`}
                >
                  <CardHeader className="flex flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      {shop.logoUrl ? (
                        <img 
                          src={shop.logoUrl} 
                          alt={shop.name}
                          className="h-12 w-12 object-contain rounded"
                          data-testid={`img-shop-logo-${shop.slug}`}
                        />
                      ) : (
                        <div 
                          className="h-12 w-12 rounded flex items-center justify-center"
                          style={{ backgroundColor: shop.brandColor || "#666" }}
                          data-testid={`div-shop-color-${shop.slug}`}
                        >
                          <Store className="h-6 w-6 text-white" />
                        </div>
                      )}
                      <div>
                        <CardTitle className="text-lg" data-testid={`text-shop-name-${shop.slug}`}>
                          {shop.name}
                        </CardTitle>
                        <CardDescription data-testid={`text-shop-slug-${shop.slug}`}>
                          /{shop.slug}
                        </CardDescription>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" data-testid={`button-select-shop-${shop.slug}`}>
                      <ArrowRight className="h-5 w-5" />
                    </Button>
                  </CardHeader>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div className="max-w-2xl mx-auto mt-12 text-center">
          <p className="text-sm text-muted-foreground">
            Are you an admin?{" "}
            <Button 
              variant="ghost" 
              className="p-0 h-auto underline"
              onClick={() => setLocation("/admin")}
              data-testid="link-admin-login"
            >
              Login to Admin Panel
            </Button>
          </p>
        </div>
      </div>
    </div>
  );
}
