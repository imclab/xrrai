using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;

namespace XRAI
{
    /// <summary>
    /// Handles rendering of XRAI scenes in Unity
    /// </summary>
    public class XRAIRenderer : MonoBehaviour
    {
        [Header("Rendering Settings")]
        public bool usePostProcessing = true;
        public bool useNeuralEffects = true;
        public RenderPipelineType renderPipeline = RenderPipelineType.Auto;
        
        [Header("Performance")]
        public bool dynamicResolution = true;
        public float resolutionScale = 1.0f;
        public bool adaptiveFramerate = true;
        public int targetFramerate = 60;
        
        private XRAIScene scene;
        private Camera mainCamera;
        private RenderPipelineType activeRenderPipeline;
        private Dictionary<string, Material> materialCache = new Dictionary<string, Material>();
        private Dictionary<string, Shader> shaderCache = new Dictionary<string, Shader>();
        
        // Post-processing effects
        private XRAINeuralPostProcess neuralPostProcess;
        
        // Performance monitoring
        private float lastAdaptationTime = 0f;
        private const float AdaptationInterval = 1.0f;
        private float currentQualityFactor = 1.0f;
        
        /// <summary>
        /// Supported render pipeline types
        /// </summary>
        public enum RenderPipelineType
        {
            Auto,
            BuiltIn,
            URP,
            HDRP
        }
        
        private void Awake()
        {
            mainCamera = Camera.main;
            if (mainCamera == null)
            {
                Debug.LogWarning("Main camera not found. Please tag a camera as MainCamera.");
                mainCamera = FindObjectOfType<Camera>();
            }
            
            // Detect active render pipeline
            DetectRenderPipeline();
            
            // Initialize post-processing if enabled
            if (usePostProcessing)
            {
                InitializePostProcessing();
            }
        }
        
        /// <summary>
        /// Initialize the renderer with an XRAI scene
        /// </summary>
        public void Initialize(XRAIScene scene)
        {
            this.scene = scene;
            
            // Set initial quality factor
            currentQualityFactor = QualitySettings.GetQualityLevel() / (float)(QualitySettings.names.Length - 1);
            scene.SetQualityFactor(currentQualityFactor);
            
            Debug.Log($"XRAI Renderer initialized with {activeRenderPipeline} pipeline");
            
            // Apply initial settings
            ApplyRenderSettings();
            
            // Start adaptation coroutine if enabled
            if (adaptiveFramerate)
            {
                StartCoroutine(AdaptiveQualityCoroutine());
            }
        }
        
        private void Update()
        {
            if (scene == null) return;
            
            // Check if it's time to adapt quality
            if (adaptiveFramerate && Time.time - lastAdaptationTime > AdaptationInterval)
            {
                AdaptQuality();
                lastAdaptationTime = Time.time;
            }
        }
        
        /// <summary>
        /// Detect the active render pipeline
        /// </summary>
        private void DetectRenderPipeline()
        {
            if (renderPipeline != RenderPipelineType.Auto)
            {
                activeRenderPipeline = renderPipeline;
                return;
            }
            
            // Auto-detect render pipeline
            var currentPipeline = GraphicsSettings.currentRenderPipeline;
            
            if (currentPipeline == null)
            {
                activeRenderPipeline = RenderPipelineType.BuiltIn;
            }
            else if (currentPipeline.GetType().Name.Contains("UniversalRenderPipelineAsset"))
            {
                activeRenderPipeline = RenderPipelineType.URP;
            }
            else if (currentPipeline.GetType().Name.Contains("HDRenderPipelineAsset"))
            {
                activeRenderPipeline = RenderPipelineType.HDRP;
            }
            else
            {
                activeRenderPipeline = RenderPipelineType.BuiltIn;
                Debug.LogWarning("Unknown render pipeline detected, falling back to Built-in pipeline");
            }
        }
        
        /// <summary>
        /// Initialize post-processing effects
        /// </summary>
        private void InitializePostProcessing()
        {
            // Add neural post-processing if enabled
            if (useNeuralEffects)
            {
                neuralPostProcess = gameObject.AddComponent<XRAINeuralPostProcess>();
                neuralPostProcess.Initialize(activeRenderPipeline);
            }
        }
        
        /// <summary>
        /// Apply render settings based on the current configuration
        /// </summary>
        private void ApplyRenderSettings()
        {
            // Apply dynamic resolution if enabled
            if (dynamicResolution)
            {
                #if UNITY_2019_3_OR_NEWER
                DynamicResolutionHandler.SetDynamicResScaler(
                    (float radialDistance) => Mathf.Lerp(0.5f, 1.0f, currentQualityFactor),
                    DynamicResScalePolicyType.ReturnsPercentage);
                #endif
            }
            
            // Set target framerate
            Application.targetFrameRate = targetFramerate;
            
            // Apply pipeline-specific settings
            switch (activeRenderPipeline)
            {
                case RenderPipelineType.URP:
                    ApplyURPSettings();
                    break;
                case RenderPipelineType.HDRP:
                    ApplyHDRPSettings();
                    break;
                case RenderPipelineType.BuiltIn:
                default:
                    ApplyBuiltInSettings();
                    break;
            }
        }
        
        /// <summary>
        /// Apply settings specific to the Built-in render pipeline
        /// </summary>
        private void ApplyBuiltInSettings()
        {
            // Apply quality settings based on current quality factor
            QualitySettings.shadows = currentQualityFactor > 0.5f ? ShadowQuality.All : ShadowQuality.HardOnly;
            QualitySettings.shadowResolution = currentQualityFactor > 0.7f ? ShadowResolution.High : ShadowResolution.Medium;
            QualitySettings.anisotropicFiltering = currentQualityFactor > 0.6f ? AnisotropicFiltering.Enable : AnisotropicFiltering.Disable;
            QualitySettings.antiAliasing = currentQualityFactor > 0.8f ? 4 : (currentQualityFactor > 0.4f ? 2 : 0);
        }
        
        /// <summary>
        /// Apply settings specific to the Universal Render Pipeline
        /// </summary>
        private void ApplyURPSettings()
        {
            // URP-specific settings would be applied here
            // This would typically involve modifying the URP asset settings
            // For this example, we'll just log that URP settings are being applied
            Debug.Log("Applying URP-specific settings");
        }
        
        /// <summary>
        /// Apply settings specific to the High Definition Render Pipeline
        /// </summary>
        private void ApplyHDRPSettings()
        {
            // HDRP-specific settings would be applied here
            // This would typically involve modifying the HDRP asset settings
            // For this example, we'll just log that HDRP settings are being applied
            Debug.Log("Applying HDRP-specific settings");
        }
        
        /// <summary>
        /// Adapt quality settings based on performance
        /// </summary>
        private void AdaptQuality()
        {
            // Get current FPS
            float fps = 1.0f / Time.smoothDeltaTime;
            float targetFps = targetFramerate;
            
            // Calculate quality adjustment
            float performanceRatio = fps / targetFps;
            float qualityAdjustment = 0;
            
            if (performanceRatio < 0.8f)
            {
                // Performance is low, reduce quality
                qualityAdjustment = -0.05f;
            }
            else if (performanceRatio > 1.2f)
            {
                // Performance is good, increase quality
                qualityAdjustment = 0.02f;
            }
            
            // Apply adjustment
            if (qualityAdjustment != 0)
            {
                currentQualityFactor = Mathf.Clamp01(currentQualityFactor + qualityAdjustment);
                scene.SetQualityFactor(currentQualityFactor);
                
                // Re-apply render settings
                ApplyRenderSettings();
                
                if (qualityAdjustment < 0)
                {
                    Debug.Log($"XRAI Renderer: Reducing quality to {currentQualityFactor:F2} (FPS: {fps:F1})");
                }
                else
                {
                    Debug.Log($"XRAI Renderer: Increasing quality to {currentQualityFactor:F2} (FPS: {fps:F1})");
                }
            }
        }
        
        /// <summary>
        /// Coroutine for adaptive quality adjustment
        /// </summary>
        private IEnumerator AdaptiveQualityCoroutine()
        {
            while (true)
            {
                // Wait for adaptation interval
                yield return new WaitForSeconds(AdaptationInterval);
                
                // Adapt quality
                AdaptQuality();
            }
        }
        
        /// <summary>
        /// Get or create a material from the cache
        /// </summary>
        public Material GetMaterial(string materialId)
        {
            if (materialCache.TryGetValue(materialId, out Material material))
            {
                return material;
            }
            
            // Create new material
            material = new Material(Shader.Find("Standard"));
            materialCache[materialId] = material;
            return material;
        }
        
        /// <summary>
        /// Get or create a shader from the cache
        /// </summary>
        public Shader GetShader(string shaderId)
        {
            if (shaderCache.TryGetValue(shaderId, out Shader shader))
            {
                return shader;
            }
            
            // Try to find shader
            shader = Shader.Find(shaderId);
            if (shader == null)
            {
                Debug.LogWarning($"Shader '{shaderId}' not found, falling back to Standard");
                shader = Shader.Find("Standard");
            }
            
            shaderCache[shaderId] = shader;
            return shader;
        }
        
        /// <summary>
        /// Clean up resources when destroyed
        /// </summary>
        private void OnDestroy()
        {
            // Clean up material cache
            foreach (var material in materialCache.Values)
            {
                Destroy(material);
            }
            materialCache.Clear();
        }
    }
    
    /// <summary>
    /// Neural post-processing effect
    /// </summary>
    public class XRAINeuralPostProcess : MonoBehaviour
    {
        private Material postProcessMaterial;
        private XRAIRenderer.RenderPipelineType renderPipeline;
        
        public void Initialize(XRAIRenderer.RenderPipelineType pipeline)
        {
            renderPipeline = pipeline;
            
            // Create post-process material
            postProcessMaterial = new Material(Shader.Find("Hidden/XRAI/NeuralPostProcess"));
            
            // Set up post-processing based on render pipeline
            switch (renderPipeline)
            {
                case XRAIRenderer.RenderPipelineType.URP:
                    SetupURPPostProcessing();
                    break;
                case XRAIRenderer.RenderPipelineType.HDRP:
                    SetupHDRPPostProcessing();
                    break;
                case XRAIRenderer.RenderPipelineType.BuiltIn:
                default:
                    SetupBuiltInPostProcessing();
                    break;
            }
        }
        
        private void SetupBuiltInPostProcessing()
        {
            // For built-in pipeline, we would use OnRenderImage
            // This is just a placeholder implementation
            Debug.Log("Setting up neural post-processing for Built-in pipeline");
        }
        
        private void SetupURPPostProcessing()
        {
            // For URP, we would use a custom render feature
            // This is just a placeholder implementation
            Debug.Log("Setting up neural post-processing for URP");
        }
        
        private void SetupHDRPPostProcessing()
        {
            // For HDRP, we would use a custom post-process pass
            // This is just a placeholder implementation
            Debug.Log("Setting up neural post-processing for HDRP");
        }
        
        // For built-in pipeline
        private void OnRenderImage(RenderTexture source, RenderTexture destination)
        {
            if (renderPipeline != XRAIRenderer.RenderPipelineType.BuiltIn || postProcessMaterial == null)
            {
                Graphics.Blit(source, destination);
                return;
            }
            
            // Apply post-processing effect
            Graphics.Blit(source, destination, postProcessMaterial);
        }
        
        private void OnDestroy()
        {
            if (postProcessMaterial != null)
            {
                Destroy(postProcessMaterial);
            }
        }
    }
}
