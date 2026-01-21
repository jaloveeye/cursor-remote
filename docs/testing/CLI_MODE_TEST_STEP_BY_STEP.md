# CLI 모드 테스트 가이드 (단계별)

## 사전 준비 확인

### 1. Cursor CLI 설치 및 인증 확인

```bash
# CLI 설치 확인
~/.local/bin/agent --version

# 인증 확인
~/.local/bin/agent status

# 인증이 안 되어 있으면
~/.local/bin/agent login
```

### 2. Extension CLI 모드 활성화 확인

**방법 1: Output 패널 확인**
1. `Cmd + Shift + U` → Output 패널 열기
2. 드롭다운에서 "Cursor Remote" 선택
3. 다음 메시지 확인:
   ```
   [Cursor Remote] CLI mode is enabled - using Cursor CLI instead of IDE
   ```

**방법 2: 설정 파일 확인**
```bash
cat ~/Library/Application\ Support/Cursor/User/settings.json | grep -i cursorRemote
```

다음과 같이 표시되어야 합니다:
```json
"cursorRemote.useCLIMode": true
```

## 테스트 방법

### 방법 1: 모바일 앱을 통한 전체 테스트 (권장)

#### 1단계: PC 서버 실행

```bash
cd /Users/herace/Workspace/cursor-remote/pc-server
npm start
```

서버가 시작되면 다음과 같은 메시지가 표시됩니다:
```
✅ Cursor Remote PC Server started!
📱 Mobile app should connect to: 192.168.x.x:8767
🔌 WebSocket server (Mobile): ws://192.168.x.x:8767
🔗 Extension WebSocket: ws://localhost:8766
```

**중요**: 표시된 IP 주소를 메모하세요!

#### 2단계: Cursor IDE에서 Extension 확인

1. Cursor IDE 실행
2. Output 패널 확인 (`Cmd + Shift + U` → "Cursor Remote")
3. 다음 메시지 확인:
   ```
   ✅ Connected to Cursor Extension
   ```

#### 3단계: 모바일 앱 연결

1. 모바일 앱 실행
2. 서버 주소 입력 (1단계에서 메모한 IP 주소)
3. "Connect" 버튼 클릭
4. 연결 성공 메시지 확인: `✅ Connected to Cursor Remote server`

#### 4단계: 프롬프트 전송 테스트

1. 모바일 앱에서 텍스트 입력 (예: "Hello, world!")
2. "Send to Prompt" 버튼 클릭
3. Output 패널에서 다음 로그 확인:

```
[CLI] sendPrompt called - textLength: 12, execute: true
[CLI] Using CLI command: /Users/herace/.local/bin/agent
[CLI] Executing: /Users/herace/.local/bin/agent -p --output-format json --force "Hello, world!"
[CLI] CLI stdout: {"type":"result","subtype":"success",...}
[CLI] CLI process exited with code 0
```

4. 모바일 앱에서 응답 확인:
   - `chat_response` 타입의 메시지가 표시되어야 합니다
   - AI 응답이 표시되어야 합니다

### 방법 2: curl을 통한 직접 테스트 (모바일 앱 없이)

#### 1단계: PC 서버 실행

```bash
cd /Users/herace/Workspace/cursor-remote/pc-server
npm start
```

#### 2단계: WebSocket 클라이언트로 테스트

**Node.js 스크립트 사용:**

```bash
# 테스트 스크립트 생성
cat > /tmp/test-cli-mode.js << 'EOF'
const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8767');

ws.on('open', () => {
  console.log('✅ Connected to PC Server');
  
  // 프롬프트 전송
  const message = {
    type: 'insert_text',
    id: Date.now().toString(),
    text: 'Hello, world!',
    prompt: true,
    execute: true
  };
  
  console.log('📤 Sending:', JSON.stringify(message));
  ws.send(JSON.stringify(message));
});

ws.on('message', (data) => {
  const message = JSON.parse(data.toString());
  console.log('📥 Received:', JSON.stringify(message, null, 2));
  
  if (message.type === 'chat_response') {
    console.log('\n✅ CLI Response:', message.text);
  }
  
  if (message.type === 'command_result') {
    console.log('\n✅ Command Result:', message.success ? 'Success' : 'Failed');
    if (message.error) {
      console.log('❌ Error:', message.error);
    }
    ws.close();
  }
});

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error);
});
EOF

# 스크립트 실행
node /tmp/test-cli-mode.js
```

**또는 wscat 사용 (설치 필요):**
```bash
npm install -g wscat
wscat -c ws://localhost:8767
```

연결 후 다음 메시지 전송:
```json
{"type":"insert_text","id":"123","text":"Hello, world!","prompt":true,"execute":true}
```

### 방법 3: Extension 로그만 확인 (가장 간단)

#### 1단계: Output 패널 열기

1. `Cmd + Shift + U` → Output 패널
2. 드롭다운에서 "Cursor Remote" 선택

#### 2단계: Extension이 CLI 모드를 사용하는지 확인

다음 메시지가 보이면 CLI 모드가 활성화된 것입니다:
```
[Cursor Remote] CLI mode is enabled - using Cursor CLI instead of IDE
```

#### 3단계: 테스트용 명령 전송

터미널에서 WebSocket으로 직접 전송:

```bash
# websocat 설치 (없는 경우)
brew install websocat

# 또는 Node.js 사용
node -e "
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:8767');
ws.on('open', () => {
  ws.send(JSON.stringify({
    type: 'insert_text',
    id: Date.now().toString(),
    text: 'Test message',
    prompt: true,
    execute: true
  }));
});
ws.on('message', (data) => {
  console.log('Response:', data.toString());
  ws.close();
});
"
```

## 예상되는 로그 출력

### 성공적인 테스트 시 Output 패널 로그:

```
[Cursor Remote] CLI mode is enabled - using Cursor CLI instead of IDE
[CLI] sendPrompt called - textLength: 12, execute: true
[CLI] Using CLI command: /Users/herace/.local/bin/agent
[CLI] Executing: /Users/herace/.local/bin/agent -p --output-format json --force "Hello, world!"
[CLI] CLI stdout: {"type":"result","subtype":"success","is_error":false,...}
[CLI] CLI process exited with code 0
```

### 모바일 앱에서 받는 응답:

```json
{
  "type": "chat_response",
  "text": "안녕하세요! 무엇을 도와드릴까요?",
  "timestamp": "2026-01-20T10:14:12.000Z",
  "source": "cli"
}
```

## 문제 해결

### 1. Extension이 CLI를 찾을 수 없는 경우

Output 패널에서 확인:
```
[CLI] ERROR: Cursor CLI (agent)가 설치되어 있지 않습니다.
```

**해결:**
```bash
# CLI 설치 확인
~/.local/bin/agent --version

# PATH 확인
which agent
```

### 2. CLI 인증 오류

Output 패널에서 확인:
```
[CLI] CLI stderr: Error: Authentication required...
```

**해결:**
```bash
~/.local/bin/agent login
```

### 3. Extension이 CLI 모드를 사용하지 않는 경우

Output 패널에서 확인:
```
[Cursor Remote] IDE mode is enabled - using Cursor IDE extension
```

**해결:**
1. 설정 파일 확인:
   ```bash
   cat ~/Library/Application\ Support/Cursor/User/settings.json | grep cursorRemote
   ```
2. CLI 모드 활성화:
   ```json
   {
     "cursorRemote.useCLIMode": true
   }
   ```
3. Extension 재로드: `Cmd + Shift + P` → `Developer: Reload Window`

### 4. PC 서버가 Extension에 연결되지 않는 경우

PC 서버 로그 확인:
```
Extension connection error: ...
```

**해결:**
1. Cursor IDE가 실행 중인지 확인
2. Extension이 활성화되었는지 확인
3. Output 패널에서 WebSocket 서버가 시작되었는지 확인

## 테스트 체크리스트

- [ ] Cursor CLI 설치 확인
- [ ] Cursor CLI 인증 완료
- [ ] Extension CLI 모드 활성화 확인
- [ ] PC 서버 실행
- [ ] Extension과 PC 서버 연결 확인
- [ ] 모바일 앱 연결 (또는 WebSocket 클라이언트)
- [ ] 프롬프트 전송
- [ ] Output 패널에서 CLI 실행 로그 확인
- [ ] 응답 수신 확인

---

**작성 시간**: 2026년 1월 20일  
**수정 시간**: 2026년 1월 20일
