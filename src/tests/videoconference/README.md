# VideoConference Component Testing Suite

This directory contains test files and utilities for testing the modular VideoConference components.

## Test Structure

The testing approach covers:

1. **Unit Tests** - Testing individual components in isolation
2. **Integration Tests** - Testing component interactions
3. **End-to-End Tests** - Testing the complete user experience
4. **Manual Testing** - Instructions for manual verification

## Available Tests

### Unit Tests

- `MediaControls.test.tsx` - Tests the media controls functionality (camera/mic toggling, device selection)
- `DeviceManager.test.ts` - Tests device enumeration and selection
- `RoomStorage.test.ts` - Tests local storage for room information
- `ConnectionManager.test.tsx` - Tests room connection and token refresh

### End-to-End Tests

- `VideoConferenceE2E.test.ts` - Playwright tests for full component functionality

### Test Utilities

- `manual-test-script.md` - Instructions for manual testing
- `/src/utils/livekit-diagnostics.ts` - Diagnostic utilities for LiveKit
- `/src/app/livekit-debug/page.tsx` - Debug page for testing LiveKit connections
- `/src/app/api/livekit-diagnostics/route.ts` - API endpoint for LiveKit diagnostics

## Running Tests

### Unit Tests

```bash
# Run all tests
npm test

# Run specific tests
npm test -- MediaControls
```

### End-to-End Tests

```bash
# Install Playwright browsers
npx playwright install

# Run E2E tests
npx playwright test
```

### Manual Testing

1. Start the development server: `npm run dev`
2. Navigate to the appropriate pages:
   - LiveKit Test: [http://localhost:3000/test-livekit](http://localhost:3000/test-livekit)
   - LiveKit Debug: [http://localhost:3000/livekit-debug](http://localhost:3000/livekit-debug)
3. Follow the instructions in `manual-test-script.md`

## Debugging Tips

If you encounter issues with the VideoConference components:

1. Check browser console for errors
2. Use the LiveKit Debug Tool at `/livekit-debug` to diagnose connection issues
3. Review logs from the VideoLogger:
   ```javascript
   import { VideoLogger } from '@/components/videoconference/VideoLogger';
   
   // Add this to get logs in browser console
   VideoLogger.enableConsoleOutput();
   ```
4. Set up verbose debugging in LiveKit:
   ```javascript
   import { setLogLevel, LogLevel } from 'livekit-client';
   
   // Enable verbose logging
   setLogLevel(LogLevel.DEBUG);
   ```

## Adding New Tests

When adding new tests:

1. Follow the existing test patterns for consistency
2. Mock external dependencies (LiveKit client, etc.)
3. Focus on testing behavior, not implementation details
4. Add the test to this README 