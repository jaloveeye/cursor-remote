# 릴레이 서버 메시지 확인 방법

## 방법 1: Extension Output 채널 확인

Extension Output 채널에서 다음 메시지를 확인하세요:

1. **메시지 수신 확인**:
   - `📥 Received <count> message(s) from relay`
   - `📋 Messages: [{"id":"...","type":"...","from":"mobile"}]`

2. **메시지 처리 확인**:
   - `📨 Processing message: id=<id>, type=<type>, from=<from>`
   - `📤 Calling onMessageCallback with: <message>`
   - `✅ onMessageCallback completed`

3. **핸들러 호출 확인**:
   - `🔄 Calling triggerMessageHandlers...`
   - `Triggering <count> message handler(s) for relay message`
   - `Received command: <type> from client: relay-client (source: relay)`

## 방법 2: 릴레이 서버 API 직접 호출

터미널에서 다음 명령어로 확인:

```bash
# 세션 ID를 알고 있는 경우
curl "https://relay.jaloveeye.com/api/poll?sessionId=<SESSION_ID>&deviceType=pc"

# 예시
curl "https://relay.jaloveeye.com/api/poll?sessionId=Y6M8XV&deviceType=pc"
```

응답 예시:
```json
{
  "success": true,
  "data": {
    "messages": [
      {
        "id": "1769578090478-vz5w3sg",
        "type": "get_chat_history",
        "from": "mobile",
        "to": "pc",
        "data": {
          "type": "get_chat_history",
          "id": "1769578089203",
          "limit": 50
        },
        "timestamp": 1769578090479
      }
    ],
    "count": 1
  },
  "timestamp": 1769578120000
}
```

## 방법 3: 테스트 스크립트 사용

```bash
# 세션 ID를 인자로 전달
node test-relay-message.js <SESSION_ID>

# 예시
node test-relay-message.js Y6M8XV
```

## 문제 진단

### 메시지가 릴레이 서버에 없는 경우

1. **모바일 앱에서 메시지 전송 확인**:
   - 모바일 앱에서 "✅ Message sent to relay" 메시지 확인
   - 에러 메시지가 있는지 확인

2. **세션 연결 상태 확인**:
   - Extension Output에서 "✅ Connected to session: <sessionId>" 확인
   - 모바일 앱에서도 세션 연결 상태 확인

### 메시지가 릴레이 서버에 있지만 Extension이 받지 못하는 경우

1. **폴링 동작 확인**:
   - Extension Output에서 폴링 관련 로그 확인
   - 에러 메시지 확인

2. **세션 ID 확인**:
   - Extension이 연결한 세션 ID와 모바일 앱이 사용하는 세션 ID가 일치하는지 확인

3. **deviceType 확인**:
   - 모바일 앱이 `deviceType: 'mobile'`로 전송
   - Extension이 `deviceType: 'pc'`로 폴링
   - 릴레이 서버가 `to: 'pc'`로 메시지를 큐에 저장했는지 확인

## 작성 시간
2026-01-28
