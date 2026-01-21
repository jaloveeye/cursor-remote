# Rules 기반 채팅 캡처 테스트 가이드

**작성 시간**: 2026년 1월 19일  
**수정 시간**: 2026년 1월 20일

## 개요

이 문서는 Cursor Remote Extension의 Rules 기반 채팅 캡처 시스템을 테스트하는 방법을 상세히 설명합니다.

## 시스템 아키텍처

```
Cursor IDE (AI 응답 생성)
    ↓ agent_message 이벤트
hooks.json (Hook 실행)
    ↓ HTTP POST
Extension HTTP 서버 (포트 8768)
    ↓ WebSocket
모바일 앱 (실시간 표시)
```

## 1단계: 사전 준비 및 확인

### 1.1 Extension 컴파일 및 로드

```bash
cd cursor-extension
npm run compile
```

**확인 사항:**

- `out/` 폴더에 컴파일된 파일이 생성되었는지 확인
- 에러 없이 컴파일이 완료되었는지 확인

### 1.2 Cursor IDE에서 Extension 활성화 확인

1. **Cursor IDE 실행**
2. **상태 표시줄 확인** (우측 하단):
   - ✅ `$(cloud) Cursor Remote: Waiting` 또는 `Connected` 표시 확인
3. **Output 채널 확인**:
   - `View` → `Output` → "Cursor Remote" 선택
   - 다음 메시지 확인:

     ```
     ✅ HTTP server for hooks started on port 8768
     💡 Waiting for Rules-based chat responses...
     ```

### 1.3 Rules 파일 확인

```bash
# 프로젝트 루트에서
ls -la .cursor/rules/after_each_chat.mdc
cat .cursor/rules/after_each_chat.mdc
```

**확인 사항:**

- 파일이 존재하는지
- `alwaysApply: true`가 포함되어 있는지

**예상 내용:**

```markdown
---
alwaysApply: true
---

This rule ensures that Cursor Remote extension can capture chat responses in real-time.

The actual response capture is handled by the hook system configured in .cursor/hooks.json.
When the AI responds, the hook automatically sends the response to the Cursor Remote extension.
```

### 1.4 hooks.json 확인

```bash
cat .cursor/hooks.json
```

**확인 사항:**

- `agent_message` 이벤트 hook이 있는지
- `chat_response` 타입을 사용하는지
- 포트가 8768인지

**예상 내용:**

```json
{
  "hooks": [
    {
      "event": "agent_message",
      "command": "node",
      "args": [
        "-e",
        "const http = require('http'); const data = JSON.parse(process.argv[1]); const postData = JSON.stringify({type: 'chat_response', text: data.message || data.text || '', timestamp: new Date().toISOString()}); const options = {hostname: 'localhost', port: 8768, path: '/hook', method: 'POST', headers: {'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData)}}; const req = http.request(options, (res) => { let responseData = ''; res.on('data', (chunk) => { responseData += chunk.toString(); }); res.on('end', () => { process.exit(0); }); }); req.on('error', (e) => { process.exit(1); }); req.write(postData); req.end();"
      ],
      "env": {}
    }
  ]
}
```

## 2단계: HTTP Hook 서버 테스트

### 2.1 HTTP 서버가 실행 중인지 확인

```bash
# macOS/Linux
lsof -i :8768

# Windows
netstat -ano | findstr :8768
```

**예상 출력:**

```
COMMAND   PID  USER   FD   TYPE DEVICE SIZE/OFF NODE NAME
node    12345  user   23u  IPv4  ...      0t0  TCP localhost:8768 (LISTEN)
```

### 2.2 HTTP POST 테스트

```bash
curl -X POST http://localhost:8768/hook \
  -H "Content-Type: application/json" \
  -d '{"type":"chat_response","text":"Test message","timestamp":"2024-01-19T00:00:00.000Z"}'
```

**예상 응답:**

```json
{"success":true}
```

### 2.3 Extension 로그 확인

Cursor IDE에서:

1. `View` → `Output` → "Cursor Remote" 선택
2. 다음 메시지 확인:

   ```
   Received from hook: chat_response (X bytes)
   ✅ Chat response sent to mobile app via WebSocket
   ```

## 3단계: Rules 기반 캡처 테스트

### 3.1 기본 채팅 테스트

1. **Cursor IDE에서 채팅 패널 열기:**
   - `Cmd+L` (Mac) 또는 `Ctrl+L` (Windows/Linux)
   - 또는 `Cmd+Shift+P` → "Chat: Open Chat"

2. **간단한 프롬프트 전송:**

   ```
   Hello, can you explain what you do?
   ```

3. **AI 응답 대기**

4. **Extension Output 채널 확인:**

   ```
   Received from hook: chat_response (XXX bytes)
   ✅ Chat response sent to mobile app via WebSocket
   ```

### 3.2 실시간 캡처 확인

**⚠️ 중요: Cursor IDE 재시작 필요**

hooks.json을 수정한 후에는 **반드시 Cursor IDE를 완전히 종료하고 다시 시작**해야 합니다.

**📌 클라이언트 연결과 Hook 실행의 관계:**

- **Hook 실행**: 클라이언트(모바일 앱) 연결과 **무관**합니다. Cursor IDE가 AI 응답을 생성할 때 자동으로 실행됩니다.
- **HTTP 서버**: 클라이언트 연결과 **무관**하게 요청을 받을 수 있습니다.
- **모바일 앱으로 전달**: 클라이언트가 연결되어 있어야 WebSocket으로 전달됩니다.

따라서 Hook이 실행되는지 테스트할 때는 **모바일 앱 연결 없이도 가능**합니다. Extension Output 채널과 `.cursor/hook-debug.log` 파일만 확인하면 됩니다.

1. **Cursor IDE 완전 종료 및 재시작**
   - `Cmd+Q` (Mac) 또는 완전 종료
   - Cursor IDE 다시 실행

2. **Hook 로그 파일 확인 (디버깅용)**

   ```bash
   # 프로젝트 루트에서
   tail -f .cursor/hook-debug.log
   ```

3. **채팅 패널에서 새 프롬프트 입력:**

   ```
   Write a simple hello world function in Python
   ```

4. **확인 사항:**

   **a) Hook 실행 확인 (클라이언트 연결 불필요):**

   ```bash
   # 터미널에서 실시간 로그 확인
   tail -f .cursor/hook-debug.log
   ```

   - "Hook triggered" 메시지가 나타나는지 확인
   - stdin 데이터가 수신되는지 확인
   - **클라이언트 연결 없이도 이 단계는 확인 가능**

   **b) Extension Output 채널 확인 (클라이언트 연결 불필요):**
   - `View` → `Output` → "Cursor Remote" 선택
   - "Received from hook: chat_response" 메시지 확인
   - HTTP 서버가 요청을 받았는지 확인

   **c) WebSocket 전송 확인 (클라이언트 연결 필요):**
   - Extension Output에서 "✅ Chat response sent to mobile app via WebSocket" 확인
   - **이 메시지는 클라이언트가 연결되어 있을 때만 나타납니다**
   - 클라이언트가 없어도 HTTP 요청은 성공하지만, WebSocket 전송은 스킵됩니다

5. **문제 해결:**

   **Hook이 실행되지 않는 경우 (가장 흔한 문제):**

   **1단계: Cursor IDE 완전 재시작**

   ```bash
   # Cursor IDE 완전 종료 후 재시작
   # hooks.json 변경사항은 재시작 후에만 적용됨
   ```

   **2단계: Hook 로그 확인**

   ```bash
   # 로그 파일이 생성되는지 확인
   ls -la .cursor/hook-debug.log
   
   # 로그 내용 확인
   cat .cursor/hook-debug.log
   ```

   - 로그 파일이 없으면 hook이 실행되지 않은 것
   - Cursor IDE 재시작 필요

   **3단계: hooks.json 확인**

   ```bash
   cat .cursor/hooks.json
   ```

   - `afterAgentResponse` 이벤트가 있는지 확인
   - 스크립트 경로가 올바른지 확인 (절대 경로 권장)

   **4단계: Hook 스크립트 직접 테스트**

   ```bash
   # stdin으로 테스트 데이터 전송
   echo '{"hook_event_name":"afterAgentResponse","text":"test message"}' | node .cursor/hook-debug.js
   
   # 로그 확인
   tail -5 .cursor/hook-debug.log
   ```

   **5단계: Cursor IDE 버전 확인**
   - `Help` → `About Cursor`
   - 일부 버전에서 hook 지원이 제한적일 수 있음
   - 최신 버전 사용 권장

   **Hook은 실행되지만 HTTP POST가 실패하는 경우:**
   - Extension HTTP 서버가 실행 중인지 확인 (포트 8768)
   - `curl` 테스트로 HTTP 서버 응답 확인

   ```bash
   curl -X POST http://localhost:8768/hook \
     -H "Content-Type: application/json" \
     -d '{"type":"chat_response","text":"test"}'
   ```

### 3.3 Hook 스크립트 직접 테스트

터미널에서 직접 hook 스크립트를 테스트할 수 있습니다:

```bash
node -e "const http = require('http'); const data = {message: 'Test message'}; const postData = JSON.stringify({type: 'chat_response', text: data.message || data.text || '', timestamp: new Date().toISOString()}); const options = {hostname: 'localhost', port: 8768, path: '/hook', method: 'POST', headers: {'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData)}}; const req = http.request(options, (res) => { let responseData = ''; res.on('data', (chunk) => { responseData += chunk.toString(); }); res.on('end', () => { console.log('Response:', responseData); process.exit(0); }); }); req.on('error', (e) => { console.error('Error:', e); process.exit(1); }); req.write(postData); req.end();"
```

**예상 출력:**

```
Response: {"success":true}
```

## 4단계: 모바일 앱 연동 테스트

### 4.1 모바일 앱 실행 및 연결

```bash
cd mobile-app
flutter run
```

1. **모바일 앱에서:**
   - PC 서버 IP 입력 (예: `192.168.0.10`)
   - "Connect" 버튼 클릭
   - 연결 성공 확인

### 4.2 채팅 응답 수신 테스트

1. **Cursor IDE에서 채팅 시작:**

   ```
   Explain the difference between let and const in JavaScript
   ```

2. **모바일 앱에서 확인:**
   - 메시지 로그에 `🤖 Cursor: <응답 텍스트>` 표시 확인
   - 실시간으로 업데이트되는지 확인

### 4.3 프롬프트 전송 테스트

1. **모바일 앱에서:**
   - 텍스트 입력: `Create a React component for a button`
   - "Send to Prompt" 버튼 클릭

2. **Cursor IDE에서 확인:**
   - 채팅 패널이 열리는지
   - 프롬프트가 입력되는지
   - 자동으로 실행되는지

3. **AI 응답 확인:**
   - Cursor IDE에서 응답 확인
   - 모바일 앱에서도 동일한 응답 수신 확인

## 5단계: 고급 테스트 시나리오

### 5.1 여러 채팅창 테스트

1. **첫 번째 채팅창에서 프롬프트 전송**
2. **새 채팅창 열기** (`Cmd+L` → 새 채팅)
3. **두 번째 채팅창에서 프롬프트 전송**
4. **각 채팅창의 응답이 모두 캡처되는지 확인**

### 5.2 연속 프롬프트 테스트

1. **첫 번째 프롬프트:**

   ```
   Write a function to calculate factorial
   ```

2. **응답 완료 후 즉시 두 번째 프롬프트:**

   ```
   Now modify it to handle negative numbers
   ```

3. **두 응답이 모두 캡처되는지 확인**

### 5.3 긴 응답 테스트

1. **긴 응답을 요청하는 프롬프트:**

   ```
   Write a comprehensive guide on async/await in JavaScript with examples
   ```

2. **긴 응답이 완전히 캡처되는지 확인**
3. **모바일 앱에서 전체 응답이 표시되는지 확인**

### 5.4 동시성 테스트

1. **여러 채팅창에서 동시에 프롬프트 전송**
2. **모든 응답이 캡처되는지 확인**
3. **순서가 올바른지 확인**

## 6단계: 디버깅 및 문제 해결

### 6.1 Extension 로그 확인

**Cursor IDE에서:**

1. `Help` → `Toggle Developer Tools`
2. Console 탭 확인
3. 에러 메시지 확인

**Output 채널:**

- `View` → `Output` → "Cursor Remote"
- 모든 로그 메시지 확인

### 6.2 Hook 실행 확인

**터미널에서 직접 hook 스크립트 테스트:**

```bash
node -e "const http = require('http'); const data = {message: 'Test message'}; const postData = JSON.stringify({type: 'chat_response', text: data.message || data.text || '', timestamp: new Date().toISOString()}); const options = {hostname: 'localhost', port: 8768, path: '/hook', method: 'POST', headers: {'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData)}}; const req = http.request(options, (res) => { let responseData = ''; res.on('data', (chunk) => { responseData += chunk.toString(); }); res.on('end', () => { console.log('Response:', responseData); process.exit(0); }); }); req.on('error', (e) => { console.error('Error:', e); process.exit(1); }); req.write(postData); req.end();"
```

**예상 출력:**

```
Response: {"success":true}
```

### 6.3 WebSocket 연결 확인

```bash
# WebSocket 클라이언트로 테스트 (wscat 설치 필요)
npm install -g wscat
wscat -c ws://localhost:8766
```

연결 후 메시지 수신 확인

### 6.4 일반적인 문제 해결

#### 문제 1: Hook이 트리거되지 않음

**증상:**

- AI 응답 후 Extension 로그에 아무 메시지도 없음

**해결 방법:**

```bash
# hooks.json 확인
cat .cursor/hooks.json

# Rules 파일 확인
cat .cursor/rules/after_each_chat.mdc

# Cursor IDE 재시작
```

**확인 사항:**

- `hooks.json`에 `afterAgentResponse` 이벤트 hook이 있는지
- hook 스크립트 경로가 올바른지 (절대 경로 권장)
- `.cursor/hook-debug.log` 파일이 생성되는지 확인
- Cursor IDE를 완전히 재시작했는지 확인
- Cursor IDE 버전 확인 (일부 버전에서 hook 지원 제한적)

**디버깅 단계:**

1. **Hook 로그 확인:**

   ```bash
   cat .cursor/hook-debug.log
   ```

   - 로그가 없으면 hook이 실행되지 않은 것
   - Cursor IDE 재시작 필요

2. **Hook 스크립트 직접 테스트:**

   ```bash
   echo '{"hook_event_name":"afterAgentResponse","text":"test"}' | node .cursor/hook-debug.js
   ```

   - HTTP POST가 전송되는지 확인

3. **Cursor IDE Output 확인:**
   - `View` → `Output` → "Hooks" 또는 "Cursor Remote" 확인
   - Hook 실행 오류 메시지 확인

#### 문제 2: HTTP 서버가 응답하지 않음

**증상:**

- `curl` 테스트 시 연결 실패
- Extension 로그에 "HTTP server error" 메시지

**해결 방법:**

```bash
# 포트 확인
lsof -i :8768

# Extension 재로드
# Cursor IDE에서: Cmd+Shift+P → "Developer: Reload Window"
```

**확인 사항:**

- 포트 8768이 사용 가능한지
- 다른 프로세스가 포트를 사용하고 있지 않은지
- Extension이 정상적으로 활성화되었는지

#### 문제 3: 모바일 앱에서 응답이 표시되지 않음

**증상:**

- Extension 로그에는 전송 성공 메시지가 있음
- 모바일 앱에는 응답이 표시되지 않음

**해결 방법:**

1. **WebSocket 연결 상태 확인:**
   - 모바일 앱에서 연결 상태 확인
   - Extension 상태 표시줄에서 "Connected" 확인

2. **모바일 앱 로그 확인:**
   - Flutter 로그에서 WebSocket 메시지 수신 확인

3. **Extension Output 채널 확인:**
   - `sendFromHook` 호출 확인
   - 전송된 데이터 확인

#### 문제 4: Rules 파일이 자동 생성되지 않음

**증상:**

- `.cursor/rules/after_each_chat.mdc` 파일이 없음

**해결 방법:**

1. **Extension 재로드:**
   - `Cmd+Shift+P` → "Developer: Reload Window"

2. **수동 생성:**

   ```bash
   mkdir -p .cursor/rules
   # Extension 코드를 참고하여 파일 생성
   ```

3. **워크스페이스 확인:**
   - Cursor IDE에서 워크스페이스가 올바르게 열려있는지 확인

## 7단계: 성능 및 실시간성 테스트

### 7.1 응답 시간 측정

1. **채팅 시작 시간 기록**
2. **AI 응답 완료 시간 기록**
3. **모바일 앱 수신 시간 기록**
4. **총 지연 시간 계산** (목표: < 100ms)

**측정 방법:**

```javascript
// Extension Output 채널에서 타임스탬프 확인
// AI 응답 완료 시간 - Hook 수신 시간 = 지연 시간
```

### 7.2 실시간성 검증

1. **스트리밍 응답 테스트:**
   - 긴 응답을 요청하는 프롬프트
   - 응답이 생성되는 동안 실시간으로 캡처되는지 확인

2. **빠른 연속 응답 테스트:**
   - 짧은 간격으로 여러 프롬프트 전송
   - 모든 응답이 빠르게 캡처되는지 확인

## 테스트 체크리스트

### 초기 설정

- [ ] Extension이 활성화되고 HTTP 서버가 실행 중
- [ ] `.cursor/rules/after_each_chat.mdc` 파일 존재
- [ ] `.cursor/hooks.json`에 `chat_response` hook 설정됨
- [ ] HTTP POST 테스트 성공

### 기본 기능

- [ ] Cursor IDE 채팅에서 AI 응답 시 hook 트리거됨
- [ ] Extension이 hook 데이터를 수신함
- [ ] WebSocket으로 모바일 앱에 전송됨
- [ ] 모바일 앱에서 응답이 표시됨

### 고급 기능

- [ ] 모바일 앱에서 프롬프트 전송 가능
- [ ] 여러 채팅창에서 정상 작동
- [ ] 긴 응답도 완전히 캡처됨
- [ ] 연속 프롬프트 모두 캡처됨

### 성능

- [ ] 응답 시간 < 100ms
- [ ] 실시간 캡처 작동
- [ ] 동시성 테스트 통과

## 참고 자료

- [Cursor Rules 문서](https://docs.cursor.com/en/context)
- [Cursor Hooks 문서](https://docs.cursor.com/en/hooks)
- [TEST_GUIDE.md](./TEST_GUIDE.md) - 일반 테스트 가이드
- [EXTENSION_SETUP.md](./EXTENSION_SETUP.md) - Extension 설치 가이드

---

**작성 시간**: 2026년 1월 19일  
**수정 시간**: 2026년 1월 20일
