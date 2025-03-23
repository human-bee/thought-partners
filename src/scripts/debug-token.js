/**
 * LiveKit Token Debugging Tool
 * 
 * Paste this in browser console when experiencing permission issues
 */

(function() {
  console.log('LiveKit Token Debugging Tool Started');
  
  // Check for room context
  const roomContext = window.__lk_room || null;
  
  // Log basic info
  console.log('Current room context:', roomContext ? 'Found' : 'Not found');
  
  if (roomContext) {
    // Basic room info
    console.log('Room info:', {
      name: roomContext.name,
      sid: roomContext.sid,
      connectionState: roomContext.state,
      isConnected: roomContext.isConnected,
      metadata: roomContext.metadata
    });
    
    // Participant info
    const localParticipant = roomContext.localParticipant;
    console.log('Local participant info:', {
      identity: localParticipant.identity,
      sid: localParticipant.sid,
      metadata: localParticipant.metadata
    });
    
    // Log permissions
    console.log('Token permissions:', localParticipant.permissions);
    
    // Check for critical permissions
    const hasVideoPermission = 
      localParticipant.permissions?.canPublish && 
      localParticipant.permissions?.canPublishVideo;
      
    const hasCameraAsSource = 
      localParticipant.permissions?.canPublishSources?.includes('camera');
    
    console.log('Permission check results:', {
      hasVideoPermission,
      hasCameraAsSource,
      allPermissions: localParticipant.permissions
    });
    
    // Analyze issues
    const issues = [];
    
    if (!localParticipant.permissions?.canPublish) {
      issues.push('Token missing canPublish permission');
    }
    
    if (!localParticipant.permissions?.canPublishVideo) {
      issues.push('Token missing canPublishVideo permission');
    }
    
    if (!hasCameraAsSource) {
      issues.push('Token missing camera as permitted source');
    }
    
    if (issues.length > 0) {
      console.error('Token permission issues found:', issues);
      
      // Suggest fix
      console.log('Attempting to fix token permission issues...');
      
      // Get current room and identity info
      const roomName = roomContext.name;
      const identity = localParticipant.identity;
      
      if (roomName && identity) {
        console.log(`Will try to refresh token for room=${roomName}, identity=${identity}`);
        
        // Store info for reconnection
        sessionStorage.setItem('livekit_needs_new_token', 'true');
        
        // Offer a command to get a new token with correct permissions
        console.log('Run this function to refresh the page with new token:');
        window.refreshLiveKitToken = function() {
          console.log('Refreshing page to get new token...');
          window.location.reload();
        };
        
        console.log('Call window.refreshLiveKitToken() to refresh');
      } else {
        console.error('Cannot fix: Missing room name or identity');
      }
    } else {
      console.log('No token permission issues found! The problem might be elsewhere.');
    }
    
    // Log available devices
    navigator.mediaDevices.enumerateDevices()
      .then(devices => {
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        const audioDevices = devices.filter(d => d.kind === 'audioinput');
        
        console.log('Available devices:', {
          video: videoDevices.map(d => ({ label: d.label, deviceId: d.deviceId })),
          audio: audioDevices.map(d => ({ label: d.label, deviceId: d.deviceId }))
        });
        
        if (videoDevices.length === 0) {
          console.warn('No video devices found! This could be causing camera issues.');
        }
      })
      .catch(err => {
        console.error('Error checking devices:', err);
      });
  } else {
    console.error('No LiveKit room context found. Make sure you are on a page with an active LiveKit connection.');
  }
})(); 