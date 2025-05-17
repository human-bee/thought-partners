---
description: 
globs: 
alwaysApply: false
---
# Codebase Cleanup TODO (Prioritized)

This TODO list is designed to guide a safe, effective cleanup of the codebase. Tasks are ordered to minimize risk: start with analysis/audit, then consolidate, then remove or refactor. Check off each step as you go.

## 1. **Audit & Analysis**
- [ ] **Inventory Token Endpoints**
  - Review all token-related endpoints: [`get-token`](mdc:src/app/api/get-token/route.ts), [`livekit`](mdc:src/app/api/livekit/route.ts), [`refresh-token`](mdc:src/app/api/refresh-token/route.ts), [`create-agent`](mdc:src/app/api/create-agent/route.ts)
  - Identify which are actually used in production and which are legacy/experimental.
- [ ] **Audit Transcription Canvas/Controls**
  - Check usage of [`TranscriptionCanvas.tsx`](mdc:src/components/TranscriptionCanvas.tsx), [`transcription/TranscriptionCanvas.tsx`](mdc:src/components/transcription/TranscriptionCanvas.tsx), [`transcription/TestControls.tsx`](mdc:src/components/transcription/TestControls.tsx)
  - Determine which are used in the main app and which are for dev/testing.
- [ ] **Logger Utility Review**
  - Compare [`VideoLogger.ts`](mdc:src/components/videoconference/VideoLogger.ts) and [`utils/VideoLogger.ts`](mdc:src/utils/VideoLogger.ts) for duplication and usage.
- [ ] **Devtools & Test Harnesses Inventory**
  - List all dev/test-only files: [`LiveKitTest.tsx`](mdc:src/components/LiveKitTest.tsx), [`TLDrawDebugger.tsx`](mdc:src/components/TLDrawDebugger.tsx), [`tldraw-debug.ts`](mdc:src/utils/tldraw-debug.ts), [`test-livekit/page.tsx`](mdc:src/app/test-livekit/page.tsx)
  - Confirm if they are imported in production code.
- [ ] **Check Import Path Consistency**
  - Standardize import paths in test files to match actual file casing (e.g., `videoconference/` vs `VideoConference/`).
- [ ] **Review Mocks & Test Utilities**
  - Ensure files in [`mocks/`](mdc:src/mocks) and [`tests/`](mdc:src/tests) are not imported in production.

## 2. **Consolidation & Refactoring**
- [ ] **Consolidate Token Endpoints**
  - Merge logic into a single endpoint or shared utility. Deprecate/remove unused endpoints.
- [ ] **Unify Logger Utility**
  - Choose one logger implementation and update imports throughout the codebase.
- [ ] **Deduplicate Transcription Canvas/Controls**
  - Keep only the version(s) used in production. Move dev/test versions to a `devtools` or `playground` directory, or remove.

## 3. **Devtools/Test Harnesses Isolation**
- [ ] **Move Devtools/Test Harnesses**
  - Relocate files like [`LiveKitTest.tsx`](mdc:src/components/LiveKitTest.tsx), [`TLDrawDebugger.tsx`](mdc:src/components/TLDrawDebugger.tsx), [`tldraw-debug.ts`](mdc:src/utils/tldraw-debug.ts), [`test-livekit/page.tsx`](mdc:src/app/test-livekit/page.tsx) to a dedicated `devtools/` or `playground/` directory.
  - Ensure they are not bundled in production builds.

## 4. **Removal & Final Cleanup**
- [ ] **Remove Vestigial/Unused Files**
  - Delete files confirmed as unused or obsolete after the above steps.
- [ ] **Document Core vs. Devtools Files**
  - Add comments or a doc listing which files are core app logic and which are devtools/test-only.

---

**Rationale for Order:**
- Start with analysis to avoid accidental removal of needed code.
- Consolidate and refactor only after confirming usage.
- Move devtools/test harnesses before deletion to preserve useful tools.
- Remove only after all dependencies and usage are clear.
- Document for future maintainers to prevent recurrence.
