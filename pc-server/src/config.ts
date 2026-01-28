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
    
    // Connection retry configuration
    RECONNECT_DELAY: 3000,        // Initial retry delay (in milliseconds)
    RECONNECT_MAX_DELAY: 30000,   // Maximum retry delay (in milliseconds)
    RECONNECT_MAX_ATTEMPTS: 10,   // Maximum retry attempts (0 = infinite)
    RECONNECT_BACKOFF_MULTIPLIER: 1.5, // Exponential backoff multiplier
    
    // Device ID prefix
    DEVICE_ID_PREFIX: 'pc-',
} as const;
