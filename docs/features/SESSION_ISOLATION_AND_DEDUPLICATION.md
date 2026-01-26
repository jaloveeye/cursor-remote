# 세션 격리 및 중복 응답 방지

## 문제 정의

### 문제 1: 중복 응답
- CHAT_SUMMARY 파일을 통해 응답 전달 (hook 방식)
- stdout을 통해 응답 전달 (CLI 직접 출력)
- 두 경로 모두에서 같은 응답이 전달되어 중복 발생

### 문제 2: 세션 격리 부재
- `session_id`가 전역적으로 유지됨
- 다른 클라이언트가 접속해도 같은 대화를 볼 수 있음
- 보안/프라이버시 문제

## 해결 방안

### 1. 중복 응답 방지

**구현 방법**:
- 응답 텍스트 해시 생성
- 이전 응답과 동일한 해시면 전송하지 않음
- CHAT_SUMMARY hook이 먼저 전송했을 가능성 고려

**코드**:
```typescript
// 중복 응답 방지: 응답 텍스트 해시 생성
const responseHash = this.hashString(responseText);
if (this.lastResponseHash === responseHash) {
    this.log('⚠️ Duplicate response detected, skipping WebSocket send');
    return; // 중복 응답이면 전송하지 않음
}
this.lastResponseHash = responseHash;
```

### 2. 클라이언트별 세션 격리

**구현 방법**:
- WebSocket 연결 시 고유한 `clientId` 생성
- 각 클라이언트별로 독립적인 `session_id` 관리
- `clientSessions` Map으로 클라이언트별 세션 저장

**코드**:
```typescript
// WebSocket 연결 시 clientId 생성
const clientId = `client-${Date.now()}-${Math.random().toString(36).substring(7)}`;
(ws as any).clientId = clientId;

// 메시지에 clientId 추가
parsed.clientId = clientId;

// 클라이언트별 세션 관리
if (clientId) {
    sessionId = this.clientSessions.get(clientId) || null;
    if (extractedSessionId) {
        this.clientSessions.set(clientId, extractedSessionId);
    }
}
```

## 동작 흐름

### 클라이언트 A
1. 연결 → `clientId: client-1234567890-abc`
2. 첫 프롬프트 → `--continue` → `session_id: session-A`
3. `clientSessions.set('client-1234567890-abc', 'session-A')`
4. 두 번째 프롬프트 → `--resume session-A` → 이전 대화 유지

### 클라이언트 B
1. 연결 → `clientId: client-1234567891-def`
2. 첫 프롬프트 → `--continue` → `session_id: session-B` (독립적!)
3. `clientSessions.set('client-1234567891-def', 'session-B')`
4. 클라이언트 A의 대화를 볼 수 없음 ✅

## 보안 개선

- 각 클라이언트가 독립적인 대화 세션을 가짐
- 다른 클라이언트의 대화 내용에 접근 불가
- 프라이버시 보호

## 하위 호환성

- `clientId`가 없는 경우 전역 세션 사용
- 기존 동작 유지
