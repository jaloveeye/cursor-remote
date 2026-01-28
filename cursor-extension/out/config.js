"use strict";
/**
 * Configuration constants for Cursor Remote Extension
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONFIG = void 0;
exports.CONFIG = {
    // WebSocket server port
    WEBSOCKET_PORT: 8766,
    // HTTP server port (for hooks)
    HTTP_PORT: 8768,
    // Relay server URL
    RELAY_SERVER_URL: process.env.RELAY_SERVER_URL || 'https://relay.jaloveeye.com',
    // Port range for finding available ports
    PORT_SEARCH_MAX_ATTEMPTS: 10,
    // File paths
    CHAT_SUMMARY_FILE: '.cursor/CHAT_SUMMARY',
    RULES_DIR: '.cursor/rules',
    RULES_FILE: '.cursor/rules/after_each_chat.mdc',
    TERMINAL_OUTPUT_FILE: '.cursor-remote-terminal-output.log',
    // Polling intervals (in milliseconds)
    CHAT_POLLING_INTERVAL: 1000,
    CHAT_DEBOUNCE_DELAY: 300,
    // Timeouts (in milliseconds)
    TERMINAL_ACTIVATION_DELAY: 800,
    TERMINAL_FOCUS_DELAY: 500,
    TERMINAL_EXECUTION_DELAY: 500,
    CHAT_PANEL_OPEN_DELAY: 800,
    CHAT_TEXT_INSERT_DELAY: 300,
    CHAT_EXECUTE_DELAY: 1000,
    FILE_WATCH_DELAY: 100,
    // Content processing
    MIN_AI_RESPONSE_LENGTH: 50,
    CONTENT_HASH_LENGTH: 200,
    MAX_CONTENT_CHECK_LENGTH: 1000,
    // AI response patterns
    AI_RESPONSE_PATTERNS: [
        /^(Assistant|AI|Cursor|🤖|Bot):/i,
        /^#\s*(Assistant|AI|Response)/i,
        /```/ // Code block indicates AI response
    ],
    // Command patterns
    COMMAND_PATTERNS: [
        /^[a-z]+-[a-z]+/i, // kebab-case (e.g., gemini-cli, npm-install)
        /^[a-z]+\.[a-z]+/i, // dot notation (e.g., npm.test)
        /^[a-z]+:[a-z]+/i, // colon notation
    ],
    // Plain text patterns (not commands)
    PLAIN_TEXT_PATTERNS: [
        /^hello\s*$/i,
        /^hi\s*$/i,
        /^hey\s*$/i,
    ],
};
//# sourceMappingURL=config.js.map