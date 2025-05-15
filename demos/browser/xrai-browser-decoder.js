/**
 * XRAI Browser Decoder
 * A browser-compatible implementation of the XRAI format decoder
 */

class XRAIBrowserDecoder {
    constructor(options = {}) {
        this.options = {
            validateOnLoad: options.validateOnLoad !== false,
            useCache: options.useCache !== false,
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
     * Fetch and decode an XRAI file from a URL
     * @param {string} url - URL to fetch XRAI file from
     * @returns {Promise<Object>} - Decoded data
     */
    async fetchAndDecode(url) {
        try {
            console.log(`Fetching XRAI file from ${url}...`);
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const buffer = await response.arrayBuffer();
            return this.decode(buffer);
        } catch (error) {
            console.error('Error fetching XRAI file:', error);
            throw error;
        }
    }
    
    /**
     * Decode an XRAI file
     * @param {ArrayBuffer} buffer - XRAI file data as ArrayBuffer
     * @returns {Object} - Decoded data
     */
    decode(buffer) {
        console.log(`Decoding XRAI data (${buffer.byteLength} bytes)...`);
        
        // Check cache if enabled
        if (this.options.useCache) {
            const cacheKey = this._getCacheKey(buffer);
            if (this.cache.has(cacheKey)) {
                return this.cache.get(cacheKey);
            }
        }
        
        // Validate if enabled
        if (this.options.validateOnLoad) {
            const validationResult = this._validateBuffer(buffer);
            if (!validationResult.valid) {
                throw new Error(`Invalid XRAI file: ${validationResult.errors.join(', ')}`);
            }
        }
        
        // Check if this is a binary XRAI file or JSON
        const view = new DataView(buffer);
        
        // Check for XRAI magic number
        const magic = String.fromCharCode(
            view.getUint8(0),
            view.getUint8(1),
            view.getUint8(2),
            view.getUint8(3)
        );
        
        if (magic === 'XRAI') {
            // This is a binary XRAI file
            // Parse header
            const header = this._parseHeader(buffer);
            
            // Parse TOC
            const toc = this._parseTOC(buffer, header.tocOffset);
            
            // Parse sections
            const result = this._parseSections(buffer, toc, header);
            
            // Add format info
            result._format = {
                version: `${header.versionMajor}.${header.versionMinor}`,
                flags: header.flags
            };
            
            // Cache result if enabled
            if (this.options.useCache) {
                const cacheKey = this._getCacheKey(buffer);
                this.cache.set(cacheKey, result);
            }
            
            return result;
        } else {
            // This is a JSON file, decode as JSON
            try {
                const decoder = new TextDecoder('utf-8');
                const jsonString = decoder.decode(buffer);
                const result = JSON.parse(jsonString);
                
                // Cache result if enabled
                if (this.options.useCache) {
                    const cacheKey = this._getCacheKey(buffer);
                    this.cache.set(cacheKey, result);
                }
                
                return result;
            } catch (error) {
                throw new Error(`Failed to parse JSON: ${error.message}`);
            }
        }
        

    }
    
    /**
     * Validate an XRAI buffer
     * @param {ArrayBuffer} buffer - XRAI buffer
     * @returns {Object} - Validation result
     */
    _validateBuffer(buffer) {
        try {
            const view = new DataView(buffer);
            
            // Read magic number
            const magic = String.fromCharCode(
                view.getUint8(0),
                view.getUint8(1),
                view.getUint8(2),
                view.getUint8(3)
            );
            
            // Validate magic number
            if (magic !== 'XRAI') {
                return {
                    valid: false,
                    errors: [`Invalid magic number: ${magic}`]
                };
            }
            
            // Read version
            const versionMajor = view.getUint8(4);
            const versionMinor = view.getUint8(5);
            
            // Check version
            if (versionMajor > 1) {
                return {
                    valid: false,
                    errors: [`Unsupported version: ${versionMajor}.${versionMinor}`]
                };
            }
            
            // Read TOC offset
            const tocOffset = Number(view.getBigUint64(8, true));
            
            // Check TOC offset bounds
            if (tocOffset >= buffer.byteLength) {
                return {
                    valid: false,
                    errors: [`Invalid TOC offset: ${tocOffset}, fileSize=${buffer.byteLength}`]
                };
            }
            
            // Read TOC
            if (tocOffset + 4 > buffer.byteLength) {
                return {
                    valid: false,
                    errors: [`Invalid TOC: not enough bytes to read section count`]
                };
            }
            
            const sectionCount = view.getUint32(tocOffset, true);
            
            // Check if section count is reasonable
            if (sectionCount > 100) {
                return {
                    valid: false,
                    errors: [`Invalid section count: ${sectionCount} (max 100)`]
                };
            }
            
            // Check if we can read all TOC entries
            const tocSize = 4 + (sectionCount * 24);
            if (tocOffset + tocSize > buffer.byteLength) {
                return {
                    valid: false,
                    errors: [`Invalid TOC: not enough bytes to read all section entries`]
                };
            }
            
            // Validate each section
            const sections = [];
            let tocEntryOffset = tocOffset + 4; // Skip section count
            
            for (let i = 0; i < sectionCount; i++) {
                const typeId = view.getUint32(tocEntryOffset, true);
                const sectionOffset = Number(view.getBigUint64(tocEntryOffset + 4, true));
                const sectionSize = Number(view.getBigUint64(tocEntryOffset + 12, true));
                
                // Check section bounds
                if (sectionOffset + sectionSize > buffer.byteLength) {
                    return {
                        valid: false,
                        errors: [`Invalid section bounds: section ${i}, offset=${sectionOffset}, size=${sectionSize}, fileSize=${buffer.byteLength}`]
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
     * @param {ArrayBuffer} buffer - XRAI buffer
     * @returns {Object} - Parsed header
     */
    _parseHeader(buffer) {
        const view = new DataView(buffer);
        
        // Read magic number
        const magic = String.fromCharCode(
            view.getUint8(0),
            view.getUint8(1),
            view.getUint8(2),
            view.getUint8(3)
        );
        
        // Read version
        const versionMajor = view.getUint8(4);
        const versionMinor = view.getUint8(5);
        
        // Read flags
        const flags = view.getUint16(6, true);
        
        // Read TOC offset
        const tocOffset = Number(view.getBigUint64(8, true));
        
        return { magic, versionMajor, versionMinor, flags, tocOffset };
    }
    
    /**
     * Parse XRAI TOC
     * @param {ArrayBuffer} buffer - XRAI buffer
     * @param {number} tocOffset - TOC offset
     * @returns {Object} - Parsed TOC
     */
    _parseTOC(buffer, tocOffset) {
        const view = new DataView(buffer);
        
        // Read section count
        const sectionCount = view.getUint32(tocOffset, true);
        
        // Parse sections
        const sections = [];
        let tocEntryOffset = tocOffset + 4; // Skip section count
        
        for (let i = 0; i < sectionCount; i++) {
            const typeId = view.getUint32(tocEntryOffset, true);
            const sectionOffset = Number(view.getBigUint64(tocEntryOffset + 4, true));
            const sectionSize = Number(view.getBigUint64(tocEntryOffset + 12, true));
            const sectionFlags = view.getUint32(tocEntryOffset + 20, true);
            
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
     * @param {ArrayBuffer} buffer - XRAI buffer
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
     * @param {string} type - Section type
     * @param {ArrayBuffer} data - Section data
     * @param {number} flags - Section flags
     * @returns {Object|Array|ArrayBuffer} - Parsed section data
     */
    _parseSection(type, data, flags) {
        // Check if data is compressed
        const isCompressed = (flags & 0x1) !== 0;
        const compressionAlgo = (flags >> 8) & 0xFF;
        
        // Decompress if needed
        let decompressedData = data;
        if (isCompressed) {
            try {
                console.log(`Decompressing ${type} section: ${data.byteLength} bytes, flags: ${flags.toString(16)}, algo: ${compressionAlgo}`);
                
                // Default to deflate if no algorithm is specified or if it's explicitly set to 1
                if (compressionAlgo === 0 || compressionAlgo === 1) { // Deflate
                    // In browser, use pako for decompression
                    if (typeof pako !== 'undefined') {
                        decompressedData = pako.inflate(new Uint8Array(data)).buffer;
                        console.log(`Decompressed to ${decompressedData.byteLength} bytes`);
                    } else {
                        console.warn('Pako library not available for decompression');
                    }
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
     * @param {ArrayBuffer} data - JSON data
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
     * Get cache key for a buffer
     * @param {ArrayBuffer} buffer - Buffer
     * @returns {string} - Cache key
     */
    _getCacheKey(buffer) {
        // Use buffer length and first few bytes as cache key
        const view = new DataView(buffer);
        const firstBytes = [];
        
        for (let i = 0; i < Math.min(16, buffer.byteLength); i++) {
            firstBytes.push(view.getUint8(i).toString(16).padStart(2, '0'));
        }
        
        return `${buffer.byteLength}:${firstBytes.join('')}`;
    }
    
    /**
     * Clear decoder cache
     */
    clearCache() {
        this.cache.clear();
    }
}

// If running in Node.js environment, export the class
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { XRAIBrowserDecoder };
} else {
    // Make available globally in browser
    window.XRAIDecoder = XRAIBrowserDecoder;
}
