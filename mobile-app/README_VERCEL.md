# Vercel 배포 가이드

## 배포 방법

### 1. Vercel CLI 사용

```bash
# Vercel CLI 설치 (없는 경우)
npm i -g vercel

# mobile-app 디렉토리로 이동
cd mobile-app

# 배포 (프로젝트 이름: cursor-remote-web)
vercel --name cursor-remote-web

# 프로덕션 배포 (프로젝트 이름: cursor-remote-web)
vercel --name cursor-remote-web --prod

# 프로덕션 배포
vercel --prod
```

**프로젝트 이름 변경:**
- 첫 배포 시: `vercel --name <원하는-이름>`으로 이름 지정
- 기존 프로젝트 이름 변경: Vercel 대시보드 > Settings > General > Project Name에서 변경

### 2. Vercel 웹 대시보드 사용

1. [Vercel](https://vercel.com)에 로그인
2. "New Project" 클릭
3. GitHub 저장소 연결
4. **Root Directory**: `mobile-app` 설정
5. **Build Command**: `flutter pub get && flutter build web --release --base-href /`
6. **Output Directory**: `build/web`
7. **Install Command**: (비워두기 - Flutter는 자동으로 처리)
8. Deploy 클릭

### 3. 환경 변수 (필요한 경우)

Vercel 대시보드에서 환경 변수 설정:
- `RELAY_SERVER_URL`: 릴레이 서버 URL (기본값: https://relay.jaloveeye.com)

## 빌드 설정

- **Framework Preset**: Other
- **Build Command**: `flutter pub get && flutter build web --release --base-href /`
- **Output Directory**: `build/web`
- **Install Command**: (비워두기)

## 주의사항

1. Flutter SDK가 Vercel 빌드 환경에 설치되어 있어야 합니다.
2. Vercel은 기본적으로 Flutter를 지원하지 않으므로, Docker 이미지나 커스텀 빌드 환경이 필요할 수 있습니다.
3. 대안: GitHub Actions를 사용하여 빌드 후 Vercel에 배포하는 방법도 있습니다.

## 문제 해결

### Flutter SDK가 없는 경우

Vercel의 Build Settings에서:
1. "Override" 옵션 활성화
2. Environment Variables에 Flutter 경로 추가
3. 또는 Docker 이미지 사용

### 빌드 실패 시

로컬에서 먼저 테스트:
```bash
cd mobile-app
flutter pub get
flutter build web --release --base-href /
```

빌드된 파일이 `build/web` 디렉토리에 생성되는지 확인합니다.
