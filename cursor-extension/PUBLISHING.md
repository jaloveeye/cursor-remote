# Cursor Extension 배포 가이드

이 문서는 Cursor Extension을 마켓플레이스에 배포하기 위한 단계별 가이드를 제공합니다.

## 📋 사전 준비사항

### 1. 필수 파일 확인

다음 파일들이 준비되어 있는지 확인하세요:

- ✅ `package.json` - Extension 메타데이터
- ✅ `README.md` - Extension 설명서
- ✅ `CHANGELOG.md` - 버전 변경 이력
- ✅ `LICENSE` - 라이선스 파일
- ✅ `.vscodeignore` - 패키징 시 제외할 파일 목록
- ⚠️ `icon.png` - 아이콘 파일 (128x128 또는 256x256px, 선택사항이지만 권장)

### 2. package.json 필수 필드 확인

다음 필드들이 올바르게 설정되어 있는지 확인:

```json
{
  "name": "cursor-remote",           // Extension ID (소문자, 하이픈만 사용)
  "displayName": "Cursor Remote",    // 표시 이름
  "version": "0.1.0",                // 버전 (Semantic Versioning)
  "publisher": "jaloveeye",          // Publisher ID (소문자)
  "description": "...",               // Extension 설명
  "engines": {
    "vscode": "^1.74.0"              // 최소 VSCode 버전
  }
}
```

**현재 상태**: ✅ 모든 필수 필드가 설정되어 있습니다.

---

## 🔐 Step 1: Publisher 계정 생성

### 1.1 Azure DevOps 계정 생성

1. [Azure DevOps](https://dev.azure.com)에 접속
2. Microsoft 계정으로 로그인 (또는 새로 생성)
3. 조직(Organization) 생성
   - 조직 이름: `jaloveeye` (또는 원하는 이름)
   - 지역 선택

### 1.2 Publisher 생성

1. [Visual Studio Marketplace](https://marketplace.visualstudio.com/manage) 접속
2. "Create Publisher" 클릭
3. Publisher 정보 입력:
   - **Publisher ID**: `jaloveeye` (package.json의 publisher와 일치해야 함)
   - **Publisher Name**: `김형진` 또는 `jaloveeye`
   - **Support URL**: `https://github.com/jaloveeye/cursor-remote/issues`
   - **Logo**: 128x128px PNG 이미지 (선택사항)

**⚠️ 중요**: Publisher ID는 한 번 생성하면 변경할 수 없습니다. package.json의 `publisher` 필드와 정확히 일치해야 합니다.

---

## 🔑 Step 2: Personal Access Token (PAT) 생성

### 2.1 PAT 생성

1. [Azure DevOps](https://dev.azure.com) 접속
2. 우측 상단 프로필 아이콘 클릭 → **Security** 선택
3. **Personal access tokens** 클릭
4. **+ New Token** 클릭
5. 토큰 설정:
   - **Name**: `VSCode Extension Publishing`
   - **Organization**: 생성한 조직 선택
   - **Expiration**: 원하는 만료일 설정 (최대 1년)
   - **Scopes**: `Custom defined` 선택
     - **Marketplace**: `Manage` 권한 선택
6. **Create** 클릭
7. **⚠️ 중요**: 생성된 토큰을 복사하여 안전한 곳에 보관 (다시 볼 수 없음)

### 2.2 PAT 저장 (선택사항)

로컬에 저장하려면:

```bash
# macOS/Linux
echo 'YOUR_PAT_TOKEN' > ~/.vscode-publisher-token

# 또는 환경 변수로 설정
export VSCE_PAT=YOUR_PAT_TOKEN
```

---

## 🎨 Step 3: 아이콘 준비 (선택사항)

### 3.1 icon.png 생성

현재 `icon.svg` 파일이 있으므로 PNG로 변환:

**방법 1: 온라인 도구 사용**
- [CloudConvert](https://cloudconvert.com/svg-to-png)
- [Convertio](https://convertio.co/kr/svg-png/)

**방법 2: ImageMagick 사용**
```bash
# ImageMagick 설치 (macOS)
brew install imagemagick

# SVG를 PNG로 변환
convert images/icon.svg -resize 256x256 images/icon.png
```

**방법 3: Figma 사용**
- Figma에서 SVG 열기
- Export → PNG → 256x256 선택

### 3.2 아이콘 요구사항

- **크기**: 128x128px (최소) 또는 256x256px (권장)
- **형식**: PNG
- **배경**: 투명 배경 권장
- **위치**: `cursor-extension/` 루트 또는 `images/icon.png`

---

## 📦 Step 4: 빌드 및 패키징

### 4.1 의존성 설치

```bash
cd cursor-extension
npm install
```

### 4.2 TypeScript 컴파일

```bash
npm run compile
```

### 4.3 패키지 생성 (테스트)

```bash
npm run package
```

이 명령어는 `.vsix` 파일을 생성합니다. 파일이 생성되면 성공입니다.

**예상 출력**:
```
DONE  Packaged: cursor-remote-0.1.0.vsix (XX KB)
```

### 4.4 패키지 검증 (선택사항)

생성된 `.vsix` 파일을 로컬에서 테스트:

1. Cursor IDE에서 `확장` → `...` → `VSIX에서 설치...` 선택
2. 생성된 `.vsix` 파일 선택
3. Extension이 정상적으로 작동하는지 확인

---

## 🚀 Step 5: 마켓플레이스에 배포

### 5.1 배포 명령어

```bash
# PAT를 환경 변수로 설정한 경우
export VSCE_PAT=YOUR_PAT_TOKEN
npm run publish

# 또는 직접 입력
vsce publish
# PAT 입력 프롬프트가 나타나면 토큰 입력
```

### 5.2 배포 프로세스

1. `vsce publish` 실행
2. PAT 입력 (또는 환경 변수에서 자동 사용)
3. 버전 확인 (이미 배포된 버전이면 오류 발생)
4. 패키징 및 업로드
5. 마켓플레이스에서 검토 대기 (보통 몇 분 소요)

### 5.3 배포 확인

1. [Visual Studio Marketplace](https://marketplace.visualstudio.com/vscode) 접속
2. "Cursor Remote" 검색
3. Extension 페이지 확인

---

## 🔄 Step 6: 버전 업데이트

새 버전을 배포할 때:

### 6.1 버전 업데이트

`package.json`에서 버전 번호 수정:

```json
{
  "version": "0.1.1"  // 패치 버전 증가
  // 또는
  "version": "0.2.0"  // 마이너 버전 증가
  // 또는
  "version": "1.0.0"  // 메이저 버전 증가
}
```

### 6.2 CHANGELOG.md 업데이트

```markdown
## [0.1.1] - 2026-01-21

### Fixed
- 버그 수정 내용

### Added
- 새 기능 추가 내용
```

### 6.3 재배포

```bash
npm run compile
npm run publish
```

---

## ⚠️ 주의사항

### 버전 관리

- **Semantic Versioning** 준수: `MAJOR.MINOR.PATCH`
- 이미 배포된 버전은 다시 배포할 수 없음
- 버전은 항상 증가해야 함

### 패키지 크기

- 최대 크기: 100MB
- 현재 예상 크기: ~50KB (매우 작음)

### 검토 프로세스

- 첫 배포: 수동 검토 필요 (보통 몇 시간~하루 소요)
- 업데이트: 자동 검토 (보통 몇 분 소요)

---

## 🐛 문제 해결

### "Publisher not found" 오류

- Publisher ID가 package.json의 `publisher`와 일치하는지 확인
- [Marketplace Publisher 페이지](https://marketplace.visualstudio.com/manage)에서 Publisher 생성 확인

### "Invalid Personal Access Token" 오류

- PAT가 만료되지 않았는지 확인
- PAT에 Marketplace `Manage` 권한이 있는지 확인
- PAT를 다시 생성

### "Version already exists" 오류

- package.json의 버전을 증가시킴
- CHANGELOG.md 업데이트

### 패키징 오류

```bash
# 빌드 파일 확인
ls -la out/

# TypeScript 컴파일 오류 확인
npm run compile

# .vscodeignore 확인
cat .vscodeignore
```

---

## 📚 참고 자료

- [VSCode Extension Publishing Guide](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [vsce Documentation](https://github.com/microsoft/vscode-vsce)
- [Semantic Versioning](https://semver.org/)

---

## ✅ 체크리스트

배포 전 확인사항:

- [ ] Publisher 계정 생성 완료
- [ ] PAT 생성 및 저장 완료
- [ ] package.json의 publisher ID 확인
- [ ] 버전 번호 확인 (Semantic Versioning)
- [ ] README.md 완성
- [ ] CHANGELOG.md 업데이트
- [ ] LICENSE 파일 확인
- [ ] TypeScript 컴파일 성공
- [ ] 로컬 패키지 테스트 완료
- [ ] icon.png 준비 (선택사항)

---

**작성 시간**: 2026년 1월 21일  
**최종 수정**: 2026년 1월 21일
