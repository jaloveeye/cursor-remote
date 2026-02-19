# Cursor Remote 📱

[![Version](https://img.shields.io/badge/version-0.4.0-blue.svg)](https://github.com/jaloveeye/cursor-remote)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

**Control Cursor AI from Your Mobile Device**

> Use Cursor AI right from your smartphone or tablet! Code anywhere, anytime with Cursor CLI.

---

## 🇺🇸 English

**Control Cursor AI from Your Mobile Device!**

Cursor Remote is an extension that allows you to remotely control Cursor AI from your mobile devices. Chat with AI in real-time, write code, and check work results through WebSocket. Code anywhere, anytime using Cursor CLI from your smartphone or tablet!

### Key Features

- 📱 **Mobile Control**: Control Cursor AI from your smartphone or tablet
- ⚡ **Real-time Communication**: WebSocket-based bidirectional real-time communication
- 🤖 **CLI Mode**: AI interaction through Cursor CLI (`agent`)
- 🔄 **Auto Start**: Automatically start server when Cursor launches
- ⚙️ **Configurable**: Customize ports and auto-start options
- 💬 **AI Chat**: Real-time conversation with Cursor AI from mobile
- 📝 **Code Editing**: Write and edit code from your mobile device
- 🌍 **Relay Mode**: Connect from anywhere via relay server (no same network required)
- 🔐 **Session Security**: Optional PIN protection for relay sessions

### Features

- 🌐 **WebSocket Server**: Real-time bidirectional communication (default port: 8766)
- 🔌 **HTTP Hook Endpoint**: Internal hook receiver (default port: 8768, `POST /hook`)
- 📝 **Prompt Sending**: Send prompts to Cursor AI from mobile
- ⚡ **CLI Integration**: AI interaction through Cursor CLI (`agent`) command
- 💬 **AI Response Capture**: Forward AI responses to mobile in real-time
- 📋 **Rules Management**: Remote management of Cursor rules files
- 📊 **Status Display**: Check connection status in status bar
- 🔗 **Relay Server**: Connect PC and mobile on different networks via relay server

### Installation

#### Install from Cursor Marketplace (Recommended)

1. Open Extensions tab in Cursor IDE (`Cmd+Shift+X` / `Ctrl+Shift+X`)
2. Search for "Cursor Remote"
3. Click **Install**

#### Install from VSIX File

1. Download `.vsix` file from [Releases](https://github.com/jaloveeye/cursor-remote/releases) page
2. In Cursor IDE: `Extensions` → `...` → `Install from VSIX...`
3. Select the downloaded file

#### Prerequisites

- **Cursor CLI Installation**: Cursor CLI must be installed to use CLI mode

  ```bash
  curl https://cursor.com/install -fsS | bash
  ```

- **CLI Authentication**: Authentication is required on first use

  ```bash
  agent login
  ```

### Quick Start

#### 1. Install Extension

Search for "Cursor Remote" in Cursor Marketplace and install it.

#### 2. Cursor CLI Setup

To use CLI mode, install and authenticate Cursor CLI:

```bash
# Install CLI
curl https://cursor.com/install -fsS | bash

# Authenticate
agent login
```

#### 3. Start Server

The server starts automatically when the extension is installed. You can check the connection status in the status bar.

**Manual Start:**

- Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`) → `Cursor Remote: Start Cursor Remote Server`

#### 4. Connect Mobile App

**Local Mode (Same Network):**
Connect from the mobile app using the PC's IP address.

**Relay Mode (Different Networks):**
1. Extension prompts for a **6-character Session ID** on first launch
2. Enter the same Session ID in the mobile app to connect
3. PC and mobile can be on completely different networks

See the [project README](https://github.com/jaloveeye/cursor-remote) for details.

### Relay Mode (New in 0.3.6)

Relay mode allows you to connect from anywhere without being on the same network.

#### How It Works

1. **Session ID**: On first launch, the extension prompts for a 6-character alphanumeric Session ID
2. **Session Persistence**: The Session ID is saved and reused automatically (valid for 24 hours)
3. **Mobile Connection**: Enter the same Session ID in the mobile app to connect
4. **Heartbeat**: Extension sends heartbeat every 30 seconds; session is released after 2 minutes of inactivity

#### Commands

| Command | Description |
|---------|-------------|
| `Cursor Remote: 세션 ID로 릴레이 연결` | Connect to a different session immediately |
| `Cursor Remote: 릴레이 세션 ID 설정` | Change saved Session ID (used on next launch) |
| `Cursor Remote: 릴레이 서버 상태 확인` | Check relay server status |

#### Session Conflict

If another PC is using the same Session ID, you'll get a **409 error**. Solutions:
- Close the other PC/Cursor window
- Create a new session from mobile and use that Session ID

### Configuration

The extension currently uses internal defaults:

- WebSocket: `8766` (auto-fallback to next available port)
- HTTP hook endpoint: `8768` (`POST /hook`, local only)

### API

#### WebSocket API

Connect to the WebSocket server to send and receive commands in real-time.

```javascript
const ws = new WebSocket('ws://localhost:8766');

// Send command
ws.send(JSON.stringify({
  type: 'execute_command',
  command: 'cursorRemote.toggle'
}));

// Receive response
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log(data);
};
```

#### HTTP Hook Endpoint

This endpoint is used internally for hook-based message delivery:

```bash
curl -X POST http://localhost:8768/hook \
  -H "Content-Type: application/json" \
  -d '{"type":"chat_response","text":"example"}'
```

There is no public `/status` or `/command` REST API in the extension.

### Development

```bash
# Install dependencies
npm install

# Compile
npm run compile

# Development mode (auto-compile)
npm run watch

# Create VSIX package
npm run package
```

### Mobile App

Cursor Remote can be used with a Flutter mobile app.

- **Android**: Build and install APK
- **iOS**: Build through Xcode
- **Web**: Deployable via Flutter Web

Mobile app source code is available in the [GitHub repository](https://github.com/jaloveeye/cursor-remote/tree/main/mobile-app).

### Contributing

Contributions are welcome! Bug reports, feature suggestions, and Pull Requests are all welcome.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

### Contact & Support

- **Author**: 김형진 (<jaloveeye@gmail.com>)
- **Website**: <https://jaloveeye.com>
- **GitHub**: <https://github.com/jaloveeye/cursor-remote>
- **Issues**: [GitHub Issues](https://github.com/jaloveeye/cursor-remote/issues)

---

## 🇰🇷 한국어

**모바일 기기에서 Cursor AI를 제어하세요!**

Cursor Remote는 모바일 기기에서 Cursor AI를 원격으로 제어할 수 있게 해주는 확장입니다. WebSocket을 통해 실시간으로 AI와 대화하고, 코드를 작성하며, 작업 결과를 확인할 수 있습니다. 스마트폰이나 태블릿에서 어디서든 Cursor CLI를 사용하여 코딩하세요!

### 주요 특징

- 📱 **모바일 제어**: 스마트폰이나 태블릿에서 Cursor AI 제어
- ⚡ **실시간 통신**: WebSocket 기반 양방향 실시간 통신
- 🤖 **CLI 모드**: Cursor CLI(`agent`)를 통한 AI 상호작용
- 🔄 **자동 시작**: Cursor 시작 시 자동으로 서버 시작
- ⚙️ **설정 가능**: 포트 및 자동 시작 옵션 커스터마이징
- 💬 **AI 채팅**: 모바일에서 Cursor AI와 실시간 대화
- 📝 **코드 편집**: 모바일에서 코드 작성 및 편집
- 🌍 **릴레이 모드**: 같은 네트워크가 아니어도 릴레이 서버를 통해 연결
- 🔐 **세션 보안**: 릴레이 세션에 PIN 보호 설정 가능 (선택)

### 기능

- 🌐 **WebSocket 서버**: 실시간 양방향 통신 (기본 포트: 8766)
- 🔌 **HTTP Hook 엔드포인트**: 내부 훅 수신용 (기본 포트: 8768, `POST /hook`)
- 📝 **프롬프트 전송**: 모바일에서 Cursor AI에 프롬프트 전송
- ⚡ **CLI 통합**: Cursor CLI(`agent`) 명령어를 통한 AI 상호작용
- 💬 **AI 응답 캡처**: AI 응답을 실시간으로 모바일로 전달
- 📋 **규칙 관리**: Cursor 규칙 파일 원격 관리
- 📊 **상태 표시**: 상태바에서 연결 상태 확인
- 🔗 **릴레이 서버**: 다른 네트워크에 있는 PC와 모바일을 릴레이 서버로 연결

### 설치

#### Cursor 마켓플레이스에서 설치 (권장)

1. Cursor IDE에서 확장 탭 열기 (`Cmd+Shift+X` / `Ctrl+Shift+X`)
2. "Cursor Remote" 검색
3. **설치** 클릭

#### VSIX 파일로 설치

1. [Releases](https://github.com/jaloveeye/cursor-remote/releases) 페이지에서 `.vsix` 파일 다운로드
2. Cursor IDE에서 `확장` → `...` → `VSIX에서 설치...` 선택
3. 다운로드한 파일 선택

#### 사전 요구사항

- **Cursor CLI 설치**: CLI 모드를 사용하려면 Cursor CLI가 설치되어 있어야 합니다

  ```bash
  curl https://cursor.com/install -fsS | bash
  ```

- **CLI 인증**: 처음 사용 시 인증이 필요합니다

  ```bash
  agent login
  ```

### 빠른 시작

#### 1. Extension 설치

Cursor 마켓플레이스에서 "Cursor Remote"를 검색하여 설치합니다.

#### 2. Cursor CLI 설정

CLI 모드를 사용하려면 Cursor CLI를 설치하고 인증해야 합니다:

```bash
# CLI 설치
curl https://cursor.com/install -fsS | bash

# 인증
agent login
```

#### 3. 서버 시작

Extension이 설치되면 자동으로 서버가 시작됩니다. 상태바에서 연결 상태를 확인할 수 있습니다.

**수동 시작:**

- 명령 팔레트 (`Cmd+Shift+P` / `Ctrl+Shift+P`) → `Cursor Remote: Start Cursor Remote Server`

#### 4. 모바일 앱 연결

**로컬 모드 (같은 네트워크):**
모바일 앱에서 PC의 IP 주소로 연결합니다.

**릴레이 모드 (다른 네트워크):**
1. 익스텐션 첫 실행 시 **6자리 세션 ID** 입력 프롬프트가 뜹니다
2. 모바일 앱에서 동일한 세션 ID를 입력하여 연결
3. PC와 모바일이 완전히 다른 네트워크에 있어도 연결 가능

자세한 내용은 [프로젝트 README](https://github.com/jaloveeye/cursor-remote)를 참조하세요.

### 릴레이 모드 (0.3.6 신규)

릴레이 모드를 사용하면 같은 네트워크가 아니어도 어디서든 연결할 수 있습니다.

#### 작동 방식

1. **세션 ID**: 첫 실행 시 6자리 영숫자 세션 ID 입력 프롬프트
2. **세션 저장**: 입력한 세션 ID는 자동 저장되어 다음 실행 시 재사용 (24시간 유효)
3. **모바일 연결**: 모바일 앱에서 동일한 세션 ID를 입력하여 연결
4. **하트비트**: 익스텐션이 30초마다 하트비트 전송, 2분간 응답 없으면 세션 해제

#### 명령어

| 명령어 | 설명 |
|--------|------|
| `Cursor Remote: 세션 ID로 릴레이 연결` | 다른 세션에 즉시 연결 |
| `Cursor Remote: 릴레이 세션 ID 설정` | 저장된 세션 ID 변경 (다음 실행 시 사용) |
| `Cursor Remote: 릴레이 서버 상태 확인` | 릴레이 서버 상태 확인 |

#### 세션 충돌

다른 PC에서 같은 세션 ID를 사용 중이면 **409 에러**가 발생합니다. 해결 방법:
- 다른 PC/Cursor 창 닫기
- 모바일에서 새 세션 생성 후 해당 세션 ID 사용

### 설정

현재 익스텐션은 내부 기본값을 사용합니다.

- WebSocket: `8766` (충돌 시 다음 사용 가능한 포트로 자동 시작)
- HTTP 훅 엔드포인트: `8768` (`POST /hook`, 로컬 전용)

### API

#### WebSocket API

WebSocket 서버에 연결하여 실시간으로 명령을 주고받을 수 있습니다.

```javascript
const ws = new WebSocket('ws://localhost:8766');

// 명령 전송
ws.send(JSON.stringify({
  type: 'execute_command',
  command: 'cursorRemote.toggle'
}));

// 응답 수신
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log(data);
};
```

#### HTTP Hook 엔드포인트

이 엔드포인트는 훅 기반 메시지 전달을 위한 내부 용도입니다.

```bash
curl -X POST http://localhost:8768/hook \
  -H "Content-Type: application/json" \
  -d '{"type":"chat_response","text":"example"}'
```

익스텐션에는 공개 `/status`, `/command` REST API가 없습니다.

### 개발

```bash
# 의존성 설치
npm install

# 컴파일
npm run compile

# 개발 모드 (자동 컴파일)
npm run watch

# VSIX 패키지 생성
npm run package
```

### 모바일 앱

Cursor Remote는 Flutter로 개발된 모바일 앱과 함께 사용할 수 있습니다.

- **Android**: APK 빌드 및 설치
- **iOS**: Xcode를 통한 빌드
- **Web**: Flutter Web으로 배포 가능

모바일 앱 소스 코드는 [GitHub 저장소](https://github.com/jaloveeye/cursor-remote/tree/main/mobile-app)에서 확인할 수 있습니다.

### 기여하기

기여를 환영합니다! 버그 리포트, 기능 제안, Pull Request 모두 환영합니다.

1. 이 저장소를 Fork합니다
2. 기능 브랜치를 생성합니다 (`git checkout -b feature/amazing-feature`)
3. 변경사항을 커밋합니다 (`git commit -m 'feat: Add amazing feature'`)
4. 브랜치에 푸시합니다 (`git push origin feature/amazing-feature`)
5. Pull Request를 엽니다

### 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다. 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.

### 문의 및 지원

- **Author**: 김형진 (<jaloveeye@gmail.com>)
- **Website**: <https://jaloveeye.com>
- **GitHub**: <https://github.com/jaloveeye/cursor-remote>
- **Issues**: [GitHub Issues](https://github.com/jaloveeye/cursor-remote/issues)

---

**Cursor Remote**로 어디서든 코딩하세요! 🚀
