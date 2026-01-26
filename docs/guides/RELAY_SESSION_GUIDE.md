# 릴레이 서버 세션 연결 가이드

PC 서버가 모바일 앱에서 생성한 세션 ID로 릴레이 서버에 연결하는 방법입니다.

## 방법 1: CLI 인자로 세션 ID 전달 (권장)

PC 서버를 시작할 때 세션 ID를 인자로 전달합니다:

```bash
cd pc-server
npm start <SESSION_ID>
```

**예시:**
```bash
npm start ABC123XYZ
```

서버가 시작되면 자동으로 해당 세션에 연결을 시도합니다.

## 방법 2: HTTP API로 세션 연결

서버가 이미 실행 중인 경우, HTTP API를 통해 세션에 연결할 수 있습니다:

```bash
curl -X POST http://localhost:8765/session/connect \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "ABC123XYZ"}'
```

**응답:**
```json
{
  "success": true,
  "sessionId": "ABC123XYZ",
  "isConnected": true
}
```

## 방법 3: 새 세션 생성 및 자동 연결

PC 서버에서 새 세션을 생성하고 자동으로 연결:

```bash
curl -X POST http://localhost:8765/session/create
```

**응답:**
```json
{
  "success": true,
  "sessionId": "NEW_SESSION_ID"
}
```

생성된 세션 ID를 모바일 앱에 입력하면 연결됩니다.

## 연결 흐름

### 모바일 앱에서 세션 생성하는 경우:

1. **모바일 앱**: 릴레이 서버에 새 세션 생성 → 세션 ID 받음 (예: `ABC123`)
2. **PC 서버**: 세션 ID로 연결
   ```bash
   npm start ABC123
   ```
   또는
   ```bash
   curl -X POST http://localhost:8765/session/connect \
     -H "Content-Type: application/json" \
     -d '{"sessionId": "ABC123"}'
   ```
3. **연결 확인**: 서버 로그에서 `✅ Connected to session: ABC123` 확인

### PC 서버에서 세션 생성하는 경우:

1. **PC 서버**: 새 세션 생성
   ```bash
   curl -X POST http://localhost:8765/session/create
   ```
2. **세션 ID 확인**: 응답에서 `sessionId` 확인 (예: `XYZ789`)
3. **모바일 앱**: 해당 세션 ID로 연결

## 연결 상태 확인

```bash
curl http://localhost:8765/status
```

**응답 예시:**
```json
{
  "relayServer": "https://relay.jaloveeye.com",
  "sessionId": "ABC123",
  "isConnected": true,
  "extensionConnected": true
}
```

## 연결 해제

```bash
curl -X POST http://localhost:8765/session/disconnect
```

## 주의사항

- 세션 ID는 대소문자를 구분합니다
- 세션이 만료되면 연결이 끊어질 수 있습니다
- 한 번에 하나의 세션에만 연결할 수 있습니다
- 새 세션에 연결하면 기존 세션 연결이 해제됩니다

## 문제 해결

### 연결 실패 시

1. **세션 ID 확인**: 모바일 앱에서 받은 세션 ID가 정확한지 확인
2. **릴레이 서버 확인**: `RELAY_SERVER_URL` 환경 변수 확인
3. **네트워크 확인**: 릴레이 서버에 접근 가능한지 확인
   ```bash
   curl https://relay.jaloveeye.com/api/status
   ```

### 로그 확인

서버 로그에서 다음 메시지를 확인:
- `✅ Connected to session: <SESSION_ID>` - 연결 성공
- `❌ Failed to connect: <error>` - 연결 실패
- `🔄 Starting message polling...` - 메시지 폴링 시작
