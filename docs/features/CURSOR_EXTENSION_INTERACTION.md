# Cursor Extension IDE 상호작용 분석

## 개요

Cursor Remote Extension은 VS Code Extension API를 통해 Cursor IDE와 상호작용합니다. 이 문서는 텍스트 입력, Enter 키 시뮬레이션, AI 응답 캡처 방식에 대한 상세 분석입니다.

**작성 시간**: 2024-12-19

---

## 1. 텍스트 입력 방식

### 1.1 채팅 패널 열기

```typescript
// command-handler.ts:214-225
await vscode.commands.executeCommand('workbench.action.chat.open');
await new Promise(resolve => setTimeout(resolve, 800));
```

**방식**: VS Code 명령어 API 사용

- `workbench.action.chat.open`: 채팅 패널을 열거나 포커스를 맞춤
- 800ms 대기: 채팅 패널이 완전히 열릴 때까지 대기

### 1.2 텍스트 입력 방법 (2단계 Fallback)

#### 방법 1: 클립보드 붙여넣기 (우선순위 1)

```typescript
// command-handler.ts:230-241
await vscode.env.clipboard.writeText(text);
await new Promise(resolve => setTimeout(resolve, 200));
await vscode.commands.executeCommand('editor.action.clipboardPasteAction');
await new Promise(resolve => setTimeout(resolve, 300));
```

**작동 원리**:

1. 클립보드에 텍스트 복사
2. 200ms 대기 (클립보드 동기화)
3. 붙여넣기 명령 실행
4. 300ms 대기 (입력 완료 대기)

**장점**: 긴 텍스트도 빠르게 입력 가능
**단점**: 클립보드 내용이 덮어씌워짐

#### 방법 2: Type 명령 (Fallback, 짧은 텍스트만)

```typescript
// command-handler.ts:243-261
if (text.length < 100) {
    await vscode.commands.executeCommand('type', { text: text });
    await new Promise(resolve => setTimeout(resolve, 300));
}
```

**작동 원리**:

- VS Code의 `type` 명령어로 직접 입력
- 100자 이하 텍스트만 지원 (성능 고려)

**장점**: 클립보드를 사용하지 않음
**단점**: 긴 텍스트는 느림

---

## 2. Enter 키 시뮬레이션 (프롬프트 실행)

### 2.1 전체 흐름

```typescript
// command-handler.ts:268-333
if (execute) {
    // 1. 텍스트 입력 완료 대기
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 2. 채팅 입력창에 포커스 재설정
    await vscode.commands.executeCommand('workbench.action.chat.open');
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // 3. 명령어 기반 실행 시도 (우선순위 1)
    // 4. Enter 키 시뮬레이션 (우선순위 2)
}
```

### 2.2 우선순위 1: Cursor IDE 명령어 시도

```typescript
// command-handler.ts:285-309
const executeCommands = [
    'cursor.chat.submit',        // Cursor IDE 전용
    'cursor.chat.send',          // Cursor IDE 전용
    'anysphere.chat.submit',     // Cursor 내부 명령어
    'anysphere.chat.send',       // Cursor 내부 명령어
    'workbench.action.chat.submit',  // VS Code 표준
    'workbench.action.chat.send',    // VS Code 표준
    'workbench.action.chat.acceptInput', // VS Code 표준
];

for (const cmd of executeCommands) {
    try {
        await vscode.commands.executeCommand(cmd);
        executed = true;
        break; // 성공하면 중단
    } catch (e) {
        continue; // 실패하면 다음 명령어 시도
    }
}
```

**작동 원리**:

- Cursor IDE 전용 명령어부터 시도
- 실패 시 VS Code 표준 명령어로 Fallback
- 첫 번째 성공한 명령어에서 중단

**문제점**:

- Cursor IDE의 채팅 입력창이 웹뷰일 수 있어 명령어가 작동하지 않을 수 있음
- 명령어가 존재하지 않으면 에러 발생 (try-catch로 처리)

### 2.3 우선순위 2: Enter 키 시뮬레이션

```typescript
// command-handler.ts:311-325
if (!executed) {
    try {
        // Enter 키를 type 명령으로 시뮬레이션
        await vscode.commands.executeCommand('type', { text: '\n' });
        await new Promise(resolve => setTimeout(resolve, 200));
        // 두 번째 시도 (일부 경우 필요)
        await vscode.commands.executeCommand('type', { text: '\n' });
        executed = true;
    } catch (e) {
        // 실패 처리
    }
}
```

**작동 원리**:

- `type` 명령어로 줄바꿈 문자(`\n`) 전송
- Enter 키를 두 번 시도 (일부 경우 필요)

**제한사항**:

- 채팅 입력창에 포커스가 있어야 함
- 웹뷰 기반 입력창은 반응하지 않을 수 있음

---

## 3. AI 응답 캡처 방식

현재 시스템은 **3가지 방식**을 병행하여 AI 응답을 캡처합니다:

### 3.1 방식 1: Rules 기반 파일 감시 (우선순위 1)

#### 3.1.1 Rules 파일 생성

```typescript
// extension.ts:488-557
const rulesFile = path.join(workspaceRoot, '.cursor', 'rules', 'after_each_chat.mdc');
```

**Rules 파일 내용**:

- AI에게 매 응답 후 `.cursor/CHAT_SUMMARY` JSON 파일을 생성하도록 지시
- 파일 형식: `{ "timestamp": "...", "text": "...", "summary": "..." }`

#### 3.1.2 파일 감시

```typescript
// extension.ts:663-737
const pattern = new vscode.RelativePattern(cursorDir, 'CHAT_SUMMARY');
const watcher = vscode.workspace.createFileSystemWatcher(pattern);

watcher.onDidCreate(safeRead);
watcher.onDidChange(safeRead);
```

**작동 원리**:

1. `.cursor/CHAT_SUMMARY` 파일 생성/변경 감지
2. 100ms 지연 (파일 쓰기 완료 대기)
3. JSON 파싱하여 `text` 필드 추출
4. WebSocket으로 클라이언트에 전송

**장점**:

- AI가 직접 파일을 생성하므로 정확함
- Rules 파일이 작동하면 가장 신뢰할 수 있음

**단점**:

- AI가 Rules를 따르지 않으면 작동하지 않음
- 파일 I/O 오버헤드

### 3.2 방식 2: HTTP Hook 기반 캡처 (우선순위 2)

#### 3.2.1 HTTP 서버 시작

```typescript
// extension.ts:771-864
httpServer = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/hook') {
        // JSON 데이터 수신
        const data = JSON.parse(body);
        // WebSocket으로 전송
        wsServer.sendFromHook(data);
    }
});
```

**작동 원리**:

1. 로컬 HTTP 서버 시작 (포트 8768)
2. `hooks.json`에 `afterAgentResponse` 이벤트 등록
3. AI 응답 후 hook 스크립트가 HTTP POST로 데이터 전송
4. Extension이 수신하여 WebSocket으로 전달

**hooks.json 설정**:

```json
{
  "hooks": [{
    "event": "afterAgentResponse",
    "command": "node",
    "args": [".cursor/hook-debug.js"],
    "env": { "CURSOR_REMOTE_HTTP_PORT": "8768" }
  }]
}
```

**장점**:

- 실시간 캡처 가능
- Cursor IDE의 공식 Hook 시스템 사용

**단점**:

- `hook-debug.js` 스크립트가 필요
- Hook이 작동하지 않을 수 있음

### 3.3 방식 3: 문서 모니터링 (백업)

#### 3.3.1 문서 변경 감지

```typescript
// extension.ts:344-363
const documentChangeListener = vscode.workspace.onDidChangeTextDocument((event) => {
    if (newContent.length > lastChatContent.length) {
        const addedContent = newContent.substring(lastChatContent.length);
        processNewChatContent(addedContent, newContent);
    }
});
```

#### 3.3.2 폴링 방식

```typescript
// extension.ts:366-411
chatDocumentMonitorInterval = setInterval(() => {
    const currentContent = document.getText();
    if (currentContent.length > lastChatContent.length) {
        const newContent = currentContent.substring(lastChatContent.length);
        processNewChatContent(newContent, currentContent);
    }
}, 500); // 0.5초마다 확인
```

#### 3.3.3 AI 응답 패턴 인식

```typescript
// extension.ts:413-485
const patterns = [
    /^(Assistant|AI|Cursor|🤖|Bot):/i,
    /^#\s*(Assistant|AI|Response)/i,
    /```/ // 코드 블록
];

// 마지막에서부터 패턴 검색
for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].match(pattern)) {
        aiResponseStart = i;
        break;
    }
}

// 패턴을 찾지 못했지만 새 내용이 충분히 크면 AI 응답으로 간주
if (aiResponseStart < 0 && newContent.length > 100) {
    // 마지막 큰 블록을 AI 응답으로 간주
}
```

**작동 원리**:

1. 활성 에디터 변경 감지
2. 문서 내용 변경 감지
3. 0.5초마다 폴링하여 새 내용 확인
4. 패턴 매칭 또는 휴리스틱으로 AI 응답 추출

**장점**:

- Rules나 Hook이 작동하지 않아도 백업으로 작동
- 실시간 문서 변경 감지

**단점**:

- 패턴 매칭이 부정확할 수 있음
- 폴링 오버헤드
- 사용자 입력과 AI 응답 구분이 어려울 수 있음

---

## 4. 현재 문제점 및 제한사항

### 4.1 텍스트 입력

✅ **작동하는 부분**:

- 클립보드 붙여넣기: 대부분의 경우 작동
- 채팅 패널 열기: 정상 작동

⚠️ **문제점**:

- 채팅 입력창이 웹뷰일 경우 `type` 명령이 작동하지 않을 수 있음
- 포커스 관리가 어려움 (입력 후 포커스가 이동할 수 있음)

### 4.2 Enter 키 시뮬레이션

✅ **작동하는 부분**:

- Cursor IDE 명령어가 존재하고 작동하는 경우

❌ **문제점**:

- Cursor IDE의 채팅 입력창이 웹뷰 기반일 경우 VS Code Extension API로 제어 불가
- 명령어가 존재하지 않거나 작동하지 않을 수 있음
- Enter 키 시뮬레이션이 실제 Enter 키 입력과 다를 수 있음

**해결 방안**:

- Cursor IDE의 공식 API 확인 필요
- 또는 사용자에게 수동 Enter 키 입력 안내

### 4.3 AI 응답 캡처

✅ **작동하는 부분**:

- Rules 기반 파일 감시: Rules가 작동하면 가장 정확
- HTTP Hook: Hook이 작동하면 실시간 캡처 가능

⚠️ **문제점**:

- Rules 파일이 AI에 의해 무시될 수 있음
- Hook 스크립트가 없거나 작동하지 않을 수 있음
- 문서 모니터링은 패턴 매칭이 부정확할 수 있음

**현재 상태**:

- 3가지 방식을 모두 활성화하여 최대한 캡처 시도
- 하나라도 작동하면 AI 응답을 받을 수 있음

---

## 5. 개선 제안

### 5.1 텍스트 입력 개선

1. **키보드 이벤트 직접 시뮬레이션** (제한적)
   - VS Code Extension API로는 직접 키보드 이벤트 시뮬레이션 불가
   - Native 모듈 필요 (복잡도 증가)

2. **더 긴 대기 시간**
   - 채팅 패널이 완전히 로드될 때까지 대기 시간 증가

3. **재시도 로직**
   - 텍스트 입력 실패 시 자동 재시도

### 5.2 Enter 키 시뮬레이션 개선

1. **Cursor IDE API 확인**
   - Cursor IDE의 공식 Extension API 문서 확인
   - 채팅 제출을 위한 전용 API 존재 여부 확인

2. **사용자 피드백**
   - 자동 실행 실패 시 사용자에게 명확한 안내
   - 수동 Enter 키 입력 유도

3. **대안 방법**
   - 채팅 히스토리에서 최근 메시지 확인
   - AI 응답 시작을 감지하여 자동 실행 확인

### 5.3 AI 응답 캡처 개선

1. **Rules 파일 강화**
   - 더 명확하고 강제적인 Rules 작성
   - AI가 무시하기 어려운 형식

2. **Hook 스크립트 개선**
   - `hook-debug.js` 스크립트 안정성 향상
   - 에러 처리 강화

3. **패턴 매칭 개선**
   - 더 정확한 AI 응답 패턴 인식
   - 머신러닝 기반 분류 (복잡도 증가)

---

## 6. 참고 자료

- [VS Code Extension API - Commands](https://code.visualstudio.com/api/references/vscode-api#commands)
- [VS Code Extension API - TextEditor](https://code.visualstudio.com/api/references/vscode-api#TextEditor)
- [VS Code Extension API - Workspace](https://code.visualstudio.com/api/references/vscode-api#workspace)

---

**마지막 수정 시간**: 2024-12-19
