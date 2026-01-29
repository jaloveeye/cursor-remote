# Cursor Remote 통신 프로토콜

## 개요

Cursor Remote는 WebSocket 기반 양방향 통신을 사용합니다. 모바일/웹 클라이언트와 Cursor Extension 간의 메시지 교환 규칙을 정의합니다.

## 아키텍처

### 로컬 모드

```
Mobile/Web App (Flutter)
    ↕ WebSocket (포트 8766)
Cursor Extension (TypeScript)
    ↕ Process
Cursor CLI (agent)
```

- 클라이언트가 Extension의 WebSocket 서버(8766)에 직접 연결합니다.
- PC 서버는 사용하지 않습니다.

### 릴레이 모드 (원격)

```
Mobile/Web App  ←→  Relay Server  ←→  Extension (RelayClient)
                        ↑
                   세션 ID로 연결
```

- 클라이언트가 릴레이 서버에 세션 생성 후 연결합니다.
- Extension의 RelayClient가 세션을 자동 감지하여 연결합니다.
- PC 서버는 사용하지 않습니다.

## 메시지 형식

모든 메시지는 JSON 형식입니다.

### 기본 구조

```json
{
  "type": "message_type",
  "id": "unique_message_id",
  "data": { ... },
  "success": true,
  "error": "error_message"
}
```

## 메시지 타입

### 클라이언트 → Extension

#### 1. `insert_text`

프롬프트에 텍스트를 삽입하고 실행합니다.

```json
{
  "type": "insert_text",
  "id": "1234567890",
  "text": "Hello, World!",
  "prompt": true,
  "execute": true,
  "newSession": false,
  "agentMode": "agent",
  "clientId": "optional-client-id"
}
```

**응답:**

```json
{
  "id": "1234567890",
  "type": "command_result",
  "success": true,
  "command_type": "insert_text"
}
```

#### 2. `get_chat_history`

대화 히스토리를 조회합니다.

```json
{
  "type": "get_chat_history",
  "id": "1234567891",
  "clientId": "optional",
  "sessionId": "optional",
  "limit": 50
}
```

#### 3. `get_session_info`

현재 세션 정보를 조회합니다.

```json
{
  "type": "get_session_info",
  "id": "1234567892",
  "clientId": "optional"
}
```

#### 4. `execute_command`

Cursor IDE 명령을 실행합니다.

```json
{
  "type": "execute_command",
  "id": "1234567893",
  "command": "workbench.action.files.save",
  "args": []
}
```

### Extension → 클라이언트

#### 1. `connected`

연결 성공 메시지

```json
{
  "type": "connected",
  "message": "Connected to Cursor Remote"
}
```

#### 2. `command_result`

명령 실행 결과

```json
{
  "id": "1234567890",
  "type": "command_result",
  "success": true,
  "command_type": "get_chat_history",
  "data": { ... }
}
```

#### 3. `chat_response`

CLI 응답 (AI 답변)

```json
{
  "type": "chat_response",
  "text": "안녕하세요! 무엇을 도와드릴까요?",
  "timestamp": "2026-01-28T06:00:00.000Z",
  "source": "cli",
  "sessionId": "uuid",
  "clientId": "relay-client"
}
```

#### 4. `log`

실시간 로그 (선택)

```json
{
  "type": "log",
  "level": "info",
  "message": "...",
  "timestamp": "...",
  "source": "extension"
}
```

## 연결 흐름

### 로컬 모드

1. Extension: WebSocket 서버 시작 (포트 8766)
2. 클라이언트: `ws://<PC_IP>:8766` 연결
3. 메시지: 클라이언트 ↔ Extension 직접 교환

### 릴레이 모드

1. Extension: RelayClient 시작, 세션 대기
2. 클라이언트: 릴레이 서버에 세션 생성 후 연결
3. Extension: 세션 자동 감지 후 연결
4. 메시지: 클라이언트 ↔ 릴레이 서버 ↔ Extension

## 포트 정보

| 포트 | 프로토콜 | 용도 |
|------|----------|------|
| 8766 | WebSocket | Extension WebSocket 서버 (로컬 모드 클라이언트 연결) |
| 8768 | HTTP | Extension 훅 서버 (Rules 기반 채팅 등) |

## 보안 고려사항

- 로컬 모드: 같은 네트워크 내에서만 사용 권장
- 릴레이 모드: HTTPS 릴레이 서버 경유
- 프로덕션에서는 인증·암호화 적용 권장
