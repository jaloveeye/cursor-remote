# CLI 모드 로그 확인 방법

## Output 패널에서 로그 보기

### 1. Output 패널 열기

1. **단축키**: `Cmd + Shift + U` (Mac) 또는 `Ctrl + Shift + U` (Windows/Linux)
2. 또는 메뉴: `View` → `Output`

### 2. "Cursor Remote" 선택

Output 패널 상단의 드롭다운에서 **"Cursor Remote"**를 선택합니다.

### 3. 프롬프트 전송 후 로그 확인

모바일 앱에서 프롬프트를 전송하면 다음과 같은 로그가 표시됩니다:

## 예상되는 로그

### CLI 모드 활성화 확인

Extension이 시작될 때:
```
[Cursor Remote] CLI mode is enabled - using Cursor CLI instead of IDE
```

### 프롬프트 전송 시 로그

```
[CLI] sendPrompt called - textLength: 12, execute: true
[CLI] Using CLI command: /Users/herace/.local/bin/agent
[CLI] Executing: /Users/herace/.local/bin/agent -p --output-format json --force "Hello, world!"
[CLI] CLI stdout: {"type":"result","subtype":"success","is_error":false,"duration_ms":13154,"result":"안녕하세요! 무엇을 도와드릴까요?","session_id":"...","request_id":"..."}
[CLI] CLI process exited with code 0
[CLI] CLI stdout length: 234, stderr length: 0
[CLI] CLI stdout content: {"type":"result","subtype":"success",...}
[CLI] Parsed JSON data: {"type":"result","subtype":"success","is_error":false,"duration_ms":13154,"result":"안녕하세요! 무엇을 도와드릴까요?",...}
[CLI] Extracted response text length: 20
[CLI] Sending chat_response: {"type":"chat_response","text":"안녕하세요! 무엇을 도와드릴까요?","timestamp":"2026-01-20T10:27:07.000Z","source":"cli"}
[CLI] ✅ Chat response sent to WebSocket
```

### IDE 모드인 경우 (문제)

만약 IDE 모드로 동작하고 있다면:
```
[Cursor Remote] IDE mode is enabled - using Cursor IDE extension
[Cursor Remote] insertToPrompt called - textLength: 12, execute: true
[Cursor Remote] Opening chat panel (may create new chat if none exists)
[Cursor Remote] Executing workbench.action.chat.open
[Cursor Remote] Chat panel opened
```

## 로그 해석

### 정상적인 CLI 모드 로그

1. **`[CLI] sendPrompt called`**: CLI 핸들러가 호출됨
2. **`[CLI] Using CLI command: ...`**: 사용할 CLI 명령어 경로
3. **`[CLI] Executing: ...`**: 실제 실행되는 명령어
4. **`[CLI] CLI stdout: ...`**: CLI의 출력 (JSON 형식)
5. **`[CLI] CLI process exited with code 0`**: 프로세스가 성공적으로 종료됨
6. **`[CLI] Parsed JSON data: ...`**: 파싱된 JSON 데이터
7. **`[CLI] ✅ Chat response sent to WebSocket`**: 응답이 WebSocket으로 전송됨

### 문제가 있는 경우

#### CLI를 찾을 수 없는 경우
```
[CLI] ERROR: Cursor CLI (agent)가 설치되어 있지 않습니다.
```

#### 인증 오류
```
[CLI] CLI stderr: Error: Authentication required. Please run 'agent login' first.
```

#### JSON 파싱 오류
```
[CLI] ERROR: JSON parsing error: ...
[CLI] CLI stdout: ...
```

## 실시간 로그 모니터링

### Output 패널 자동 스크롤

Output 패널은 자동으로 최신 로그로 스크롤됩니다. 실시간으로 로그를 확인할 수 있습니다.

### 로그 필터링

Output 패널에서 `[CLI]`를 검색하면 CLI 관련 로그만 볼 수 있습니다.

## 디버깅 팁

### 1. CLI 모드 확인

Extension 시작 시 다음 메시지가 보여야 합니다:
```
[Cursor Remote] CLI mode is enabled - using Cursor CLI instead of IDE
```

### 2. 프롬프트 전송 확인

프롬프트를 전송했을 때:
- `[CLI] sendPrompt called`가 보여야 함
- `[Cursor Remote] insertToPrompt called`가 보이면 IDE 모드로 동작 중

### 3. 응답 전송 확인

응답이 제대로 전송되었는지 확인:
- `[CLI] ✅ Chat response sent to WebSocket` 메시지 확인
- 모바일 앱에서 `chat_response` 타입 메시지 수신 확인

## 문제 해결

### 로그가 보이지 않는 경우

1. Output 패널이 열려있는지 확인
2. 드롭다운에서 "Cursor Remote"가 선택되어 있는지 확인
3. Extension이 활성화되어 있는지 확인

### CLI 로그가 아닌 IDE 로그가 보이는 경우

1. Extension 재로드: `Cmd + Shift + P` → `Developer: Reload Window`
2. 설정 확인: `cursorRemote.useCLIMode: true`
3. Output 패널에서 CLI 모드 메시지 확인

---

**작성 시간**: 2026년 1월 20일  
**수정 시간**: 2026년 1월 20일
