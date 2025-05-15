# XRAI Binary Format Specification

## Overview

The XRAI binary format is designed to efficiently store and transmit extended reality content with AI components. This specification draws from established standards like glTF, USD, and WebXR while introducing novel elements for AI-driven spatial media.

## Design Principles

1. **Performance-First**: Optimized for real-time streaming and rendering across devices
2. **Extensible**: Supports extensions for future capabilities
3. **Hybrid Representation**: Combines explicit geometry with neural representations
4. **AI-Native**: First-class support for neural networks and adaptive content
5. **Web-Compatible**: Designed for efficient transmission over HTTP and WebSocket

## Binary Container Format

### Header (16 bytes)

| Offset | Size | Type   | Description                                |
|--------|------|--------|--------------------------------------------|
| 0      | 4    | ASCII  | Magic: "XRAI"                              |
| 4      | 1    | uint8  | Major version                              |
| 5      | 1    | uint8  | Minor version                              |
| 6      | 2    | uint16 | Flags (little-endian)                      |
| 8      | 8    | uint64 | Offset to Table of Contents (little-endian)|

### Flags

| Bit | Description                           |
|-----|---------------------------------------|
| 0   | Contains compressed sections          |
| 1   | Contains external references          |
| 2   | Contains embedded neural networks     |
| 3   | Contains streaming-optimized sections |
| 4-15| Reserved for future use               |

### Table of Contents

The Table of Contents (TOC) provides a map of all sections in the file.

| Offset | Size | Type   | Description                      |
|--------|------|--------|----------------------------------|
| 0      | 4    | uint32 | Number of sections (little-endian) |
| 4      | 24*n | struct | Section entries                  |

### Section Entry (24 bytes)

| Offset | Size | Type   | Description                      |
|--------|------|--------|----------------------------------|
| 0      | 4    | uint32 | Section type ID (little-endian)  |
| 4      | 8    | uint64 | Section offset (little-endian)   |
| 12     | 8    | uint64 | Section size (little-endian)     |
| 20     | 4    | uint32 | Section flags (little-endian)    |

### Section Types

| ID  | Name           | Description                                |
|-----|----------------|--------------------------------------------|
| 1   | Metadata       | JSON metadata about the content            |
| 2   | Geometry       | Mesh, point cloud, or other geometry data  |
| 3   | Materials      | Material definitions                       |
| 4   | Animations     | Animation data                             |
| 5   | Audio          | Audio data and spatial audio configuration |
| 6   | AI Components  | Neural networks, adaptation rules, etc.    |
| 7   | VFX            | Visual effects definitions                 |
| 8   | Buffers        | Binary buffer data                         |
| 9   | Images         | Texture image data                         |
| 10  | Scene          | Scene hierarchy and node definitions       |
| 11  | Extensions     | Custom extension data                      |

### Section Flags

| Bit | Description                           |
|-----|---------------------------------------|
| 0   | Section is compressed                 |
| 1   | Section contains external references  |
| 2-7 | Compression algorithm (if compressed) |
| 8-31| Reserved for future use               |

## Compression

XRAI supports section-level compression to reduce file size and transmission time. The compression algorithm is specified in the section flags.

| Algorithm ID | Description                |
|--------------|----------------------------|
| 0            | No compression             |
| 1            | Deflate                    |
| 2            | LZ4                        |
| 3            | Draco (for geometry only)  |
| 4            | ONNX (for neural networks) |
| 5-255        | Reserved for future use    |

## Alignment

All multi-byte numeric values are stored in little-endian format. All sections should be aligned to 4-byte boundaries, with padding added as necessary.

## JSON Schema

The JSON schema for XRAI content follows the structure defined in `schemas/xrai-core.json`. This schema is used for the Metadata section and provides a complete description of the content structure.

## Geometry Representation

XRAI supports multiple geometry representations:

1. **Mesh**: Traditional triangle meshes (similar to glTF)
2. **Points**: Point clouds with attributes
3. **Splat**: Gaussian splats for high-quality point-based rendering
4. **NeRF**: Neural Radiance Fields for volumetric representation
5. **Volume**: Explicit volumetric data

Each geometry type has its own binary format optimized for that representation.

### Mesh Format

Meshes follow a structure similar to glTF, with indexed triangle lists and vertex attributes. Vertex attributes include:

- POSITION (required): Vec3 float
- NORMAL: Vec3 float
- TANGENT: Vec4 float
- TEXCOORD_n: Vec2 float
- COLOR_n: Vec3 or Vec4 float
- JOINTS_n: Vec4 unsigned short
- WEIGHTS_n: Vec4 float

### Splat Format

Gaussian splats are stored as:

- Positions: Vec3 float
- Colors: Vec4 float or byte
- Scales: Vec3 float
- Rotations: Vec4 float (quaternion)
- Opacity: float (optional)

### NeRF Format

Neural Radiance Fields are stored as:

- Network architecture: string identifier
- Resolution: 3D dimensions
- Weights: binary blob in ONNX format
- Bounding box: min/max Vec3 float

## Material System

XRAI uses a Physically Based Rendering (PBR) material system similar to glTF, with extensions for:

1. **Neural materials**: Materials defined by neural networks
2. **Procedural materials**: Materials defined by shader code
3. **Dynamic materials**: Materials that adapt based on context

## AI Components

AI components are a unique feature of XRAI and include:

1. **Adaptation Rules**: Conditions and actions for dynamic content adaptation
2. **Behavior Models**: Neural networks for interactive behavior
3. **Neural Generators**: Networks for procedural content generation
4. **Style Transfer**: Networks for real-time style adaptation

## Extensions

XRAI supports extensions through a mechanism similar to glTF. Extensions can add new capabilities without breaking compatibility with existing parsers.

## Versioning

XRAI uses semantic versioning:

- Major version changes indicate breaking changes
- Minor version changes indicate non-breaking additions
- Implementations should reject files with a higher major version
- Implementations should accept files with the same major version but higher minor version

## Best Practices

1. **Chunked Streaming**: Organize data to enable progressive loading
2. **Level of Detail**: Include multiple detail levels for adaptive rendering
3. **Compression Selection**: Choose compression based on content type
4. **Texture Optimization**: Use basis compression for textures
5. **Neural Network Quantization**: Quantize neural networks for mobile devices

## Compatibility

XRAI is designed to interoperate with:

- **glTF**: Can import/export standard glTF assets
- **WebXR**: Optimized for WebXR rendering
- **USD**: Can reference USD assets and convert between formats
- **ONNX**: Uses ONNX for neural network representation

## References

1. [glTF 2.0 Specification](https://www.khronos.org/gltf/)
2. [W3C Immersive Web](https://www.w3.org/immersive-web/)
3. [OpenUSD](https://openusd.org/release/index.html)
4. [ONNX Format](https://github.com/onnx/onnx/blob/main/docs/IR.md)
5. [Draco Compression](https://google.github.io/draco/)
6. [Basis Universal Texture Format](https://github.com/BinomialLLC/basis_universal)
