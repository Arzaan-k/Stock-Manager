import { useState, useEffect } from "react";

interface CartItem {
  id: string;
  name: string;
  sku: string;
  price: number;
  quantity: number;
  imageUrl?: string;
}

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    // Load cart from localStorage
    const savedCart = localStorage.getItem("cart");
    if (savedCart) {
      setItems(JSON.parse(savedCart));
    }
  }, []);

  useEffect(() => {
    // Save cart to localStorage whenever it changes
    localStorage.setItem("cart", JSON.stringify(items));
  }, [items]);

  const addItem = (product: any, quantity: number = 1) => {
    setItems((prevItems) => {
      const existingItem = prevItems.find((item) => item.id === product.id);
      
      if (existingItem) {
        return prevItems.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      } else {
        return [
          ...prevItems,
          {
            id: product.id,
            name: product.name,
            sku: product.sku,
            price: parseFloat(product.price || "0"),
            quantity,
            imageUrl: product.imageUrl,
          },
        ];
      }
    });
  };

  const removeItem = (productId: string) => {
    setItems((prevItems) => prevItems.filter((item) => item.id !== productId));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(productId);
      return;
    }

    setItems((prevItems) =>
      prevItems.map((item) =>
        item.id === productId ? { ...item, quantity } : item
      )
    );
  };

  const clearCart = () => {
    setItems([]);
  };

  const getTotalItems = () => {
    return items.reduce((total, item) => total + item.quantity, 0);
  };

  const getSubtotal = () => {
    return items.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const getTax = (taxRate: number = 0.08) => {
    return getSubtotal() * taxRate;
  };

  const getTotal = (taxRate: number = 0.08) => {
    return getSubtotal() + getTax(taxRate);
  };

  return {
    items,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    getTotalItems,
    getSubtotal,
    getTax,
    getTotal,
  };
}
