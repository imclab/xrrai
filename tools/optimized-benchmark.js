#!/usr/bin/env node

/**
 * XRAI Format Optimized Benchmark
 * Tests the performance of the optimized encoder and decoder
 */

const fs = require('fs');
const path = require('path');
const { XRAISimpleEncoder } = require('./xrai-simple-encoder');
const { XRAISimpleDecoder } = require('./xrai-simple-decoder');
const { XRAIOptimizedEncoder } = require('./xrai-optimized-encoder');
const { XRAIOptimizedDecoder } = require('./xrai-optimized-decoder');

// Sample data sizes
const SIZES = {
  small: 10 * 1024,      // 10 KB
  medium: 100 * 1024,    // 100 KB
  large: 1024 * 1024,    // 1 MB
  xlarge: 10 * 1024 * 1024 // 10 MB
};

// Test file paths
const TEST_DIR = path.join(__dirname, '..', 'test');
const BENCHMARK_RESULTS = path.join(TEST_DIR, 'optimized-benchmark-results.json');

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

// Run comparative benchmark
async function runComparativeBenchmark() {
  console.log('\n=== XRAI Format Comparative Benchmark ===');
  
  const results = {};
  
  // Initialize encoders and decoders
  const simpleEncoder = new XRAISimpleEncoder();
  const simpleDecoder = new XRAISimpleDecoder();
  const optimizedEncoder = new XRAIOptimizedEncoder();
  const optimizedDecoder = new XRAIOptimizedDecoder();
  
  // Test with different compression options
  const compressionOptions = [
    { name: 'no_compression', options: { compress: false } },
    { name: 'default_compression', options: { compress: true, compressionLevel: 6 } },
    { name: 'max_compression', options: { compress: true, compressionLevel: 9 } },
    { name: 'fast_compression', options: { compress: true, compressionLevel: 1 } }
  ];
  
  for (const [sizeKey, sizeValue] of Object.entries(SIZES)) {
    console.log(`\nTesting ${sizeKey} data (${sizeValue / 1024} KB):`);
    results[sizeKey] = {};
    
    // Generate test data
    console.log('  Generating test data...');
    const testData = generateTestData(sizeValue);
    
    // Save test data to file
    const testDataPath = path.join(TEST_DIR, `optimized-test-data-${sizeKey}.json`);
    fs.writeFileSync(testDataPath, JSON.stringify(testData));
    
    // Measure JSON stringify/parse performance as baseline
    console.log('  Measuring JSON performance (baseline)...');
    const jsonStringify = measureTime(() => JSON.stringify(testData));
    const jsonParse = measureTime(() => JSON.parse(jsonStringify.result));
    
    results[sizeKey].baseline = {
      dataSize: sizeValue,
      jsonStringifyTime: jsonStringify.duration,
      jsonParseTime: jsonParse.duration,
      jsonSize: jsonStringify.result.length
    };
    
    // Test simple encoder/decoder
    console.log('  Testing simple encoder/decoder...');
    const simpleXraiPath = path.join(TEST_DIR, `simple-${sizeKey}.xrai`);
    
    const simpleEncoding = measureTime(() => simpleEncoder.encode(testDataPath, simpleXraiPath));
    const simpleValidation = measureTime(() => simpleDecoder.validate(simpleXraiPath));
    const simpleDecoding = measureTime(() => simpleDecoder.decode(simpleXraiPath));
    
    const simpleSize = fs.statSync(simpleXraiPath).size;
    
    results[sizeKey].simple = {
      encodeTime: simpleEncoding.duration,
      validateTime: simpleValidation.duration,
      decodeTime: simpleDecoding.duration,
      fileSize: simpleSize,
      compressionRatio: (simpleSize / jsonStringify.result.length * 100).toFixed(2) + '%'
    };
    
    // Test optimized encoder/decoder with different compression options
    for (const compressionOption of compressionOptions) {
      console.log(`  Testing optimized encoder/decoder (${compressionOption.name})...`);
      
      const optimizedEncoder = new XRAIOptimizedEncoder(compressionOption.options);
      const optimizedXraiPath = path.join(TEST_DIR, `optimized-${compressionOption.name}-${sizeKey}.xrai`);
      
      const optimizedEncoding = measureTime(() => optimizedEncoder.encode(testDataPath, optimizedXraiPath));
      const optimizedValidation = measureTime(() => optimizedDecoder.validate(optimizedXraiPath));
      const optimizedDecoding = measureTime(() => optimizedDecoder.decode(optimizedXraiPath));
      
      const optimizedSize = fs.statSync(optimizedXraiPath).size;
      
      results[sizeKey][compressionOption.name] = {
        encodeTime: optimizedEncoding.duration,
        validateTime: optimizedValidation.duration,
        decodeTime: optimizedDecoding.duration,
        fileSize: optimizedSize,
        compressionRatio: (optimizedSize / jsonStringify.result.length * 100).toFixed(2) + '%'
      };
    }
    
    // Print results for this size
    console.log(`\n  Results for ${sizeKey}:`);
    console.log(`    JSON stringify: ${results[sizeKey].baseline.jsonStringifyTime.toFixed(2)} ms`);
    console.log(`    JSON parse: ${results[sizeKey].baseline.jsonParseTime.toFixed(2)} ms`);
    console.log(`    JSON size: ${results[sizeKey].baseline.jsonSize} bytes`);
    console.log(`    Simple encode: ${results[sizeKey].simple.encodeTime.toFixed(2)} ms`);
    console.log(`    Simple decode: ${results[sizeKey].simple.decodeTime.toFixed(2)} ms`);
    console.log(`    Simple size: ${results[sizeKey].simple.fileSize} bytes (${results[sizeKey].simple.compressionRatio})`);
    
    for (const compressionOption of compressionOptions) {
      const optResults = results[sizeKey][compressionOption.name];
      console.log(`    Optimized ${compressionOption.name} encode: ${optResults.encodeTime.toFixed(2)} ms`);
      console.log(`    Optimized ${compressionOption.name} decode: ${optResults.decodeTime.toFixed(2)} ms`);
      console.log(`    Optimized ${compressionOption.name} size: ${optResults.fileSize} bytes (${optResults.compressionRatio})`);
    }
  }
  
  // Save results
  fs.writeFileSync(BENCHMARK_RESULTS, JSON.stringify(results, null, 2));
  
  return results;
}

// Run streaming benchmark
async function runStreamingBenchmark(results) {
  console.log('\n=== Streaming Performance Benchmark ===');
  
  // Only test with large and xlarge data
  const testSizes = ['large', 'xlarge'];
  
  for (const sizeKey of testSizes) {
    console.log(`\nTesting streaming with ${sizeKey} data:`);
    
    const testDataPath = path.join(TEST_DIR, `optimized-test-data-${sizeKey}.json`);
    const streamXraiPath = path.join(TEST_DIR, `stream-${sizeKey}.xrai`);
    
    // Test with different chunk sizes
    const chunkSizes = [4096, 16384, 65536, 262144];
    
    results[sizeKey].streaming = {};
    
    for (const chunkSize of chunkSizes) {
      console.log(`  Testing with chunk size ${chunkSize / 1024}KB...`);
      
      const optimizedEncoder = new XRAIOptimizedEncoder({
        compress: true,
        compressionLevel: 6,
        chunkSize
      });
      
      // Measure streaming encode time
      console.log('    Measuring streaming encode...');
      const startEncode = process.hrtime.bigint();
      await optimizedEncoder.streamEncode(testDataPath, streamXraiPath);
      const endEncode = process.hrtime.bigint();
      const encodeTime = Number(endEncode - startEncode) / 1_000_000;
      
      // Measure streaming decode time
      console.log('    Measuring streaming decode...');
      const optimizedDecoder = new XRAIOptimizedDecoder();
      
      const startDecode = process.hrtime.bigint();
      await optimizedDecoder.streamDecode(streamXraiPath, { chunkSize });
      const endDecode = process.hrtime.bigint();
      const decodeTime = Number(endDecode - startDecode) / 1_000_000;
      
      // Store results
      results[sizeKey].streaming[`chunk_${chunkSize}`] = {
        chunkSize,
        encodeTime,
        decodeTime,
        fileSize: fs.statSync(streamXraiPath).size
      };
      
      console.log(`    Stream encode time: ${encodeTime.toFixed(2)} ms`);
      console.log(`    Stream decode time: ${decodeTime.toFixed(2)} ms`);
    }
  }
  
  // Update results file
  fs.writeFileSync(BENCHMARK_RESULTS, JSON.stringify(results, null, 2));
  
  return results;
}

// Print summary table
function printSummaryTable(results) {
  console.log('\n=== Performance Comparison Summary ===');
  
  // Print encoding performance
  console.log('\nEncoding Performance (relative to JSON stringify):');
  console.log('┌────────┬──────────┬──────────┬──────────┬──────────┬──────────┐');
  console.log('│ Size   │ Simple   │ No Comp  │ Default  │ Max Comp │ Fast Comp│');
  console.log('├────────┼──────────┼──────────┼──────────┼──────────┼──────────┤');
  
  for (const [sizeKey, result] of Object.entries(results)) {
    if (!result.baseline) continue;
    
    const simpleRatio = (result.simple.encodeTime / result.baseline.jsonStringifyTime).toFixed(2);
    const noCompRatio = (result.no_compression.encodeTime / result.baseline.jsonStringifyTime).toFixed(2);
    const defaultRatio = (result.default_compression.encodeTime / result.baseline.jsonStringifyTime).toFixed(2);
    const maxRatio = (result.max_compression.encodeTime / result.baseline.jsonStringifyTime).toFixed(2);
    const fastRatio = (result.fast_compression.encodeTime / result.baseline.jsonStringifyTime).toFixed(2);
    
    console.log(`│ ${sizeKey.padEnd(6)} │ ${simpleRatio.padEnd(8)} │ ${noCompRatio.padEnd(8)} │ ${defaultRatio.padEnd(8)} │ ${maxRatio.padEnd(8)} │ ${fastRatio.padEnd(8)} │`);
  }
  
  console.log('└────────┴──────────┴──────────┴──────────┴──────────┴──────────┘');
  
  // Print decoding performance
  console.log('\nDecoding Performance (relative to JSON parse):');
  console.log('┌────────┬──────────┬──────────┬──────────┬──────────┬──────────┐');
  console.log('│ Size   │ Simple   │ No Comp  │ Default  │ Max Comp │ Fast Comp│');
  console.log('├────────┼──────────┼──────────┼──────────┼──────────┼──────────┤');
  
  for (const [sizeKey, result] of Object.entries(results)) {
    if (!result.baseline) continue;
    
    const simpleRatio = (result.simple.decodeTime / result.baseline.jsonParseTime).toFixed(2);
    const noCompRatio = (result.no_compression.decodeTime / result.baseline.jsonParseTime).toFixed(2);
    const defaultRatio = (result.default_compression.decodeTime / result.baseline.jsonParseTime).toFixed(2);
    const maxRatio = (result.max_compression.decodeTime / result.baseline.jsonParseTime).toFixed(2);
    const fastRatio = (result.fast_compression.decodeTime / result.baseline.jsonParseTime).toFixed(2);
    
    console.log(`│ ${sizeKey.padEnd(6)} │ ${simpleRatio.padEnd(8)} │ ${noCompRatio.padEnd(8)} │ ${defaultRatio.padEnd(8)} │ ${maxRatio.padEnd(8)} │ ${fastRatio.padEnd(8)} │`);
  }
  
  console.log('└────────┴──────────┴──────────┴──────────┴──────────┴──────────┘');
  
  // Print file size comparison
  console.log('\nFile Size (% of JSON):');
  console.log('┌────────┬──────────┬──────────┬──────────┬──────────┬──────────┐');
  console.log('│ Size   │ Simple   │ No Comp  │ Default  │ Max Comp │ Fast Comp│');
  console.log('├────────┼──────────┼──────────┼──────────┼──────────┼──────────┤');
  
  for (const [sizeKey, result] of Object.entries(results)) {
    if (!result.baseline) continue;
    
    const simpleRatio = result.simple.compressionRatio;
    const noCompRatio = result.no_compression.compressionRatio;
    const defaultRatio = result.default_compression.compressionRatio;
    const maxRatio = result.max_compression.compressionRatio;
    const fastRatio = result.fast_compression.compressionRatio;
    
    console.log(`│ ${sizeKey.padEnd(6)} │ ${simpleRatio.padEnd(8)} │ ${noCompRatio.padEnd(8)} │ ${defaultRatio.padEnd(8)} │ ${maxRatio.padEnd(8)} │ ${fastRatio.padEnd(8)} │`);
  }
  
  console.log('└────────┴──────────┴──────────┴──────────┴──────────┴──────────┘');
  
  // Print streaming performance if available
  if (results.large && results.large.streaming) {
    console.log('\nStreaming Performance (large data):');
    console.log('┌──────────┬──────────┬──────────┐');
    console.log('│ Chunk KB │ Encode   │ Decode   │');
    console.log('├──────────┼──────────┼──────────┤');
    
    for (const [chunkKey, chunkResult] of Object.entries(results.large.streaming)) {
      const chunkKB = (chunkResult.chunkSize / 1024).toFixed(0);
      const encodeTime = chunkResult.encodeTime.toFixed(2);
      const decodeTime = chunkResult.decodeTime.toFixed(2);
      
      console.log(`│ ${chunkKB.padEnd(8)} │ ${encodeTime.padEnd(8)} │ ${decodeTime.padEnd(8)} │`);
    }
    
    console.log('└──────────┴──────────┴──────────┘');
  }
}

// Run all benchmarks
async function runBenchmarks() {
  console.log('Starting XRAI format optimized benchmarks...');
  
  // Run comparative benchmark
  const results = await runComparativeBenchmark();
  
  // Run streaming benchmark
  await runStreamingBenchmark(results);
  
  // Print summary
  printSummaryTable(results);
  
  console.log('\nBenchmarks completed.');
  console.log(`Results saved to: ${BENCHMARK_RESULTS}`);
}

// Run the benchmarks
runBenchmarks().catch(error => {
  console.error('Benchmark failed:', error);
  process.exit(1);
});
