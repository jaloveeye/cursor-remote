# 여러 프로젝트 및 대화 히스토리 테스트 가이드

## 테스트 1: 여러 Cursor IDE 프로젝트 지원

### 목적
여러 Cursor IDE 프로젝트를 동시에 열어도 포트 충돌 없이 정상 작동하는지 확인합니다.

### 준비 사항
1. PC 서버 실행 중
2. 모바일 앱 또는 클라이언트 준비

### 테스트 단계

#### 1단계: 첫 번째 프로젝트 열기
```bash
# 터미널 1: PC 서버 실행
cd pc-server
npm start
```

1. Cursor IDE에서 첫 번째 프로젝트 열기
2. Extension이 자동으로 활성화됨
3. Output Channel에서 "Cursor Remote extension is now active!" 확인
4. PC 서버 로그에서 Extension 연결 확인:
   ```
   ✅ Connected to Cursor Extension (ext-xxxxx)
   ```

#### 2단계: 두 번째 프로젝트 열기
1. Cursor IDE에서 **새 창**으로 두 번째 프로젝트 열기
   - `File > New Window` 또는 `Cmd+Shift+N` (Mac) / `Ctrl+Shift+N` (Windows)
2. 두 번째 프로젝트에서도 Extension이 활성화됨
3. PC 서버 로그 확인:
   ```
   ✅ Connected to Cursor Extension (ext-yyyyy)
   Switched to active Extension: ext-yyyyy
   ```
4. `activeExtensionCount: 2` 확인 (status 엔드포인트로 확인 가능)

#### 3단계: 메시지 전송 테스트
1. 모바일 앱에서 메시지 전송
2. PC 서버가 활성 Extension으로 메시지 전달
3. 두 프로젝트 중 하나에서 응답 확인

#### 4단계: Extension 연결 해제 테스트
1. 첫 번째 프로젝트 창 닫기
2. PC 서버 로그에서 확인:
   ```
   Extension connection closed (ext-xxxxx). Removing from active clients...
   Switched to active Extension: ext-yyyyy
   ```
3. 두 번째 프로젝트가 활성 Extension으로 전환됨
4. 메시지 전송이 정상 작동하는지 확인

### 예상 결과
- ✅ 여러 Extension이 동시에 연결 가능
- ✅ 포트 충돌 없음
- ✅ 가장 최근 연결된 Extension이 활성 Extension
- ✅ Extension이 닫히면 자동으로 다른 Extension으로 전환

---

## 테스트 2: 대화 히스토리 유지

### 목적
이전 대화 내용이 다음 요청에 포함되어 대화를 이어갈 수 있는지 확인합니다.

### 준비 사항
1. PC 서버 실행 중
2. Extension 활성화
3. 모바일 앱 또는 클라이언트 연결

### 테스트 단계

#### 1단계: 첫 번째 대화
1. 모바일 앱에서 다음 메시지 전송:
   ```
   "안녕하세요. 제 이름은 김형진입니다."
   ```
2. Extension이 CLI로 전송하고 응답 받음
3. `.cursor/CHAT_HISTORY.json` 파일 생성 확인:
   ```bash
   cat .cursor/CHAT_HISTORY.json
   ```
4. 파일 내용 확인:
   ```json
   [
     {
       "timestamp": "2024-12-19T...",
       "user": "안녕하세요. 제 이름은 김형진입니다.",
       "assistant": "안녕하세요 김형진님! ..."
     }
   ]
   ```

#### 2단계: 두 번째 대화 (컨텍스트 포함)
1. 모바일 앱에서 다음 메시지 전송:
   ```
   "제 이름이 뭐였죠?"
   ```
2. Extension이 이전 대화를 포함하여 CLI에 전송:
   ```
   이전 대화 내용:
   User: 안녕하세요. 제 이름은 김형진입니다.
   Assistant: 안녕하세요 김형진님! ...
   ---
   
   현재 요청:
   제 이름이 뭐였죠?
   ```
3. CLI가 이전 대화를 이해하고 올바르게 응답하는지 확인
4. `.cursor/CHAT_HISTORY.json`에 두 번째 대화 추가 확인

#### 3단계: 여러 대화 이어가기
1. 연속으로 여러 메시지 전송:
   ```
   "파이썬으로 간단한 계산기를 만들어줘"
   "계산기에 제곱 기능도 추가해줘"
   "이전에 만든 계산기 코드를 보여줘"
   ```
2. 각 대화가 이전 대화를 참조하여 올바르게 응답하는지 확인
3. `.cursor/CHAT_HISTORY.json`에 최대 50개까지 저장되는지 확인

#### 4단계: 히스토리 파일 확인
```bash
# 히스토리 파일 확인
cat .cursor/CHAT_HISTORY.json | jq '.'

# 최근 10개만 확인
cat .cursor/CHAT_HISTORY.json | jq '.[-10:]'
```

### 예상 결과
- ✅ `.cursor/CHAT_HISTORY.json` 파일 자동 생성
- ✅ 사용자 메시지와 어시스턴트 응답이 저장됨
- ✅ 다음 요청 시 최근 10개 대화가 컨텍스트로 포함됨
- ✅ 이전 대화 내용을 이해하고 대화를 이어갈 수 있음
- ✅ 최대 50개 대화만 유지 (메모리 절약)

---

## 통합 테스트

### 시나리오: 여러 프로젝트 + 대화 히스토리
1. **프로젝트 A** 열기 → Extension 활성화
2. 프로젝트 A에서 대화 시작:
   ```
   "프로젝트 A의 README를 작성해줘"
   ```
3. **프로젝트 B** 열기 (새 창) → Extension 활성화
4. 프로젝트 B에서 대화 시작:
   ```
   "프로젝트 B의 package.json을 확인해줘"
   ```
5. 프로젝트 A로 돌아가서:
   ```
   "이전에 작성한 README를 보여줘"
   ```
6. 각 프로젝트의 `.cursor/CHAT_HISTORY.json`이 독립적으로 관리되는지 확인

### 예상 결과
- ✅ 각 프로젝트마다 독립적인 대화 히스토리
- ✅ 프로젝트 간 대화 히스토리 혼선 없음
- ✅ PC 서버가 여러 Extension을 올바르게 관리

---

## 문제 해결

### Extension이 연결되지 않는 경우
1. PC 서버 로그 확인:
   ```bash
   # Extension 연결 시도 로그 확인
   ```
2. 포트 확인:
   ```bash
   lsof -i :8766  # Extension WebSocket 포트
   ```
3. Extension 재시작:
   - Cursor IDE에서 `Cmd+Shift+P` → "Reload Window"

### 대화 히스토리가 저장되지 않는 경우
1. `.cursor` 디렉토리 확인:
   ```bash
   ls -la .cursor/
   ```
2. 파일 권한 확인:
   ```bash
   chmod 755 .cursor
   chmod 644 .cursor/CHAT_HISTORY.json
   ```
3. Extension Output Channel에서 에러 확인

### 여러 Extension이 충돌하는 경우
1. PC 서버 상태 확인:
   ```bash
   curl http://localhost:8765/status
   ```
2. `activeExtensionCount` 확인
3. 모든 Cursor IDE 창 닫고 하나씩 다시 열기

---

## 확인 사항 체크리스트

### 여러 프로젝트 지원
- [ ] 여러 Cursor IDE 창에서 Extension 활성화
- [ ] PC 서버가 여러 Extension 연결 관리
- [ ] 포트 충돌 없음
- [ ] 활성 Extension 자동 전환

### 대화 히스토리
- [ ] `.cursor/CHAT_HISTORY.json` 파일 생성
- [ ] 사용자 메시지 저장
- [ ] 어시스턴트 응답 저장
- [ ] 다음 요청에 이전 대화 포함
- [ ] 대화를 이어갈 수 있음
- [ ] 최대 50개 대화 유지

---

## 추가 정보

- 대화 히스토리 파일 위치: `.cursor/CHAT_HISTORY.json`
- 최대 저장 대화 수: 50개
- 컨텍스트로 포함되는 대화 수: 최근 10개
- PC 서버 상태 확인: `curl http://localhost:8765/status`
