# Manual Testing Script for VideoConference Components

This document outlines a step-by-step process to manually test the VideoConference component and related subcomponents to ensure everything is working correctly.

## Prerequisites

1. Ensure your development environment is set up:
   ```bash
   npm install
   npm run dev
   ```

2. Have at least two different browsers or devices available for testing (to test participant connection)

3. Have multiple camera and microphone devices connected if possible (to test device switching)

## Test Cases

### 1. Basic Connection Test

1. Navigate to the test page (e.g., `/test-livekit`)
2. Verify the VideoConference component renders with "Connecting..." status
3. Allow camera and microphone permissions when prompted
4. Verify your local video appears
5. Verify the controls at the bottom (camera, microphone, device selector) are visible

**Expected Result:** Component loads fully, local video is visible, media controls are displayed.

### 2. Camera Controls Test

1. Click the camera icon in the media controls
2. Verify the camera turns off (local video should disappear, replaced by a "Camera disabled" UI)
3. Click the camera icon again
4. Verify the camera turns back on (local video reappears)

**Expected Result:** Camera can be toggled on and off with visual feedback.

### 3. Microphone Controls Test

1. Click the microphone icon in the media controls
2. Verify the microphone is muted (icon should change to indicate muted state)
3. Speak into your microphone and verify no audio level indicators are active
4. Click the microphone icon again
5. Verify the microphone is unmuted (icon returns to original state)
6. Speak into your microphone and verify audio levels are indicated

**Expected Result:** Microphone can be toggled on and off with visual feedback.

### 4. Device Selection Test

1. Click the device selector icon in the media controls
2. Verify the device selection dialog appears
3. Select a different camera from the dropdown (if available)
4. Verify the video changes to the selected camera
5. Select a different microphone from the dropdown (if available)
6. Speak into the selected microphone and verify it's working
7. Close the device selection dialog
8. Verify the dialog closes and settings are maintained

**Expected Result:** Device selection dialog works and selected devices are used for media.

### 5. Multiple Participant Test

1. Open the test page in a different browser or device
2. Allow camera and microphone permissions on the second device
3. Verify both participants can see and hear each other
4. Test various media control functions from both sides

**Expected Result:** Multiple participants can join the same room and interact.

### 6. Error Handling Test

1. Deny camera and microphone permissions in the browser
2. Reload the page
3. Verify appropriate error message appears
4. Grant permissions and reload the page
5. Verify normal operation resumes

**Expected Result:** Clear error messages for permission issues with guidance for resolution.

### 7. Network Disruption Test

1. Establish a connection with another participant
2. Temporarily disable your network connection (e.g., airplane mode, disconnect Wi-Fi)
3. Wait for 10-15 seconds
4. Re-enable your network connection
5. Verify the connection recovers automatically

**Expected Result:** Component recovers gracefully from network interruptions.

### 8. Token Refresh Test

This test requires modifying the token expiration to a shorter duration for testing purposes:

1. Modify the token generation to expire in 2 minutes
2. Connect to a room
3. Wait for the token to approach expiration
4. Verify the token refreshes automatically without disconnecting
5. Restore the original token expiration settings

**Expected Result:** Token refresh happens smoothly without user disruption.

### 9. Persistence Test

1. Join a room
2. Close the browser tab
3. Reopen the application and navigate to the same page
4. Verify it attempts to rejoin the previous room

**Expected Result:** Room information is persisted between sessions.

## Recording Test Results

Document any issues found during testing:

1. Component/feature being tested
2. Steps to reproduce
3. Expected vs. actual behavior
4. Browser/device information
5. Screenshots or video recordings if applicable

## Debugging Tips

If issues are encountered:

1. Check browser console for errors
2. Verify network requests in the Network tab
3. Check that the LiveKit server is running and accessible
4. Verify token generation and API responses
5. Check permissions settings in the browser
6. Use the `VideoLogger` logs to trace the execution flow 