import { log } from './VideoLogger';

interface RoomInfo {
  roomName: string | null;
  identity: string | null;
}

/**
 * Stores room information in multiple persistent storage locations
 * for redundancy and recovery
 */
export const storeRoomInfo = (roomName: string, identity: string): void => {
  try {
    // Store in multiple places for redundancy
    // 1. Session Storage
    sessionStorage.setItem('livekit_room_name', roomName);
    sessionStorage.setItem('livekit_identity', identity);
    
    // 2. Local Storage as backup
    localStorage.setItem('livekit_room_name', roomName);
    localStorage.setItem('livekit_identity', identity);
    
    log.info(`Stored room info: room=${roomName}, identity=${identity}`);
  } catch (e) {
    log.warn('Failed to store room info:', e);
  }
};

/**
 * Enhanced retrieval function for room info that tries multiple sources
 */
export const getRoomInfo = (): RoomInfo => {
  try {
    let roomName = null;
    let identity = null;

    // 1. Try session storage first
    roomName = sessionStorage.getItem('livekit_room_name');
    identity = sessionStorage.getItem('livekit_identity');
    if (roomName && identity) {
      log.info('Got room info from session storage');
      return { roomName, identity };
    }

    // 2. Try local storage
    roomName = localStorage.getItem('livekit_room_name');
    identity = localStorage.getItem('livekit_identity');
    if (roomName && identity) {
      log.info('Got room info from local storage');
      return { roomName, identity };
    }

    // 3. Try URL for room name
    const urlParts = window.location.pathname.split('/');
    const lastPart = urlParts[urlParts.length - 1];
    if (lastPart && lastPart !== '') {
      roomName = lastPart;
      log.info('Got room name from URL:', roomName);
    }

    // 4. Try to recover from token if still no info
    const storedToken = sessionStorage.getItem('livekit_token');
    if (storedToken) {
      try {
        const tokenParts = storedToken.split('.');
        if (tokenParts.length === 3) {
          const payload = JSON.parse(atob(tokenParts[1]));
          if (payload.video?.room && payload.sub) {
            roomName = payload.video.room;
            identity = payload.sub;
            log.info('Recovered room info from token');
            // Store this for future use
            if (roomName && identity) {
              storeRoomInfo(roomName, identity);
            }
          }
        }
      } catch (e) {
        log.warn('Could not recover room info from token:', e);
      }
    }

    // If we have room name but no identity, generate a temporary one
    if (roomName && !identity) {
      identity = `user_${Math.floor(Math.random() * 10000)}`;
      log.info('Generated temporary identity:', identity);
    }

    return { roomName, identity };
  } catch (e) {
    log.warn('Failed to retrieve room info:', e);
    return { roomName: null, identity: null };
  }
};

/**
 * Attempts to extract and decode a stored LiveKit token
 */
export const getTokenInfo = (): { room?: string, identity?: string } => {
  try {
    const storedToken = sessionStorage.getItem('livekit_token');
    if (storedToken) {
      const tokenParts = storedToken.split('.');
      if (tokenParts.length === 3) {
        const payload = JSON.parse(atob(tokenParts[1]));
        return {
          room: payload.video?.room,
          identity: payload.sub
        };
      }
    }
    return {};
  } catch (e) {
    log.warn('Failed to decode token:', e);
    return {};
  }
}; 