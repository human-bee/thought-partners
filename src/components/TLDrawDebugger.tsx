import { useEffect, useState } from 'react';
import { runTldrawDiagnostics, checkTldrawEditorAvailability } from '@/utils/tldraw-debug';

/**
 * Component that provides debugging capabilities for TLDraw integration
 * Runs diagnostics and provides information about package versions, duplication, etc.
 */
export function TLDrawDebugger() {
  const [isVisible, setIsVisible] = useState(false);
  const [diagnosticsRun, setDiagnosticsRun] = useState(false);
  const [editorFound, setEditorFound] = useState<boolean | null>(null);
  const [packageInfo, setPackageInfo] = useState<string | null>('N/A');

  // Run diagnostics once when component is mounted
  useEffect(() => {
    // Only run in browser environment
    if (typeof window === 'undefined') return;

    // Wait for components to fully mount
    const timer = setTimeout(() => {
      runTldrawDiagnostics();
      setDiagnosticsRun(true);
      const editorAvailable = checkTldrawEditorAvailability();
      setEditorFound(editorAvailable);
      
      // Remove the attempt to require package.json
      // try {
      //   // Check for TLDraw versions
      //   const tldrawVersion = require('@tldraw/tldraw/package.json').version;
      //   setPackageInfo(`@tldraw/tldraw: ${tldrawVersion}`);
      // } catch (err) {
      //   setPackageInfo('Error fetching package versions');
      // }
    }, 2000);
    
    return () => clearTimeout(timer);
  }, []);

  // Manual re-run function
  const runDiagnosticsManually = () => {
    if (typeof window === 'undefined') return;
    runTldrawDiagnostics();
    setDiagnosticsRun(true);
    const editorAvailable = checkTldrawEditorAvailability();
    setEditorFound(editorAvailable);
  };

  // If environment is not browser, don't render
  if (typeof window === 'undefined') {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {isVisible ? (
        <div className="bg-white rounded-lg shadow-lg p-4 w-80 border border-gray-300">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-md font-semibold">TLDraw Debugger</h3>
            <button 
              onClick={() => setIsVisible(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              ×
            </button>
          </div>
          
          <div className="text-sm">
            <div className="mb-2">
              <span className="font-medium">Status:</span>{' '}
              {diagnosticsRun ? 'Diagnostics run' : 'Waiting to run diagnostics...'}
            </div>
            
            <div className="mb-2">
              <span className="font-medium">Editor Found:</span>{' '}
              {editorFound === null ? 'Checking...' : 
               editorFound ? (
                <span className="text-green-600">Yes</span>
               ) : (
                <span className="text-red-600">No</span>
               )}
            </div>
            
            {packageInfo && (
              <div className="mb-2">
                <span className="font-medium">Package Version:</span>{' '}
                {packageInfo}
              </div>
            )}
            
            <div className="text-xs text-gray-500 mt-2">
              Check browser console for detailed diagnostics.
            </div>
            
            <div className="mt-3 flex justify-between">
              <button
                onClick={runDiagnosticsManually}
                className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-xs"
              >
                Run Diagnostics
              </button>
              
              <button
                onClick={() => {
                  if (window.__editorInstance) {
                    try {
                      const id = window.__editorInstance.createShapeId();
                      window.__editorInstance.createShapes([{
                        id,
                        type: 'note',
                        x: 100,
                        y: 100,
                        props: {
                          richText: window.__editorInstance.textUtils.toRichText('Test Note'),
                          color: 'yellow',
                        }
                      }]);
                      alert('Test note created successfully!');
                    } catch (e) {
                      console.error('Error creating test note:', e);
                      alert(`Error creating test note: ${e.message}`);
                    }
                  } else {
                    alert('Editor instance not found');
                  }
                }}
                className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-xs"
              >
                Test Create Note
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsVisible(true)}
          className="bg-blue-500 hover:bg-blue-600 text-white rounded-full w-12 h-12 flex items-center justify-center shadow-lg"
          title="TLDraw Debugger"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      )}
    </div>
  );
} 