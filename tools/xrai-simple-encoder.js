/**
 * Simple XRAI Encoder
 * Creates XRAI files with a simplified binary format for testing
 * 
 * Implements the XRAI binary format specification as defined in spec/binary-format.md
 * Following best practices from glTF, WebXR, and OpenUSD standards
 */

const fs = require('fs');

class XRAISimpleEncoder {
  /**
   * Encode JSON data to a simple XRAI binary format
   * @param {string} inputPath - Path to JSON file to encode
   * @param {string} outputPath - Path to save XRAI file
   */
  encode(inputPath, outputPath) {
    console.log(`Encoding ${inputPath} to ${outputPath}...`);
    
    // Read input JSON
    const jsonData = fs.readFileSync(inputPath, 'utf8');
    const data = JSON.parse(jsonData);
    
    // Ensure data has required asset information (following glTF best practices)
    if (!data.asset) {
      data.asset = {
        version: '1.0',
        generator: 'XRAI Simple Encoder',
        copyright: `Copyright ${new Date().getFullYear()}`
      };
    }
    
    // Create sections
    const sections = [];
    
    // Create metadata section
    const encoder = new TextEncoder();
    const metadataBytes = encoder.encode(JSON.stringify(data));
    sections.push({
      typeId: 1, // Metadata section type
      data: metadataBytes,
      flags: 0 // No compression
    });
    
    // Calculate sizes
    const headerSize = 16; // Fixed header size
    let totalSize = headerSize;
    
    // Calculate TOC size
    const tocEntrySize = 24; // Each TOC entry is 24 bytes
    const tocHeaderSize = 4; // 4 bytes for section count
    const tocSize = tocHeaderSize + (sections.length * tocEntrySize);
    totalSize += tocSize;
    
    // Calculate section data size and offsets
    let currentOffset = headerSize + tocSize;
    let sectionDataSize = 0;
    
    for (const section of sections) {
      section.offset = currentOffset;
      currentOffset += section.data.byteLength;
      sectionDataSize += section.data.byteLength;
      
      // Add padding to align to 4-byte boundary
      const padding = (4 - (section.data.byteLength % 4)) % 4;
      currentOffset += padding;
      sectionDataSize += padding;
    }
    
    totalSize += sectionDataSize;
    
    // Create buffer
    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);
    
    // Write header
    // Magic number "XRAI"
    view.setUint8(0, 'X'.charCodeAt(0));
    view.setUint8(1, 'R'.charCodeAt(0));
    view.setUint8(2, 'A'.charCodeAt(0));
    view.setUint8(3, 'I'.charCodeAt(0));
    
    // Version (1.0)
    view.setUint8(4, 1); // Major
    view.setUint8(5, 0); // Minor
    
    // Flags (0)
    view.setUint16(6, 0, true); // Little-endian
    
    // TOC offset
    view.setBigUint64(8, BigInt(headerSize), true); // Little-endian
    
    // Write TOC
    const tocOffset = headerSize;
    view.setUint32(tocOffset, sections.length, true); // Number of sections
    
    let tocEntryOffset = tocOffset + tocHeaderSize;
    for (const section of sections) {
      // Write section entry
      view.setUint32(tocEntryOffset, section.typeId, true); // Section type
      view.setBigUint64(tocEntryOffset + 4, BigInt(section.offset), true); // Section offset
      view.setBigUint64(tocEntryOffset + 12, BigInt(section.data.byteLength), true); // Section size
      view.setUint32(tocEntryOffset + 20, section.flags, true); // Section flags
      
      tocEntryOffset += tocEntrySize;
    }
    
    // Write section data
    for (const section of sections) {
      // Copy section data
      new Uint8Array(buffer, section.offset, section.data.byteLength).set(new Uint8Array(section.data));
      
      // Add padding if needed
      const padding = (4 - (section.data.byteLength % 4)) % 4;
      if (padding > 0) {
        // Padding bytes are zeros
        const paddingOffset = section.offset + section.data.byteLength;
        for (let i = 0; i < padding; i++) {
          view.setUint8(paddingOffset + i, 0);
        }
      }
    }
    
    // Write to file
    fs.writeFileSync(outputPath, new Uint8Array(buffer));
    
    console.log(`Successfully encoded to ${outputPath}`);
    console.log(`File size: ${(buffer.byteLength / 1024).toFixed(2)} KB`);
    console.log(`Sections: ${sections.length}`);
    
    return buffer;
  }
}

module.exports = { XRAISimpleEncoder };
