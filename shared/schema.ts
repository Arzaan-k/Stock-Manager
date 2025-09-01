import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table for authentication and role management
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("staff"), // admin, staff, viewer, customer
  firstName: text("first_name"),
  lastName: text("last_name"),
  phone: text("phone"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Warehouses table
export const warehouses = pgTable("warehouses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  location: text("location").notNull(),
  address: text("address"),
  gpsCoordinates: jsonb("gps_coordinates"), // {lat: number, lng: number}
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Products table
export const products = pgTable("products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  sku: text("sku").notNull().unique(),
  type: text("type").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }),
  stockTotal: integer("stock_total").notNull().default(0),
  stockUsed: integer("stock_used").notNull().default(0),
  stockAvailable: integer("stock_available").notNull().default(0),
  minStockLevel: integer("min_stock_level").default(10),
  imageUrl: text("image_url"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Warehouse stock - junction table for product locations
export const warehouseStock = pgTable("warehouse_stock", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  warehouseId: varchar("warehouse_id").notNull().references(() => warehouses.id, { onDelete: "cascade" }),
  quantity: integer("quantity").notNull().default(0),
  aisle: text("aisle"),
  rack: text("rack"),
  boxNumber: text("box_number"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Customers table
export const customers = pgTable("customers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  city: text("city"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Orders table
export const orders = pgTable("orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderNumber: text("order_number").notNull().unique(),
  customerId: varchar("customer_id").references(() => customers.id),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email"),
  customerPhone: text("customer_phone"),
  status: text("status").notNull().default("pending"), // pending, shipped, delivered, cancelled
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  tax: decimal("tax", { precision: 10, scale: 2 }).notNull().default("0"),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Order items table
export const orderItems = pgTable("order_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  productId: varchar("product_id").notNull().references(() => products.id),
  quantity: integer("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  totalPrice: decimal("total_price", { precision: 10, scale: 2 }).notNull(),
});

// Stock movements table for audit trail
export const stockMovements = pgTable("stock_movements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").notNull().references(() => products.id),
  warehouseId: varchar("warehouse_id").references(() => warehouses.id),
  action: text("action").notNull(), // add, use, transfer, adjust
  quantity: integer("quantity").notNull(),
  previousStock: integer("previous_stock"),
  newStock: integer("new_stock"),
  reason: text("reason"),
  userId: varchar("user_id").references(() => users.id),
  orderId: varchar("order_id").references(() => orders.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// WhatsApp logs table
export const whatsappLogs = pgTable("whatsapp_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userPhone: text("user_phone").notNull(),
  productId: varchar("product_id").references(() => products.id),
  action: text("action"), // stock_add, stock_use, order_create, product_inquiry
  quantity: integer("quantity"),
  aiResponse: text("ai_response"),
  imageUrl: text("image_url"),
  confidence: decimal("confidence", { precision: 5, scale: 4 }),
  status: text("status").default("pending"), // pending, processed, failed
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  stockMovements: many(stockMovements),
}));

export const warehousesRelations = relations(warehouses, ({ many }) => ({
  warehouseStock: many(warehouseStock),
  stockMovements: many(stockMovements),
}));

export const productsRelations = relations(products, ({ many }) => ({
  warehouseStock: many(warehouseStock),
  orderItems: many(orderItems),
  stockMovements: many(stockMovements),
  whatsappLogs: many(whatsappLogs),
}));

export const warehouseStockRelations = relations(warehouseStock, ({ one }) => ({
  product: one(products, {
    fields: [warehouseStock.productId],
    references: [products.id],
  }),
  warehouse: one(warehouses, {
    fields: [warehouseStock.warehouseId],
    references: [warehouses.id],
  }),
}));

export const customersRelations = relations(customers, ({ many }) => ({
  orders: many(orders),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  customer: one(customers, {
    fields: [orders.customerId],
    references: [customers.id],
  }),
  orderItems: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
}));

export const stockMovementsRelations = relations(stockMovements, ({ one }) => ({
  product: one(products, {
    fields: [stockMovements.productId],
    references: [products.id],
  }),
  warehouse: one(warehouses, {
    fields: [stockMovements.warehouseId],
    references: [warehouses.id],
  }),
  user: one(users, {
    fields: [stockMovements.userId],
    references: [users.id],
  }),
  order: one(orders, {
    fields: [stockMovements.orderId],
    references: [orders.id],
  }),
}));

export const whatsappLogsRelations = relations(whatsappLogs, ({ one }) => ({
  product: one(products, {
    fields: [whatsappLogs.productId],
    references: [products.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertWarehouseSchema = createInsertSchema(warehouses).omit({
  id: true,
  createdAt: true,
});

export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCustomerSchema = createInsertSchema(customers).omit({
  id: true,
  createdAt: true,
});

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  orderNumber: true,
});

export const insertOrderItemSchema = createInsertSchema(orderItems).omit({
  id: true,
});

export const insertStockMovementSchema = createInsertSchema(stockMovements).omit({
  id: true,
  createdAt: true,
});

export const insertWhatsappLogSchema = createInsertSchema(whatsappLogs).omit({
  id: true,
  createdAt: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Warehouse = typeof warehouses.$inferSelect;
export type InsertWarehouse = z.infer<typeof insertWarehouseSchema>;

export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;

export type WarehouseStock = typeof warehouseStock.$inferSelect;

export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;

export type Order = typeof orders.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;

export type OrderItem = typeof orderItems.$inferSelect;
export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;

export type StockMovement = typeof stockMovements.$inferSelect;
export type InsertStockMovement = z.infer<typeof insertStockMovementSchema>;

export type WhatsappLog = typeof whatsappLogs.$inferSelect;
export type InsertWhatsappLog = z.infer<typeof insertWhatsappLogSchema>;
