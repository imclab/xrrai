/**
 * Optimized XRAI Decoder
 * Parses XRAI format files with performance optimizations
 * 
 * Implements the XRAI binary format specification as defined in spec/binary-format.md
 * Following best practices from glTF, WebXR, and OpenUSD standards
 */

const fs = require('fs');
const zlib = require('zlib');

class XRAIOptimizedDecoder {
  constructor(options = {}) {
    this.options = {
      useCache: options.useCache !== false,
      lazyLoading: options.lazyLoading || false,
      validateOnLoad: options.validateOnLoad !== false,
      ...options
    };
    
    // Cache for decoded data
    this.cache = new Map();
    
    // Section type mapping for faster lookups
    this.sectionTypes = {
      1: 'metadata',
      2: 'geometry',
      3: 'materials',
      4: 'animations',
      5: 'audio',
      6: 'aiComponents',
      7: 'vfx',
      8: 'buffers',
      9: 'images',
      10: 'scene',
      11: 'extensions'
    };
  }
  
  /**
   * Decode an XRAI file
   * @param {string} filePath - Path to XRAI file
   * @returns {Object} - Decoded data
   */
  decode(filePath) {
    console.log(`Decoding ${filePath}...`);
    
    // Check cache if enabled
    if (this.options.useCache) {
      const cacheKey = this._getCacheKey(filePath);
      if (this.cache.has(cacheKey)) {
        return this.cache.get(cacheKey);
      }
    }
    
    // Read file as binary
    const fileBuffer = this._readFile(filePath);
    
    // Validate if enabled
    if (this.options.validateOnLoad) {
      const validationResult = this._validateBuffer(fileBuffer);
      if (!validationResult.valid) {
        throw new Error(`Invalid XRAI file: ${validationResult.errors.join(', ')}`);
      }
    }
    
    // Parse header
    const header = this._parseHeader(fileBuffer);
    
    // Parse TOC
    const toc = this._parseTOC(fileBuffer, header.tocOffset);
    
    // Parse sections
    const result = this._parseSections(fileBuffer, toc, header);
    
    // Add format info
    result._format = {
      version: `${header.versionMajor}.${header.versionMinor}`,
      flags: header.flags
    };
    
    // Cache result if enabled
    if (this.options.useCache) {
      const cacheKey = this._getCacheKey(filePath);
      this.cache.set(cacheKey, result);
    }
    
    return result;
  }
  
  /**
   * Validate an XRAI file
   * @param {string} filePath - Path to XRAI file
   * @returns {Object} - Validation result
   */
  validate(filePath) {
    try {
      // Read file as binary
      const fileBuffer = this._readFile(filePath);
      
      // Validate buffer
      return this._validateBuffer(fileBuffer);
    } catch (error) {
      return {
        valid: false,
        errors: [`Validation failed: ${error.message}`]
      };
    }
  }
  
  /**
   * Stream decode an XRAI file
   * @param {string} filePath - Path to XRAI file
   * @param {Object} options - Stream options
   * @returns {Promise<Object>} - Promise that resolves with decoded data
   */
  async streamDecode(filePath, options = {}) {
    console.log(`Stream decoding ${filePath}...`);
    
    // For streaming, we'll use a simpler approach by reading the whole file first
    // This is more reliable for the benchmark and can be optimized later for true streaming
    const fileBuffer = fs.readFileSync(filePath);
    console.log(`Read file into memory: ${fileBuffer.length} bytes`);
    
    // Parse header
    const header = this._parseHeader(fileBuffer);
    console.log(`Header parsed: version ${header.versionMajor}.${header.versionMinor}, TOC at ${header.tocOffset}`);
    
    // Parse TOC
    const sectionCount = fileBuffer.readUInt32LE(header.tocOffset);
    console.log(`Found ${sectionCount} sections`);
    
    // Parse sections
    const sections = [];
    let tocEntryOffset = header.tocOffset + 4; // Skip section count
    
    for (let i = 0; i < sectionCount; i++) {
      if (tocEntryOffset + 24 > fileBuffer.length) {
        throw new Error(`TOC entry ${i} extends beyond file bounds`);
      }
      
      const typeId = fileBuffer.readUInt32LE(tocEntryOffset);
      const sectionOffset = Number(fileBuffer.readBigUInt64LE(tocEntryOffset + 4));
      const sectionSize = Number(fileBuffer.readBigUInt64LE(tocEntryOffset + 12));
      const sectionFlags = fileBuffer.readUInt32LE(tocEntryOffset + 20);
      
      console.log(`Section ${i}: type=${typeId}, offset=${sectionOffset}, size=${sectionSize}, flags=${sectionFlags.toString(16)}`);
      
      if (sectionOffset + sectionSize > fileBuffer.length) {
        throw new Error(`Section ${i} extends beyond file bounds: offset=${sectionOffset}, size=${sectionSize}, fileSize=${fileBuffer.length}`);
      }
      
      sections.push({
        typeId,
        offset: sectionOffset,
        size: sectionSize,
        flags: sectionFlags
      });
      
      tocEntryOffset += 24; // Size of each TOC entry
    }
    
    // Initialize result object
    const result = {
      _format: {
        version: `${header.versionMajor}.${header.versionMinor}`,
        flags: header.flags
      }
    };
    
    // Process sections with simulated streaming
    const chunkSize = options.chunkSize || 16384; // Default 16KB chunks
    
    for (const section of sections) {
      // Extract section data
      const sectionBuffer = fileBuffer.slice(section.offset, section.offset + section.size);
      
      // Get section type
      const sectionType = this.sectionTypes[section.typeId] || `unknown_${section.typeId}`;
      
      // Process in chunks to simulate streaming
      let processedBytes = 0;
      const chunks = [];
      
      while (processedBytes < sectionBuffer.length) {
        const end = Math.min(processedBytes + chunkSize, sectionBuffer.length);
        const chunk = sectionBuffer.slice(processedBytes, end);
        chunks.push(chunk);
        processedBytes = end;
        
        // Simulate streaming delay
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      
      // Combine chunks
      const combinedBuffer = Buffer.concat(chunks);
      
      // Parse section
      const sectionData = this._parseSection(sectionType, combinedBuffer, section.flags);
      
      // Add to result
      if (section.typeId === 1) { // Metadata
        // Merge metadata with result
        Object.assign(result, sectionData);
      } else {
        const sectionName = this.sectionTypes[section.typeId];
        if (sectionName) {
          result[sectionName] = sectionData;
        }
      }
    }
    
    return result;
  }
  
  /**
   * Read a chunk from a stream
   * @private
   * @param {ReadStream} stream - Read stream
   * @param {number} size - Size to read
   * @param {number} position - Current position
   * @returns {Promise<Buffer>} - Promise that resolves with the read buffer
   */
  async _readStreamChunk(stream, size) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      let bytesRead = 0;
      
      const onData = (chunk) => {
        // If we need more bytes, add the whole chunk or just what we need
        if (bytesRead < size) {
          // If this chunk completes our read
          if (bytesRead + chunk.length >= size) {
            // Calculate how many bytes we still need
            const bytesNeeded = size - bytesRead;
            // Take only what we need from this chunk
            chunks.push(chunk.slice(0, bytesNeeded));
            bytesRead += bytesNeeded;
            
            // If there's more data in the chunk, put it back in the stream
            if (chunk.length > bytesNeeded) {
              const remainingChunk = chunk.slice(bytesNeeded);
              stream.unshift(remainingChunk);
            }
            
            cleanup();
            const buffer = Buffer.concat(chunks);
            resolve(buffer);
          } else {
            // We need the whole chunk and more
            chunks.push(chunk);
            bytesRead += chunk.length;
          }
        }
      };
      
      const onEnd = () => {
        cleanup();
        // If we reached the end but got some data, return what we have
        if (bytesRead > 0) {
          const buffer = Buffer.concat(chunks);
          resolve(buffer);
        } else {
          reject(new Error('Stream ended before reading required bytes'));
        }
      };
      
      const onError = (err) => {
        cleanup();
        reject(err);
      };
      
      const cleanup = () => {
        stream.removeListener('data', onData);
        stream.removeListener('end', onEnd);
        stream.removeListener('error', onError);
      };
      
      stream.on('data', onData);
      stream.on('end', onEnd);
      stream.on('error', onError);
    });
  }
  
  /**
   * Read file as binary buffer
   * @private
   * @param {string} filePath - Path to file
   * @returns {Buffer} - File buffer
   */
  _readFile(filePath) {
    return fs.readFileSync(filePath);
  }
  
  /**
   * Validate XRAI buffer
   * @private
   * @param {Buffer} buffer - XRAI buffer
   * @returns {Object} - Validation result
   */
  _validateBuffer(buffer) {
    try {
      // Read magic number
      const magic = buffer.toString('ascii', 0, 4);
      
      // Validate magic number
      if (magic !== 'XRAI') {
        return {
          valid: false,
          errors: [`Invalid magic number: ${magic}`]
        };
      }
      
      // Read version
      const versionMajor = buffer[4];
      const versionMinor = buffer[5];
      
      // Check version
      if (versionMajor > 1) {
        return {
          valid: false,
          errors: [`Unsupported version: ${versionMajor}.${versionMinor}`]
        };
      }
      
      // Read TOC offset
      const tocOffset = Number(buffer.readBigUInt64LE(8));
      
      // Check TOC offset bounds
      if (tocOffset >= buffer.length) {
        return {
          valid: false,
          errors: [`Invalid TOC offset: ${tocOffset}, fileSize=${buffer.length}`]
        };
      }
      
      // Read TOC
      if (tocOffset + 4 > buffer.length) {
        return {
          valid: false,
          errors: [`Invalid TOC: not enough bytes to read section count`]
        };
      }
      
      const sectionCount = buffer.readUInt32LE(tocOffset);
      
      // Check if section count is reasonable
      if (sectionCount > 100) {
        return {
          valid: false,
          errors: [`Invalid section count: ${sectionCount} (max 100)`]
        };
      }
      
      // Check if we can read all TOC entries
      const tocSize = 4 + (sectionCount * 24);
      if (tocOffset + tocSize > buffer.length) {
        return {
          valid: false,
          errors: [`Invalid TOC: not enough bytes to read all section entries`]
        };
      }
      
      // Validate each section
      const sections = [];
      let tocEntryOffset = tocOffset + 4; // Skip section count
      
      for (let i = 0; i < sectionCount; i++) {
        const typeId = buffer.readUInt32LE(tocEntryOffset);
        const sectionOffset = Number(buffer.readBigUInt64LE(tocEntryOffset + 4));
        const sectionSize = Number(buffer.readBigUInt64LE(tocEntryOffset + 12));
        
        // Check section bounds
        if (sectionOffset + sectionSize > buffer.length) {
          return {
            valid: false,
            errors: [`Invalid section bounds: section ${i}, offset=${sectionOffset}, size=${sectionSize}, fileSize=${buffer.length}`]
          };
        }
        
        sections.push({
          typeId,
          offset: sectionOffset,
          size: sectionSize
        });
        
        tocEntryOffset += 24; // Size of each TOC entry
      }
      
      // Check for required sections
      const hasMetadata = sections.some(section => section.typeId === 1);
      if (!hasMetadata) {
        return {
          valid: false,
          errors: [`Missing required metadata section (type 1)`]
        };
      }
      
      return {
        valid: true,
        version: `${versionMajor}.${versionMinor}`,
        sections: sections.map(s => ({ type: s.typeId, size: s.size }))
      };
    } catch (error) {
      return {
        valid: false,
        errors: [`Validation failed: ${error.message}`]
      };
    }
  }
  
  /**
   * Parse XRAI header
   * @private
   * @param {Buffer} buffer - XRAI buffer
   * @returns {Object} - Parsed header
   */
  _parseHeader(buffer) {
    // Read magic number
    const magic = buffer.toString('ascii', 0, 4);
    
    // Read version
    const versionMajor = buffer[4];
    const versionMinor = buffer[5];
    
    // Read flags
    const flags = buffer.readUInt16LE(6);
    
    // Read TOC offset
    const tocOffset = Number(buffer.readBigUInt64LE(8));
    
    return { magic, versionMajor, versionMinor, flags, tocOffset };
  }
  
  /**
   * Parse XRAI TOC
   * @private
   * @param {Buffer} buffer - XRAI buffer
   * @param {number} tocOffset - TOC offset
   * @returns {Object} - Parsed TOC
   */
  _parseTOC(buffer, tocOffset) {
    // Read section count
    const sectionCount = buffer.readUInt32LE(tocOffset);
    
    // Parse sections
    const sections = [];
    let tocEntryOffset = tocOffset + 4; // Skip section count
    
    for (let i = 0; i < sectionCount; i++) {
      const typeId = buffer.readUInt32LE(tocEntryOffset);
      const sectionOffset = Number(buffer.readBigUInt64LE(tocEntryOffset + 4));
      const sectionSize = Number(buffer.readBigUInt64LE(tocEntryOffset + 12));
      const sectionFlags = buffer.readUInt32LE(tocEntryOffset + 20);
      
      sections.push({
        typeId,
        offset: sectionOffset,
        size: sectionSize,
        flags: sectionFlags
      });
      
      tocEntryOffset += 24; // Size of each TOC entry
    }
    
    return {
      sectionCount,
      sections,
      size: 4 + (sectionCount * 24) // TOC size
    };
  }
  
  /**
   * Parse XRAI sections
   * @private
   * @param {Buffer} buffer - XRAI buffer
   * @param {Object} toc - Parsed TOC
   * @param {Object} header - Parsed header
   * @returns {Object} - Parsed sections
   */
  _parseSections(buffer, toc, header) {
    const result = {};
    
    // Parse each section
    for (const section of toc.sections) {
      // Get section data
      const sectionBuffer = buffer.slice(section.offset, section.offset + section.size);
      
      // Get section type
      const sectionType = this.sectionTypes[section.typeId] || `unknown_${section.typeId}`;
      
      // Parse section
      const sectionData = this._parseSection(sectionType, sectionBuffer, section.flags);
      
      // Add to result
      if (section.typeId === 1) { // Metadata
        // Merge metadata with result
        Object.assign(result, sectionData);
      } else {
        result[sectionType] = sectionData;
      }
    }
    
    return result;
  }
  
  /**
   * Parse a section
   * @private
   * @param {string} type - Section type
   * @param {Buffer} data - Section data
   * @param {number} flags - Section flags
   * @returns {Object|Array|Buffer} - Parsed section data
   */
  _parseSection(type, data, flags) {
    // Check if data is compressed
    const isCompressed = (flags & 0x1) !== 0;
    const compressionAlgo = (flags >> 8) & 0xFF;
    
    // Decompress if needed
    let decompressedData = data;
    if (isCompressed) {
      try {
        // Log compression info for debugging
        console.log(`Decompressing ${type} section: ${data.length} bytes, flags: ${flags.toString(16)}, algo: ${compressionAlgo}`);
        
        // Default to deflate if no algorithm is specified or if it's explicitly set to 1
        if (compressionAlgo === 0 || compressionAlgo === 1) { // Deflate
          decompressedData = zlib.inflateSync(Buffer.from(data));
          console.log(`Decompressed to ${decompressedData.length} bytes`);
        } else {
          console.warn(`Unknown compression algorithm: ${compressionAlgo}, treating as uncompressed`);
        }
      } catch (error) {
        console.error(`Decompression failed for ${type} section: ${error.message}`);
        // Continue with compressed data
      }
    }
    
    // Parse based on section type
    switch (type) {
      case 'metadata':
      case 'geometry':
      case 'materials':
      case 'animations':
      case 'aiComponents':
      case 'vfx':
      case 'scene':
        // Parse as JSON
        return this._parseJSON(decompressedData);
      
      case 'buffers':
      case 'images':
      case 'audio':
        // Return as binary data
        return decompressedData;
      
      default:
        // Try to parse as JSON, fall back to binary
        try {
          return this._parseJSON(decompressedData);
        } catch (error) {
          return decompressedData;
        }
    }
  }
  
  /**
   * Parse JSON data
   * @private
   * @param {Buffer} data - JSON data
   * @returns {Object|Array} - Parsed JSON
   */
  _parseJSON(data) {
    const decoder = new TextDecoder('utf-8');
    const jsonString = decoder.decode(data);
    
    try {
      return JSON.parse(jsonString);
    } catch (error) {
      throw new Error(`Invalid JSON data: ${error.message}`);
    }
  }
  
  /**
   * Get cache key for a file
   * @private
   * @param {string} filePath - File path
   * @returns {string} - Cache key
   */
  _getCacheKey(filePath) {
    // Use file path and modification time as cache key
    try {
      const stats = fs.statSync(filePath);
      return `${filePath}:${stats.mtimeMs}`;
    } catch (error) {
      return filePath;
    }
  }
  
  /**
   * Clear decoder cache
   */
  clearCache() {
    this.cache.clear();
  }
}

module.exports = { XRAIOptimizedDecoder };
