# macOS에서 Cursor IDE 설정 열기 가이드

## 방법 1: 키보드 단축키 (가장 빠름) ⚡

**`Cmd + ,`** (Command + 쉼표)

가장 빠르고 간단한 방법입니다.

## 방법 2: 메뉴에서 열기

1. 상단 메뉴바에서 **Cursor** 클릭
2. **Settings** (또는 **Preferences**) 선택
3. **Settings** 클릭

또는

1. 상단 메뉴바에서 **Cursor** 클릭
2. **Settings** → **Settings** 선택

## 방법 3: 명령 팔레트 사용

1. **`Cmd + Shift + P`** (Command + Shift + P) 눌러서 명령 팔레트 열기
2. 다음 중 하나 입력:
   - `Preferences: Open Settings`
   - `Settings`
   - `설정`
3. Enter 키 누르기

## Cursor Remote 설정 찾기

설정이 열리면:

1. **검색창에 입력**: `Cursor Remote`
   - 또는 `cursorRemote` 입력

2. **설정 항목 찾기**:
   - **"Cursor Remote: Use CLI Mode"** 옵션이 표시됩니다
   - 체크박스를 클릭하여 활성화/비활성화

## 설정 파일 직접 편집 (고급)

JSON 형식으로 직접 편집하려면:

1. **`Cmd + Shift + P`** 눌러서 명령 팔레트 열기
2. `Preferences: Open User Settings (JSON)` 입력
3. 다음 설정 추가:

```json
{
  "cursorRemote.useCLIMode": true
}
```

또는

```json
{
  "cursorRemote.useCLIMode": false
}
```

## 워크스페이스별 설정

특정 프로젝트에만 CLI 모드를 적용하려면:

1. 프로젝트 루트에 `.vscode/settings.json` 파일 생성 (없는 경우)
2. 다음 내용 추가:

```json
{
  "cursorRemote.useCLIMode": true
}
```

## 설정 확인 방법

설정이 제대로 적용되었는지 확인:

1. **Output 패널 확인**:
   - `View` → `Output` (또는 `Cmd + Shift + U`)
   - 드롭다운에서 "Cursor Remote" 선택
   - 다음 메시지 확인:
     - CLI 모드: `[Cursor Remote] CLI mode is enabled - using Cursor CLI instead of IDE`
     - IDE 모드: `[Cursor Remote] IDE mode is enabled - using Cursor IDE extension`

2. **상태 표시줄 확인**:
   - 우측 하단 상태 표시줄에서 "Cursor Remote" 아이콘 확인

## 단축키 요약

| 동작 | 단축키 |
|------|--------|
| 설정 열기 | `Cmd + ,` |
| 명령 팔레트 | `Cmd + Shift + P` |
| Output 패널 | `Cmd + Shift + U` |

## 문제 해결

### 설정이 보이지 않는 경우

1. **Extension이 활성화되었는지 확인**:
   - `Cmd + Shift + P` → `Developer: Reload Window`
   - 또는 Cursor IDE 재시작

2. **Extension이 설치되었는지 확인**:
   - `Cmd + Shift + P` → `Extensions: Show Installed Extensions`
   - "Cursor Remote" 검색

3. **설정 파일 직접 확인**:
   ```bash
   # 사용자 설정 파일 위치
   ~/Library/Application Support/Cursor/User/settings.json
   ```

---

**작성 시간**: 2026년 1월 20일  
**수정 시간**: 2026년 1월 20일
