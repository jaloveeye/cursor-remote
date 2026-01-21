# Cursor CLI 실행 가이드

## 설치 방법

### 1. 공식 설치 스크립트 사용

```bash
curl https://cursor.com/install -fsS | bash
```

이 명령어는 Cursor CLI를 `~/.local/bin/` 디렉토리에 설치합니다.

### 2. PATH에 추가

설치 후 터미널에서 사용하려면 PATH에 추가해야 합니다.

**Zsh 사용자 (macOS 기본):**
```bash
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

**Bash 사용자:**
```bash
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

### 3. 설치 확인

```bash
which agent
# 또는
which cursor-agent
```

설치가 완료되면 다음 중 하나가 출력됩니다:
- `~/.local/bin/agent`
- `~/.local/bin/cursor-agent`

## 기본 사용법

### 1. 인증 (처음 사용 시 필수)

```bash
agent login
```

또는

```bash
cursor-agent login
```

브라우저가 열리며 Cursor 계정으로 로그인합니다.

### 2. 상태 확인

```bash
agent status
```

### 3. 기본 프롬프트 실행

**대화형 모드:**
```bash
agent "프롬프트 텍스트"
```

**비대화형 모드 (스크립트용):**
```bash
agent -p "프롬프트 텍스트"
```

**JSON 형식 출력:**
```bash
agent -p --output-format json "프롬프트 텍스트"
```

**자동 실행 (승인 없이):**
```bash
agent -p --output-format json --force "프롬프트 텍스트"
```

## Cursor Remote Extension에서 사용

Cursor Remote Extension은 CLI 모드에서 다음 명령어를 사용합니다:

```bash
agent -p --output-format json --force "사용자 프롬프트"
```

또는

```bash
cursor-agent -p --output-format json --force "사용자 프롬프트"
```

## 주요 옵션

| 옵션 | 설명 |
|------|------|
| `-p, --print` | 비대화형 모드 (스크립트용) |
| `--output-format <format>` | 출력 형식: `text`, `json`, `stream-json` |
| `--force` | 자동 실행 (승인 없이) |
| `-m, --model <model>` | 사용할 AI 모델 선택 |
| `--version` | 버전 확인 |
| `login` | 로그인 |
| `logout` | 로그아웃 |
| `status` | 상태 확인 |

## 문제 해결

### 1. "command not found: agent" 오류

**해결 방법:**
1. PATH에 `~/.local/bin`이 추가되었는지 확인:
   ```bash
   echo $PATH | grep local
   ```

2. 직접 경로로 실행:
   ```bash
   ~/.local/bin/agent --version
   ```

3. 심볼릭 링크 생성 (선택사항):
   ```bash
   ln -s ~/.local/bin/agent /usr/local/bin/agent
   ```

### 2. 인증 오류

**해결 방법:**
```bash
agent logout
agent login
```

### 3. Extension에서 CLI를 찾을 수 없음

Extension은 다음 순서로 CLI를 찾습니다:
1. `agent` 명령어 (PATH에서)
2. `cursor-agent` 명령어 (PATH에서)
3. `~/.local/bin/agent`
4. `~/.local/bin/cursor-agent`

직접 경로를 사용하려면 Extension 코드를 수정해야 합니다.

## 예제

### 간단한 프롬프트
```bash
agent "Hello, how are you?"
```

### 파일 편집 요청
```bash
agent -p --force "Add error handling to the main function in src/index.ts"
```

### 코드 리뷰
```bash
agent -p --output-format json "Review the recent changes in the repository"
```

### 스크립트에서 사용
```bash
#!/bin/bash
RESPONSE=$(agent -p --output-format json "Generate a summary of the project")
echo "$RESPONSE" | jq '.text'
```

---

**작성 시간**: 2026년 1월 20일  
**수정 시간**: 2026년 1월 20일
