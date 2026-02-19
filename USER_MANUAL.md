# Cursor Remote 사용자 매뉴얼

**모바일에서 Cursor IDE를 원격 제어하기 위한 완벽 가이드**

---

## 목차

1. [개요](#1-개요)
2. [사전 요구사항](#2-사전-요구사항)
3. [연결 방식 비교](#3-연결-방식-비교)
4. [Cursor Extension 설치](#4-cursor-extension-설치)
5. [로컬 서버 연결 방법](#5-로컬-서버-연결-방법)
6. [릴레이 서버 연결 방법](#6-릴레이-서버-연결-방법)
7. [모바일 앱 설정](#7-모바일-앱-설정)
8. [Cursor 2.4 기능](#8-cursor-24-기능)
9. [문제 해결](#9-문제-해결)

---

## 1. 개요

### Cursor Remote란?

Cursor Remote는 모바일 기기에서 PC의 Cursor IDE를 원격으로 제어할 수 있는 시스템입니다.

**주요 기능:**
- 📝 모바일에서 Cursor IDE에 텍스트 입력
- ⚡ Cursor IDE 명령 원격 실행
- 🤖 AI 응답 실시간 확인
- 📊 작업 결과 모바일에서 확인
- 🌍 릴레이 모드로 어디서든 연결 (같은 네트워크 불필요)
- 🔐 세션 ID 저장/재사용, Heartbeat 기반 연결 관리

### 시스템 구성

```
┌─────────────┐                    ┌─────────────┐                    ┌─────────────┐
│   Mobile    │◄───────────────────►│   Server    │◄───────────────────►│  Cursor IDE │
│     App     │     WebSocket       │  (Local or  │     Extension API   │  Extension  │
└─────────────┘                     │   Relay)    │                     └─────────────┘
                                    └─────────────┘
```

---

## 2. 사전 요구사항

### PC 환경

| 항목 | 요구사항 |
|------|---------|
| OS | Windows, macOS, Linux |
| Cursor IDE | 최신 버전 설치 |
| Cursor CLI | 설치 및 인증 필요 (CLI 모드 사용 시) |
| Node.js | v18 이상 권장 |
| npm | Node.js와 함께 설치됨 |

### Cursor CLI 설치 및 인증

CLI 모드를 사용하려면 Cursor CLI를 설치하고 인증해야 합니다.

#### CLI 설치

```bash
curl https://cursor.com/install -fsS | bash
```

이 명령어는 Cursor CLI를 `~/.local/bin/` 디렉토리에 설치합니다.

#### PATH 설정

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

#### 설치 확인

```bash
which agent
# 또는
agent --version
```

#### 인증 (필수)

```bash
agent login
```

브라우저가 열리며 Cursor 계정으로 로그인합니다. 인증은 저장되므로 한 번만 로그인하면 됩니다.

#### 인증 상태 확인

```bash
agent status
```

인증되면 다음과 같이 표시됩니다:
```
✅ Authenticated as: your-email@example.com
```

#### CLI 테스트

```bash
agent -p --output-format json --force 'Hello, world!'
```

JSON 응답이 출력되면 CLI 설정이 완료된 것입니다.

### 모바일 환경

| 항목 | 요구사항 |
|------|---------|
| Android | 5.0 이상 |
| iOS | 12.0 이상 |
| 네트워크 | Wi-Fi 또는 모바일 데이터 |

### 네트워크 요구사항

| 연결 방식 | 네트워크 조건 |
|-----------|--------------|
| 로컬 서버 | PC와 모바일이 **같은 Wi-Fi** 네트워크에 연결 |
| 릴레이 서버 | 인터넷 연결만 있으면 됨 (네트워크 무관) |

---

## 3. 연결 방식 비교

Cursor Remote는 두 가지 연결 방식을 지원합니다.

### 로컬 서버 vs 릴레이 서버

| 특성 | 로컬 서버 | 릴레이 서버 |
|------|----------|------------|
| **네트워크** | 같은 Wi-Fi 필수 | 어디서나 연결 가능 |
| **응답 속도** | ⚡ 매우 빠름 | 🔄 약간의 지연 |
| **설정 난이도** | 쉬움 | 약간 복잡 |
| **보안** | 로컬 네트워크 내 | 인터넷 통신 (암호화됨) |
| **서버 관리** | PC에서 직접 실행 | Vercel 클라우드 사용 |
| **외부 접속** | ❌ 불가 | ✅ 가능 |

### 언제 어떤 방식을 선택할까?

**로컬 서버 권장:**
- 집이나 사무실에서 같은 Wi-Fi 사용 시
- 빠른 응답 속도가 중요할 때
- 간단한 설정을 원할 때

**릴레이 서버 권장:**
- 외부에서 PC에 접속해야 할 때
- 모바일 데이터를 사용할 때
- 네트워크 환경이 다를 때

---

## 4. Cursor Extension 설치

> ⚠️ **중요**: 로컬 서버든 릴레이 서버든, Extension 설치는 **반드시 필요**합니다.

### Step 1: 소스 코드 다운로드

```bash
# 프로젝트 클론
git clone https://github.com/your-repo/cursor-remote.git
cd cursor-remote
```

### Step 2: Extension 컴파일

```bash
cd cursor-extension
npm install
npm run compile
```

### Step 3: Cursor IDE에 Extension 로드

**방법 A: 개발자 모드로 로드 (권장)**

1. Cursor IDE 실행
2. `Cmd+Shift+P` (Mac) / `Ctrl+Shift+P` (Windows/Linux)
3. "Developer: Install Extension from Location..." 검색 및 선택
4. `cursor-extension` 폴더 선택

**방법 B: F5로 개발 호스트 실행**

1. VS Code/Cursor에서 `cursor-extension` 폴더 열기
2. `F5` 키를 눌러 Extension Development Host 실행
3. 새 창이 열리면서 Extension 활성화

### Step 4: Extension 활성화 확인

Extension이 정상적으로 활성화되면 상태 표시줄 우측 하단에 다음이 표시됩니다:

| 상태 | 의미 |
|------|------|
| ☁️ **Cursor Remote: 비활성** | WebSocket 서버 실행 중, 로컬/릴레이 클라이언트 미연결 |
| ☁️ **Cursor Remote: Connected** | 클라이언트 연결됨 (릴레이 연결 시 세션 ID 표시 가능) |
| 🚫 **Cursor Remote: Stopped** | 서버 중지됨 |

**상태 표시줄이 안 보인다면:**
- 명령 팔레트 (`Cmd+Shift+P`)에서 "Start Cursor Remote Server" 실행

### Cursor IDE 설정

#### 설정 열기

**가장 빠른 방법:**
- `Cmd + ,` (Mac) / `Ctrl + ,` (Windows/Linux)

**또는 메뉴에서:**
- 상단 메뉴바 → Cursor → Settings → Settings

**또는 명령 팔레트:**
- `Cmd+Shift+P` → "Preferences: Open Settings"

#### Cursor Remote 설정 찾기

설정이 열리면 검색창에 `Cursor Remote` 또는 `cursorRemote`를 입력하세요.

**설정 항목:**
- **"Cursor Remote: Use CLI Mode"** - CLI 모드 활성화/비활성화

#### 설정 파일 직접 편집 (고급)

JSON 형식으로 직접 편집하려면:
1. `Cmd+Shift+P` → "Preferences: Open User Settings (JSON)"
2. 다음 설정 추가:

```json
{
  "cursorRemote.useCLIMode": true
}
```

#### 설정 확인

**Output 패널 확인:**
- `View` → `Output` (또는 `Cmd + Shift + U`)
- 드롭다운에서 "Cursor Remote" 선택
- 다음 메시지 확인:
  - CLI 모드: `[Cursor Remote] CLI mode is enabled`
  - IDE 모드: `[Cursor Remote] IDE mode is enabled`

---

## 5. 로컬 서버 연결 방법

### 아키텍처 (현재)

```
┌─────────────┐     WebSocket (ws://<PC_IP>:<PORT>)     ┌─────────────┐
│   Mobile    │◄────────────────────────────────────────►│  Cursor IDE │
│     App     │                                          │  Extension  │
└─────────────┘                                          └─────────────┘

※ 기본 포트는 8766, 충돌 시 Extension이 8767~8776 중 사용 가능한 포트로 자동 시작
※ PC와 모바일이 같은 Wi-Fi 네트워크에 있어야 합니다
```

### Step 1: Extension 실행 확인

1. Cursor IDE 실행
2. 상태 표시줄에서 "Cursor Remote: 비활성" 또는 "Cursor Remote: Connected" 확인
3. 안 보이면: `Cmd+Shift+P` → "Start Cursor Remote Server"

### Step 2: PC IP와 Extension 포트 확인

1. PC의 로컬 IP 확인:
   ```bash
   # macOS/Linux
   ifconfig | grep "inet " | grep -v 127.0.0.1

   # Windows
   ipconfig | findstr IPv4
   ```
2. Cursor IDE Output 패널(`View` → `Output` → "Cursor Remote")에서 다음 로그 확인:
   - `WebSocket server started on port 8766` (기본)
   - 또는 `포트 8766가 사용 중이어서 포트 8767...` 후 실제 시작 포트

> 📝 **메모**: IP와 실제 포트를 모바일 앱에 동일하게 입력해야 연결됩니다.

### Step 3: 모바일 앱 연결

1. 모바일 앱 실행
2. **연결 모드**: "로컬 서버" 선택
3. **서버 주소**: Extension이 실행 중인 PC의 IP 입력 (예: `192.168.0.10`)
4. **포트**: Extension 실제 포트 입력 (기본 `8766`)
5. **Connect** 버튼 클릭

### Step 4: 연결 확인

**성공 시:**
- 모바일 앱: 연결 상태 아이콘이 녹색으로 변경
- Cursor Extension: "Cursor Remote: Connected" 표시
- Output 패널: `Client connected to Cursor Remote` 로그 출력

### 포트 정보

| 포트 | 프로토콜 | 용도 |
|------|----------|------|
| 8766 | WebSocket | 모바일 앱 ↔ Extension (기본 포트, 충돌 시 8767~8776 자동 대체) |

---

## 6. 릴레이 서버 연결 방법

### 아키텍처 (0.3.6+)

```
┌─────────────┐                    ┌─────────────────┐                    ┌─────────────┐
│   Mobile    │◄── HTTP/SSE ──────►│  Vercel Relay   │◄── HTTP/Polling ──►│  Cursor IDE │
│     App     │    (인터넷)         │     Server      │    (인터넷)         │  Extension  │
└─────────────┘                    │                 │                    │ (RelayClient│
       │                           │  ┌───────────┐  │                    │  + CLI)     │
       │                           │  │  Upstash  │  │                    └─────────────┘
       │                           │  │   Redis   │  │                           │
       │                           │  └───────────┘  │                           │
       │                           └─────────────────┘                           │
       │                                   │                                     │
       └───────── Session ID (예: ABC123) ─┴─────────────────────────────────────┘

※ PC와 모바일이 다른 네트워크에 있어도 연결 가능
※ Extension이 직접 릴레이 서버에 연결 (Heartbeat로 연결 유지)
```

### 익스텐션: 세션 ID 입력·저장

- **입력 시점**: 상태줄의 **"Cursor Remote"** 를 클릭하거나 명령 팔레트의 **"Cursor Remote: 세션 ID로 릴레이 연결"** 을 실행하면 세션 ID 6자를 입력할 수 있습니다.
- **저장**: 연결에 사용한 세션 ID는 **globalState**에 저장되어, 다음 입력 시 기본값으로 재사용됩니다.
- **변경**: 명령 팔레트의 **"Cursor Remote: 릴레이 세션 ID 설정 (다음 시작 시 사용)"** 으로 저장 값을 바꿀 수 있습니다. 단, 릴레이 연결 자체는 현재 수동으로 시작해야 합니다.
- **중복 사용**: 같은 세션 ID를 **다른 PC(다른 Cursor 창)** 에서 쓰면, 릴레이 서버가 **409 "Session already in use by another PC"** 를 반환합니다. 다른 PC를 닫거나, 모바일에서 새 세션을 만든 뒤 그 세션 ID를 사용하세요.

### 세션 ID 연속성

- 세션 ID는 **릴레이 서버 TTL(기본 24시간)** 동안 유효합니다. 같은 ID로 24시간 이내에는 재접속 가능합니다.
- **24시간 경과 후**에는 세션이 만료되므로, 모바일에서 **새 세션을 생성**한 뒤 익스텐션에 그 세션 ID를 설정(또는 "세션 ID로 릴레이 연결")해야 합니다.
- 즉, "같은 세션 ID를 영구적으로 보장"하는 구조는 아니며, **만료 전까지** 연속성이 유지됩니다.

### 사전 준비: 릴레이 서버 배포 (한 번만)

> 💡 이미 배포된 릴레이 서버가 있다면 이 단계는 건너뛰세요.
> 기본 제공 서버: `https://relay.jaloveeye.com`

#### A. Upstash Redis 설정

1. [Upstash Console](https://console.upstash.com) 접속 및 회원가입
2. "Create Database" 클릭
3. 데이터베이스 이름 입력 (예: `cursor-remote-relay`)
4. 리전 선택 (가까운 곳 권장)
5. 생성 후 **REST API** 섹션에서 다음 정보 복사:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

#### B. Vercel에 릴레이 서버 배포

```bash
# Vercel CLI 설치 (처음 한 번만)
npm install -g vercel

# 릴레이 서버 디렉토리로 이동
cd relay-server

# 의존성 설치
npm install

# Vercel 로그인
vercel login

# 배포
vercel --prod
```

**환경변수 설정:**
```bash
vercel env add UPSTASH_REDIS_REST_URL
# 프롬프트에서 Upstash URL 입력

vercel env add UPSTASH_REDIS_REST_TOKEN
# 프롬프트에서 Upstash Token 입력
```

배포 완료 후 URL을 확인하세요 (예: `https://your-relay.vercel.app`)

### Step 1: Extension 실행 확인

1. Cursor IDE 실행
2. 상태 표시줄에서 "Cursor Remote: 비활성" 또는 "Cursor Remote: Connected" 확인

### Step 2: Extension이 릴레이 모드로 연결

> **0.3.6 이후**: 릴레이 연결은 Extension이 직접 수행합니다 (PC 서버 없음).

#### 연결 시작

1. Cursor IDE 실행 및 Extension 활성화
2. 상태줄의 **"Cursor Remote"** 클릭 (또는 명령 팔레트의 **"Cursor Remote: 세션 ID로 릴레이 연결"** 실행)
3. 6자리 영숫자 세션 ID 입력 (예: `ABC123`)
4. 필요하면 PIN(4~6자리 숫자) 입력
5. Extension이 해당 세션 ID로 릴레이 서버에 연결을 시도합니다

**연결 성공 예시 (Output 패널):**
```
[Cursor Remote] Starting relay client...
[Cursor Remote] Target session ID: ABC123
[Cursor Remote] ✅ 익스텐션은 릴레이 서버를 통해 세션 ABC123에 접속했습니다.
[Cursor Remote] 💓 Heartbeat 시작 (30초마다, 2분 무응답 시 연결 해제로 간주)
```

#### 세션 ID 변경

| 명령어 | 설명 |
|--------|------|
| `Cursor Remote: 세션 ID로 릴레이 연결` | 다른 세션에 **즉시** 연결 (성공 시 저장됨) |
| `Cursor Remote: 릴레이 세션 ID 설정 (다음 시작 시 사용)` | 저장된 세션 ID 변경 (다음 입력 시 기본값으로 사용) |
| `Cursor Remote: 릴레이 서버 상태 확인` | 릴레이 서버 상태 및 세션 수 확인 |

#### Heartbeat 및 세션 해제

- Extension이 30초마다 heartbeat를 전송합니다
- **2분간 heartbeat가 없으면** 서버가 해당 PC를 연결 끊김으로 간주합니다
- 이후 같은 세션 ID로 다른 PC가 연결할 수 있습니다
- Cursor 창을 닫으면 자동으로 세션이 해제됩니다 (2분 후)

### Step 3: 모바일 앱 연결

1. 모바일 앱 실행
2. **연결 모드**: "릴레이 서버" 선택
3. **릴레이 서버 URL**: 배포한 릴레이 서버 주소 입력
   - 기본: `https://relay.jaloveeye.com`
4. **세션 ID**: Extension에 입력한 **동일한 6자리 코드** 입력 (예: `ABC123`)
5. **Connect** 버튼 클릭

### Step 4: 연결 확인

**성공 시:**
- 모바일 앱: 연결 상태 아이콘이 녹색으로 변경
- Extension Output 패널: "Mobile client connected via relay" 또는 폴링 메시지 확인

### 세션 충돌 (409 에러)

같은 세션 ID를 **다른 PC(다른 Cursor 창)**에서 사용하면 다음 에러가 발생합니다:

```
Session already in use by another PC
```

**해결 방법:**
1. 다른 PC/Cursor 창을 닫습니다
2. 또는 모바일에서 새 세션을 생성한 뒤 해당 세션 ID를 사용합니다
3. 기존 PC가 2분 이상 비활성 상태이면 자동으로 세션이 해제됩니다

### 릴레이 서버 API 엔드포인트

| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/api/health` | GET | 서버 상태 확인 |
| `/api/session` | POST | 새 세션 생성 |
| `/api/connect` | POST | 세션에 연결 (PC 연결 시 세션 자동 생성 가능) |
| `/api/heartbeat` | GET | PC "살아있음" 신호 (sessionId, deviceId 쿼리) |
| `/api/send` | POST | 메시지 전송 |
| `/api/poll` | GET | 메시지 폴링 |
| `/api/stream` | GET | SSE 스트림 연결 |
| `/api/debug-sessions` | GET | 서버 상태 확인 (세션 수, PC 연결 현황) |

### 세션 및 메시지 유효 기간

| 항목 | 유효 기간 |
|------|----------|
| 세션 | 24시간 |
| 메시지 | 5분 |

---

## 7. 모바일 앱 설정

### 앱 빌드 및 설치

```bash
cd mobile-app
flutter pub get
flutter build apk        # Android
flutter build ios        # iOS
```

### 앱 설정 화면

앱 실행 후 설정에서 다음을 구성:

| 설정 항목 | 로컬 서버 모드 | 릴레이 서버 모드 |
|----------|---------------|-----------------|
| 연결 모드 | Local | Relay |
| 서버 주소 | PC IP (예: 192.168.0.10) | 릴레이 URL |
| 세션 코드 | - (불필요) | 6자리 코드 |
| 포트 | Extension 포트 (기본 8766) | - (불필요) |

### 기본 사용법

1. **텍스트 전송**
   - 텍스트 입력 후 "Send" 버튼
   - Cursor IDE 에디터에 텍스트 삽입됨

2. **명령 실행**
   - "Save", "Undo", "Redo" 등 명령 버튼 클릭
   - Cursor IDE에서 해당 명령 실행됨

3. **AI 프롬프트 전송**
   - 프롬프트 입력 후 "Ask AI" 버튼
   - AI 응답이 앱에 표시됨

---

## 8. Cursor 2.4 기능

Cursor Remote는 Cursor 2.4의 새로운 기능들과 완전 호환됩니다.

### 호환성 확인 완료

| 기능 | 상태 | 비고 |
|------|------|------|
| **Subagents** | ✅ 자동 지원 | CLI가 자동으로 서브에이전트 사용 |
| **Skills (SKILL.md)** | ✅ 자동 지원 | 워크스페이스에 SKILL.md 있으면 자동 적용 |
| **Clarification Questions** | ✅ 지원 | 에이전트 질문 → 모바일 답변 → 세션 유지 |
| **Image Generation** | ⚠️ 부분 지원 | 생성 결과는 `assets/`에 저장됨 |

### Subagents (서브에이전트)

Cursor 2.4의 서브에이전트는 **자동으로 동작**합니다. 별도 설정 없이 모바일에서 프롬프트를 전송하면 CLI가 필요에 따라 서브에이전트를 활용합니다.

**특징:**
- 코드베이스 조사, 터미널 작업 등을 병렬로 처리
- 응답 품질 향상
- 추가 설정 불필요

### Skills (SKILL.md)

워크스페이스에 `SKILL.md` 파일을 추가하면 커스텀 명령이나 절차를 정의할 수 있습니다.

**사용 방법:**
1. 프로젝트 루트 또는 `.cursor/` 폴더에 `SKILL.md` 생성
2. 커스텀 명령, 스크립트, 절차 정의
3. 모바일에서 프롬프트 전송 시 자동 적용

**예시 (SKILL.md):**
```markdown
# 프로젝트 빌드 스킬

## build
프로젝트를 빌드합니다:
1. npm install 실행
2. npm run build 실행
3. 빌드 결과 확인
```

### Clarification Questions (에이전트 질문)

에이전트가 작업 중 추가 정보가 필요할 때 질문을 던질 수 있습니다. Cursor Remote에서는 이 흐름이 완전히 지원됩니다.

**동작 방식:**
1. 모바일에서 프롬프트 전송
2. 에이전트가 질문 응답 (예: "어떤 기능을 추가할까요?")
3. 모바일에서 답변 입력
4. **같은 세션**에서 대화 계속 (`--resume` 자동 사용)

**기술 세부사항:**
- 에이전트 질문은 `assistant` 타입 메시지로 전달
- `session_id`가 유지되어 대화 컨텍스트 보존
- Extension이 자동으로 세션 관리

### Image Generation (이미지 생성)

> ⚠️ CLI에서 이미지 생성 지원 여부는 Cursor 버전에 따라 다를 수 있습니다.

에이전트가 이미지를 생성하면 기본적으로 `assets/` 폴더에 저장됩니다.

**참고:**
- 이미지 생성 요청 시 응답에 파일 경로 포함
- 생성된 이미지는 PC의 워크스페이스에서 확인 가능

### CLI 옵션 참고

Cursor Remote Extension이 사용하는 CLI 옵션:

```bash
cursor agent -p \
  --resume <session_id> \      # 세션 재개
  --mode <plan|ask> \          # 모드 선택
  --output-format stream-json \
  --stream-partial-output \
  --force \
  "<prompt>"
```

| 옵션 | 설명 |
|------|------|
| `-p` | 비대화형 모드 (스크립트용) |
| `--resume` | 이전 세션 재개 |
| `--mode` | plan(계획), ask(질문) 모드 |
| `--output-format` | 출력 형식 (stream-json) |
| `--force` | 명령 자동 승인 |

---

## 9. 문제 해결

### 에러 메시지 빠른 참조

| 에러 메시지 | 원인 | 해결 방법 |
|------------|------|----------|
| `EADDRINUSE` | 포트가 이미 사용 중 | [포트 충돌 해결](#포트-충돌-eaddrinuse) |
| `EPERM: operation not permitted` | 네트워크 권한 문제 | [권한 문제 해결](#포트-권한-문제-eperm) |
| `Cursor CLI (agent)가 설치되어 있지 않습니다` | CLI 미설치 | [CLI 설치](#cli-미설치) |
| `Failed to connect to relay` | 릴레이 서버 연결 실패 | [릴레이 연결 문제](#릴레이-서버-연결-실패) |
| `Session not found` / `세션이 만료됨` | 세션 만료 또는 없음 | [세션 문제](#세션-만료-또는-없음) |
| `No active editor` | 편집기 열려 있지 않음 | Cursor에서 파일 열기 |
| `WebSocket connection failed` | WebSocket 연결 실패 | [WebSocket 문제](#websocket-연결-실패) |

---

### Extension 관련

#### Extension이 활성화되지 않는 경우

**증상:** 상태 표시줄에 Cursor Remote가 표시되지 않음

**해결:**
```bash
# 다시 컴파일
cd cursor-extension
npm install
npm run compile
```

1. Cursor IDE 재시작
2. 명령 팔레트에서 "Developer: Reload Window" 실행
3. 그래도 안 되면: `Cmd+Shift+P` → "Start Cursor Remote Server"

#### 상태 표시줄이 보이지 않는 경우

1. `Cmd+Shift+P` → "Start Cursor Remote Server" 실행
2. Output 패널 확인: `View` → `Output` → "Cursor Remote" 선택
3. 에러 메시지가 있으면 해당 섹션 참조

---

### 포트 관련

#### 포트 충돌 (EADDRINUSE)

**증상:**
```
Error: listen EADDRINUSE: address already in use :::8766
포트 8766이 사용 중입니다
```

**해결:**
```bash
# 1. 포트 사용 확인
lsof -i :8766

# 2. 해당 프로세스 종료
kill -9 <PID>

# 3. Cursor IDE 재시작
```

> 💡 Extension은 8766 포트가 사용 중이면 8767~8776까지 자동으로 시도합니다. 모바일 앱 포트 입력값도 같은 번호로 맞춰야 합니다.

#### 포트 권한 문제 (EPERM)

**증상:**
```
EPERM: operation not permitted
connect EPERM ::1:8766
connect EPERM 127.0.0.1:8766
```

**해결:**

**macOS:**
1. 시스템 설정 → 개인 정보 보호 및 보안 → 방화벽
2. 방화벽 옵션 → Cursor 허용 추가
3. 또는 방화벽 임시 비활성화 후 테스트

**Windows:**
1. Windows Defender 방화벽 → 앱 허용
2. Cursor IDE 허용 추가

**공통:**
1. Cursor IDE 완전 종료 후 재시작
2. 컴퓨터 재부팅

---

### CLI 관련

#### CLI 미설치

**증상:**
```
Cursor CLI (agent)가 설치되어 있지 않습니다
```

**해결:**
```bash
# 1. CLI 설치
curl https://cursor.com/install -fsS | bash

# 2. PATH 설정 (zsh)
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc

# 3. 설치 확인
which agent
agent --version

# 4. 인증
agent login
```

#### CLI 실행 실패

**증상:**
```
CLI 실행 실패: spawn agent ENOENT
CLI 프롬프트 전송 실패
```

**해결:**
```bash
# 1. PATH 확인
echo $PATH | grep -o '.local/bin'

# 2. agent 실행 가능 확인
which agent
agent status

# 3. 인증 상태 확인
agent status
# ✅ Authenticated as: your-email@example.com 가 표시되어야 함

# 4. 테스트
agent -p --output-format json --force 'test'
```

#### CLI 응답이 비어 있음

**증상:** AI 응답이 오지 않거나 `[CLI Error]`만 표시

**해결:**
1. Cursor IDE가 실행 중인지 확인
2. CLI 인증 상태 확인: `agent status`
3. Output 패널에서 상세 로그 확인
4. `--force` 옵션 없이 직접 테스트: `agent -p 'test prompt'`

---

### 릴레이 서버 관련

#### 릴레이 서버 연결 실패

**증상:**
```
Failed to connect to relay
Poll failed: ...
```

**해결:**
```bash
# 1. 서버 상태 확인
curl https://relay.jaloveeye.com/api/health

# 정상 응답:
# {"success":true,"data":{"status":"healthy","version":"1.0.0","redis":{"urlSet":true,"tokenSet":true}}}

# 2. 인터넷 연결 확인
ping google.com
```

#### 세션 만료 또는 없음

**증상:**
```
Session not found
세션이 만료되었습니다
```

**해결:**
1. Extension 상태줄 "Cursor Remote" 클릭 후 세션 ID(6자리) 입력
2. 모바일 앱에서 새 세션 코드 입력
3. 세션은 24시간 후 자동 만료됨

#### SSE 연결이 자주 끊기는 경우

**원인:** Vercel Serverless 타임아웃 제한
- Free 플랜: 10초
- Pro 플랜: 60초

**해결:**
- 앱이 자동으로 재연결 시도함
- 연결 끊김이 잦으면 로컬 서버 모드 사용 권장

---

### WebSocket 관련

#### WebSocket 연결 실패

**증상:**
```
WebSocket connection failed
WebSocket error: ...
```

**해결:**
1. Extension 서버 실행 확인 (상태 표시줄)
2. 포트 확인: `lsof -i :8766`
3. 방화벽 설정 확인
4. Cursor IDE 재시작

---

### 로컬 서버 관련

#### 모바일 앱이 연결되지 않는 경우

**체크리스트:**

1. **같은 Wi-Fi 네트워크인지 확인**
   - PC와 모바일이 동일한 네트워크에 있어야 함

2. **IP 주소 확인**
   ```bash
   # Mac/Linux
   ifconfig | grep "inet " | grep -v 127.0.0.1
   
   # Windows
   ipconfig | findstr IPv4
   ```

3. **방화벽 확인**
   - Mac: 시스템 설정 → 개인 정보 보호 및 보안 → 방화벽
   - Windows: Windows Defender 방화벽 → 앱 허용

4. **포트 접근 테스트** (다른 기기에서)
   ```bash
   nc -zv <PC_IP> 8766
   ```

---

### 공통 문제

#### 메시지가 전달되지 않는 경우

**디버깅 순서:**
1. Extension 상태 확인 (상태 표시줄: "Connected" 또는 "비활성")
2. Output 패널 로그 확인 (`View` → `Output` → "Cursor Remote")
3. 모바일 앱 연결 상태 확인
4. 네트워크 연결 상태 확인

#### 연결이 불안정한 경우

1. Wi-Fi 신호 강도 확인
2. 라우터 재시작
3. 로컬 서버 대신 릴레이 서버 사용 (또는 반대로)
4. VPN 사용 중이면 비활성화 후 테스트

---

### 로그 확인 방법

#### Extension 로그
1. Cursor IDE에서 `View` → `Output` (또는 `Cmd+Shift+U`)
2. 드롭다운에서 "Cursor Remote" 선택
3. 에러 메시지 및 상태 로그 확인

#### 로그 레벨
| 레벨 | 의미 |
|------|------|
| `INFO` | 일반 정보 |
| `WARN` | 경고 (동작에 영향 없음) |
| `ERROR` | 에러 (기능 동작 불가) |

---

### 자주 묻는 질문

**Q: Extension이 자동으로 시작되지 않아요**
> A: `Cmd+Shift+P` → "Start Cursor Remote Server" 실행

**Q: 세션 코드는 어디서 확인하나요?**
> A: Extension 상태줄 "Cursor Remote"를 클릭해 입력/연결합니다. 이미 연결된 세션 ID는 연결 정보 패널 또는 상태줄 텍스트에서 확인할 수 있습니다.

**Q: 로컬 모드와 릴레이 모드 중 뭘 써야 하나요?**
> A: 같은 Wi-Fi면 로컬 모드 (빠름), 다른 네트워크면 릴레이 모드 사용

**Q: CLI 모드와 IDE 모드의 차이는?**
> A: CLI 모드는 `agent` 명령어 사용, IDE 모드는 편집기에 직접 삽입. CLI 모드 권장.

---

## 부록: 빠른 참조

### 로컬 서버 빠른 시작

```bash
# 1. Extension 설치
cd cursor-extension && npm install && npm run compile

# 2. Cursor IDE 실행 및 Extension 로드

# 3. 모바일 앱에서 로컬 서버 선택
# 4. PC IP + Extension 포트(기본 8766) 입력 후 연결
```

### 릴레이 서버 빠른 시작

```bash
# 1. Extension 설치
cd cursor-extension && npm install && npm run compile

# 2. Cursor IDE 실행 및 Extension 로드

# 3. Extension 상태줄 "Cursor Remote" 클릭 후 세션 ID 입력
# 4. 모바일 앱에서 Relay 모드 선택 후 같은 세션 ID 입력
```

### 포트 요약

| 포트 | 용도 | 사용 시점 |
|------|------|----------|
| 8766 | Extension WebSocket | 항상 |
| 8767~8776 | Extension WebSocket 대체 포트 | 8766 충돌 시 |
| 443 | HTTPS (릴레이 서버) | 릴레이 모드만 |

---

**작성 시간**: 2026년 1월 21일  
**수정 시간**: 2026년 2월 2일 (릴레이 모드 세션 ID 입력/저장, Heartbeat 방식 반영)
