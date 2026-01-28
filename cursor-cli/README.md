# Cursor CLI

Cursor Remote의 CLI 클라이언트입니다. Claude CLI처럼 Cursor IDE의 채팅을 명령줄에서 제어할 수 있습니다.

## 설치

```bash
cd cursor-cli
npm install
npm run build
```

## 전역 설치 (선택사항)

```bash
npm link
```

또는

```bash
npm install -g .
```

## 사용 방법

### 기본 사용법

```bash
# 프롬프트 입력 (실행 안 함)
cursor-chat "Hello, how are you?"

# 프롬프트 입력 및 자동 실행
cursor-chat "Hello, how are you?" --execute

# 또는 짧은 옵션
cursor-chat "Hello" -e

# stdin에서 읽기
echo "Hello" | cursor-chat

# 실행 중인 프롬프트 중지
cursor-chat --stop
```

### 옵션

- `-e, --execute`: 프롬프트를 입력하고 자동 실행
- `-s, --stop`: 실행 중인 프롬프트 중지
- `-p, --port <port>`: WebSocket 서버 포트 (기본값: 8766)
- `-h, --host <host>`: WebSocket 서버 호스트 (기본값: localhost)

### 예제

```bash
# 간단한 프롬프트
cursor-chat "코드를 리팩토링해줘" --execute

# 여러 줄 프롬프트
cursor-chat "다음 코드를 개선해줘:
function test() {
  return 1 + 1;
}" --execute

# 파일에서 읽기
cat prompt.txt | cursor-chat --execute

# 프롬프트 중지
cursor-chat --stop
```

## Gemini CLI와 통합

Gemini CLI와 함께 사용하여 Cursor IDE의 채팅을 제어할 수 있습니다. Claude CLI처럼 동작합니다:

### 기본 사용법

```bash
# Gemini CLI 출력을 Cursor IDE에 전송 (자동 실행)
gemini-cli "코드를 리팩토링해줘" | cursor-chat

# 또는 직접 프롬프트 전송
cursor-chat "코드를 리팩토링해줘"

# 조용한 모드 (에러만 출력, Gemini CLI 파이프와 함께 사용)
gemini-cli "코드 리뷰" | cursor-chat --quiet
```

### Gemini CLI 통합 예제

```bash
# 1. Gemini CLI로 프롬프트 생성 후 Cursor IDE에 전송
echo "이 코드를 개선해줘" | gemini-cli | cursor-chat

# 2. 파일 내용을 Gemini CLI로 처리 후 Cursor IDE에 전송
cat code.py | gemini-cli "이 코드를 리뷰해줘" | cursor-chat

# 3. Gemini CLI와 함께 사용 (조용한 모드)
gemini-cli "코드 최적화" | cursor-chat -q

# 4. Gemini CLI 출력을 받아서 처리
gemini-cli "설명해줘" | cursor-chat --execute
```

### Claude CLI 스타일 사용법

```bash
# Claude CLI처럼 사용
cursor-chat "프롬프트"           # 자동 실행 (기본값)
cursor-chat "프롬프트" --no-execute  # 실행 안 함
cursor-chat --stop                # 실행 중인 프롬프트 중지
```

## 요구사항

- Cursor IDE가 실행 중이어야 함
- Cursor Remote extension이 설치되고 활성화되어 있어야 함
- Extension의 WebSocket 서버가 포트 8766에서 실행 중이어야 함
