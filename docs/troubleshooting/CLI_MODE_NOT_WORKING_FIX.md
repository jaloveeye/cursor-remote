# CLI 모드가 작동하지 않는 경우 해결 방법

## 증상

설정에서 `cursorRemote.useCLIMode: true`로 설정했는데도:
- 새로운 채팅창이 뜨고
- 프롬프트 메시지가 IDE 채팅창에 표시됨
- CLI 모드로 동작하지 않음

## 원인

Extension이 시작될 때 설정을 읽는데, 설정을 변경한 후 Extension이 재로드되지 않아서 이전 설정(IDE 모드)을 계속 사용하고 있을 수 있습니다.

## 해결 방법

### 방법 1: Extension 재로드 (가장 중요!)

1. **명령 팔레트 열기**: `Cmd + Shift + P`
2. **다음 명령 입력**: `Developer: Reload Window`
3. **Enter 키 누르기**
4. Cursor IDE가 재시작되면 다시 테스트

### 방법 2: Output 패널에서 확인

1. **Output 패널 열기**: `Cmd + Shift + U`
2. 드롭다운에서 **"Cursor Remote"** 선택
3. 다음 메시지 확인:

**CLI 모드가 활성화된 경우:**
```
[Cursor Remote] CLI mode is enabled - using Cursor CLI instead of IDE
```

**IDE 모드인 경우 (문제):**
```
[Cursor Remote] IDE mode is enabled - using Cursor IDE extension
```

IDE 모드 메시지가 보이면 Extension이 재로드되지 않은 것입니다.

### 방법 3: Cursor IDE 완전 재시작

1. Cursor IDE 완전히 종료 (`Cmd + Q`)
2. Cursor IDE 다시 실행
3. Output 패널에서 CLI 모드 메시지 확인

### 방법 4: 설정 파일 직접 확인 및 수정

```bash
# 설정 파일 확인
cat ~/Library/Application\ Support/Cursor/User/settings.json | grep -i cursorRemote

# 설정 파일 직접 편집
open ~/Library/Application\ Support/Cursor/User/settings.json
```

다음과 같이 설정되어 있는지 확인:
```json
{
  "cursorRemote.useCLIMode": true
}
```

## CLI 모드가 제대로 작동하는지 확인

### 1. Output 패널에서 로그 확인

프롬프트를 전송했을 때 다음 로그가 보여야 합니다:

**CLI 모드 (정상):**
```
[CLI] sendPrompt called - textLength: XX, execute: true
[CLI] Using CLI command: /Users/xxx/.local/bin/agent
[CLI] Executing: /Users/xxx/.local/bin/agent -p --output-format json --force "프롬프트"
[CLI] CLI stdout: {...}
[CLI] CLI process exited with code 0
```

**IDE 모드 (문제):**
```
[Cursor Remote] insertToPrompt called - textLength: XX, execute: true
[Cursor Remote] Opening chat panel (may create new chat if none exists)
[Cursor Remote] Executing workbench.action.chat.open
[Cursor Remote] Chat panel opened
```

### 2. 채팅창이 열리지 않아야 함

CLI 모드에서는:
- ✅ 채팅창이 열리지 않음
- ✅ CLI 프로세스가 백그라운드에서 실행됨
- ✅ 응답이 모바일 앱으로 직접 전송됨

IDE 모드에서는:
- ❌ 채팅창이 열림
- ❌ 프롬프트가 채팅창에 표시됨

## 디버깅 단계

### 1단계: 설정 확인
```bash
cat ~/Library/Application\ Support/Cursor/User/settings.json | grep cursorRemote
```

### 2단계: Extension 재로드
`Cmd + Shift + P` → `Developer: Reload Window`

### 3단계: Output 패널 확인
- CLI 모드 메시지 확인
- 프롬프트 전송 시 로그 확인

### 4단계: 테스트
- 모바일 앱에서 프롬프트 전송
- 채팅창이 열리지 않는지 확인
- Output 패널에서 CLI 로그 확인

## 코드 레벨 확인 (고급)

Extension 코드에서 CLI 모드 체크:

```typescript
// extension.ts
const config = vscode.workspace.getConfiguration('cursorRemote');
const useCLIMode = config.get<boolean>('useCLIMode', false);
console.log('CLI Mode:', useCLIMode); // 디버깅용
```

Output 패널에서 이 값이 `true`로 표시되는지 확인하세요.

## 문제가 계속되는 경우

1. **Extension 재컴파일**:
   ```bash
   cd /Users/herace/Workspace/cursor-remote/cursor-extension
   npm run compile
   ```

2. **Extension 완전 재로드**:
   - `Cmd + Shift + P` → `Developer: Reload Window`
   - 또는 Cursor IDE 재시작

3. **설정 파일 직접 확인**:
   - 설정 파일이 올바른지 확인
   - JSON 형식이 올바른지 확인 (쉼표, 중괄호 등)

4. **Output 패널에서 에러 확인**:
   - CLI 모드 관련 에러 메시지 확인
   - CLI 핸들러 초기화 에러 확인

---

**작성 시간**: 2026년 1월 20일  
**수정 시간**: 2026년 1월 20일
