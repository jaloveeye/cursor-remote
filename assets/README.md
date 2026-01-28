# Assets Directory

이 디렉토리는 Cursor 2.4의 Image Generation 기능으로 생성된 이미지들을 저장합니다.

## 사용 목적

- **UI 목업**: 모바일 앱 UI 디자인 목업
- **아키텍처 다이어그램**: 시스템 아키텍처 시각화
- **제품 에셋**: 프로젝트 관련 이미지 에셋

## 생성 방법

Cursor의 에이전트에서 이미지 생성 요청:
```
"Generate an architecture diagram showing the Cursor Remote system components:
- Mobile App (Flutter)
- PC Server (Node.js)
- Extension (TypeScript)
- Relay Server (Vercel)
- Cursor CLI"
```

또는 슬래시 명령 사용:
```
/image "Create a UI mockup for the mobile app's session management screen"
```

## 파일 명명 규칙

- `architecture-*.png`: 아키텍처 다이어그램
- `ui-mockup-*.png`: UI 목업
- `diagram-*.png`: 일반 다이어그램
- `asset-*.png`: 제품 에셋

## Git 관리

이미지 파일은 Git에 커밋하지 않습니다 (`.gitignore`에 추가 권장).

대신:
- 중요한 다이어그램은 문서에 참조
- README.md에 이미지 설명 추가

---

**마지막 업데이트**: 2026-01-26
