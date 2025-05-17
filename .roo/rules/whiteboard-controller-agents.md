---
description:
globs:
alwaysApply: false
---
# WhiteboardController – Agent Guide & Best Practices

The central entry-point for programmatic whiteboard edits is
[WhiteboardController.ts](mdc:src/controllers/WhiteboardController.ts).
It provides two methods that agents can call (usually through RPC / tool calls):

* `applyChange(change: TLAiChange)` – apply **one** change.
* `applyChanges(changes: TLAiChange[])` – apply a batch, executed in order.

The `TLAiChange` union mirrors the schema used by **@tldraw/ai**:
```
createShape | updateShape | deleteShape |
createBinding | updateBinding | deleteBinding
```
Each variant carries just the data needed for that action. See the file for exact types.

## Best Practices for Agents

1. **Stay Declarative**  
   Never call `window.__editorInstance` or editor APIs directly.  
   Instead, construct `TLAiChange` objects and pass them to the controller.

2. **Batch Related Edits**  
   If you need to create a shape **and** immediately bind it or position it, send them as an array to `applyChanges` so they execute atomically.

3. **Stable IDs**  
   • Use `createShapeId()` imported from `@tldraw/editor` to generate unique IDs when creating shapes.  
   • Store those IDs in your agent's memory if you plan to update/delete the shape later.

4. **Minimal Updates**  
   When calling `updateShape`, include only the properties you are changing—the controller passes the object to `editor.updateShapes`, which accepts partials.

5. **Respect Ownership**  
   CollaborativeBoard may also update shapes in response to user speech. Avoid clobbering shapes owned by other participants unless your tool is explicitly meant to.  
   A common pattern is to prefix your own shape IDs with `agent_<name>_`.

6. **Sync via Data Channel**  
   If your agent runs outside the browser (e.g., server-side), publish the same change objects over the LiveKit data channel with `topic: 'tldraw'`.  
   CollaborativeBoard listens for those and will route them through the controller.

7. **Error Handling**  
   The controller currently `console.warn`s on unknown types; it will ignore bad actions. Validate your change object before sending.

8. **Coupling with Transcript**  
   When your edit corresponds to a spoken instruction or AI action, also push a line to the TranscriptStore (see [transcript-store-guide](mdc:transcript-store-guide.md)) so context remains consistent.

## TODO / Future Enhancements
* Add optimistic acknowledgement or return value so agents know when their change has been applied.
* Add a `selectShape` change type for focusing existing shapes without modifying them.
* Add granular permission checks (e.g., restricting delete operations to certain agent roles).

Keep this guide handy when implementing new agent tools that manipulate the tldraw canvas.
