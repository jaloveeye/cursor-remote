# Vercel 배포 안내

## 현재 설정

프로젝트 ID: `prj_BGxF6jBpYCl4KyPnlUGQQYzyNmzB`
프로젝트 이름: `cursor-remote-web`

## 배포 방법

### 1. GitHub 푸시로 자동 배포 (권장)

GitHub에 푸시하면 Vercel이 자동으로:
1. Flutter SDK 설치
2. Flutter web 빌드
3. 배포

```bash
git add .
git commit -m "Update Flutter web app"
git push
```

### 2. Vercel 대시보드에서 수동 배포

1. [Vercel 대시보드](https://vercel.com/dashboard) 접속
2. `cursor-remote-web` 프로젝트 선택
3. "Deployments" 탭 클릭
4. 최신 배포 옆의 "..." 메뉴 클릭
5. "Redeploy" 선택

### 3. Vercel CLI로 배포

```bash
cd mobile-app
vercel --prod
```

## 빌드 설정

`vercel.json`에 자동 빌드 설정이 포함되어 있습니다:

- **Root Directory**: `mobile-app` (Vercel 대시보드에서 설정)
- **Install Command**: Flutter SDK 자동 설치
- **Build Command**: `flutter/bin/flutter pub get && flutter/bin/flutter build web --release --base-href /`
- **Output Directory**: `build/web`

## GitHub 연동 자동 배포

GitHub 저장소가 연결되어 있다면:
1. Settings > Git에서 연결 확인
2. `main` 또는 `develop` 브랜치에 푸시하면 자동 배포
3. 단, 배포 전에 GitHub Actions나 다른 CI/CD로 Flutter 빌드를 실행해야 함

## 프로젝트 구조

- `mobile-app/` - Flutter 프로젝트 루트
- `mobile-app/web/` - Flutter web 소스 파일 (index.html 등)
- `mobile-app/build/web/` - Flutter 빌드 결과물 (실제 배포 대상)
- `mobile-app/vercel.json` - Vercel 설정 파일
