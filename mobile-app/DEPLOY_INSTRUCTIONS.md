# Vercel 배포 안내

## 현재 설정

프로젝트 ID: `prj_BGxF6jBpYCl4KyPnlUGQQYzyNmzB`
프로젝트 이름: `cursor-remote-web`

## 배포 방법

### 1. 로컬에서 빌드 후 배포

```bash
# 1. Flutter web 빌드
cd mobile-app
flutter build web --release --base-href /

# 2. Vercel 배포 (mobile-app 디렉토리에서)
vercel --prod
```

### 2. Vercel 대시보드에서 배포

1. [Vercel 대시보드](https://vercel.com/dashboard) 접속
2. `cursor-remote-web` 프로젝트 선택
3. "Deployments" 탭 클릭
4. 최신 배포 옆의 "..." 메뉴 클릭
5. "Redeploy" 선택

**주의**: 배포 전에 로컬에서 `flutter build web --release --base-href /`를 실행하여 `build/web` 디렉토리에 빌드된 파일이 있어야 합니다.

## 빌드 설정

Settings > General > Build & Development Settings:

- **Root Directory**: `mobile-app`
- **Output Directory**: `build/web`
- **Build Command**: (비워두기 - 로컬에서 빌드)
- **Install Command**: (비워두기)

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
