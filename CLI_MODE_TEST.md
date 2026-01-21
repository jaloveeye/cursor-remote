# CLI 모드 테스트 가이드

## 설정 확인

### 1. Output 패널에서 확인

1. **Output 패널 열기**: `Cmd + Shift + U`
2. 드롭다운에서 **"Cursor Remote"** 선택
3. 다음 메시지 확인:
   - ✅ **CLI 모드 활성화**: `[Cursor Remote] CLI mode is enabled - using Cursor CLI instead of IDE`
   - ✅ **IDE 모드 활성화**: `[Cursor Remote] IDE mode is enabled - using Cursor IDE extension`

### 2. 설정 파일 확인

터미널에서 확인:

```bash
cat ~/Library/Application\ Support/Cursor/User/settings.json | grep -i cursorRemote
```

다음과 같이 표시되어야 합니다:
```json
"cursorRemote.useCLIMode": true
```

또는

```json
"cursorRemote.useCLIMode": false
```

## CLI 모드 테스트

### 1. Cursor CLI 설치 확인

```bash
~/.local/bin/agent --version
```

또는

```bash
which agent
which cursor-agent
```

### 2. Cursor CLI 인증 확인

```bash
~/.local/bin/agent status
```

인증이 안 되어 있으면:
```bash
~/.local/bin/agent login
```

### 3. 간단한 테스트

터미널에서 직접 테스트:

```bash
~/.local/bin/agent -p --output-format json --force "Hello, world!"
```

## Extension을 통한 테스트

### 1. 모바일 앱 연결

1. PC 서버 실행:
   ```bash
   cd pc-server
   npm start
   ```

2. 모바일 앱에서 연결

3. 프롬프트 전송

### 2. Output 패널 모니터링

CLI 모드에서 프롬프트를 전송하면 Output 패널에 다음 메시지가 표시됩니다:

```
[CLI] sendPrompt called - textLength: XX, execute: true
[CLI] Using CLI command: /Users/xxx/.local/bin/agent
[CLI] Executing: /Users/xxx/.local/bin/agent -p --output-format json --force "프롬프트"
[CLI] CLI stdout: ...
[CLI] CLI process exited with code 0
```

## 문제 해결

### CLI를 찾을 수 없는 경우

Extension은 다음 순서로 CLI를 찾습니다:
1. PATH의 `agent` 명령어
2. PATH의 `cursor-agent` 명령어
3. `~/.local/bin/agent`
4. `~/.local/bin/cursor-agent`

Output 패널에서 어떤 경로를 사용하는지 확인하세요.

### CLI 실행 오류

Output 패널에서 에러 메시지 확인:
- `CLI process error: ...`
- `Error in sendPrompt: ...`

### 인증 오류

```bash
~/.local/bin/agent logout
~/.local/bin/agent login
```

## CLI 모드 vs IDE 모드 비교

| 동작 | CLI 모드 | IDE 모드 |
|------|---------|---------|
| 프롬프트 전송 | `agent` 명령어 실행 | IDE 채팅 패널 사용 |
| 응답 수신 | 프로세스 stdout | 채팅 패널 모니터링 |
| Cursor IDE 필요 | ❌ | ✅ |
| Cursor CLI 필요 | ✅ | ❌ |

## 다음 단계

1. ✅ 설정 확인 완료
2. ✅ CLI 모드 활성화 확인
3. 🔄 모바일 앱에서 프롬프트 전송 테스트
4. 🔄 Output 패널에서 로그 확인
5. 🔄 CLI 응답이 모바일 앱에 전달되는지 확인

---

**작성 시간**: 2026년 1월 20일  
**수정 시간**: 2026년 1월 20일
