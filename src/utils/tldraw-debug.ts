/**
 * Debug utilities for TLDraw integration issues
 */

/**
 * Checks for duplicate TLDraw package instances by examining global variables
 * and logging detailed information about loaded TLDraw packages.
 */
export function checkForDuplicateTldrawPackages() {
  const tldrawPackages = [
    '@tldraw/editor',
    '@tldraw/tldraw',
    '@tldraw/state',
    '@tldraw/tlschema',
    '@tldraw/utils',
    '@tldraw/store',
    '@tldraw/validate',
    '@tldraw/tlsync',
    'tldraw'
  ];

  console.group('TLDraw Package Integrity Check');
  
  // Check if any package is loaded multiple times using Symbol comparison
  // If packages have multiple instances, they'll have different Symbol registries
  const testSymbols: Record<string, symbol> = {};
  const duplicates: string[] = [];
  
  try {
    tldrawPackages.forEach(pkg => {
      // Create a safe way to check package availability
      try {
        // Create a unique symbol for this package/instance
        const pkgSymbol = Symbol.for(`tldraw-debug-${pkg}`);
        
        // Try to access the package
        const pkgModule = require(pkg);
        
        // Store a test symbol on the module
        if (!pkgModule.__tldraw_debug_symbol) {
          pkgModule.__tldraw_debug_symbol = pkgSymbol;
          testSymbols[pkg] = pkgSymbol;
        } 
        // If we already have a symbol but it's different, we have duplicates
        else if (pkgModule.__tldraw_debug_symbol !== pkgSymbol) {
          duplicates.push(pkg);
        }
        
        console.log(`Package ${pkg} loaded from: ${pkgModule.toString ? pkgModule.toString() : 'Unknown'}`);
      } catch (err) {
        console.log(`Package ${pkg} not loaded or unavailable`);
      }
    });
    
    if (duplicates.length > 0) {
      console.error('⚠️ DUPLICATE TLDRAW PACKAGES DETECTED:', duplicates);
      console.log('This will cause validation errors and other inconsistencies.');
      console.log('Fix by updating next.config.js with proper resolver aliases.');
    } else {
      console.log('✅ No duplicate TLDraw packages detected');
    }
  } catch (error) {
    console.error('Error checking for duplicate packages:', error);
  }
  
  console.groupEnd();
}

/**
 * Detect module duplication by attaching a value to a global namespace
 * and checking if it remains consistent across imports
 */
export function markTldrawInstance(packageName: string) {
  if (typeof window === 'undefined') return;
  
  // Create a global namespace if it doesn't exist
  if (!window.__TLDRAW_INSTANCES) {
    (window as any).__TLDRAW_INSTANCES = {};
  }
  
  // Generate a random identifier for this instance
  const instanceId = Math.random().toString(36).substring(2, 15);
  
  // Store it in the global namespace
  (window as any).__TLDRAW_INSTANCES[packageName] = instanceId;
  
  console.log(`Marked ${packageName} with instance ID: ${instanceId}`);
  
  return instanceId;
}

/**
 * Check for TLDraw editor availability in the DOM
 * and report relevant diagnostic information
 */
export function checkTldrawEditorAvailability() {
  const selectors = [
    '[data-testid="tldraw-transcription-editor"]',
    '[data-testid="tldraw-editor"]',
    '.tldraw-editor',
    '.tldraw',
    '[class*="tldraw"]'
  ];
  
  console.group('TLDraw Editor Availability Check');
  
  let foundEditor = false;
  
  selectors.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      console.log(`Found ${elements.length} elements matching selector: ${selector}`);
      foundEditor = true;
      
      // Log details about each element
      elements.forEach((el, i) => {
        console.log(`Element ${i}:`, {
          tagName: el.tagName,
          className: el.className,
          id: el.id,
          rect: el.getBoundingClientRect(),
          hasEditor: !!(el as any).__editorForTranscription,
          attributes: Array.from(el.attributes).map(attr => `${attr.name}="${attr.value}"`).join(', ')
        });
      });
    } else {
      console.log(`No elements found matching selector: ${selector}`);
    }
  });
  
  if (!foundEditor) {
    console.warn('⚠️ No TLDraw editor elements found in the DOM');
    console.log('This may cause transcription notes to fail as they depend on the editor instance');
  } else {
    console.log('✅ TLDraw editor elements found in the DOM');
  }
  
  // Check for global editor instances
  if (window.__editorInstance) {
    console.log('✅ Global editor instance found on window.__editorInstance');
  } else {
    console.warn('⚠️ No global editor instance found on window.__editorInstance');
  }
  
  console.groupEnd();
  
  return foundEditor;
}

/**
 * Run all diagnostics for TLDraw integration
 */
export function runTldrawDiagnostics() {
  console.group('TLDraw Diagnostics');
  
  checkForDuplicateTldrawPackages();
  checkTldrawEditorAvailability();
  
  console.groupEnd();
}

// Export a marked instance for detection
export const INSTANCE_MARKER = markTldrawInstance('tldraw-debug-utils'); 