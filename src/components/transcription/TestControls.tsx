"use client";

import { useEffect, useRef, useCallback } from 'react';
import { Editor, createShapeId, toRichText } from '@tldraw/editor';

// Define flexible shape props that can have either text or richText
interface NoteShapeProps {
  text?: string;
  richText?: any;
  color: string;
  size: string;
  font: string;
  align: string;
  growY: boolean;
  w: number;
}

export function TestControls() {
  const editorRef = useRef<Editor | null>(null);

  // Get editor from the closest Tldraw component
  useEffect(() => {
    // Look for TLDraw editor instance in the document
    const findEditor = () => {
      if (window.__editorInstance) {
        editorRef.current = window.__editorInstance;
        console.log("Found editor in window.__editorInstance");
        return;
      }
      
      const tldrawElement = document.querySelector('[data-testid="tldraw-editor"]');
      if (tldrawElement && (tldrawElement as any).__editor) {
        editorRef.current = (tldrawElement as any).__editor;
        console.log("Found editor in tldraw element");
      }
    };

    // Try immediately and also after a short delay to ensure TLDraw is mounted
    findEditor();
    const timer = setTimeout(findEditor, 1000);
    
    return () => clearTimeout(timer);
  }, []);

  const addTranscriptionToCanvas = useCallback((text: string) => {
    console.log('TEST: Adding transcription to canvas:', text);
    if (!editorRef.current) {
      console.warn('TEST: Editor ref is not available');
      
      // Try to get editor from window
      if (window.__editorInstance) {
        editorRef.current = window.__editorInstance;
        console.log("TEST: Retrieved editor from window.__editorInstance");
      } else {
        console.error("TEST: Could not find editor reference");
        return;
      }
    }

    const editor = editorRef.current;
    const id = createShapeId();

    try {
      // Get viewport to center the shape
      const viewport = editor.getViewportPageBounds();
      const x = viewport.center.x + (Math.random() * 300 - 150);
      const y = viewport.center.y + (Math.random() * 200 - 100);
      
      // Create a note shape 
      const props: NoteShapeProps = {
        color: 'yellow',
        size: 'l',
        font: 'draw',
        align: 'middle',
        growY: true,
        w: 300,
      };
      
      // Check which prop to use for text content
      const noteUtil = editor.getShapeUtil('note');
      if (noteUtil) {
        const defaultProps = noteUtil.getDefaultProps?.() || {};
        if ('richText' in defaultProps) {
          props.richText = toRichText(`TEST: ${text}`);
        } else {
          props.text = `TEST: ${text}`;
        }
      } else {
        // Fallback to text property
        props.text = `TEST: ${text}`;
      }
      
      const shape = {
        id,
        type: 'note',
        x,
        y,
        props
      };

      console.log('TEST: Creating shape:', shape);
      
      // Use try-catch with batch for error handling
      try {
        editor.batch(() => {
          editor.createShapes([shape]);
        });
        console.log('TEST: Shape created successfully');
      } catch (batchError) {
        console.error('TEST: Error in batch shape creation:', batchError);
        // Try direct method as fallback
        editor.createShapes([shape]);
      }
    } catch (error) {
      console.error('TEST: Error creating shape:', error);
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
      
      // Try to get editor from window
      if (window.__editorInstance) {
        editorRef.current = window.__editorInstance;
      } else {
        console.error("Could not find editor reference");
        return;
      }
    }

    const editor = editorRef.current;
    
    try {
      // Get viewport to center the shape
      const viewport = editor.getViewportPageBounds();
      const centerX = viewport.center.x;
      const centerY = viewport.center.y;
      
      // Create a background rectangle with simplified properties
      const bgId = createShapeId();
      const bgShape = {
        id: bgId,
        type: 'geo',
        x: centerX - 160,
        y: centerY - 100,
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
      
      // Create text on top with updated properties for TLDraw
      const textId = createShapeId();
      const textContent = 'This is a text box with background at ' + new Date().toLocaleTimeString();
      
      const textProps: any = {
        color: 'black',
        size: 'l',
        font: 'draw',
        align: 'start',
        w: 300,
      };
      
      // Check which property to use for text
      const textUtil = editor.getShapeUtil('text');
      if (textUtil) {
        const defaultTextProps = textUtil.getDefaultProps?.() || {};
        if ('richText' in defaultTextProps) {
          textProps.richText = toRichText(textContent);
        } else {
          textProps.text = textContent;
        }
      } else {
        textProps.text = textContent;
      }
      
      const textShape = {
        id: textId,
        type: 'text',
        x: (bgShape.x as number) + 10,
        y: (bgShape.y as number) + 10,
        props: textProps
      };
      
      // Add both shapes to the canvas
      try {
        editor.batch(() => {
          editor.createShapes([bgShape, textShape]);
        });
        console.log('Text box with background created successfully');
      } catch (batchError) {
        console.error('Error in batch shape creation:', batchError);
        // Try direct method as fallback
        editor.createShapes([bgShape]);
        editor.createShapes([textShape]);
      }
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

// Add global window type augmentation
declare global {
  interface Window {
    __editorInstance?: Editor;
  }
} 