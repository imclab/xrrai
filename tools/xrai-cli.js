#!/usr/bin/env node

/**
 * XRAI CLI Tool
 * Command-line interface for working with XRAI format files
 */

const fs = require('fs');
const path = require('path');
const { program } = require('commander');
const { XRAIEncoder } = require('./xrai-encoder');
const { XRAIDecoder } = require('./xrai-decoder');

// Setup CLI
program
  .name('xrai-cli')
  .description('Command-line tool for working with XRAI format files')
  .version('0.1.0');

// Encode command
program
  .command('encode')
  .description('Encode source files into an XRAI file')
  .argument('<source>', 'Source directory or file')
  .argument('<output>', 'Output XRAI file')
  .option('-t, --type <type>', 'Content type (scene, model, splat, nerf)', 'scene')
  .option('-q, --quality <quality>', 'Encoding quality (0-1)', parseFloat, 1.0)
  .option('-c, --compress', 'Enable compression', false)
  .option('-m, --metadata <json>', 'Metadata JSON file')
  .option('-a, --ai <mode>', 'AI enhancement mode (none, basic, advanced)', 'none')
  .action(async (source, output, options) => {
    try {
      console.log(`Encoding ${source} to ${output}...`);
      
      // Load metadata if provided
      let metadata = {};
      if (options.metadata) {
        try {
          const metadataContent = fs.readFileSync(options.metadata, 'utf8');
          metadata = JSON.parse(metadataContent);
        } catch (err) {
          console.error(`Error loading metadata: ${err.message}`);
          process.exit(1);
        }
      }
      
      // Create encoder
      const encoder = new XRAIEncoder({
        quality: options.quality,
        compress: options.compress,
        aiEnhancement: options.ai !== 'none',
        aiMode: options.ai
      });
      
      // Encode based on content type
      let result;
      
      switch (options.type) {
        case 'scene':
          result = await encoder.encodeScene(source, metadata);
          break;
        case 'model':
          result = await encoder.encodeModel(source, metadata);
          break;
        case 'splat':
          result = await encoder.encodeSplat(source, metadata);
          break;
        case 'nerf':
          result = await encoder.encodeNeRF(source, metadata);
          break;
        default:
          console.error(`Unknown content type: ${options.type}`);
          process.exit(1);
      }
      
      // Write output file
      fs.writeFileSync(output, Buffer.from(result));
      
      console.log(`Successfully encoded to ${output}`);
      console.log(`File size: ${(result.byteLength / 1024).toFixed(2)} KB`);
    } catch (err) {
      console.error(`Encoding failed: ${err.message}`);
      process.exit(1);
    }
  });

// Decode command
program
  .command('decode')
  .description('Decode an XRAI file and output information')
  .argument('<input>', 'Input XRAI file')
  .option('-o, --output <dir>', 'Output directory for extracted assets')
  .option('-i, --info', 'Show detailed information', false)
  .option('-m, --metadata', 'Extract metadata only', false)
  .option('-v, --validate', 'Validate XRAI file structure', false)
  .action(async (input, options) => {
    try {
      console.log(`Decoding ${input}...`);
      
      // Read input file as binary data
      const data = fs.readFileSync(input).buffer;
      
      // Create decoder
      const decoder = new XRAIDecoder();
      
      // Validate if requested
      if (options.validate) {
        const validationResult = decoder.validate(data);
        console.log('Validation result:', validationResult.valid ? 'Valid' : 'Invalid');
        if (!validationResult.valid) {
          console.error('Validation errors:', validationResult.errors);
          process.exit(1);
        }
      }
      
      // Decode file
      const result = await decoder.decode(data);
      
      // Show metadata
      console.log('\nMetadata:');
      console.log(`  Title: ${result.metadata.title || 'Untitled'}`);
      console.log(`  Creator: ${result.metadata.creator || 'Unknown'}`);
      console.log(`  Version: ${result.metadata.version || '1.0'}`);
      console.log(`  Created: ${result.metadata.created || 'Unknown'}`);
      console.log(`  Description: ${result.metadata.description || 'No description'}`);
      
      // Show detailed info if requested
      if (options.info) {
        console.log('\nDetailed Information:');
        console.log(`  Format Version: ${result.version.major}.${result.version.minor}`);
        console.log(`  Flags: 0x${result.flags.toString(16)}`);
        
        // Show section information
        console.log('\nSections:');
        for (const sectionName in result) {
          if (['version', 'flags', 'metadata'].includes(sectionName)) continue;
          
          const section = result[sectionName];
          if (Array.isArray(section)) {
            console.log(`  ${sectionName}: ${section.length} items`);
          } else if (typeof section === 'object') {
            console.log(`  ${sectionName}: Object with ${Object.keys(section).length} properties`);
          }
        }
        
        // Show geometry information if available
        if (result.geometry) {
          console.log('\nGeometry:');
          for (const geo of result.geometry) {
            console.log(`  ${geo.id} (${geo.type}):`);
            if (geo.type === 'mesh') {
              console.log(`    Vertices: ${geo.vertices?.length || 'Unknown'}`);
              console.log(`    Triangles: ${geo.triangles?.length || 'Unknown'}`);
            } else if (geo.type === 'splat') {
              console.log(`    Splat Count: ${geo.splatCount || 'Unknown'}`);
            } else if (geo.type === 'nerf') {
              console.log(`    Resolution: ${geo.resolution?.join('x') || 'Unknown'}`);
              console.log(`    Network: ${geo.networkArchitecture || 'Unknown'}`);
            }
          }
        }
        
        // Show AI components if available
        if (result.aiComponents) {
          console.log('\nAI Components:');
          if (result.aiComponents.adaptationRules) {
            console.log(`  Adaptation Rules: ${result.aiComponents.adaptationRules.length}`);
          }
          if (result.aiComponents.behaviorModels) {
            console.log(`  Behavior Models: ${result.aiComponents.behaviorModels.length}`);
          }
          if (result.aiComponents.styleTransfer) {
            console.log('  Style Transfer: Present');
          }
        }
      }
      
      // Extract assets if output directory specified
      if (options.output) {
        if (!fs.existsSync(options.output)) {
          fs.mkdirSync(options.output, { recursive: true });
        }
        
        console.log(`\nExtracting assets to ${options.output}...`);
        
        // Extract metadata
        fs.writeFileSync(
          path.join(options.output, 'metadata.json'),
          JSON.stringify(result.metadata, null, 2)
        );
        console.log('  Extracted metadata.json');
        
        // Extract geometry if available
        if (result.geometry && !options.metadata) {
          const geoDir = path.join(options.output, 'geometry');
          if (!fs.existsSync(geoDir)) {
            fs.mkdirSync(geoDir);
          }
          
          for (const geo of result.geometry) {
            const geoFile = path.join(geoDir, `${geo.id}.json`);
            fs.writeFileSync(geoFile, JSON.stringify(geo, null, 2));
            console.log(`  Extracted geometry/${geo.id}.json`);
          }
        }
        
        // Extract materials if available
        if (result.materials && !options.metadata) {
          const matDir = path.join(options.output, 'materials');
          if (!fs.existsSync(matDir)) {
            fs.mkdirSync(matDir);
          }
          
          for (const mat of result.materials) {
            const matFile = path.join(matDir, `${mat.id}.json`);
            fs.writeFileSync(matFile, JSON.stringify(mat, null, 2));
            console.log(`  Extracted materials/${mat.id}.json`);
          }
        }
        
        // Extract AI components if available
        if (result.aiComponents && !options.metadata) {
          const aiDir = path.join(options.output, 'ai');
          if (!fs.existsSync(aiDir)) {
            fs.mkdirSync(aiDir);
          }
          
          const aiFile = path.join(aiDir, 'components.json');
          fs.writeFileSync(aiFile, JSON.stringify(result.aiComponents, null, 2));
          console.log('  Extracted ai/components.json');
        }
      }
      
      console.log('\nDecoding completed successfully');
    } catch (err) {
      console.error(`Decoding failed: ${err.message}`);
      process.exit(1);
    }
  });

// Convert command
program
  .command('convert')
  .description('Convert between XRAI and other formats')
  .argument('<input>', 'Input file')
  .argument('<output>', 'Output file')
  .option('-f, --from <format>', 'Input format (gltf, usd, obj, ply, fbx)', 'auto')
  .option('-t, --to <format>', 'Output format (xrai, gltf, obj)', 'xrai')
  .option('-q, --quality <quality>', 'Conversion quality (0-1)', parseFloat, 1.0)
  .action(async (input, output, options) => {
    try {
      console.log(`Converting ${input} to ${output}...`);
      
      // Determine input format if auto
      let inputFormat = options.from;
      if (inputFormat === 'auto') {
        const ext = path.extname(input).toLowerCase();
        switch (ext) {
          case '.gltf':
          case '.glb':
            inputFormat = 'gltf';
            break;
          case '.usd':
          case '.usda':
          case '.usdc':
          case '.usdz':
            inputFormat = 'usd';
            break;
          case '.obj':
            inputFormat = 'obj';
            break;
          case '.ply':
            inputFormat = 'ply';
            break;
          case '.fbx':
            inputFormat = 'fbx';
            break;
          case '.xrai':
            inputFormat = 'xrai';
            break;
          default:
            console.error(`Could not determine format for ${input}`);
            process.exit(1);
        }
      }
      
      // Determine output format if not specified
      let outputFormat = options.to;
      if (outputFormat === 'auto') {
        const ext = path.extname(output).toLowerCase();
        switch (ext) {
          case '.gltf':
          case '.glb':
            outputFormat = 'gltf';
            break;
          case '.obj':
            outputFormat = 'obj';
            break;
          case '.xrai':
            outputFormat = 'xrai';
            break;
          default:
            outputFormat = 'xrai';
        }
      }
      
      // Create encoder/decoder as needed
      const encoder = new XRAIEncoder({ quality: options.quality });
      const decoder = new XRAIDecoder();
      
      // Perform conversion
      if (inputFormat === 'xrai' && outputFormat !== 'xrai') {
        // XRAI to other format
        const data = fs.readFileSync(input);
        const decoded = await decoder.decode(data);
        
        // Export to target format
        let result;
        switch (outputFormat) {
          case 'gltf':
            result = encoder.exportGLTF(decoded);
            break;
          case 'obj':
            result = encoder.exportOBJ(decoded);
            break;
          default:
            console.error(`Unsupported output format: ${outputFormat}`);
            process.exit(1);
        }
        
        fs.writeFileSync(output, result);
      } else if (inputFormat !== 'xrai' && outputFormat === 'xrai') {
        // Other format to XRAI
        let result;
        switch (inputFormat) {
          case 'gltf':
            result = await encoder.encodeGLTF(input);
            break;
          case 'obj':
            result = await encoder.encodeOBJ(input);
            break;
          case 'ply':
            result = await encoder.encodePLY(input);
            break;
          case 'fbx':
            result = await encoder.encodeFBX(input);
            break;
          case 'usd':
            result = await encoder.encodeUSD(input);
            break;
          default:
            console.error(`Unsupported input format: ${inputFormat}`);
            process.exit(1);
        }
        
        fs.writeFileSync(output, Buffer.from(result));
      } else {
        console.error('Unsupported conversion path');
        process.exit(1);
      }
      
      console.log(`Successfully converted ${input} to ${output}`);
    } catch (err) {
      console.error(`Conversion failed: ${err.message}`);
      process.exit(1);
    }
  });

// View command
program
  .command('view')
  .description('Open an XRAI file in the web viewer')
  .argument('<input>', 'Input XRAI file')
  .option('-p, --port <port>', 'Server port', parseInt, 8080)
  .option('-h, --host <host>', 'Server host', 'localhost')
  .option('-b, --browser', 'Open in browser automatically', false)
  .action(async (input, options) => {
    try {
      console.log(`Starting XRAI viewer for ${input}...`);
      
      // Check if file exists
      if (!fs.existsSync(input)) {
        console.error(`File not found: ${input}`);
        process.exit(1);
      }
      
      // Create server directory
      const serverDir = path.join(__dirname, 'server');
      if (!fs.existsSync(serverDir)) {
        fs.mkdirSync(serverDir, { recursive: true });
      }
      
      // Copy file to server directory
      const targetFile = path.join(serverDir, 'scene.xrai');
      fs.copyFileSync(input, targetFile);
      
      // Create viewer HTML
      const viewerHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>XRAI Viewer</title>
  <style>
    body { margin: 0; overflow: hidden; }
    #xrai-container { position: absolute; width: 100%; height: 100%; }
    .loading { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: white; font-family: sans-serif; }
    .error { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: red; font-family: sans-serif; }
    .info { position: absolute; bottom: 10px; left: 10px; color: white; font-family: sans-serif; background: rgba(0,0,0,0.5); padding: 10px; border-radius: 5px; }
  </style>
</head>
<body>
  <div id="xrai-container">
    <div class="loading">Loading XRAI scene...</div>
  </div>
  <script src="xrai-viewer.js"></script>
  <script src="splat-geometry.js"></script>
  <script src="nerf-renderer.js"></script>
  <script src="adaptation-controller.js"></script>
  <script>
    document.addEventListener('DOMContentLoaded', async () => {
      const container = document.getElementById('xrai-container');
      
      try {
        // Create loader
        const loader = new XRAILoader({
          useGPU: true,
          adaptiveQuality: true,
          aiEnhancement: true
        });
        
        // Load XRAI file
        const result = await loader.load('scene.xrai');
        
        console.log('XRAI scene loaded:', result.metadata.title);
        
        // Add info display
        const infoDiv = document.createElement('div');
        infoDiv.className = 'info';
        infoDiv.innerHTML = \`
          <h3>\${result.metadata.title || 'Untitled Scene'}</h3>
          <p>\${result.metadata.description || 'No description'}</p>
          <p>Created by: \${result.metadata.creator || 'Unknown'}</p>
        \`;
        container.appendChild(infoDiv);
        
        // Set up camera
        const camera = {
          position: [0, 1.7, 5],
          direction: [0, 0, -1],
          fov: 75
        };
        
        // Set up animation loop
        let lastTime = performance.now();
        const animate = () => {
          const currentTime = performance.now();
          const deltaTime = (currentTime - lastTime) / 1000;
          lastTime = currentTime;
          
          // Update scene context
          result.scene.updateContext({
            time: performance.now() / 1000,
            viewPosition: camera.position,
            viewDirection: camera.direction
          });
          
          // Render scene
          result.render(camera, deltaTime);
          
          requestAnimationFrame(animate);
        };
        
        // Start animation loop
        animate();
        
        // Add event listeners for interaction
        container.addEventListener('click', (event) => {
          // Calculate click position in 3D space
          const rect = container.getBoundingClientRect();
          const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
          const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
          
          // Perform raycasting to find clicked object
          const hitResult = performRaycast(camera, [x, y]);
          
          if (hitResult) {
            // Trigger interaction
            result.scene.triggerVFX('magic_effect', hitResult.position);
          }
        });
      } catch (error) {
        console.error('Error initializing XRAI viewer:', error);
        container.innerHTML = \`<div class="error">Error loading XRAI scene: \${error.message}</div>\`;
      }
    });
    
    // Helper function for raycasting
    function performRaycast(camera, screenPosition) {
      // This is a placeholder - actual implementation would depend on the rendering engine
      console.log('Raycasting from', camera.position, 'through screen position', screenPosition);
      
      // Return mock hit result
      return {
        position: [
          camera.position[0] + camera.direction[0] * 5,
          camera.position[1] + camera.direction[1] * 5,
          camera.position[2] + camera.direction[2] * 5
        ],
        normal: [0, 1, 0],
        distance: 5
      };
    }
  </script>
</body>
</html>
      `;
      
      const viewerFile = path.join(serverDir, 'index.html');
      fs.writeFileSync(viewerFile, viewerHTML);
      
      // Copy viewer JS files
      const viewerJSPath = path.join(__dirname, '..', 'examples', 'web', 'xrai-viewer.js');
      const splatJSPath = path.join(__dirname, '..', 'examples', 'web', 'splat-geometry.js');
      const nerfJSPath = path.join(__dirname, '..', 'examples', 'web', 'nerf-renderer.js');
      const adaptationJSPath = path.join(__dirname, '..', 'examples', 'web', 'adaptation-controller.js');
      
      if (fs.existsSync(viewerJSPath)) {
        fs.copyFileSync(viewerJSPath, path.join(serverDir, 'xrai-viewer.js'));
      } else {
        console.warn('Warning: xrai-viewer.js not found, viewer may not work correctly');
      }
      
      if (fs.existsSync(splatJSPath)) {
        fs.copyFileSync(splatJSPath, path.join(serverDir, 'splat-geometry.js'));
      }
      
      if (fs.existsSync(nerfJSPath)) {
        fs.copyFileSync(nerfJSPath, path.join(serverDir, 'nerf-renderer.js'));
      }
      
      if (fs.existsSync(adaptationJSPath)) {
        fs.copyFileSync(adaptationJSPath, path.join(serverDir, 'adaptation-controller.js'));
      }
      
      // Start HTTP server
      const http = require('http');
      const server = http.createServer((req, res) => {
        const url = req.url === '/' ? '/index.html' : req.url;
        const filePath = path.join(serverDir, url);
        
        // Check if file exists
        if (fs.existsSync(filePath)) {
          const ext = path.extname(filePath).toLowerCase();
          let contentType = 'text/plain';
          
          switch (ext) {
            case '.html':
              contentType = 'text/html';
              break;
            case '.js':
              contentType = 'text/javascript';
              break;
            case '.css':
              contentType = 'text/css';
              break;
            case '.json':
              contentType = 'application/json';
              break;
            case '.png':
              contentType = 'image/png';
              break;
            case '.jpg':
            case '.jpeg':
              contentType = 'image/jpeg';
              break;
            case '.xrai':
              contentType = 'application/octet-stream';
              break;
          }
          
          const content = fs.readFileSync(filePath);
          res.writeHead(200, { 'Content-Type': contentType });
          res.end(content, 'utf-8');
        } else {
          res.writeHead(404);
          res.end('File not found');
        }
      });
      
      server.listen(options.port, options.host, () => {
        const url = `http://${options.host}:${options.port}`;
        console.log(`XRAI viewer server running at ${url}`);
        
        // Open browser if requested
        if (options.browser) {
          const { exec } = require('child_process');
          const cmd = process.platform === 'win32' ? 'start' : 
                     process.platform === 'darwin' ? 'open' : 'xdg-open';
          
          exec(`${cmd} ${url}`);
        }
      });
      
      // Handle server shutdown
      process.on('SIGINT', () => {
        console.log('\nShutting down server...');
        server.close();
        process.exit(0);
      });
    } catch (err) {
      console.error(`Viewer failed: ${err.message}`);
      process.exit(1);
    }
  });

// Parse arguments
program.parse();

// Show help if no arguments
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
