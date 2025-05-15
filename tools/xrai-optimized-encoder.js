/**
 * Optimized XRAI Encoder
 * Converts various 3D formats into the XRAI format with performance optimizations
 * 
 * Implements the XRAI binary format specification as defined in spec/binary-format.md
 * Following best practices from glTF, WebXR, and OpenUSD standards
 */

const fs = require('fs');
const zlib = require('zlib');

class XRAIOptimizedEncoder {
  constructor(options = {}) {
    this.options = {
      compress: options.compress || false,
      compressionLevel: options.compressionLevel || 6,
      useTypedArrays: options.useTypedArrays !== false,
      chunkSize: options.chunkSize || 16384, // 16KB chunks for streaming
      alignSections: options.alignSections !== false,
      ...options
    };
    
    // Pre-allocate buffers for better performance
    this.headerBuffer = Buffer.alloc(16);
    this.tocHeaderBuffer = Buffer.alloc(4);
    this.tocEntryBuffer = Buffer.alloc(24);
    
    // Section type ID mapping for faster lookups
    this.sectionTypeIds = {
      metadata: 1,
      geometry: 2,
      materials: 3,
      animations: 4,
      audio: 5,
      aiComponents: 6,
      vfx: 7,
      buffers: 8,
      images: 9,
      scene: 10,
      extensions: 11
    };
  }
  
  /**
   * Encode a file into XRAI format
   * @param {string} inputPath - Path to input file
   * @param {string} outputPath - Path to output XRAI file
   * @returns {Buffer} - The encoded XRAI data
   */
  encode(inputPath, outputPath) {
    console.log(`Encoding ${inputPath} to ${outputPath}...`);
    
    // Read input file
    const startTime = process.hrtime.bigint();
    const inputData = this._readInputFile(inputPath);
    
    // Process data
    const processedData = this._processData(inputData);
    
    // Create sections
    const sections = this._createSections(processedData);
    
    // Create XRAI binary data
    const buffer = this._createBinaryData(sections);
    
    // Write to file
    fs.writeFileSync(outputPath, buffer);
    
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1_000_000; // Convert to milliseconds
    
    console.log(`Successfully encoded to ${outputPath}`);
    console.log(`File size: ${(buffer.length / 1024).toFixed(2)} KB`);
    console.log(`Sections: ${sections.length}`);
    console.log(`Encoding time: ${duration.toFixed(2)} ms`);
    
    return buffer;
  }
  
  /**
   * Read and parse input file
   * @private
   * @param {string} inputPath - Path to input file
   * @returns {Object} - Parsed data
   */
  _readInputFile(inputPath) {
    const fileExt = inputPath.split('.').pop().toLowerCase();
    
    if (fileExt === 'json') {
      // Read JSON file
      const jsonData = fs.readFileSync(inputPath, 'utf8');
      return JSON.parse(jsonData);
    } else if (['gltf', 'glb'].includes(fileExt)) {
      // TODO: Add glTF parsing
      throw new Error('glTF parsing not yet implemented');
    } else {
      throw new Error(`Unsupported input format: ${fileExt}`);
    }
  }
  
  /**
   * Process input data and ensure it meets XRAI format requirements
   * @private
   * @param {Object} data - Input data
   * @returns {Object} - Processed data
   */
  _processData(data) {
    // Ensure data has required asset information
    if (!data.asset) {
      data.asset = {
        version: '1.0',
        generator: 'XRAI Optimized Encoder',
        copyright: `Copyright ${new Date().getFullYear()}`
      };
    }
    
    return data;
  }
  
  /**
   * Create sections from processed data
   * @private
   * @param {Object} data - Processed data
   * @returns {Array} - Array of section objects
   */
  _createSections(data) {
    const sections = [];
    const encoder = new TextEncoder();
    
    // Create metadata section (required)
    const metadataBytes = Buffer.from(JSON.stringify(data), 'utf8');
    sections.push({
      typeId: this.sectionTypeIds.metadata,
      data: metadataBytes,
      flags: this.options.compress ? 0x1 : 0x0
    });
    
    // Add other sections if present in data
    for (const [key, value] of Object.entries(data)) {
      if (key === 'asset' || key === 'metadata') {
        continue; // Already included in metadata section
      }
      
      if (!value || (Array.isArray(value) && value.length === 0)) {
        continue; // Skip empty sections
      }
      
      const typeId = this.sectionTypeIds[key];
      if (!typeId) {
        continue; // Skip unknown section types
      }
      
      // Encode section data
      let sectionData;
      if (Buffer.isBuffer(value)) {
        // Already a Buffer
        sectionData = value;
      } else if (ArrayBuffer.isView(value)) {
        // TypedArray or DataView
        sectionData = Buffer.from(value.buffer, value.byteOffset, value.byteLength);
      } else {
        // JSON data
        sectionData = Buffer.from(JSON.stringify(value), 'utf8');
      }
      
      // Compress if enabled
      let flags = 0;
      if (this.options.compress && sectionData.length > 1024) {
        try {
          const compressedData = zlib.deflateSync(sectionData, {
            level: this.options.compressionLevel
          });
          
          // Only use compression if it actually reduces size
          if (compressedData.length < sectionData.length) {
            sectionData = compressedData;
            flags = 0x1; // Compression flag (bit 0)
            flags |= (1 << 8); // Deflate algorithm (bits 8-15)
            console.log(`Compressed ${key} section: ${sectionData.length} bytes, flags: ${flags.toString(16)}`);
          }
        } catch (error) {
          console.warn(`Compression failed for section ${key}: ${error.message}`);
        }
      }
      
      sections.push({
        typeId,
        data: sectionData,
        flags
      });
    }
    
    return sections;
  }
  
  /**
   * Create binary data from sections
   * @private
   * @param {Array} sections - Array of section objects
   * @returns {Buffer} - The binary data
   */
  _createBinaryData(sections) {
    // Calculate sizes
    const headerSize = 16; // Fixed header size
    
    // Calculate TOC size
    const tocEntrySize = 24; // Each TOC entry is 24 bytes
    const tocHeaderSize = 4; // 4 bytes for section count
    const tocSize = tocHeaderSize + (sections.length * tocEntrySize);
    
    // Calculate section data size and offsets
    let currentOffset = headerSize + tocSize;
    let totalSize = currentOffset;
    
    for (const section of sections) {
      // Align to 4-byte boundary if enabled
      if (this.options.alignSections) {
        const padding = (4 - (currentOffset % 4)) % 4;
        currentOffset += padding;
      }
      
      section.offset = currentOffset;
      currentOffset += section.data.length;
      
      // Add padding to align to 4-byte boundary if enabled
      if (this.options.alignSections) {
        const padding = (4 - (section.data.length % 4)) % 4;
        currentOffset += padding;
      }
    }
    
    totalSize = currentOffset;
    
    // Create buffer
    const buffer = Buffer.alloc(totalSize);
    
    // Write header
    // Magic number "XRAI"
    buffer.write('XRAI', 0, 4, 'ascii');
    
    // Version (1.0)
    buffer[4] = 1; // Major
    buffer[5] = 0; // Minor
    
    // Flags
    buffer.writeUInt16LE(0, 6); // No flags set
    
    // TOC offset
    buffer.writeBigUInt64LE(BigInt(headerSize), 8);
    
    // Write TOC
    const tocOffset = headerSize;
    buffer.writeUInt32LE(sections.length, tocOffset); // Number of sections
    
    let tocEntryOffset = tocOffset + tocHeaderSize;
    for (const section of sections) {
      // Write section entry
      buffer.writeUInt32LE(section.typeId, tocEntryOffset); // Section type
      buffer.writeBigUInt64LE(BigInt(section.offset), tocEntryOffset + 4); // Section offset
      buffer.writeBigUInt64LE(BigInt(section.data.length), tocEntryOffset + 12); // Section size
      buffer.writeUInt32LE(section.flags, tocEntryOffset + 20); // Section flags
      
      tocEntryOffset += tocEntrySize;
    }
    
    // Write section data
    for (const section of sections) {
      // Copy section data
      section.data.copy(buffer, section.offset);
      
      // Add padding if needed and enabled
      if (this.options.alignSections) {
        const padding = (4 - (section.data.length % 4)) % 4;
        if (padding > 0) {
          // Padding bytes are zeros (already set by Buffer.alloc)
        }
      }
    }
    
    return buffer;
  }
  
  /**
   * Stream encode a file into XRAI format
   * @param {string} inputPath - Path to input file
   * @param {string} outputPath - Path to output XRAI file
   * @returns {Promise<void>} - Promise that resolves when encoding is complete
   */
  async streamEncode(inputPath, outputPath) {
    console.log(`Stream encoding ${inputPath} to ${outputPath}...`);
    
    // Read input file
    const inputData = this._readInputFile(inputPath);
    
    // Process data
    const processedData = this._processData(inputData);
    
    // Create sections
    const sections = this._createSections(processedData);
    
    // Create output stream
    const outputStream = fs.createWriteStream(outputPath);
    
    // Write header
    const headerBuffer = Buffer.alloc(16);
    headerBuffer.write('XRAI', 0, 4, 'ascii');
    headerBuffer[4] = 1; // Major version
    headerBuffer[5] = 0; // Minor version
    headerBuffer.writeUInt16LE(0, 6); // Flags
    headerBuffer.writeBigUInt64LE(BigInt(16), 8); // TOC offset
    
    outputStream.write(headerBuffer);
    
    // Write TOC
    const tocHeaderBuffer = Buffer.alloc(4);
    tocHeaderBuffer.writeUInt32LE(sections.length, 0);
    outputStream.write(tocHeaderBuffer);
    
    // Calculate section offsets
    let currentOffset = 16 + 4 + (sections.length * 24);
    for (const section of sections) {
      // Align to 4-byte boundary if enabled
      if (this.options.alignSections) {
        const padding = (4 - (currentOffset % 4)) % 4;
        currentOffset += padding;
      }
      
      section.offset = currentOffset;
      currentOffset += section.data.length;
      
      // Add padding to align to 4-byte boundary if enabled
      if (this.options.alignSections) {
        const padding = (4 - (section.data.length % 4)) % 4;
        currentOffset += padding;
      }
    }
    
    // Write TOC entries
    for (const section of sections) {
      const tocEntryBuffer = Buffer.alloc(24);
      tocEntryBuffer.writeUInt32LE(section.typeId, 0);
      tocEntryBuffer.writeBigUInt64LE(BigInt(section.offset), 4);
      tocEntryBuffer.writeBigUInt64LE(BigInt(section.data.length), 12);
      tocEntryBuffer.writeUInt32LE(section.flags, 20);
      outputStream.write(tocEntryBuffer);
    }
    
    // Write section data
    for (const section of sections) {
      // Add padding if needed and enabled
      if (this.options.alignSections) {
        const padding = (4 - (currentOffset % 4)) % 4;
        if (padding > 0) {
          outputStream.write(Buffer.alloc(padding));
        }
      }
      
      // Write section data in chunks
      const chunkSize = this.options.chunkSize;
      for (let i = 0; i < section.data.length; i += chunkSize) {
        const end = Math.min(i + chunkSize, section.data.length);
        const chunk = section.data.slice(i, end);
        
        // Use await to avoid overwhelming the stream
        await new Promise(resolve => {
          outputStream.write(chunk, resolve);
        });
      }
      
      // Add padding if needed and enabled
      if (this.options.alignSections) {
        const padding = (4 - (section.data.length % 4)) % 4;
        if (padding > 0) {
          outputStream.write(Buffer.alloc(padding));
        }
      }
    }
    
    // Close stream
    await new Promise(resolve => outputStream.end(resolve));
    
    console.log(`Successfully stream encoded to ${outputPath}`);
    console.log(`Sections: ${sections.length}`);
  }
}

module.exports = { XRAIOptimizedEncoder };
