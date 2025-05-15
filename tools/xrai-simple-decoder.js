/**
 * Simple XRAI Decoder
 * Reads XRAI files with a simplified binary format for testing
 * 
 * Implements the XRAI binary format specification as defined in spec/binary-format.md
 * Following best practices from glTF, WebXR, and OpenUSD standards
 */

const fs = require('fs');

class XRAISimpleDecoder {
  /**
   * Decode an XRAI file
   * @param {string} filePath - Path to XRAI file to decode
   * @returns {Object} - Decoded data
   */
  decode(filePath) {
    console.log(`Decoding ${filePath}...`);
    
    // Read file as binary
    const fileBuffer = fs.readFileSync(filePath);
    const buffer = fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength);
    
    // Create view
    const view = new DataView(buffer);
    
    // Read header
    // Read magic number
    const magic = String.fromCharCode(
      view.getUint8(0),
      view.getUint8(1),
      view.getUint8(2),
      view.getUint8(3)
    );
    
    // Validate magic number
    if (magic !== 'XRAI') {
      throw new Error(`Invalid XRAI file: incorrect magic number "${magic}"`);
    }
    
    // Read version
    const versionMajor = view.getUint8(4);
    const versionMinor = view.getUint8(5);
    
    // Read flags
    const flags = view.getUint16(6, true);
    
    // Read TOC offset
    const tocOffset = Number(view.getBigUint64(8, true));
    
    // Read TOC
    const tocView = new DataView(buffer, tocOffset);
    const sectionCount = tocView.getUint32(0, true);
    
    console.log(`XRAI format version: ${versionMajor}.${versionMinor}, sections: ${sectionCount}`);
    
    // Parse sections
    const sections = [];
    let tocEntryOffset = 4; // Skip section count
    
    for (let i = 0; i < sectionCount; i++) {
      const typeId = tocView.getUint32(tocEntryOffset, true);
      const sectionOffset = Number(tocView.getBigUint64(tocEntryOffset + 4, true));
      const sectionSize = Number(tocView.getBigUint64(tocEntryOffset + 12, true));
      const sectionFlags = tocView.getUint32(tocEntryOffset + 20, true);
      
      sections.push({
        typeId,
        offset: sectionOffset,
        size: sectionSize,
        flags: sectionFlags
      });
      
      tocEntryOffset += 24; // Size of each TOC entry
    }
    
    // Process sections
    const result = {
      _format: {
        version: `${versionMajor}.${versionMinor}`,
        flags: flags
      }
    };
    
    for (const section of sections) {
      // Handle section based on type
      switch (section.typeId) {
        case 1: // Metadata section
          const metadataBytes = new Uint8Array(buffer, section.offset, section.size);
          const decoder = new TextDecoder();
          const jsonString = decoder.decode(metadataBytes);
          
          try {
            // Parse metadata JSON and merge with result
            const metadata = JSON.parse(jsonString);
            Object.assign(result, metadata);
          } catch (error) {
            console.error(`Error parsing metadata section: ${error.message}`);
          }
          break;
          
        // Add cases for other section types as needed
        case 2: // Geometry
          console.log(`Found geometry section (${section.size} bytes)`);
          break;
          
        case 3: // Materials
          console.log(`Found materials section (${section.size} bytes)`);
          break;
          
        case 6: // AI Components
          console.log(`Found AI components section (${section.size} bytes)`);
          break;
          
        default:
          console.log(`Found section type ${section.typeId} (${section.size} bytes)`);
      }
    }
    
    return result;
  }
  
  /**
   * Validate an XRAI file
   * @param {string} filePath - Path to XRAI file to validate
   * @returns {Object} - Validation result
   */
  validate(filePath) {
    try {
      // Read file header
      const fileBuffer = fs.readFileSync(filePath);
      const buffer = fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength);
      
      // Create view
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
      const tocView = new DataView(buffer, tocOffset);
      
      // Check if we can read at least the section count
      if (tocOffset + 4 > buffer.byteLength) {
        return {
          valid: false,
          errors: [`Invalid TOC: not enough bytes to read section count`]
        };
      }
      
      const sectionCount = tocView.getUint32(0, true);
      
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
      let tocEntryOffset = 4; // Skip section count
      
      for (let i = 0; i < sectionCount; i++) {
        const typeId = tocView.getUint32(tocEntryOffset, true);
        const sectionOffset = Number(tocView.getBigUint64(tocEntryOffset + 4, true));
        const sectionSize = Number(tocView.getBigUint64(tocEntryOffset + 12, true));
        const sectionFlags = tocView.getUint32(tocEntryOffset + 20, true);
        
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
          size: sectionSize,
          flags: sectionFlags
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
      
      // Validate metadata section
      const metadataSection = sections.find(section => section.typeId === 1);
      try {
        const metadataBytes = new Uint8Array(buffer, metadataSection.offset, metadataSection.size);
        const decoder = new TextDecoder();
        const jsonString = decoder.decode(metadataBytes);
        const metadata = JSON.parse(jsonString);
        
        // Check for required asset information (following glTF best practices)
        if (!metadata.asset || !metadata.asset.version) {
          return {
            valid: false,
            errors: [`Metadata missing required asset.version property`]
          };
        }
      } catch (e) {
        return {
          valid: false,
          errors: [`Invalid metadata section: ${e.message}`]
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
}

module.exports = { XRAISimpleDecoder };
