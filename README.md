# Cursor Remote 📱

**Control Cursor IDE from Your Mobile Device**

> Code Anywhere, Anytime with Cursor IDE

모바일 기기에서 Cursor IDE를 원격으로 제어할 수 있는 시스템입니다. Flutter 앱을 통해 PC의 Cursor IDE에 명령을 전송하고, AI 응답과 작업 결과를 실시간으로 확인할 수 있습니다.

## 🎯 프로젝트 목적

Cursor Remote는 개발자가 **모바일 기기에서도 Cursor IDE를 원격으로 제어**할 수 있도록 하는 오픈소스 프로젝트입니다.

### 해결하는 문제

- 🏠 **집에서 편안하게**: 소파에 누워서도 모바일로 코드를 작성하고 AI와 대화할 수 있습니다
- 🚇 **이동 중에도**: 지하철이나 버스에서도 모바일로 간단한 코드 수정이나 AI 질문이 가능합니다
- 💻 **PC 없이도**: Cursor CLI 모드를 사용하면 PC에 Cursor IDE가 실행되지 않아도 AI와 상호작용할 수 있습니다
- 🔄 **실시간 동기화**: 모바일에서 입력한 내용이 PC의 Cursor IDE에 실시간으로 반영됩니다
- 🤖 **AI 응답 확인**: Cursor AI의 응답을 모바일에서 실시간으로 확인할 수 있습니다

### 주요 사용 사례

1. **원격 개발**: 집이나 카페에서 모바일로 코드 작성 및 AI 질문
2. **빠른 수정**: 외출 중에도 긴급한 코드 수정이나 버그 확인
3. **AI 상호작용**: 모바일에서 Cursor AI와 대화하며 아이디어 구상
4. **자동화**: CLI 모드를 통한 스크립트 및 CI/CD 통합

## ✨ 주요 기능

- 📝 **원격 코드 편집**: 모바일에서 Cursor IDE 에디터에 텍스트 입력
- ⚡ **명령 실행**: Cursor IDE 명령을 모바일에서 실행
- 🤖 **AI 응답 확인**: Cursor AI의 응답을 모바일에서 실시간 확인
- 📊 **작업 결과 표시**: 파일 편집, 빌드 결과 등을 모바일에서 확인
- 🔐 **권한 관리**: 파일 접근, 명령 실행 등에 대한 권한 요청 및 응답
- 🔄 **실시간 통신**: WebSocket 기반 양방향 실시간 통신
- 🖥️ **CLI 모드 지원**: Cursor IDE 대신 Cursor CLI(`agent` 명령어)와 통신 가능

## 🏗️ 아키텍처

### IDE 모드 (기본)
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
                                   │  Cursor IDE │
                                   │  Extension  │
                                   └─────────────┘
```

### CLI 모드
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

## 📂 프로젝트 구조

```
cursor-remote/
├── cursor-extension/    # Cursor IDE 확장 (TypeScript)
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

## 🚀 사용 방법

### 전체 설치 및 실행 가이드

#### 1단계: 사전 요구사항

- **PC**: Node.js 18+ 설치 필요
- **모바일**: Android 또는 iOS 기기
- **Cursor IDE**: Cursor IDE 설치 (IDE 모드 사용 시)
- **Cursor CLI**: Cursor CLI 설치 (CLI 모드 사용 시, 선택사항)

#### 2단계: Cursor Extension 설치

```bash
# 프로젝트 루트에서
cd cursor-extension
npm install
npm run compile
```

**Cursor IDE에서 Extension 활성화:**
1. Cursor IDE 실행
2. Extension이 자동으로 활성화됨 (상태 표시줄에 구름 아이콘 확인)
3. 또는 명령 팔레트 (`Cmd+Shift+P` / `Ctrl+Shift+P`) → "Start Cursor Remote Server"

**확인 방법:**
- 상태 표시줄에 "Cursor Remote: Waiting" 또는 "Connected" 표시 확인
- Output 패널에서 "Cursor Remote extension is now active!" 메시지 확인

#### 3단계: PC 서버 실행

```bash
# 새 터미널에서
cd pc-server
npm install
npm run build
npm start
```

**서버 시작 확인:**
- 터미널에 다음과 같은 메시지가 표시됩니다:
  ```
  ✅ Cursor Remote PC Server started!
  📱 Mobile app should connect to: 192.168.0.10:8767
  🔌 WebSocket server (Mobile): ws://192.168.0.10:8767
  ```
- 표시된 IP 주소를 메모하세요 (예: `192.168.0.10`)

#### 4단계: 모바일 앱 설정

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
flutter build ios
# Xcode에서 실행 또는 TestFlight 배포
```

**개발 중 테스트:**
```bash
# USB로 연결된 기기에서 직접 실행
flutter run
```

#### 5단계: 모바일 앱에서 연결

1. **앱 실행**
2. **연결 모드 선택**:
   - **로컬 모드**: PC와 모바일이 같은 Wi-Fi에 연결된 경우
     - PC 서버 IP 주소 입력 (예: `192.168.0.10`)
     - "Connect" 버튼 클릭
   - **릴레이 모드**: 인터넷을 통한 원격 연결 (향후 지원)
3. **연결 확인**:
   - 연결 성공 시 녹색 구름 아이콘 표시
   - PC 서버 터미널에 "📱 Mobile client connected" 메시지 확인

#### 6단계: 사용하기

**기본 사용:**
1. **텍스트 입력**: 모바일 앱의 입력창에 텍스트 입력 후 전송
2. **터미널 명령**: `terminal: true` 옵션으로 터미널에 명령 전송
3. **AI 프롬프트**: `prompt: true` 옵션으로 Cursor AI에 질문
4. **AI 응답 확인**: 모바일 앱에서 실시간으로 AI 응답 확인

**고급 사용:**
- 자세한 사용법은 [빠른 시작 가이드](./docs/guides/QUICK_START.md) 참조
- CLI 모드 사용법은 [CLI 모드 가이드](./docs/cli/CLI_MODE_HOW_IT_WORKS.md) 참조

### CLI 모드 사용 (선택사항)

CLI 모드를 사용하면 Cursor IDE가 실행되지 않아도 Cursor CLI를 통해 AI와 상호작용할 수 있습니다.

**설정 방법:**

1. **Cursor CLI 설치** (아직 설치하지 않은 경우):
   ```bash
   curl https://cursor.com/install -fsS | bash
   ```

2. **CLI 인증** (처음 사용 시):
   ```bash
   agent login
   ```

3. **CLI 모드 활성화**:
   - Cursor IDE에서 설정 열기 (`Cmd+,` / `Ctrl+,`)
   - "Cursor Remote" 검색
   - "Use CLI Mode" 옵션 활성화
   - Extension 재시작

**CLI 모드의 장점:**
- Cursor IDE 실행 불필요
- 자동화 및 스크립트 통합 용이
- 헤드리스 환경에서 사용 가능

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

## 🛠️ 기술 스택

- **Cursor Extension**: TypeScript, VSCode Extension API
- **PC Server**: Node.js, WebSocket (ws)
- **Mobile App**: Flutter, Dart

## 📝 개발 계획

### Phase 1: 기본 통신 인프라

- [ ] Cursor 확장 개발 (WebSocket 서버)
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

## 📚 문서

모든 문서는 [docs/](./docs/) 폴더에 정리되어 있습니다.

### 주요 가이드
- [빠른 시작 가이드](./docs/guides/QUICK_START.md) - 빠른 설정 및 실행 방법
- [Extension 설치 가이드](./docs/guides/EXTENSION_SETUP.md) - Extension 설치 및 활성화
- [통신 프로토콜](./docs/guides/PROTOCOL.md) - WebSocket 메시지 형식 및 프로토콜
- [테스트 가이드](./docs/guides/TEST_GUIDE.md) - 전체 시스템 테스트 방법
- [Cursor 설정 가이드](./docs/guides/CURSOR_SETTINGS_GUIDE.md) - Cursor IDE 설정 방법

### 테스트
- [Rules 기반 채팅 캡처 테스트](./docs/testing/RULES_BASED_CHAT_TEST_GUIDE.md) - Rules 기반 실시간 채팅 캡처 테스트
- [CLI 모드 테스트](./docs/testing/CLI_MODE_TEST.md) - CLI 모드 테스트 방법

### 문제 해결
- [Hook 문제 해결](./docs/troubleshooting/HOOK_TROUBLESHOOTING.md) - Hook 관련 문제 해결
- [CLI 모드 문제 해결](./docs/troubleshooting/CLI_MODE_NOT_WORKING_FIX.md) - CLI 모드 문제 해결

### CLI 모드
- [CLI 모드 작동 원리](./docs/cli/CLI_MODE_HOW_IT_WORKS.md) - CLI 모드 동작 방식
- [Cursor CLI 가이드](./docs/cli/CURSOR_CLI_GUIDE.md) - Cursor CLI 사용법

자세한 문서 목록은 [docs/README.md](./docs/README.md)를 참조하세요.

## 📄 라이선스

이 프로젝트는 MIT 라이선스를 따릅니다.

---

## 🔧 CLI 모드 vs IDE 모드

| 기능 | IDE 모드 | CLI 모드 |
|------|---------|---------|
| Cursor IDE 필요 | ✅ 필수 | ❌ 불필요 |
| Cursor CLI 필요 | ❌ 불필요 | ✅ 필수 |
| 채팅 패널 사용 | ✅ 사용 | ❌ 미사용 |
| 프로세스 실행 | ❌ | ✅ |
| 자동화 친화적 | ⚠️ 제한적 | ✅ 우수 |
| 스크립트 통합 | ⚠️ 어려움 | ✅ 쉬움 |

**권장 사용 사례:**
- **IDE 모드**: 일반적인 개발 작업, IDE 기능 활용
- **CLI 모드**: 자동화, CI/CD, 스크립트, 헤드리스 환경

---

**작성자**: 김형진 (jaloveeye@gmail.com)  
**웹사이트**: https://jaloveeye.com  
**작성 시간**: 2025년 1월 27일  
**수정 시간**: 2026년 1월 21일
