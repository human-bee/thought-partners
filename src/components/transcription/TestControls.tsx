import { useEffect, useRef, useCallback } from 'react';
import { Editor, createShapeId } from '@tldraw/editor';

export function TestControls() {
  const editorRef = useRef<Editor | null>(null);

  // Get editor from the closest Tldraw component
  useEffect(() => {
    // Look for TLDraw editor instance in the document
    const findEditor = () => {
      const tldrawElement = document.querySelector('[data-testid="tldraw-editor"]');
      if (tldrawElement && (tldrawElement as any).__editor) {
        editorRef.current = (tldrawElement as any).__editor;
      }
    };

    // Try immediately and also after a short delay to ensure TLDraw is mounted
    findEditor();
    const timer = setTimeout(findEditor, 1000);
    
    return () => clearTimeout(timer);
  }, []);

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
          content: text,
          color: 'yellow',
          size: 'l',
          font: 'draw',
          align: 'middle',
          verticalAlign: 'middle',
          growY: true,
          width: 300,
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
          width: 320,
          height: 200,
          color: 'light-blue',
          fill: 'solid',
          dash: 'draw',
          size: 'm',
        }
      };
      
      // Create text on top with updated properties for TLDraw v3
      // Text shapes still use 'text' property, only notes use 'content'
      const textId = createShapeId();
      const textShape = {
        id: textId,
        type: 'text',
        x: (bgShape.x as number) + 10,
        y: (bgShape.y as number) + 10,
        props: {
          text: 'This is a text box with background at ' + new Date().toLocaleTimeString(),
          color: 'black',
          size: 'l',
          font: 'draw',
          align: 'start',
          autoSize: true,
          width: 300,
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