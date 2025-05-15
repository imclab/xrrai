# XRAI Format: VFX System Specification

## 1. Overview

The Visual Effects (VFX) system in the XRAI format provides a comprehensive framework for defining, rendering, and optimizing dynamic visual effects across platforms. This specification details how VFX components are represented in the binary format and how they integrate with other aspects of the XRAI ecosystem.

## 2. VFX in XRAI Binary Format

VFX components are stored in a dedicated section within the XRAI binary format, identified by section type ID 7. The VFX section follows the schema defined in `schemas/xrai-core.json` and is structured to support efficient streaming and progressive loading.

```json
{
  "vfx": {
    "particleSystems": [
      {
        "id": "string",
        "maxParticles": 1000,
        "emissionRate": 10.0,
        "lifetime": 5.0,
        "texture": 0,
        "startColor": [1.0, 1.0, 1.0, 1.0],
        "endColor": [1.0, 1.0, 1.0, 0.0],
        "startSize": 1.0,
        "endSize": 0.1,
        "velocityFunction": "string"
      }
    ],
    "shaders": [
      {
        "id": "string",
        "vertexShader": "string",
        "fragmentShader": "string",
        "uniforms": {
          "property": {
            "type": "string",
            "value": "any"
          }
        }
      }
    ]
  }
}
```

## 3. Key Components

### 3.1 Particle Systems
- **Representation Types**: 
  - Explicit: Directly defined particles with specific properties
  - Procedural: Generated through algorithms and patterns
  - Neural: Behavior learned from examples or simulations

- **Core Properties**: 
  - Emission: Rate, burst patterns, spawn shape
  - Physical: Lifetime, velocity, forces, gravity
  - Appearance: Color, size, opacity, texture
  - Force Fields: Attractors, repulsors, vortex
  - Collision: Surface interaction, bounce, friction

- **Advanced Features**: 
  - GPU Instancing: Efficient rendering of many particles
  - Compute Shader Integration: Physics simulation on GPU
  - LOD System: Detail reduction based on distance/performance

- **AI Enhancement**: 
  - Behavior Learning: Adapting to physics and environment
  - Context Adaptation: Changing based on scene conditions
  - Style Transfer: Applying learned visual styles

### 3.2 Shader Systems
- **Shader Types**: 
  - Material-Based: Surface appearance and properties
  - Post-Processing: Screen-space effects
  - Compute: General-purpose GPU computation
  - Neural: Network-driven visual effects

- **Language Support**: 
  - Cross-Platform: GLSL, HLSL with translation
  - Platform-Specific: Optimized for target hardware
  - Shader Graph: Node-based visual programming

- **Rendering Techniques**: 
  - Global Illumination: Realistic lighting
  - Volumetric Effects: Fog, clouds, smoke
  - Screen-Space Effects: Reflections, ambient occlusion

- **AI-Enhanced**: 
  - Neural Material Inference: Generating materials from references
  - Style-Aware Rendering: Adapting to artistic direction
  - Performance-Adaptive: Scaling complexity based on hardware

### 3.3 VFX Graph System
- **Node Architecture**: 
  - Input Nodes: Scene parameters, user input, context
  - Processing Nodes: Transformation, simulation, generation
  - Output Nodes: Rendering, audio triggers, events
  - Control Nodes: Logic, timing, sequencing
  - AI Nodes: Neural networks, adaptation rules

- **Key Features**: 
  - Visual Programming: Intuitive node-based interface
  - Component Reuse: Library of effects and sub-graphs
  - Real-time Editing: Live preview and parameter tuning

- **Execution Model**: 
  - Parallel Processing: Multi-threaded and GPU-accelerated
  - Dependency-based Scheduling: Optimal execution order

## 4. Performance Optimization

### 4.1 Rendering Techniques
- **Automatic LOD**: Dynamic detail adjustment based on distance and performance
- **Instancing**: Efficient rendering of repeated elements
- **Compute Utilization**: Leveraging GPU for simulation and generation
- **Temporal Amortization**: Distributing computation across frames

### 4.2 Memory Management
- **Resource Pooling**: Reusing particle and effect instances
- **Streaming**: Progressive loading of effect data
- **Compression**: Efficient storage of textures and parameters

## 5. Integration with Industry Standards

### 5.1 Shader Compatibility
- **WebGPU/WebGL**: Web platform support
- **Shader Model Mapping**: Compatibility with various GPU capabilities
- **Material Definition Language**: Alignment with PBR standards

### 5.2 VFX Interoperability
- **Unity VFX Graph**: Import/export compatibility
- **Unreal Niagara**: Conversion support
- **Houdini Engine**: Integration with procedural generation

## 6. Example Implementations

### 6.1 Particle System Example (Waterfall Splash)

```json
{
  "vfx": {
    "particleSystems": [{
      "id": "waterfall_splash",
      "maxParticles": 2000,
      "emissionRate": 200,
      "lifetime": 2.5,
      "texture": 12,  // Index to water droplet texture
      "startColor": [0.8, 0.9, 1.0, 0.8],
      "endColor": [0.8, 0.9, 1.0, 0.0],
      "startSize": 0.05,
      "endSize": 0.02,
      "velocityFunction": "splash_velocity",
      "forces": [{
        "type": "gravity",
        "value": [0, -9.8, 0]
      }, {
        "type": "drag",
        "value": 0.1
      }],
      "collision": {
        "enabled": true,
        "bounce": 0.3,
        "lifetime": 0.5
      },
      "adaptationRules": [{
        "condition": "context.performance < 30",
        "action": "setMaxParticles(1000)"
      }, {
        "condition": "context.performance < 20",
        "action": "setMaxParticles(500)"
      }]
    }]
  }
}
```

### 6.2 Shader Example (Ocean Surface)

```json
{
  "vfx": {
    "shaders": [{
      "id": "ocean_surface",
      "vertexShader": "ocean_vertex.glsl",
      "fragmentShader": "ocean_fragment.glsl",
      "uniforms": {
        "waveHeight": {
          "type": "float",
          "value": 1.0
        },
        "waveSpeed": {
          "type": "float",
          "value": 0.5
        },
        "waveScale": {
          "type": "float",
          "value": 0.1
        },
        "oceanColor": {
          "type": "vec3",
          "value": [0.0, 0.48, 0.8]
        },
        "foamColor": {
          "type": "vec3",
          "value": [1.0, 1.0, 1.0]
        },
        "time": {
          "type": "float",
          "value": 0.0
        }
      },
      "qualityLevels": [{
        "level": "high",
        "defines": {
          "WAVE_LAYERS": 4,
          "USE_NORMAL_MAPPING": 1,
          "USE_FOAM": 1,
          "USE_REFLECTIONS": 1
        }
      }, {
        "level": "medium",
        "defines": {
          "WAVE_LAYERS": 2,
          "USE_NORMAL_MAPPING": 1,
          "USE_FOAM": 1,
          "USE_REFLECTIONS": 0
        }
      }, {
        "level": "low",
        "defines": {
          "WAVE_LAYERS": 1,
          "USE_NORMAL_MAPPING": 0,
          "USE_FOAM": 0,
          "USE_REFLECTIONS": 0
        }
      }]
    }]
  }
}
```

### 6.3 VFX Graph Example (Magic Effect)

```json
{
  "vfx": {
    "graphs": [{
      "id": "magic_spell",
      "nodes": [{
        "id": "emitter",
        "type": "particleEmitter",
        "properties": {
          "rate": 50,
          "lifetime": 2.0,
          "shape": "sphere",
          "radius": 0.1
        }
      }, {
        "id": "spiralMotion",
        "type": "forceField",
        "properties": {
          "type": "vortex",
          "strength": 2.0,
          "axis": [0, 1, 0]
        }
      }, {
        "id": "glowRenderer",
        "type": "renderer",
        "properties": {
          "material": "glow_material",
          "additive": true,
          "sortingOrder": 10
        }
      }, {
        "id": "contextAdapt",
        "type": "aiNode",
        "properties": {
          "adaptationType": "performance",
          "parameters": ["emitter.rate", "glowRenderer.quality"]
        }
      }],
      "connections": [{
        "from": "emitter",
        "to": "spiralMotion"
      }, {
        "from": "spiralMotion",
        "to": "glowRenderer"
      }, {
        "from": "contextAdapt",
        "to": "emitter"
      }, {
        "from": "contextAdapt",
        "to": "glowRenderer"
      }]
    }]
  }
}
```

## 7. Integration with XRAI Binary Format

VFX components are stored in the binary format as follows:

1. **Section Header**: Type ID 7 (VFX), with appropriate flags for compression if used
2. **JSON Metadata**: Schema-compliant JSON describing the VFX components
3. **Binary Assets**: Shader code, textures, and other resources referenced by index
4. **Neural Network Data**: ONNX-format weights for AI-enhanced effects

The binary encoding follows the alignment and padding rules defined in `spec/binary-format.md` to ensure optimal memory access and streaming capabilities.

## 8. Conclusion

The XRAI VFX system provides a comprehensive framework for creating, optimizing, and delivering dynamic visual effects across platforms. By combining traditional techniques with AI-driven enhancements and a flexible node-based architecture, it enables creators to build effects that are both visually impressive and computationally efficient.

The system is designed to align with industry standards like WebGPU, Unity VFX Graph, and Unreal Niagara, while extending capabilities through AI integration and context-aware adaptation. This ensures compatibility with existing workflows while pushing the boundaries of what's possible in real-time visual effects.

By following this specification, developers can create VFX that seamlessly integrate with the XRAI format's binary structure, taking full advantage of its performance optimizations and progressive loading capabilities.
