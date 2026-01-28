# 릴레이 모드 테스트 체크리스트

## 테스트 시나리오

### 1. Extension 활성화 확인
- [ ] Cursor IDE 시작 시 Extension 자동 활성화
- [ ] Output 채널에서 "Cursor Remote extension is now active!" 메시지 확인
- [ ] "✅ WebSocket server started on port 8766" 메시지 확인
- [ ] "✅ Relay client started - waiting for mobile client session..." 메시지 확인

### 2. 모바일 앱에서 세션 생성
- [ ] 모바일 앱에서 "릴레이 모드" 선택
- [ ] "새 세션 생성" 클릭
- [ ] 세션 ID 생성 확인
- [ ] "PC Server가 자동으로 이 세션을 감지하여 연결합니다 (최대 10초 소요)" 메시지 확인

### 3. Extension 세션 자동 감지 확인
- [ ] Extension Output 채널에서 다음 메시지 확인 (최대 10초 이내):
  - `🔍 Found session waiting for PC: <sessionId>`
  - `🔗 Connecting to session <sessionId>...`
  - `✅ Connected to session: <sessionId>`
  - `💡 Mobile client can now connect using session ID: <sessionId>`

### 4. 메시지 전송 테스트
- [ ] 모바일 앱에서 명령 전송 (예: "hello")
- [ ] Extension Output 채널에서 메시지 수신 확인:
  - `📥 Received 1 message(s) from relay`
  - `Received command: <type> from client: <clientId> (source: relay)`
- [ ] Cursor CLI 응답 확인
- [ ] 모바일 앱에서 응답 수신 확인

### 5. 양방향 통신 확인
- [ ] 모바일 → Extension: 명령 전송 및 응답 수신
- [ ] Extension → 모바일: 응답 전달 확인

## 문제 발생 시 확인 사항

### Extension이 세션을 감지하지 못하는 경우

1. **RelayClient 시작 확인**:
   - Output 채널에서 "Relay client started" 메시지 확인
   - 에러 메시지 확인

2. **네트워크 연결 확인**:
   - `https://relay.jaloveeye.com/api/health` 접근 가능한지 확인
   - 방화벽/프록시 설정 확인

3. **세션 생성 확인**:
   - 모바일 앱에서 세션이 실제로 생성되었는지 확인
   - 세션 ID가 올바르게 표시되는지 확인

4. **폴링 동작 확인**:
   - Extension이 2초마다 세션을 감지하려고 시도하는지 확인
   - Output 채널에서 폴링 관련 로그 확인

### 메시지가 전달되지 않는 경우

1. **세션 연결 상태 확인**:
   - Extension Output에서 "Connected to session" 메시지 확인
   - 모바일 앱에서도 세션 연결 상태 확인

2. **메시지 형식 확인**:
   - Extension Output에서 메시지 파싱 에러 확인
   - 메시지 형식이 올바른지 확인

3. **릴레이 서버 상태 확인**:
   - `/api/poll` API가 정상 동작하는지 확인
   - `/api/send` API가 정상 동작하는지 확인

## 예상 동작 흐름

```
1. Extension 활성화
   ↓
2. RelayClient 시작 (폴링 시작, 2초마다)
   ↓
3. 모바일 앱에서 세션 생성
   ↓
4. Extension이 세션 감지 (최대 10초)
   ↓
5. Extension이 세션에 자동 연결
   ↓
6. 모바일 앱에서 명령 전송
   ↓
7. 릴레이 서버를 통해 Extension으로 전달
   ↓
8. Extension이 Cursor CLI로 명령 실행
   ↓
9. 응답이 역순으로 전달되어 모바일 앱에 표시
```

## 로그 확인 위치

### Extension
- **Output 채널**: `View` → `Output` → "Cursor Remote" 선택
- 확인할 메시지:
  - Relay client 시작/연결 상태
  - 세션 감지 및 연결
  - 메시지 수신/전송

### 모바일 앱
- 앱 내 메시지 영역에서 시스템 메시지 확인
- 연결 상태 메시지 확인

## 작성 시간
2026-01-28
