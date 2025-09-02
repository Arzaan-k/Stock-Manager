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
      console.log("/api/auth/login attempt", { username, found: !!user });
      
      if (!user || user.password !== password) {
        console.log("/api/auth/login failed", { username, reason: !user ? "user_not_found" : "password_mismatch" });
        return res.status(401).json({ error: "Invalid credentials" });
      }

      // In production, use proper JWT token
      res.json({ user: { ...user, password: undefined }, token: "mock-jwt-token" });
    } catch (error) {
      console.error("/api/auth/login error", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  // CSV import for products
  app.post("/api/products/import-csv", async (req, res) => {
    try {
      const { csv, warehouseId } = req.body || {};
      if (typeof csv !== "string" || csv.trim().length === 0) {
        return res.status(400).json({ error: "CSV content is required" });
      }

      // Basic CSV parser supporting quoted values and commas
      const parseCSV = (text: string): string[][] => {
        const rows: string[][] = [];
        let row: string[] = [];
        let cell = "";
        let inQuotes = false;
        for (let i = 0; i < text.length; i++) {
          const c = text[i];
          const next = text[i + 1];
          if (c === '"') {
            if (inQuotes && next === '"') { // escaped quote
              cell += '"';
              i++;
            } else {
              inQuotes = !inQuotes;
            }
          } else if (c === "," && !inQuotes) {
            row.push(cell.trim());
            cell = "";
          } else if ((c === "\n" || c === "\r") && !inQuotes) {
            if (cell.length > 0 || row.length > 0) {
              row.push(cell.trim());
              rows.push(row);
              row = [];
              cell = "";
            }
            // skip \r in \r\n
            if (c === "\r" && next === "\n") i++;
          } else {
            cell += c;
          }
        }
        if (cell.length > 0 || row.length > 0) {
          row.push(cell.trim());
          rows.push(row);
        }
        return rows.filter(r => r.some(v => v !== ""));
      };

      const rows = parseCSV(csv);
      if (rows.length === 0) return res.json({ imported: 0 });

      const header = rows[0].map(h => h.toLowerCase().trim());
      const dataRows = rows.slice(1);

      const get = (colName: string, r: string[]): string | undefined => {
        const idx = header.indexOf(colName.toLowerCase());
        return idx >= 0 ? r[idx] : undefined;
      };

      let imported = 0;
      const created: any[] = [];
      for (const r of dataRows) {
        // Map incoming columns to product fields
        const listOfItems = get("list of items", r) ?? get("name", r);
        const crystalPartCode = get("crystal part code", r) ?? get("sku", r);
        const mfgPartCode = get("mfg part code", r);
        const priceStr = get("price", r);
        const currentStockStr = get("current stock available", r) ?? get("stock", r);

        const productCandidate: any = {
          name: listOfItems || crystalPartCode || mfgPartCode || "Unnamed Product",
          description: get("description", r),
          sku: crystalPartCode || mfgPartCode || `SKU-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          type: get("group name", r) || get("type", r) || "General",
          price: priceStr && priceStr !== "" ? priceStr : undefined,
          stockTotal: currentStockStr ? parseInt(currentStockStr) || 0 : 0,
          minStockLevel: parseInt(get("minimum inventory per day", r) || "0") || 0,
          imageUrl: get("image url", r),
          groupCode: get("group code", r),
          groupName: get("group name", r),
          crystalPartCode,
          listOfItems,
          photos: (() => {
            const p = get("photos", r);
            if (!p) return null;
            const parts = p.split(/[;|,\s]+/).filter(Boolean);
            return parts.length ? parts : null;
          })(),
          mfgPartCode,
          importance: get("importance", r),
          highValue: get("high value", r),
          maximumUsagePerMonth: parseInt(get("maximum usage per month", r) || "") || undefined,
          sixMonthsUsage: parseInt(get("6 months usage", r) || get("six months usage", r) || "") || undefined,
          averagePerDay: (() => {
            const v = get("average per day", r);
            if (!v) return undefined;
            return v;
          })(),
          leadTimeDays: parseInt(get("lead time days", r) || "") || undefined,
          criticalFactorOneDay: parseInt(get("critical factor - one day", r) || "") || undefined,
          units: get("units", r),
          minimumInventoryPerDay: parseInt(get("minimum inventory per day", r) || "") || undefined,
          maximumInventoryPerDay: parseInt(get("maximum inventory per day", r) || "") || undefined,
        };

        try {
          const validated = insertProductSchema.parse(productCandidate);
          const createdProduct = await storage.createProduct(validated);
          // Optionally set initial warehouse stock
          if (typeof warehouseId === "string" && warehouseId && createdProduct.stockTotal > 0) {
            await storage.updateWarehouseStock(createdProduct.id, warehouseId, createdProduct.stockTotal);
          }
          created.push(createdProduct);
          imported++;
        } catch (e) {
          // skip invalid rows
          continue;
        }
      }

      res.json({ imported, products: created });
    } catch (error) {
      console.error("/api/products/import-csv error", error);
      res.status(500).json({ error: "Failed to import products from CSV" });
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

  // Product usage details (stock, movements, orders)
  app.get("/api/products/:id/usage", async (req, res) => {
    try {
      const productId = req.params.id;
      const product = await storage.getProduct(productId);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }

      const [warehouseStockList, movements, orders] = await Promise.all([
        storage.getWarehouseStockForProduct(productId),
        storage.getStockMovements(productId),
        storage.getOrdersByProduct(productId),
      ]);

      res.json({
        product,
        warehouseStock: warehouseStockList,
        movements,
        orders,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch product usage info" });
    }
  });

  app.post("/api/products", async (req, res) => {
    try {
      // Accept optional warehouseId separate from product fields
      const { warehouseId, ...body } = req.body || {};
      const productData = insertProductSchema.parse(body);

      const product = await storage.createProduct(productData);

      // If warehouseId provided, set initial stock in warehouse_stock
      if (typeof warehouseId === "string" && warehouseId) {
        const qty = Number(productData.stockTotal) || 0;
        if (qty > 0) {
          await storage.updateWarehouseStock(product.id, warehouseId, qty);
        }
      }

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
