# AI 응답 스트리밍 기능 테스트 가이드

**작성일**: 2026-01-27  
**기능**: AI 응답 실시간 스트리밍  
**버전**: 1.0

---

## 📋 목차

1. [테스트 전 준비사항](#테스트-전-준비사항)
2. [테스트 시나리오](#테스트-시나리오)
3. [예상 결과](#예상-결과)
4. [문제 해결](#문제-해결)

---

## 테스트 전 준비사항

### 1. Extension 컴파일 확인

```bash
cd cursor-extension
npm run compile
```

**확인 사항:**
- `out/cli-handler.js` 파일이 최신 버전인지 확인
- 컴파일 에러가 없는지 확인

### 2. Cursor IDE Extension 활성화

1. Cursor IDE 실행
2. `Cmd + Shift + U` → Output 패널 열기
3. 드롭다운에서 "Cursor Remote" 선택
4. Extension이 정상적으로 로드되었는지 확인

### 3. PC 서버 실행

```bash
cd pc-server
npm start
```

**확인 사항:**
- 서버가 정상적으로 시작되는지 확인
- Extension 연결 메시지 확인: `✅ Connected to Cursor Extension`
- 서버 IP 주소 확인 (예: `192.168.0.10`)

### 4. 모바일 앱 실행

```bash
cd mobile-app
flutter run
```

**확인 사항:**
- 앱이 정상적으로 실행되는지 확인
- 연결 화면이 표시되는지 확인

---

## 테스트 시나리오

### 시나리오 1: 기본 스트리밍 테스트

**목표**: AI 응답이 실시간으로 스트리밍되는지 확인

#### 단계:

1. **모바일 앱 연결**
   - PC 서버 IP 주소 입력
   - "Connect" 버튼 클릭
   - 연결 성공 확인: `✅ Connected to local server`

2. **프롬프트 전송**
   - 텍스트 입력 필드에 다음 입력:
     ```
     간단한 Python 함수를 작성해줘. 두 숫자를 더하는 함수.
     ```
   - "Send to Prompt" 버튼 클릭

3. **스트리밍 확인**
   - **모바일 앱에서 확인:**
     - 응답이 즉시 시작되는지 확인 (전체 응답을 기다리지 않음)
     - 텍스트가 실시간으로 추가되는지 확인
     - 스트리밍 인디케이터(깜빡이는 파란 점)가 표시되는지 확인
     - 응답이 완료되면 인디케이터가 사라지는지 확인

   - **Extension Output 패널에서 확인:**
     ```
     [CLI] CLI stdout chunk (XX bytes): ...
     [CLI] 📤 Streaming chunk sent (XX chars, total: XXX)
     [CLI] ✅ Streaming complete signal sent
     ```

#### 예상 결과:

✅ **성공 기준:**
- 응답이 즉시 시작됨 (1-2초 이내)
- 텍스트가 점진적으로 추가됨
- 스트리밍 인디케이터가 표시됨
- 응답 완료 시 인디케이터가 사라짐
- 최종 응답이 완전함

❌ **실패 기준:**
- 응답이 시작되지 않음
- 전체 응답을 기다린 후 한 번에 표시됨
- 스트리밍 인디케이터가 표시되지 않음
- 응답이 중간에 끊김

---

### 시나리오 2: 긴 응답 스트리밍 테스트

**목표**: 긴 응답에서도 스트리밍이 정상 작동하는지 확인

#### 단계:

1. **긴 프롬프트 전송**
   - 텍스트 입력 필드에 다음 입력:
     ```
     Python으로 간단한 웹 크롤러를 작성해줘. 
     requests와 BeautifulSoup을 사용해서 
     웹페이지의 제목과 링크를 추출하는 코드를 작성해줘.
     코드 설명도 포함해줘.
     ```
   - "Send to Prompt" 버튼 클릭

2. **스트리밍 확인**
   - 응답이 여러 청크로 나뉘어 전송되는지 확인
   - 각 청크가 순차적으로 추가되는지 확인
   - 중간에 텍스트가 사라지지 않는지 확인

#### 예상 결과:

✅ **성공 기준:**
- 긴 응답도 실시간으로 스트리밍됨
- 모든 청크가 순차적으로 표시됨
- 텍스트가 누락되지 않음
- 최종 응답이 완전함

---

### 시나리오 3: 여러 프롬프트 연속 전송 테스트

**목표**: 여러 프롬프트를 연속으로 전송해도 스트리밍이 정상 작동하는지 확인

#### 단계:

1. **첫 번째 프롬프트 전송**
   - "Hello, world를 출력하는 Python 코드를 작성해줘"
   - "Send to Prompt" 클릭
   - 응답 완료 대기

2. **두 번째 프롬프트 전송**
   - 첫 번째 응답이 완료되기 전에 두 번째 프롬프트 전송
   - "이 코드를 함수로 만들어줘"
   - "Send to Prompt" 클릭

3. **스트리밍 확인**
   - 각 응답이 독립적으로 스트리밍되는지 확인
   - 응답이 섞이지 않는지 확인

#### 예상 결과:

✅ **성공 기준:**
- 각 응답이 독립적으로 스트리밍됨
- 응답이 섞이지 않음
- 각 응답이 올바른 위치에 표시됨

---

### 시나리오 4: 하위 호환성 테스트

**목표**: 기존 `chat_response` 타입도 정상 작동하는지 확인

#### 단계:

1. **Extension 로그 확인**
   - Output 패널에서 다음 메시지 확인:
     ```
     [CLI] Sending chat_response: ...
     ```
   - `chat_response_chunk` 메시지가 아닌 `chat_response` 메시지가 전송되는 경우도 있음

2. **모바일 앱 확인**
   - 기존 방식의 응답도 정상적으로 표시되는지 확인
   - 스트리밍 없이 한 번에 표시되어도 정상 작동하는지 확인

#### 예상 결과:

✅ **성공 기준:**
- 기존 방식의 응답도 정상적으로 표시됨
- 스트리밍이 안 되는 경우에도 오류가 발생하지 않음

---

## 예상 결과

### 정상 작동 시

#### 모바일 앱:
1. 프롬프트 전송 후 즉시 응답 시작
2. 텍스트가 실시간으로 추가됨
3. 스트리밍 인디케이터(파란 점)가 깜빡임
4. 응답 완료 시 인디케이터 사라짐
5. 최종 응답이 완전함

#### Extension Output 패널:
```
[CLI] sendPrompt called - textLength: XX, execute: true
[CLI] CLI stdout chunk (XX bytes): ...
[CLI] 📤 Streaming chunk sent (XX chars, total: XXX)
[CLI] 📤 Streaming chunk sent (XX chars, total: XXX)
...
[CLI] ✅ Streaming complete signal sent
[CLI] ✅ Chat response sent to WebSocket
```

#### PC 서버 로그:
```
📤 Sending to local mobile client (local mode)
```

---

## 문제 해결

### 문제 1: 스트리밍이 시작되지 않음

**증상:**
- 프롬프트 전송 후 응답이 오지 않음
- 또는 전체 응답을 기다린 후 한 번에 표시됨

**확인 사항:**
1. Extension Output 패널 확인
   - `[CLI] CLI stdout chunk` 메시지가 있는지 확인
   - `[CLI] 📤 Streaming chunk sent` 메시지가 있는지 확인

2. PC 서버 로그 확인
   - Extension에서 메시지를 받고 있는지 확인

3. 모바일 앱 로그 확인
   - `chat_response_chunk` 메시지를 받고 있는지 확인

**해결 방법:**
- Extension 재시작: Cursor IDE에서 `Cmd + Shift + P` → "Developer: Reload Window"
- PC 서버 재시작
- 모바일 앱 재연결

---

### 문제 2: 스트리밍 인디케이터가 표시되지 않음

**증상:**
- 텍스트는 스트리밍되지만 인디케이터가 보이지 않음

**확인 사항:**
1. 모바일 앱 코드 확인
   - `MessageType.chatResponseChunk` 타입이 올바르게 처리되는지 확인

2. UI 렌더링 확인
   - `_buildMessageItem`에서 `chatResponseChunk` 케이스가 있는지 확인

**해결 방법:**
- 모바일 앱 재시작
- Flutter hot reload: `r` 키 누르기

---

### 문제 3: 응답이 중간에 끊김

**증상:**
- 스트리밍이 시작되었지만 중간에 멈춤
- 최종 응답이 불완전함

**확인 사항:**
1. Extension 로그 확인
   - `[CLI] ✅ Streaming complete signal sent` 메시지가 있는지 확인
   - 프로세스가 정상 종료되었는지 확인

2. 네트워크 연결 확인
   - PC 서버와 모바일 앱 간 연결이 안정적인지 확인

**해결 방법:**
- 네트워크 연결 확인
- PC 서버 재시작
- 모바일 앱 재연결

---

### 문제 4: 응답이 중복 표시됨

**증상:**
- 같은 응답이 여러 번 표시됨
- 스트리밍 청크와 최종 응답이 모두 표시됨

**확인 사항:**
1. Extension 로그 확인
   - `chat_response_chunk`와 `chat_response`가 모두 전송되는지 확인

2. 모바일 앱 코드 확인
   - `chat_response_complete` 처리 시 메시지 타입이 올바르게 변경되는지 확인

**해결 방법:**
- Extension 코드 확인: `checkAndProcessOutput`에서 기존 응답 전송 로직 확인
- 모바일 앱 코드 확인: `chat_response_complete` 처리 로직 확인

---

## 테스트 체크리스트

### 기본 기능
- [ ] Extension 컴파일 성공
- [ ] PC 서버 정상 시작
- [ ] 모바일 앱 정상 실행
- [ ] 연결 성공

### 스트리밍 기능
- [ ] 프롬프트 전송 후 즉시 응답 시작
- [ ] 텍스트가 실시간으로 추가됨
- [ ] 스트리밍 인디케이터가 표시됨
- [ ] 응답 완료 시 인디케이터가 사라짐
- [ ] 최종 응답이 완전함

### 긴 응답
- [ ] 긴 응답도 실시간으로 스트리밍됨
- [ ] 모든 청크가 순차적으로 표시됨
- [ ] 텍스트가 누락되지 않음

### 연속 전송
- [ ] 여러 프롬프트를 연속으로 전송해도 정상 작동
- [ ] 각 응답이 독립적으로 스트리밍됨
- [ ] 응답이 섞이지 않음

### 하위 호환성
- [ ] 기존 `chat_response` 타입도 정상 작동
- [ ] 스트리밍이 안 되는 경우에도 오류 없음

---

## 로그 확인 방법

### Extension 로그
1. Cursor IDE에서 `Cmd + Shift + U` → Output 패널 열기
2. 드롭다운에서 "Cursor Remote" 선택
3. 다음 키워드로 검색:
   - `Streaming chunk sent`
   - `Streaming complete`
   - `CLI stdout chunk`

### PC 서버 로그
- 터미널 출력 확인
- `📤 Sending to local mobile client` 메시지 확인

### 모바일 앱 로그
- Flutter 실행 터미널 확인
- 또는 Android Studio / Xcode 로그 확인

---

## 성능 측정

### 스트리밍 지연 시간
- **목표**: 프롬프트 전송 후 1-2초 이내 응답 시작
- **측정 방법**: 프롬프트 전송 시간과 첫 번째 청크 수신 시간 차이

### 스트리밍 속도
- **목표**: 청크가 100-500ms 간격으로 전송
- **측정 방법**: Extension 로그에서 청크 전송 시간 간격 확인

---

**마지막 업데이트**: 2026-01-27  
**테스트 버전**: 1.0
