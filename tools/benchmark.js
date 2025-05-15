#!/usr/bin/env node

/**
 * XRAI Format Benchmark and Performance Test
 * Tests encoding/decoding performance and optimizes the implementation
 */

const fs = require('fs');
const path = require('path');
const { XRAISimpleEncoder } = require('./xrai-simple-encoder');
const { XRAISimpleDecoder } = require('./xrai-simple-decoder');

// Sample data sizes
const SIZES = {
  small: 10 * 1024,      // 10 KB
  medium: 100 * 1024,    // 100 KB
  large: 1024 * 1024,    // 1 MB
  xlarge: 10 * 1024 * 1024 // 10 MB
};

// Test file paths
const TEST_DIR = path.join(__dirname, '..', 'test');
const BENCHMARK_RESULTS = path.join(TEST_DIR, 'benchmark-results.json');

// Create test directory if it doesn't exist
if (!fs.existsSync(TEST_DIR)) {
  fs.mkdirSync(TEST_DIR, { recursive: true });
}

// Utility to measure execution time
function measureTime(fn) {
  const start = process.hrtime.bigint();
  const result = fn();
  const end = process.hrtime.bigint();
  const duration = Number(end - start) / 1_000_000; // Convert to milliseconds
  return { result, duration };
}

// Generate test data of specified size
function generateTestData(size) {
  // Create a deep object structure to simulate real-world data
  const data = {
    asset: {
      version: '1.0',
      generator: 'XRAI Benchmark',
      copyright: `Copyright ${new Date().getFullYear()}`
    },
    metadata: {
      title: `Benchmark Test (${size} bytes)`,
      creator: 'XRAI Benchmark Tool',
      created: new Date().toISOString(),
      description: 'Generated test data for performance benchmarking'
    },
    geometry: [],
    materials: [],
    aiComponents: {
      adaptationRules: [],
      behaviorModels: []
    }
  };
  
  // Add geometry to reach target size
  const itemsNeeded = Math.max(1, Math.floor(size / 1000));
  
  for (let i = 0; i < itemsNeeded; i++) {
    // Add mesh geometry
    data.geometry.push({
      id: `mesh_${i}`,
      type: 'mesh',
      vertices: Array(24).fill(0).map(() => Math.random() * 10 - 5),
      triangles: Array(12).fill(0).map((_, i) => [i % 8, (i + 1) % 8, (i + 2) % 8])
    });
    
    // Add material
    data.materials.push({
      id: `material_${i}`,
      type: 'standard',
      color: [Math.random(), Math.random(), Math.random()],
      metalness: Math.random(),
      roughness: Math.random()
    });
    
    // Add AI components
    if (i % 10 === 0) {
      data.aiComponents.adaptationRules.push({
        id: `rule_${i}`,
        condition: `context.parameter_${i} < ${Math.floor(Math.random() * 100)}`,
        action: `adjustQuality(${Math.random().toFixed(2)})`
      });
      
      data.aiComponents.behaviorModels.push({
        id: `model_${i}`,
        type: 'regression',
        inputs: ['input1', 'input2', 'input3'],
        outputs: ['output1', 'output2']
      });
    }
  }
  
  return data;
}

// Run encoding benchmark
async function runEncodingBenchmark() {
  console.log('\n=== Encoding Benchmark ===');
  
  const results = {};
  const encoder = new XRAISimpleEncoder();
  
  for (const [sizeKey, sizeValue] of Object.entries(SIZES)) {
    console.log(`\nTesting ${sizeKey} data (${sizeValue / 1024} KB):`);
    
    // Generate test data
    console.log('  Generating test data...');
    const testData = generateTestData(sizeValue);
    
    // Save test data to file
    const testDataPath = path.join(TEST_DIR, `test-data-${sizeKey}.json`);
    fs.writeFileSync(testDataPath, JSON.stringify(testData));
    
    // Measure JSON stringify/parse performance as baseline
    console.log('  Measuring JSON performance (baseline)...');
    const jsonStringify = measureTime(() => JSON.stringify(testData));
    const jsonParse = measureTime(() => JSON.parse(jsonStringify.result));
    
    // Measure XRAI encoding performance
    console.log('  Measuring XRAI encoding performance...');
    const xraiPath = path.join(TEST_DIR, `test-data-${sizeKey}.xrai`);
    const encoding = measureTime(() => encoder.encode(testDataPath, xraiPath));
    
    // Get encoded file size
    const encodedSize = fs.statSync(xraiPath).size;
    const compressionRatio = (encodedSize / jsonStringify.result.length * 100).toFixed(2);
    
    results[sizeKey] = {
      dataSize: sizeValue,
      jsonStringifyTime: jsonStringify.duration,
      jsonParseTime: jsonParse.duration,
      jsonSize: jsonStringify.result.length,
      xraiEncodeTime: encoding.duration,
      xraiSize: encodedSize,
      compressionRatio: `${compressionRatio}%`
    };
    
    console.log(`  Results for ${sizeKey}:`);
    console.log(`    JSON stringify: ${jsonStringify.duration.toFixed(2)} ms`);
    console.log(`    JSON size: ${jsonStringify.result.length} bytes`);
    console.log(`    XRAI encode: ${encoding.duration.toFixed(2)} ms`);
    console.log(`    XRAI size: ${encodedSize} bytes (${compressionRatio}% of JSON)`);
  }
  
  return results;
}

// Run decoding benchmark
async function runDecodingBenchmark(encodingResults) {
  console.log('\n=== Decoding Benchmark ===');
  
  const results = {};
  const decoder = new XRAISimpleDecoder();
  
  for (const [sizeKey, sizeValue] of Object.entries(SIZES)) {
    console.log(`\nTesting ${sizeKey} data (${sizeValue / 1024} KB):`);
    
    const xraiPath = path.join(TEST_DIR, `test-data-${sizeKey}.xrai`);
    
    // Measure XRAI validation performance
    console.log('  Measuring XRAI validation performance...');
    const validation = measureTime(() => decoder.validate(xraiPath));
    
    // Measure XRAI decoding performance
    console.log('  Measuring XRAI decoding performance...');
    const decoding = measureTime(() => decoder.decode(xraiPath));
    
    results[sizeKey] = {
      dataSize: sizeValue,
      xraiValidateTime: validation.duration,
      xraiDecodeTime: decoding.duration,
      validationResult: validation.result.valid,
      ...encodingResults[sizeKey]
    };
    
    console.log(`  Results for ${sizeKey}:`);
    console.log(`    XRAI validate: ${validation.duration.toFixed(2)} ms`);
    console.log(`    XRAI decode: ${decoding.duration.toFixed(2)} ms`);
    console.log(`    Validation result: ${validation.result.valid ? 'Valid' : 'Invalid'}`);
    
    // Compare with JSON parse time
    const speedupRatio = (results[sizeKey].jsonParseTime / decoding.duration).toFixed(2);
    console.log(`    Speed comparison: XRAI decode is ${speedupRatio}x ${speedupRatio > 1 ? 'faster' : 'slower'} than JSON parse`);
  }
  
  return results;
}

// Run memory usage benchmark
function runMemoryBenchmark(results) {
  console.log('\n=== Memory Usage Benchmark ===');
  
  for (const sizeKey of Object.keys(SIZES)) {
    console.log(`\nTesting ${sizeKey} data memory usage:`);
    
    const xraiPath = path.join(TEST_DIR, `test-data-${sizeKey}.xrai`);
    const jsonPath = path.join(TEST_DIR, `test-data-${sizeKey}.json`);
    
    // Measure memory before
    const memBefore = process.memoryUsage();
    
    // Load JSON
    const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    
    // Measure memory after JSON load
    const memAfterJson = process.memoryUsage();
    
    // Clear and force GC if available
    global.gc && global.gc();
    
    // Load XRAI
    const decoder = new XRAISimpleDecoder();
    const xraiData = decoder.decode(xraiPath);
    
    // Measure memory after XRAI load
    const memAfterXrai = process.memoryUsage();
    
    // Calculate memory usage
    const jsonMemoryUsage = memAfterJson.heapUsed - memBefore.heapUsed;
    const xraiMemoryUsage = memAfterXrai.heapUsed - memAfterJson.heapUsed;
    
    results[sizeKey].jsonMemoryUsage = jsonMemoryUsage;
    results[sizeKey].xraiMemoryUsage = xraiMemoryUsage;
    results[sizeKey].memoryRatio = (xraiMemoryUsage / jsonMemoryUsage * 100).toFixed(2) + '%';
    
    console.log(`  JSON memory usage: ${(jsonMemoryUsage / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  XRAI memory usage: ${(xraiMemoryUsage / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  XRAI uses ${results[sizeKey].memoryRatio} of the memory compared to JSON`);
  }
  
  return results;
}

// Run all benchmarks
async function runBenchmarks() {
  console.log('Starting XRAI format benchmarks...');
  
  // Run encoding benchmark
  const encodingResults = await runEncodingBenchmark();
  
  // Run decoding benchmark
  const decodingResults = await runDecodingBenchmark(encodingResults);
  
  // Run memory benchmark
  const memoryResults = runMemoryBenchmark(decodingResults);
  
  // Save results
  fs.writeFileSync(BENCHMARK_RESULTS, JSON.stringify(memoryResults, null, 2));
  
  console.log('\n=== Benchmark Summary ===');
  console.log(`Results saved to: ${BENCHMARK_RESULTS}`);
  
  // Print summary table
  console.log('\nPerformance comparison:');
  console.log('┌────────┬──────────┬──────────┬──────────┬──────────┬──────────┐');
  console.log('│ Size   │ Encode   │ Decode   │ Size     │ Memory   │ Valid    │');
  console.log('├────────┼──────────┼──────────┼──────────┼──────────┼──────────┤');
  
  for (const [sizeKey, result] of Object.entries(memoryResults)) {
    const encodeRatio = (result.xraiEncodeTime / result.jsonStringifyTime).toFixed(2);
    const decodeRatio = (result.xraiDecodeTime / result.jsonParseTime).toFixed(2);
    
    console.log(`│ ${sizeKey.padEnd(6)} │ ${encodeRatio.padEnd(8)} │ ${decodeRatio.padEnd(8)} │ ${result.compressionRatio.padEnd(8)} │ ${result.memoryRatio.padEnd(8)} │ ${result.validationResult ? 'Yes' : 'No'} │`);
  }
  
  console.log('└────────┴──────────┴──────────┴──────────┴──────────┴──────────┘');
  
  console.log('\nBenchmarks completed.');
}

// Run the benchmarks
runBenchmarks().catch(error => {
  console.error('Benchmark failed:', error);
  process.exit(1);
});
