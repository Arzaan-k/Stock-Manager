#!/usr/bin/env node

/**
 * Test script for the WhatsApp Image Recognition Feature
 * 
 * This script tests the complete image recognition workflow:
 * 1. Initialize the image recognition service
 * 2. Test image processing from URL
 * 3. Test product matching
 * 4. Show how the WhatsApp integration would work
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from 'dotenv';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config();

import { imageRecognitionService } from './server/services/image-recognition.ts';
import { productImageManager } from './server/services/product-image-manager.ts';
import { storage } from './server/storage.ts';

async function testImageRecognition() {
  console.log('🔍 Testing WhatsApp Image Recognition System');
  console.log('=' .repeat(50));

  try {
    // Wait a bit for services to initialize
    console.log('⏳ Waiting for services to initialize...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check service status
    const status = imageRecognitionService.getStatus();
    console.log(`\n📊 Image Recognition Service Status:`);
    console.log(`   Initialized: ${status.initialized ? '✅' : '❌'}`);
    console.log(`   Products Indexed: ${status.productsIndexed}`);

    // Get some sample products
    console.log('\n📦 Getting sample products from database...');
    const products = await storage.getProducts();
    console.log(`   Found ${products.length} products in database`);

    if (products.length === 0) {
      console.log('⚠️  No products found in database. Please add some products first.');
      return;
    }

    // Show first few products
    console.log('\n   Sample products:');
    products.slice(0, 5).forEach((product, i) => {
      console.log(`   ${i + 1}. ${product.name} (SKU: ${product.sku})`);
    });

    // Test with a sample image URL (this is your example URL)
    const testImageUrl = 'https://image.made-in-china.com/2f0j00tVfbEqwsrSod/AC-Cable-Wiring-Harness-Molded-Compressor-Plug-Fit-Carrier-Air-Conditioner.webp';
    
    console.log(`\n🖼️  Testing image recognition with sample URL:`);
    console.log(`   URL: ${testImageUrl}`);

    try {
      const startTime = Date.now();
      const result = await imageRecognitionService.processImageFromUrl(testImageUrl);
      const processingTime = Date.now() - startTime;

      console.log(`\n📈 Recognition Results (${processingTime}ms):`);
      console.log(`   Success: ${result.success ? '✅' : '❌'}`);
      console.log(`   Processing Time: ${result.processingTime}ms`);
      
      if (result.extractedText) {
        console.log(`   Extracted Text: "${result.extractedText}"`);
      }

      if (result.matches && result.matches.length > 0) {
        console.log(`   Found ${result.matches.length} product matches:`);
        result.matches.forEach((match, i) => {
          const confidence = Math.round(match.confidence * 100);
          console.log(`   ${i + 1}. ${match.productName} (${confidence}% confidence)`);
          console.log(`      SKU: ${match.sku}`);
          if (match.description) {
            console.log(`      Description: ${match.description}`);
          }
        });
      } else {
        console.log('   No product matches found');
      }

      if (!result.success && result.error) {
        console.log(`   Error: ${result.error}`);
      }

    } catch (error) {
      console.error('❌ Error processing image:', error.message);
    }

    // Test the image management system
    console.log('\n💾 Testing Product Image Management...');
    const imageStats = await productImageManager.getStats();
    console.log(`   Total Products: ${imageStats.totalProducts}`);
    console.log(`   Products with Images: ${imageStats.productsWithImages}`);
    console.log(`   Products without Images: ${imageStats.productsWithoutImages}`);
    console.log(`   Total Images: ${imageStats.totalImages}`);

    // Simulate WhatsApp workflow
    console.log('\n📱 Simulating WhatsApp Image Recognition Workflow:');
    console.log('   1. User sends image via WhatsApp');
    console.log('   2. WhatsApp webhook receives image');
    console.log('   3. System downloads image from WhatsApp');
    console.log('   4. Image recognition service processes image');
    console.log('   5. System presents product matches to user');
    console.log('   6. User selects correct product');
    console.log('   7. System proceeds with inventory action (add stock/create order)');

    // Show sample WhatsApp responses
    console.log('\n💬 Sample WhatsApp Responses:');
    
    if (result && result.matches && result.matches.length > 0) {
      console.log('\n   If multiple matches found:');
      console.log('   "🎯 I found these possible matches for your image:"');
      result.matches.slice(0, 3).forEach((match, i) => {
        const confidence = Math.round(match.confidence * 100);
        console.log(`   "${i + 1}. ${match.productName}"`);
        console.log(`   "   SKU: ${match.sku}"`);
        console.log(`   "   Confidence: ${confidence}%"`);
      });
      console.log('   "Please reply with the number (1-3) of the correct product"');

      console.log('\n   After user selects product:');
      console.log('   "✅ Product Identified:"');
      console.log(`   "📦 ${result.matches[0].productName}"`);
      console.log(`   "SKU: ${result.matches[0].sku}"`);
      console.log('   "What would you like to do?"');
      console.log('   "• Type \\"add [quantity]\\" to add stock"');
      console.log('   "• Type \\"order [quantity]\\" to create an order"');
    } else {
      console.log('\n   If no matches found:');
      console.log('   "❓ I couldn\'t identify any products from your image."');
      console.log('   "Please try:"');
      console.log('   "• Sending a clearer image"');
      console.log('   "• Describing the product in text"');
      console.log('   "• Including product labels or SKU in the image"');
    }

    console.log('\n✅ Image Recognition Test Complete!');
    console.log('\n📋 Next Steps to Make It Production Ready:');
    console.log('   1. Upload actual product images to your system');
    console.log('   2. Configure WhatsApp Business API properly');
    console.log('   3. Test with real WhatsApp messages');
    console.log('   4. Fine-tune recognition accuracy thresholds');
    console.log('   5. Add more product data for better matching');

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error(error.stack);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down test...');
  process.exit(0);
});

// Run the test
testImageRecognition().catch(console.error);
