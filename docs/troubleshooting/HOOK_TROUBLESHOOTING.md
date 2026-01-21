# Hook 문제 해결 가이드

**작성 시간**: 2026년 1월 20일

## 현재 상황

Hook 스크립트 자체는 정상 작동하지만, Cursor IDE에서 hook이 실행되지 않습니다.

## 체계적 진단 단계

### 1단계: Cursor IDE 완전 재시작 (필수)

**⚠️ 가장 중요: hooks.json을 수정한 후에는 반드시 Cursor IDE를 완전히 종료하고 다시 시작해야 합니다.**

```bash
# Mac
# 1. Cursor IDE 완전 종료 (Cmd+Q)
# 2. 프로세스 확인
ps aux | grep -i cursor

# 3. 모든 Cursor 프로세스 종료 (필요시)
killall Cursor

# 4. Cursor IDE 다시 실행
```

### 2단계: Hook 로그 확인

```bash
# 프로젝트 루트에서
tail -f .cursor/test-hook-simple.log
tail -f .cursor/hook-debug.log
```

### 3단계: Cursor IDE Hooks 패널 확인

1. Cursor IDE에서 `View` → `Output` 선택
2. 드롭다운에서 "Hooks" 선택 (있는 경우)
3. Hook 실행 로그 확인

### 4단계: 다른 이벤트 테스트

현재 `beforeSubmitPrompt`와 `afterAgentResponse` 이벤트를 모두 테스트 중입니다.

**beforeSubmitPrompt 테스트:**

- 채팅에서 프롬프트를 입력하기 전에 실행됨
- `.cursor/test-hook-simple.log` 파일 확인

**afterAgentResponse 테스트:**

- AI 응답 후 실행됨
- `.cursor/hook-debug.log` 파일 확인

### 5단계: Cursor IDE 버전 확인

1. `Help` → `About Cursor`
2. 버전 확인
3. 일부 버전에서 hook 지원이 제한적일 수 있음

### 6단계: hooks.json 위치 확인

```bash
# 프로젝트 레벨 hooks.json
cat .cursor/hooks.json

# 전역 hooks.json (있는 경우)
cat ~/.cursor/hooks.json
```

**중요:** 프로젝트 레벨 hooks.json이 우선순위가 높습니다.

### 7단계: 절대 경로 vs 상대 경로

현재 절대 경로를 사용 중:

```json
"/Users/herace/Workspace/cursor-remote/.cursor/hook-debug.js"
```

상대 경로로 변경 시도:

```json
".cursor/hook-debug.js"
```

## 현재 설정

```json
{
  "hooks": [
    {
      "event": "beforeSubmitPrompt",
      "command": "node",
      "args": [
        "/Users/herace/Workspace/cursor-remote/.cursor/test-hook-simple.js"
      ],
      "env": {}
    },
    {
      "event": "afterAgentResponse",
      "command": "node",
      "args": [
        "/Users/herace/Workspace/cursor-remote/.cursor/hook-debug.js"
      ],
      "env": {
        "CURSOR_REMOTE_HTTP_PORT": "8768"
      }
    }
  ]
}
```

## 다음 단계

1. **Cursor IDE 완전 재시작**
2. **채팅에서 간단한 프롬프트 입력** (예: "hello")
3. **로그 파일 확인:**
   - `.cursor/test-hook-simple.log` (beforeSubmitPrompt)
   - `.cursor/hook-debug.log` (afterAgentResponse)
4. **Extension Output 확인**

## 알려진 문제

- 일부 Cursor IDE 버전에서 `afterAgentResponse` 이벤트가 작동하지 않을 수 있음
- Windows에서 hook 지원이 제한적일 수 있음
- hooks.json 변경 후 재시작이 필수
