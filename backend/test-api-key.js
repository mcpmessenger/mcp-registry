#!/usr/bin/env node

/**
 * Test Gemini API Key
 * 
 * This script tests if your Gemini API key is valid and has quota available.
 * Run: node test-api-key.js YOUR_API_KEY
 */

const apiKey = process.argv[2] || process.env.GEMINI_API_KEY || process.env.API_KEY;

if (!apiKey) {
  console.error('❌ Error: No API key provided');
  console.log('\nUsage:');
  console.log('  node test-api-key.js YOUR_API_KEY');
  console.log('  OR set GEMINI_API_KEY environment variable');
  process.exit(1);
}

console.log('🔑 Testing Gemini API Key...');
console.log(`   Key (first 10 chars): ${apiKey.substring(0, 10)}...`);
console.log('');

// Test 1: List available models first
async function listModels() {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (response.ok && data.models) {
      console.log('📋 Available Models:');
      data.models.forEach(model => {
        console.log(`   - ${model.name}`);
      });
      console.log('');
      
      // Find image generation models
      const imageModels = data.models.filter(m => 
        m.name.includes('image') || 
        m.name.includes('imagen') ||
        m.supportedGenerationMethods?.includes('generateContent')
      );
      
      if (imageModels.length > 0) {
        console.log('🖼️  Image Generation Models:');
        imageModels.forEach(model => {
          console.log(`   - ${model.name}`);
        });
        console.log('');
      }
      
      return data.models;
    }
  } catch (error) {
    console.warn('⚠️  Could not list models:', error.message);
  }
  return [];
}

// Test 2: Simple API call with a known working model
async function testAPIKey() {
  try {
    // First list models to see what's available
    const models = await listModels();
    
    // Use gemini-2.5-flash (available from the list)
    const modelName = 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    
    console.log(`🧪 Testing with model: ${modelName}`);
    console.log('');
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: 'Say hello in one word'
          }]
        }],
        generationConfig: {
          temperature: 0.7,
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 400) {
        console.error('❌ Invalid API Key');
        console.error('   Error:', data.error?.message || JSON.stringify(data));
        if (data.error?.message?.includes('API key not valid')) {
          console.error('\n💡 The API key is invalid. Please check:');
          console.error('   1. Get a new key from: https://aistudio.google.com/apikey');
          console.error('   2. Make sure you copied the full key');
          console.error('   3. Check that the key hasn\'t been revoked');
        }
        process.exit(1);
      } else if (response.status === 429) {
        console.error('❌ API Quota Exceeded');
        console.error('   Error:', data.error?.message || JSON.stringify(data));
        console.error('\n💡 Your API key is valid but quota is exceeded.');
        console.error('   Check quota at: https://ai.dev/usage?tab=rate-limit');
        process.exit(1);
      } else {
        console.error(`❌ API Error (${response.status})`);
        console.error('   Error:', data.error?.message || JSON.stringify(data));
        process.exit(1);
      }
    }

    console.log('✅ API Key is VALID!');
    console.log('');
    console.log('📊 Response:');
    if (data.candidates && data.candidates[0]) {
      const candidate = data.candidates[0];
      if (candidate.content && candidate.content.parts) {
        const parts = candidate.content.parts;
        console.log(`   Generated ${parts.length} content part(s)`);
        parts.forEach((part, i) => {
          if (part.text) {
            console.log(`   Part ${i + 1}: "${part.text}"`);
          } else if (part.inlineData) {
            console.log(`   Part ${i + 1}: Image (${part.inlineData.mimeType}, ${part.inlineData.data.length} bytes)`);
          } else {
            console.log(`   Part ${i + 1}: ${JSON.stringify(part).substring(0, 100)}`);
          }
        });
      }
    } else {
      console.log('   Response:', JSON.stringify(data, null, 2).substring(0, 500));
    }
    console.log('');
    console.log('✅ Your API key is working correctly!');
    console.log('');
    console.log('💡 Note: Image generation may use a different model/endpoint.');
    console.log('   The Nano Banana MCP server handles this internally.');
    console.log('');
    console.log('💡 Next steps:');
    console.log('   1. Update the key in MCP Registry UI');
    console.log('   2. Or update via API (see UPDATE_API_KEY.md)');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.message.includes('fetch')) {
      console.error('\n💡 Network error. Check your internet connection.');
    }
    process.exit(1);
  }
}

testAPIKey();

