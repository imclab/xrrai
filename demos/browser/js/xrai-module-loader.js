/**
 * XRAI Module Loader
 * Handles loading of XRAI modules to prevent duplicate declarations
 */

// Keep track of loaded modules
const loadedModules = new Set();

/**
 * Load a JavaScript module only if it hasn't been loaded before
 * @param {string} url - URL of the JavaScript module
 * @returns {Promise} - Promise that resolves when the module is loaded
 */
function loadModule(url) {
  // Check if module is already loaded
  if (loadedModules.has(url)) {
    console.log(`Module ${url} already loaded, skipping`);
    return Promise.resolve();
  }
  
  // Mark module as loaded
  loadedModules.add(url);
  
  // Create script element
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.async = true;
    
    // Handle load event
    script.onload = () => {
      console.log(`Module ${url} loaded successfully`);
      resolve();
    };
    
    // Handle error event
    script.onerror = (error) => {
      console.error(`Failed to load module ${url}:`, error);
      loadedModules.delete(url); // Remove from loaded modules
      reject(error);
    };
    
    // Add script to document
    document.head.appendChild(script);
  });
}

/**
 * Load multiple JavaScript modules in sequence
 * @param {Array<string>} urls - Array of URLs to load
 * @returns {Promise} - Promise that resolves when all modules are loaded
 */
async function loadModules(urls) {
  for (const url of urls) {
    await loadModule(url);
  }
}

// Export module loader
window.XRAIModuleLoader = {
  loadModule,
  loadModules
};
