# 첫 프롬프트에서 이전 세션 재개 문제

## 문제

첫 번째 프롬프트에서도 이전 대화 기록이 남아있습니다.
- 사용자가 "내 이름이 뭐야"로 시작했는데, AI가 이름을 알고 있었음
- 이름을 알려주지 않았는데도 이전 대화를 기억하고 있음

## 원인

`--continue` 옵션이 이전 세션을 재개하고 있습니다.

### 현재 코드
```typescript
if (sessionId) {
    args.push('--resume', sessionId);
} else {
    // 첫 번째 프롬프트는 --continue로 시작
    args.push('--continue'); // ❌ 문제: 이전 세션을 재개함
}
```

### Cursor CLI의 `--continue` 동작
- `--continue`: 이전 대화 컨텍스트를 유지하고 세션을 재개
- 첫 프롬프트에서도 `--continue`를 사용하면 이전 대화를 기억함

## 해결 방법

첫 번째 프롬프트에서는 `--continue` 옵션을 사용하지 않습니다.

### 수정된 코드
```typescript
if (sessionId) {
    args.push('--resume', sessionId);
    this.log(`Resuming chat session for client ${clientId || 'global'}: ${sessionId}`);
} else {
    // 첫 번째 프롬프트는 --continue 없이 시작 (완전히 새로운 세션 생성)
    // --continue는 이전 세션을 재개하므로, 첫 프롬프트에서는 사용하지 않음
    this.log(`Starting completely new chat session for client ${clientId || 'global'} (no --continue)`);
}
```

## 동작 방식

### 첫 번째 프롬프트 (새 클라이언트)
1. `clientId`에 대한 세션이 없음
2. `--continue` 옵션 없이 실행
3. Cursor CLI가 새로운 세션 생성
4. 응답에서 `session_id` 추출
5. `clientSessions.set(clientId, session_id)` 저장

### 두 번째 프롬프트 (같은 클라이언트)
1. `clientId`에 대한 세션이 있음
2. `--resume <session_id>` 옵션 사용
3. 이전 대화 컨텍스트 유지

### 다른 클라이언트의 첫 프롬프트
1. 다른 `clientId`에 대한 세션이 없음
2. `--continue` 옵션 없이 실행
3. 완전히 새로운 세션 생성 (다른 클라이언트의 대화와 격리)

## 테스트 시나리오

### 시나리오 1: 새 클라이언트 첫 프롬프트
1. 클라이언트 A 연결
2. 첫 프롬프트: "내 이름이 뭐야"
3. **예상 결과**: "이름을 알려주지 않았는데 어떻게 알 수 있나요?" 또는 비슷한 응답
4. **이전 결과**: "김형진님이세요!" (이전 세션 재개) ❌

### 시나리오 2: 같은 클라이언트 연속 대화
1. 클라이언트 A: "내 이름은 김형진입니다"
2. 클라이언트 A: "내 이름이 뭐야"
3. **예상 결과**: "김형진님이세요!" ✅

### 시나리오 3: 다른 클라이언트 독립 세션
1. 클라이언트 A: "내 이름은 김형진입니다"
2. 클라이언트 B 연결
3. 클라이언트 B: "내 이름이 뭐야"
4. **예상 결과**: "이름을 알려주지 않았는데..." (독립 세션) ✅

## 로그 확인

### 수정 전 (문제)
```
Starting new chat session for client client-123
Executing: agent --continue --output-format json --force 내 이름이 뭐야
```
- `--continue` 옵션이 있어서 이전 세션 재개 ❌

### 수정 후 (정상)
```
Starting completely new chat session for client client-123 (no --continue)
Executing: agent --output-format json --force 내 이름이 뭐야
```
- `--continue` 옵션이 없어서 새로운 세션 생성 ✅

## 추가 고려사항

### Cursor CLI의 기본 동작
- 옵션 없이 실행하면 새로운 세션 생성
- `--continue`는 이전 세션 재개
- `--resume <session_id>`는 특정 세션 재개

### 세션 격리
- 각 클라이언트마다 독립적인 세션
- 첫 프롬프트에서 `--continue` 없이 실행하여 완전히 새로운 세션 보장
