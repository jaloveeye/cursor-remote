# 릴레이 서버 테스트 가이드

**작성**: 2026-02-02  
**수정**: 2026-02-02

## 1. 자동 테스트 (스크립트)

### 전체 플로우 (기존)

```bash
node test-relay-full.js
```

- Health → 세션 생성 → 모바일/PC 연결 → 메시지 송수신 → 통과 여부 확인

### sessions-waiting-for-pc / pcLastSeenAt (추가)

```bash
# 기본 URL (relay.jaloveeye.com)
node test-relay-sessions-waiting.js

# URL 지정
node test-relay-sessions-waiting.js https://relay.jaloveeye.com
```

- 모바일만 연결 시 → `GET /api/sessions-waiting-for-pc` 에 세션 포함되는지
- PC 연결·폴링 후 → 같은 세션이 대기 목록에서 제외되는지
- `GET /api/debug-sessions` 로 totalSessions / waitingForPc 확인

### PIN 설정·검증 (API)

```bash
# 기본 URL (relay.jaloveeye.com) — 릴레이 서버가 PIN 지원 버전으로 배포되어 있어야 함
node test-relay-pin.js

# URL 지정
node test-relay-pin.js https://relay.jaloveeye.com

# 로컬 서버 (relay-server에서 npm run dev 실행 후)
RELAY_SERVER_URL=http://localhost:3000 node test-relay-pin.js
```

- PC 연결 시 `pin` 전달 → 세션에 `pcPinHash` 저장
- 모바일 연결 시 `pin` 없음 → 403 `PIN_REQUIRED`
- 모바일 연결 시 잘못된 `pin` → 403 `INVALID_PIN`
- 모바일 연결 시 올바른 `pin` → 200

---

## 2. 수동 테스트 (실제 기기)

### 전제

- 릴레이 서버 배포 완료 (Vercel + Upstash Redis)
- 모바일 앱·Cursor 익스텐션이 같은 `RELAY_SERVER_URL` 사용

### A. 기본: 모바일 → PC 발견

1. **모바일**: 앱 실행 → "새 세션" → 세션 생성 후 "세션에 연결"
2. **PC**: Cursor 실행 → Cursor Remote 익스텐션 로드 → Output에서 "Relay client started" 확인
3. **기대**: 수 초 내 Output에 "세션 발견 → XXXXXX" 로그, 상태바에 릴레이 연결 표시
4. **실패 시**: 명령 팔레트 → "Cursor Remote: 릴레이 서버 상태 확인" 실행 후 `totalSessions`, `waitingForPc` 확인

### B. PC 끊김 후 재접속 (stale 2분)

1. **준비**: A까지 완료 (모바일·PC 같은 세션으로 연결됨)
2. **PC**: Cursor 완전 종료 (leave API 미호출 → pcDeviceId 유지)
3. **모바일**: 같은 세션으로 유지 또는 앱 재실행 후 "가장 최근 세션"으로 재접속
4. **대기**: **2분** 동안 PC 쪽에서 폴링 없음 → 서버에서 해당 PC를 stale로 간주
5. **PC**: Cursor 다시 실행 → 익스텐션 로드
6. **기대**: 2분 이후에는 `sessions-waiting-for-pc` 에 세션이 포함되어, 새 PC가 세션 발견·연결 가능

### C. PC 유지 중 모바일 재접속 (세션은 대기 목록에 없음)

1. **준비**: 모바일·PC 같은 세션으로 연결, PC는 Cursor 켜 둔 상태 (폴링 계속됨)
2. **모바일**: 앱에서 같은 세션 재접속 또는 "다른 세션 → 다시 이 세션" 등
3. **기대**: `GET /api/sessions-waiting-for-pc` 에 이 세션은 **나오지 않음** (pcLastSeenAt이 계속 갱신되므로)
4. **확인**: 브라우저에서 `https://relay.jaloveeye.com/api/debug-sessions` 열어 `waitingForPc` 에 해당 세션이 포함되지 않음

### D. PIN 설정·검증 (세션 ID만으로 타인 접속 방지)

1. **PC(익스텐션)**  
   - Cursor 실행 → Cursor Remote 익스텐션 로드  
   - 세션 ID 입력 프롬프트에 **6자 세션 ID** 입력 (예: 새로 만들 세션용 `XXXXXX` 또는 모바일에서 미리 생성한 ID)  
   - PIN 입력 프롬프트에 **4~6자리 PIN** 입력 (예: `1234`) → 연결  
   - Output에 "PIN 설정됨, 모바일에서 PIN 입력 필요" 확인

2. **모바일 – PIN 없이 접속 (실패)**  
   - 앱에서 **같은 세션 ID** 입력 후 연결  
   - **기대**: "PIN 입력" 다이얼로그 표시 → 취소 시 연결 안 됨

3. **모바일 – 잘못된 PIN (실패)**  
   - 같은 세션 ID로 연결 → PIN 다이얼로그에서 **잘못된 PIN** (예: `0000`) 입력  
   - **기대**: "PIN이 올바르지 않습니다" 메시지

4. **모바일 – 올바른 PIN (성공)**  
   - 같은 세션 ID로 연결 → PIN 다이얼로그에서 **PC에서 설정한 PIN** (예: `1234`) 입력  
   - **기대**: 연결 성공, 채팅·명령 정상 동작

5. **PIN 없이 세션 (하위 호환)**  
   - PC에서 세션 연결 시 PIN 입력을 **비워 두고** 연결  
   - 모바일에서는 **세션 ID만**으로 연결 가능 (PIN 다이얼로그 없음)

---

## 3. API만 빠르게 확인

```bash
# 서버 상태
curl -s https://relay.jaloveeye.com/api/health | jq .

# PC 대기 세션 목록
curl -s https://relay.jaloveeye.com/api/sessions-waiting-for-pc | jq .

# 디버그 (totalSessions, waitingForPc, hint)
curl -s https://relay.jaloveeye.com/api/debug-sessions | jq .
```

---

## 4. 로컬에서 릴레이 서버 띄워서 테스트

```bash
cd relay-server
cp .env.example .env.local   # Upstash URL/TOKEN 입력
npm install
npm run dev
```

- 로컬 URL (예: `http://localhost:3000`) 을 모바일 앱·익스텐션 설정에서 사용하거나, 테스트 스크립트에 전달:

```bash
RELAY_SERVER_URL=http://localhost:3000 node test-relay-sessions-waiting.js
```
