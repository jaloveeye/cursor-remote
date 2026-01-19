# Cursor Remote 통신 프로토콜

## 개요

Cursor Remote는 WebSocket 기반 양방향 통신을 사용합니다. 모바일 앱, PC 서버, Cursor Extension 간의 메시지 교환 규칙을 정의합니다.

## 아키텍처

```
Mobile App (Flutter)
    ↕ WebSocket (포트 8766)
PC Server (Node.js)
    ↕ WebSocket (포트 8766)
Cursor Extension (TypeScript)
```

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

### 모바일 → Extension

#### 1. `insert_text`

에디터에 텍스트를 삽입합니다.

```json
{
  "type": "insert_text",
  "id": "1234567890",
  "text": "Hello, World!"
}
```

**응답:**

```json
{
  "id": "1234567890",
  "type": "command_result",
  "success": true,
  "message": "Text inserted"
}
```

#### 2. `execute_command`

Cursor IDE 명령을 실행합니다.

```json
{
  "type": "execute_command",
  "id": "1234567891",
  "command": "workbench.action.files.save",
  "args": []
}
```

**응답:**

```json
{
  "id": "1234567891",
  "type": "command_result",
  "success": true,
  "result": null
}
```

#### 3. `get_active_file`

현재 활성화된 파일 정보를 가져옵니다.

```json
{
  "type": "get_active_file",
  "id": "1234567892"
}
```

**응답:**

```json
{
  "id": "1234567892",
  "type": "command_result",
  "success": true,
  "path": "/path/to/file.ts",
  "content": "file content here..."
}
```

#### 4. `save_file`

현재 활성화된 파일을 저장합니다.

```json
{
  "type": "save_file",
  "id": "1234567893"
}
```

**응답:**

```json
{
  "id": "1234567893",
  "type": "command_result",
  "success": true,
  "path": "/path/to/file.ts"
}
```

#### 5. `get_ai_response`

Cursor AI 응답을 가져옵니다. (향후 구현)

```json
{
  "type": "get_ai_response",
  "id": "1234567894"
}
```

**응답:**

```json
{
  "id": "1234567894",
  "type": "command_result",
  "success": true,
  "data": "AI response text..."
}
```

### Extension → 모바일

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
  "result": { ... }
}
```

**에러 응답:**

```json
{
  "id": "1234567890",
  "type": "command_result",
  "success": false,
  "error": "Error message here"
}
```

#### 3. `error`

일반 에러 메시지

```json
{
  "type": "error",
  "message": "Error description"
}
```

## 에러 처리

### 에러 응답 형식

모든 명령은 다음 형식의 에러 응답을 반환할 수 있습니다:

```json
{
  "id": "message_id",
  "type": "command_result",
  "success": false,
  "error": "Error message"
}
```

### 일반적인 에러

- `No active editor`: 활성화된 에디터가 없음
- `Extension not available`: Extension이 연결되지 않음
- `Invalid message format`: 잘못된 메시지 형식
- `Unknown command type`: 알 수 없는 명령 타입

## 연결 흐름

1. **모바일 앱 시작**
   - PC 서버의 WebSocket 서버에 연결 (`ws://server_ip:8766`)

2. **PC 서버 시작**
   - WebSocket 서버 시작 (포트 8766)
   - Extension의 WebSocket 서버에 연결 시도 (`ws://localhost:8766`)

3. **Extension 시작**
   - WebSocket 서버 시작 (포트 8766)
   - PC 서버가 자동으로 연결

4. **메시지 전송**
   - 모바일 → PC 서버 → Extension
   - Extension → PC 서버 → 모바일

## 포트 정보

| 포트 | 프로토콜 | 용도 |
|------|----------|------|
| 8766 | WebSocket | 모바일 ↔ PC 서버 ↔ Extension |
| 8765 | HTTP | Extension ↔ PC 서버 (향후 확장용) |

## 보안 고려사항

- 현재는 로컬 네트워크에서만 사용 가능
- 프로덕션 환경에서는 TLS/SSL 암호화 필요
- 인증 메커니즘 추가 권장

## 예제

### 텍스트 삽입 예제

**요청:**

```json
{
  "type": "insert_text",
  "id": "1695123456789",
  "text": "console.log('Hello');"
}
```

**응답:**

```json
{
  "id": "1695123456789",
  "type": "command_result",
  "success": true,
  "message": "Text inserted"
}
```

### 파일 저장 예제

**요청:**

```json
{
  "type": "save_file",
  "id": "1695123456790"
}
```

**응답:**

```json
{
  "id": "1695123456790",
  "type": "command_result",
  "success": true,
  "path": "/Users/user/project/src/index.ts"
}
```

---

**작성 시간**: 2026년 1월 19일  
**수정 시간**: 2026년 1월 19일
