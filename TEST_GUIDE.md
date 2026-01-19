# Cursor Remote 테스트 가이드

## 테스트 환경 준비

### 1. Cursor Extension 테스트

```bash
cd cursor-extension
npm install
npm run compile
```

**확인 사항:**
- `out/` 폴더에 컴파일된 파일이 생성되었는지 확인
- `extension.js`, `websocket-server.js`, `command-handler.js` 파일 존재 확인

**Cursor IDE에서 테스트:**
1. Cursor IDE 실행
2. `Cmd+Shift+P` (Mac) 또는 `Ctrl+Shift+P` (Windows/Linux)
3. "Extensions: Install from VSIX..." 선택
4. 또는 개발 모드로 로드:
   - `Cmd+Shift+P` → "Developer: Reload Window"
   - Extension이 자동으로 활성화됨

**확인:**
- 상태 표시줄에 "Cursor Remote: Waiting" 표시 확인
- 명령 팔레트에서 "Start Cursor Remote Server" 실행
- 상태 표시줄이 "Cursor Remote: Waiting"으로 변경되는지 확인

### 2. PC 서버 테스트

```bash
cd pc-server
npm install
npm run build
npm start
```

**예상 출력:**
```
Attempting to connect to extension at ws://localhost:8766...
✅ Cursor Remote PC Server started!
📱 Mobile app should connect to: 192.168.x.x:8766
🔌 WebSocket server: ws://192.168.x.x:8766
🌐 HTTP server: http://192.168.x.x:8765
🔗 Extension WebSocket: ws://localhost:8766
```

**확인 사항:**
- 서버가 정상적으로 시작되는지 확인
- Extension 연결 시도 메시지 확인
- Extension이 실행 중이면 "✅ Connected to Cursor Extension" 메시지 확인

**포트 확인:**
```bash
# macOS/Linux
lsof -i :8766
lsof -i :8765

# Windows
netstat -ano | findstr :8766
netstat -ano | findstr :8765
```

### 3. 모바일 앱 테스트

#### Flutter 개발 환경 확인

```bash
cd mobile-app
flutter doctor
flutter pub get
```

#### Android 에뮬레이터/디바이스

```bash
flutter devices
flutter run
```

#### iOS 시뮬레이터 (macOS만)

```bash
open -a Simulator
flutter run
```

**테스트 시나리오:**

1. **연결 테스트**
   - 앱 실행
   - PC 서버 IP 주소 입력 (예: `192.168.0.10`)
   - "Connect" 버튼 클릭
   - 연결 성공 메시지 확인

2. **텍스트 삽입 테스트**
   - Cursor IDE에서 파일 열기
   - 모바일 앱에서 텍스트 입력
   - "Send Text" 버튼 클릭
   - Cursor IDE 에디터에 텍스트가 삽입되는지 확인

3. **파일 저장 테스트**
   - "Save File" 버튼 클릭
   - Cursor IDE에서 파일이 저장되는지 확인

4. **명령 실행 테스트**
   - "Save (Cmd)" 버튼 클릭
   - Cursor IDE에서 파일 저장 명령이 실행되는지 확인

## 통합 테스트

### 전체 플로우 테스트

1. **Extension 시작**
   - Cursor IDE 실행
   - Extension 자동 활성화 확인
   - 상태 표시줄 확인

2. **PC 서버 시작**
   ```bash
   cd pc-server
   npm start
   ```
   - Extension 연결 확인
   - 서버 IP 주소 확인

3. **모바일 앱 연결**
   - 모바일 앱 실행
   - PC 서버 IP 입력
   - 연결 성공 확인

4. **명령 전송 테스트**
   - 모바일에서 텍스트 입력
   - Cursor IDE에서 결과 확인

## 문제 해결

### Extension이 시작되지 않는 경우

- Cursor IDE 재시작
- Extension 컴파일 확인: `npm run compile`
- Cursor IDE 개발자 콘솔 확인: `Help > Toggle Developer Tools`

### PC 서버가 Extension에 연결되지 않는 경우

- Extension이 실행 중인지 확인
- 포트 8766이 사용 중인지 확인
- Extension 로그 확인

### 모바일 앱이 연결되지 않는 경우

- PC와 모바일이 같은 네트워크에 있는지 확인
- 방화벽 설정 확인
- PC 서버 IP 주소가 올바른지 확인

### 명령이 실행되지 않는 경우

- Extension 로그 확인
- PC 서버 로그 확인
- 모바일 앱 메시지 로그 확인

## 로그 확인

### Extension 로그
- Cursor IDE: `Help > Toggle Developer Tools > Console`

### PC 서버 로그
- 터미널 출력 확인

### 모바일 앱 로그
- Flutter: `flutter run` 출력 확인
- 또는 Android Studio / Xcode 로그 확인

---

**작성 시간**: 2026년 1월 19일  
**수정 시간**: 2026년 1월 19일
