import { useEffect, useRef, useCallback, useState } from 'react';
import { Editor, createShapeId, toRichText } from '@tldraw/editor';

// Define an interface for the extended HTMLElement with the editor property
interface TLDrawElementWithEditor extends HTMLElement {
  __editorForTranscription?: Editor;
  __editor?: Editor;
}

export function TestControls() {
  const editorRef = useRef<Editor | null>(null);
  const [isClient, setIsClient] = useState(false);

  // Set isClient to true when component mounts on client
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Get editor from the closest Tldraw component
  useEffect(() => {
    if (!isClient) return; // Skip during SSR
    
    // Look for TLDraw editor instance in the document
    const findEditor = () => {
      if (typeof document === 'undefined') return; // Safety check for SSR
      
      // Check global window object first (might be set by TranscriptionCanvas)
      if (window.__editorInstance) {
        editorRef.current = window.__editorInstance;
        console.log('TestControls: Found editor via window.__editorInstance');
        return;
      }
      
      const tldrawElement = document.querySelector('[data-testid="tldraw-editor"]');
      if (tldrawElement) {
        const element = tldrawElement as TLDrawElementWithEditor;
        // Try to get editor from our custom property first, then fall back to the default
        if (element.__editorForTranscription) {
          editorRef.current = element.__editorForTranscription;
          console.log('TestControls: Found editor via __editorForTranscription property');
        } else if (element.__editor) {
          editorRef.current = element.__editor;
          console.log('TestControls: Found editor via __editor property');
        }
        
        if (editorRef.current) {
          console.log('TestControls: Editor is available for use');
          // Store globally for other components to use
          window.__editorInstance = editorRef.current;
        }
      }
    };

    // Try immediately and also after a short delay to ensure TLDraw is mounted
    findEditor();
    const timer = setTimeout(findEditor, 1000);
    
    // Try at increasing intervals
    const secondTimer = setTimeout(findEditor, 3000);
    const thirdTimer = setTimeout(() => {
      findEditor();
      if (!editorRef.current) {
        console.error('TestControls: Editor still not available after longer timeout. Will continue trying...');
        
        // Keep trying at longer intervals
        const intervalId = setInterval(() => {
          findEditor();
          if (editorRef.current) {
            console.log('TestControls: Editor finally found!');
            clearInterval(intervalId);
          }
        }, 2000);
        
        // Clean up interval after a reasonable time
        setTimeout(() => clearInterval(intervalId), 30000);
      }
    }, 5000);
    
    return () => {
      clearTimeout(timer);
      clearTimeout(secondTimer);
      clearTimeout(thirdTimer);
    };
  }, [isClient]);

  const addTranscriptionToCanvas = useCallback((text: string) => {
    console.log('Adding transcription to canvas:', text);
    if (!editorRef.current) {
      console.warn('Editor ref is not available');
      return;
    }

    const editor = editorRef.current;
    const id = createShapeId();

    try {
      // Create a note shape instead of text (better for transcriptions)
      const shape = {
        id,
        type: 'note',
        x: Math.random() * 600,
        y: Math.random() * 400,
        props: {
          richText: toRichText(text),
          color: 'yellow',
          size: 'l',
          font: 'draw',
          align: 'middle',
          verticalAlign: 'middle',
          growY: true,
        }
      };

      console.log('Creating shape:', shape);
      editor.createShapes([shape]);
      console.log('Shape created successfully');
    } catch (error) {
      console.error('Error creating shape:', error);
    }
  }, []);

  // Test function to create a simple shape directly
  const createTestShape = useCallback(() => {
    console.log('Creating test shape...');
    addTranscriptionToCanvas('Test note created at ' + new Date().toLocaleTimeString());
  }, [addTranscriptionToCanvas]);

  // Test function to create a text box with background
  const createTextBoxWithBackground = useCallback(() => {
    console.log('Creating text box with background...');
    if (!editorRef.current) {
      console.warn('Editor ref is not available for text box creation');
      return;
    }

    const editor = editorRef.current;
    
    try {
      // Create a background rectangle with simplified properties
      const bgId = createShapeId();
      const bgShape = {
        id: bgId,
        type: 'geo',
        x: 100 + Math.random() * 200,
        y: 100 + Math.random() * 200,
        props: {
          geo: 'rectangle',
          w: 320,
          h: 200,
          color: 'light-blue',
          fill: 'solid',
          dash: 'draw',
          size: 'm',
        }
      };
      
      // Create text on top with updated properties for TLDraw v3
      const textId = createShapeId();
      const textShape = {
        id: textId,
        type: 'text',
        x: (bgShape.x as number) + 10,
        y: (bgShape.y as number) + 10,
        props: {
          richText: toRichText('This is a text box with background at ' + new Date().toLocaleTimeString()),
          color: 'black',
          size: 'l',
          font: 'draw',
          textAlign: 'start',
          autoSize: true,
          w: 300,
        }
      };
      
      // Add both shapes to the canvas
      editor.createShapes([bgShape, textShape]);
      console.log('Text box with background created successfully');
    } catch (error) {
      console.error('Error creating text box with background:', error);
    }
  }, []);

  return (
    <div className="w-full flex flex-col gap-2">
      <button 
        onClick={createTestShape}
        className="bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded shadow-md font-medium text-sm transition-colors w-full"
      >
        Create Test Note
      </button>
      <button 
        onClick={createTextBoxWithBackground}
        className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded shadow-md font-medium text-sm transition-colors w-full"
      >
        Create Text Box
      </button>
    </div>
  );
}

// Add to global Window interface
declare global {
  interface Window {
    __editorInstance?: Editor;
  }
} 