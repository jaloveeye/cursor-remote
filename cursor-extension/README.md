# Cursor Remote Extension

Cursor IDE 확장으로, WebSocket 서버를 통해 모바일 앱과 통신합니다.

## 기능

- WebSocket 서버 (포트 8766)
- 텍스트 삽입
- Cursor 명령 실행
- AI 응답 가져오기

## 개발

```bash
npm install
npm run compile
npm run watch  # 개발 모드 (자동 컴파일)
```

## 설치

1. `npm run compile` 실행
2. Cursor IDE에서 확장 로드
3. 명령 팔레트에서 "Start Cursor Remote Server" 실행
