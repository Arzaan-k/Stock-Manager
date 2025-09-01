import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { api } from "@/lib/api";
import {
  Package,
  Plus,
  Search,
  Edit,
  Trash2,
  Upload,
  MapPin,
} from "lucide-react";

const productSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  description: z.string().optional(),
  sku: z.string().min(1, "SKU is required"),
  type: z.string().min(1, "Product type is required"),
  price: z.string().min(0, "Price must be a positive number"),
  stockTotal: z.number().min(0, "Stock total must be non-negative"),
  minStockLevel: z.number().min(0, "Minimum stock level must be non-negative"),
  imageUrl: z.string().url().optional().or(z.literal("")),
});

type ProductFormData = z.infer<typeof productSchema>;

export default function Products() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const { toast } = useToast();

  const { data: products, isLoading } = useQuery({
    queryKey: ["/api/products", { search: searchTerm, category: selectedCategory }],
    queryFn: () => api.getProducts({ search: searchTerm, category: selectedCategory }).then(res => res.json()),
  });

  const { data: warehouses } = useQuery({
    queryKey: ["/api/warehouses"],
    queryFn: () => api.getWarehouses().then(res => res.json()),
  });

  const createProductMutation = useMutation({
    mutationFn: (data: ProductFormData) => api.createProduct(data).then(res => res.json()),
    onSuccess: () => {
      toast({ title: "Product created successfully" });
      setIsCreateDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
    },
    onError: () => {
      toast({ title: "Failed to create product", variant: "destructive" });
    },
  });

  const updateProductMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ProductFormData> }) =>
      api.updateProduct(id, data).then(res => res.json()),
    onSuccess: () => {
      toast({ title: "Product updated successfully" });
      setEditingProduct(null);
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
    },
    onError: () => {
      toast({ title: "Failed to update product", variant: "destructive" });
    },
  });

  const deleteProductMutation = useMutation({
    mutationFn: (id: string) => api.deleteProduct(id),
    onSuccess: () => {
      toast({ title: "Product deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
    },
    onError: () => {
      toast({ title: "Failed to delete product", variant: "destructive" });
    },
  });

  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      description: "",
      sku: "",
      type: "",
      price: "0",
      stockTotal: 0,
      minStockLevel: 10,
      imageUrl: "",
    },
  });

  const onSubmit = (data: ProductFormData) => {
    if (editingProduct) {
      updateProductMutation.mutate({ id: editingProduct.id, data });
    } else {
      createProductMutation.mutate(data);
    }
  };

  const handleEdit = (product: any) => {
    setEditingProduct(product);
    form.reset({
      name: product.name,
      description: product.description || "",
      sku: product.sku,
      type: product.type,
      price: product.price || "0",
      stockTotal: product.stockTotal,
      minStockLevel: product.minStockLevel,
      imageUrl: product.imageUrl || "",
    });
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this product?")) {
      deleteProductMutation.mutate(id);
    }
  };

  const getStockStatus = (product: any) => {
    if (product.stockAvailable <= 0) {
      return { label: "Out of Stock", variant: "destructive" as const };
    } else if (product.stockAvailable <= product.minStockLevel) {
      return { label: "Low Stock", variant: "secondary" as const };
    } else {
      return { label: "In Stock", variant: "default" as const };
    }
  };

  const categories = Array.from(new Set(products?.map((p: any) => p.type) || []));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Products</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Manage your inventory and stock levels
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <Button variant="outline" data-testid="button-import-csv">
                <Upload className="w-4 h-4 mr-2" />
                Import CSV
              </Button>
              <Dialog open={isCreateDialogOpen || !!editingProduct} onOpenChange={(open) => {
                if (!open) {
                  setIsCreateDialogOpen(false);
                  setEditingProduct(null);
                  form.reset();
                }
              }}>
                <DialogTrigger asChild>
                  <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-add-product">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Product
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>
                      {editingProduct ? "Edit Product" : "Add New Product"}
                    </DialogTitle>
                  </DialogHeader>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Product Name</FormLabel>
                              <FormControl>
                                <Input placeholder="Enter product name" {...field} data-testid="input-product-name" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="sku"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>SKU</FormLabel>
                              <FormControl>
                                <Input placeholder="Enter SKU" {...field} data-testid="input-product-sku" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="type"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Category</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g. Engine Parts" {...field} data-testid="input-product-type" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="price"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Price</FormLabel>
                              <FormControl>
                                <Input type="number" step="0.01" placeholder="0.00" {...field} data-testid="input-product-price" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Description</FormLabel>
                            <FormControl>
                              <Textarea placeholder="Enter product description" {...field} data-testid="textarea-product-description" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <FormField
                          control={form.control}
                          name="stockTotal"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Initial Stock</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  {...field}
                                  onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                  data-testid="input-product-stock"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="minStockLevel"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Min Stock Level</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  {...field}
                                  onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                  data-testid="input-product-min-stock"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="imageUrl"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Image URL</FormLabel>
                              <FormControl>
                                <Input placeholder="https://..." {...field} data-testid="input-product-image" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="flex justify-end space-x-3">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setIsCreateDialogOpen(false);
                            setEditingProduct(null);
                            form.reset();
                          }}
                          data-testid="button-cancel-product"
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          disabled={createProductMutation.isPending || updateProductMutation.isPending}
                          data-testid="button-save-product"
                        >
                          {createProductMutation.isPending || updateProductMutation.isPending
                            ? "Saving..."
                            : editingProduct
                            ? "Update Product"
                            : "Create Product"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>

        {/* Filters */}
        <div className="px-6 pb-6">
          <div className="flex flex-col md:flex-row space-y-3 md:space-y-0 md:space-x-4 bg-muted/20 p-4 rounded-lg">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-products"
                />
              </div>
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-full md:w-48" data-testid="select-category">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Categories</SelectItem>
                {(categories as string[]).map((category: string) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center space-x-4 p-4 border rounded-lg">
                  <div className="w-12 h-12 bg-muted rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded w-48" />
                    <div className="h-3 bg-muted rounded w-32" />
                  </div>
                  <div className="w-24 h-8 bg-muted rounded" />
                </div>
              ))}
            </div>
          ) : products?.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/30">
                  <tr>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Product</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">SKU</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Stock</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Price</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Status</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {products.map((product: any) => {
                    const stockStatus = getStockStatus(product);
                    
                    return (
                      <tr key={product.id} className="hover:bg-muted/50" data-testid={`row-product-${product.id}`}>
                        <td className="p-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                              {product.imageUrl ? (
                                <img
                                  src={product.imageUrl}
                                  alt={product.name}
                                  className="w-full h-full rounded-lg object-cover"
                                />
                              ) : (
                                <Package className="w-5 h-5 text-muted-foreground" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-foreground" data-testid={`text-product-name-${product.id}`}>
                                {product.name}
                              </p>
                              <p className="text-sm text-muted-foreground" data-testid={`text-product-type-${product.id}`}>
                                {product.type}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-sm text-foreground" data-testid={`text-product-sku-${product.id}`}>
                          {product.sku}
                        </td>
                        <td className="p-4">
                          <div className="text-sm">
                            <p className="font-medium text-foreground" data-testid={`text-product-total-stock-${product.id}`}>
                              Total: {product.stockTotal}
                            </p>
                            <p className="text-muted-foreground" data-testid={`text-product-stock-breakdown-${product.id}`}>
                              Used: {product.stockUsed} • Available: {product.stockAvailable}
                            </p>
                          </div>
                        </td>
                        <td className="p-4 text-sm font-medium text-foreground" data-testid={`text-product-price-${product.id}`}>
                          ${parseFloat(product.price || "0").toFixed(2)}
                        </td>
                        <td className="p-4">
                          <Badge variant={stockStatus.variant} data-testid={`badge-product-status-${product.id}`}>
                            {stockStatus.label}
                          </Badge>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(product)}
                              data-testid={`button-edit-product-${product.id}`}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(product.id)}
                              className="text-destructive hover:text-destructive"
                              data-testid={`button-delete-product-${product.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No products found</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm || selectedCategory
                  ? "Try adjusting your search filters"
                  : "Get started by adding your first product"}
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-add-first-product">
                <Plus className="w-4 h-4 mr-2" />
                Add Product
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
