# 릴레이 서버 정기 점검

**작성**: 2026년 2월 2일  
**수정**: 2026년 2월 2일

릴레이 서버( Vercel + Upstash Redis )를 주기적으로 확인할 때 사용하는 체크리스트와 방법입니다. **GitHub Actions**로 자동 점검 후 실패 시 **이슈 생성** → GitHub에서 이슈 알림을 이메일로 받도록 설정하면 알림 수신 가능합니다.

---

## 1. 점검 주기 권장

| 환경 | 주기 | 비고 |
|------|------|------|
| 개인/소규모 | **주 1회** 또는 **월 1회** | 사용 빈도에 따라 조절 |
| 팀/운영 | **주 1회** | health + debug-sessions + 로그 확인 |

---

## 2. 점검 체크리스트 (5분 이내)

아래 순서대로 확인하면 됩니다.

### 2.1 서버 상태 (Health)

```bash
curl -s https://relay.jaloveeye.com/api/health | jq .
```

**기대 결과**

- `success: true`
- `data.status: "healthy"`
- `data.redis.urlSet: true`, `data.redis.tokenSet: true`

**이상 시**

- 5xx → Vercel 배포/함수 오류. Vercel 대시보드 → Deployments → Functions 로그 확인
- `redis.urlSet` 또는 `tokenSet` 이 false → Vercel 환경변수(UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN) 확인

---

### 2.2 세션/디버그 정보 (Debug Sessions)

```bash
curl -s https://relay.jaloveeye.com/api/debug-sessions | jq .
```

**기대 결과**

- `success: true`
- `data.totalSessions`, `data.waitingForPc`, `data.sessionsWithPc` 숫자 값 (에러 없이 반환)

**이상 시**

- 500 + `error` 메시지 → Redis 연결/쿼리 오류. Upstash 대시보드에서 Redis 상태·요청 수 확인
- `totalSessions` 등이 비정상적으로 매우 크다 → 필요 시 Upstash 메모리/키 개수 확인

---

### 2.3 Connect API 샘플 호출 (선택)

실제 연결 플로우가 동작하는지 확인할 때만 실행합니다.  
(세션 ID는 테스트용 6자리 아무 값이나 사용 가능)

```bash
curl -s -X POST https://relay.jaloveeye.com/api/connect \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"CHECK1","deviceId":"maintenance-check","deviceType":"pc"}' \
  -w "\nHTTP_CODE:%{http_code}\n"
```

**기대 결과**

- HTTP 200, 본문에 `"success":true` → 정상
- 500이면 본문의 `error` 문자열 또는 Vercel Functions 로그로 원인 확인

---

## 3. 한 번에 확인하기 (원라이너)

jq 없이 상태만 보고 싶을 때:

```bash
curl -s https://relay.jaloveeye.com/api/health && echo "" && curl -s https://relay.jaloveeye.com/api/debug-sessions
```

jq 있으면 요약만:

```bash
echo "=== health ===" && curl -s https://relay.jaloveeye.com/api/health | jq '.success, .data.status, .data.redis' && echo "=== debug-sessions ===" && curl -s https://relay.jaloveeye.com/api/debug-sessions | jq '.success, .data'
```

---

## 4. GitHub Actions 자동 점검 (이슈 알림)

저장소 루트의 `.github/workflows/relay-health-check.yml` 이 다음을 수행합니다. **별도 등록 없이** 해당 파일을 포함해 푸시하면 Actions 탭에 워크플로가 나타나고, 스케줄대로 실행됩니다.

- **스케줄**: 매일 00:00, 06:00, 12:00 UTC (한국 시간 09:00, 15:00, 21:00) 에 `health` + `debug-sessions` 호출
- **수동 실행**: Actions 탭에서 "Relay server health check" → "Run workflow" 로 URL 지정 가능
- **실패 시**: GitHub 이슈 자동 생성. **GitHub 알림 설정**에서 이슈를 이메일로 받도록 하면 점검 실패 시 이메일 수신 가능 (Settings → Notifications → Email 선택)

- **확인**: Actions 탭에서 "Relay server health check" 워크플로가 보이면 정상. 스케줄 실행이 안 되면 **Settings → Actions → General** 에서 "Allow all actions and reusable workflows" 등이 제한되어 있지 않은지 확인.

### 4.1 점검 실패 시 확인할 것

- 생성된 이슈 본문에 health / debug-sessions 응답이 포함되어 있음
- [Vercel](https://vercel.com) → 해당 프로젝트 → Deployments → Functions 로그
- [Upstash](https://console.upstash.com) → Redis 메트릭

---

## 5. Vercel / Upstash 확인 (문제 발생 시)

| 확인 항목 | 위치 | 참고 |
|-----------|------|------|
| 함수 에러 로그 | Vercel → Project → Deployments → 해당 배포 → Functions | connect, poll, send, health 등 500 원인 |
| 환경변수 | Vercel → Project → Settings → Environment Variables | UPSTASH_REDIS_REST_URL, TOKEN 누락/오타 |
| Redis 상태 | Upstash Console → 해당 DB → Metrics | 요청 수, 지연, 에러 |
| Redis 메모리 | Upstash Console → 해당 DB | 키 수·메모리 사용량 (TTL로 자동 정리되나 장기 누적 시 확인) |

---

## 6. 점검 기록 (선택)

정기 점검 시 아래처럼 짧게 기록해 두면 추이 파악에 도움이 됩니다.

| 날짜 | health | debug-sessions | 비고 |
|------|--------|----------------|------|
| 2026-02-02 | OK | OK | - |

---

## 7. 관련 문서

- [TEST_PLAN.md](./TEST_PLAN.md) - 수동 테스트·API 호출 예시
- [README.md](./README.md) - 배포 방법, API 개요
