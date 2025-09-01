import * as fs from "fs";
import { GoogleGenAI } from "@google/genai";

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function analyzeProductImage(base64Image: string): Promise<{
  productName: string;
  category: string;
  confidence: number;
  suggestedSku?: string;
}> {
  try {
    const model = genAI.models.generateContent({
      model: "gemini-2.5-pro",
      config: {
        systemInstruction: "You are an expert in automotive spare parts identification. Analyze the image and identify the specific auto part, its category, and suggest details. Respond with JSON in this format: { 'productName': string, 'category': string, 'confidence': number (0-1), 'suggestedSku': string }",
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            productName: { type: "string" },
            category: { type: "string" },
            confidence: { type: "number" },
            suggestedSku: { type: "string" },
          },
          required: ["productName", "category", "confidence"],
        },
      },
      contents: [
        {
          inlineData: {
            data: base64Image,
            mimeType: "image/jpeg",
          },
        },
        "Identify this automotive spare part. What is the specific part name, category, and your confidence in this identification?",
      ],
    });

    const response = await model;
    const result = JSON.parse(response.text || "{}");
    
    return {
      productName: result.productName || "Unknown Part",
      category: result.category || "Unknown",
      confidence: Math.max(0, Math.min(1, result.confidence || 0)),
      suggestedSku: result.suggestedSku,
    };
  } catch (error) {
    console.error("Error analyzing product image with Gemini:", error);
    throw new Error("Failed to analyze product image: " + (error as Error).message);
  }
}

export async function generateWhatsAppResponse(userMessage: string, context: any): Promise<string> {
  try {
    const systemPrompt = "You are a helpful inventory management assistant. You help users update stock levels and create orders via WhatsApp. Be concise and friendly. Always ask for clarification when needed.";
    
    const response = await genAI.models.generateContent({
      model: "gemini-2.5-flash",
      config: {
        systemInstruction: systemPrompt,
      },
      contents: `User message: "${userMessage}"\nContext: ${JSON.stringify(context)}`,
    });

    return response.text || "I'm sorry, I couldn't process your request.";
  } catch (error) {
    console.error("Error generating WhatsApp response with Gemini:", error);
    return "I'm experiencing technical difficulties. Please try again later.";
  }
}