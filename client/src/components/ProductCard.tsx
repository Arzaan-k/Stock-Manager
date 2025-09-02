import { useState } from "react";
import { Link } from "wouter";
import { useCart } from "@/hooks/useCart";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ShoppingCart, Package } from "lucide-react";

interface Product {
  id: string;
  name: string;
  sku: string;
  price: string;
  stockAvailable: number;
  imageUrl?: string;
  type: string;
  description?: string;
}

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const [isAdding, setIsAdding] = useState(false);
  const { addItem } = useCart();
  const { toast } = useToast();

  const handleAddToCart = async () => {
    if (product.stockAvailable <= 0) {
      toast({
        title: "Out of Stock",
        description: "This item is currently out of stock.",
        variant: "destructive",
      });
      return;
    }

    setIsAdding(true);
    
    try {
      addItem(product, 1);
      
      toast({
        title: "Added to Cart",
        description: `${product.name} has been added to your cart.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add item to cart.",
        variant: "destructive",
      });
    } finally {
      setIsAdding(false);
    }
  };

  const getStockStatus = () => {
    if (product.stockAvailable <= 0) {
      return { label: "Out of Stock", variant: "destructive" as const };
    } else if (product.stockAvailable <= 10) {
      return { label: "Low Stock", variant: "secondary" as const };
    } else {
      return { label: "In Stock", variant: "default" as const };
    }
  };

  const stockStatus = getStockStatus();

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow" data-testid={`card-product-${product.id}`}>
      <Link href={`/products/${product.id}`}>
        <a className="block aspect-square overflow-hidden" data-testid={`link-product-image-${product.id}`}>
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-muted flex items-center justify-center">
              <Package className="w-12 h-12 text-muted-foreground" />
            </div>
          )}
        </a>
      </Link>
      
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <Link href={`/products/${product.id}`}>
            <a className="font-semibold text-foreground text-sm line-clamp-2 hover:underline" data-testid={`link-product-name-${product.id}`}>
              {product.name}
            </a>
          </Link>
          <Badge variant={stockStatus.variant} data-testid={`badge-stock-status-${product.id}`}>
            {stockStatus.label}
          </Badge>
        </div>
        
        <p className="text-xs text-muted-foreground mb-3" data-testid={`text-product-sku-${product.id}`}>
          SKU: {product.sku}
        </p>
        
        <div className="flex items-center justify-between mb-3">
          <span className="text-lg font-bold text-foreground" data-testid={`text-product-price-${product.id}`}>
            ${parseFloat(product.price || "0").toFixed(2)}
          </span>
          <span className="text-sm text-muted-foreground" data-testid={`text-product-stock-${product.id}`}>
            {product.stockAvailable} available
          </span>
        </div>
        
        <Button
          onClick={handleAddToCart}
          disabled={isAdding || product.stockAvailable <= 0}
          className="w-full"
          data-testid={`button-add-to-cart-${product.id}`}
        >
          {isAdding ? (
            "Adding..."
          ) : (
            <>
              <ShoppingCart className="w-4 h-4 mr-2" />
              Add to Cart
            </>
          )}
        </Button>

        <Link href={`/products/${product.id}`}>
          <a className="mt-2 inline-flex text-xs text-muted-foreground hover:text-foreground hover:underline" data-testid={`link-view-details-${product.id}`}>
            View details
          </a>
        </Link>
      </CardContent>
    </Card>
  );
}
