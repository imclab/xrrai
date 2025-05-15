using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Text;
using System.IO.Compression;
using UnityEngine;
using Newtonsoft.Json;

namespace XRAI
{
    /// <summary>
    /// Unity implementation of the XRAI format decoder
    /// </summary>
    public class XRAIDecoder
    {
        // Section type mapping for faster lookups
        private static readonly Dictionary<int, string> SectionTypes = new Dictionary<int, string>
        {
            { 1, "metadata" },
            { 2, "geometry" },
            { 3, "materials" },
            { 4, "animations" },
            { 5, "audio" },
            { 6, "aiComponents" },
            { 7, "vfx" },
            { 8, "buffers" },
            { 9, "images" },
            { 10, "scene" },
            { 11, "extensions" }
        };

        // Decoder options
        private bool validateOnLoad = true;
        private bool useCache = true;

        // Cache for decoded data
        private Dictionary<string, object> cache = new Dictionary<string, object>();

        /// <summary>
        /// Decode an XRAI file from a file path
        /// </summary>
        /// <param name="filePath">Path to XRAI file</param>
        /// <returns>Decoded data as a Dictionary</returns>
        public Dictionary<string, object> Decode(string filePath)
        {
            Debug.Log($"Decoding XRAI file: {filePath}");
            
            // Check if file exists
            if (!File.Exists(filePath))
            {
                throw new FileNotFoundException($"XRAI file not found: {filePath}");
            }
            
            // Read file as binary
            byte[] fileData = File.ReadAllBytes(filePath);
            
            return DecodeBytes(fileData);
        }
        
        /// <summary>
        /// Decode XRAI data from a byte array
        /// </summary>
        /// <param name="data">XRAI data as byte array</param>
        /// <returns>Decoded data as a Dictionary</returns>
        public Dictionary<string, object> DecodeBytes(byte[] data)
        {
            // Check cache if enabled
            if (useCache)
            {
                string cacheKey = GetCacheKey(data);
                if (cache.ContainsKey(cacheKey))
                {
                    return cache[cacheKey] as Dictionary<string, object>;
                }
            }
            
            // Validate if enabled
            if (validateOnLoad)
            {
                ValidationResult validationResult = ValidateBytes(data);
                if (!validationResult.Valid)
                {
                    throw new Exception($"Invalid XRAI file: {string.Join(", ", validationResult.Errors)}");
                }
            }
            
            // Parse header
            XRAIHeader header = ParseHeader(data);
            
            // Parse TOC
            XRAITOC toc = ParseTOC(data, header.TOCOffset);
            
            // Parse sections
            Dictionary<string, object> result = ParseSections(data, toc, header);
            
            // Add format info
            Dictionary<string, object> formatInfo = new Dictionary<string, object>
            {
                { "version", $"{header.VersionMajor}.{header.VersionMinor}" },
                { "flags", header.Flags }
            };
            result["_format"] = formatInfo;
            
            // Cache result if enabled
            if (useCache)
            {
                string cacheKey = GetCacheKey(data);
                cache[cacheKey] = result;
            }
            
            return result;
        }
        
        /// <summary>
        /// Validate XRAI data
        /// </summary>
        /// <param name="data">XRAI data as byte array</param>
        /// <returns>Validation result</returns>
        public ValidationResult ValidateBytes(byte[] data)
        {
            try
            {
                if (data.Length < 16)
                {
                    return new ValidationResult
                    {
                        Valid = false,
                        Errors = new List<string> { "File too small to be a valid XRAI file" }
                    };
                }
                
                // Read magic number
                string magic = Encoding.ASCII.GetString(data, 0, 4);
                
                // Validate magic number
                if (magic != "XRAI")
                {
                    return new ValidationResult
                    {
                        Valid = false,
                        Errors = new List<string> { $"Invalid magic number: {magic}" }
                    };
                }
                
                // Read version
                byte versionMajor = data[4];
                byte versionMinor = data[5];
                
                // Check version
                if (versionMajor > 1)
                {
                    return new ValidationResult
                    {
                        Valid = false,
                        Errors = new List<string> { $"Unsupported version: {versionMajor}.{versionMinor}" }
                    };
                }
                
                // Read TOC offset
                long tocOffset = BitConverter.ToInt64(data, 8);
                
                // Check TOC offset bounds
                if (tocOffset >= data.Length)
                {
                    return new ValidationResult
                    {
                        Valid = false,
                        Errors = new List<string> { $"Invalid TOC offset: {tocOffset}, fileSize={data.Length}" }
                    };
                }
                
                // Read TOC
                if (tocOffset + 4 > data.Length)
                {
                    return new ValidationResult
                    {
                        Valid = false,
                        Errors = new List<string> { "Invalid TOC: not enough bytes to read section count" }
                    };
                }
                
                int sectionCount = BitConverter.ToInt32(data, (int)tocOffset);
                
                // Check if section count is reasonable
                if (sectionCount > 100)
                {
                    return new ValidationResult
                    {
                        Valid = false,
                        Errors = new List<string> { $"Invalid section count: {sectionCount} (max 100)" }
                    };
                }
                
                // Check if we can read all TOC entries
                long tocSize = 4 + (sectionCount * 24);
                if (tocOffset + tocSize > data.Length)
                {
                    return new ValidationResult
                    {
                        Valid = false,
                        Errors = new List<string> { "Invalid TOC: not enough bytes to read all section entries" }
                    };
                }
                
                // Validate each section
                List<SectionInfo> sections = new List<SectionInfo>();
                long tocEntryOffset = tocOffset + 4; // Skip section count
                
                for (int i = 0; i < sectionCount; i++)
                {
                    int typeId = BitConverter.ToInt32(data, (int)tocEntryOffset);
                    long sectionOffset = BitConverter.ToInt64(data, (int)tocEntryOffset + 4);
                    long sectionSize = BitConverter.ToInt64(data, (int)tocEntryOffset + 12);
                    
                    // Check section bounds
                    if (sectionOffset + sectionSize > data.Length)
                    {
                        return new ValidationResult
                        {
                            Valid = false,
                            Errors = new List<string> { $"Invalid section bounds: section {i}, offset={sectionOffset}, size={sectionSize}, fileSize={data.Length}" }
                        };
                    }
                    
                    sections.Add(new SectionInfo
                    {
                        TypeId = typeId,
                        Offset = sectionOffset,
                        Size = sectionSize
                    });
                    
                    tocEntryOffset += 24; // Size of each TOC entry
                }
                
                // Check for required sections
                bool hasMetadata = sections.Exists(section => section.TypeId == 1);
                if (!hasMetadata)
                {
                    return new ValidationResult
                    {
                        Valid = false,
                        Errors = new List<string> { "Missing required metadata section (type 1)" }
                    };
                }
                
                return new ValidationResult
                {
                    Valid = true,
                    Version = $"{versionMajor}.{versionMinor}",
                    Sections = sections
                };
            }
            catch (Exception ex)
            {
                return new ValidationResult
                {
                    Valid = false,
                    Errors = new List<string> { $"Validation failed: {ex.Message}" }
                };
            }
        }
        
        /// <summary>
        /// Parse XRAI header
        /// </summary>
        /// <param name="data">XRAI data</param>
        /// <returns>Parsed header</returns>
        private XRAIHeader ParseHeader(byte[] data)
        {
            // Read magic number
            string magic = Encoding.ASCII.GetString(data, 0, 4);
            
            // Read version
            byte versionMajor = data[4];
            byte versionMinor = data[5];
            
            // Read flags
            ushort flags = BitConverter.ToUInt16(data, 6);
            
            // Read TOC offset
            long tocOffset = BitConverter.ToInt64(data, 8);
            
            return new XRAIHeader
            {
                Magic = magic,
                VersionMajor = versionMajor,
                VersionMinor = versionMinor,
                Flags = flags,
                TOCOffset = tocOffset
            };
        }
        
        /// <summary>
        /// Parse XRAI TOC
        /// </summary>
        /// <param name="data">XRAI data</param>
        /// <param name="tocOffset">TOC offset</param>
        /// <returns>Parsed TOC</returns>
        private XRAITOC ParseTOC(byte[] data, long tocOffset)
        {
            // Read section count
            int sectionCount = BitConverter.ToInt32(data, (int)tocOffset);
            
            // Parse sections
            List<SectionEntry> sections = new List<SectionEntry>();
            long tocEntryOffset = tocOffset + 4; // Skip section count
            
            for (int i = 0; i < sectionCount; i++)
            {
                int typeId = BitConverter.ToInt32(data, (int)tocEntryOffset);
                long sectionOffset = BitConverter.ToInt64(data, (int)tocEntryOffset + 4);
                long sectionSize = BitConverter.ToInt64(data, (int)tocEntryOffset + 12);
                uint sectionFlags = BitConverter.ToUInt32(data, (int)tocEntryOffset + 20);
                
                sections.Add(new SectionEntry
                {
                    TypeId = typeId,
                    Offset = sectionOffset,
                    Size = sectionSize,
                    Flags = sectionFlags
                });
                
                tocEntryOffset += 24; // Size of each TOC entry
            }
            
            return new XRAITOC
            {
                SectionCount = sectionCount,
                Sections = sections,
                Size = 4 + (sectionCount * 24) // TOC size
            };
        }
        
        /// <summary>
        /// Parse XRAI sections
        /// </summary>
        /// <param name="data">XRAI data</param>
        /// <param name="toc">Parsed TOC</param>
        /// <param name="header">Parsed header</param>
        /// <returns>Parsed sections</returns>
        private Dictionary<string, object> ParseSections(byte[] data, XRAITOC toc, XRAIHeader header)
        {
            Dictionary<string, object> result = new Dictionary<string, object>();
            
            // Parse each section
            foreach (SectionEntry section in toc.Sections)
            {
                // Get section data
                byte[] sectionData = new byte[section.Size];
                Array.Copy(data, section.Offset, sectionData, 0, section.Size);
                
                // Get section type
                string sectionType = SectionTypes.ContainsKey(section.TypeId) 
                    ? SectionTypes[section.TypeId] 
                    : $"unknown_{section.TypeId}";
                
                // Parse section
                object sectionObj = ParseSection(sectionType, sectionData, section.Flags);
                
                // Add to result
                if (section.TypeId == 1) // Metadata
                {
                    // Merge metadata with result
                    if (sectionObj is Dictionary<string, object> metadataDict)
                    {
                        foreach (var kvp in metadataDict)
                        {
                            result[kvp.Key] = kvp.Value;
                        }
                    }
                }
                else
                {
                    result[sectionType] = sectionObj;
                }
            }
            
            return result;
        }
        
        /// <summary>
        /// Parse a section
        /// </summary>
        /// <param name="type">Section type</param>
        /// <param name="data">Section data</param>
        /// <param name="flags">Section flags</param>
        /// <returns>Parsed section data</returns>
        private object ParseSection(string type, byte[] data, uint flags)
        {
            // Check if data is compressed
            bool isCompressed = (flags & 0x1) != 0;
            int compressionAlgo = (int)((flags >> 8) & 0xFF);
            
            // Decompress if needed
            byte[] decompressedData = data;
            if (isCompressed)
            {
                try
                {
                    Debug.Log($"Decompressing {type} section: {data.Length} bytes, flags: {flags:X}, algo: {compressionAlgo}");
                    
                    // Default to deflate if no algorithm is specified or if it's explicitly set to 1
                    if (compressionAlgo == 0 || compressionAlgo == 1) // Deflate
                    {
                        using (MemoryStream compressedStream = new MemoryStream(data))
                        using (DeflateStream deflateStream = new DeflateStream(compressedStream, CompressionMode.Decompress))
                        using (MemoryStream resultStream = new MemoryStream())
                        {
                            deflateStream.CopyTo(resultStream);
                            decompressedData = resultStream.ToArray();
                        }
                        
                        Debug.Log($"Decompressed to {decompressedData.Length} bytes");
                    }
                    else
                    {
                        Debug.LogWarning($"Unknown compression algorithm: {compressionAlgo}, treating as uncompressed");
                    }
                }
                catch (Exception ex)
                {
                    Debug.LogError($"Decompression failed for {type} section: {ex.Message}");
                    // Continue with compressed data
                }
            }
            
            // Parse based on section type
            switch (type)
            {
                case "metadata":
                case "geometry":
                case "materials":
                case "animations":
                case "aiComponents":
                case "vfx":
                case "scene":
                    // Parse as JSON
                    return ParseJSON(decompressedData);
                
                case "buffers":
                case "images":
                case "audio":
                    // Return as binary data
                    return decompressedData;
                
                default:
                    // Try to parse as JSON, fall back to binary
                    try
                    {
                        return ParseJSON(decompressedData);
                    }
                    catch
                    {
                        return decompressedData;
                    }
            }
        }
        
        /// <summary>
        /// Parse JSON data
        /// </summary>
        /// <param name="data">JSON data as byte array</param>
        /// <returns>Parsed JSON</returns>
        private object ParseJSON(byte[] data)
        {
            string jsonString = Encoding.UTF8.GetString(data);
            
            try
            {
                return JsonConvert.DeserializeObject<Dictionary<string, object>>(jsonString);
            }
            catch (Exception ex)
            {
                throw new Exception($"Invalid JSON data: {ex.Message}");
            }
        }
        
        /// <summary>
        /// Get cache key for data
        /// </summary>
        /// <param name="data">Data to get cache key for</param>
        /// <returns>Cache key</returns>
        private string GetCacheKey(byte[] data)
        {
            // Use data length and first few bytes as cache key
            StringBuilder keyBuilder = new StringBuilder();
            keyBuilder.Append(data.Length);
            keyBuilder.Append(':');
            
            for (int i = 0; i < Math.Min(16, data.Length); i++)
            {
                keyBuilder.Append(data[i].ToString("X2"));
            }
            
            return keyBuilder.ToString();
        }
        
        /// <summary>
        /// Clear decoder cache
        /// </summary>
        public void ClearCache()
        {
            cache.Clear();
        }
    }

    /// <summary>
    /// XRAI header structure
    /// </summary>
    public class XRAIHeader
    {
        public string Magic { get; set; }
        public byte VersionMajor { get; set; }
        public byte VersionMinor { get; set; }
        public ushort Flags { get; set; }
        public long TOCOffset { get; set; }
    }

    /// <summary>
    /// XRAI TOC structure
    /// </summary>
    public class XRAITOC
    {
        public int SectionCount { get; set; }
        public List<SectionEntry> Sections { get; set; }
        public long Size { get; set; }
    }

    /// <summary>
    /// XRAI section entry
    /// </summary>
    public class SectionEntry
    {
        public int TypeId { get; set; }
        public long Offset { get; set; }
        public long Size { get; set; }
        public uint Flags { get; set; }
    }

    /// <summary>
    /// XRAI section info for validation
    /// </summary>
    public class SectionInfo
    {
        public int TypeId { get; set; }
        public long Offset { get; set; }
        public long Size { get; set; }
    }

    /// <summary>
    /// XRAI validation result
    /// </summary>
    public class ValidationResult
    {
        public bool Valid { get; set; }
        public string Version { get; set; }
        public List<string> Errors { get; set; } = new List<string>();
        public List<SectionInfo> Sections { get; set; } = new List<SectionInfo>();
    }
}
