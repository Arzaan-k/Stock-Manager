import { pipeline, env } from '@xenova/transformers';
// import sharp from 'sharp';  // Temporarily disabled for Windows compatibility
let sharp: any = null;
try {
  sharp = require('sharp');
} catch (error) {
  console.warn('Sharp not available - image processing will be limited:', error.message);
}
import axios from 'axios';
import { storage } from '../storage';
import * as fs from 'fs';
import * as path from 'path';

// Configure transformers to use local models
env.allowRemoteModels = true;
env.allowLocalModels = true;

interface ProductMatch {
  productId: string;
  productName: string;
  sku: string;
  confidence: number;
  description?: string;
  imageUrl?: string;
}

interface ImageProcessingResult {
  matches: ProductMatch[];
  extractedText?: string;
  processingTime: number;
  success: boolean;
  error?: string;
}

export class ImageRecognitionService {
  private clipModel: any = null;
  private ocrModel: any = null;
  private isInitialized: boolean = false;
  private productFeatures: Map<string, Float32Array> = new Map();

  constructor() {
    this.initializeModels();
  }

  private async initializeModels(): Promise<void> {
    try {
      console.log('Initializing CLIP and OCR models...');
      
      // Initialize CLIP model for image-text similarity
      this.clipModel = await pipeline(
        'zero-shot-image-classification',
        'Xenova/clip-vit-base-patch32'
      );

      // Initialize OCR model for text extraction - use a more reliable model
      try {
        this.ocrModel = await pipeline(
          'image-to-text',
          'Xenova/trocr-base-printed'
        );
        console.log('OCR model (TrOCR) loaded successfully');
      } catch (ocrError) {
        console.warn('Primary OCR model failed, trying fallback:', ocrError.message);
        try {
          // Fallback to a simpler, more reliable OCR model
          this.ocrModel = await pipeline(
            'image-to-text',
            'Xenova/vit-gpt2-image-captioning'
          );
          console.log('Fallback OCR model (ViT-GPT2) loaded successfully');
        } catch (fallbackError) {
          console.warn('Both OCR models failed, OCR will be disabled:', fallbackError.message);
          this.ocrModel = null;
        }
      }

      await this.precomputeProductFeatures();
      this.isInitialized = true;
      console.log('Image recognition models initialized successfully');
    } catch (error) {
      console.error('Failed to initialize image recognition models:', error);
      this.isInitialized = false;
    }
  }

  private async precomputeProductFeatures(): Promise<void> {
    try {
      console.log('Precomputing product features for faster matching...');
      const products = await storage.getProducts();
      
      for (const product of products) {
        if (product.imageUrl || product.photos) {
          try {
            // Use product name and description as text features for now
            // In a full implementation, you'd process actual product images
            const textInput = `${product.name} ${product.description || ''} ${product.type || ''} ${product.sku || ''}`;
            
            // For now, create simple feature vectors based on text similarity
            // In production, you'd extract visual features from actual product images
            const features = this.createTextFeatureVector(textInput);
            this.productFeatures.set(product.id, features);
          } catch (error) {
            console.warn(`Failed to process features for product ${product.id}:`, error);
          }
        }
      }
      
      console.log(`Precomputed features for ${this.productFeatures.size} products`);
    } catch (error) {
      console.error('Failed to precompute product features:', error);
    }
  }

  private createTextFeatureVector(text: string): Float32Array {
    // Simple text-based feature extraction
    // In production, you'd use actual CLIP text encoder
    const words = text.toLowerCase().split(/\s+/);
    const features = new Float32Array(512); // Match CLIP dimension
    
    // Create a simple hash-based feature vector
    words.forEach((word, index) => {
      const hash = this.simpleHash(word) % 512;
      features[hash] += 1.0 / (index + 1); // Weight by position
    });
    
    // Normalize the vector
    const magnitude = Math.sqrt(features.reduce((sum, val) => sum + val * val, 0));
    if (magnitude > 0) {
      for (let i = 0; i < features.length; i++) {
        features[i] /= magnitude;
      }
    }
    
    return features;
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  private cosineSimilarity(a: Float32Array, b: Float32Array): number {
    if (a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      magnitudeA += a[i] * a[i];
      magnitudeB += b[i] * b[i];
    }
    
    magnitudeA = Math.sqrt(magnitudeA);
    magnitudeB = Math.sqrt(magnitudeB);
    
    if (magnitudeA === 0 || magnitudeB === 0) return 0;
    
    return dotProduct / (magnitudeA * magnitudeB);
  }

  async processImageFromUrl(imageUrl: string): Promise<ImageProcessingResult> {
    const startTime = Date.now();
    
    if (!this.isInitialized) {
      return {
        matches: [],
        processingTime: Date.now() - startTime,
        success: false,
        error: 'Image recognition service not initialized'
      };
    }

    try {
      console.log(`Downloading image from URL: ${imageUrl}`);
      
      // Download image from URL with proper headers
      const headers: Record<string, string> = {
        'User-Agent': 'StockSmartHub/1.0'
      };
      
      try {
        const urlObj = new URL(imageUrl);
        const host = urlObj.host.toLowerCase();
        console.log(`Image host: ${host}`);
        
        // If downloading from Meta/WhatsApp media hosts, include token
        if (host.includes('lookaside.fbsbx.com') || host.includes('facebook.com') || host.includes('fbcdn.net') || host.includes('whatsapp.com')) {
          const token = process.env.WHATSAPP_ACCESS_TOKEN || '';
          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
            console.log('Added WhatsApp authorization header');
          } else {
            console.warn('WhatsApp media URL detected but no access token available');
          }
        }
      } catch (urlError) {
        console.warn('Failed to parse image URL:', urlError.message);
      }

      const response = await axios.get(imageUrl, { 
        responseType: 'arraybuffer', 
        headers,
        timeout: 30000, // 30 second timeout
        maxContentLength: 50 * 1024 * 1024, // 50MB max
      });
      
      const imageBuffer = Buffer.from(response.data);
      console.log(`Downloaded image: ${imageBuffer.length} bytes, Content-Type: ${response.headers['content-type']}`);
      
      return await this.processImageBuffer(imageBuffer);
    } catch (error) {
      console.error('Error processing image from URL:', error);
      return {
        matches: [],
        processingTime: Date.now() - startTime,
        success: false,
        error: `Failed to process image: ${error.message}`
      };
    }
  }

  async processImageBuffer(imageBuffer: Buffer): Promise<ImageProcessingResult> {
    const startTime = Date.now();
    
    if (!this.isInitialized) {
      return {
        matches: [],
        processingTime: Date.now() - startTime,
        success: false,
        error: 'Image recognition service not initialized'
      };
    }

    try {
      // Preprocess image
      let processedImage = imageBuffer;
      if (sharp) {
        try {
          processedImage = await sharp(imageBuffer)
            .resize(224, 224) // Standard CLIP input size
            .jpeg({ quality: 90 })
            .toBuffer();
        } catch (error) {
          console.warn('Sharp processing failed, using original image:', error.message);
          processedImage = imageBuffer;
        }
      }

      // Extract text from image using OCR
      let extractedText = '';
      if (this.ocrModel) {
        try {
          // Try multiple approaches for OCR input format
          let ocrResult;
          
          // Method 1: Save as temporary file and use file path (most reliable)
          const tempPath = path.join(process.cwd(), 'temp_ocr_image.jpg');
          try {
            fs.writeFileSync(tempPath, processedImage);
            console.log('Processing OCR with file path method...');
            ocrResult = await this.ocrModel(tempPath);
            
            // Clean up temp file
            try {
              fs.unlinkSync(tempPath);
            } catch {}
            
            console.log('OCR file path method succeeded');
          } catch (fileError) {
            console.log('OCR file path method failed, trying base64...');
            
            // Method 2: Base64 data URL fallback
            try {
              const base64Image = `data:image/jpeg;base64,${processedImage.toString('base64')}`;
              ocrResult = await this.ocrModel(base64Image);
              console.log('OCR base64 method succeeded');
            } catch (base64Error) {
              console.log('OCR base64 method failed, trying buffer...');
              
              // Method 3: Raw buffer as last resort
              try {
                ocrResult = await this.ocrModel(processedImage);
                console.log('OCR buffer method succeeded');
              } catch (bufferError) {
                console.warn('All OCR input methods failed:', {
                  fileError: fileError.message,
                  base64Error: base64Error.message,
                  bufferError: bufferError.message
                });
                throw new Error('Unable to process image for OCR - all methods failed');
              }
            }
          }
          
          // Extract text from OCR result
          if (ocrResult) {
            if (Array.isArray(ocrResult) && ocrResult.length > 0) {
              extractedText = ocrResult[0]?.generated_text || ocrResult[0]?.text || '';
            } else if (typeof ocrResult === 'string') {
              extractedText = ocrResult;
            } else if (ocrResult.generated_text) {
              extractedText = ocrResult.generated_text;
            } else if (ocrResult.text) {
              extractedText = ocrResult.text;
            }
            
            console.log(`OCR extracted text: "${extractedText}"`);
          }
        } catch (ocrError) {
          // Don't log long base64 strings in error messages
          const shortError = ocrError.message.includes('data:image') ? 
            'Unable to process image format for OCR' : ocrError.message;
          console.warn('OCR processing failed:', shortError);
        }
      } else {
        console.log('OCR model not available, skipping text extraction');
      }

      // Get all products to match against
      const products = await storage.getProducts();
      console.log(`Found ${products.length} products for image matching`);
      
      // Create enhanced candidate labels for better CLIP matching
      const candidateLabels = products.map(product => {
        const name = product.name || '';
        const type = product.type || '';
        const description = product.description || '';
        
        // Create multiple label variations for better matching
        const labels = [];
        
        // Primary label: clean product name
        labels.push(name.toLowerCase().trim());
        
        // Secondary label: name + type
        if (type) {
          labels.push(`${name} ${type}`.toLowerCase().trim());
        }
        
        // Tertiary label: extract key descriptive words
        const allText = `${name} ${type} ${description}`.toLowerCase();
        const keyWords = allText.match(/\b(socket|plug|electrical|switch|wire|cable|paint|screw|bolt|nut|valve|pipe|motor|pump|bearing|gear|spring|filter|tool|adhesive|sealant|tape)\b/g);
        if (keyWords && keyWords.length > 0) {
          const uniqueWords = [...new Set(keyWords)];
          labels.push(uniqueWords.join(' '));
        }
        
        // Return the most descriptive label (prefer longer, more specific ones)
        return labels.sort((a, b) => b.length - a.length)[0];
      });
      
      // Add comprehensive category labels for better matching
      const genericLabels = [
        // Electrical components
        'electrical socket', 'power socket', 'wall socket', 'electrical plug', 'power plug', 'wall plug',
        '3 pin socket', '3 pin plug', 'three pin socket', 'three pin plug', 'grounded socket', 'grounded plug',
        'electrical outlet', 'power outlet', 'electrical switch', 'light switch', 'power switch',
        'electrical wire', 'electrical cable', 'power cable', 'extension cord',
        
        // Hardware and fasteners
        'bolt', 'screw', 'nut', 'washer', 'fastener', 'hardware',
        'metal bolt', 'steel screw', 'hex nut', 'flat washer', 'spring washer',
        
        // Mechanical parts
        'pipe', 'tube', 'valve', 'fitting', 'connector', 'coupling',
        'bearing', 'gear', 'spring', 'gasket', 'seal', 'o-ring',
        'pump', 'motor', 'fan', 'compressor',
        
        // Tools and consumables
        'tool', 'hand tool', 'power tool', 'screwdriver', 'wrench', 'pliers',
        'tape', 'adhesive', 'sealant', 'lubricant', 'oil', 'grease',
        'paint', 'primer', 'coating', 'solvent', 'cleaner',
        
        // General categories
        'electrical component', 'mechanical component', 'industrial part', 'spare part'
      ];
      
      const allLabels = [...candidateLabels, ...genericLabels];

      console.log(`Created ${allLabels.length} candidate labels (${candidateLabels.length} products + ${genericLabels.length} generic)`);
      if (candidateLabels.length > 0) {
        console.log('Sample product labels:', candidateLabels.slice(0, 3));
        console.log('Sample generic labels:', genericLabels.slice(0, 5));
      }

      if (allLabels.length === 0) {
        console.warn('No candidate labels available for image classification');
        return {
          matches: [],
          extractedText,
          processingTime: Date.now() - startTime,
          success: true,
          error: 'No products available for matching'
        };
      }

      // Use CLIP for zero-shot image classification  
      let classificationResults;
      try {
        // For CLIP zero-shot classification, try the most reliable method first
        
        // Method 1: Use file path (most reliable for transformers)
        const tempPath = path.join(process.cwd(), 'temp_image.jpg');
        try {
          fs.writeFileSync(tempPath, processedImage);
          console.log('Processing image with CLIP using file path...');
          classificationResults = await this.clipModel(tempPath, allLabels);
          
          // Clean up temp file
          try {
            fs.unlinkSync(tempPath);
          } catch {}
          
          console.log('File path method succeeded');
        } catch (fileError) {
          console.log('File path method failed, trying base64...');
          
          // Method 2: Base64 data URL fallback
          try {
            const base64Image = `data:image/jpeg;base64,${processedImage.toString('base64')}`;
            classificationResults = await this.clipModel(base64Image, allLabels);
            console.log('Base64 method succeeded');
          } catch (base64Error) {
            console.log('Base64 method failed, trying buffer...');
            
            // Method 3: Buffer as last resort
            try {
              classificationResults = await this.clipModel(processedImage, allLabels);
              console.log('Buffer method succeeded');
            } catch (bufferError) {
              console.error('All image input methods failed:', {
                fileError: fileError.message,
                base64Error: base64Error.message,
                bufferError: bufferError.message
              });
              throw new Error('Unable to process image format - all methods failed');
            }
          }
        }
        
        console.log(`CLIP processing successful, got ${classificationResults?.length || 0} results`);
        if (classificationResults && classificationResults.length > 0) {
          console.log('Top results:', classificationResults.slice(0, 3).map(r => ({ label: r.label, score: r.score })));
        }
        
      } catch (clipError) {
        console.error('CLIP processing failed:', clipError.message);
        // Return empty results if CLIP fails
        const shortError = clipError.message.includes('data:image') ? 
          'Unable to process image format' : clipError.message;
        return {
          matches: [],
          extractedText,
          processingTime: Date.now() - startTime,
          success: false,
          error: `CLIP processing failed: ${shortError}`
        };
      }
      
      // Convert classification results to product matches
      const matches: ProductMatch[] = [];
      
      for (const result of classificationResults) {
        // First, check if it's a specific product match
        const productIndex = candidateLabels.findIndex(label => 
          label === result.label
        );
        
        if (productIndex >= 0) {
          // Direct product match
          const product = products[productIndex];
          matches.push({
            productId: product.id,
            productName: product.name,
            sku: product.sku,
            confidence: result.score,
            description: product.description,
            imageUrl: product.imageUrl
          });
        } else if (genericLabels.includes(result.label) && result.score > 0.05) {
          // Generic category match - find products that might match this category
          const category = result.label.toLowerCase();
          
          // Enhanced category matching with keyword scoring
          const categoryMatches = products.map(product => {
            const text = `${product.name} ${product.type || ''} ${product.description || ''}`.toLowerCase();
            let score = 0;
            
            // Check for exact category match
            if (text.includes(category)) {
              score += 1.0;
            }
            
            // Check for individual keyword matches
            const categoryWords = category.split(' ');
            categoryWords.forEach(word => {
              if (text.includes(word)) {
                score += 0.5;
              }
            });
            
            // Boost score for electrical items if category is electrical
            if (category.includes('socket') || category.includes('plug') || category.includes('electrical')) {
              if (text.includes('socket') || text.includes('plug') || text.includes('electrical')) {
                score += 2.0;
              }
            }
            
            return { product, score };
          })
          .filter(item => item.score > 0.5)
          .sort((a, b) => b.score - a.score)
          .slice(0, 3);
          
          // Add top matching products from this category
          categoryMatches.forEach(item => {
            const existingMatch = matches.find(m => m.productId === item.product.id);
            if (!existingMatch) {
              matches.push({
                productId: item.product.id,
                productName: item.product.name,
                sku: item.product.sku,
                confidence: Math.min(result.score * item.score * 0.3, 0.9), // Scale confidence appropriately
                description: item.product.description,
                imageUrl: item.product.imageUrl
              });
            } else {
              // Boost existing match confidence if it matches multiple categories
              existingMatch.confidence = Math.min(existingMatch.confidence + (result.score * 0.2), 0.95);
            }
          });
        }
      }

      // Also try text-based matching if we extracted text from the image
      if (extractedText.length > 2) {
        const textMatches = await this.findProductsByText(extractedText);
        
        // Merge text matches with visual matches
        for (const textMatch of textMatches) {
          const existingMatch = matches.find(m => m.productId === textMatch.productId);
          if (existingMatch) {
            // Boost confidence if both visual and text matching agree
            existingMatch.confidence = Math.min(1.0, existingMatch.confidence + textMatch.confidence * 0.3);
          } else if (textMatch.confidence > 0.3) {
            // Add text-only matches with lower confidence
            matches.push({
              ...textMatch,
              confidence: textMatch.confidence * 0.7 // Reduce confidence for text-only matches
            });
          }
        }
      }

      // Filter out very low confidence matches and sort by confidence
      const filteredMatches = matches.filter(match => match.confidence > 0.03); // Only show matches with >3% confidence
      filteredMatches.sort((a, b) => b.confidence - a.confidence);
      
      // If no matches meet minimum confidence, try to find the best semantic matches
      let topMatches;
      if (filteredMatches.length === 0) {
        console.log('No matches above 3% confidence, showing top matches anyway');
        matches.sort((a, b) => b.confidence - a.confidence);
        topMatches = matches.slice(0, 3); // Show fewer matches if confidence is very low
      } else {
        topMatches = filteredMatches.slice(0, 5);
      }

      return {
        matches: topMatches,
        extractedText,
        processingTime: Date.now() - startTime,
        success: true
      };

    } catch (error) {
      console.error('Error in image processing:', error);
      // Don't include long base64 strings in error messages
      const shortError = error.message.includes('data:image') ? 
        'Unable to process image format' : error.message;
      return {
        matches: [],
        processingTime: Date.now() - startTime,
        success: false,
        error: `Image processing failed: ${shortError}`
      };
    }
  }

  private async findProductsByText(text: string): Promise<ProductMatch[]> {
    try {
      const searchTerms = text.toLowerCase().trim();
      if (searchTerms.length < 2) return [];

      // Search products using existing search functionality
      const products = await storage.searchProducts(searchTerms);
      
      return products.map(product => ({
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        confidence: this.calculateTextSimilarity(searchTerms, product.name + ' ' + (product.description || '')),
        description: product.description,
        imageUrl: product.imageUrl
      }));
    } catch (error) {
      console.error('Error in text-based product search:', error);
      return [];
    }
  }

  private calculateTextSimilarity(query: string, productText: string): number {
    const queryLower = query.toLowerCase();
    const productLower = productText.toLowerCase();
    
    // Simple keyword matching similarity
    const queryWords = queryLower.split(/\s+/);
    const productWords = productLower.split(/\s+/);
    
    let matchCount = 0;
    for (const queryWord of queryWords) {
      if (productWords.some(productWord => 
        productWord.includes(queryWord) || queryWord.includes(productWord)
      )) {
        matchCount++;
      }
    }
    
    return queryWords.length > 0 ? matchCount / queryWords.length : 0;
  }

  // Method to process and store product images for better matching
  async indexProductImage(productId: string, imageUrl: string): Promise<boolean> {
    try {
      if (!this.isInitialized) {
        console.warn('Image recognition service not initialized');
        return false;
      }

      let imageBuffer: Buffer;
      
      // Check if this is a local file path or external URL
      if (imageUrl.includes('/uploads/products/')) {
        // Local file - read directly from disk
        const path = await import('path');
        const fs = await import('fs');
        const filename = imageUrl.split('/uploads/products/')[1];
        const filePath = path.join(process.cwd(), 'uploads', 'products', filename);
        
        if (fs.existsSync(filePath)) {
          imageBuffer = fs.readFileSync(filePath);
        } else {
          console.warn(`Local image file not found: ${filePath}`);
          return false;
        }
      } else {
        // External URL - download via HTTP
        const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        imageBuffer = Buffer.from(response.data);
      }
      
      // Process image to extract features
      let processedImage = imageBuffer;
      if (sharp) {
        try {
          processedImage = await sharp(imageBuffer)
            .resize(224, 224)
            .jpeg({ quality: 90 })
            .toBuffer();
        } catch (error) {
          console.warn('Sharp processing failed for indexing:', error.message);
          processedImage = imageBuffer;
        }
      }

      // For now, we'll create a simple feature vector
      // In a full implementation, you'd extract actual CLIP visual features
      const product = await storage.getProduct(productId);
      if (product) {
        const textInput = `${product.name} ${product.description || ''} ${product.type || ''}`;
        const features = this.createTextFeatureVector(textInput);
        this.productFeatures.set(productId, features);
        
        console.log(`Indexed image features for product ${productId}`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error(`Failed to index product image ${productId}:`, error);
      return false;
    }
  }

  // Method to get service status
  getStatus(): { initialized: boolean; productsIndexed: number } {
    return {
      initialized: this.isInitialized,
      productsIndexed: this.productFeatures.size
    };
  }

  // Method to reinitialize and reload product features
  async reload(): Promise<void> {
    this.productFeatures.clear();
    await this.precomputeProductFeatures();
  }
}

// Singleton instance
export const imageRecognitionService = new ImageRecognitionService();
