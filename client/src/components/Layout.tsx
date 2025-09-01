import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  ShoppingCart,
  FileText,
  Building2,
  MessageCircle,
  BarChart3,
  Menu,
  X,
  User,
  LogOut,
} from "lucide-react";

interface LayoutProps {
  children: React.ReactNode;
}

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Products", href: "/products", icon: Package },
  { name: "Product Catalog", href: "/catalog", icon: ShoppingBag },
  { name: "Orders", href: "/orders", icon: FileText },
  { name: "Warehouses", href: "/warehouses", icon: Building2 },
  { name: "WhatsApp AI", href: "/whatsapp", icon: MessageCircle },
  { name: "Analytics", href: "/analytics", icon: BarChart3 },
];

const pageInfo = {
  "/": { title: "Dashboard", subtitle: "Monitor your inventory and orders" },
  "/products": { title: "Products", subtitle: "Manage your inventory and stock levels" },
  "/catalog": { title: "Product Catalog", subtitle: "Browse and order spare parts" },
  "/cart": { title: "Shopping Cart", subtitle: "Review your items before checkout" },
  "/orders": { title: "Orders", subtitle: "Track and manage customer orders" },
  "/warehouses": { title: "Warehouses", subtitle: "Manage warehouse locations and stock" },
  "/whatsapp": { title: "WhatsApp AI", subtitle: "AI-powered inventory updates" },
  "/analytics": { title: "Analytics", subtitle: "Insights and performance reports" },
};

export default function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [location] = useLocation();
  const { getTotalItems } = useCart();
  const { user, logout } = useAuth();

  const currentPageInfo = pageInfo[location as keyof typeof pageInfo] || pageInfo["/"];

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile menu button */}
      <div className="md:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setSidebarOpen(true)}
          className="bg-card text-foreground p-2 rounded-md border border-border shadow-sm"
          data-testid="button-mobile-menu"
        >
          <Menu className="w-6 h-6" />
        </button>
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
          data-testid="overlay-mobile-sidebar"
        />
      )}

      {/* Sidebar */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-40 w-64 bg-card border-r border-border transition-transform duration-300 ease-in-out",
        "md:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          {/* Logo and close button */}
          <div className="flex items-center justify-between p-6 border-b border-border">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Package className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-lg font-semibold text-foreground">StockSmart</span>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="md:hidden p-1 rounded text-muted-foreground hover:text-foreground"
              data-testid="button-close-sidebar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2">
            {navigation.map((item) => {
              const isActive = location === item.href;
              const Icon = item.icon;
              
              return (
                <Link key={item.name} href={item.href}>
                  <a
                    className={cn(
                      "flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent"
                    )}
                    onClick={() => setSidebarOpen(false)}
                    data-testid={`nav-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.name}</span>
                  </a>
                </Link>
              );
            })}
          </nav>

          {/* User info */}
          <div className="p-4 border-t border-border">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {user?.firstName || user?.username || "Guest"}
                </p>
                <p className="text-xs text-muted-foreground truncate">{user?.role || "User"}</p>
              </div>
              <button
                onClick={logout}
                className="p-1 text-muted-foreground hover:text-foreground"
                data-testid="button-logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="md:pl-64">
        {/* Header */}
        <header className="bg-card border-b border-border px-4 py-3 md:px-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">{currentPageInfo.title}</h1>
              <p className="text-sm text-muted-foreground mt-1">{currentPageInfo.subtitle}</p>
            </div>
            <div className="flex items-center space-x-3">
              {/* Shopping Cart Badge */}
              <div className="relative">
                <Link href="/cart">
                  <a
                    className="p-2 rounded-md border border-border hover:bg-accent text-muted-foreground hover:text-foreground"
                    data-testid="button-cart"
                  >
                    <ShoppingCart className="w-5 h-5" />
                    {getTotalItems() > 0 && (
                      <span 
                        className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center"
                        data-testid="text-cart-count"
                      >
                        {getTotalItems()}
                      </span>
                    )}
                  </a>
                </Link>
              </div>
              <Link href="/orders/new">
                <a
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90"
                  data-testid="button-create-order"
                >
                  Create Order
                </a>
              </Link>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
