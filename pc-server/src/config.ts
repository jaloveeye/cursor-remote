/**
 * Configuration constants for Cursor Remote PC Server
 */

export const CONFIG = {
    // Relay server URL
    RELAY_SERVER_URL: process.env.RELAY_SERVER_URL || 'https://relay.jaloveeye.com',
    
    // WebSocket ports
    EXTENSION_WS_PORT: 8766, // Extension WebSocket server port
    LOCAL_WS_PORT: 8767,    // Local mobile app WebSocket port
    
    // HTTP server port
    HTTP_PORT: 8765,
    
    // Polling interval (in milliseconds)
    POLL_INTERVAL: 2000,
    
    // Connection retry delay (in milliseconds)
    RECONNECT_DELAY: 3000,
    
    // Device ID prefix
    DEVICE_ID_PREFIX: 'pc-',
} as const;
