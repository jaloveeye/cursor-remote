# 세션 관리 기능 테스트 가이드

## 테스트할 기능

1. ✅ 클라이언트별 세션 격리
2. ✅ CHAT_SUMMARY hook 제거 (중복 응답 방지)
3. ✅ 클라이언트 제어 세션 관리 (새 대화 / 이어가기)
4. ✅ 대화 히스토리 저장/조회
5. ✅ 세션 정보 표시

## 사전 준비

### 1. Extension 재로드
- Cursor IDE에서 Extension을 재로드하거나 Cursor를 재시작
- Output 패널 확인:
  - ✅ "Cursor Remote extension is now active!"
  - ✅ "✅ WebSocket server started on port 8766"
  - ✅ "✅ HTTP server for hooks started on port 8768"
  - ❌ "Started watching: .cursor/CHAT_SUMMARY" (더 이상 나타나지 않아야 함)

### 2. PC Server 실행
```bash
cd pc-server
npm start
```

### 3. Mobile App 실행
- Flutter 앱 실행 (로컬 또는 릴레이 모드)

## 테스트 시나리오

### 시나리오 1: 클라이언트별 세션 격리

**목적**: 각 클라이언트가 독립적인 세션을 가지는지 확인

**절차**:
1. 클라이언트 A 연결
2. 클라이언트 A에서 프롬프트: "내 이름은 김형진입니다"
3. 클라이언트 B 연결 (다른 기기 또는 브라우저)
4. 클라이언트 B에서 프롬프트: "내 이름이 뭐라고?"

**예상 결과**:
- ✅ 클라이언트 A: "안녕하세요, 김형진님!" (정상 응답)
- ✅ 클라이언트 B: "이름을 알려주지 않았는데..." (독립 세션)
- ✅ Output 패널에서 다른 `clientId`와 `sessionId` 확인

**확인 사항**:
- Output 패널 로그:
  ```
  Client connected to Cursor Remote (ID: client-123...)
  🔑 Using clientId: client-123... for this prompt
  💾 Saved session ID for client client-123...: session-A
  ```
  ```
  Client connected to Cursor Remote (ID: client-456...)
  🔑 Using clientId: client-456... for this prompt
  💾 Saved session ID for client client-456...: session-B
  ```

### 시나리오 2: 중복 응답 방지

**목적**: CHAT_SUMMARY hook 제거로 중복 응답이 발생하지 않는지 확인

**절차**:
1. 클라이언트에서 프롬프트 전송: "안녕하세요"
2. 응답 확인

**예상 결과**:
- ✅ 응답이 **한 번만** 전달됨
- ❌ "📥 Reading CHAT_SUMMARY file..." 로그 없음
- ❌ "⚠️ Duplicate response detected" 로그 없음

**확인 사항**:
- Output 패널에서 "Sending chat_response" 로그가 한 번만 나타남
- 모바일 앱에서 응답이 한 번만 표시됨

### 시나리오 3: 새 대화 시작

**목적**: "새 대화" 버튼으로 완전히 새로운 세션을 시작하는지 확인

**절차**:
1. 클라이언트에서: "내 이름은 김형진입니다" → **Send to Prompt**
2. 클라이언트에서: "내 이름이 뭐야?" → **새 대화** 버튼

**예상 결과**:
- ✅ "이름을 알려주지 않았는데..." (새 세션, 이전 대화 기억 안 함)
- ✅ Output 패널: "Starting new session (client requested)"

**확인 사항**:
- Output 패널 로그:
  ```
  [CLI] sendPrompt called - newSession: true
  Starting new session (client requested) for client client-...
  ```

### 시나리오 4: 대화 이어가기

**목적**: "이어가기" 버튼으로 기존 세션을 재개하는지 확인

**절차**:
1. 클라이언트에서: "내 이름은 김형진입니다" → **Send to Prompt**
2. 응답 확인 (세션 ID 저장됨)
3. 클라이언트에서: "내 이름이 뭐야?" → **이어가기** 버튼

**예상 결과**:
- ✅ "김형진님이세요!" (이전 대화 기억)
- ✅ Output 패널: "Resuming chat session for client ..."

**확인 사항**:
- 모바일 앱에 "현재 세션: ..." 표시됨
- "이어가기" 버튼이 활성화됨 (세션이 있을 때만)
- Output 패널 로그:
  ```
  🔑 Found existing session for client client-...: session-...
  Resuming chat session for client client-...: session-...
  Executing: agent --resume session-... --output-format json --force ...
  ```

### 시나리오 5: 대화 히스토리 저장

**목적**: 대화 히스토리가 자동으로 저장되는지 확인

**절차**:
1. 클라이언트에서 여러 프롬프트 전송
2. `.cursor/CHAT_HISTORY.json` 파일 확인

**예상 결과**:
- ✅ `.cursor/CHAT_HISTORY.json` 파일 생성
- ✅ 사용자 메시지와 어시스턴트 응답이 쌍으로 저장됨
- ✅ Output 패널: "💾 Chat history saved (N entries)"

**확인 사항**:
```bash
cat .cursor/CHAT_HISTORY.json
```
- `entries` 배열에 대화 내용이 저장되어 있음
- 각 엔트리에 `userMessage`, `assistantResponse`, `sessionId`, `clientId` 포함

### 시나리오 6: 대화 히스토리 조회

**목적**: 저장된 대화 히스토리를 조회할 수 있는지 확인

**절차**:
1. 모바일 앱에서 `get_chat_history` 명령 전송 (향후 UI 추가 예정)
2. 또는 Extension에서 직접 확인

**예상 결과**:
- ✅ 저장된 대화 목록 반환
- ✅ 클라이언트 ID, 세션 ID로 필터링 가능

**확인 사항**:
- Extension Output 패널에서 히스토리 조회 로그 확인
- 반환된 데이터에 이전 대화 내용 포함

## 로그 확인 포인트

### 정상 작동 시 로그
```
Client connected to Cursor Remote (ID: client-...)
[CLI] sendPrompt called - clientId: client-..., newSession: false
🔑 Using clientId: client-... for this prompt
🔑 Found existing session for client client-...: session-...
Resuming chat session for client client-...: session-...
💾 Saved session ID for client client-...: session-...
💾 Chat history saved (N entries)
Sending chat_response: {"type":"chat_response","sessionId":"...","clientId":"..."}
✅ Chat response sent to WebSocket
```

### 문제 발생 시 확인할 로그
- ❌ `clientId: none` → WebSocket 메시지에 clientId가 포함되지 않음
- ❌ `⚠️ No clientId provided` → 클라이언트 ID 전달 실패
- ❌ `📥 Reading CHAT_SUMMARY file...` → CHAT_SUMMARY hook이 아직 작동 중
- ❌ `⚠️ Duplicate response detected` → 중복 응답 발생

## 문제 해결

### 세션이 격리되지 않는 경우
1. Output 패널에서 `clientId` 확인
2. `clientId: none`이면 WebSocket 연결 문제
3. Extension 재로드

### 중복 응답이 발생하는 경우
1. Extension 완전 재시작
2. 브라우저 캐시 클리어 (Flutter Web)
3. CHAT_SUMMARY 관련 로그 확인

### "이어가기" 버튼이 비활성화된 경우
1. 첫 프롬프트 전송 후 응답 확인
2. 세션 ID가 응답에 포함되었는지 확인
3. 모바일 앱에서 `_currentCursorSessionId` 확인

## 테스트 체크리스트

- [ ] Extension 재로드 후 정상 시작 확인
- [ ] 두 클라이언트 연결 시 다른 clientId 생성 확인
- [ ] 클라이언트별 독립적인 세션 확인
- [ ] 응답이 한 번만 전달되는지 확인
- [ ] "새 대화" 버튼으로 새 세션 시작 확인
- [ ] "이어가기" 버튼으로 기존 세션 재개 확인
- [ ] 대화 히스토리 파일 생성 확인
- [ ] 세션 정보가 모바일 앱에 표시되는지 확인
