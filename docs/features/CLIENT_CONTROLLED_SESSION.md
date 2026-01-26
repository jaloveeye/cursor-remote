# 클라이언트 제어 세션 관리

## 개요

세션 시작 여부를 클라이언트(모바일 앱)에서 결정하도록 변경했습니다. Extension은 클라이언트의 의도에 따라 동작합니다.

## 문제점

이전에는 Extension에서 "첫 프롬프트"인지 판단하여 세션을 관리했습니다:
- 세션이 없으면 `--continue` 없이 실행 (새 세션)
- 세션이 있으면 `--resume <session_id>` 사용 (기존 세션 재개)

하지만 "첫 프롬프트"라는 개념이 모호하고, 사용자가 명시적으로 새 대화를 시작하고 싶을 때 방법이 없었습니다.

## 해결 방법

클라이언트가 메시지에 `newSession` 플래그를 포함하여 세션 시작 여부를 결정합니다.

### 메시지 형식

```typescript
interface CommandMessage {
    // ... 기존 필드들
    newSession?: boolean; // 새 세션 시작 여부 (클라이언트에서 결정)
}
```

### 동작 방식

1. **`newSession: true`** (또는 명시적으로 true)
   - 기존 세션을 무시하고 완전히 새로운 세션 시작
   - `--continue` 또는 `--resume` 옵션 사용하지 않음

2. **`newSession: false`** 또는 **없음** (기본값)
   - 기존 세션이 있으면 `--resume <session_id>` 사용
   - 기존 세션이 없으면 새로 시작 (옵션 없이)

## UI 변경

모바일 앱에 "새 대화 시작" 버튼을 추가했습니다:

- **"Send to Prompt" 버튼**: 기존 세션 재개 (또는 새로 시작)
- **"새 대화 시작" 버튼**: 명시적으로 새 세션 시작

## 사용 시나리오

### 시나리오 1: 연속 대화
1. 사용자: "내 이름은 김형진입니다" (Send to Prompt)
2. 사용자: "내 이름이 뭐야?" (Send to Prompt)
3. **결과**: "김형진님이세요!" (이전 대화 기억) ✅

### 시나리오 2: 새 대화 시작
1. 사용자: "내 이름은 김형진입니다" (Send to Prompt)
2. 사용자: "내 이름이 뭐야?" (새 대화 시작 버튼)
3. **결과**: "이름을 알려주지 않았는데..." (새 세션) ✅

### 시나리오 3: 클라이언트별 독립 세션
1. 클라이언트 A: "내 이름은 김형진입니다" (Send to Prompt)
2. 클라이언트 B: "내 이름이 뭐야?" (Send to Prompt)
3. **결과**: "이름을 알려주지 않았는데..." (독립 세션) ✅

## 구현 세부사항

### Extension (TypeScript)

```typescript
// types.ts
export interface CommandMessage {
    // ...
    newSession?: boolean;
}

// cli-handler.ts
async sendPrompt(text: string, execute: boolean = true, clientId?: string, newSession: boolean = false) {
    if (newSession) {
        // 새 세션 시작 (기존 세션 무시)
        this.log(`Starting new session (client requested)`);
    } else {
        // 기존 세션 재개 시도
        const sessionId = clientId ? this.clientSessions.get(clientId) : this.lastChatId;
        if (sessionId) {
            args.push('--resume', sessionId);
        } else {
            // 세션이 없으면 새로 시작
        }
    }
}
```

### Mobile App (Flutter)

```dart
// 기본 전송 (기존 세션 재개)
_sendCommand('insert_text', text: text, prompt: true, execute: true, newSession: false);

// 새 대화 시작
_sendCommand('insert_text', text: text, prompt: true, execute: true, newSession: true);
```

## 장점

1. **명확한 제어**: 사용자가 명시적으로 새 대화를 시작할 수 있음
2. **유연성**: 클라이언트가 상황에 따라 세션을 관리할 수 있음
3. **직관적**: UI에서 "새 대화 시작" 버튼으로 명확하게 표현
4. **확장성**: 향후 다른 세션 관리 옵션 추가 가능

## 하위 호환성

- `newSession` 필드가 없으면 기본값 `false` 사용
- 기존 동작 유지 (기존 세션 재개)
