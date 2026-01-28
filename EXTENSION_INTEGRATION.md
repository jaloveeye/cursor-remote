# Extension에 PC Server 기능 통합

## 개요

Extension에 PC Server 기능을 통합하여 별도의 PC Server 프로세스를 시작하지 않고도 사용할 수 있도록 개선했습니다.

## 동작 방식

### ✅ 원격 모드 (릴레이 서버) - 완전 지원

1. **Extension 활성화**
   - Cursor IDE 시작 시 Extension 자동 활성화
   - WebSocket 서버 자동 시작 (포트 8766)
   - RelayClient 자동 시작

2. **세션 자동 감지**
   - RelayClient가 2초마다 세션 자동 감지
   - 모바일 클라이언트가 세션 생성하면 자동으로 연결

3. **메시지 전달**
   - 모바일 → 릴레이 서버 → Extension → Cursor CLI
   - 응답은 역순으로 전달

**결과**: PC Server 없이 완전히 동작 ✅

### ⚠️ 로컬 모드 - 부분 지원

현재 상태:
- Extension의 WebSocket 서버(포트 8766)에 직접 연결하면 로컬 모드로 사용 가능
- 하지만 모바일 앱은 현재 PC Server의 로컬 WebSocket 서버(포트 8767)에 연결하도록 되어 있음

**개선 필요**:
- 모바일 앱을 수정하여 Extension의 WebSocket 서버(포트 8766)에 직접 연결하도록 변경
- 또는 Extension에서 로컬 모드용 추가 WebSocket 서버(포트 8767) 제공

## 사용 방법

### 원격 모드 (권장)

1. **Extension 활성화** (자동)
   - Cursor IDE 시작 시 자동 활성화
   - 별도 설정 불필요

2. **모바일 클라이언트 연결**
   - 모바일 앱에서 "릴레이 모드" 선택
   - "새 세션 생성" 클릭
   - Extension이 자동으로 세션 감지하여 연결 (최대 10초)

3. **작업 시작**
   - 모바일 앱에서 명령 전송
   - Extension이 자동으로 처리

### 로컬 모드 (현재 제한적)

현재는 PC Server를 별도로 시작해야 합니다. 향후 개선 예정.

## 기술적 세부사항

### RelayClient 클래스

- **위치**: `cursor-extension/src/relay-client.ts`
- **기능**:
  - 세션 자동 감지 (`discoverSession`)
  - 메시지 폴링 (`pollMessages`)
  - 릴레이 서버와 통신 (`sendMessage`, `connectToSession`)

### 메시지 흐름

```
모바일 클라이언트
    ↓ (릴레이 서버)
RelayClient (Extension)
    ↓ (WebSocket)
Extension WebSocket Server
    ↓ (CommandRouter)
CommandHandler
    ↓ (Cursor CLI)
Cursor CLI
```

### HTTP 요청

- Node.js의 `http`/`https` 모듈 사용
- `fetch` API 대신 Node.js 네이티브 모듈 사용 (VSCode Extension 환경 호환성)

## 장점

1. **간편한 사용**: PC Server 별도 시작 불필요
2. **자동 연결**: 세션 자동 감지 및 연결
3. **원격 작업**: 어디서든 모바일로 작업 가능
4. **단일 프로세스**: Extension 하나로 모든 기능 제공

## 제한사항

1. **로컬 모드**: 현재는 PC Server 필요 (향후 개선 예정)
2. **네트워크 의존성**: 릴레이 서버 접근 필요
3. **세션 감지 시간**: 최대 10초 소요 (폴링 간격 2초)

## 작성 시간
2026-01-28
