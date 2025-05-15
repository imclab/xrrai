/**
 * XRAI Adaptation Controller Implementation
 * Demonstrates how AI-driven adaptation works in the XRAI format
 */

class XRAIAdaptationController {
  /**
   * Create a new adaptation controller
   * @param {Object} rules - The adaptation rules from the XRAI container
   */
  constructor(rules) {
    this.rules = rules || [];
    this.parameters = {};
    this.targets = {};
    this.history = {};
    this.lastUpdateTime = performance.now();
    
    // State machines
    this.stateMachines = {};
    
    // Learning parameters
    this.learningEnabled = true;
    this.learningRate = 0.01;
    this.userPreferences = {};
    
    // Initialize rules
    this._initializeRules();
  }
  
  /**
   * Initialize adaptation rules
   * @private
   */
  _initializeRules() {
    console.log(`Initializing ${this.rules.length} adaptation rules`);
    
    // Process each rule
    for (const rule of this.rules) {
      switch (rule.type) {
        case 'continuous':
          this._initializeContinuousRule(rule);
          break;
        case 'discrete':
          this._initializeDiscreteRule(rule);
          break;
        case 'state_machine':
          this._initializeStateMachineRule(rule);
          break;
        case 'neural':
          this._initializeNeuralRule(rule);
          break;
        default:
          console.warn(`Unknown rule type: ${rule.type}`);
      }
    }
  }
  
  /**
   * Initialize a continuous adaptation rule
   * @private
   * @param {Object} rule - The rule to initialize
   */
  _initializeContinuousRule(rule) {
    console.log(`Initializing continuous rule: ${rule.id}`);
    
    // Initialize parameter tracking
    this.parameters[rule.parameter] = null;
    
    // Initialize history for this parameter
    this.history[rule.parameter] = {
      values: [],
      timestamps: [],
      maxEntries: 100
    };
    
    // Initialize targets
    for (const target of rule.targets) {
      this.targets[target.id] = null;
    }
  }
  
  /**
   * Initialize a discrete adaptation rule
   * @private
   * @param {Object} rule - The rule to initialize
   */
  _initializeDiscreteRule(rule) {
    console.log(`Initializing discrete rule: ${rule.id}`);
    
    // Initialize parameter tracking
    this.parameters[rule.parameter] = null;
    
    // Initialize targets
    for (const target of rule.targets) {
      this.targets[target.id] = null;
    }
  }
  
  /**
   * Initialize a state machine rule
   * @private
   * @param {Object} rule - The rule to initialize
   */
  _initializeStateMachineRule(rule) {
    console.log(`Initializing state machine rule: ${rule.id}`);
    
    // Create state machine
    const stateMachine = {
      id: rule.id,
      currentState: rule.initialState || rule.states[0].id,
      states: {},
      lastTransitionTime: performance.now(),
      nextTransitionTime: null
    };
    
    // Initialize states
    for (const state of rule.states) {
      stateMachine.states[state.id] = {
        settings: state.settings || {},
        transitions: state.transitions || [],
        minDuration: state.duration?.min || 0,
        maxDuration: state.duration?.max || 0
      };
    }
    
    // Schedule initial transition
    this._scheduleNextTransition(stateMachine);
    
    // Store state machine
    this.stateMachines[rule.id] = stateMachine;
  }
  
  /**
   * Initialize a neural adaptation rule
   * @private
   * @param {Object} rule - The rule to initialize
   */
  _initializeNeuralRule(rule) {
    console.log(`Initializing neural rule: ${rule.id}`);
    
    // In a real implementation, this would initialize a neural network
    // For this example, we'll just track the inputs and outputs
    
    // Initialize inputs
    for (const input of rule.inputs) {
      this.parameters[input.source] = null;
    }
    
    // Initialize outputs
    for (const output of rule.outputs) {
      this.targets[output.target] = null;
    }
    
    // Initialize learning parameters if present
    if (rule.learning) {
      this.learningRate = rule.learning.rate || 0.01;
      this.learningEnabled = rule.learning.enabled !== false;
    }
  }
  
  /**
   * Schedule the next state transition for a state machine
   * @private
   * @param {Object} stateMachine - The state machine
   */
  _scheduleNextTransition(stateMachine) {
    const currentState = stateMachine.states[stateMachine.currentState];
    
    if (!currentState) {
      console.error(`Invalid state: ${stateMachine.currentState}`);
      return;
    }
    
    // Calculate duration for this state
    const duration = currentState.minDuration + 
      Math.random() * (currentState.maxDuration - currentState.minDuration);
    
    // Set next transition time
    stateMachine.nextTransitionTime = stateMachine.lastTransitionTime + duration * 1000;
    
    console.log(`Scheduled next transition for ${stateMachine.id} in ${duration.toFixed(1)}s`);
  }
  
  /**
   * Update a state machine
   * @private
   * @param {Object} stateMachine - The state machine to update
   * @param {number} currentTime - The current time
   * @returns {Object} - The applied settings if state changed, null otherwise
   */
  _updateStateMachine(stateMachine, currentTime) {
    // Check if it's time for a transition
    if (stateMachine.nextTransitionTime && currentTime >= stateMachine.nextTransitionTime) {
      // Get current state
      const currentState = stateMachine.states[stateMachine.currentState];
      
      if (!currentState) {
        console.error(`Invalid state: ${stateMachine.currentState}`);
        return null;
      }
      
      // Select next state based on transitions
      let nextState = null;
      
      if (currentState.transitions.length > 0) {
        // Calculate total probability
        let totalProb = 0;
        for (const transition of currentState.transitions) {
          totalProb += transition.probability || 1;
        }
        
        // Select transition based on probability
        const rand = Math.random() * totalProb;
        let cumulativeProb = 0;
        
        for (const transition of currentState.transitions) {
          cumulativeProb += transition.probability || 1;
          if (rand <= cumulativeProb) {
            nextState = transition.target;
            break;
          }
        }
      }
      
      // If no transition selected, stay in current state
      if (!nextState) {
        // Reschedule next transition
        stateMachine.lastTransitionTime = currentTime;
        this._scheduleNextTransition(stateMachine);
        return null;
      }
      
      // Transition to next state
      console.log(`State machine ${stateMachine.id} transitioning from ${stateMachine.currentState} to ${nextState}`);
      stateMachine.currentState = nextState;
      stateMachine.lastTransitionTime = currentTime;
      
      // Schedule next transition
      this._scheduleNextTransition(stateMachine);
      
      // Return the settings for the new state
      return stateMachine.states[nextState].settings;
    }
    
    return null;
  }
  
  /**
   * Evaluate a continuous rule
   * @private
   * @param {Object} rule - The rule to evaluate
   * @param {Object} context - The scene context
   * @returns {Object} - The target values
   */
  _evaluateContinuousRule(rule, context) {
    // Get parameter value from context
    const paramPath = rule.parameter.split('.');
    let paramValue = context;
    
    for (const part of paramPath) {
      if (paramValue === undefined || paramValue === null) break;
      paramValue = paramValue[part];
    }
    
    if (paramValue === undefined || paramValue === null) {
      return null;
    }
    
    // Update parameter history
    this._updateParameterHistory(rule.parameter, paramValue);
    
    // Store current parameter value
    this.parameters[rule.parameter] = paramValue;
    
    // Evaluate targets
    const targetValues = {};
    
    for (const target of rule.targets) {
      // Find curve point before and after current value
      let beforePoint = null;
      let afterPoint = null;
      
      for (let i = 0; i < target.curve.length; i++) {
        const point = target.curve[i];
        
        if (point.time <= paramValue) {
          beforePoint = point;
        }
        
        if (point.time >= paramValue && afterPoint === null) {
          afterPoint = point;
        }
      }
      
      // If no points found, use first or last point
      if (beforePoint === null) {
        beforePoint = target.curve[0];
      }
      
      if (afterPoint === null) {
        afterPoint = target.curve[target.curve.length - 1];
      }
      
      // If points are the same, use that value
      if (beforePoint.time === afterPoint.time) {
        targetValues[target.id] = beforePoint.value;
        continue;
      }
      
      // Interpolate between points
      const t = (paramValue - beforePoint.time) / (afterPoint.time - beforePoint.time);
      
      // Handle different value types
      if (Array.isArray(beforePoint.value)) {
        // Vector interpolation
        const result = [];
        for (let i = 0; i < beforePoint.value.length; i++) {
          const before = beforePoint.value[i];
          const after = afterPoint.value[i];
          result.push(before + t * (after - before));
        }
        targetValues[target.id] = result;
      } else {
        // Scalar interpolation
        targetValues[target.id] = beforePoint.value + t * (afterPoint.value - beforePoint.value);
      }
    }
    
    return targetValues;
  }
  
  /**
   * Evaluate a discrete rule
   * @private
   * @param {Object} rule - The rule to evaluate
   * @param {Object} context - The scene context
   * @returns {Object} - The target values
   */
  _evaluateDiscreteRule(rule, context) {
    // Get parameter value from context
    const paramPath = rule.parameter.split('.');
    let paramValue = context;
    
    for (const part of paramPath) {
      if (paramValue === undefined || paramValue === null) break;
      paramValue = paramValue[part];
    }
    
    if (paramValue === undefined || paramValue === null) {
      return null;
    }
    
    // Store current parameter value
    this.parameters[rule.parameter] = paramValue;
    
    // Evaluate targets
    const targetValues = {};
    
    for (const target of rule.targets) {
      // Check if value exists for this parameter
      if (target.values && target.values[paramValue] !== undefined) {
        targetValues[target.id] = target.values[paramValue];
      } else if (target.defaultValue !== undefined) {
        targetValues[target.id] = target.defaultValue;
      }
    }
    
    return targetValues;
  }
  
  /**
   * Update parameter history
   * @private
   * @param {string} parameter - The parameter name
   * @param {any} value - The parameter value
   */
  _updateParameterHistory(parameter, value) {
    if (!this.history[parameter]) {
      this.history[parameter] = {
        values: [],
        timestamps: [],
        maxEntries: 100
      };
    }
    
    const history = this.history[parameter];
    
    // Add new entry
    history.values.push(value);
    history.timestamps.push(performance.now());
    
    // Trim history if needed
    if (history.values.length > history.maxEntries) {
      history.values.shift();
      history.timestamps.shift();
    }
  }
  
  /**
   * Apply adaptation to a scene
   * @param {Object} scene - The scene to adapt
   * @param {Object} context - The scene context
   */
  adapt(scene, context) {
    const currentTime = performance.now();
    const deltaTime = (currentTime - this.lastUpdateTime) / 1000;
    this.lastUpdateTime = currentTime;
    
    // Update context with delta time
    context.deltaTime = deltaTime;
    
    // Process continuous and discrete rules
    for (const rule of this.rules) {
      if (rule.type === 'continuous') {
        const targetValues = this._evaluateContinuousRule(rule, context);
        if (targetValues) {
          this._applyTargetValues(scene, targetValues);
        }
      } else if (rule.type === 'discrete') {
        const targetValues = this._evaluateDiscreteRule(rule, context);
        if (targetValues) {
          this._applyTargetValues(scene, targetValues);
        }
      }
    }
    
    // Process state machines
    for (const id in this.stateMachines) {
      const stateMachine = this.stateMachines[id];
      const settings = this._updateStateMachine(stateMachine, currentTime);
      
      if (settings) {
        this._applyTargetValues(scene, settings);
      }
    }
    
    // Process neural rules
    this._processNeuralRules(scene, context);
    
    // Learn from user behavior if enabled
    if (this.learningEnabled && context.userInteraction) {
      this._learnFromUserBehavior(context.userInteraction);
    }
  }
  
  /**
   * Apply target values to a scene
   * @private
   * @param {Object} scene - The scene to apply to
   * @param {Object} targetValues - The target values to apply
   */
  _applyTargetValues(scene, targetValues) {
    for (const targetId in targetValues) {
      const value = targetValues[targetId];
      
      // Parse target path
      const targetPath = targetId.split('.');
      
      // Apply value to scene
      this._applyValueToPath(scene, targetPath, value);
      
      // Store current target value
      this.targets[targetId] = value;
    }
  }
  
  /**
   * Apply a value to a path in an object
   * @private
   * @param {Object} obj - The object to apply to
   * @param {Array} path - The path to apply to
   * @param {any} value - The value to apply
   */
  _applyValueToPath(obj, path, value) {
    // Handle special case for incrementing/decrementing
    if (typeof value === 'string' && (value.startsWith('+') || value.startsWith('-'))) {
      const numValue = parseFloat(value);
      if (!isNaN(numValue)) {
        // Get current value
        let current = obj;
        for (let i = 0; i < path.length - 1; i++) {
          if (current === undefined || current === null) return;
          current = current[path[i]];
        }
        
        const lastPart = path[path.length - 1];
        if (current && typeof current[lastPart] === 'number') {
          current[lastPart] += numValue;
          return;
        }
      }
    }
    
    // Regular case - set value
    let current = obj;
    for (let i = 0; i < path.length - 1; i++) {
      if (current === undefined || current === null) return;
      
      // Create object if it doesn't exist
      if (current[path[i]] === undefined) {
        current[path[i]] = {};
      }
      
      current = current[path[i]];
    }
    
    const lastPart = path[path.length - 1];
    if (current) {
      current[lastPart] = value;
    }
  }
  
  /**
   * Process neural adaptation rules
   * @private
   * @param {Object} scene - The scene to adapt
   * @param {Object} context - The scene context
   */
  _processNeuralRules(scene, context) {
    // In a real implementation, this would run neural networks for adaptation
    // For this example, we'll just simulate some basic neural adaptation
    
    for (const rule of this.rules) {
      if (rule.type !== 'neural') continue;
      
      // Collect inputs
      const inputs = {};
      let missingInputs = false;
      
      for (const input of rule.inputs) {
        // Get input value from context
        const inputPath = input.source.split('.');
        let inputValue = context;
        
        for (const part of inputPath) {
          if (inputValue === undefined || inputValue === null) break;
          inputValue = inputValue[part];
        }
        
        if (inputValue === undefined || inputValue === null) {
          missingInputs = true;
          break;
        }
        
        inputs[input.name] = inputValue;
      }
      
      if (missingInputs) continue;
      
      // Simulate neural network inference
      const outputs = this._simulateNeuralInference(rule, inputs);
      
      // Apply outputs
      if (outputs) {
        const targetValues = {};
        
        for (const output of rule.outputs) {
          if (outputs[output.name] !== undefined) {
            targetValues[output.target] = outputs[output.name];
          }
        }
        
        this._applyTargetValues(scene, targetValues);
      }
    }
  }
  
  /**
   * Simulate neural network inference
   * @private
   * @param {Object} rule - The neural rule
   * @param {Object} inputs - The input values
   * @returns {Object} - The output values
   */
  _simulateNeuralInference(rule, inputs) {
    // This is a very simplified simulation of neural network inference
    // In a real implementation, this would use a proper neural network
    
    console.log(`Simulating neural inference for rule ${rule.id}`);
    
    // Simple example: time of day affecting lighting and mood
    if (inputs.timeOfDay !== undefined) {
      const timeOfDay = inputs.timeOfDay;
      
      // Calculate base lighting intensity based on time of day
      // Brightest at noon (0.5), darkest at midnight (0.0 and 1.0)
      const lightIntensity = Math.sin(timeOfDay * Math.PI) * 0.8 + 0.2;
      
      // Calculate color temperature based on time of day
      // Warm at sunrise/sunset, cool at noon, very cool at night
      let colorTemp;
      if (timeOfDay < 0.25) { // Dawn
        colorTemp = [0.8 + timeOfDay * 0.8, 0.5 + timeOfDay * 2.0, 0.5 + timeOfDay * 2.0];
      } else if (timeOfDay < 0.5) { // Morning to noon
        colorTemp = [1.0, 1.0, 1.0];
      } else if (timeOfDay < 0.75) { // Noon to dusk
        const t = (timeOfDay - 0.5) * 4;
        colorTemp = [1.0, 1.0 - t * 0.3, 1.0 - t * 0.5];
      } else { // Night
        const t = (timeOfDay - 0.75) * 4;
        colorTemp = [0.8 - t * 0.7, 0.5 - t * 0.4, 0.5 - t * 0.2];
      }
      
      // Calculate mood based on time of day and weather
      let mood = 'neutral';
      if (inputs.weather === 'sunny' && timeOfDay > 0.25 && timeOfDay < 0.75) {
        mood = 'happy';
      } else if (inputs.weather === 'rainy' || inputs.weather === 'stormy') {
        mood = 'somber';
      } else if (timeOfDay < 0.2 || timeOfDay > 0.8) {
        mood = 'mysterious';
      }
      
      // Apply user preferences if available
      if (this.userPreferences.lightingIntensity !== undefined) {
        // Adjust lighting based on user preference (0.5-1.5 range)
        const prefFactor = 0.5 + this.userPreferences.lightingIntensity;
        lightIntensity *= prefFactor;
      }
      
      return {
        lightIntensity,
        colorTemperature: colorTemp,
        mood,
        ambientSoundVolume: Math.max(0.2, 1.0 - lightIntensity)
      };
    }
    
    // Default outputs
    return {
      lightIntensity: 1.0,
      colorTemperature: [1.0, 1.0, 1.0],
      mood: 'neutral',
      ambientSoundVolume: 0.5
    };
  }
  
  /**
   * Learn from user behavior
   * @private
   * @param {Object} interaction - The user interaction data
   */
  _learnFromUserBehavior(interaction) {
    // In a real implementation, this would update a user preference model
    // For this example, we'll just track some simple preferences
    
    console.log('Learning from user behavior:', interaction);
    
    // Example: Learn lighting preference
    if (interaction.type === 'lighting_adjustment') {
      const currentPref = this.userPreferences.lightingIntensity || 1.0;
      const newValue = currentPref + this.learningRate * (interaction.value - currentPref);
      
      this.userPreferences.lightingIntensity = Math.max(0.0, Math.min(2.0, newValue));
      console.log(`Updated lighting preference to ${this.userPreferences.lightingIntensity.toFixed(2)}`);
    }
    
    // Example: Learn color preference
    if (interaction.type === 'color_preference') {
      if (!this.userPreferences.colorPreference) {
        this.userPreferences.colorPreference = { r: 1.0, g: 1.0, b: 1.0 };
      }
      
      const current = this.userPreferences.colorPreference;
      const target = interaction.value;
      
      current.r += this.learningRate * (target.r - current.r);
      current.g += this.learningRate * (target.g - current.g);
      current.b += this.learningRate * (target.b - current.b);
      
      console.log(`Updated color preference to [${current.r.toFixed(2)}, ${current.g.toFixed(2)}, ${current.b.toFixed(2)}]`);
    }
  }
  
  /**
   * Get the current value of a parameter
   * @param {string} parameter - The parameter name
   * @returns {any} - The parameter value
   */
  getParameterValue(parameter) {
    return this.parameters[parameter];
  }
  
  /**
   * Get the current value of a target
   * @param {string} target - The target name
   * @returns {any} - The target value
   */
  getTargetValue(target) {
    return this.targets[target];
  }
  
  /**
   * Get the current state of a state machine
   * @param {string} id - The state machine ID
   * @returns {string} - The current state
   */
  getStateMachineState(id) {
    const stateMachine = this.stateMachines[id];
    return stateMachine ? stateMachine.currentState : null;
  }
  
  /**
   * Get the parameter history
   * @param {string} parameter - The parameter name
   * @returns {Object} - The parameter history
   */
  getParameterHistory(parameter) {
    return this.history[parameter];
  }
  
  /**
   * Get user preferences
   * @returns {Object} - The user preferences
   */
  getUserPreferences() {
    return { ...this.userPreferences };
  }
  
  /**
   * Set user preferences
   * @param {Object} preferences - The user preferences
   */
  setUserPreferences(preferences) {
    this.userPreferences = { ...preferences };
  }
  
  /**
   * Enable or disable learning
   * @param {boolean} enabled - Whether learning is enabled
   */
  setLearningEnabled(enabled) {
    this.learningEnabled = enabled;
  }
  
  /**
   * Set the learning rate
   * @param {number} rate - The learning rate
   */
  setLearningRate(rate) {
    this.learningRate = Math.max(0.001, Math.min(0.1, rate));
  }
}

// Export for module systems
if (typeof module !== 'undefined') {
  module.exports = { XRAIAdaptationController };
}
