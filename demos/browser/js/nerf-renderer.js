/**
 * XRAI NeRF Renderer
 * Handles Neural Radiance Field rendering for XRAI format
 */

class XRAINeRFRenderer {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.volume = null;
        this.material = null;
        this.isInitialized = false;
    }

    /**
     * Initialize the NeRF renderer
     * @param {THREE.Scene} scene - Three.js scene
     * @param {THREE.Camera} camera - Three.js camera
     * @param {THREE.WebGLRenderer} renderer - Three.js renderer
     */
    initialize(scene, camera, renderer) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.isInitialized = true;
        
        // Create shader material for volume rendering
        this.material = new THREE.ShaderMaterial({
            uniforms: {
                uVolume: { value: null },
                uVolumeSize: { value: new THREE.Vector3(1, 1, 1) },
                uInvTransform: { value: new THREE.Matrix4() },
                uCameraPosition: { value: new THREE.Vector3() },
                uStepSize: { value: 0.01 },
                uDensityFactor: { value: 1.0 },
                uOpacityThreshold: { value: 0.01 }
            },
            vertexShader: `
                varying vec3 vPosition;
                varying vec3 vWorldPosition;
                
                void main() {
                    vPosition = position;
                    vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform sampler3D uVolume;
                uniform vec3 uVolumeSize;
                uniform mat4 uInvTransform;
                uniform vec3 uCameraPosition;
                uniform float uStepSize;
                uniform float uDensityFactor;
                uniform float uOpacityThreshold;
                
                varying vec3 vPosition;
                varying vec3 vWorldPosition;
                
                // Ray-box intersection
                vec2 rayBoxIntersection(vec3 rayOrigin, vec3 rayDir, vec3 boxMin, vec3 boxMax) {
                    vec3 invDir = 1.0 / rayDir;
                    vec3 tMin = (boxMin - rayOrigin) * invDir;
                    vec3 tMax = (boxMax - rayOrigin) * invDir;
                    vec3 t1 = min(tMin, tMax);
                    vec3 t2 = max(tMin, tMax);
                    float tNear = max(max(t1.x, t1.y), t1.z);
                    float tFar = min(min(t2.x, t2.y), t2.z);
                    return vec2(tNear, tFar);
                }
                
                // Volume sampling
                vec4 sampleVolume(vec3 pos) {
                    // Convert to texture coordinates [0,1]
                    vec3 texCoord = (pos + 0.5) / uVolumeSize;
                    
                    // Sample the volume texture
                    return texture(uVolume, texCoord);
                }
                
                void main() {
                    // Calculate ray in volume space
                    vec3 rayOrigin = (uInvTransform * vec4(uCameraPosition, 1.0)).xyz;
                    vec3 rayDir = normalize((uInvTransform * vec4(normalize(vWorldPosition - uCameraPosition), 0.0)).xyz);
                    
                    // Intersect with volume bounds
                    vec3 boxMin = vec3(-0.5, -0.5, -0.5);
                    vec3 boxMax = vec3(0.5, 0.5, 0.5);
                    vec2 tBox = rayBoxIntersection(rayOrigin, rayDir, boxMin, boxMax);
                    
                    // Skip if no intersection
                    if (tBox.x > tBox.y) {
                        discard;
                    }
                    
                    // Clamp to near plane
                    float tStart = max(0.0, tBox.x);
                    float tEnd = tBox.y;
                    
                    // Initialize ray marching
                    vec3 pos = rayOrigin + tStart * rayDir;
                    vec4 color = vec4(0.0);
                    
                    // Ray marching loop
                    for (float t = tStart; t < tEnd; t += uStepSize) {
                        // Sample volume
                        vec4 sample = sampleVolume(pos);
                        
                        // Apply density factor
                        sample.a *= uDensityFactor;
                        
                        // Skip low opacity samples
                        if (sample.a > uOpacityThreshold) {
                            // Front-to-back compositing
                            sample.rgb *= sample.a;
                            color.rgb = color.rgb + (1.0 - color.a) * sample.rgb;
                            color.a = color.a + (1.0 - color.a) * sample.a;
                            
                            // Early ray termination
                            if (color.a >= 0.99) {
                                break;
                            }
                        }
                        
                        // Step along ray
                        pos += rayDir * uStepSize;
                    }
                    
                    // Output final color
                    gl_FragColor = color;
                }
            `,
            transparent: true,
            side: THREE.BackSide
        });
    }
    
    /**
     * Load NeRF data from XRAI format
     * @param {Object} data - XRAI NeRF data
     * @returns {THREE.Mesh} - The created volume mesh
     */
    loadFromXRAI(data) {
        if (!this.isInitialized) {
            console.error('NeRF renderer not initialized');
            return null;
        }
        
        // Clean up previous volume if exists
        if (this.volume) {
            this.scene.remove(this.volume);
            this.volume.geometry.dispose();
            // Material is reused, not disposed
        }
        
        // Create volume geometry (a simple box)
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        
        // Create volume mesh with the shader material
        this.volume = new THREE.Mesh(geometry, this.material);
        
        // Set volume position and scale
        if (data.position) {
            this.volume.position.set(
                data.position.x || 0,
                data.position.y || 0,
                data.position.z || 0
            );
        }
        
        if (data.scale) {
            this.volume.scale.set(
                data.scale.x || 1,
                data.scale.y || 1,
                data.scale.z || 1
            );
        }
        
        if (data.rotation) {
            this.volume.rotation.set(
                THREE.MathUtils.degToRad(data.rotation.x || 0),
                THREE.MathUtils.degToRad(data.rotation.y || 0),
                THREE.MathUtils.degToRad(data.rotation.z || 0)
            );
        }
        
        // Add to scene
        this.scene.add(this.volume);
        
        // Create 3D texture from volume data
        if (data.volumeData) {
            // This is a placeholder - in a real implementation, 
            // you would create a 3D texture from the volume data
            console.log('Loading NeRF volume data:', data.volumeData);
            
            // For now, we'll just set some dummy values
            this.material.uniforms.uVolumeSize.value.set(
                data.dimensions?.x || 64,
                data.dimensions?.y || 64,
                data.dimensions?.z || 64
            );
            
            // Update material parameters
            this.material.uniforms.uStepSize.value = data.stepSize || 0.01;
            this.material.uniforms.uDensityFactor.value = data.densityFactor || 1.0;
            this.material.uniforms.uOpacityThreshold.value = data.opacityThreshold || 0.01;
        }
        
        return this.volume;
    }
    
    /**
     * Update the renderer each frame
     */
    update() {
        if (!this.isInitialized || !this.volume) return;
        
        // Update camera position uniform
        this.material.uniforms.uCameraPosition.value.copy(this.camera.position);
        
        // Update inverse transform matrix
        this.volume.updateMatrixWorld();
        const invMatrix = new THREE.Matrix4().copy(this.volume.matrixWorld).invert();
        this.material.uniforms.uInvTransform.value.copy(invMatrix);
    }
    
    /**
     * Dispose of resources
     */
    dispose() {
        if (this.volume) {
            this.scene.remove(this.volume);
            this.volume.geometry.dispose();
        }
        
        if (this.material) {
            this.material.dispose();
        }
        
        this.volume = null;
        this.material = null;
        this.isInitialized = false;
    }
}

// Make available globally
window.XRAINeRFRenderer = XRAINeRFRenderer;
