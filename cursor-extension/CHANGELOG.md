# Changelog

All notable changes to the "Cursor Remote" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-01-21

### Added
- Initial release of Cursor Remote extension
- WebSocket server for real-time communication with mobile devices
- HTTP REST API server for command execution
- Support for text insertion into Cursor editor
- Support for executing Cursor commands remotely
- AI chat response capture and forwarding
- Status bar indicator showing server status
- Auto-start option for the remote server
- Configurable port settings for WebSocket and HTTP servers
- CLI mode support for terminal-based interactions

### Features
- **Remote Control**: Control Cursor IDE from mobile devices
- **WebSocket Server**: Real-time bidirectional communication (default port: 8766)
- **HTTP API**: REST API for command execution (default port: 8767)
- **Chat Capture**: Capture and forward AI assistant responses
- **Rules Management**: Remote management of Cursor rules files

## [0.1.1] - 2026-01-21

### Fixed
- Fixed icon display issue in Marketplace
- Converted icon to proper PNG format (128x128px)

### Changed
- Updated icon to meet VS Code Extension Marketplace requirements

## [0.2.0] - 2026-01-28

### Added
- **Agent Mode Detection**: Automatic detection of appropriate agent mode (agent, ask, plan, debug) based on user prompt content
- **Chat History Enhancement**: Agent mode information is now saved and displayed in chat history entries
- **Mode Display Names**: User-friendly display names for agent modes (e.g., "Agent (코딩 작업)", "Ask (질문/학습)")

### Fixed
- Fixed TypeScript compilation error in `cli-handler.ts` (missing closing brace in `getChatHistory` method)
- Improved agent mode detection logic for "Plan" mode, specifically for phrases like "analyze project"

### Changed
- Enhanced chat history structure to include `agentMode` field
- Improved agent mode auto-detection algorithm with better keyword matching
- Updated chat history saving logic to properly store and update agent mode information

### Technical Details
- Added `detectAgentMode()` private method for intelligent mode selection
- Added `getModeDisplayName()` method for localized mode names
- Enhanced `ChatHistoryEntry` interface to include optional `agentMode` field
- Improved session management for chat history entries

## [0.3.0] - 2026-01-28

### Added
- **PC Server Session Auto-Connect**: PC Server can now automatically detect and connect to sessions created by mobile clients
- **Relay Server Session Discovery API**: New API endpoint `/api/sessions-waiting-for-pc` to find sessions waiting for PC connection
- **Session List Management**: Redis Set-based session list for efficient session discovery

### Changed
- **PC Server Workflow**: PC Server can now start without session ID and automatically connect when mobile client creates a session
- **Mobile Client**: Removed PC Server IP address requirement for relay mode connections
- **Session Discovery**: PC Server polls relay server every 10 seconds to discover new sessions

### Technical Details
- Added `findSessionsWaitingForPC()` function in relay server
- Implemented session list management in Redis
- Enhanced `pollMessages()` function to include session auto-discovery
- Improved `discoverSession()` function with rate limiting (10 seconds interval)

## [0.3.1] - 2026-01-28

### Changed
- **Extension-only architecture**: No separate PC server; Extension includes WebSocket server (8766) and RelayClient. All UI/copy updated from "PC Server" to "Extension".
- **CLI mode**: Cursor CLI accepts only `--mode plan` and `--mode ask`. Debug/agent modes no longer pass `--mode` to avoid CLI errors.
- **Status bar**: Shows "Connected" when a client is connected via local WebSocket or relay session (was "Waiting" until now in relay mode). Added `setOnSessionConnected` and status bar refresh on relay connect.
- **Status bar copy**: "Waiting" → "Ready (waiting for client)"; tooltip updated to "Extension WebSocket server".
- **Relay logs**: "waiting for mobile client session" → "waiting for mobile client to create session"; "Found session waiting for PC" → "Found session waiting for Extension".

### Fixed
- **CLI error visibility**: When CLI fails (e.g. invalid `--mode`), stderr is now sent to the user as `[CLI Error]` chat_response so the app does not stay without a response.
- **Debug mode**: Selecting Debug in the app no longer causes CLI to fail; Extension does not pass `--mode debug` to the CLI.

### Technical Details
- `RelayClient`: added `setOnSessionConnected(callback)`.
- `StatusBarManager`: added `setRelayClient()`, `refresh()`; status reflects both local clients and relay session.
- `cli-handler`: `cliMode` derived from `selectedMode` (debug → agent for CLI); stderr used as response when stdout is empty.

## [Unreleased]

### Planned
- Enhanced security with authentication tokens
- Multiple client support
- Connection history and logging
- Mobile app companion (iOS/Android)
