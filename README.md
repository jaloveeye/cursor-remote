# Cursor Remote 📱

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)](https://github.com/jaloveeye/cursor-remote)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![Flutter](https://img.shields.io/badge/Flutter-3.0+-blue)](https://flutter.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green)](https://nodejs.org/)

**Control Cursor AI from Your Mobile Device**

> Code Anywhere, Anytime with Cursor CLI

모바일 기기에서 Cursor AI를 원격으로 제어할 수 있는 오픈소스 시스템입니다. Flutter 앱을 통해 PC의 Cursor CLI에 명령을 전송하고, AI 응답과 작업 결과를 실시간으로 확인할 수 있습니다.

## 🌟 주요 특징

- 📱 **모바일 제어**: 스마트폰이나 태블릿에서 Cursor AI 제어
- ⚡ **실시간 통신**: WebSocket 기반 양방향 실시간 통신
- 🤖 **CLI 통합**: Cursor CLI(`agent`)를 통한 AI 상호작용
- 🔄 **자동 동기화**: 모바일에서 입력한 내용이 PC에 실시간 반영
- 🌐 **크로스 플랫폼**: Android, iOS, Web 지원
- 🔒 **오픈소스**: MIT 라이선스, 자유롭게 사용 및 수정 가능

## 🎯 왜 Cursor Remote인가?

### 해결하는 문제

- 🏠 **집에서 편안하게**: 소파에 누워서도 모바일로 코드를 작성하고 AI와 대화
- 🚇 **이동 중에도**: 지하철이나 버스에서도 모바일로 간단한 코드 수정이나 AI 질문
- 💻 **PC 없이도**: Cursor CLI 모드를 사용하면 PC에 Cursor IDE가 실행되지 않아도 AI와 상호작용
- 🔄 **실시간 동기화**: 모바일에서 입력한 내용이 PC의 Cursor CLI에 실시간 반영
- 🤖 **AI 응답 확인**: Cursor AI의 응답을 모바일에서 실시간으로 확인

### 사용 사례

- **원격 개발**: 집이나 카페에서 모바일로 코드 작성 및 AI 질문
- **빠른 수정**: 외출 중에도 긴급한 코드 수정이나 버그 확인
- **AI 상호작용**: 모바일에서 Cursor AI와 대화하며 아이디어 구상
- **자동화**: CLI 모드를 통한 스크립트 및 CI/CD 통합
- **프레젠테이션**: 모바일에서 코드를 보여주며 설명

## ✨ 주요 기능

- 📝 **원격 코드 편집**: 모바일에서 Cursor AI에게 코드 작성 요청
- ⚡ **명령 실행**: Cursor CLI 명령을 모바일에서 실행
- 🤖 **AI 응답 확인**: Cursor AI의 응답을 모바일에서 실시간 확인
- 📊 **작업 결과 표시**: 파일 편집, 빌드 결과 등을 모바일에서 확인
- 🔐 **권한 관리**: 파일 접근, 명령 실행 등에 대한 권한 요청 및 응답
- 🔄 **실시간 통신**: WebSocket 기반 양방향 실시간 통신
- 🖥️ **CLI 모드**: Cursor CLI(`agent` 명령어)를 통해 AI와 통신

## 🏗️ 아키텍처

```
┌─────────────┐     WebSocket      ┌─────────────┐
│   Mobile    │◄──────────────────►│  PC Server   │
│     App     │     Port 8767       │  (Node.js)   │
└─────────────┘                    └──────┬──────┘
                                          │
                                          │ Extension API
                                          │ HTTP / WebSocket
                                          │
                                   ┌──────┴──────┐
                                   │  Extension  │
                                   │  (CLI Mode) │
                                   └──────┬──────┘
                                          │
                                          │ Process
                                          │
                                   ┌──────┴──────┐
                                   │ Cursor CLI  │
                                   │   (agent)   │
                                   └─────────────┘
```

### 연결 모드

| 모드 | 설명 | 네트워크 요구사항 |
|------|------|------------------|
| **로컬 모드** | PC와 모바일이 같은 Wi-Fi에 연결 | 동일 네트워크 |
| **릴레이 서버 모드** | 릴레이 서버를 통한 외부 접속 | 인터넷 연결 |

## 📂 프로젝트 구조

```
cursor-remote/
├── cursor-extension/    # Cursor Extension (TypeScript)
│   ├── src/
│   │   ├── extension.ts
│   │   ├── websocket-server.ts
│   │   ├── command-handler.ts
│   │   └── cli-handler.ts      # CLI 모드 핸들러
│   ├── package.json
│   └── README.md
├── pc-server/          # PC 브릿지 서버 (Node.js)
│   ├── src/
│   │   ├── server.ts
│   │   ├── cursor-api.ts
│   │   └── message-handler.ts
│   ├── package.json
│   └── README.md
├── mobile-app/         # 모바일 앱 (Flutter)
│   ├── lib/
│   │   ├── main.dart
│   │   ├── models/
│   │   ├── services/
│   │   └── widgets/
│   ├── pubspec.yaml
│   └── README.md
├── README.md
└── package.json
```

---

## 🚀 설치 및 설정

### 사전 요구사항

| 구성 요소 | 요구사항 |
|-----------|----------|
| **PC** | Node.js 18+ |
| **모바일** | Android 또는 iOS 기기 |
| **Cursor CLI** | 설치 및 인증 필수 |

---

## 🔧 Step 1: Cursor CLI 설치 및 인증

CLI 모드를 사용하기 위해 먼저 Cursor CLI를 설치하고 인증해야 합니다.

### 1.1 CLI 설치

```bash
curl https://cursor.com/install -fsS | bash
```

이 명령어는 `~/.local/bin/` 디렉토리에 CLI를 설치합니다.

### 1.2 PATH 설정

**Zsh 사용자 (macOS 기본):**

```bash
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

**Bash 사용자:**

```bash
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

### 1.3 설치 확인

```bash
which agent
# 또는
agent --version
```

### 1.4 인증 (필수)

**방법 1: 브라우저 로그인 (권장)**

```bash
agent login
```

브라우저가 열리면 Cursor 계정으로 로그인합니다. 인증 정보는 저장되므로 한 번만 로그인하면 됩니다.

**방법 2: API 키 사용 (자동화/CI용)**

```bash
# Cursor 웹사이트에서 API 키 생성 후
export CURSOR_API_KEY=your_api_key_here

# 영구 설정 (선택사항)
echo 'export CURSOR_API_KEY=your_api_key_here' >> ~/.zshrc
source ~/.zshrc
```

### 1.5 인증 상태 확인

```bash
agent status
```

인증이 완료되면:

```
✅ Authenticated as: your-email@example.com
```

### 1.6 CLI 테스트

```bash
agent -p --output-format json --force 'Hello, world!'
```

정상적으로 JSON 응답이 출력되면 CLI 설정 완료입니다.

---

## 🔧 Step 2: Cursor Extension 설치

### 2.1 Extension 빌드

```bash
cd cursor-extension
npm install
npm run compile
```

### 2.2 Cursor IDE에서 Extension 활성화

1. **Cursor IDE 실행**
2. **Extension 자동 활성화** (상태 표시줄에 구름 아이콘 확인)
3. **또는 수동 시작**: 명령 팔레트 (`Cmd+Shift+P` / `Ctrl+Shift+P`) → "Start Cursor Remote Server"

### 2.3 활성화 확인

- 상태 표시줄에 "Cursor Remote: Waiting" 또는 "Connected" 표시 확인
- Output 패널에서 "Cursor Remote extension is now active!" 메시지 확인

---

## 🔧 Step 3: PC 서버 설정

PC 서버는 모바일 앱과 Extension 간의 브릿지 역할을 합니다.

### 3.1 서버 빌드 및 실행

```bash
cd pc-server
npm install
npm run build
npm start
```

### 3.2 서버 시작 확인

터미널에 다음과 같은 메시지가 표시됩니다:

```
✅ Cursor Remote PC Server started!
📱 Mobile app should connect to: 192.168.0.10:8767
🔌 WebSocket server (Mobile): ws://192.168.0.10:8767
```

**⚠️ 중요**: 표시된 IP 주소 (예: `192.168.0.10`)를 메모하세요. 모바일 앱 연결에 필요합니다.

---

## 🔧 Step 4: 모바일 앱 설치

### 4.1 빌드 및 설치

**Android:**

```bash
cd mobile-app
flutter pub get
flutter build apk --release
# 생성된 APK 파일을 Android 기기에 설치
```

**iOS:**

```bash
cd mobile-app
flutter pub get
cd ios && export LANG=en_US.UTF-8 && pod install && cd ..
flutter build ios
# Xcode에서 실행 또는 TestFlight 배포
```

**개발 중 테스트:**

```bash
# USB로 연결된 기기에서 직접 실행
flutter run
```

---

## 📱 연결 설정

### 로컬 모드 (동일 Wi-Fi 네트워크)

PC와 모바일이 같은 Wi-Fi에 연결된 경우 사용합니다.

#### 설정 방법

1. **앱 실행**
2. **PC 서버 IP 입력** (예: `192.168.0.10`)
3. **포트 확인** (기본값: `8767`)
4. **"Connect" 버튼 클릭**

#### 연결 확인

- **모바일 앱**: 녹색 구름 아이콘 표시
- **PC 서버 터미널**: "📱 Mobile client connected" 메시지 확인

#### 네트워크 요구사항

| 항목 | 설명 |
|------|------|
| 동일 네트워크 | PC와 모바일이 같은 Wi-Fi에 연결 |
| 포트 개방 | PC 방화벽에서 포트 8767 허용 |
| IP 확인 | PC의 로컬 IP 주소 확인 필요 |

#### PC IP 주소 확인 방법

**macOS:**

```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```

**Windows:**

```cmd
ipconfig | findstr IPv4
```

**Linux:**

```bash
hostname -I
```

---

### 릴레이 서버 모드 (외부 네트워크)

PC와 모바일이 다른 네트워크에 있을 때 릴레이 서버를 통해 연결합니다.

#### 설정 방법

1. **릴레이 서버 URL 확인**
   - 기본 릴레이 서버: `https://relay.jaloveeye.com`
   - 환경 변수로 변경 가능: `RELAY_SERVER_URL`

2. **PC 서버 설정**

   ```bash
   # 환경 변수로 릴레이 서버 URL 설정 (선택사항)
   export RELAY_SERVER_URL=https://relay.jaloveeye.com
   cd pc-server
   npm start
   ```

3. **모바일 앱에서 연결**
   - 릴레이 서버 모드 선택
   - 릴레이 서버 URL 입력 (또는 기본값 사용)
   - 연결

#### 작동 방식

```
모바일 앱 → 릴레이 서버 → PC 서버 → Extension → Cursor CLI
```

릴레이 서버가 중간에서 메시지를 전달하므로, PC와 모바일이 서로 다른 네트워크에 있어도 연결할 수 있습니다.

#### 장점

- **포트 포워딩 불필요**: 라우터 설정 없이 사용 가능
- **보안**: 직접 포트 노출 없이 안전한 연결
- **간편함**: 복잡한 네트워크 설정 없이 바로 사용

---

## 🎮 사용 방법

### 기본 사용

1. **프롬프트 전송**: 모바일 앱의 입력창에 텍스트 입력 후 전송
2. **AI 응답 확인**: 모바일 앱에서 실시간으로 AI 응답 확인
3. **파일 변경 확인**: AI가 수정한 파일 내용 확인

### CLI 모드 작동 방식

프롬프트를 전송하면:

1. **Extension이 `agent` 명령어 실행**:

   ```bash
   agent -p --output-format json --force "프롬프트"
   ```

2. **CLI가 응답 생성**
3. **Extension이 응답 파싱 후 모바일 앱으로 전송**
4. **프로세스 종료**

### CLI 로그 확인

Cursor IDE의 Output 패널에서 "Cursor Remote" 채널을 선택하면 다음과 같은 로그를 확인할 수 있습니다:

```
[CLI] sendPrompt called - textLength: XX, execute: true
[CLI] Using CLI command: /Users/xxx/.local/bin/agent
[CLI] Executing: /Users/xxx/.local/bin/agent -p --output-format json --force "프롬프트"
[CLI] CLI stdout: {...}
[CLI] CLI process exited with code 0
```

---

## 📡 통신 프로토콜

### WebSocket 메시지 타입

| 타입 | 방향 | 설명 |
|------|------|------|
| `command` | App→Server | 명령 전송 요청 |
| `command_result` | Server→App | 명령 전송 결과 (에러 메시지 포함) |
| `insert_text` | App→Server | 에디터에 텍스트 삽입 |
| `execute_command` | App→Server | Cursor 명령 실행 |
| `ai_response` | Server→App | Cursor AI 응답 |
| `file_changed` | Server→App | 파일 변경 알림 |
| `permission_request` | Server→App | 권한 요청 알림 |
| `permission_response` | App→Server | 권한 응답 |

### 포트 정보

| 포트 | 프로토콜 | 용도 |
|------|----------|------|
| 8766 | WebSocket | Extension WebSocket 서버 (PC 서버가 클라이언트로 연결) |
| 8767 | WebSocket | 모바일 앱 ↔ PC 서버 (실시간 양방향 통신) |
| 8765 | HTTP | Extension → Server (명령 전달, 향후 확장용) |

---

## 🛠️ 문제 해결

### CLI 관련 문제

#### "command not found: agent" 오류

```bash
# 1. PATH 확인
echo $PATH | grep local

# 2. 직접 경로로 실행
~/.local/bin/agent --version

# 3. 심볼릭 링크 생성 (선택사항)
sudo ln -s ~/.local/bin/agent /usr/local/bin/agent
```

#### 인증 오류

```bash
# 로그아웃 후 다시 로그인
agent logout
agent login
```

### Extension 관련 문제

#### Extension이 시작되지 않는 경우

- Cursor IDE 재시작
- `npm run compile` 다시 실행
- Output 패널에서 에러 메시지 확인

### 서버 관련 문제

#### PC 서버가 Extension에 연결되지 않는 경우

```bash
# 포트 8766 충돌 확인
lsof -i :8766
```

### 모바일 앱 관련 문제

#### 연결되지 않는 경우

- PC와 모바일이 같은 Wi-Fi 네트워크에 있는지 확인
- PC 방화벽에서 포트 8767 허용
- PC 서버 IP 주소가 올바른지 확인

---

## 🛠️ 기술 스택

- **Cursor Extension**: TypeScript, VSCode Extension API
- **PC Server**: Node.js, WebSocket (ws)
- **Mobile App**: Flutter, Dart

---

## 📚 문서

모든 문서는 [docs/](./docs/) 폴더에 정리되어 있습니다.

### 주요 가이드

- [빠른 시작 가이드](./docs/guides/QUICK_START.md) - 빠른 설정 및 실행 방법
- [Extension 설치 가이드](./docs/guides/EXTENSION_SETUP.md) - Extension 설치 및 활성화
- [통신 프로토콜](./docs/guides/PROTOCOL.md) - WebSocket 메시지 형식 및 프로토콜
- [테스트 가이드](./docs/guides/TEST_GUIDE.md) - 전체 시스템 테스트 방법

### CLI 모드

- [CLI 모드 작동 원리](./docs/cli/CLI_MODE_HOW_IT_WORKS.md) - CLI 모드 동작 방식
- [Cursor CLI 가이드](./docs/cli/CURSOR_CLI_GUIDE.md) - Cursor CLI 사용법
- [CLI 인증 가이드](./docs/cli/CLI_AUTHENTICATION.md) - CLI 인증 방법

### 테스트

- [CLI 모드 테스트](./docs/testing/CLI_MODE_TEST.md) - CLI 모드 테스트 방법

### 문제 해결

- [CLI 모드 문제 해결](./docs/troubleshooting/CLI_MODE_NOT_WORKING_FIX.md) - CLI 모드 문제 해결

자세한 문서 목록은 [docs/README.md](./docs/README.md)를 참조하세요.

---

## 📝 개발 계획

### Phase 1: 기본 통신 인프라

- [ ] Cursor Extension 개발 (WebSocket 서버)
- [ ] PC 서버 개발 (브릿지)
- [ ] 모바일 앱 기본 UI
- [ ] 기본 명령 전송 (텍스트 삽입)

### Phase 2: 고급 기능

- [ ] AI 응답 스트리밍
- [ ] 파일 편집 기능
- [ ] 작업 결과 표시
- [ ] 권한 요청 시스템

### Phase 3: UX 개선

- [ ] 실시간 로그 표시
- [ ] 에러 처리 및 재시도
- [ ] 연결 상태 관리
- [ ] 대화 히스토리

---

## 🤝 기여하기

기여를 환영합니다! 버그 리포트, 기능 제안, Pull Request 모두 환영합니다.

1. 이 저장소를 Fork합니다
2. 기능 브랜치를 생성합니다 (`git checkout -b feature/amazing-feature`)
3. 변경사항을 커밋합니다 (`git commit -m 'feat: Add amazing feature'`)
4. 브랜치에 푸시합니다 (`git push origin feature/amazing-feature`)
5. Pull Request를 엽니다

### 기여 가이드라인

- 코드 스타일을 유지해주세요
- 의미 있는 커밋 메시지를 작성해주세요
- 새로운 기능은 테스트를 포함해주세요
- 문서를 업데이트해주세요

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다. 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.

## 📞 문의 및 지원

- **Author**: 김형진 (<jaloveeye@gmail.com>)
- **Website**: <https://jaloveeye.com>
- **GitHub**: <https://github.com/jaloveeye/cursor-remote>
- **Issues**: [GitHub Issues](https://github.com/jaloveeye/cursor-remote/issues)

---

**Made with ❤️ by [jaloveeye](https://jaloveeye.com)**

**작성 시간**: 2025년 1월 27일  
**최종 수정**: 2026년 1월 21일
