import { storage } from "../storage";
import { analyzeProductImage, generateWhatsAppResponse } from "./gemini";

export class WhatsAppService {
  private webhookToken: string;
  private accessToken: string;

  constructor() {
    this.webhookToken = process.env.WHATSAPP_WEBHOOK_TOKEN || "your-webhook-token";
    this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN || "your-access-token";
  }

  async verifyWebhook(mode: string, token: string, challenge: string): Promise<string | null> {
    if (mode === "subscribe" && token === this.webhookToken) {
      return challenge;
    }
    return null;
  }

  async processIncomingMessage(messageData: any): Promise<void> {
    try {
      const { messages, contacts } = messageData.entry[0].changes[0].value;
      
      if (!messages || messages.length === 0) return;

      const message = messages[0];
      const contact = contacts[0];
      const userPhone = contact.wa_id;

      // Handle different message types
      if (message.type === "image") {
        await this.handleImageMessage(userPhone, message);
      } else if (message.type === "text") {
        await this.handleTextMessage(userPhone, message.text.body);
      }
    } catch (error) {
      console.error("Error processing WhatsApp message:", error);
    }
  }

  private async handleImageMessage(userPhone: string, message: any): Promise<void> {
    try {
      // Download image from WhatsApp
      const imageUrl = await this.downloadWhatsAppImage(message.image.id);
      
      // Convert to base64
      const base64Image = await this.imageUrlToBase64(imageUrl);
      
      // Analyze with AI
      const analysis = await analyzeProductImage(base64Image);
      
      // Log the interaction
      const product = await storage.getProductBySku(analysis.suggestedSku || "");
      
      await storage.createWhatsappLog({
        userPhone,
        productId: product?.id,
        action: "product_inquiry",
        aiResponse: `Detected: ${analysis.productName}`,
        imageUrl,
        confidence: analysis.confidence.toString(),
        status: "processed",
      });

      // Generate and send response
      let responseText = `🔍 I detected: ${analysis.productName}\n`;
      responseText += `Category: ${analysis.category}\n`;
      responseText += `Confidence: ${Math.round(analysis.confidence * 100)}%\n\n`;

      if (product) {
        responseText += `✅ Found in inventory!\n`;
        responseText += `Stock available: ${product.stockAvailable}\n\n`;
        responseText += `What would you like to do?\n`;
        responseText += `1️⃣ Add stock\n`;
        responseText += `2️⃣ Use stock for order\n`;
        responseText += `3️⃣ Check details`;
      } else {
        responseText += `❌ Product not found in inventory.\n`;
        responseText += `Would you like to add this as a new product?`;
      }

      await this.sendWhatsAppMessage(userPhone, responseText);
    } catch (error) {
      console.error("Error handling image message:", error);
      await this.sendWhatsAppMessage(userPhone, "Sorry, I couldn't process that image. Please try again.");
    }
  }

  private async handleTextMessage(userPhone: string, messageText: string): Promise<void> {
    try {
      // Get recent context from logs
      const recentLogs = await storage.getWhatsappLogs();
      const userLogs = recentLogs.filter(log => log.userPhone === userPhone).slice(0, 5);
      
      const response = await generateWhatsAppResponse(messageText, { userLogs });
      await this.sendWhatsAppMessage(userPhone, response);

      await storage.createWhatsappLog({
        userPhone,
        action: "text_interaction",
        aiResponse: response,
        status: "processed",
      });
    } catch (error) {
      console.error("Error handling text message:", error);
      await this.sendWhatsAppMessage(userPhone, "Sorry, I couldn't process your message. Please try again.");
    }
  }

  private async downloadWhatsAppImage(imageId: string): Promise<string> {
    // TODO: Implement actual WhatsApp Cloud API image download
    // This is a placeholder that would use the WhatsApp Cloud API
    return `https://api.whatsapp.com/image/${imageId}`;
  }

  private async imageUrlToBase64(imageUrl: string): Promise<string> {
    // TODO: Implement actual image download and conversion
    // This would fetch the image and convert it to base64
    return "base64-placeholder";
  }

  async sendWhatsAppMessage(phoneNumber: string, message: string): Promise<void> {
    try {
      // TODO: Implement actual WhatsApp Cloud API message sending
      console.log(`Sending WhatsApp message to ${phoneNumber}: ${message}`);
    } catch (error) {
      console.error("Error sending WhatsApp message:", error);
    }
  }

  async sendLowStockAlert(phoneNumber: string, product: any): Promise<void> {
    const message = `🚨 LOW STOCK ALERT\n\n` +
                   `Product: ${product.name}\n` +
                   `SKU: ${product.sku}\n` +
                   `Current Stock: ${product.stockAvailable}\n` +
                   `Minimum Level: ${product.minStockLevel}\n\n` +
                   `Please restock this item soon!`;
    
    await this.sendWhatsAppMessage(phoneNumber, message);
  }
}

export const whatsappService = new WhatsAppService();
