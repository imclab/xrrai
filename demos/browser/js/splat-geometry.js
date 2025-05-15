/**
 * XRAI Splat Geometry
 * Handles point cloud/splat rendering for XRAI format
 */

class XRAISplatGeometry {
    constructor() {
        this.geometry = null;
        this.material = null;
        this.pointCloud = null;
    }

    /**
     * Create a splat-based point cloud from XRAI data
     * @param {Object} data - XRAI splat data
     * @param {THREE.Scene} scene - Three.js scene to add the point cloud to
     * @returns {THREE.Points} - The created point cloud object
     */
    createFromXRAI(data, scene) {
        // Create geometry
        this.geometry = new THREE.BufferGeometry();
        
        // Parse positions
        if (data.positions && data.positions.length > 0) {
            const positions = new Float32Array(data.positions);
            this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        } else {
            console.warn('No position data found for splat geometry');
            return null;
        }
        
        // Parse colors if available
        if (data.colors && data.colors.length > 0) {
            const colors = new Float32Array(data.colors);
            this.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        }
        
        // Parse sizes if available
        if (data.sizes && data.sizes.length > 0) {
            const sizes = new Float32Array(data.sizes);
            this.geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        } else {
            // Default size
            const count = data.positions.length / 3;
            const sizes = new Float32Array(count).fill(0.05);
            this.geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        }
        
        // Create material
        this.material = new THREE.PointsMaterial({
            size: 0.05,
            vertexColors: data.colors ? true : false,
            sizeAttenuation: true,
            transparent: true,
            opacity: 0.8
        });
        
        // If no colors provided, set a default color
        if (!data.colors) {
            this.material.color.set(0x00ff00);
        }
        
        // Create point cloud
        this.pointCloud = new THREE.Points(this.geometry, this.material);
        
        // Add to scene if provided
        if (scene) {
            scene.add(this.pointCloud);
        }
        
        return this.pointCloud;
    }
    
    /**
     * Update the splat geometry with new data
     * @param {Object} data - New XRAI splat data
     */
    update(data) {
        if (!this.geometry) {
            console.warn('Cannot update splat geometry: geometry not initialized');
            return;
        }
        
        // Update positions if provided
        if (data.positions && data.positions.length > 0) {
            const positions = new Float32Array(data.positions);
            this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        }
        
        // Update colors if provided
        if (data.colors && data.colors.length > 0) {
            const colors = new Float32Array(data.colors);
            this.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        }
        
        // Update sizes if provided
        if (data.sizes && data.sizes.length > 0) {
            const sizes = new Float32Array(data.sizes);
            this.geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        }
        
        // Mark attributes for update
        this.geometry.attributes.position.needsUpdate = true;
        if (this.geometry.attributes.color) this.geometry.attributes.color.needsUpdate = true;
        if (this.geometry.attributes.size) this.geometry.attributes.size.needsUpdate = true;
    }
    
    /**
     * Dispose of geometry and material resources
     */
    dispose() {
        if (this.geometry) {
            this.geometry.dispose();
        }
        
        if (this.material) {
            this.material.dispose();
        }
        
        this.geometry = null;
        this.material = null;
        this.pointCloud = null;
    }
}

// Make available globally
window.XRAISplatGeometry = XRAISplatGeometry;
