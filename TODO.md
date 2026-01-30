# Cursor Remote - 앞으로 할 일

**최종 수정**: 2026-01-30 15:30

---

## ✅ 최근 완료 (참고)

- 로그 레벨별 필터 기능 추가 (Error/Warn/Info)
- iOS/macOS Pods 디렉토리 gitignore 추가
- Extension 0.3.1 준비 (버전·CHANGELOG·vsix)
- Extension 단일 구조 (PC Server 제거, 문구·상태바 반영)
- CLI 모드: debug/agent 시 `--mode` 미전달, 에러 시 stderr 전달
- 문서 정리 (PROTOCOL.md 루트, docs/ 제거, README 갱신)
- Vercel 배포: 로컬 빌드 후 배포 방식으로 정리
- 모바일: 기본 필터 AI 응답 + User Prompt, 문구 Extension 기준으로 변경

---

## 📋 우선순위별 할 일

### 🔴 우선순위 1: 배포·운영

| # | 작업 | 상태 | 비고 |
|---|------|------|------|
| 1 | **Extension 0.3.1 마켓플레이스 배포** | [x] | ✅ 완료 |
| 2 | **클라이언트 웹 재배포 (Vercel)** | [x] | ✅ 완료 |
| 3 | **릴레이 서버 운영 점검** | [x] | ✅ 완료 (2026-01-30) |

---

### 🟡 우선순위 2: 안정성·UX

| # | 작업 | 상태 | 비고 |
|---|------|------|------|
| 1 | **포트/권한 에러 처리** | [x] | ✅ 완료 - Extension에서 EADDRINUSE 시 다음 포트 자동 시도 |
| 2 | **릴레이 끊김 시 재연결** | [x] | ✅ 완료 - 모바일 앱 지수 백오프 재연결 (최대 5회), UI 표시 |
| 3 | **에러 메시지 정리** | [x] | ✅ 완료 - USER_MANUAL 문제 해결 섹션 재정리 |

---

### 🟢 우선순위 3: 기능 개선

| # | 작업 | 상태 | 비고 |
|---|------|------|------|
| 1 | **AI 응답 스트리밍 (웹/앱)** | [ ] | 릴레이에서는 최종 응답만 전송 중. 스트리밍 원하면 설계 후 적용 |
| 2 | **실시간 로그 표시** | [x] | ✅ 완료 - Extension/CLI 로그를 앱에 전송, 필터 UI 제공, 레벨별 필터(Error/Warn/Info) 추가 |
| 3 | **연결 설정 단순화** | [ ] | IP 자동 감지, 세션 ID 저장·복원 등 (이전 세션 유지 시도했으나 롤백된 상태) |

---

### 🔵 우선순위 4: Cursor 2.4 대응

| # | 작업 | 상태 | 비고 |
|---|------|------|------|
| 1 | **CLI 2.4 호환성 확인** | [ ] | `agent -p`, `--mode plan/ask`, `--resume` 등 2.4에서 정상 동작 검증 |
| 2 | **Clarification Questions 원격** | [ ] | 에이전트 질문 시 모바일에서 보낸 답변이 같은 세션으로 전달되는지 확인 |
| 3 | **Skills·2.4 문서화** | [ ] | USER_MANUAL/README에 "Cursor 2.4·Skills(SKILL.md) 원격 사용" 안내 |
| 4 | (선택) 이미지 생성 결과 안내 | [ ] | `assets/` 저장 시 모바일에서 안내 표시 여부 결정 |

#### Cursor 2.4 핵심 기능 요약

**참고**: [Cursor Changelog 2.4](https://cursor.com/changelog/2-4) (Subagents, Skills, Image Generation)

| 기능 | 설명 | Editor | CLI |
|------|------|--------|-----|
| **Subagents** | 부모 에이전트의 하위 작업을 병렬로 처리하는 전용 에이전트. 코드베이스 조사·터미널·병렬 작업용 기본 서브에이전트 포함 | ✅ | ✅ |
| **Skills** | `SKILL.md`로 정의. 커스텀 명령·스크립트·절차 지시. 슬래시 메뉴로 호출 가능 | ✅ | ✅ |
| **Image Generation** | 텍스트/참조 이미지 → 이미지 생성(기본 저장: `assets/`). UI 목업·다이어그램 등 | ✅ | (CLI 지원 여부 확인 필요) |
| **Clarification Questions** | 에이전트가 대화 중 사용자에게 질문 가능. 대기 중에도 파일 읽기·편집·명령 계속 가능 | ✅ | ✅ |
| **Cursor Blame** | Enterprise. git blame에 AI 생성 여부·대화 링크 표시 | ✅ | - |

#### Cursor Remote 관점 영향

**그대로 활용되는 부분**:
- **Subagents**: Cursor CLI가 서브에이전트를 사용하므로, Extension에서 `agent -p ...` 호출만 해도 2.4 동작이 반영됨. **추가 작업 없이** 모바일/웹에서 더 나은 응답 품질 기대 가능.
- **Skills**: 워크스페이스에 `SKILL.md`를 두면 에이전트(및 CLI)가 자동으로 발견·적용. 원격에서도 같은 워크스페이스 기준으로 동작하면 그대로 적용됨.

**검증·호환성 작업**:

| # | 작업 | 목표 | 우선순위 |
|---|------|------|----------|
| 1 | CLI 2.4 호환성 확인 | `agent -p`, `--mode plan/ask`, `--resume` 등 현재 호출 방식이 2.4 CLI에서 정상 동작하는지 확인 | 높음 |
| 2 | Clarification Questions 원격 대응 | 에이전트가 질문을 던졌을 때, 모바일에서 보낸 다음 메시지가 같은 세션으로 전달되는지 확인. 필요 시 세션/컨텍스트 유지 정리 | 높음 |
| 3 | Skills 문서화 | 원격 사용 시 `SKILL.md` 활용 방법을 USER_MANUAL 또는 README에 짧게 안내 | 중간 |

**선택 개선 (Cursor 2.4 연계)**:

| # | 작업 | 목표 | 우선순위 |
|---|------|------|----------|
| 1 | 이미지 생성 결과 안내 | 에이전트가 이미지 생성 시 `assets/`에 저장됨. 채팅 응답에 "이미지 생성됨: assets/xxx.png" 등 안내가 오는지 확인 후, 필요 시 모바일에서 표시 개선 | 낮음 |
| 2 | Cursor Remote용 Skill 예시 | 원격 작업에 유용한 플로우(예: "모바일에서 요청한 내용만 컨텍스트로 제한")를 `SKILL.md` 예시로 제공 | 낮음 |
| 3 | Subagents 설정 노출 | 사용자가 서브에이전트 on/off 또는 커스텀 설정을 쓰는 경우, CLI 인자/설정이 바뀌면 Extension 호출 방식 점검 | 낮음 |

#### 구체적 할 일

**Phase A: 호환성·동작 확인 (우선)**

1. Cursor 2.4 + Cursor CLI 설치 환경에서
   - [ ] Extension → `agent -p`, `--mode plan/ask`, `--resume` 호출로 채팅 전송
   - [ ] 모바일(또는 웹) → 릴레이 → Extension → CLI 흐름으로 한 번에 질문·추가 질문 보내기
   - [ ] Clarification Questions 발생 시, 모바일에서 답변 메시지 보냈을 때 같은 세션에 반영되는지 확인

2. 문서
   - [ ] "Cursor 2.4 사용 시" 짧은 문단 추가 (USER_MANUAL 또는 README). Skills/Subagents는 기본 동작, 원격에서도 동일하게 적용됨을 명시

**Phase B: 2.4 기능 활용 (선택)**

1. Skills
   - [ ] 프로젝트 루트 또는 `.cursor/`에 Cursor Remote용 `SKILL.md` 예시 추가 (선택)
   - [ ] USER_MANUAL에 "원격 작업 시 Skills(SKILL.md) 활용" 한 줄 안내

2. 이미지 생성
   - [ ] 에이전트 이미지 생성 시 응답/에러 메시지에 `assets/` 경로가 포함되는지 확인
   - [ ] 포함된다면 모바일 쪽에서 "이미지 생성됨" 등으로 표시할지 결정 후, 필요 시만 구현

3. Subagents
   - [ ] CLI/공식 문서에서 서브에이전트 관련 플래그나 설정이 바뀌면 Extension 쪽 `agent` 호출 인자 검토

#### 참고 링크

- [Cursor 2.4 Changelog](https://cursor.com/changelog/2-4)
- [Cursor CLI Overview](https://cursor.com/docs/cli/overview)
- [Subagents](https://cursor.com/docs/context/subagents)
- [Agent Skills (SKILL.md)](https://cursor.com/docs/context/skills)

---

### 🟣 우선순위 5: 선택 기능

| # | 작업 | 상태 | 비고 |
|---|------|------|------|
| 1 | 파일 편집 (모바일→에디터) | [ ] | 읽기/쓰기 API·권한·UI |
| 2 | 작업 결과 표시 | [ ] | AI가 수정한 파일·명령 결과 요약 |
| 3 | 권한 요청/응답 플로우 | [ ] | 파일 접근·명령 실행 전 확인 |
| 4 | 온보딩·첫 설정 가이드 | [ ] | 단계별 안내·설정 검증 |

---

## 🏗 아키텍처 요약 (현재)

- **로컬**: 앱 ↔ Extension WebSocket(8766) ↔ Cursor CLI
- **릴레이**: 앱 ↔ 릴레이 서버 ↔ Extension(RelayClient) ↔ Cursor CLI
- **PC Server**: 사용하지 않음 (역할은 Extension에 통합됨)

---

## 📝 참고

- [PROTOCOL.md](./PROTOCOL.md) - 메시지 형식
- [USER_MANUAL.md](./USER_MANUAL.md) - 설치·사용
- [cursor-extension/PUBLISHING.md](./cursor-extension/PUBLISHING.md) - Extension 배포
- [mobile-app/DEPLOY_INSTRUCTIONS.md](./mobile-app/DEPLOY_INSTRUCTIONS.md) - 웹(Vercel) 배포
