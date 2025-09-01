import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { whatsappService } from "./services/whatsapp";
import { z } from "zod";
import { insertProductSchema, insertOrderSchema, insertOrderItemSchema, insertCustomerSchema, insertWarehouseSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      const user = await storage.getUserByUsername(username);
      
      if (!user || user.password !== password) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      // In production, use proper JWT token
      res.json({ user: { ...user, password: undefined }, token: "mock-jwt-token" });
    } catch (error) {
      res.status(500).json({ error: "Login failed" });
    }
  });

  // Dashboard stats
  app.get("/api/dashboard/stats", async (req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch dashboard stats" });
    }
  });

  // Recent stock movements for dashboard
  app.get("/api/dashboard/recent-movements", async (req, res) => {
    try {
      const movements = await storage.getStockMovements();
      res.json(movements.slice(0, 10)); // Last 10 movements
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch recent movements" });
    }
  });

  // Low stock products
  app.get("/api/dashboard/low-stock", async (req, res) => {
    try {
      const lowStockProducts = await storage.getLowStockProducts();
      res.json(lowStockProducts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch low stock products" });
    }
  });

  // Products routes
  app.get("/api/products", async (req, res) => {
    try {
      const { search, category, warehouseId } = req.query;
      const products = await storage.getProducts({
        search: search as string,
        category: category as string,
        warehouseId: warehouseId as string,
      });
      res.json(products);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  app.get("/api/products/:id", async (req, res) => {
    try {
      const product = await storage.getProduct(req.params.id);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch product" });
    }
  });

  app.post("/api/products", async (req, res) => {
    try {
      const productData = insertProductSchema.parse(req.body);
      const product = await storage.createProduct(productData);
      res.status(201).json(product);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid product data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create product" });
    }
  });

  app.put("/api/products/:id", async (req, res) => {
    try {
      const productData = insertProductSchema.partial().parse(req.body);
      const product = await storage.updateProduct(req.params.id, productData);
      res.json(product);
    } catch (error) {
      res.status(500).json({ error: "Failed to update product" });
    }
  });

  app.delete("/api/products/:id", async (req, res) => {
    try {
      await storage.deleteProduct(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete product" });
    }
  });

  // Stock update route
  app.post("/api/products/:id/stock", async (req, res) => {
    try {
      const { action, quantity, warehouseId, reason, userId } = req.body;
      const product = await storage.getProduct(req.params.id);
      
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }

      let newStockTotal = product.stockTotal;
      let newStockUsed = product.stockUsed;
      let newStockAvailable = product.stockAvailable;

      if (action === "add") {
        newStockTotal += quantity;
        newStockAvailable += quantity;
      } else if (action === "use") {
        newStockUsed += quantity;
        newStockAvailable -= quantity;
      } else if (action === "adjust") {
        newStockTotal = quantity;
        newStockAvailable = newStockTotal - newStockUsed;
      }

      await storage.updateProduct(req.params.id, {
        stockTotal: newStockTotal,
        stockUsed: newStockUsed,
        stockAvailable: newStockAvailable,
      });

      await storage.createStockMovement({
        productId: req.params.id,
        warehouseId,
        action,
        quantity: action === "use" ? -quantity : quantity,
        previousStock: product.stockAvailable,
        newStock: newStockAvailable,
        reason,
        userId,
      });

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to update stock" });
    }
  });

  // Warehouses routes
  app.get("/api/warehouses", async (req, res) => {
    try {
      const warehouses = await storage.getWarehouses();
      res.json(warehouses);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch warehouses" });
    }
  });

  app.post("/api/warehouses", async (req, res) => {
    try {
      const warehouseData = insertWarehouseSchema.parse(req.body);
      const warehouse = await storage.createWarehouse(warehouseData);
      res.status(201).json(warehouse);
    } catch (error) {
      res.status(500).json({ error: "Failed to create warehouse" });
    }
  });

  // Orders routes
  app.get("/api/orders", async (req, res) => {
    try {
      const { status } = req.query;
      const orders = await storage.getOrders({ status: status as string });
      res.json(orders);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch orders" });
    }
  });

  app.get("/api/orders/:id", async (req, res) => {
    try {
      const order = await storage.getOrder(req.params.id);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      res.json(order);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch order" });
    }
  });

  app.post("/api/orders", async (req, res) => {
    try {
      const { order: orderData, items } = req.body;
      
      const validatedOrder = insertOrderSchema.parse(orderData);
      const validatedItems = items.map((item: any) => insertOrderItemSchema.parse(item));

      // Create customer if doesn't exist
      let customer;
      if (orderData.customerEmail) {
        const customers = await storage.getCustomers();
        customer = customers.find(c => c.email === orderData.customerEmail);
        
        if (!customer && orderData.customerName) {
          customer = await storage.createCustomer({
            name: orderData.customerName,
            email: orderData.customerEmail,
            phone: orderData.customerPhone,
          });
        }
      }

      const order = await storage.createOrder({
        ...validatedOrder,
        customerId: customer?.id,
      }, validatedItems);
      
      res.status(201).json(order);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid order data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create order" });
    }
  });

  app.put("/api/orders/:id/status", async (req, res) => {
    try {
      const { status } = req.body;
      const order = await storage.updateOrderStatus(req.params.id, status);
      res.json(order);
    } catch (error) {
      res.status(500).json({ error: "Failed to update order status" });
    }
  });

  // Customers routes
  app.get("/api/customers", async (req, res) => {
    try {
      const customers = await storage.getCustomers();
      res.json(customers);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch customers" });
    }
  });

  app.post("/api/customers", async (req, res) => {
    try {
      const customerData = insertCustomerSchema.parse(req.body);
      const customer = await storage.createCustomer(customerData);
      res.status(201).json(customer);
    } catch (error) {
      res.status(500).json({ error: "Failed to create customer" });
    }
  });

  // WhatsApp webhook routes
  app.get("/api/whatsapp/webhook", async (req, res) => {
    try {
      const mode = req.query["hub.mode"];
      const token = req.query["hub.verify_token"];
      const challenge = req.query["hub.challenge"];

      const result = await whatsappService.verifyWebhook(mode as string, token as string, challenge as string);
      
      if (result) {
        res.status(200).send(result);
      } else {
        res.status(403).send("Forbidden");
      }
    } catch (error) {
      res.status(500).json({ error: "Webhook verification failed" });
    }
  });

  app.post("/api/whatsapp/webhook", async (req, res) => {
    try {
      await whatsappService.processIncomingMessage(req.body);
      res.status(200).send("OK");
    } catch (error) {
      console.error("WhatsApp webhook error:", error);
      res.status(500).json({ error: "Webhook processing failed" });
    }
  });

  // Analytics routes
  app.get("/api/analytics/dashboard", async (req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch analytics" });
    }
  });

  // Stock movements
  app.get("/api/stock-movements", async (req, res) => {
    try {
      const { productId } = req.query;
      const movements = await storage.getStockMovements(productId as string);
      res.json(movements);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch stock movements" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
