---
description:
globs:
alwaysApply: false
---
# Agent Integration Quickstart

This guide explains how to add a new agent or tool that interacts with both the transcript and the tldraw whiteboard.

## Steps

1. **Read the transcript**
   - Use [transcript-store-guide](mdc:transcript-store-guide.md) for access patterns.

2. **Write to the transcript**
   - Always set `authorId` and `authorName` to identify your agent.
   - Use the `addLine` method as described in the transcript store guide.

3. **Manipulate the whiteboard**
   - Use [whiteboard-controller-agents](mdc:whiteboard-controller-agents.md) for best practices.
   - Never call editor APIs directly; always use the controller's `applyChange` or `applyChanges` methods with declarative change objects.

4. **Sync actions**
   - When your agent makes a change to the whiteboard, also push a summary line to the transcript for context and traceability.

5. **Debugging**
   - Use the browser console or dev panel to inspect the transcript and whiteboard state.
   - You can also check `localStorage` for the `transcript_lines` key for a snapshot.

## Example Workflow

- Agent receives a new transcript line.
- Agent decides to create a sticky note:
  1. Calls `WhiteboardController.applyChange({ type: 'createShape', ... })`
  2. Calls `TranscriptStore.addLine({ authorId: 'agent_xyz', ... })`

---

See the other rules for API details and best practices.
