# Cursor Extension 설치 및 활성화 가이드

## Extension 설치 방법

### 방법 1: 개발 모드로 로드 (권장)

1. **Extension 컴파일**

   ```bash
   cd cursor-extension
   npm install
   npm run compile
   ```

2. **Cursor IDE에서 Extension 로드**
   - Cursor IDE 실행
   - `Cmd+Shift+P` (Mac) 또는 `Ctrl+Shift+P` (Windows/Linux)
   - "Developer: Install Extension from Location..." 입력
   - `cursor-extension` 폴더 선택
   - 또는 F5 키를 눌러 Extension Development Host 실행

3. **확인**
   - 새 창이 열리면 Extension이 로드된 것입니다
   - 상태 표시줄 확인 (우측 하단)

### 방법 2: VSIX 파일로 설치

1. **VSIX 파일 생성** (향후 구현)

   ```bash
   npm install -g vsce
   vsce package
   ```

2. **설치**
   - `Cmd+Shift+P` → "Extensions: Install from VSIX..."
   - 생성된 `.vsix` 파일 선택

## Extension 활성화 확인 방법

### 1. 상태 표시줄 확인 (가장 쉬운 방법)

Cursor IDE 하단 상태 표시줄(Status Bar) 우측을 확인하세요:

- ✅ **"$(cloud) Cursor Remote: Waiting"** - Extension 활성화됨, 클라이언트 대기 중
- ✅ **"$(cloud) Cursor Remote: Connected"** - Extension 활성화됨, 클라이언트 연결됨
- ❌ **"$(cloud-off) Cursor Remote: Stopped"** - Extension 활성화됨, 서버 중지됨
- ❌ **아무것도 없음** - Extension이 로드되지 않음

### 2. 명령 팔레트에서 확인

1. `Cmd+Shift+P` (Mac) 또는 `Ctrl+Shift+P` (Windows/Linux)
2. 다음 명령들이 보이는지 확인:
   - "Start Cursor Remote Server"
   - "Stop Cursor Remote Server"
   - "Toggle Cursor Remote Server"

명령이 보이면 Extension이 활성화된 것입니다.

### 3. 개발자 도구 콘솔 확인

1. `Help` → `Toggle Developer Tools` (또는 `Cmd+Option+I` / `Ctrl+Shift+I`)
2. Console 탭 확인
3. 다음 메시지가 보이면 활성화됨:

   ```
   Cursor Remote extension is now active!
   Cursor Remote WebSocket server started on port 8766
   ```

### 4. Extension 목록에서 확인

1. `Cmd+Shift+X` (Extensions 뷰 열기)
2. "Installed" 탭에서 "Cursor Remote" 검색
3. Extension이 설치되어 있고 "Enabled"로 표시되는지 확인

## 자동 활성화 설정

현재 Extension은 `onStartupFinished` 이벤트로 자동 활성화되도록 설정되어 있습니다:

```json
"activationEvents": [
  "onStartupFinished"
]
```

이는 Cursor IDE가 시작되면 자동으로 Extension이 활성화된다는 의미입니다.

## 수동으로 활성화하기

만약 자동 활성화가 되지 않는다면:

1. **명령 팔레트 사용**
   - `Cmd+Shift+P`
   - "Developer: Reload Window" 실행
   - 또는 "Start Cursor Remote Server" 명령 실행

2. **Extension 재로드**
   - Extensions 뷰에서 "Cursor Remote" 찾기
   - "Reload" 버튼 클릭

## 문제 해결

### Extension이 활성화되지 않는 경우

1. **컴파일 확인**

   ```bash
   cd cursor-extension
   npm run compile
   ```

   - `out/` 폴더에 파일이 생성되었는지 확인

2. **의존성 확인**

   ```bash
   npm install
   ```

3. **Cursor IDE 재시작**
   - 완전히 종료 후 다시 시작

4. **개발자 도구 확인**
   - `Help` → `Toggle Developer Tools`
   - Console에서 에러 메시지 확인

### 상태 표시줄이 보이지 않는 경우

- Extension이 로드되지 않았을 수 있습니다
- 위의 "확인 방법"을 따라 Extension이 제대로 로드되었는지 확인하세요

### WebSocket 서버가 시작되지 않는 경우

- 포트 8766이 이미 사용 중일 수 있습니다
- 터미널에서 확인:

  ```bash
  lsof -i :8766
  ```

- 다른 프로세스가 사용 중이면 종료하거나 Extension 코드에서 포트 변경

## 테스트

Extension이 활성화되었는지 테스트:

1. 상태 표시줄에서 "Cursor Remote: Waiting" 확인
2. 명령 팔레트에서 "Start Cursor Remote Server" 실행
3. 상태 표시줄이 변경되는지 확인
4. 개발자 도구 콘솔에서 로그 확인

---

**작성 시간**: 2026년 1월 19일  
**수정 시간**: 2026년 1월 19일
