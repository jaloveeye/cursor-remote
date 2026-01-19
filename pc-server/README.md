# Cursor Remote PC Server

PC 브릿지 서버로, 모바일 앱과 Cursor IDE 확장 간의 통신을 중계합니다.

## 기능

- WebSocket 서버 (포트 8766) - 모바일 앱과 통신
- HTTP 서버 (포트 8765) - Cursor 확장과 통신
- 메시지 중계 및 라우팅

## 실행

```bash
npm install
npm run build
npm start
```

개발 모드:

```bash
npm run dev
```

## 네트워크

서버 시작 시 표시되는 IP 주소를 모바일 앱에 입력하세요.
