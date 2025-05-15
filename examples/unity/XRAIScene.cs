using System;
using System.Collections.Generic;
using UnityEngine;

namespace XRAI
{
    /// <summary>
    /// Represents a complete XRAI scene with all components
    /// </summary>
    public class XRAIScene : IDisposable
    {
        // Scene metadata
        public XRAIMetadata Metadata { get; private set; }
        
        // Collections of scene elements
        private List<XRAIGeometryBase> geometries = new List<XRAIGeometryBase>();
        private List<XRAIMaterial> materials = new List<XRAIMaterial>();
        private List<XRAIParticleSystem> particleSystems = new List<XRAIParticleSystem>();
        private List<XRAIVFXGraph> vfxGraphs = new List<XRAIVFXGraph>();
        private List<XRAINeuralBehavior> behaviorModels = new List<XRAINeuralBehavior>();
        
        // Controllers
        private XRAIAdaptationController adaptationController;
        private XRAIStyleTransfer styleTransfer;
        
        // Current context
        private XRAIContext context = new XRAIContext();
        
        // Unity GameObjects
        private GameObject rootObject;
        private Dictionary<string, GameObject> nodeObjects = new Dictionary<string, GameObject>();
        
        /// <summary>
        /// Create a new XRAI scene
        /// </summary>
        public XRAIScene(XRAIMetadata metadata = null)
        {
            Metadata = metadata ?? new XRAIMetadata();
            rootObject = new GameObject("XRAI_Scene");
            rootObject.isStatic = false;
        }
        
        /// <summary>
        /// Add geometry to the scene
        /// </summary>
        public void AddGeometry(XRAIGeometryBase geometry)
        {
            geometries.Add(geometry);
            
            // Create GameObject for this geometry
            GameObject geometryObject = new GameObject(geometry.Id);
            geometryObject.transform.SetParent(rootObject.transform, false);
            
            // Apply transform
            if (geometry.Transform != null)
            {
                geometryObject.transform.position = geometry.Transform.Position;
                geometryObject.transform.rotation = Quaternion.Euler(geometry.Transform.Rotation);
                geometryObject.transform.localScale = geometry.Transform.Scale;
            }
            
            // Apply geometry-specific setup
            geometry.ApplyToGameObject(geometryObject);
            
            // Store reference
            nodeObjects[geometry.Id] = geometryObject;
        }
        
        /// <summary>
        /// Add material to the scene
        /// </summary>
        public void AddMaterial(XRAIMaterial material)
        {
            materials.Add(material);
        }
        
        /// <summary>
        /// Add particle system to the scene
        /// </summary>
        public void AddParticleSystem(XRAIParticleSystem particleSystem)
        {
            particleSystems.Add(particleSystem);
            
            // Create GameObject for this particle system
            GameObject psObject = new GameObject(particleSystem.Id);
            psObject.transform.SetParent(rootObject.transform, false);
            
            // Apply transform
            if (particleSystem.Transform != null)
            {
                psObject.transform.position = particleSystem.Transform.Position;
                psObject.transform.rotation = Quaternion.Euler(particleSystem.Transform.Rotation);
                psObject.transform.localScale = particleSystem.Transform.Scale;
            }
            
            // Apply particle system setup
            particleSystem.ApplyToGameObject(psObject);
            
            // Store reference
            nodeObjects[particleSystem.Id] = psObject;
        }
        
        /// <summary>
        /// Add VFX graph to the scene
        /// </summary>
        public void AddVFXGraph(XRAIVFXGraph vfxGraph)
        {
            vfxGraphs.Add(vfxGraph);
            
            // Create GameObject for this VFX graph
            GameObject vfxObject = new GameObject(vfxGraph.Id);
            vfxObject.transform.SetParent(rootObject.transform, false);
            
            // Apply VFX graph setup
            vfxGraph.ApplyToGameObject(vfxObject);
            
            // Store reference
            nodeObjects[vfxGraph.Id] = vfxObject;
        }
        
        /// <summary>
        /// Add behavior model to the scene
        /// </summary>
        public void AddBehaviorModel(XRAINeuralBehavior behaviorModel)
        {
            behaviorModels.Add(behaviorModel);
            
            // If this behavior is attached to a specific node, find it
            if (!string.IsNullOrEmpty(behaviorModel.TargetNodeId) && nodeObjects.TryGetValue(behaviorModel.TargetNodeId, out GameObject targetObject))
            {
                // Apply behavior to target object
                behaviorModel.ApplyToGameObject(targetObject);
            }
            else
            {
                // Create a new GameObject for this behavior
                GameObject behaviorObject = new GameObject(behaviorModel.Id);
                behaviorObject.transform.SetParent(rootObject.transform, false);
                
                // Apply behavior setup
                behaviorModel.ApplyToGameObject(behaviorObject);
                
                // Store reference
                nodeObjects[behaviorModel.Id] = behaviorObject;
            }
        }
        
        /// <summary>
        /// Set adaptation controller for the scene
        /// </summary>
        public void SetAdaptationController(XRAIAdaptationController controller)
        {
            adaptationController = controller;
            
            // Apply adaptation controller to root object
            var controllerComponent = rootObject.AddComponent<XRAIAdaptationControllerBehaviour>();
            controllerComponent.Initialize(controller);
        }
        
        /// <summary>
        /// Set style transfer for the scene
        /// </summary>
        public void SetStyleTransfer(XRAIStyleTransfer styleTransfer)
        {
            this.styleTransfer = styleTransfer;
            
            // Apply style transfer to root object
            var styleComponent = rootObject.AddComponent<XRAIStyleTransferBehaviour>();
            styleComponent.Initialize(styleTransfer);
        }
        
        /// <summary>
        /// Update scene context
        /// </summary>
        public void UpdateContext(XRAIContext context)
        {
            this.context = context;
            
            // Apply adaptation if controller exists
            adaptationController?.Adapt(this, context);
            
            // Update behavior models
            foreach (var model in behaviorModels)
            {
                model.Update(context);
            }
            
            // Update particle systems
            foreach (var ps in particleSystems)
            {
                ps.Update(context);
            }
            
            // Update VFX graphs
            foreach (var vfx in vfxGraphs)
            {
                vfx.Update(context);
            }
        }
        
        /// <summary>
        /// Set quality factor for all components
        /// </summary>
        public void SetQualityFactor(float factor)
        {
            // Apply to all components that support quality adjustment
            foreach (var geometry in geometries)
            {
                geometry.SetQualityFactor(factor);
            }
            
            foreach (var particleSystem in particleSystems)
            {
                particleSystem.SetQualityFactor(factor);
            }
            
            foreach (var vfx in vfxGraphs)
            {
                vfx.SetQualityFactor(factor);
            }
        }
        
        /// <summary>
        /// Trigger a VFX at a position
        /// </summary>
        public void TriggerVFX(string vfxId, Vector3 position)
        {
            var vfx = vfxGraphs.Find(v => v.Id == vfxId);
            
            if (vfx != null)
            {
                vfx.Trigger(position);
            }
            else
            {
                Debug.LogWarning($"VFX with ID {vfxId} not found");
            }
        }
        
        /// <summary>
        /// Clean up resources
        /// </summary>
        public void Dispose()
        {
            // Dispose all components
            foreach (var geometry in geometries)
            {
                geometry.Dispose();
            }
            
            foreach (var material in materials)
            {
                material.Dispose();
            }
            
            foreach (var ps in particleSystems)
            {
                ps.Dispose();
            }
            
            foreach (var vfx in vfxGraphs)
            {
                vfx.Dispose();
            }
            
            foreach (var behavior in behaviorModels)
            {
                behavior.Dispose();
            }
            
            // Destroy root object
            if (rootObject != null)
            {
                GameObject.Destroy(rootObject);
                rootObject = null;
            }
            
            // Clear collections
            geometries.Clear();
            materials.Clear();
            particleSystems.Clear();
            vfxGraphs.Clear();
            behaviorModels.Clear();
            nodeObjects.Clear();
        }
    }
    
    /// <summary>
    /// Metadata for an XRAI scene
    /// </summary>
    [Serializable]
    public class XRAIMetadata
    {
        public string Title { get; set; } = "Untitled XRAI Scene";
        public string Creator { get; set; } = "";
        public string Description { get; set; } = "";
        public string Version { get; set; } = "1.0";
        public DateTime Created { get; set; } = DateTime.Now;
        public DateTime Modified { get; set; } = DateTime.Now;
        public List<string> Tags { get; set; } = new List<string>();
        public Dictionary<string, object> CustomProperties { get; set; } = new Dictionary<string, object>();
    }
    
    /// <summary>
    /// Transform data for XRAI objects
    /// </summary>
    [Serializable]
    public class XRAITransform
    {
        public Vector3 Position { get; set; } = Vector3.zero;
        public Vector3 Rotation { get; set; } = Vector3.zero;
        public Vector3 Scale { get; set; } = Vector3.one;
    }
    
    /// <summary>
    /// Base class for all XRAI geometry types
    /// </summary>
    public abstract class XRAIGeometryBase : IDisposable
    {
        public string Id { get; set; }
        public XRAITransform Transform { get; set; }
        
        public abstract void ApplyToGameObject(GameObject gameObject);
        public abstract void SetQualityFactor(float factor);
        public abstract void Dispose();
    }
    
    /// <summary>
    /// Adaptation controller behavior component
    /// </summary>
    public class XRAIAdaptationControllerBehaviour : MonoBehaviour
    {
        private XRAIAdaptationController controller;
        
        public void Initialize(XRAIAdaptationController controller)
        {
            this.controller = controller;
        }
    }
    
    /// <summary>
    /// Style transfer behavior component
    /// </summary>
    public class XRAIStyleTransferBehaviour : MonoBehaviour
    {
        private XRAIStyleTransfer styleTransfer;
        
        public void Initialize(XRAIStyleTransfer styleTransfer)
        {
            this.styleTransfer = styleTransfer;
        }
    }
}
