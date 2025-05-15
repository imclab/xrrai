/**
 * XRAI Viewer
 * A Three.js-based viewer for XRAI format files
 */

class XRAIViewer {
    constructor(canvasId) {
        this.canvasId = canvasId;
        this.canvas = document.getElementById(canvasId);
        this.stats = document.getElementById('stats');
        this.loadingMessage = document.getElementById('loading-message');
        
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.clock = new THREE.Clock();
        this.mixers = [];
        this.materials = {};
        this.geometries = {};
        this.textures = {};
        this.aiComponents = {};
        
        this.init();
    }
    
    /**
     * Initialize the Three.js scene
     */
    init() {
        // Create scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a1a1a);
        
        // Create camera
        this.camera = new THREE.PerspectiveCamera(
            75, // FOV
            this.canvas.clientWidth / this.canvas.clientHeight, // Aspect ratio
            0.1, // Near plane
            1000 // Far plane
        );
        this.camera.position.set(0, 1.5, 3);
        
        // Create renderer
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true
        });
        this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        
        // Add lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(1, 2, 3);
        directionalLight.castShadow = true;
        this.scene.add(directionalLight);
        
        // Add grid helper
        const gridHelper = new THREE.GridHelper(10, 10);
        this.scene.add(gridHelper);
        
        // Add orbit controls if available
        if (typeof THREE.OrbitControls !== 'undefined') {
            this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
            this.controls.enableDamping = true;
            this.controls.dampingFactor = 0.05;
        }
        
        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize());
        
        // Start animation loop
        this.animate();
        
        // Show ready message
        this.loadingMessage.textContent = 'Viewer ready';
    }
    
    /**
     * Handle window resize
     */
    onWindowResize() {
        this.camera.aspect = this.canvas.clientWidth / this.canvas.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight);
    }
    
    /**
     * Animation loop
     */
    animate() {
        requestAnimationFrame(() => this.animate());
        
        const delta = this.clock.getDelta();
        
        // Update mixers for animations
        for (const mixer of this.mixers) {
            mixer.update(delta);
        }
        
        // Update controls if available
        if (this.controls) {
            this.controls.update();
        }
        
        // Update AI components
        this.updateAIComponents(delta);
        
        // Render scene
        this.renderer.render(this.scene, this.camera);
        
        // Update stats
        this.updateStats();
    }
    
    /**
     * Update stats display
     */
    updateStats() {
        if (this.stats) {
            const polyCount = this.renderer.info.render.triangles;
            const drawCalls = this.renderer.info.render.calls;
            
            this.stats.textContent = `Triangles: ${polyCount} | Draw calls: ${drawCalls}`;
        }
    }
    
    /**
     * Load an XRAI scene
     * @param {Object} data - Parsed XRAI data
     */
    loadScene(data) {
        console.log('Loading XRAI scene:', data);
        
        // Clear existing scene
        this.clearScene();
        
        // Show loading message
        this.loadingMessage.textContent = 'Loading scene...';
        
        try {
            // Process materials first
            if (data.materials) {
                this.processMaterials(data.materials);
            }
            
            // Process geometries
            if (data.geometry) {
                this.processGeometries(data.geometry);
            }
            
            // Process AI components
            if (data.aiComponents) {
                this.processAIComponents(data.aiComponents);
            }
            
            // Process scene objects
            if (data.scene) {
                this.processScene(data.scene);
            } else {
                // If no scene section, create a demo scene
                this.createDemoScene(data);
            }
            
            // Hide loading message
            this.loadingMessage.textContent = '';
            
        } catch (error) {
            console.error('Error loading scene:', error);
            this.loadingMessage.textContent = `Error: ${error.message}`;
        }
    }
    
    /**
     * Clear the current scene
     */
    clearScene() {
        // Remove all objects except lights and grid
        while (this.scene.children.length > 3) {
            const object = this.scene.children[3];
            this.scene.remove(object);
        }
        
        // Clear collections
        this.mixers = [];
        this.materials = {};
        this.geometries = {};
        this.textures = {};
        this.aiComponents = {};
    }
    
    /**
     * Process materials from XRAI data
     * @param {Array|Object} materials - Materials data
     */
    processMaterials(materials) {
        const materialArray = Array.isArray(materials) ? materials : [materials];
        
        materialArray.forEach(materialData => {
            const { id, type, ...properties } = materialData;
            
            if (!id) return;
            
            let material;
            
            switch (type) {
                case 'standard':
                    material = new THREE.MeshStandardMaterial();
                    break;
                case 'basic':
                    material = new THREE.MeshBasicMaterial();
                    break;
                case 'phong':
                    material = new THREE.MeshPhongMaterial();
                    break;
                case 'lambert':
                    material = new THREE.MeshLambertMaterial();
                    break;
                default:
                    material = new THREE.MeshStandardMaterial();
            }
            
            // Apply properties
            Object.entries(properties).forEach(([key, value]) => {
                if (key === 'color' || key === 'emissive' || key === 'specular') {
                    if (Array.isArray(value) && value.length >= 3) {
                        material[key] = new THREE.Color(value[0], value[1], value[2]);
                    } else if (typeof value === 'string') {
                        material[key] = new THREE.Color(value);
                    }
                } else if (key === 'map' || key === 'normalMap' || key === 'roughnessMap') {
                    // Handle texture references
                    if (this.textures[value]) {
                        material[key] = this.textures[value];
                    }
                } else {
                    material[key] = value;
                }
            });
            
            this.materials[id] = material;
        });
    }
    
    /**
     * Process geometries from XRAI data
     * @param {Array|Object} geometries - Geometries data
     */
    processGeometries(geometries) {
        const geometryArray = Array.isArray(geometries) ? geometries : [geometries];
        
        geometryArray.forEach(geometryData => {
            const { id, type, ...properties } = geometryData;
            
            if (!id) return;
            
            let geometry;
            
            switch (type) {
                case 'box':
                    geometry = new THREE.BoxGeometry(
                        properties.width || 1,
                        properties.height || 1,
                        properties.depth || 1
                    );
                    break;
                case 'sphere':
                    geometry = new THREE.SphereGeometry(
                        properties.radius || 1,
                        properties.widthSegments || 32,
                        properties.heightSegments || 16
                    );
                    break;
                case 'plane':
                    geometry = new THREE.PlaneGeometry(
                        properties.width || 1,
                        properties.height || 1
                    );
                    break;
                case 'mesh':
                    // Create custom geometry from vertices and triangles
                    if (properties.vertices && properties.triangles) {
                        geometry = new THREE.BufferGeometry();
                        
                        // Set vertices
                        const vertices = new Float32Array(properties.vertices);
                        geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
                        
                        // Set faces
                        if (Array.isArray(properties.triangles)) {
                            const indices = [];
                            properties.triangles.forEach(triangle => {
                                if (Array.isArray(triangle) && triangle.length >= 3) {
                                    indices.push(triangle[0], triangle[1], triangle[2]);
                                }
                            });
                            geometry.setIndex(indices);
                        }
                        
                        // Compute normals
                        geometry.computeVertexNormals();
                    }
                    break;
                default:
                    geometry = new THREE.BoxGeometry(1, 1, 1);
            }
            
            this.geometries[id] = geometry;
        });
    }
    
    /**
     * Process AI components from XRAI data
     * @param {Object} aiComponents - AI components data
     */
    processAIComponents(aiComponents) {
        this.aiComponents = aiComponents;
        
        // Process adaptation rules
        if (aiComponents.adaptationRules) {
            // Store rules for runtime use
            this.adaptationRules = aiComponents.adaptationRules;
        }
        
        // Process behavior models
        if (aiComponents.behaviorModels) {
            // Store behavior models for runtime use
            this.behaviorModels = aiComponents.behaviorModels;
        }
    }
    
    /**
     * Update AI components during animation
     * @param {number} delta - Time delta
     */
    updateAIComponents(delta) {
        // Apply adaptation rules
        if (this.adaptationRules) {
            // Create context for rules evaluation
            const context = {
                time: this.clock.elapsedTime,
                delta,
                camera: {
                    position: this.camera.position.toArray(),
                    rotation: this.camera.rotation.toArray()
                },
                // Add more context as needed
            };
            
            // Evaluate rules
            this.adaptationRules.forEach(rule => {
                try {
                    if (rule.condition && rule.action) {
                        // Simple evaluation for demo
                        const conditionMet = eval(`with(context) { ${rule.condition} }`);
                        
                        if (conditionMet) {
                            // Execute action
                            eval(`with(context) { ${rule.action} }`);
                        }
                    }
                } catch (error) {
                    console.warn(`Error evaluating rule ${rule.id}:`, error);
                }
            });
        }
    }
    
    /**
     * Process scene objects from XRAI data
     * @param {Object} sceneData - Scene data
     */
    processScene(sceneData) {
        // Process nodes
        if (sceneData.nodes) {
            sceneData.nodes.forEach(node => this.createNode(node));
        }
    }
    
    /**
     * Create a scene node
     * @param {Object} nodeData - Node data
     * @returns {THREE.Object3D} - Created node
     */
    createNode(nodeData) {
        const { id, name, type, geometry, material, position, rotation, scale, children } = nodeData;
        
        let object;
        
        // Create object based on type
        switch (type) {
            case 'mesh':
                // Get geometry
                let geo = this.geometries[geometry];
                if (!geo) {
                    geo = new THREE.BoxGeometry(1, 1, 1);
                }
                
                // Get material
                let mat = this.materials[material];
                if (!mat) {
                    mat = new THREE.MeshStandardMaterial({ color: 0x808080 });
                }
                
                // Create mesh
                object = new THREE.Mesh(geo, mat);
                break;
                
            case 'group':
                object = new THREE.Group();
                break;
                
            case 'light':
                // Create light based on subtype
                const lightType = nodeData.lightType || 'point';
                const color = nodeData.color ? new THREE.Color(...nodeData.color) : 0xffffff;
                const intensity = nodeData.intensity || 1;
                
                switch (lightType) {
                    case 'point':
                        object = new THREE.PointLight(color, intensity);
                        break;
                    case 'spot':
                        object = new THREE.SpotLight(color, intensity);
                        break;
                    case 'directional':
                        object = new THREE.DirectionalLight(color, intensity);
                        break;
                    default:
                        object = new THREE.PointLight(color, intensity);
                }
                break;
                
            default:
                object = new THREE.Object3D();
        }
        
        // Set properties
        if (id) object.userData.id = id;
        if (name) object.name = name;
        
        // Set transform
        if (position && position.length >= 3) {
            object.position.set(position[0], position[1], position[2]);
        }
        
        if (rotation && rotation.length >= 3) {
            object.rotation.set(
                THREE.MathUtils.degToRad(rotation[0]),
                THREE.MathUtils.degToRad(rotation[1]),
                THREE.MathUtils.degToRad(rotation[2])
            );
        }
        
        if (scale && scale.length >= 3) {
            object.scale.set(scale[0], scale[1], scale[2]);
        }
        
        // Add to scene
        this.scene.add(object);
        
        // Process children
        if (children && Array.isArray(children)) {
            children.forEach(childData => {
                const child = this.createNode(childData);
                object.add(child);
            });
        }
        
        return object;
    }
    
    /**
     * Create a demo scene when no scene data is provided
     * @param {Object} data - XRAI data
     */
    createDemoScene(data) {
        // Create a simple demo scene to visualize the XRAI data
        
        // Add a floor
        const floorGeometry = new THREE.PlaneGeometry(10, 10);
        const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x808080 });
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        this.scene.add(floor);
        
        // If we have geometries, create a showcase
        if (Object.keys(this.geometries).length > 0) {
            let offsetX = -2;
            
            for (const [id, geometry] of Object.entries(this.geometries)) {
                // Get a material
                let material;
                if (Object.keys(this.materials).length > 0) {
                    const materialId = Object.keys(this.materials)[Math.floor(Math.random() * Object.keys(this.materials).length)];
                    material = this.materials[materialId];
                } else {
                    material = new THREE.MeshStandardMaterial({ color: 0x3498db });
                }
                
                // Create mesh
                const mesh = new THREE.Mesh(geometry, material);
                mesh.position.set(offsetX, 1, 0);
                mesh.castShadow = true;
                mesh.userData.id = id;
                
                this.scene.add(mesh);
                
                offsetX += 2;
            }
        } else {
            // Create default objects
            const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
            const sphereGeometry = new THREE.SphereGeometry(0.5, 32, 16);
            
            const redMaterial = new THREE.MeshStandardMaterial({ color: 0xe74c3c });
            const blueMaterial = new THREE.MeshStandardMaterial({ color: 0x3498db });
            
            const box = new THREE.Mesh(boxGeometry, redMaterial);
            box.position.set(-1, 0.5, 0);
            box.castShadow = true;
            this.scene.add(box);
            
            const sphere = new THREE.Mesh(sphereGeometry, blueMaterial);
            sphere.position.set(1, 0.5, 0);
            sphere.castShadow = true;
            this.scene.add(sphere);
        }
        
        // Add AI component visualization if available
        if (data.aiComponents) {
            // Create a marker for AI components
            const markerGeometry = new THREE.SphereGeometry(0.2, 16, 8);
            const markerMaterial = new THREE.MeshStandardMaterial({ color: 0x2ecc71, emissive: 0x2ecc71, emissiveIntensity: 0.5 });
            
            const marker = new THREE.Mesh(markerGeometry, markerMaterial);
            marker.position.set(0, 2, 0);
            
            // Add pulsing animation
            const markerAnimation = () => {
                const time = this.clock.getElapsedTime();
                marker.scale.set(
                    1 + Math.sin(time * 2) * 0.2,
                    1 + Math.sin(time * 2) * 0.2,
                    1 + Math.sin(time * 2) * 0.2
                );
                requestAnimationFrame(markerAnimation);
            };
            
            markerAnimation();
            this.scene.add(marker);
        }
    }
}

// If running in Node.js environment, export the class
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { XRAIViewer };
}
