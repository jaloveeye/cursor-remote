# Cursor 2.4를 활용한 cursor-remote 기능 개선 계획

**작성일**: 2026-01-27  
**목적**: Cursor 2.4의 새로운 기능을 활용하여 cursor-remote 프로젝트의 기능과 생산성을 향상시키기

---

## 📋 목차

1. [개선 가능한 영역](#개선-가능한-영역)
2. [Subagents를 활용한 기능 개발](#subagents를-활용한-기능-개발)
3. [Image Generation을 활용한 UI 개선](#image-generation을-활용한-ui-개선)
4. [Clarification Questions를 활용한 UX 개선](#clarification-questions를-활용한-ux-개선)
5. [Skills를 활용한 자동화](#skills를-활용한-자동화)
6. [구체적인 개선 계획](#구체적인-개선-계획)

---

## 개선 가능한 영역

### 현재 미완성 기능 (README.md Phase 2, 3)

#### Phase 2: 고급 기능
- [ ] AI 응답 스트리밍
- [ ] 파일 편집 기능
- [ ] 작업 결과 표시
- [ ] 권한 요청 시스템

#### Phase 3: UX 개선
- [ ] 실시간 로그 표시
- [ ] 에러 처리 및 재시도
- [ ] 연결 상태 관리
- [x] 대화 히스토리 (완료)

### 알려진 문제점
- 포트 권한 문제 (EPERM)
- Extension 연결 실패
- 에러 핸들링 개선 필요
- 포트 충돌 감지 로직

### 개선 가능한 사용자 경험
- 모바일 앱 UI/UX 개선
- 연결 설정 자동화
- 에러 메시지 명확화
- 온보딩 프로세스 개선

---

## Subagents를 활용한 기능 개발

### 1. AI 응답 스트리밍 구현

**목표**: AI 응답을 실시간으로 스트리밍하여 사용자 경험 개선

**Subagents 활용**:
```
Extension Development Agent:
  - cursor-extension/src/cli-handler.ts 수정
  - 스트리밍 로직 구현
  - WebSocket으로 청크 단위 전송

Flutter App Development Agent:
  - mobile-app/lib/main.dart 수정
  - 스트리밍 UI 구현
  - 실시간 텍스트 업데이트

PC Server Development Agent:
  - pc-server/src/server.ts 수정
  - 스트리밍 메시지 라우팅
```

**예상 효과**:
- 개발 시간: 4시간 → 2시간 (50% 단축)
- 병렬 작업으로 빠른 구현

### 2. 파일 편집 기능 구현

**목표**: 모바일에서 파일을 직접 편집할 수 있는 기능

**Subagents 활용**:
```
Extension Development Agent:
  - 파일 읽기/쓰기 API 추가
  - 권한 관리 시스템 구현

Flutter App Development Agent:
  - 파일 편집 UI 구현
  - 코드 에디터 위젯 추가
  - 파일 트리 뷰 추가

PC Server Development Agent:
  - 파일 작업 메시지 라우팅
  - 에러 처리 및 검증
```

**예상 효과**:
- 개발 시간: 6시간 → 3시간 (50% 단축)
- 각 컴포넌트별 전문 에이전트 활용

### 3. 실시간 로그 표시

**목표**: Extension과 PC 서버의 로그를 모바일에서 실시간 확인

**Subagents 활용**:
```
Extension Development Agent:
  - 로그 스트리밍 API 추가
  - 로그 레벨 필터링

Flutter App Development Agent:
  - 로그 뷰어 UI 구현
  - 로그 필터링 및 검색
  - 로그 레벨별 색상 구분

PC Server Development Agent:
  - 로그 메시지 라우팅
  - 로그 버퍼링 및 전송
```

**예상 효과**:
- 디버깅 시간: 60% 단축
- 문제 해결 속도 향상

### 4. 에러 처리 및 재시도 로직 개선

**목표**: 네트워크 오류, 연결 끊김 등에 대한 자동 재시도

**Subagents 활용**:
```
Extension Development Agent:
  - 재시도 로직 구현
  - 에러 타입별 처리

Flutter App Development Agent:
  - 재연결 UI 구현
  - 에러 메시지 표시
  - 재시도 버튼 추가

PC Server Development Agent:
  - 연결 상태 모니터링
  - 자동 재연결 로직
```

**예상 효과**:
- 안정성: 80% 향상
- 사용자 경험: 크게 개선

---

## Image Generation을 활용한 UI 개선

### 1. 모바일 앱 UI 목업 생성

**목표**: 새로운 UI 디자인을 빠르게 시각화

**활용 방법**:
```
"모바일 앱의 세션 관리 화면 UI 목업을 생성해줘.
- 세션 목록 표시
- 새 세션 생성 버튼
- 세션 히스토리 보기 버튼
Material Design 스타일로"
```

**생성된 이미지**: `assets/ui-mockup-session-management.png`

**활용**:
- Flutter 개발 시 참고
- 사용자 피드백 수집
- 문서에 포함

### 2. 아키텍처 다이어그램 생성

**목표**: 시스템 아키텍처를 시각화하여 이해도 향상

**활용 방법**:
```
"Cursor Remote 시스템의 아키텍처 다이어그램을 생성해줘.
- Mobile App (Flutter)
- PC Server (Node.js)
- Extension (TypeScript)
- Relay Server (Vercel)
- Cursor CLI
각 컴포넌트 간 메시지 흐름 포함"
```

**생성된 이미지**: `assets/architecture-cursor-remote.png`

**활용**:
- README.md에 포함
- 개발자 온보딩 자료
- 프레젠테이션 자료

### 3. 프로토콜 시퀀스 다이어그램 생성

**목표**: 메시지 흐름을 시각화

**활용 방법**:
```
"로컬 모드에서 메시지 전송 시퀀스 다이어그램을 생성해줘.
1. Mobile App → PC Server (WebSocket)
2. PC Server → Extension (WebSocket)
3. Extension → Cursor CLI (Process)
4. Cursor CLI → Extension (stdout)
5. Extension → PC Server
6. PC Server → Mobile App"
```

**생성된 이미지**: `assets/diagram-message-flow.png`

**활용**:
- `docs/guides/PROTOCOL.md`에 포함
- 디버깅 시 참고
- 개발 문서화

---

## Clarification Questions를 활용한 UX 개선

### 1. 연결 설정 자동화

**목표**: 사용자가 연결할 때 불명확한 부분을 즉시 명확화

**현재 문제**:
- 사용자가 IP 주소를 모름
- 세션 ID를 어떻게 얻는지 모름
- 연결 모드를 선택하는 것이 어려움

**개선 방안**:
```
사용자: "연결하고 싶어"

→ Clarification Questions:
   "어떤 방식으로 연결하시겠습니까?
   1. 같은 Wi-Fi 네트워크 (로컬 모드)
   2. 인터넷을 통한 원격 연결 (릴레이 모드)"
   
→ 사용자 선택에 따라:
   - 로컬 모드: IP 주소 자동 감지 또는 입력 안내
   - 릴레이 모드: 새 세션 생성 또는 기존 세션 ID 입력 안내
```

**구현 방법**:
- 모바일 앱에 연결 마법사 추가
- 각 단계에서 Clarification Questions 활용
- 사용자 선택에 따라 다음 단계 안내

### 2. 에러 발생 시 명확한 안내

**목표**: 에러 발생 시 사용자가 쉽게 해결할 수 있도록 안내

**현재 문제**:
- 에러 메시지가 기술적이고 이해하기 어려움
- 해결 방법을 찾기 어려움

**개선 방안**:
```
에러 발생 시:
→ Clarification Questions:
   "어떤 문제가 발생했나요?
   1. 연결이 안 됨
   2. 메시지가 전송되지 않음
   3. 응답이 오지 않음"
   
→ 각 문제별로:
   - 구체적인 해결 방법 제시
   - 단계별 안내
   - 자동 진단 기능
```

**구현 방법**:
- 에러 타입별 질문 템플릿 정의
- 해결 방법 데이터베이스 구축
- 자동 진단 스크립트 실행

### 3. 기능 사용 가이드

**목표**: 사용자가 기능을 사용할 때 필요한 정보를 즉시 제공

**개선 방안**:
```
사용자: "세션 히스토리를 보고 싶어"

→ Clarification Questions:
   "어떤 세션의 히스토리를 보고 싶으신가요?
   1. 현재 활성 세션
   2. 특정 세션 ID
   3. 모든 세션"
   
→ 선택에 따라:
   - 해당 히스토리 조회
   - UI 업데이트
```

**구현 방법**:
- 각 기능별 질문 템플릿 정의
- 사용자 선택에 따른 동작 자동화

---

## Skills를 활용한 자동화

### 1. 개발 워크플로우 자동화

**목표**: 반복적인 개발 작업을 자동화

**예시 1: 새 기능 추가 워크플로우**
```
사용자: "세션 통계 기능을 추가해줘"

→ Skills 자동 적용:
   1. Extension에 API 엔드포인트 추가 (Skills 참조)
   2. Flutter 앱에 UI 추가 (Skills 참조)
   3. 테스트 작성 (Skills 참조)
   4. 문서 업데이트 (Skills 참조)
```

**예시 2: 버그 수정 워크플로우**
```
사용자: "세션 연결이 안 돼"

→ Skills 자동 적용:
   1. 문제 해결 가이드 참조
   2. 관련 파일 자동 식별
   3. 디버깅 로그 확인 방법 제시
   4. 수정 후 테스트 방법 안내
```

### 2. 코드 리뷰 자동화

**목표**: 코드 변경 시 자동으로 리뷰 및 개선 제안

**활용 방법**:
```
코드 변경 후:
→ Skills의 "코드 리뷰 체크리스트" 참조
→ 자동으로 다음 확인:
   - TypeScript 베스트 프랙티스 준수
   - Flutter Material Design 가이드라인 준수
   - 에러 핸들링 적절성
   - 테스트 커버리지
```

### 3. 문서 자동 업데이트

**목표**: 코드 변경 시 관련 문서 자동 업데이트

**활용 방법**:
```
API 엔드포인트 추가 시:
→ Skills의 "문서 업데이트 워크플로우" 참조
→ 자동으로:
   1. PROTOCOL.md 업데이트
   2. API 문서 생성
   3. 예제 코드 추가
```

---

## 구체적인 개선 계획

### 우선순위 1: 즉시 구현 가능 (Subagents 활용)

#### 1.1 AI 응답 스트리밍
**기간**: 2시간 (Subagents 병렬 작업)  
**담당**:
- Extension Agent: 스트리밍 로직
- Flutter Agent: UI 구현
- PC Server Agent: 메시지 라우팅

**기대 효과**:
- 사용자 경험: 대기 시간 감소
- 실시간 피드백 제공

#### 1.2 실시간 로그 표시
**기간**: 1.5시간  
**담당**:
- Extension Agent: 로그 스트리밍
- Flutter Agent: 로그 뷰어 UI
- PC Server Agent: 로그 라우팅

**기대 효과**:
- 디버깅 시간: 60% 단축
- 문제 해결 속도 향상

### 우선순위 2: 중기 개선 (Image Generation + Subagents)

#### 2.1 모바일 앱 UI 개선
**기간**: 3시간  
**단계**:
1. Image Generation으로 UI 목업 생성 (30분)
2. Subagents로 실제 구현 (2.5시간)
   - Flutter Agent: UI 구현
   - Extension Agent: 백엔드 API

**기대 효과**:
- UI/UX 개선
- 사용자 만족도 향상

#### 2.2 파일 편집 기능
**기간**: 3시간  
**단계**:
1. Image Generation으로 에디터 UI 목업 생성
2. Subagents로 구현
   - Extension Agent: 파일 API
   - Flutter Agent: 에디터 UI
   - PC Server Agent: 파일 라우팅

**기대 효과**:
- 핵심 기능 추가
- 사용자 가치 향상

### 우선순위 3: 장기 개선 (Clarification Questions + Skills)

#### 3.1 연결 마법사 구현
**기간**: 2시간  
**활용**:
- Clarification Questions로 단계별 안내
- Skills로 자동 설정

**기대 효과**:
- 온보딩 시간: 70% 단축
- 사용자 만족도 향상

#### 3.2 에러 처리 개선
**기간**: 2시간  
**활용**:
- Clarification Questions로 에러 타입별 안내
- Skills로 자동 해결 방법 제시

**기대 효과**:
- 문제 해결 시간: 50% 단축
- 사용자 경험 개선

---

## 구현 로드맵

### Week 1: 즉시 효과 (Subagents)
- [ ] AI 응답 스트리밍 구현
- [ ] 실시간 로그 표시 구현

### Week 2: UI 개선 (Image Generation + Subagents)
- [ ] UI 목업 생성
- [ ] 모바일 앱 UI 개선
- [ ] 파일 편집 기능 구현

### Week 3: UX 개선 (Clarification Questions)
- [ ] 연결 마법사 구현
- [ ] 에러 처리 개선
- [ ] 기능 사용 가이드

### Week 4: 자동화 (Skills)
- [ ] 개발 워크플로우 자동화
- [ ] 코드 리뷰 자동화
- [ ] 문서 자동 업데이트

---

## 예상 효과

### 정량적 효과

| 항목 | 현재 | 개선 후 | 향상률 |
|------|------|---------|--------|
| **기능 완성도** | 60% | 90% | 50% ↑ |
| **개발 속도** | 기준 | 2배 | 100% ↑ |
| **사용자 만족도** | 중간 | 높음 | - |
| **버그 수정 시간** | 기준 | 50% 단축 | 50% ↓ |
| **온보딩 시간** | 30분 | 10분 | 67% ↓ |

### 정성적 효과

1. **사용자 경험 개선**
   - 실시간 스트리밍으로 대기 시간 감소
   - 명확한 안내로 혼란 감소
   - 자동화로 편의성 향상

2. **개발 효율성 향상**
   - Subagents 병렬 작업으로 개발 속도 향상
   - Image Generation으로 빠른 프로토타이핑
   - Skills로 반복 작업 자동화

3. **프로젝트 품질 향상**
   - 전문 에이전트 활용으로 코드 품질 향상
   - 자동화된 테스트 및 리뷰
   - 체계적인 문서화

---

## 실행 계획

### 즉시 시작 가능한 작업

#### 1. AI 응답 스트리밍 (가장 높은 우선순위)
```
사용자: "AI 응답 스트리밍 기능을 구현해줘"

→ Subagents 활용:
   - Extension Agent: cli-handler.ts 수정
   - Flutter Agent: 스트리밍 UI 구현
   - PC Server Agent: 메시지 라우팅
   
→ 예상 시간: 2시간
→ 기대 효과: 사용자 경험 크게 개선
```

#### 2. 실시간 로그 표시
```
사용자: "Extension과 PC 서버의 로그를 모바일에서 볼 수 있게 해줘"

→ Subagents 활용:
   - Extension Agent: 로그 스트리밍 API
   - Flutter Agent: 로그 뷰어 UI
   - PC Server Agent: 로그 라우팅
   
→ 예상 시간: 1.5시간
→ 기대 효과: 디버깅 시간 60% 단축
```

#### 3. UI 목업 생성 및 개선
```
사용자: "모바일 앱의 세션 관리 화면 UI를 개선해줘"

→ Image Generation:
   - UI 목업 생성
   - 사용자 피드백 수집
   
→ Subagents:
   - Flutter Agent: 실제 UI 구현
   
→ 예상 시간: 3시간
→ 기대 효과: UI/UX 개선
```

---

## 결론

Cursor 2.4의 새로운 기능들을 활용하면 cursor-remote 프로젝트의 기능과 생산성을 크게 향상시킬 수 있습니다:

1. **Subagents**: 병렬 개발로 개발 속도 2배 향상
2. **Image Generation**: 빠른 프로토타이핑 및 문서화
3. **Clarification Questions**: 사용자 경험 개선
4. **Skills**: 반복 작업 자동화

**즉시 시작 가능한 작업**:
- AI 응답 스트리밍 (2시간)
- 실시간 로그 표시 (1.5시간)
- UI 개선 (3시간)

이 작업들을 통해 프로젝트의 완성도와 사용자 경험을 크게 개선할 수 있습니다.

---

**마지막 업데이트**: 2026-01-27  
**문서 버전**: 1.0
