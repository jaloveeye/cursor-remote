# Cursor Remote Extension 배포 가이드

VS Code Extension Marketplace에 Cursor Remote Extension을 배포하는 방법입니다.

**작성 시간**: 2025-01-27  
**수정 시간**: 2025-01-27

## 📋 사전 준비사항

### 1. Azure DevOps 계정 생성

- [Azure DevOps](https://dev.azure.com)에서 계정 생성
- Personal Access Token (PAT) 생성 필요

### 2. VS Code Marketplace Publisher 계정 생성

- [Visual Studio Marketplace](https://marketplace.visualstudio.com/manage) 접속
- Publisher 계정 생성 (예: `jaloveeye`)
- Publisher Profile 설정:

  ```
  Software Engineer based in Seoul, connecting code and user experience. 
  Passionate about creating tools that balance people, teams, and technology. 
  Open source contributor to react-grid-layout and airbnb/showkase. 
  Building developer tools to enhance productivity and remote collaboration.
  ```

### 3. 필요한 도구 설치

```bash
npm install -g @vscode/vsce
```

## 🔧 package.json 설정

### 필수 필드 추가

`cursor-extension/package.json`에 다음 필드들을 추가해야 합니다:

```json
{
  "name": "cursor-remote-extension",
  "displayName": "Cursor Remote",
  "description": "Remote control extension for Cursor IDE via WebSocket - Code anywhere, anytime with Cursor CLI",
  "version": "0.1.0",
  "publisher": "jaloveeye",
  "repository": {
    "type": "git",
    "url": "https://github.com/jaloveeye/cursor-remote.git"
  },
  "homepage": "https://github.com/jaloveeye/cursor-remote",
  "bugs": {
    "url": "https://github.com/jaloveeye/cursor-remote/issues"
  },
  "license": "MIT",
  "icon": "icon.png",
  "keywords": [
    "cursor",
    "remote",
    "mobile",
    "websocket",
    "remote-control"
  ],
  "categories": [
    "Other"
  ],
  "engines": {
    "vscode": "^1.74.0"
  }
}
```

### 주요 필드 설명

- **publisher**: Marketplace에 등록된 Publisher ID (예: `jaloveeye`)
- **repository**: GitHub 저장소 URL
- **icon**: Extension 아이콘 (128x128px PNG 권장)
- **keywords**: Marketplace 검색 키워드
- **categories**: Extension 카테고리

## 📦 VSIX 패키지 생성

### 1. 컴파일 확인

```bash
cd cursor-extension
npm install
npm run compile
```

### 2. VSIX 패키지 생성

```bash
vsce package
```

성공하면 `cursor-remote-extension-0.1.0.vsix` 파일이 생성됩니다.

### 3. 패키지 검증 (선택사항)

```bash
vsce ls
```

## 🚀 Marketplace에 배포

### 방법 1: 명령줄로 배포 (권장)

#### 1. Personal Access Token 생성

1. [Azure DevOps](https://dev.azure.com) 접속
2. User Settings → Personal Access Tokens
3. "New Token" 클릭
4. Scope: **Marketplace (Manage)** 선택
5. Token 생성 후 복사 (한 번만 표시됨!)

#### 2. 로그인

```bash
vsce login jaloveeye
```

Personal Access Token 입력

#### 3. 배포

```bash
vsce publish
```

또는 특정 버전으로:

```bash
vsce publish 0.1.0
```

### 방법 2: 웹사이트에서 업로드

1. [Visual Studio Marketplace](https://marketplace.visualstudio.com/manage) 접속
2. Publisher 선택
3. "New Extension" → "Visual Studio Code" 선택
4. VSIX 파일 업로드
5. Extension 정보 확인 및 게시

## 📝 버전 업데이트

### 버전 번호 규칙

- **Major**: 큰 기능 변경, 호환성 깨짐 (예: 1.0.0 → 2.0.0)
- **Minor**: 새 기능 추가, 하위 호환 (예: 0.1.0 → 0.2.0)
- **Patch**: 버그 수정 (예: 0.1.0 → 0.1.1)

### 버전 업데이트 방법

1. `package.json`의 `version` 필드 수정
2. CHANGELOG.md 업데이트 (선택사항)
3. 컴파일 및 패키징:

   ```bash
   npm run compile
   vsce package
   ```

4. 배포:

   ```bash
   vsce publish
   ```

## 📄 CHANGELOG.md 작성 (권장)

Extension 루트에 `CHANGELOG.md` 파일 생성:

```markdown
# Change Log

All notable changes to the "Cursor Remote" extension will be documented in this file.

## [0.1.0] - 2025-01-27

### Added
- Initial release
- WebSocket server for mobile app communication
- Text insertion command
- Cursor command execution
- AI response streaming
```

`package.json`에 추가:

```json
{
  "contributes": {
    // ...
  },
  "files": [
    "out",
    "icon.png",
    "README.md",
    "CHANGELOG.md"
  ]
}
```

## 🔍 배포 확인

1. [Visual Studio Marketplace](https://marketplace.visualstudio.com/vscode) 접속
2. "Cursor Remote" 검색
3. Extension 페이지 확인
4. 설치 테스트:

   ```bash
   code --install-extension jaloveeye.cursor-remote-extension
   ```

## ⚠️ 주의사항

### 1. 아이콘 파일

- `icon.png` 파일이 `cursor-extension/` 루트에 있어야 함
- 권장 크기: 128x128px
- PNG 형식

### 2. README.md

- Extension 루트에 `README.md` 필수
- Marketplace에서 자동으로 표시됨
- 마크다운 형식 지원

### 3. 라이선스

- `LICENSE` 파일 또는 `package.json`의 `license` 필드 필수

### 4. 파일 제외

`.vscodeignore` 파일로 배포에서 제외할 파일 지정:

```
.vscode/**
.vscode-test/**
src/**
.gitignore
tsconfig.json
.vscodeignore
```

## 🐛 문제 해결

### 오류: "Missing publisher name"

- `package.json`에 `publisher` 필드 추가

### 오류: "Missing repository field"

- `package.json`에 `repository` 필드 추가

### 오류: "Extension name not found"

- `package.json`의 `name` 필드 확인
- 형식: `publisher-name.extension-name` (예: `jaloveeye.cursor-remote-extension`)

### 오류: "Personal Access Token expired"

- Azure DevOps에서 새 토큰 생성
- `vsce login` 다시 실행

## 📚 참고 자료

- [VS Code Extension Publishing Guide](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [vsce CLI Documentation](https://github.com/microsoft/vscode-vsce)
- [Marketplace Publisher Guide](https://docs.microsoft.com/en-us/azure/devops/extend/publish/overview)

## ✅ 배포 체크리스트

- [ ] `package.json`에 `publisher` 필드 추가
- [ ] `package.json`에 `repository` 필드 추가
- [ ] `package.json`에 `icon` 필드 추가
- [ ] `icon.png` 파일 존재 확인
- [ ] `README.md` 파일 작성
- [ ] `CHANGELOG.md` 파일 작성 (선택사항)
- [ ] `.vscodeignore` 파일 설정
- [ ] Extension 컴파일 성공 확인
- [ ] VSIX 패키지 생성 성공 확인
- [ ] 로컬에서 Extension 테스트 완료
- [ ] Personal Access Token 생성
- [ ] Marketplace에 배포 완료
- [ ] Marketplace에서 Extension 확인
- [ ] 설치 및 동작 테스트 완료

---

**다음 단계**: 배포 후 사용자 피드백 수집 및 버전 업데이트 계획 수립
