/**
 * XRAI Animation Controller
 * Handles animation of objects in XRAI scenes
 */

class XRAIAnimationController {
    constructor() {
        this.scene = null;
        this.animatedObjects = new Map();
        this.isInitialized = false;
        this.isEnabled = true;
        this.lastUpdateTime = 0;
    }

    /**
     * Initialize the animation controller
     * @param {THREE.Scene} scene - Three.js scene
     */
    initialize(scene) {
        this.scene = scene;
        this.isInitialized = true;
        this.lastUpdateTime = performance.now();
        console.log('XRAI Animation Controller initialized');
    }
    
    /**
     * Load animation data from XRAI format
     * @param {Object} data - XRAI animation data
     */
    loadFromXRAI(data) {
        if (!this.isInitialized) {
            console.error('Animation controller not initialized');
            return;
        }
        
        // Clear existing animations
        this.animatedObjects.clear();
        
        // Process animations if available
        if (data.animations) {
            this.processAnimations(data.animations);
        }
        
        console.log(`Loaded ${this.animatedObjects.size} animated objects`);
    }
    
    /**
     * Process animation data
     * @param {Array} animations - Array of animation definitions
     */
    processAnimations(animations) {
        animations.forEach(animation => {
            // Find target object in scene
            let targetObject = null;
            
            // Try to find by ID or name
            this.scene.traverse(object => {
                if ((animation.targetId && object.userData.id === animation.targetId) || 
                    (animation.targetName && object.name === animation.targetName)) {
                    targetObject = object;
                }
            });
            
            if (!targetObject) {
                console.warn(`Target object for animation not found: ${animation.targetId || animation.targetName}`);
                return;
            }
            
            // Register animation
            this.animatedObjects.set(animation.id || `anim_${this.animatedObjects.size}`, {
                object: targetObject,
                type: animation.type || 'rotation',
                params: animation.params || {},
                keyframes: animation.keyframes || [],
                duration: animation.duration || 1.0,
                loop: animation.loop !== false,
                startTime: performance.now() / 1000,
                currentTime: 0
            });
        });
    }
    
    /**
     * Add a simple rotation animation to an object
     * @param {THREE.Object3D} object - Object to animate
     * @param {Object} axis - Rotation axis {x, y, z}
     * @param {number} speed - Rotation speed in radians per second
     * @returns {string} - Animation ID
     */
    addRotationAnimation(object, axis = {x: 0, y: 1, z: 0}, speed = 1.0) {
        const animId = `rotation_${this.animatedObjects.size}`;
        
        this.animatedObjects.set(animId, {
            object: object,
            type: 'rotation',
            params: {
                axis: axis,
                speed: speed
            },
            loop: true,
            startTime: performance.now() / 1000,
            currentTime: 0
        });
        
        return animId;
    }
    
    /**
     * Enable or disable the animation controller
     * @param {boolean} enabled - Whether animations should be enabled
     */
    setEnabled(enabled) {
        this.isEnabled = enabled;
        console.log(`XRAI Animation Controller ${enabled ? 'enabled' : 'disabled'}`);
    }
    
    /**
     * Update animations
     * @param {number} deltaTime - Time since last update in seconds
     */
    update(deltaTime) {
        if (!this.isInitialized || !this.isEnabled) return;
        
        // Update each animated object
        this.animatedObjects.forEach(anim => {
            // Update animation time
            anim.currentTime += deltaTime;
            
            // Handle looping
            if (anim.loop && anim.duration) {
                anim.currentTime %= anim.duration;
            }
            
            // Apply animation based on type
            switch (anim.type) {
                case 'rotation':
                    this.updateRotation(anim, deltaTime);
                    break;
                case 'position':
                    this.updatePosition(anim, deltaTime);
                    break;
                case 'scale':
                    this.updateScale(anim, deltaTime);
                    break;
                case 'keyframe':
                    this.updateKeyframe(anim);
                    break;
                default:
                    // Unknown animation type
                    break;
            }
        });
    }
    
    /**
     * Update rotation animation
     * @param {Object} anim - Animation data
     * @param {number} deltaTime - Time since last update in seconds
     */
    updateRotation(anim, deltaTime) {
        const axis = anim.params.axis || {x: 0, y: 1, z: 0};
        const speed = anim.params.speed || 1.0;
        
        // Apply rotation
        anim.object.rotation.x += axis.x * speed * deltaTime;
        anim.object.rotation.y += axis.y * speed * deltaTime;
        anim.object.rotation.z += axis.z * speed * deltaTime;
    }
    
    /**
     * Update position animation
     * @param {Object} anim - Animation data
     * @param {number} deltaTime - Time since last update in seconds
     */
    updatePosition(anim, deltaTime) {
        const direction = anim.params.direction || {x: 0, y: 1, z: 0};
        const speed = anim.params.speed || 1.0;
        const amplitude = anim.params.amplitude || 1.0;
        
        if (anim.params.oscillate) {
            // Oscillating motion
            const frequency = anim.params.frequency || 1.0;
            const offset = Math.sin(anim.currentTime * frequency * Math.PI * 2) * amplitude;
            
            // Store original position if not already stored
            if (!anim.originalPosition) {
                anim.originalPosition = {
                    x: anim.object.position.x,
                    y: anim.object.position.y,
                    z: anim.object.position.z
                };
            }
            
            // Apply oscillating position
            anim.object.position.x = anim.originalPosition.x + direction.x * offset;
            anim.object.position.y = anim.originalPosition.y + direction.y * offset;
            anim.object.position.z = anim.originalPosition.z + direction.z * offset;
        } else {
            // Linear motion
            anim.object.position.x += direction.x * speed * deltaTime;
            anim.object.position.y += direction.y * speed * deltaTime;
            anim.object.position.z += direction.z * speed * deltaTime;
        }
    }
    
    /**
     * Update scale animation
     * @param {Object} anim - Animation data
     */
    updateScale(anim) {
        const baseScale = anim.params.baseScale || 1.0;
        const amplitude = anim.params.amplitude || 0.2;
        const frequency = anim.params.frequency || 1.0;
        
        // Calculate scale factor
        const scaleFactor = baseScale + Math.sin(anim.currentTime * frequency * Math.PI * 2) * amplitude;
        
        // Apply scale
        if (anim.params.uniform) {
            // Uniform scaling
            anim.object.scale.set(scaleFactor, scaleFactor, scaleFactor);
        } else {
            // Non-uniform scaling
            const scaleX = anim.params.scaleX !== undefined ? anim.params.scaleX : 1.0;
            const scaleY = anim.params.scaleY !== undefined ? anim.params.scaleY : 1.0;
            const scaleZ = anim.params.scaleZ !== undefined ? anim.params.scaleZ : 1.0;
            
            anim.object.scale.x = baseScale + scaleX * Math.sin(anim.currentTime * frequency * Math.PI * 2) * amplitude;
            anim.object.scale.y = baseScale + scaleY * Math.sin(anim.currentTime * frequency * Math.PI * 2) * amplitude;
            anim.object.scale.z = baseScale + scaleZ * Math.sin(anim.currentTime * frequency * Math.PI * 2) * amplitude;
        }
    }
    
    /**
     * Update keyframe animation
     * @param {Object} anim - Animation data
     */
    updateKeyframe(anim) {
        // Skip if no keyframes
        if (!anim.keyframes || anim.keyframes.length < 2) return;
        
        // Calculate normalized time (0 to 1)
        const normalizedTime = anim.duration > 0 ? (anim.currentTime % anim.duration) / anim.duration : 0;
        
        // Find keyframes to interpolate between
        let keyframe1 = anim.keyframes[0];
        let keyframe2 = anim.keyframes[0];
        let t = 0;
        
        for (let i = 0; i < anim.keyframes.length; i++) {
            const keyframe = anim.keyframes[i];
            const nextKeyframe = anim.keyframes[i + 1] || anim.keyframes[0];
            
            if (keyframe.time <= normalizedTime && nextKeyframe.time > normalizedTime) {
                keyframe1 = keyframe;
                keyframe2 = nextKeyframe;
                
                // Calculate interpolation factor
                const keyframeDuration = nextKeyframe.time - keyframe.time;
                t = keyframeDuration > 0 ? (normalizedTime - keyframe.time) / keyframeDuration : 0;
                break;
            }
        }
        
        // Interpolate values
        this.interpolateKeyframes(anim.object, keyframe1, keyframe2, t);
    }
    
    /**
     * Interpolate between keyframes
     * @param {THREE.Object3D} object - Target object
     * @param {Object} keyframe1 - First keyframe
     * @param {Object} keyframe2 - Second keyframe
     * @param {number} t - Interpolation factor (0 to 1)
     */
    interpolateKeyframes(object, keyframe1, keyframe2, t) {
        // Interpolate position if available
        if (keyframe1.position && keyframe2.position) {
            object.position.x = this.lerp(keyframe1.position.x, keyframe2.position.x, t);
            object.position.y = this.lerp(keyframe1.position.y, keyframe2.position.y, t);
            object.position.z = this.lerp(keyframe1.position.z, keyframe2.position.z, t);
        }
        
        // Interpolate rotation if available
        if (keyframe1.rotation && keyframe2.rotation) {
            object.rotation.x = this.lerp(keyframe1.rotation.x, keyframe2.rotation.x, t);
            object.rotation.y = this.lerp(keyframe1.rotation.y, keyframe2.rotation.y, t);
            object.rotation.z = this.lerp(keyframe1.rotation.z, keyframe2.rotation.z, t);
        }
        
        // Interpolate scale if available
        if (keyframe1.scale && keyframe2.scale) {
            object.scale.x = this.lerp(keyframe1.scale.x, keyframe2.scale.x, t);
            object.scale.y = this.lerp(keyframe1.scale.y, keyframe2.scale.y, t);
            object.scale.z = this.lerp(keyframe1.scale.z, keyframe2.scale.z, t);
        }
    }
    
    /**
     * Linear interpolation
     * @param {number} a - Start value
     * @param {number} b - End value
     * @param {number} t - Interpolation factor (0 to 1)
     * @returns {number} - Interpolated value
     */
    lerp(a, b, t) {
        return a + (b - a) * t;
    }
    
    /**
     * Dispose of resources
     */
    dispose() {
        this.animatedObjects.clear();
        this.isInitialized = false;
    }
}

// Make available globally
window.XRAIAnimationController = XRAIAnimationController;
