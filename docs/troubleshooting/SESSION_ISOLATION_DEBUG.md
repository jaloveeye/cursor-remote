# 세션 격리 디버깅 가이드

## 문제
두 개의 클라이언트가 같은 세션을 공유하고 있습니다.

## 원인 분석

### 가능한 원인들
1. **clientId가 전달되지 않음**: WebSocket 메시지에 `clientId`가 포함되지 않았을 수 있음
2. **전역 세션 사용**: `clientId`가 없을 때 `lastChatId`를 사용하여 전역 세션 공유
3. **실시간 session_id 추출**: `stdout.on('data')`에서 전역 `lastChatId`에 저장하는 문제

## 디버깅 로그 확인

### 1. 클라이언트 연결 확인
```
Client connected to Cursor Remote (ID: client-...)
```
- 각 클라이언트마다 고유한 ID가 생성되어야 함

### 2. 프롬프트 전송 시 clientId 확인
```
[CLI] sendPrompt called - textLength: ..., clientId: client-...
🔑 Using clientId: client-... for this prompt
```
- `clientId: none`이면 문제!
- `clientId: client-...`이어야 함

### 3. 세션 저장 확인
```
💾 Saved session ID for client client-...: session-...
💾 Total clients with sessions: 2
   - Client client-123: Session session-A
   - Client client-456: Session session-B
```
- 각 클라이언트마다 다른 세션이 저장되어야 함

### 4. 세션 재개 확인
```
🔑 Found existing session for client client-...: session-...
Resuming chat session for client client-...: session-...
```
- 각 클라이언트가 자신의 세션을 재개해야 함

## 해결 방법

### 1. clientId가 전달되지 않는 경우
- WebSocket 메시지 파싱 확인
- `command.clientId`가 `undefined`인지 확인
- 로그에서 "clientId: none"이 나오면 문제

### 2. 전역 세션 사용 문제
- `clientId`가 없을 때 경고 로그 출력
- 가능하면 항상 `clientId`를 제공하도록 수정

### 3. 실시간 session_id 추출 문제
- `stdout.on('data')`에서 전역 `lastChatId`에 저장하지 않음
- 클라이언트별 세션은 `checkAndProcessOutput`에서만 저장

## 테스트 시나리오

### 시나리오 1: 두 클라이언트 독립 세션
1. 클라이언트 A 연결 → `client-A`
2. 클라이언트 A: "내 이름은 김형진입니다" → `session-A` 생성
3. 클라이언트 B 연결 → `client-B`
4. 클라이언트 B: "내 이름이 뭐라고?" → `session-B` 생성 (독립적)
5. **예상 결과**: 클라이언트 B는 "모르겠습니다" 또는 비슷한 응답

### 시나리오 2: 같은 클라이언트 연속 대화
1. 클라이언트 A: "내 이름은 김형진입니다" → `session-A` 생성
2. 클라이언트 A: "내 이름이 뭐라고?" → `session-A` 재개
3. **예상 결과**: "김형진님이세요!"

## 로그 예시

### 정상 작동 (클라이언트별 세션)
```
Client connected to Cursor Remote (ID: client-1234567890-abc)
[CLI] sendPrompt called - textLength: 10, clientId: client-1234567890-abc
🔑 Using clientId: client-1234567890-abc for this prompt
🔑 No existing session for client client-1234567890-abc, will create new session
Starting new chat session for client client-1234567890-abc
💾 Saved session ID for client client-1234567890-abc: session-A
💾 Total clients with sessions: 1
   - Client client-1234567890-abc: Session session-A

Client connected to Cursor Remote (ID: client-1234567891-def)
[CLI] sendPrompt called - textLength: 10, clientId: client-1234567891-def
🔑 Using clientId: client-1234567891-def for this prompt
🔑 No existing session for client client-1234567891-def, will create new session
Starting new chat session for client client-1234567891-def
💾 Saved session ID for client client-1234567891-def: session-B
💾 Total clients with sessions: 2
   - Client client-1234567890-abc: Session session-A
   - Client client-1234567891-def: Session session-B
```

### 문제 발생 (전역 세션 공유)
```
[CLI] sendPrompt called - textLength: 10, clientId: none
⚠️ No clientId provided, using global session (lastChatId: session-A)
Starting new chat session for client global
💾 Saved global session ID: session-A
```

## 추가 확인 사항

1. **WebSocket 연결이 제대로 유지되는지**
   - 클라이언트가 재연결되면 새로운 `clientId`가 생성됨
   - 이전 세션 정보가 유지되지 않을 수 있음

2. **Cursor CLI의 --continue 동작**
   - `--continue`가 항상 새로운 세션을 생성하는지 확인
   - `--resume <session_id>`가 올바른 세션을 재개하는지 확인

3. **세션 ID 추출 타이밍**
   - 첫 번째 프롬프트에서 `session_id`가 제대로 추출되는지
   - 두 번째 프롬프트에서 `--resume`이 올바른 `session_id`와 함께 사용되는지
