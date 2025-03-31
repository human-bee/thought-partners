# TLDraw Editor API Guide

## Introduction

The Editor class is the core of TLDraw's functionality. It provides a comprehensive API for controlling the whiteboard programmatically, managing the editor's internal state, making changes to the document, and responding to user interactions.

## Accessing the Editor

There are two primary ways to access the editor:

### 1. Via the `onMount` callback

```jsx
function App() {
  return (
    <Tldraw
      onMount={(editor) => {
        // Access editor instance here
      }}
    />
  )
}
```

### 2. Via the `useEditor` hook

```jsx
function InsideOfContext() {
  const editor = useEditor()
  // Use editor instance here
  return null // or whatever component you want to render
}

function App() {
  return (
    <Tldraw>
      <InsideOfContext />
    </Tldraw>
  )
}
```

## Core Editor Capabilities

### Working with Shapes

#### Creating Shape IDs

```jsx
import { createShapeId } from 'tldraw'

// Generate a random UUID
const id = createShapeId() // 'shape:some-random-uuid'

// Create an ID with a specific name
const namedId = createShapeId('rectangle1') // 'shape:rectangle1'
```

#### Creating Shapes

```jsx
// Create a single shape
editor.createShape({
  type: 'geo',
  x: 100,
  y: 100,
  props: {
    geo: 'rectangle',
    w: 200,
    h: 150,
    dash: 'draw',
    color: 'blue',
    size: 'm',
  },
})

// Create multiple shapes
editor.createShapes([
  {
    id: createShapeId('rect1'),
    type: 'geo',
    x: 0,
    y: 0,
    props: {
      geo: 'rectangle',
      w: 100,
      h: 100,
      color: 'red',
    },
  },
  {
    type: 'text',
    x: 150,
    y: 50,
    props: {
      text: 'Hello, TLDraw!',
      w: 200,
      color: 'black',
    },
  },
])
```

#### Updating Shapes

```jsx
// Update a single shape
editor.updateShape({
  id: shapeId,
  type: 'geo',
  x: 200,
  y: 200,
  props: {
    w: 300,
  },
})

// Update multiple shapes
editor.updateShapes([
  {
    id: shape1.id,
    type: shape1.type,
    x: 100,
    props: {
      color: 'green',
    },
  },
  {
    id: shape2.id,
    type: shape2.type,
    y: 50,
    props: {
      w: 250,
    },
  },
])
```

#### Deleting Shapes

```jsx
// Delete a single shape
editor.deleteShape(shapeId)

// Delete multiple shapes
editor.deleteShapes([shape1.id, shape2.id])

// You can also pass the shape objects directly
editor.deleteShapes([shape1, shape2])
```

#### Getting Shapes

```jsx
// Get a shape by ID
const shape = editor.getShape(shapeId)

// Get all shapes on the current page
const allShapes = editor.getCurrentPageShapes()

// Get shapes sorted by z-index
const sortedShapes = editor.getCurrentPageShapesSorted()

// Get selected shapes
const selectedShapes = editor.getSelectedShapes()
```

### Camera Controls

```jsx
// Set camera position and zoom
editor.setCamera(x, y, zoom)

// Center the camera on specific shapes
editor.zoomToSelection()

// Center the camera on the content
editor.zoomToContent()

// Zoom in/out
editor.zoomIn()
editor.zoomOut()

// Reset zoom
editor.resetZoom()

// Freeze camera (prevent user from moving it)
editor.updateInstanceState({ canMoveCamera: false })
```

### Selection Tools

```jsx
// Select shapes
editor.select(shapeId)
editor.select([shape1.id, shape2.id])

// Select all shapes
editor.selectAll()

// Deselect
editor.deselect()
editor.deselect(shapeId)

// Check if a shape is selected
const isSelected = editor.isSelected(shapeId)
```

### History Controls

```jsx
// Undo / Redo
editor.undo()
editor.redo()

// Check if undo/redo is available
const canUndo = editor.getCanUndo()
const canRedo = editor.getCanRedo()
```

### Style Controls

```jsx
// Change the current style for new shapes
editor.setStyle({
  color: 'blue',
  size: 'm',
  dash: 'solid',
  // etc.
})

// Get current style
const currentStyle = editor.getStyle()
```

## Editor State Management

### Read-Only Mode

```jsx
// Enable read-only mode
editor.updateInstanceState({ isReadonly: true })

// Disable read-only mode
editor.updateInstanceState({ isReadonly: false })

// Check if read-only is enabled
const isReadonly = editor.getInstanceState().isReadonly
```

### Dark Mode

```jsx
// Enable dark mode
editor.setUserPreferences({ isDarkMode: true })

// Disable dark mode
editor.setUserPreferences({ isDarkMode: false })
```

### Clipboard Operations

```jsx
// Copy selected shapes
editor.copy()

// Cut selected shapes
editor.cut()

// Paste from clipboard
editor.paste()
```

## Working with Pages

```jsx
// Create a new page
const pageId = editor.createPage()

// Navigate to a different page
editor.setCurrentPage(pageId)

// Get current page
const currentPage = editor.getCurrentPage()

// Delete a page
editor.deletePage(pageId)
```

## Event Handling

```jsx
// Listen for shape changes
editor.on('change', (change) => {
  // Handle changes to the document
})

// Listen for selection changes
editor.on('select', (selectedIds) => {
  // Handle selection changes
})

// Stop listening to events
const removeListener = editor.on('change', handleChange)
removeListener() // Removes the listener
```

## Tools and Interactions

```jsx
// Set the active tool
editor.setTool('select')
editor.setTool('pencil')
editor.setTool('rectangle')
editor.setTool('ellipse')
editor.setTool('arrow')
editor.setTool('text')
// ... and other available tools

// Get the current tool
const currentTool = editor.getCurrentTool()

// Set interaction mode
editor.setInteractionMode('select')
editor.setInteractionMode('draw')

// Cancel the current interaction
editor.cancel()
```

## Collaboration Features

```jsx
// Set up multiplayer presence
editor.updateInstanceState({
  userId: 'user123',
  userName: 'John Doe',
  userColor: '#ff0000',
})

// Show/hide collaborator cursors
editor.updateInstanceState({ showCollaboratorCursors: true })

// Show/hide collaborator presence
editor.updateInstanceState({ showCollaboratorPresence: true })
```

## Customization

### Registering Custom Shapes

```jsx
// Register a custom shape
editor.registerShapes([MyCustomShape])

// Get a shape's util
const shapeUtil = editor.getShapeUtil('myCustomShape')
```

### Registering Custom Tools

```jsx
// Register a custom tool
editor.registerTools([MyCustomTool])
```

## Advanced Features

### Exporting

```jsx
// Export the current page as an image
const imageBlob = await editor.exportImage({
  format: 'png', // or 'jpeg', 'svg', etc.
  quality: 1,
  scale: 2,
})

// Export as JSON
const json = editor.exportJson()
```

### Importing

```jsx
// Import from JSON
editor.importJson(jsonData)

// Import from an image
editor.addMediaFromFile(imageFile)
```

## Conclusion

The TLDraw Editor API provides extensive functionality for interacting with the whiteboard programmatically. This guide covers the most common operations, but the full API includes many more capabilities. For complete details, refer to the [official documentation](https://tldraw.dev/docs/editor). 