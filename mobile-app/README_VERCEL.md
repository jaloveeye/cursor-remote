# Flutter Web · Vercel 배포

Flutter Web은 **Vercel**을 통해 배포하며, **이미 빌드한 상태**(로컬에서 생성한 `build/web`)의 결과물만 업로드합니다.  
Vercel 서버에서는 Flutter 빌드를 수행하지 않습니다.

## 배포 절차 (권장)

```bash
# 1. 로컬에서 Flutter web 빌드
cd mobile-app
flutter pub get
flutter build web --release --base-href /

# 2. 빌드 결과물에 Vercel 설정 복사
cp vercel-build-output.json build/web/vercel.json

# 3. 빌드된 디렉터리에서 Vercel 배포
cd build/web
vercel --prod
```

처음 한 번은 `vercel link`로 Vercel 프로젝트를 연결할 수 있습니다.  
이미 `mobile-app/.vercel/`에 연결돼 있으면 `build/web`에서 실행해도 같은 프로젝트로 배포됩니다.

## 설정 파일

| 파일 | 용도 |
|------|------|
| `vercel.json` | 라우팅/헤더 설정 (원본, 참고용) |
| `vercel-build-output.json` | 배포 시 `build/web/vercel.json`으로 복사해 사용 |

## Git 푸시 자동 배포

Vercel 대시보드에서 Git 연동 시 **Build Command / Output Directory는 사용하지 않습니다.**  
Flutter가 Vercel 빌드 환경에 없으므로, 자동 빌드 대신 위 CLI 절차(로컬 빌드 → `vercel --prod`) 또는 GitHub Actions로 빌드 후 `vercel --prebuilt --prod` 방식으로 배포하는 것을 권장합니다.

자세한 내용은 [DEPLOY_INSTRUCTIONS.md](DEPLOY_INSTRUCTIONS.md)를 참고하세요.
