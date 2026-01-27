# Cursor Remote Skills

이 파일은 Cursor 2.4의 Skills 기능을 활용하여 Cursor Remote 프로젝트의 도메인별 워크플로우와 지식을 정의합니다.

## 📋 목차

1. [세션 관리](#세션-관리)
2. [대화 히스토리 조회](#대화-히스토리-조회)
3. [Extension 개발](#extension-개발)
4. [Flutter 앱 개발](#flutter-앱-개발)
5. [PC 서버 개발](#pc-서버-개발)
6. [테스트 및 디버깅](#테스트-및-디버깅)

---

## 세션 관리

### 개요
Cursor Remote는 클라이언트별 세션 격리를 지원합니다. 각 모바일 클라이언트는 독립적인 세션을 가지며, 세션 ID를 통해 대화 컨텍스트를 유지합니다.

### 주요 개념
- **clientId**: 각 WebSocket 연결마다 생성되는 고유 클라이언트 식별자
- **sessionId**: Cursor CLI의 대화 세션 ID (UUID 형식)
- **세션 격리**: 클라이언트별로 독립적인 세션 관리

### 워크플로우

#### 새 세션 시작
```typescript
// Extension에서 새 세션 시작
await cliHandler.sendPrompt(text, true, clientId, true); // newSession: true
```

#### 기존 세션 재개
```typescript
// Extension에서 기존 세션 재개
await cliHandler.sendPrompt(text, true, clientId, false); // newSession: false
// 자동으로 --resume <sessionId> 사용
```

#### 세션 정보 조회
```typescript
// Extension에서 세션 정보 조회
const sessionInfo = await cliHandler.getSessionInfo(clientId);
// 반환: { clientId, currentSessionId, hasSession }
```

### 관련 파일
- `cursor-extension/src/cli-handler.ts`: 세션 관리 핵심 로직
- `cursor-extension/src/websocket-server.ts`: clientId 생성 및 관리
- `mobile-app/lib/main.dart`: 클라이언트에서 세션 제어

### 명령어
- `/session-info`: 현재 세션 정보 조회
- `/new-session`: 새 세션 시작
- `/continue-session`: 기존 세션 재개

---

## 대화 히스토리 조회

### 개요
모든 대화는 `.cursor/CHAT_HISTORY.json` 파일에 저장되며, 클라이언트별로 필터링하여 조회할 수 있습니다.

### 데이터 구조
```typescript
interface ChatHistory {
  entries: ChatHistoryEntry[];
  lastUpdated: string;
}

interface ChatHistoryEntry {
  id: string;
  sessionId: string;
  clientId: string;
  userMessage: string;
  assistantResponse: string;
  timestamp: string;
}
```

### 워크플로우

#### 히스토리 저장
1. 사용자 메시지 전송 시: `pending-{timestamp}-{random}` ID로 저장
2. 응답 수신 시: 실제 `sessionId`로 업데이트
3. 자동 저장: `.cursor/CHAT_HISTORY.json` 파일에 JSON 형식으로 저장

#### 히스토리 조회
```typescript
// Extension에서 히스토리 조회
const history = cliHandler.getChatHistory(clientId, sessionId, limit);
// clientId가 없으면 모든 최근 히스토리 반환
```

#### 히스토리 형식 변환
- 기존 배열 형식: `[{ user, assistant, timestamp }]`
- 새 형식: `{ entries: [...], lastUpdated: "..." }`
- 자동 변환 지원

### 관련 파일
- `cursor-extension/src/cli-handler.ts`: 히스토리 저장/조회 로직
- `.cursor/CHAT_HISTORY.json`: 히스토리 저장 파일

### 명령어
- `/chat-history [sessionId]`: 대화 히스토리 조회
- `/refresh-history`: 히스토리 새로고침

---

## Extension 개발

### 개요
Cursor Extension은 TypeScript로 작성되며, VS Code Extension API를 사용합니다.

### 프로젝트 구조
```
cursor-extension/
├── src/
│   ├── extension.ts          # Extension 진입점
│   ├── websocket-server.ts    # WebSocket 서버
│   ├── command-handler.ts     # 명령 처리
│   ├── command-router.ts      # 명령 라우팅
│   ├── cli-handler.ts         # Cursor CLI 상호작용
│   └── types.ts               # 타입 정의
├── package.json
└── tsconfig.json
```

### 개발 워크플로우

#### 컴파일
```bash
cd cursor-extension
npm run compile
```

#### 테스트
1. Extension 개발 모드 실행 (F5)
2. 새 Extension Host 창에서 테스트
3. Output 패널에서 로그 확인

#### 주요 포트
- WebSocket: 8766 (기본, 사용 가능한 포트로 자동 변경)
- HTTP: 8768 (hook용)

### 주요 기능
- **WebSocket 서버**: 모바일 클라이언트와 통신
- **CLI 모드**: Cursor CLI (`agent`)와 상호작용
- **세션 관리**: 클라이언트별 세션 격리
- **히스토리 저장**: 대화 히스토리 자동 저장

### 명령어
- `/extension-reload`: Extension 재로드
- `/extension-logs`: Extension 로그 확인
- `/test-connection`: 연결 테스트

---

## Flutter 앱 개발

### 개요
모바일 앱은 Flutter로 작성되며, Android, iOS, Web을 지원합니다.

### 프로젝트 구조
```
mobile-app/
├── lib/
│   └── main.dart              # 메인 앱
├── pubspec.yaml
└── README.md
```

### 개발 워크플로우

#### 의존성 설치
```bash
cd mobile-app
flutter pub get
```

#### iOS 빌드 (macOS)
```bash
cd mobile-app/ios
export LANG=en_US.UTF-8
pod install
cd ../..
```

#### 실행
```bash
flutter run
```

### 주요 기능
- **로컬 연결**: 같은 Wi-Fi 네트워크에서 WebSocket 연결
- **릴레이 연결**: 외부 네트워크에서 HTTP 폴링 방식
- **세션 관리**: 세션 정보 및 히스토리 조회
- **실시간 통신**: WebSocket 또는 HTTP 폴링

### 연결 모드

#### 로컬 모드
- PC 서버 IP 주소 입력
- WebSocket 직접 연결
- 실시간 양방향 통신

#### 릴레이 모드
- 세션 ID 입력 또는 생성
- HTTP 폴링 방식
- 인터넷 연결 필요

### 명령어
- `/connect-local <ip>`: 로컬 서버 연결
- `/connect-relay [sessionId]`: 릴레이 서버 연결
- `/disconnect`: 연결 종료

---

## PC 서버 개발

### 개요
PC 서버는 Node.js로 작성되며, Extension과 모바일 앱 사이의 브릿지 역할을 합니다.

### 프로젝트 구조
```
pc-server/
├── src/
│   ├── server.ts              # 메인 서버
│   ├── config.ts              # 설정
│   └── utils.ts               # 유틸리티
├── package.json
└── tsconfig.json
```

### 개발 워크플로우

#### 실행
```bash
cd pc-server
npm start [sessionId]  # sessionId는 선택사항 (릴레이 모드용)
```

#### 주요 포트
- WebSocket (모바일): 8767
- HTTP: 8765

### 주요 기능
- **Extension 연결**: Extension의 WebSocket 서버에 연결
- **모바일 연결**: 모바일 클라이언트의 WebSocket 연결 수신
- **메시지 라우팅**: Extension ↔ 모바일 간 메시지 전달
- **로컬/릴레이 모드**: 연결 방식에 따라 모드 전환

### 명령어
- `/server-start`: 서버 시작
- `/server-stop`: 서버 종료
- `/server-status`: 서버 상태 확인

---

## 테스트 및 디버깅

### 테스트 워크플로우

#### 1. Extension 테스트
```bash
# Extension 개발 모드 실행
# F5 키 또는 "Run Extension" 명령
```

#### 2. PC 서버 테스트
```bash
cd pc-server
npm start
# 로그에서 연결 상태 확인
```

#### 3. 모바일 앱 테스트
```bash
cd mobile-app
flutter run
# 로컬 IP 또는 릴레이 세션 ID로 연결
```

### 디버깅 팁

#### Extension 로그
- Output 패널: "Cursor Remote" 채널
- 로그 레벨: INFO, ERROR
- 주요 로그: 연결, 메시지 수신/전송, CLI 실행

#### PC 서버 로그
- 콘솔 출력
- 주요 로그: Extension 연결, 모바일 연결, 메시지 라우팅

#### 모바일 앱 로그
- Flutter DevTools
- 주요 로그: 연결 상태, 메시지 수신/전송

### 일반적인 문제

#### 포트 충돌
- Extension: 8766 포트가 사용 중이면 자동으로 다음 포트 사용
- PC 서버: 8767 포트 확인

#### 세션 문제
- `clientId`가 없으면 히스토리 조회 실패
- 첫 메시지 응답 후 `clientId` 설정됨
- 연결 직후에는 모든 최근 히스토리 조회 가능

#### 히스토리 형식 문제
- 기존 배열 형식은 자동으로 새 형식으로 변환
- `.cursor/CHAT_HISTORY.json` 파일 확인

### 명령어
- `/test-all`: 전체 시스템 테스트
- `/debug-session`: 세션 디버깅
- `/debug-history`: 히스토리 디버깅

---

## 커스텀 스크립트

### 세션 정보 조회 스크립트
```bash
#!/bin/bash
# .cursor/get-session-info.sh
cat .cursor/CHAT_HISTORY.json | jq '.entries | group_by(.clientId) | map({clientId: .[0].clientId, sessions: [.[].sessionId] | unique})'
```

### 히스토리 정리 스크립트
```bash
#!/bin/bash
# .cursor/clean-history.sh
# 100개 이상의 엔트리 제거 (최신 100개만 유지)
node -e "
const fs = require('fs');
const history = JSON.parse(fs.readFileSync('.cursor/CHAT_HISTORY.json', 'utf8'));
if (history.entries.length > 100) {
  history.entries = history.entries.slice(-100);
  history.lastUpdated = new Date().toISOString();
  fs.writeFileSync('.cursor/CHAT_HISTORY.json', JSON.stringify(history, null, 2));
  console.log('History cleaned: kept latest 100 entries');
}
"
```

---

## 참고 자료

- [Cursor CLI 가이드](./docs/cli/CURSOR_CLI_GUIDE.md)
- [세션 관리 테스트](./docs/testing/SESSION_MANAGEMENT_TEST.md)
- [프로토콜 문서](./docs/guides/PROTOCOL.md)
- [빠른 시작 가이드](./docs/guides/QUICK_START.md)

---

**마지막 업데이트**: 2026-01-26
**Cursor 버전**: 2.4+
