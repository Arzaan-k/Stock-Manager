import { 
  users, warehouses, products, warehouseStock, customers, orders, orderItems, stockMovements, whatsappLogs,
  type User, type InsertUser, type Warehouse, type InsertWarehouse, 
  type Product, type InsertProduct, type Customer, type InsertCustomer,
  type Order, type InsertOrder, type OrderItem, type InsertOrderItem,
  type StockMovement, type InsertStockMovement, type WhatsappLog, type InsertWhatsappLog
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, asc, like, and, sql } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<InsertUser>): Promise<User>;

  // Warehouses
  getWarehouses(): Promise<Warehouse[]>;
  getWarehouse(id: string): Promise<Warehouse | undefined>;
  createWarehouse(warehouse: InsertWarehouse): Promise<Warehouse>;
  updateWarehouse(id: string, warehouse: Partial<InsertWarehouse>): Promise<Warehouse>;

  // Products
  getProducts(filters?: { search?: string; category?: string; warehouseId?: string }): Promise<Product[]>;
  getProduct(id: string): Promise<Product | undefined>;
  getProductBySku(sku: string): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: string, product: Partial<InsertProduct>): Promise<Product>;
  deleteProduct(id: string): Promise<void>;

  // Warehouse Stock
  getWarehouseStockForProduct(productId: string): Promise<any[]>;
  updateWarehouseStock(productId: string, warehouseId: string, quantity: number, location?: any): Promise<void>;

  // Customers
  getCustomers(): Promise<Customer[]>;
  getCustomer(id: string): Promise<Customer | undefined>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;

  // Orders
  getOrders(filters?: { status?: string }): Promise<any[]>;
  getOrder(id: string): Promise<any | undefined>;
  createOrder(order: InsertOrder, items: InsertOrderItem[]): Promise<Order>;
  updateOrderStatus(id: string, status: string): Promise<Order>;
  // Product usage by orders
  getOrdersByProduct(productId: string): Promise<any[]>;

  // Stock Movements
  getStockMovements(productId?: string): Promise<any[]>;
  createStockMovement(movement: InsertStockMovement): Promise<StockMovement>;

  // WhatsApp Logs
  getWhatsappLogs(): Promise<WhatsappLog[]>;
  createWhatsappLog(log: InsertWhatsappLog): Promise<WhatsappLog>;

  // Analytics
  getDashboardStats(): Promise<any>;
  getLowStockProducts(): Promise<Product[]>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getOrdersByProduct(productId: string): Promise<any[]> {
    // Return list of orders that include the product with item details and customer
    const items = await db
      .select({
        order: orders,
        customer: customers,
        orderItem: orderItems,
      })
      .from(orderItems)
      .leftJoin(orders, eq(orderItems.orderId, orders.id))
      .leftJoin(customers, eq(orders.customerId, customers.id))
      .where(eq(orderItems.productId, productId))
      .orderBy(desc(orders.createdAt));

    return items;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async updateUser(id: string, updateUser: Partial<InsertUser>): Promise<User> {
    const [user] = await db
      .update(users)
      .set(updateUser)
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async getWarehouses(): Promise<Warehouse[]> {
    return await db.select().from(warehouses).where(eq(warehouses.isActive, true));
  }

  async getWarehouse(id: string): Promise<Warehouse | undefined> {
    const [warehouse] = await db.select().from(warehouses).where(eq(warehouses.id, id));
    return warehouse || undefined;
  }

  async createWarehouse(insertWarehouse: InsertWarehouse): Promise<Warehouse> {
    const [warehouse] = await db
      .insert(warehouses)
      .values(insertWarehouse)
      .returning();
    return warehouse;
  }

  async updateWarehouse(id: string, updateWarehouse: Partial<InsertWarehouse>): Promise<Warehouse> {
    const [warehouse] = await db
      .update(warehouses)
      .set(updateWarehouse)
      .where(eq(warehouses.id, id))
      .returning();
    return warehouse;
  }

  async getProducts(filters?: { search?: string; category?: string; warehouseId?: string }): Promise<Product[]> {
    const conditions = [eq(products.isActive, true)];
    
    if (filters?.search) {
      conditions.push(like(products.name, `%${filters.search}%`));
    }
    
    if (filters?.category) {
      conditions.push(eq(products.type, filters.category));
    }

    return await db
      .select()
      .from(products)
      .where(and(...conditions))
      .orderBy(asc(products.name));
  }

  async getProduct(id: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product || undefined;
  }

  async getProductBySku(sku: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.sku, sku));
    return product || undefined;
  }

  async createProduct(insertProduct: InsertProduct): Promise<Product> {
    const [product] = await db
      .insert(products)
      .values({
        ...insertProduct,
        stockAvailable: insertProduct.stockTotal || 0,
      })
      .returning();
    return product;
  }

  async updateProduct(id: string, updateProduct: Partial<InsertProduct>): Promise<Product> {
    const [product] = await db
      .update(products)
      .set({
        ...updateProduct,
        updatedAt: new Date(),
      })
      .where(eq(products.id, id))
      .returning();
    return product;
  }

  async deleteProduct(id: string): Promise<void> {
    await db.update(products)
      .set({ isActive: false })
      .where(eq(products.id, id));
  }

  async getWarehouseStockForProduct(productId: string): Promise<any[]> {
    return await db
      .select({
        warehouseStock,
        warehouse: warehouses,
      })
      .from(warehouseStock)
      .leftJoin(warehouses, eq(warehouseStock.warehouseId, warehouses.id))
      .where(eq(warehouseStock.productId, productId));
  }

  async updateWarehouseStock(productId: string, warehouseId: string, quantity: number, location?: any): Promise<void> {
    const existing = await db
      .select()
      .from(warehouseStock)
      .where(and(
        eq(warehouseStock.productId, productId),
        eq(warehouseStock.warehouseId, warehouseId)
      ));

    if (existing.length > 0) {
      await db
        .update(warehouseStock)
        .set({ 
          quantity,
          aisle: location?.aisle,
          rack: location?.rack,
          boxNumber: location?.boxNumber,
          updatedAt: new Date()
        })
        .where(and(
          eq(warehouseStock.productId, productId),
          eq(warehouseStock.warehouseId, warehouseId)
        ));
    } else {
      await db.insert(warehouseStock).values({
        productId,
        warehouseId,
        quantity,
        aisle: location?.aisle,
        rack: location?.rack,
        boxNumber: location?.boxNumber,
      });
    }
  }

  async getCustomers(): Promise<Customer[]> {
    return await db.select().from(customers).orderBy(asc(customers.name));
  }

  async getCustomer(id: string): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.id, id));
    return customer || undefined;
  }

  async createCustomer(insertCustomer: InsertCustomer): Promise<Customer> {
    const [customer] = await db
      .insert(customers)
      .values(insertCustomer)
      .returning();
    return customer;
  }

  async getOrders(filters?: { status?: string }): Promise<any[]> {
    const conditions = [];
    
    if (filters?.status) {
      conditions.push(eq(orders.status, filters.status));
    }

    const query = db
      .select({
        order: orders,
        customer: customers,
        itemCount: sql<number>`count(${orderItems.id})`.as('itemCount'),
      })
      .from(orders)
      .leftJoin(customers, eq(orders.customerId, customers.id))
      .leftJoin(orderItems, eq(orders.id, orderItems.orderId))
      .groupBy(orders.id, customers.id);

    if (conditions.length > 0) {
      return await query.where(and(...conditions)).orderBy(desc(orders.createdAt));
    }

    return await query.orderBy(desc(orders.createdAt));
  }

  async getOrder(id: string): Promise<any | undefined> {
    const [orderData] = await db
      .select({
        order: orders,
        customer: customers,
      })
      .from(orders)
      .leftJoin(customers, eq(orders.customerId, customers.id))
      .where(eq(orders.id, id));

    if (!orderData) return undefined;

    const items = await db
      .select({
        orderItem: orderItems,
        product: products,
      })
      .from(orderItems)
      .leftJoin(products, eq(orderItems.productId, products.id))
      .where(eq(orderItems.orderId, id));

    return {
      ...orderData.order,
      customer: orderData.customer,
      items,
    };
  }

  async createOrder(insertOrder: InsertOrder, items: InsertOrderItem[]): Promise<Order> {
    const orderNumber = `ORD-${Date.now()}`;
    
    const [order] = await db
      .insert(orders)
      .values({
        ...insertOrder,
        orderNumber,
      })
      .returning();

    // Insert order items
    if (items.length > 0) {
      await db.insert(orderItems).values(
        items.map(item => ({
          ...item,
          orderId: order.id,
        }))
      );

      // Update stock and create movement logs
      for (const item of items) {
        const product = await this.getProduct(item.productId);
        if (product) {
          const newStockUsed = product.stockUsed + item.quantity;
          const newStockAvailable = product.stockTotal - newStockUsed;
          
          await this.updateProduct(item.productId, {
            stockUsed: newStockUsed,
            stockAvailable: newStockAvailable,
          });

          await this.createStockMovement({
            productId: item.productId,
            action: "use",
            quantity: -item.quantity,
            previousStock: product.stockAvailable,
            newStock: newStockAvailable,
            reason: `Used for order ${orderNumber}`,
            orderId: order.id,
          });
        }
      }
    }

    return order;
  }

  async updateOrderStatus(id: string, status: string): Promise<Order> {
    const [order] = await db
      .update(orders)
      .set({ status, updatedAt: new Date() })
      .where(eq(orders.id, id))
      .returning();
    return order;
  }

  async getStockMovements(productId?: string): Promise<any[]> {
    const query = db
      .select({
        movement: stockMovements,
        product: products,
        warehouse: warehouses,
        user: users,
      })
      .from(stockMovements)
      .leftJoin(products, eq(stockMovements.productId, products.id))
      .leftJoin(warehouses, eq(stockMovements.warehouseId, warehouses.id))
      .leftJoin(users, eq(stockMovements.userId, users.id));

    if (productId) {
      return await query.where(eq(stockMovements.productId, productId)).orderBy(desc(stockMovements.createdAt));
    }

    return await query.orderBy(desc(stockMovements.createdAt));
  }

  async createStockMovement(insertMovement: InsertStockMovement): Promise<StockMovement> {
    const [movement] = await db
      .insert(stockMovements)
      .values(insertMovement)
      .returning();
    return movement;
  }

  async getWhatsappLogs(): Promise<WhatsappLog[]> {
    return await db.select().from(whatsappLogs).orderBy(desc(whatsappLogs.createdAt));
  }

  async createWhatsappLog(insertLog: InsertWhatsappLog): Promise<WhatsappLog> {
    const [log] = await db
      .insert(whatsappLogs)
      .values(insertLog)
      .returning();
    return log;
  }

  async getDashboardStats(): Promise<any> {
    const [productStats] = await db
      .select({
        totalProducts: sql<number>`count(*)`,
        lowStockCount: sql<number>`count(*) filter (where ${products.stockAvailable} <= ${products.minStockLevel})`,
      })
      .from(products)
      .where(eq(products.isActive, true));

    const [orderStats] = await db
      .select({
        totalOrders: sql<number>`count(*)`,
        pendingOrders: sql<number>`count(*) filter (where ${orders.status} = 'pending')`,
      })
      .from(orders);

    const [warehouseCount] = await db
      .select({
        count: sql<number>`count(*)`,
      })
      .from(warehouses)
      .where(eq(warehouses.isActive, true));

    return {
      totalProducts: productStats?.totalProducts || 0,
      lowStockCount: productStats?.lowStockCount || 0,
      totalOrders: orderStats?.totalOrders || 0,
      pendingOrders: orderStats?.pendingOrders || 0,
      warehouseCount: warehouseCount?.count || 0,
    };
  }

  async getLowStockProducts(): Promise<Product[]> {
    return await db
      .select()
      .from(products)
      .where(and(
        eq(products.isActive, true),
        sql`${products.stockAvailable} <= ${products.minStockLevel}`
      ))
      .orderBy(asc(products.stockAvailable));
  }
}

export const storage = new DatabaseStorage();
