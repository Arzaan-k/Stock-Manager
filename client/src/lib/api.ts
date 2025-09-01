import { apiRequest } from "./queryClient";

export const api = {
  // Auth
  login: (credentials: { username: string; password: string }) =>
    apiRequest("POST", "/api/auth/login", credentials),

  // Dashboard
  getDashboardStats: () => apiRequest("GET", "/api/dashboard/stats"),
  getRecentMovements: () => apiRequest("GET", "/api/dashboard/recent-movements"),
  getLowStockProducts: () => apiRequest("GET", "/api/dashboard/low-stock"),

  // Products
  getProducts: (filters?: { search?: string; category?: string; warehouseId?: string }) => {
    const params = new URLSearchParams();
    if (filters?.search) params.append("search", filters.search);
    if (filters?.category) params.append("category", filters.category);
    if (filters?.warehouseId) params.append("warehouseId", filters.warehouseId);
    
    return apiRequest("GET", `/api/products?${params.toString()}`);
  },
  getProduct: (id: string) => apiRequest("GET", `/api/products/${id}`),
  createProduct: (product: any) => apiRequest("POST", "/api/products", product),
  updateProduct: (id: string, product: any) => apiRequest("PUT", `/api/products/${id}`, product),
  deleteProduct: (id: string) => apiRequest("DELETE", `/api/products/${id}`),
  updateStock: (id: string, data: any) => apiRequest("POST", `/api/products/${id}/stock`, data),

  // Warehouses
  getWarehouses: () => apiRequest("GET", "/api/warehouses"),
  createWarehouse: (warehouse: any) => apiRequest("POST", "/api/warehouses", warehouse),

  // Orders
  getOrders: (filters?: { status?: string }) => {
    const params = new URLSearchParams();
    if (filters?.status) params.append("status", filters.status);
    return apiRequest("GET", `/api/orders?${params.toString()}`);
  },
  getOrder: (id: string) => apiRequest("GET", `/api/orders/${id}`),
  createOrder: (orderData: any) => apiRequest("POST", "/api/orders", orderData),
  updateOrderStatus: (id: string, status: string) => apiRequest("PUT", `/api/orders/${id}/status`, { status }),

  // Customers
  getCustomers: () => apiRequest("GET", "/api/customers"),
  createCustomer: (customer: any) => apiRequest("POST", "/api/customers", customer),

  // Stock movements
  getStockMovements: (productId?: string) => {
    const params = new URLSearchParams();
    if (productId) params.append("productId", productId);
    return apiRequest("GET", `/api/stock-movements?${params.toString()}`);
  },
};
