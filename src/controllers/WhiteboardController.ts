import { Editor, TLShapePartial } from 'tldraw'
import {
  TLAiChange,
  TLAiCreateBindingChange,
  TLAiCreateShapeChange,
  TLAiDeleteBindingChange,
  TLAiDeleteShapeChange,
  TLAiUpdateBindingChange,
  TLAiUpdateShapeChange,
} from '@tldraw/ai'

/**
 * Central controller for applying declarative "changes" to a tldraw editor.
 *
 * This mirrors the change-based approach used in the `@tldraw/ai` example so that
 * external agents (LLMs, tool calls, etc.) can describe their desired edits in a
 * structured format without directly touching editor APIs.
 */
export class WhiteboardController {
  constructor(private readonly editor: Editor) {}

  /** Apply a single change object to the editor. */
  applyChange(change: TLAiChange): void {
    if (this.editor.isDisposed) return

    switch (change.type) {
      case 'createShape':
        this.handleCreateShape(change)
        break
      case 'updateShape':
        this.handleUpdateShape(change)
        break
      case 'deleteShape':
        this.handleDeleteShape(change)
        break
      case 'createBinding':
        this.handleCreateBinding(change)
        break
      case 'updateBinding':
        this.handleUpdateBinding(change)
        break
      case 'deleteBinding':
        this.handleDeleteBinding(change)
        break
      default:
        // Exhaustive check to help with future additions.
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const _exhaustiveCheck: never = change
        console.warn('Unhandled change type', change)
    }
  }

  /** Apply an array of changes sequentially. */
  applyChanges(changes: TLAiChange[]): void {
    for (const change of changes) {
      this.applyChange(change)
    }
  }

  // ——————————————————————————
  // Internal helpers
  // ——————————————————————————

  private handleCreateShape(change: TLAiCreateShapeChange) {
    // createShapes expects an array
    this.editor.createShapes([change.shape])
  }

  private handleUpdateShape(change: TLAiUpdateShapeChange) {
    this.editor.updateShapes([
      change.shape as TLShapePartial, // editor.updateShapes accepts partials
    ])
  }

  private handleDeleteShape(change: TLAiDeleteShapeChange) {
    this.editor.deleteShapes([change.shapeId])
  }

  private handleCreateBinding(change: TLAiCreateBindingChange) {
    this.editor.createBindings([change.binding])
  }

  private handleUpdateBinding(change: TLAiUpdateBindingChange) {
    this.editor.updateBindings([change.binding])
  }

  private handleDeleteBinding(change: TLAiDeleteBindingChange) {
    this.editor.deleteBindings([change.bindingId])
  }
} 