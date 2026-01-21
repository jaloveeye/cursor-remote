# Cursor CLI 인증 가이드

## 인증 오류 해결

터미널에서 다음과 같은 오류가 나타나면 인증이 필요합니다:

```
Error: Authentication required. Please run 'agent login' first, or set CURSOR_API_KEY environment variable.
```

## 인증 방법

### 방법 1: 브라우저 로그인 (권장)

```bash
~/.local/bin/agent login
```

또는

```bash
agent login
```

이 명령어를 실행하면:

1. 브라우저가 자동으로 열립니다
2. Cursor 계정으로 로그인합니다
3. 인증이 완료됩니다

### 방법 2: API 키 사용 (자동화/CI용)

1. **API 키 생성**:
   - Cursor 웹사이트에서 로그인
   - Settings → Integrations → API Keys
   - 새 API 키 생성

2. **환경 변수 설정**:

   ```bash
   export CURSOR_API_KEY=your_api_key_here
   ```

3. **영구적으로 설정** (선택사항):

   ```bash
   # Zsh
   echo 'export CURSOR_API_KEY=your_api_key_here' >> ~/.zshrc
   source ~/.zshrc
   
   # Bash
   echo 'export CURSOR_API_KEY=your_api_key_here' >> ~/.bashrc
   source ~/.bashrc
   ```

## 인증 상태 확인

```bash
~/.local/bin/agent status
```

인증이 완료되면 다음과 같이 표시됩니다:

```
✅ Authenticated as: your-email@example.com
```

## 인증 해제

```bash
~/.local/bin/agent logout
```

## 문제 해결

### 1. 브라우저가 열리지 않는 경우

터미널에 표시된 URL을 수동으로 브라우저에 입력하세요.

### 2. 인증 후에도 오류가 발생하는 경우

```bash
# 로그아웃 후 다시 로그인
~/.local/bin/agent logout
~/.local/bin/agent login
```

### 3. API 키가 작동하지 않는 경우

- API 키가 올바른지 확인
- 환경 변수가 제대로 설정되었는지 확인:

  ```bash
  echo $CURSOR_API_KEY
  ```

## Extension에서 사용 시

Extension은 CLI를 실행할 때 사용자의 인증 정보를 자동으로 사용합니다. 별도의 설정이 필요하지 않습니다.

단, CLI가 인증되지 않은 상태라면 Extension도 작동하지 않으므로, 먼저 `agent login`을 실행해야 합니다.

## 테스트

인증 후 다음 명령어로 테스트:

```bash
~/.local/bin/agent -p --output-format json --force 'Hello, world!'
```

또는

```bash
agent -p --output-format json --force 'Hello, world!'
```

---

**작성 시간**: 2026년 1월 20일  
**수정 시간**: 2026년 1월 20일
