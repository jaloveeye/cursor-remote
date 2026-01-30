# Cursor Remote Mobile App

Flutter 기반 모바일 앱으로, Cursor IDE를 원격으로 제어합니다.

## 기능

- 서버 연결 (WebSocket)
- 텍스트 입력 전송
- 명령 실행
- 메시지 로그 확인

## Web 배포 (Vercel)

Flutter Web은 **Vercel**로 배포합니다. Vercel에는 Flutter 빌드 환경이 없으므로, **로컬에서 이미 빌드한 결과물**(`build/web`)만 Vercel에 올립니다.

```bash
cd mobile-app
flutter pub get
flutter build web --release --base-href /
cp vercel-build-output.json build/web/vercel.json
cd build/web && vercel --prod
```

자세한 절차는 [DEPLOY_INSTRUCTIONS.md](DEPLOY_INSTRUCTIONS.md)를 참고하세요.

## 빌드 (모바일)

```bash
flutter pub get
flutter build apk
```

## 실행

```bash
flutter run
```

## 사용법

1. 앱 실행
2. 서버 주소 입력 (예: `192.168.0.10`)
3. Connect 버튼 클릭
4. 명령 입력 및 전송
