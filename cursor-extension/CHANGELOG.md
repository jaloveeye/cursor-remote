# Changelog

All notable changes to the "Cursor Remote" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.7] - 2026-02-03

### Added
- **Extension-first 연결 강제**: 익스텐션이 먼저 릴레이에 연결되어 있어야만 모바일이 해당 세션에 접속 가능
- **모바일 UX 개선**: PIN 오류 시 알럿 표시, 최근 연결 삭제·재연결 기능 개선

### Changed
- **재연결 아이콘**: ethernet 아이콘으로 변경하여 직관성 향상
- **PIN 다이얼로그**: 엔터 키로 확인 가능하도록 개선

### Technical Details
- `connect.ts`: `pcConnected` 플래그 확인 로직 추가, PC 미연결 시 403 반환
- `mobile-app`: PIN 검증 실패 시 사용자 알럿, 연결 히스토리 관리 개선

## [0.3.6] - 2026-02-02

### Added
- **Session ID 입력/저장**: 익스텐션 시작 시 6자리 세션 ID 입력 프롬프트, globalState에 저장하여 재사용
- **PC 먼저 연결 가능**: PC가 세션 ID를 입력하면 해당 ID로 세션 생성/연결 (모바일이 나중에 같은 ID로 접속)
- **Heartbeat**: PC가 30초마다 heartbeat 전송, 2분간 없으면 연결 끊김으로 간주 (세션 해제)
- **세션 충돌 방지**: 같은 세션 ID를 다른 PC에서 사용 시 409 에러 반환
- **PIN 보안 (선택)**: PC가 PIN 설정 시 모바일은 해당 PIN을 알아야만 접속 가능
- **새 명령어**: `세션 ID로 릴레이 연결`, `릴레이 세션 ID 설정`, `릴레이 서버 상태 확인`

### Changed
- **세션 탐색 API 변경**: `sessions-waiting-for-pc` → `sessions-with-mobile` (모바일이 연결된 세션만 탐색)
- **세션 ID 정규화**: 대문자로 정규화하여 PC/모바일 동일 키 매칭
- **세션 연속성**: 24시간 TTL 내에서 같은 세션 ID로 재접속 가능

### Technical Details
- `relay-client.ts`: `start(sessionId, pin?)` 시그니처 변경, heartbeat interval 추가
- `relay-client.ts`: `httpRequestWithStatus()` 메서드 추가 (404/409 상태 코드 구분)
- `connect.ts`: PC 연결 시 세션 자동 생성, PIN 해시 저장/검증, pcLastSeenAt 기반 중복 체크
- `heartbeat.ts`: 새 API 엔드포인트 추가 (pcLastSeenAt 갱신)
- `types.ts`: Session 인터페이스에 `pcLastSeenAt`, `pcPinHash` 필드 추가

## [0.3.5] - 2026-02-02

### Changed
- **Relay response: broadcast again (0.3.3 동작 복귀)**  
  유니캐스트(0.3.4)에서 응답이 일부 환경에서 오지 않는 문제가 있어, 릴레이 모드 응답을 **브로드캐스트**로 되돌렸습니다.  
  동일 세션의 모든 모바일 클라이언트가 응답을 받습니다.

### Fixed
- 릴레이 모드에서 프롬프트 입력 후 응답이 오지 않던 현상 수정 (브로드캐스트 복귀로 해결)

### Technical Details
- Extension: 릴레이 메시지 전달 시 `senderDeviceId` 병합 제거 (유니캐스트 경로 비활성화)
- Relay server: PC→Mobile 시 항상 모든 디바이스 큐 + 레거시 큐에 전송

## [0.3.4] - 2026-02-02

### Added
- **Unicast Response Support**: Responses are now sent only to the client that made the request (not broadcast to all)
- **Multi-client Session Support**: Multiple mobile clients can connect to the same relay session
- Each client receives only responses to their own requests

### Technical Details
- Added `senderDeviceId` tracking in CLI handler
- Added `targetDeviceId` to chat_response messages
- Relay server routes responses to specific client queues based on targetDeviceId

## [0.3.3] - 2026-01-30

### Fixed
- Minor bug fixes and stability improvements

## [0.3.2] - 2026-01-30

### Added
- **Real-time Log Display**: Important CLI logs (agent mode, command execution, AI response) are now sent to mobile clients in real-time
- **Broadcast Method**: Added `broadcast()` method to WebSocketServer for sending messages to all clients including relay

### Changed
- **Log Transmission**: Key operational logs are now transmitted to clients with `sendToClient` flag
- **Relay Log Support**: Log messages are now also sent to relay server when connected

### Fixed
- IME duplicate character handling in relay mode
- Streaming buffer cleanup on process termination

### Technical Details
- `cli-handler.ts`: Added `sendToClient` parameter to `log()` and `logError()` methods
- `websocket-server.ts`: Added `broadcast()` method that sends to both local WebSocket clients and relay server
- Important logs marked with `sendToClient: true`: Agent mode selection, CLI execution start, AI response received

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

## [0.1.1] - 2026-01-21

### Fixed
- Fixed icon display issue in Marketplace
- Converted icon to proper PNG format (128x128px)

### Changed
- Updated icon to meet VS Code Extension Marketplace requirements

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

## [Unreleased]

### Planned
- Enhanced security with authentication tokens
- Connection history and logging
