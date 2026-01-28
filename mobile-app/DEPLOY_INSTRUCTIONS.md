# Vercel 배포 안내

## 현재 설정

프로젝트 ID: `prj_BGxF6jBpYCl4KyPnlUGQQYzyNmzB`
프로젝트 이름: `cursor-remote-web`

## Vercel 대시보드에서 배포하기

1. [Vercel 대시보드](https://vercel.com/dashboard) 접속
2. `cursor-remote-web` 프로젝트 선택
3. "Deployments" 탭 클릭
4. 최신 배포 옆의 "..." 메뉴 클릭
5. "Redeploy" 선택

## 배포 전 로컬 빌드 필요

Vercel에 배포하기 전에 로컬에서 Flutter web을 빌드해야 합니다:

```bash
cd mobile-app
flutter build web --release --base-href /
```

빌드된 파일은 `build/web` 디렉토리에 생성됩니다.

## 빌드 설정 확인

Settings > General > Build & Development Settings에서 다음 설정이 되어 있는지 확인:

- **Root Directory**: `mobile-app` (또는 비워두기)
- **Install Command**: (비워두기 - 로컬에서 빌드)
- **Build Command**: `echo 'Using pre-built files'` (또는 비워두기)
- **Output Directory**: `build/web`

## 또는 GitHub 연동으로 자동 배포

1. Settings > Git
2. GitHub 저장소 연결 확인
3. `main` 또는 `develop` 브랜치에 푸시하면 자동 배포

## 네트워크 문제 해결

CLI 배포가 실패하는 경우 (네트워크 오류):
- 인터넷 연결 확인
- 방화벽/VPN 설정 확인
- Vercel 대시보드에서 직접 배포 사용
