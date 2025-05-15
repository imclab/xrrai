#!/usr/bin/env node

/**
 * XRAI Format Test Script
 * Demonstrates encoding and decoding of XRAI files
 */

const fs = require('fs');
const path = require('path');
const { XRAISimpleEncoder } = require('./xrai-simple-encoder');
const { XRAISimpleDecoder } = require('./xrai-simple-decoder');

// Test file paths
const testJsonPath = path.join(__dirname, '..', 'examples', 'test-scene.json');
const testXraiPath = path.join(__dirname, '..', 'examples', 'test-scene.xrai');

// Create encoder and decoder
const encoder = new XRAISimpleEncoder();
const decoder = new XRAISimpleDecoder();

// Function to run the test
async function runTest() {
  console.log('=== XRAI Format Test ===\n');
  
  // Step 1: Encode JSON to XRAI
  console.log('Step 1: Encoding JSON to XRAI format');
  try {
    encoder.encode(testJsonPath, testXraiPath);
    console.log('✅ Encoding successful\n');
  } catch (error) {
    console.error('❌ Encoding failed:', error.message);
    process.exit(1);
  }
  
  // Step 2: Validate XRAI file
  console.log('Step 2: Validating XRAI file');
  try {
    const validationResult = decoder.validate(testXraiPath);
    if (validationResult.valid) {
      console.log(`✅ Validation successful (version ${validationResult.version})\n`);
    } else {
      console.error('❌ Validation failed:', validationResult.errors.join(', '));
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Validation failed:', error.message);
    process.exit(1);
  }
  
  // Step 3: Decode XRAI file
  console.log('Step 3: Decoding XRAI file');
  try {
    const decodedData = decoder.decode(testXraiPath);
    console.log('✅ Decoding successful');
    
    // Display metadata
    console.log('\nMetadata:');
    console.log(`  Title: ${decodedData.metadata.title}`);
    console.log(`  Creator: ${decodedData.metadata.creator}`);
    console.log(`  Version: ${decodedData.metadata.version}`);
    console.log(`  Created: ${decodedData.metadata.created}`);
    
    // Display geometry summary
    if (decodedData.geometry) {
      console.log('\nGeometry:');
      decodedData.geometry.forEach(geo => {
        console.log(`  ${geo.id} (${geo.type}):`);
        if (geo.type === 'mesh') {
          console.log(`    Vertices: ${geo.vertices.length}`);
          console.log(`    Triangles: ${geo.triangles.length}`);
        }
      });
    }
    
    // Display AI components
    if (decodedData.aiComponents) {
      console.log('\nAI Components:');
      if (decodedData.aiComponents.adaptationRules) {
        console.log(`  Adaptation Rules: ${decodedData.aiComponents.adaptationRules.length}`);
        decodedData.aiComponents.adaptationRules.forEach(rule => {
          console.log(`    ${rule.id}: ${rule.condition} => ${rule.action}`);
        });
      }
    }
    
    console.log('\n✅ Test completed successfully');
  } catch (error) {
    console.error('❌ Decoding failed:', error.message);
    process.exit(1);
  }
}

// Run the test
runTest().catch(error => {
  console.error('Test failed with error:', error);
  process.exit(1);
});
