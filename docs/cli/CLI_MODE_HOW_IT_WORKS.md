# CLI 모드 작동 방식

> ✅ **v1.0부터 CLI 모드가 기본값입니다.** IDE 모드는 deprecated 되었습니다.

## 핵심 개념

**CLI 모드는 Cursor CLI를 따로 켜둘 필요가 없습니다!**

Extension이 필요할 때마다 `agent` 명령어를 프로세스로 실행합니다.

## 작동 방식

### 1. 프로세스 실행 방식

CLI 모드에서 Extension은 다음과 같이 작동합니다:

```
모바일 앱 → PC 서버 → Extension → agent 명령어 실행 (프로세스)
                                    ↓
                              응답 수신 (stdout)
                                    ↓
                              모바일 앱으로 전송
```

### 2. 실제 실행 과정

프롬프트를 전송하면:

1. Extension이 `agent` 명령어를 프로세스로 실행:
   ```bash
   agent -p --output-format json --force "프롬프트"
   ```

2. CLI가 응답을 생성하고 종료

3. Extension이 응답을 파싱하여 모바일 앱으로 전송

4. 프로세스 종료

### 3. 터미널에서 실행하는 것과 동일

CLI 모드는 터미널에서 다음과 같이 실행하는 것과 동일합니다:

```bash
agent -p --output-format json --force "Hello, world!"
```

터미널에서 이 명령어를 실행할 때 별도의 프로그램을 켜둘 필요가 없는 것처럼, Extension도 마찬가지입니다.

## 필요한 것

### 1. Cursor CLI 설치

```bash
curl https://cursor.com/install -fsS | bash
```

### 2. 인증 (한 번만 필요)

```bash
agent login
```

인증 정보는 저장되므로 한 번만 로그인하면 됩니다.

### 3. PATH 설정 (선택사항)

Extension은 자동으로 다음 경로를 확인합니다:
- `~/.local/bin/agent`
- `~/.local/bin/cursor-agent`
- PATH의 `agent` 명령어

따라서 PATH에 추가하지 않아도 작동합니다.

## IDE 모드 vs CLI 모드

### IDE 모드
- Cursor IDE가 실행되어 있어야 함
- 채팅 패널이 열려야 함
- IDE와 상호작용

### CLI 모드
- Cursor IDE가 실행되어 있지 않아도 됨 (Extension만 있으면 됨)
- 별도 프로그램을 켜둘 필요 없음
- `agent` 명령어를 프로세스로 실행

## 장점

1. **헤드리스 환경 지원**: Cursor IDE가 없어도 작동
2. **자동화 친화적**: 스크립트와 CI/CD에 적합
3. **리소스 효율적**: 필요할 때만 프로세스 실행
4. **독립적**: IDE 상태와 무관하게 작동

## 확인 방법

### CLI 모드가 제대로 작동하는지 확인

Output 패널에서 다음 로그 확인:

```
[CLI] sendPrompt called - textLength: XX, execute: true
[CLI] Using CLI command: /Users/xxx/.local/bin/agent
[CLI] Executing: /Users/xxx/.local/bin/agent -p --output-format json --force "프롬프트"
[CLI] CLI stdout: {...}
[CLI] CLI process exited with code 0
```

### 인증 상태 확인

```bash
agent status
```

인증이 완료되어 있으면:
```
✅ Authenticated as: your-email@example.com
```

## 요약

- ✅ Cursor CLI를 따로 켜둘 필요 없음
- ✅ Extension이 필요할 때마다 `agent` 명령어 실행
- ✅ 인증은 한 번만 필요 (`agent login`)
- ✅ 프로세스가 응답을 생성하고 종료
- ✅ IDE 모드와 달리 IDE가 실행되어 있지 않아도 됨

---

**작성 시간**: 2026년 1월 20일  
**수정 시간**: 2026년 1월 20일
