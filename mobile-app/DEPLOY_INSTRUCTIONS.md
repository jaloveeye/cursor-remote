# Vercel 배포 안내

## 왜 로컬에서 빌드해야 하나요?

**Vercel 빌드 환경에는 Flutter가 없습니다.**  
그래서 `flutter build web`은 Vercel 서버에서 실행할 수 없고, 반드시 로컬(또는 GitHub Actions)에서 빌드한 뒤 **빌드 결과물만** Vercel에 올려야 합니다.

## 배포 방법 (권장)

### 1. 로컬에서 빌드 후 Vercel CLI로 배포

```bash
# 1. Flutter web 빌드
cd mobile-app
flutter pub get
flutter build web --release --base-href /

# 2. 빌드 결과물 폴더에 Vercel 설정 복사
cp vercel-build-output.json build/web/vercel.json

# 3. 빌드된 디렉토리에서 배포
cd build/web
vercel --prod
```

처음 한 번만 `vercel link`로 프로젝트 연결이 필요할 수 있습니다. 이미 `mobile-app/.vercel/`에 연결돼 있으면 `build/web`에서 해도 같은 프로젝트로 배포됩니다.  
연결이 안 되어 있으면:

```bash
cd mobile-app/build/web
vercel link   # 프로젝트 선택: cursor-remote-web
vercel --prod
```

### 2. Vercel 대시보드 설정 (Git 푸시 자동 배포를 쓰지 않을 때)

- **Build Command**: 비워 두기 (또는 삭제)
- **Install Command**: 비워 두기
- **Output Directory**: 비워 두기

Git 푸시로 자동 배포하려면 Flutter가 없으므로 **자동 빌드는 사용하지 않고**, 위 1번처럼 로컬 빌드 후 `vercel --prod`로만 배포하는 방식을 권장합니다.

### 3. GitHub Actions로 자동 배포 (선택)

저장소에 GitHub Actions 워크플로를 두고, 푸시 시 Flutter 빌드 후 Vercel에 배포할 수 있습니다.  
이 경우 워크플로에서 Flutter 설치 → `flutter build web` → `vercel --prebuilt --prod` 순서로 실행하고, Vercel 토큰은 GitHub Secrets에 넣어 사용합니다.

## 프로젝트 구조

- `mobile-app/` - Flutter 프로젝트 루트
- `mobile-app/web/` - Flutter web 소스 (index.html 등)
- `mobile-app/build/web/` - 빌드 결과물 (**이 폴더 내용을 Vercel에 배포**)
- `mobile-app/vercel.json` - 라우팅/헤더 설정 (원본)
- `mobile-app/vercel-build-output.json` - 배포 시 `build/web/vercel.json`으로 복사해 사용
