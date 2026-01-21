# Cursor Remote Relay Server

Vercel에 배포하여 사용하는 Cursor Remote 중계 서버입니다.

로컬 네트워크 제한 없이 인터넷을 통해 모바일 앱과 PC를 연결할 수 있습니다.

## 아키텍처

```
┌─────────────┐                    ┌─────────────────┐                    ┌─────────────┐
│   Mobile    │◄── HTTP/SSE ──────►│  Vercel Relay   │◄── HTTP/SSE ──────►│  PC Server  │
│     App     │                    │     Server      │                    │  (Node.js)  │
└─────────────┘                    │                 │                    └──────┬──────┘
                                   │  ┌───────────┐  │                           │
                                   │  │  Upstash  │  │                           │
                                   │  │   Redis   │  │                    ┌──────┴──────┐
                                   │  └───────────┘  │                    │  Cursor IDE │
                                   └─────────────────┘                    │  Extension  │
                                                                          └─────────────┘
```

## 기능

- **세션 기반 연결**: 6자리 세션 코드로 PC와 모바일 연결
- **메시지 중계**: PC ↔ 모바일 간 양방향 메시지 전달
- **SSE 스트림**: 실시간 메시지 수신 (Server-Sent Events)
- **HTTP Polling**: SSE 지원이 어려운 환경을 위한 폴백

## API 엔드포인트

| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/api/health` | GET | 서버 상태 확인 |
| `/api/session` | POST | 새 세션 생성 |
| `/api/session?sessionId=XXX` | GET | 세션 정보 조회 |
| `/api/connect` | POST | 세션에 디바이스 연결 |
| `/api/send` | POST | 메시지 전송 |
| `/api/poll` | GET | 메시지 폴링 |
| `/api/stream` | GET | SSE 스트림 연결 |

## 배포 방법

### 1. Upstash Redis 설정

1. [Upstash Console](https://console.upstash.com)에서 계정 생성
2. 새 Redis 데이터베이스 생성
3. REST API URL과 Token 복사

### 2. Vercel 배포

```bash
# Vercel CLI 설치 (이미 설치되어 있다면 생략)
npm install -g vercel

# relay-server 디렉토리로 이동
cd relay-server

# 의존성 설치
npm install

# 로컬 개발
npm run dev

# 배포
vercel

# 프로덕션 배포
vercel --prod
```

### 3. 환경변수 설정

Vercel 대시보드 또는 CLI에서 환경변수 설정:

```bash
vercel env add UPSTASH_REDIS_REST_URL
vercel env add UPSTASH_REDIS_REST_TOKEN
```

또는 Vercel 대시보드 > Project Settings > Environment Variables에서 설정

## API 사용 예제

### 세션 생성 (PC)

```bash
curl -X POST https://relay.jaloveeye.com/api/session
```

응답:
```json
{
  "success": true,
  "data": {
    "sessionId": "ABC123",
    "createdAt": 1705123456789,
    "expiresAt": 1705209856789
  },
  "timestamp": 1705123456789
}
```

### 세션 연결 (Mobile/PC)

```bash
curl -X POST https://relay.jaloveeye.com/api/connect \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "ABC123",
    "deviceId": "device-uuid",
    "deviceType": "mobile"
  }'
```

### 메시지 전송

```bash
curl -X POST https://relay.jaloveeye.com/api/send \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "ABC123",
    "deviceId": "device-uuid",
    "deviceType": "mobile",
    "type": "insert_text",
    "data": {
      "text": "Hello, World!"
    }
  }'
```

### 메시지 폴링

```bash
curl "https://relay.jaloveeye.com/api/poll?sessionId=ABC123&deviceType=pc"
```

### SSE 스트림 연결

```javascript
const eventSource = new EventSource(
  'https://relay.jaloveeye.com/api/stream?sessionId=ABC123&deviceType=mobile'
);

eventSource.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  console.log('Received:', message);
});

eventSource.addEventListener('heartbeat', (event) => {
  console.log('Heartbeat:', event.data);
});

eventSource.addEventListener('reconnect', (event) => {
  console.log('Reconnect needed:', event.data);
  eventSource.close();
  // 재연결 로직
});
```

## 통신 흐름

### 1. 연결 설정

```
PC Server                    Relay Server                 Mobile App
    │                             │                            │
    │──POST /api/session─────────►│                            │
    │◄─────────{sessionId}────────│                            │
    │                             │                            │
    │──POST /api/connect─────────►│                            │
    │  {sessionId, deviceType:pc} │                            │
    │                             │                            │
    │                             │◄──POST /api/connect────────│
    │                             │  {sessionId, deviceType:mobile}
    │                             │                            │
```

### 2. 메시지 교환

```
PC Server                    Relay Server                 Mobile App
    │                             │                            │
    │                             │◄──SSE /api/stream──────────│
    │                             │   (deviceType: mobile)     │
    │                             │                            │
    │──POST /api/send────────────►│                            │
    │  {type: "ai_response"}      │────SSE message────────────►│
    │                             │                            │
    │◄──GET /api/poll─────────────│◄──POST /api/send───────────│
    │   (deviceType: pc)          │   {type: "insert_text"}    │
    │                             │                            │
```

## 환경변수

| 변수명 | 설명 | 필수 |
|--------|------|------|
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST API URL | Yes |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST API Token | Yes |

## 제한사항

- **SSE 연결 시간**: Vercel Serverless는 최대 실행 시간이 있음 (Free: 10초, Pro: 60초)
  - SSE 스트림은 자동으로 타임아웃되며, 클라이언트가 재연결해야 함
- **메시지 TTL**: 메시지는 5분간 보관 후 자동 삭제
- **세션 TTL**: 세션은 24시간 후 자동 만료

## 로컬 개발

```bash
# 환경변수 설정
cp .env.example .env.local
# .env.local 파일을 편집하여 Upstash 정보 입력

# 개발 서버 실행
npm run dev
```

## 라이선스

MIT License

---

**작성 시간**: 2026년 1월 21일  
**수정 시간**: 2026년 1월 21일 (도메인 변경: relay.jaloveeye.com)
