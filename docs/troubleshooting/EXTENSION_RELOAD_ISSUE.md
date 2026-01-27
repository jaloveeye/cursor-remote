# Extension 재로드 문제 해결 가이드

**작성일**: 2026-01-27  
**문제**: Extension을 재시작하면 `--output-format json`이 사용됨 (예상: `stream-json`)

---

## 문제 증상

- 소스 코드: `stream-json` 사용
- 컴파일된 파일: `stream-json` 포함
- 실행 중인 Extension: `json` 사용 (재시작 시)

---

## 원인 분석

### 가능한 원인

1. **마켓플레이스에 설치된 Extension이 우선 로드됨**
   - Cursor IDE는 마켓플레이스 Extension을 우선적으로 로드할 수 있음
   - 개발 중인 Extension보다 설치된 Extension이 우선순위가 높을 수 있음

2. **Extension이 다른 경로에서 로드됨**
   - `.cursor/extensions` 폴더에 설치된 Extension
   - 개발 모드로 로드되지 않음

3. **캐시된 버전 사용**
   - Extension이 캐시된 이전 버전을 사용
   - 컴파일된 파일이 업데이트되지 않음

---

## 해결 방법

### 방법 1: 마켓플레이스 Extension 비활성화 (권장)

1. **Extension 목록 확인**
   - `Cmd + Shift + X` (Mac) 또는 `Ctrl + Shift + X` (Windows/Linux)
   - "Cursor Remote" 검색

2. **설치된 Extension 확인**
   - "Cursor Remote" Extension이 설치되어 있는지 확인
   - 설치되어 있다면 **비활성화** 또는 **제거**

3. **개발 중인 Extension 사용**
   - 이 프로젝트의 `cursor-extension` 폴더에서 Extension이 로드되도록 함

---

### 방법 2: Extension 개발 모드로 로드

1. **VS Code/Cursor Extension 개발 모드**
   - `F5` 키를 눌러 Extension Development Host 실행
   - 또는 `Cmd + Shift + P` → "Debug: Start Debugging"

2. **확인**
   - Extension Development Host 창이 열림
   - 그 창에서 Extension이 로드됨
   - 로그에서 `stream-json` 사용 확인

---

### 방법 3: Extension 경로 확인

1. **Extension이 로드되는 경로 확인**
   - Cursor IDE 개발자 콘솔 열기: `Help > Toggle Developer Tools`
   - Console에서 Extension 로드 경로 확인

2. **올바른 경로 확인**
   - Extension은 `cursor-extension/out/extension.js`에서 로드되어야 함
   - 다른 경로에서 로드되면 문제

---

### 방법 4: Extension 완전 재설치

1. **기존 Extension 제거**
   ```bash
   # 마켓플레이스 Extension 제거
   # Cursor IDE에서 Extension 제거
   ```

2. **개발 모드로 Extension 로드**
   - 이 프로젝트를 Extension 개발 모드로 열기
   - `F5` 키로 Extension Development Host 실행

---

## 확인 방법

### Extension이 올바르게 로드되었는지 확인

1. **로그 확인**
   - Extension Output 패널에서 다음 로그 확인:
   ```
   [CLI] Executing: /Users/herace/.local/bin/agent -p --output-format stream-json --stream-partial-output --force ...
   ```

2. **스트리밍 동작 확인**
   - 여러 개의 `CLI stdout chunk` 메시지
   - 여러 개의 `📤 Streaming chunk sent` 메시지
   - `assistant` 타입 메시지만 스트리밍됨
   - `thinking` 타입은 필터링됨

---

## 예방 방법

### 개발 중일 때

1. **마켓플레이스 Extension 비활성화**
   - 개발 중인 Extension과 충돌 방지

2. **Extension Development Host 사용**
   - `F5` 키로 개발 모드 실행
   - 변경사항이 즉시 반영됨

3. **컴파일 확인**
   - 코드 변경 후 항상 `npm run compile` 실행
   - 컴파일된 파일이 최신인지 확인

---

## 추가 정보

### Extension 로드 우선순위

Cursor IDE는 Extension을 다음 순서로 로드합니다:

1. **마켓플레이스 Extension** (최우선)
2. **개발 모드 Extension** (Extension Development Host)
3. **로컬 Extension** (프로젝트 내 Extension)

개발 중일 때는 마켓플레이스 Extension을 비활성화하는 것이 좋습니다.

---

**마지막 업데이트**: 2026-01-27
