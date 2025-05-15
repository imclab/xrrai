using System.Collections;
using System.Collections.Generic;
using UnityEngine;

/// <summary>
/// Controller for AI components loaded from XRAI files
/// </summary>
public class XRAIAIController : MonoBehaviour
{
    [Header("Debug")]
    [SerializeField] private bool showDebugVisuals = true;
    [SerializeField] private bool logRuleEvaluations = false;
    
    // AI data
    private Dictionary<string, object> aiData;
    private List<AdaptationRule> adaptationRules = new List<AdaptationRule>();
    private List<BehaviorModel> behaviorModels = new List<BehaviorModel>();
    
    // Runtime context
    private Dictionary<string, object> runtimeContext = new Dictionary<string, object>();
    
    // Debug visuals
    private GameObject debugVisual;
    
    // Start is called before the first frame update
    void Start()
    {
        // Initialize runtime context
        UpdateRuntimeContext();
        
        // Create debug visuals if enabled
        if (showDebugVisuals)
        {
            CreateDebugVisuals();
        }
    }
    
    // Update is called once per frame
    void Update()
    {
        // Update runtime context
        UpdateRuntimeContext();
        
        // Evaluate adaptation rules
        EvaluateAdaptationRules();
        
        // Update behavior models
        UpdateBehaviorModels();
        
        // Update debug visuals
        if (showDebugVisuals && debugVisual != null)
        {
            UpdateDebugVisuals();
        }
    }
    
    /// <summary>
    /// Set AI data from XRAI file
    /// </summary>
    /// <param name="data">AI component data</param>
    public void SetAIData(Dictionary<string, object> data)
    {
        aiData = data;
        
        // Process adaptation rules
        if (data.TryGetValue("adaptationRules", out object rulesObj) && rulesObj is List<object> rulesList)
        {
            foreach (object ruleObj in rulesList)
            {
                if (ruleObj is Dictionary<string, object> ruleDict)
                {
                    AdaptationRule rule = new AdaptationRule();
                    
                    // Get rule ID
                    if (ruleDict.TryGetValue("id", out object idObj) && idObj is string id)
                    {
                        rule.id = id;
                    }
                    
                    // Get rule condition
                    if (ruleDict.TryGetValue("condition", out object conditionObj) && conditionObj is string condition)
                    {
                        rule.condition = condition;
                    }
                    
                    // Get rule action
                    if (ruleDict.TryGetValue("action", out object actionObj) && actionObj is string action)
                    {
                        rule.action = action;
                    }
                    
                    // Get rule priority
                    if (ruleDict.TryGetValue("priority", out object priorityObj) && priorityObj is long priority)
                    {
                        rule.priority = (int)priority;
                    }
                    
                    adaptationRules.Add(rule);
                    Debug.Log($"Added adaptation rule: {rule.id}");
                }
            }
        }
        
        // Process behavior models
        if (data.TryGetValue("behaviorModels", out object modelsObj) && modelsObj is List<object> modelsList)
        {
            foreach (object modelObj in modelsList)
            {
                if (modelObj is Dictionary<string, object> modelDict)
                {
                    BehaviorModel model = new BehaviorModel();
                    
                    // Get model ID
                    if (modelDict.TryGetValue("id", out object idObj) && idObj is string id)
                    {
                        model.id = id;
                    }
                    
                    // Get model type
                    if (modelDict.TryGetValue("type", out object typeObj) && typeObj is string type)
                    {
                        model.type = type;
                    }
                    
                    // Get model inputs
                    if (modelDict.TryGetValue("inputs", out object inputsObj) && inputsObj is List<object> inputsList)
                    {
                        model.inputs = new List<string>();
                        foreach (object inputObj in inputsList)
                        {
                            if (inputObj is string input)
                            {
                                model.inputs.Add(input);
                            }
                        }
                    }
                    
                    // Get model outputs
                    if (modelDict.TryGetValue("outputs", out object outputsObj) && outputsObj is List<object> outputsList)
                    {
                        model.outputs = new List<string>();
                        foreach (object outputObj in outputsList)
                        {
                            if (outputObj is string output)
                            {
                                model.outputs.Add(output);
                            }
                        }
                    }
                    
                    // Get model parameters
                    if (modelDict.TryGetValue("parameters", out object parametersObj) && parametersObj is Dictionary<string, object> parametersDict)
                    {
                        model.parameters = parametersDict;
                    }
                    
                    behaviorModels.Add(model);
                    Debug.Log($"Added behavior model: {model.id}");
                }
            }
        }
    }
    
    /// <summary>
    /// Update runtime context for AI components
    /// </summary>
    private void UpdateRuntimeContext()
    {
        // Add time information
        runtimeContext["time"] = Time.time;
        runtimeContext["deltaTime"] = Time.deltaTime;
        
        // Add camera information
        Camera mainCamera = Camera.main;
        if (mainCamera != null)
        {
            Dictionary<string, object> cameraInfo = new Dictionary<string, object>();
            cameraInfo["position"] = mainCamera.transform.position;
            cameraInfo["rotation"] = mainCamera.transform.rotation.eulerAngles;
            cameraInfo["fieldOfView"] = mainCamera.fieldOfView;
            
            runtimeContext["camera"] = cameraInfo;
        }
        
        // Add scene information
        runtimeContext["sceneObjects"] = GameObject.FindObjectsOfType<Transform>().Length;
        
        // Add device information
        Dictionary<string, object> deviceInfo = new Dictionary<string, object>();
        deviceInfo["platform"] = Application.platform.ToString();
        deviceInfo["deviceModel"] = SystemInfo.deviceModel;
        deviceInfo["deviceName"] = SystemInfo.deviceName;
        deviceInfo["processorCount"] = SystemInfo.processorCount;
        deviceInfo["systemMemorySize"] = SystemInfo.systemMemorySize;
        deviceInfo["graphicsDeviceName"] = SystemInfo.graphicsDeviceName;
        deviceInfo["graphicsMemorySize"] = SystemInfo.graphicsMemorySize;
        
        runtimeContext["device"] = deviceInfo;
        
        // Add performance information
        Dictionary<string, object> performanceInfo = new Dictionary<string, object>();
        performanceInfo["fps"] = 1.0f / Time.smoothDeltaTime;
        performanceInfo["frameCount"] = Time.frameCount;
        
        runtimeContext["performance"] = performanceInfo;
        
        // Add input information
        Dictionary<string, object> inputInfo = new Dictionary<string, object>();
        inputInfo["mousePosition"] = Input.mousePosition;
        inputInfo["mousePresent"] = Input.mousePresent;
        inputInfo["touchCount"] = Input.touchCount;
        
        runtimeContext["input"] = inputInfo;
    }
    
    /// <summary>
    /// Evaluate adaptation rules
    /// </summary>
    private void EvaluateAdaptationRules()
    {
        // Sort rules by priority
        adaptationRules.Sort((a, b) => b.priority.CompareTo(a.priority));
        
        // Evaluate each rule
        foreach (AdaptationRule rule in adaptationRules)
        {
            try
            {
                // Skip rules with empty conditions or actions
                if (string.IsNullOrEmpty(rule.condition) || string.IsNullOrEmpty(rule.action))
                {
                    continue;
                }
                
                // Evaluate condition using runtime context
                bool conditionMet = EvaluateCondition(rule.condition);
                
                if (logRuleEvaluations)
                {
                    Debug.Log($"Rule {rule.id}: condition '{rule.condition}' evaluated to {conditionMet}");
                }
                
                // Execute action if condition is met
                if (conditionMet)
                {
                    ExecuteAction(rule.action);
                    
                    if (logRuleEvaluations)
                    {
                        Debug.Log($"Rule {rule.id}: executed action '{rule.action}'");
                    }
                }
            }
            catch (System.Exception ex)
            {
                Debug.LogError($"Error evaluating rule {rule.id}: {ex.Message}");
            }
        }
    }
    
    /// <summary>
    /// Evaluate a condition string
    /// </summary>
    /// <param name="condition">Condition to evaluate</param>
    /// <returns>True if condition is met</returns>
    private bool EvaluateCondition(string condition)
    {
        // Simple condition evaluation for demo
        // In a real implementation, this would use a proper expression evaluator
        
        // Time-based conditions
        if (condition.Contains("time >") || condition.Contains("time>"))
        {
            float timeValue = ExtractFloatValue(condition);
            return Time.time > timeValue;
        }
        
        if (condition.Contains("time <") || condition.Contains("time<"))
        {
            float timeValue = ExtractFloatValue(condition);
            return Time.time < timeValue;
        }
        
        // FPS-based conditions
        if (condition.Contains("fps >") || condition.Contains("fps>"))
        {
            float fpsValue = ExtractFloatValue(condition);
            float currentFps = 1.0f / Time.smoothDeltaTime;
            return currentFps > fpsValue;
        }
        
        if (condition.Contains("fps <") || condition.Contains("fps<"))
        {
            float fpsValue = ExtractFloatValue(condition);
            float currentFps = 1.0f / Time.smoothDeltaTime;
            return currentFps < fpsValue;
        }
        
        // Camera distance conditions
        if (condition.Contains("camera.distance >") || condition.Contains("camera.distance>"))
        {
            float distanceValue = ExtractFloatValue(condition);
            float currentDistance = Vector3.Distance(Camera.main.transform.position, transform.position);
            return currentDistance > distanceValue;
        }
        
        if (condition.Contains("camera.distance <") || condition.Contains("camera.distance<"))
        {
            float distanceValue = ExtractFloatValue(condition);
            float currentDistance = Vector3.Distance(Camera.main.transform.position, transform.position);
            return currentDistance < distanceValue;
        }
        
        // Default to false for unknown conditions
        return false;
    }
    
    /// <summary>
    /// Execute an action string
    /// </summary>
    /// <param name="action">Action to execute</param>
    private void ExecuteAction(string action)
    {
        // Simple action execution for demo
        // In a real implementation, this would use a proper command executor
        
        // Quality adjustment actions
        if (action.StartsWith("adjustQuality("))
        {
            float qualityValue = ExtractFloatValue(action);
            int qualityLevel = Mathf.RoundToInt(qualityValue * 5); // Scale 0-1 to 0-5
            QualitySettings.SetQualityLevel(Mathf.Clamp(qualityLevel, 0, 5), true);
        }
        
        // LOD adjustment actions
        if (action.StartsWith("setLOD("))
        {
            int lodLevel = Mathf.RoundToInt(ExtractFloatValue(action));
            
            // Find all LOD groups in the scene
            LODGroup[] lodGroups = FindObjectsOfType<LODGroup>();
            foreach (LODGroup lodGroup in lodGroups)
            {
                lodGroup.ForceLOD(lodLevel);
            }
        }
        
        // Visibility actions
        if (action.StartsWith("setVisible("))
        {
            string[] parameters = ExtractParameters(action);
            if (parameters.Length >= 2)
            {
                string objectName = parameters[0].Trim();
                bool visible = bool.Parse(parameters[1].Trim());
                
                // Find object by name
                GameObject targetObject = GameObject.Find(objectName);
                if (targetObject != null)
                {
                    Renderer[] renderers = targetObject.GetComponentsInChildren<Renderer>();
                    foreach (Renderer renderer in renderers)
                    {
                        renderer.enabled = visible;
                    }
                }
            }
        }
        
        // Debug actions
        if (action.StartsWith("debug("))
        {
            string message = action.Substring(6, action.Length - 7);
            Debug.Log($"AI Debug: {message}");
        }
    }
    
    /// <summary>
    /// Update behavior models
    /// </summary>
    private void UpdateBehaviorModels()
    {
        foreach (BehaviorModel model in behaviorModels)
        {
            try
            {
                // Skip models with no inputs or outputs
                if (model.inputs == null || model.outputs == null || model.inputs.Count == 0 || model.outputs.Count == 0)
                {
                    continue;
                }
                
                // Execute model based on type
                switch (model.type.ToLower())
                {
                    case "regression":
                        ExecuteRegressionModel(model);
                        break;
                    case "classification":
                        ExecuteClassificationModel(model);
                        break;
                    case "state":
                        ExecuteStateModel(model);
                        break;
                    default:
                        // Unknown model type
                        break;
                }
            }
            catch (System.Exception ex)
            {
                Debug.LogError($"Error updating behavior model {model.id}: {ex.Message}");
            }
        }
    }
    
    /// <summary>
    /// Execute a regression model
    /// </summary>
    /// <param name="model">Behavior model</param>
    private void ExecuteRegressionModel(BehaviorModel model)
    {
        // Simple regression model for demo
        // In a real implementation, this would use a proper ML model
        
        // Get input values
        List<float> inputValues = new List<float>();
        foreach (string input in model.inputs)
        {
            float value = GetInputValue(input);
            inputValues.Add(value);
        }
        
        // Compute output values (simple weighted sum for demo)
        for (int i = 0; i < model.outputs.Count; i++)
        {
            float outputValue = 0;
            
            for (int j = 0; j < inputValues.Count; j++)
            {
                // Use default weight of 0.1 if not specified
                float weight = 0.1f;
                
                // Try to get weight from parameters
                string weightKey = $"weight_{j}_{i}";
                if (model.parameters != null && model.parameters.TryGetValue(weightKey, out object weightObj))
                {
                    if (weightObj is double weightDouble)
                    {
                        weight = (float)weightDouble;
                    }
                }
                
                outputValue += inputValues[j] * weight;
            }
            
            // Add bias if specified
            string biasKey = $"bias_{i}";
            if (model.parameters != null && model.parameters.TryGetValue(biasKey, out object biasObj))
            {
                if (biasObj is double biasDouble)
                {
                    outputValue += (float)biasDouble;
                }
            }
            
            // Apply activation function if specified
            string activationKey = $"activation_{i}";
            if (model.parameters != null && model.parameters.TryGetValue(activationKey, out object activationObj))
            {
                if (activationObj is string activation)
                {
                    outputValue = ApplyActivation(outputValue, activation);
                }
            }
            
            // Set output value
            SetOutputValue(model.outputs[i], outputValue);
        }
    }
    
    /// <summary>
    /// Execute a classification model
    /// </summary>
    /// <param name="model">Behavior model</param>
    private void ExecuteClassificationModel(BehaviorModel model)
    {
        // Simple classification model for demo
        // In a real implementation, this would use a proper ML model
        
        // Get input values
        List<float> inputValues = new List<float>();
        foreach (string input in model.inputs)
        {
            float value = GetInputValue(input);
            inputValues.Add(value);
        }
        
        // Compute output values (simple threshold for demo)
        for (int i = 0; i < model.outputs.Count; i++)
        {
            float outputValue = 0;
            
            for (int j = 0; j < inputValues.Count; j++)
            {
                // Use default weight of 0.1 if not specified
                float weight = 0.1f;
                
                // Try to get weight from parameters
                string weightKey = $"weight_{j}_{i}";
                if (model.parameters != null && model.parameters.TryGetValue(weightKey, out object weightObj))
                {
                    if (weightObj is double weightDouble)
                    {
                        weight = (float)weightDouble;
                    }
                }
                
                outputValue += inputValues[j] * weight;
            }
            
            // Apply threshold
            float threshold = 0.5f;
            string thresholdKey = $"threshold_{i}";
            if (model.parameters != null && model.parameters.TryGetValue(thresholdKey, out object thresholdObj))
            {
                if (thresholdObj is double thresholdDouble)
                {
                    threshold = (float)thresholdDouble;
                }
            }
            
            // Set output value (0 or 1 based on threshold)
            SetOutputValue(model.outputs[i], outputValue > threshold ? 1 : 0);
        }
    }
    
    /// <summary>
    /// Execute a state model
    /// </summary>
    /// <param name="model">Behavior model</param>
    private void ExecuteStateModel(BehaviorModel model)
    {
        // Simple state model for demo
        // In a real implementation, this would use a proper state machine
        
        // Get current state
        string currentState = "default";
        if (model.parameters != null && model.parameters.TryGetValue("currentState", out object stateObj))
        {
            if (stateObj is string state)
            {
                currentState = state;
            }
        }
        
        // Check transitions
        string nextState = currentState;
        
        if (model.parameters != null)
        {
            foreach (KeyValuePair<string, object> kvp in model.parameters)
            {
                if (kvp.Key.StartsWith("transition_") && kvp.Key.EndsWith($"_{currentState}"))
                {
                    if (kvp.Value is Dictionary<string, object> transitionDict)
                    {
                        // Get condition
                        if (transitionDict.TryGetValue("condition", out object conditionObj) && conditionObj is string condition)
                        {
                            // Evaluate condition
                            bool conditionMet = EvaluateCondition(condition);
                            
                            if (conditionMet)
                            {
                                // Get target state
                                if (transitionDict.TryGetValue("target", out object targetObj) && targetObj is string target)
                                {
                                    nextState = target;
                                    break;
                                }
                            }
                        }
                    }
                }
            }
        }
        
        // Update current state
        if (nextState != currentState)
        {
            if (model.parameters != null)
            {
                model.parameters["currentState"] = nextState;
                
                // Execute state entry action
                string entryActionKey = $"action_{nextState}";
                if (model.parameters.TryGetValue(entryActionKey, out object actionObj) && actionObj is string action)
                {
                    ExecuteAction(action);
                }
            }
        }
        
        // Set output values based on current state
        for (int i = 0; i < model.outputs.Count; i++)
        {
            string outputValueKey = $"value_{nextState}_{i}";
            float outputValue = 0;
            
            if (model.parameters != null && model.parameters.TryGetValue(outputValueKey, out object valueObj))
            {
                if (valueObj is double valueDouble)
                {
                    outputValue = (float)valueDouble;
                }
            }
            
            SetOutputValue(model.outputs[i], outputValue);
        }
    }
    
    /// <summary>
    /// Get input value for behavior model
    /// </summary>
    /// <param name="input">Input name</param>
    /// <returns>Input value</returns>
    private float GetInputValue(string input)
    {
        // Handle special inputs
        switch (input.ToLower())
        {
            case "time":
                return Time.time;
            case "deltatime":
                return Time.deltaTime;
            case "fps":
                return 1.0f / Time.smoothDeltaTime;
            case "camera.distance":
                return Vector3.Distance(Camera.main.transform.position, transform.position);
            case "random":
                return Random.value;
            default:
                // Try to get value from runtime context
                if (runtimeContext.TryGetValue(input, out object value))
                {
                    if (value is float floatValue)
                    {
                        return floatValue;
                    }
                    else if (value is int intValue)
                    {
                        return intValue;
                    }
                    else if (value is double doubleValue)
                    {
                        return (float)doubleValue;
                    }
                }
                
                // Default to 0
                return 0;
        }
    }
    
    /// <summary>
    /// Set output value for behavior model
    /// </summary>
    /// <param name="output">Output name</param>
    /// <param name="value">Output value</param>
    private void SetOutputValue(string output, float value)
    {
        // Add to runtime context
        runtimeContext[output] = value;
        
        // Handle special outputs
        switch (output.ToLower())
        {
            case "debug.sphere.scale":
                if (debugVisual != null)
                {
                    debugVisual.transform.localScale = Vector3.one * Mathf.Max(0.1f, value);
                }
                break;
            case "debug.sphere.color.r":
                if (debugVisual != null)
                {
                    Renderer renderer = debugVisual.GetComponent<Renderer>();
                    if (renderer != null)
                    {
                        Color color = renderer.material.color;
                        color.r = Mathf.Clamp01(value);
                        renderer.material.color = color;
                    }
                }
                break;
            case "debug.sphere.color.g":
                if (debugVisual != null)
                {
                    Renderer renderer = debugVisual.GetComponent<Renderer>();
                    if (renderer != null)
                    {
                        Color color = renderer.material.color;
                        color.g = Mathf.Clamp01(value);
                        renderer.material.color = color;
                    }
                }
                break;
            case "debug.sphere.color.b":
                if (debugVisual != null)
                {
                    Renderer renderer = debugVisual.GetComponent<Renderer>();
                    if (renderer != null)
                    {
                        Color color = renderer.material.color;
                        color.b = Mathf.Clamp01(value);
                        renderer.material.color = color;
                    }
                }
                break;
            case "quality":
                int qualityLevel = Mathf.RoundToInt(value * 5); // Scale 0-1 to 0-5
                QualitySettings.SetQualityLevel(Mathf.Clamp(qualityLevel, 0, 5), true);
                break;
            default:
                // Unknown output
                break;
        }
    }
    
    /// <summary>
    /// Apply activation function to value
    /// </summary>
    /// <param name="value">Input value</param>
    /// <param name="activation">Activation function name</param>
    /// <returns>Activated value</returns>
    private float ApplyActivation(float value, string activation)
    {
        switch (activation.ToLower())
        {
            case "sigmoid":
                return 1.0f / (1.0f + Mathf.Exp(-value));
            case "tanh":
                return Mathf.Tanh(value);
            case "relu":
                return Mathf.Max(0, value);
            case "leakyrelu":
                return value > 0 ? value : 0.01f * value;
            case "step":
                return value > 0 ? 1 : 0;
            default:
                return value;
        }
    }
    
    /// <summary>
    /// Extract float value from string
    /// </summary>
    /// <param name="text">Text to extract from</param>
    /// <returns>Extracted float value</returns>
    private float ExtractFloatValue(string text)
    {
        try
        {
            int startIndex = text.IndexOf('(');
            if (startIndex >= 0)
            {
                int endIndex = text.IndexOf(')', startIndex);
                if (endIndex >= 0)
                {
                    string valueStr = text.Substring(startIndex + 1, endIndex - startIndex - 1);
                    return float.Parse(valueStr);
                }
            }
            
            // Try to find a number in the string
            string[] parts = text.Split(new char[] { ' ', '<', '>', '=' });
            foreach (string part in parts)
            {
                if (float.TryParse(part, out float value))
                {
                    return value;
                }
            }
        }
        catch
        {
            // Ignore parsing errors
        }
        
        return 0;
    }
    
    /// <summary>
    /// Extract parameters from function call
    /// </summary>
    /// <param name="text">Function call text</param>
    /// <returns>Array of parameters</returns>
    private string[] ExtractParameters(string text)
    {
        try
        {
            int startIndex = text.IndexOf('(');
            if (startIndex >= 0)
            {
                int endIndex = text.IndexOf(')', startIndex);
                if (endIndex >= 0)
                {
                    string paramsStr = text.Substring(startIndex + 1, endIndex - startIndex - 1);
                    return paramsStr.Split(',');
                }
            }
        }
        catch
        {
            // Ignore parsing errors
        }
        
        return new string[0];
    }
    
    /// <summary>
    /// Create debug visuals
    /// </summary>
    private void CreateDebugVisuals()
    {
        // Create a sphere to visualize AI state
        debugVisual = GameObject.CreatePrimitive(PrimitiveType.Sphere);
        debugVisual.name = "AI Debug Visual";
        debugVisual.transform.SetParent(transform);
        debugVisual.transform.localPosition = Vector3.up * 2;
        debugVisual.transform.localScale = Vector3.one * 0.5f;
        
        // Create material
        Material material = new Material(Shader.Find("Standard"));
        material.color = Color.green;
        material.EnableKeyword("_EMISSION");
        material.SetColor("_EmissionColor", Color.green * 0.5f);
        
        // Apply material
        Renderer renderer = debugVisual.GetComponent<Renderer>();
        renderer.material = material;
    }
    
    /// <summary>
    /// Update debug visuals
    /// </summary>
    private void UpdateDebugVisuals()
    {
        // Pulse effect
        float pulse = Mathf.Sin(Time.time * 2) * 0.2f + 0.8f;
        debugVisual.transform.localScale = Vector3.one * 0.5f * pulse;
        
        // Update color based on active rules
        Renderer renderer = debugVisual.GetComponent<Renderer>();
        
        // Count active rules
        int activeRules = 0;
        foreach (AdaptationRule rule in adaptationRules)
        {
            if (!string.IsNullOrEmpty(rule.condition) && EvaluateCondition(rule.condition))
            {
                activeRules++;
            }
        }
        
        // Change color based on active rules
        if (activeRules > 0)
        {
            renderer.material.color = Color.Lerp(Color.green, Color.red, Mathf.Min(1, activeRules / 3.0f));
            renderer.material.SetColor("_EmissionColor", renderer.material.color * 0.5f);
        }
        else
        {
            renderer.material.color = Color.green;
            renderer.material.SetColor("_EmissionColor", Color.green * 0.5f);
        }
    }
    
    /// <summary>
    /// Adaptation rule class
    /// </summary>
    [System.Serializable]
    public class AdaptationRule
    {
        public string id = "rule";
        public string condition = "";
        public string action = "";
        public int priority = 0;
    }
    
    /// <summary>
    /// Behavior model class
    /// </summary>
    [System.Serializable]
    public class BehaviorModel
    {
        public string id = "model";
        public string type = "regression";
        public List<string> inputs = new List<string>();
        public List<string> outputs = new List<string>();
        public Dictionary<string, object> parameters;
    }
}
