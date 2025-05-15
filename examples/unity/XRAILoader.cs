using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using UnityEngine;
using UnityEngine.Networking;
using UnityEngine.Rendering;

namespace XRAI
{
    /// <summary>
    /// Main loader class for XRAI format files in Unity
    /// </summary>
    public class XRAILoader : MonoBehaviour
    {
        [Header("XRAI Asset")]
        public string xraiAssetUrl = "";
        public TextAsset localXraiAsset;
        public bool streamFromUrl = true;
        
        [Header("Quality Settings")]
        public bool useAdaptiveQuality = true;
        public float qualityMultiplier = 1.0f;
        
        [Header("AI Settings")]
        public bool enableAI = true;
        public AIProcessingMode aiProcessingMode = AIProcessingMode.Hybrid;
        
        [Header("Debug")]
        public bool showDebugInfo = false;
        public bool logPerformanceStats = false;
        
        private XRAIScene scene;
        private XRAIRenderer renderer;
        private XRAIAdaptationController adaptationController;
        private XRAIAudioSystem audioSystem;
        private Camera mainCamera;
        private PerformanceMonitor performanceMonitor;
        
        private bool isLoading = false;
        private bool isLoaded = false;
        
        // Performance tracking
        private class PerformanceMonitor
        {
            private const int SampleCount = 60;
            private float[] frameTimes = new float[SampleCount];
            private int currentSample = 0;
            
            public float AverageFrameTime { get; private set; }
            public float AverageFPS { get; private set; }
            
            public void Update(float deltaTime)
            {
                frameTimes[currentSample] = deltaTime;
                currentSample = (currentSample + 1) % SampleCount;
                
                float total = 0f;
                for (int i = 0; i < SampleCount; i++)
                {
                    total += frameTimes[i];
                }
                
                AverageFrameTime = total / SampleCount;
                AverageFPS = 1.0f / Mathf.Max(0.0001f, AverageFrameTime);
            }
        }
        
        private void Awake()
        {
            mainCamera = Camera.main;
            if (mainCamera == null)
            {
                Debug.LogWarning("Main camera not found. Please tag a camera as MainCamera.");
                mainCamera = FindObjectOfType<Camera>();
            }
            
            performanceMonitor = new PerformanceMonitor();
            
            // Initialize XRAI systems
            renderer = gameObject.AddComponent<XRAIRenderer>();
            audioSystem = gameObject.AddComponent<XRAIAudioSystem>();
            
            if (enableAI)
            {
                adaptationController = gameObject.AddComponent<XRAIAdaptationController>();
                adaptationController.ProcessingMode = aiProcessingMode;
            }
        }
        
        private void Start()
        {
            // Load the XRAI scene
            LoadXRAIScene();
        }
        
        private void Update()
        {
            if (!isLoaded) return;
            
            // Update performance monitor
            performanceMonitor.Update(Time.deltaTime);
            
            if (logPerformanceStats && Time.frameCount % 60 == 0)
            {
                Debug.Log($"XRAI Performance: {performanceMonitor.AverageFPS:F1} FPS (Frame time: {performanceMonitor.AverageFrameTime * 1000:F1} ms)");
            }
            
            // Update scene context with current state
            var context = new XRAIContext
            {
                ViewPosition = mainCamera.transform.position,
                ViewDirection = mainCamera.transform.forward,
                TimeOfDay = CalculateTimeOfDay(),
                EnvironmentLighting = RenderSettings.ambientLight,
                PlayerVelocity = GetPlayerVelocity(),
                DevicePerformance = new XRAIPerformanceMetrics
                {
                    FrameRate = performanceMonitor.AverageFPS,
                    MemoryUsage = GetMemoryUsage(),
                    GPUUtilization = EstimateGPUUtilization()
                }
            };
            
            scene.UpdateContext(context);
        }
        
        /// <summary>
        /// Load an XRAI scene from URL or local asset
        /// </summary>
        public async void LoadXRAIScene()
        {
            if (isLoading)
            {
                Debug.LogWarning("Already loading an XRAI scene");
                return;
            }
            
            isLoading = true;
            
            try
            {
                // Create loader with appropriate options
                var loaderOptions = new XRAILoaderOptions
                {
                    AdaptiveQuality = useAdaptiveQuality,
                    QualityMultiplier = qualityMultiplier,
                    EnableAI = enableAI,
                    ProcessingMode = aiProcessingMode,
                    TargetFrameRate = Application.targetFrameRate
                };
                
                var loader = new XRAIDecoder(loaderOptions);
                
                // Load scene from URL or local asset
                if (streamFromUrl && !string.IsNullOrEmpty(xraiAssetUrl))
                {
                    scene = await LoadFromUrlAsync(xraiAssetUrl, loader);
                }
                else if (localXraiAsset != null)
                {
                    scene = await LoadFromBytesAsync(localXraiAsset.bytes, loader);
                }
                else
                {
                    Debug.LogError("No XRAI source specified!");
                    isLoading = false;
                    return;
                }
                
                // Initialize renderer with the loaded scene
                renderer.Initialize(scene);
                
                // Initialize audio system
                audioSystem.Initialize(scene);
                
                // Initialize AI adaptation if enabled
                if (enableAI && adaptationController != null)
                {
                    adaptationController.Initialize(scene);
                }
                
                Debug.Log($"XRAI Scene loaded: {scene.Metadata.Title}");
                isLoaded = true;
                
                // Notify any listeners that the scene is loaded
                OnSceneLoaded?.Invoke(scene);
            }
            catch (Exception e)
            {
                Debug.LogError($"Failed to load XRAI scene: {e.Message}");
                Debug.LogException(e);
            }
            finally
            {
                isLoading = false;
            }
        }
        
        /// <summary>
        /// Load an XRAI scene from a URL
        /// </summary>
        private async Task<XRAIScene> LoadFromUrlAsync(string url, XRAIDecoder decoder)
        {
            using (UnityWebRequest webRequest = UnityWebRequest.Get(url))
            {
                // Send request and wait for response
                var operation = webRequest.SendWebRequest();
                
                while (!operation.isDone)
                {
                    await Task.Yield();
                }
                
                if (webRequest.result != UnityWebRequest.Result.Success)
                {
                    throw new Exception($"Failed to download XRAI file: {webRequest.error}");
                }
                
                byte[] data = webRequest.downloadHandler.data;
                return await decoder.DecodeAsync(data);
            }
        }
        
        /// <summary>
        /// Load an XRAI scene from bytes
        /// </summary>
        private async Task<XRAIScene> LoadFromBytesAsync(byte[] data, XRAIDecoder decoder)
        {
            return await decoder.DecodeAsync(data);
        }
        
        /// <summary>
        /// Trigger a VFX at a position in the scene
        /// </summary>
        public void TriggerVFX(string vfxId, Vector3 position)
        {
            if (!isLoaded) return;
            scene.TriggerVFX(vfxId, position);
        }
        
        /// <summary>
        /// Set the quality factor for the scene (0-1)
        /// </summary>
        public void SetQualityFactor(float factor)
        {
            if (!isLoaded) return;
            scene.SetQualityFactor(Mathf.Clamp01(factor));
        }
        
        // Helper methods for context updates
        private float CalculateTimeOfDay()
        {
            // Map real time or game time to 0-1 range for day cycle
            // This is just an example - you might want to use your own time system
            return (Time.time % 300f) / 300f; // 5-minute day cycle
        }
        
        private Vector3 GetPlayerVelocity()
        {
            // In a real implementation, you would get this from your character controller
            // This is just a placeholder
            return Vector3.zero;
        }
        
        private float GetMemoryUsage()
        {
            // Return memory usage in MB
            return (float)GC.GetTotalMemory(false) / (1024f * 1024f);
        }
        
        private float EstimateGPUUtilization()
        {
            // Unity doesn't provide direct GPU utilization metrics
            // This is a very rough estimate based on frame time
            float targetFrameTime = 1.0f / Application.targetFrameRate;
            float currentFrameTime = performanceMonitor.AverageFrameTime;
            return Mathf.Clamp01(currentFrameTime / targetFrameTime);
        }
        
        private void OnDestroy()
        {
            // Clean up resources
            scene?.Dispose();
        }
        
        // Event for notifying when scene is loaded
        public delegate void SceneLoadedHandler(XRAIScene scene);
        public event SceneLoadedHandler OnSceneLoaded;
    }
    
    /// <summary>
    /// AI processing mode options
    /// </summary>
    public enum AIProcessingMode
    {
        OnDevice,
        Cloud,
        Hybrid
    }
    
    /// <summary>
    /// Options for the XRAI loader
    /// </summary>
    [Serializable]
    public class XRAILoaderOptions
    {
        public bool AdaptiveQuality { get; set; } = true;
        public float QualityMultiplier { get; set; } = 1.0f;
        public bool EnableAI { get; set; } = true;
        public AIProcessingMode ProcessingMode { get; set; } = AIProcessingMode.Hybrid;
        public int TargetFrameRate { get; set; } = 60;
    }
    
    /// <summary>
    /// Context information for scene updates
    /// </summary>
    [Serializable]
    public class XRAIContext
    {
        public Vector3 ViewPosition { get; set; }
        public Vector3 ViewDirection { get; set; }
        public float TimeOfDay { get; set; } // 0-1 range for full day cycle
        public Color EnvironmentLighting { get; set; }
        public Vector3 PlayerVelocity { get; set; }
        public XRAIPerformanceMetrics DevicePerformance { get; set; }
    }
    
    /// <summary>
    /// Performance metrics for device adaptation
    /// </summary>
    [Serializable]
    public class XRAIPerformanceMetrics
    {
        public float FrameRate { get; set; }
        public float MemoryUsage { get; set; } // In MB
        public float GPUUtilization { get; set; } // 0-1 range
    }
}
