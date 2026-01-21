# Cursor Remote

[![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)](https://github.com/jaloveeye/cursor-remote)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

**Control Cursor AI from Your Mobile Device 📱**

Cursor Remote는 모바일 기기에서 Cursor AI를 원격으로 제어할 수 있게 해주는 확장입니다. WebSocket을 통해 실시간으로 AI와 대화하고, 코드를 작성하며, 작업 결과를 확인할 수 있습니다.

## 🎯 주요 특징

- 📱 **모바일 제어**: 스마트폰이나 태블릿에서 Cursor AI 제어
- ⚡ **실시간 통신**: WebSocket 기반 양방향 실시간 통신
- 🤖 **CLI 모드**: Cursor CLI(`agent`)를 통한 AI 상호작용
- 🔄 **자동 시작**: Cursor 시작 시 자동으로 서버 시작
- ⚙️ **설정 가능**: 포트 및 자동 시작 옵션 커스터마이징

## ✨ 기능

- 🌐 **WebSocket 서버**: 실시간 양방향 통신 (기본 포트: 8766)
- 🔌 **HTTP REST API**: 명령 실행을 위한 REST API (기본 포트: 8767)
- 📝 **프롬프트 전송**: 모바일에서 Cursor AI에 프롬프트 전송
- ⚡ **CLI 통합**: Cursor CLI(`agent`) 명령어를 통한 AI 상호작용
- 💬 **AI 응답 캡처**: AI 응답을 실시간으로 모바일로 전달
- 📋 **규칙 관리**: Cursor 규칙 파일 원격 관리
- 📊 **상태 표시**: 상태바에서 연결 상태 확인

## 📦 설치

### Cursor 마켓플레이스에서 설치 (권장)

1. Cursor IDE에서 확장 탭 열기 (`Cmd+Shift+X` / `Ctrl+Shift+X`)
2. "Cursor Remote" 검색
3. **설치** 클릭

### VSIX 파일로 설치

1. [Releases](https://github.com/jaloveeye/cursor-remote/releases) 페이지에서 `.vsix` 파일 다운로드
2. Cursor IDE에서 `확장` → `...` → `VSIX에서 설치...` 선택
3. 다운로드한 파일 선택

### 사전 요구사항

- **Cursor CLI 설치**: CLI 모드를 사용하려면 Cursor CLI가 설치되어 있어야 합니다

  ```bash
  curl https://cursor.com/install -fsS | bash
  ```

- **CLI 인증**: 처음 사용 시 인증이 필요합니다

  ```bash
  agent login
  ```

## 🚀 빠른 시작

### 1. Extension 설치

Cursor 마켓플레이스에서 "Cursor Remote"를 검색하여 설치합니다.

### 2. Cursor CLI 설정

CLI 모드를 사용하려면 Cursor CLI를 설치하고 인증해야 합니다:

```bash
# CLI 설치
curl https://cursor.com/install -fsS | bash

# 인증
agent login
```

### 3. 서버 시작

Extension이 설치되면 자동으로 서버가 시작됩니다. 상태바에서 연결 상태를 확인할 수 있습니다.

**수동 시작:**

- 명령 팔레트 (`Cmd+Shift+P` / `Ctrl+Shift+P`) → `Cursor Remote: Start Cursor Remote Server`

### 4. 모바일 앱 연결

모바일 앱에서 PC 서버의 IP 주소로 연결합니다. 자세한 내용은 [프로젝트 README](https://github.com/jaloveeye/cursor-remote)를 참조하세요.

## ⚙️ 설정

| 설정 | 기본값 | 설명 |
|------|--------|------|
| `cursorRemote.autoStart` | `true` | Cursor 시작 시 자동으로 서버 시작 |
| `cursorRemote.port` | `8766` | WebSocket 서버 포트 |
| `cursorRemote.httpPort` | `8767` | HTTP 서버 포트 |

## 📡 API

### WebSocket API

WebSocket 서버에 연결하여 실시간으로 명령을 주고받을 수 있습니다.

```javascript
const ws = new WebSocket('ws://localhost:8766');

// 명령 전송
ws.send(JSON.stringify({
  type: 'execute_command',
  command: 'cursorRemote.toggle'
}));

// 응답 수신
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log(data);
};
```

### HTTP REST API

```bash
# 상태 확인
curl http://localhost:8767/status

# 명령 실행
curl -X POST http://localhost:8767/command \
  -H "Content-Type: application/json" \
  -d '{"command": "execute_command", "args": {"command": "cursorRemote.toggle"}}'
```

## 🔧 개발

```bash
# 의존성 설치
npm install

# 컴파일
npm run compile

# 개발 모드 (자동 컴파일)
npm run watch

# VSIX 패키지 생성
npm run package
```

## 📱 모바일 앱

Cursor Remote는 Flutter로 개발된 모바일 앱과 함께 사용할 수 있습니다.

- **Android**: APK 빌드 및 설치
- **iOS**: Xcode를 통한 빌드
- **Web**: Flutter Web으로 배포 가능

모바일 앱 소스 코드는 [GitHub 저장소](https://github.com/jaloveeye/cursor-remote/tree/main/mobile-app)에서 확인할 수 있습니다.

## 🤝 기여하기

기여를 환영합니다! 버그 리포트, 기능 제안, PR 모두 환영합니다.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다. 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.

## 🤝 기여하기

기여를 환영합니다! 버그 리포트, 기능 제안, Pull Request 모두 환영합니다.

1. 이 저장소를 Fork합니다
2. 기능 브랜치를 생성합니다 (`git checkout -b feature/amazing-feature`)
3. 변경사항을 커밋합니다 (`git commit -m 'feat: Add amazing feature'`)
4. 브랜치에 푸시합니다 (`git push origin feature/amazing-feature`)
5. Pull Request를 엽니다

## 📞 문의 및 지원

- **Author**: 김형진 (<jaloveeye@gmail.com>)
- **Website**: <https://jaloveeye.com>
- **GitHub**: <https://github.com/jaloveeye/cursor-remote>
- **Issues**: [GitHub Issues](https://github.com/jaloveeye/cursor-remote/issues)

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다. 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.

---

**Cursor Remote**로 어디서든 코딩하세요! 🚀
