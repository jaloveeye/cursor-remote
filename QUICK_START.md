# Cursor Remote 빠른 시작 가이드

## 1단계: Extension 설치 및 실행

```bash
cd cursor-extension
npm install
npm run compile
```

**Cursor IDE에서:**
1. Cursor IDE 실행
2. Extension이 자동으로 활성화됨 (상태 표시줄 확인)
3. 또는 명령 팔레트 (`Cmd+Shift+P`) → "Start Cursor Remote Server"

## 2단계: PC 서버 실행

```bash
cd pc-server
npm install
npm run build
npm start
```

**확인:**
- 서버 IP 주소 확인 (예: `192.168.0.10`)
- Extension 연결 메시지 확인

## 3단계: 모바일 앱 실행

```bash
cd mobile-app
flutter pub get
flutter run
```

**연결:**
1. 앱에서 PC 서버 IP 입력 (예: `192.168.0.10`)
2. "Connect" 버튼 클릭
3. 연결 성공 확인

## 4단계: 테스트

### WebSocket 연결 테스트 (선택사항)

```bash
# 프로젝트 루트에서
node test-websocket.js ws://localhost:8766
```

### 모바일 앱에서 테스트

1. **텍스트 삽입**
   - 텍스트 입력
   - "Send Text" 버튼 클릭
   - Cursor IDE에서 확인

2. **파일 저장**
   - "Save File" 버튼 클릭
   - Cursor IDE에서 파일 저장 확인

3. **명령 실행**
   - "Save (Cmd)" 버튼 클릭
   - Cursor IDE에서 저장 명령 실행 확인

## 문제 해결

### Extension이 시작되지 않는 경우
- Cursor IDE 재시작
- `npm run compile` 다시 실행

### PC 서버가 Extension에 연결되지 않는 경우
- Extension이 실행 중인지 확인
- 포트 8766 충돌 확인: `lsof -i :8766`

### 모바일 앱이 연결되지 않는 경우
- PC와 모바일이 같은 Wi-Fi 네트워크에 있는지 확인
- 방화벽 설정 확인
- PC 서버 IP 주소 확인

## 다음 단계

자세한 테스트 가이드는 [TEST_GUIDE.md](./TEST_GUIDE.md)를 참고하세요.

---

**작성 시간**: 2026년 1월 19일  
**수정 시간**: 2026년 1월 19일
