"use client";

import { useCallback, useRef } from 'react';
import { Editor, createShapeId, toRichText } from '@tldraw/editor';
import { Tldraw } from '@tldraw/tldraw';

export function TranscriptionShapeTester() {
  const editorRef = useRef<Editor | null>(null);
  
  const createTextShape = useCallback(() => {
    if (!editorRef.current) return;
    const editor = editorRef.current;
    
    try {
      const id = createShapeId();
      const textContent = 'Text shape created at ' + new Date().toLocaleTimeString();
      
      console.log('Creating text shape with properties:', {
        type: 'text',
        richText: 'Using richText with toRichText()',
      });
      
      const textShape = {
        id,
        type: 'text',
        x: 100 + Math.random() * 300,
        y: 100 + Math.random() * 200,
        props: {
          richText: toRichText(textContent),
          color: 'black',
          size: 'm',
          font: 'draw',
          textAlign: 'start',
          autoSize: true,
          w: 300,
        }
      };
      
      editor.createShapes([textShape]);
      console.log('Text shape created successfully');
    } catch (error) {
      console.error('Error creating text shape:', error);
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
    }
  }, []);
  
  const createNoteShape = useCallback(() => {
    if (!editorRef.current) return;
    const editor = editorRef.current;
    
    try {
      const id = createShapeId();
      const noteContent = 'Note shape created at ' + new Date().toLocaleTimeString();
      
      console.log('Creating note shape with properties:', {
        type: 'note',
        richText: 'Using richText with toRichText()',
      });
      
      const noteShape = {
        id,
        type: 'note',
        x: 100 + Math.random() * 300,
        y: 100 + Math.random() * 200,
        props: {
          richText: toRichText(noteContent),
          color: 'yellow',
          size: 'm',
          font: 'draw',
          align: 'middle',
          verticalAlign: 'middle',
          growY: true,
        }
      };
      
      console.log('About to call editor.createShapes with:', noteShape);
      editor.createShapes([noteShape]);
      console.log('Note shape created successfully');
    } catch (error) {
      console.error('Error creating note shape:', error);
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
    }
  }, []);
  
  const createGeoShape = useCallback(() => {
    if (!editorRef.current) return;
    const editor = editorRef.current;
    
    try {
      const id = createShapeId();
      
      console.log('Creating geo shape with properties:', {
        type: 'geo',
        geo: 'rectangle',
        w: 320,
        h: 200,
      });
      
      const geoShape = {
        id,
        type: 'geo',
        x: 100 + Math.random() * 300,
        y: 100 + Math.random() * 200,
        props: {
          geo: 'rectangle',
          w: 320,
          h: 200,
          color: 'light-blue',
          fill: 'solid',
          dash: 'draw',
          size: 'm',
          richText: toRichText('Rectangle created at ' + new Date().toLocaleTimeString()),
        }
      };
      
      console.log('About to call editor.createShapes with:', geoShape);
      editor.createShapes([geoShape]);
      console.log('Geo shape created successfully');
    } catch (error) {
      console.error('Error creating geo shape:', error);
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
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
          
          console.log('Available shape utils:', Object.keys(editor.shapeUtils));
          
          try {
            const textUtil = editor.getShapeUtil('text');
            const noteUtil = editor.getShapeUtil('note');
            const geoUtil = editor.getShapeUtil('geo');
            
            console.log('Text shape util default props:', textUtil?.getDefaultProps?.());
            console.log('Note shape util default props:', noteUtil?.getDefaultProps?.());
            console.log('Geo shape util default props:', geoUtil?.getDefaultProps?.());
          } catch (e) {
            console.error('Error getting shape utils default props:', e);
          }
        }}
      />
    </div>
  );
} 