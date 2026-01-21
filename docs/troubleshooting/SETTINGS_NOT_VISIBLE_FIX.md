# "Cursor Remote: Use CLI Mode" 설정이 보이지 않는 경우 해결 방법

## 원인

Extension이 재로드되지 않아서 새로운 설정이 등록되지 않았을 수 있습니다.

## 해결 방법

### 방법 1: Extension 재로드 (권장)

1. **명령 팔레트 열기**: `Cmd + Shift + P`
2. **다음 명령 입력**: `Developer: Reload Window`
3. **Enter 키 누르기**
4. Cursor IDE가 재시작되면 설정 다시 확인

### 방법 2: Cursor IDE 완전 재시작

1. Cursor IDE 완전히 종료 (`Cmd + Q`)
2. Cursor IDE 다시 실행
3. 설정 열기 (`Cmd + ,`)
4. "Cursor Remote" 검색

### 방법 3: 설정 파일 직접 편집 (가장 확실한 방법)

설정이 UI에 표시되지 않아도 JSON 파일에 직접 추가하면 작동합니다.

1. **명령 팔레트 열기**: `Cmd + Shift + P`
2. **다음 명령 입력**: `Preferences: Open User Settings (JSON)`
3. **Enter 키 누르기**
4. 다음 내용 추가:

```json
{
  "cursorRemote.useCLIMode": true
}
```

또는 CLI 모드를 비활성화하려면:

```json
{
  "cursorRemote.useCLIMode": false
}
```

### 방법 4: 터미널에서 직접 편집

```bash
# 설정 파일 위치
~/Library/Application Support/Cursor/User/settings.json
```

파일을 열어서 다음 내용 추가:

```json
{
  "cursorRemote.useCLIMode": true
}
```

## 설정 확인 방법

설정이 적용되었는지 확인:

1. **Output 패널 열기**: `Cmd + Shift + U`
2. 드롭다운에서 **"Cursor Remote"** 선택
3. 다음 메시지 확인:
   - CLI 모드: `[Cursor Remote] CLI mode is enabled - using Cursor CLI instead of IDE`
   - IDE 모드: `[Cursor Remote] IDE mode is enabled - using Cursor IDE extension`

## Extension이 활성화되었는지 확인

1. **명령 팔레트**: `Cmd + Shift + P`
2. **입력**: `Extensions: Show Installed Extensions`
3. **검색**: "Cursor Remote"
4. Extension이 설치되어 있고 활성화되어 있는지 확인

## Extension 재설치 (최후의 수단)

1. **Extension 폴더로 이동**:

   ```bash
   cd /Users/herace/Workspace/cursor-remote/cursor-extension
   ```

2. **재컴파일**:

   ```bash
   npm run compile
   ```

3. **Cursor IDE에서 Extension 재로드**:
   - `Cmd + Shift + P` → `Developer: Reload Window`

## 문제가 계속되는 경우

1. **설정 파일 위치 확인**:

   ```bash
   ls -la ~/Library/Application\ Support/Cursor/User/settings.json
   ```

2. **설정 파일 내용 확인**:

   ```bash
   cat ~/Library/Application\ Support/Cursor/User/settings.json | grep -i cursor
   ```

3. **Extension 로그 확인**:
   - `Cmd + Shift + U` → Output 패널 → "Cursor Remote" 선택
   - 에러 메시지 확인

---

**작성 시간**: 2026년 1월 20일  
**수정 시간**: 2026년 1월 20일
