# Cursor Remote 📱

**Control Cursor IDE from Your Mobile Device**

> Code Anywhere, Anytime with Cursor IDE

모바일 기기에서 Cursor IDE를 원격으로 제어할 수 있는 시스템입니다. Flutter 앱을 통해 PC의 Cursor IDE에 명령을 전송하고, AI 응답과 작업 결과를 실시간으로 확인할 수 있습니다.

## ✨ 주요 기능

- 📝 **원격 코드 편집**: 모바일에서 Cursor IDE 에디터에 텍스트 입력
- ⚡ **명령 실행**: Cursor IDE 명령을 모바일에서 실행
- 🤖 **AI 응답 확인**: Cursor AI의 응답을 모바일에서 실시간 확인
- 📊 **작업 결과 표시**: 파일 편집, 빌드 결과 등을 모바일에서 확인
- 🔐 **권한 관리**: 파일 접근, 명령 실행 등에 대한 권한 요청 및 응답
- 🔄 **실시간 통신**: WebSocket 기반 양방향 실시간 통신

## 🏗️ 아키텍처

```
┌─────────────┐     WebSocket      ┌─────────────┐
│   Mobile    │◄──────────────────►│  PC Server   │
│     App     │     Port 8766       │  (Node.js)   │
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

## 📂 프로젝트 구조

```
cursor-remote/
├── cursor-extension/    # Cursor IDE 확장 (TypeScript)
│   ├── src/
│   │   ├── extension.ts
│   │   ├── websocket-server.ts
│   │   └── command-handler.ts
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

## 🚀 시작하기

### 1. Cursor IDE 확장 설치

```bash
cd cursor-extension
npm install
npm run compile
```

Cursor IDE에서 확장을 로드합니다.

### 2. PC 서버 실행

```bash
cd pc-server
npm install
npm start
```

서버 시작 시 표시되는 IP 주소를 확인하세요.

### 3. 모바일 앱 빌드

```bash
cd mobile-app
flutter pub get
flutter build apk
```

생성된 APK를 핸드폰에 설치하세요.

### 4. 앱 연결

1. 앱에서 서버 주소 입력 (예: `192.168.0.10`)
2. Connect 버튼 클릭
3. 연결 성공 시 녹색 구름 아이콘 표시

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

- [빠른 시작 가이드](./QUICK_START.md) - 빠른 설정 및 실행 방법
- [Extension 설치 가이드](./EXTENSION_SETUP.md) - Extension 설치 및 활성화
- [일반 테스트 가이드](./TEST_GUIDE.md) - 전체 시스템 테스트 방법
- [Rules 기반 채팅 캡처 테스트 가이드](./RULES_BASED_CHAT_TEST_GUIDE.md) - Rules 기반 실시간 채팅 캡처 테스트
- [통신 프로토콜](./PROTOCOL.md) - WebSocket 메시지 형식 및 프로토콜

## 📄 라이선스

이 프로젝트는 MIT 라이선스를 따릅니다.

---

**작성 시간**: 2026년 1월 19일  
**수정 시간**: 2026년 1월 19일
