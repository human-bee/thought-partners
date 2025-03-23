import { useCallback, useRef } from 'react';
import { Editor, createShapeId } from '@tldraw/editor';
import { Tldraw } from '@tldraw/tldraw';

export function TranscriptionShapeTester() {
  const editorRef = useRef<Editor | null>(null);
  
  const createTextShape = useCallback(() => {
    if (!editorRef.current) return;
    const editor = editorRef.current;
    
    try {
      const id = createShapeId();
      const textShape = {
        id,
        type: 'text',
        x: 100 + Math.random() * 300,
        y: 100 + Math.random() * 200,
        props: {
          text: 'Text shape created at ' + new Date().toLocaleTimeString(),
          color: 'black',
          size: 'm',
          font: 'draw',
          align: 'start',
          autoSize: true,
          width: 300,
        }
      };
      
      editor.createShapes([textShape]);
      console.log('Text shape created successfully');
    } catch (error) {
      console.error('Error creating text shape:', error);
    }
  }, []);
  
  const createNoteShape = useCallback(() => {
    if (!editorRef.current) return;
    const editor = editorRef.current;
    
    try {
      const id = createShapeId();
      const noteShape = {
        id,
        type: 'note',
        x: 100 + Math.random() * 300,
        y: 100 + Math.random() * 200,
        props: {
          content: 'Note shape created at ' + new Date().toLocaleTimeString(),
          color: 'yellow',
          size: 'm',
          font: 'draw',
          align: 'middle',
          verticalAlign: 'middle',
          growY: true,
          width: 300,
        }
      };
      
      editor.createShapes([noteShape]);
      console.log('Note shape created successfully');
    } catch (error) {
      console.error('Error creating note shape:', error);
    }
  }, []);
  
  const createGeoShape = useCallback(() => {
    if (!editorRef.current) return;
    const editor = editorRef.current;
    
    try {
      const id = createShapeId();
      const geoShape = {
        id,
        type: 'geo',
        x: 100 + Math.random() * 300,
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
      
      editor.createShapes([geoShape]);
      console.log('Geo shape created successfully');
    } catch (error) {
      console.error('Error creating geo shape:', error);
    }
  }, []);
  
  return (
    <div className="h-full w-full relative">
      <div className="absolute top-4 left-4 z-10 flex gap-2">
        <button 
          onClick={createTextShape} 
          className="px-3 py-1 bg-blue-500 text-white rounded"
        >
          Create Text
        </button>
        <button 
          onClick={createNoteShape} 
          className="px-3 py-1 bg-yellow-500 text-white rounded"
        >
          Create Note
        </button>
        <button 
          onClick={createGeoShape} 
          className="px-3 py-1 bg-green-500 text-white rounded"
        >
          Create Rectangle
        </button>
      </div>
      
      <Tldraw
        onMount={(editor: Editor) => {
          editorRef.current = editor;
          console.log('TLDraw editor mounted for shape testing');
        }}
      />
    </div>
  );
} 