# Rules가 작동하지 않는 이유 분석

**작성 시간**: 2025-01-27  
**수정 시간**: 2025-01-27

## 문제 상황

`.cursor/rules/after_each_chat.mdc` 파일이 존재하지만, AI가 파일을 생성하지 않습니다.

## Rules가 작동하지 않는 주요 이유

### 1. **AI가 Rules를 무시할 수 있음**

Rules는 단지 "지시사항"일 뿐이며, AI가 이를 **반드시 따를 의무는 없습니다**. 

- `alwaysApply: true`로 설정해도, AI의 컨텍스트에 포함되더라도
- AI가 "이건 불필요하다"고 판단하면 무시할 수 있음
- 특히 파일 생성 같은 "액션"은 AI가 주저할 수 있음

### 2. **파일 생성 문법의 불확실성**

```markdown
```json: .cursor/CHAT_SUMMARY
{
  "timestamp": "...",
  "text": "...",
  "summary": "..."
}
```
```

이 문법이 Cursor IDE에서 실제로 작동하는지 **공식 문서에 명확히 나와있지 않습니다**.

- 일부 확장 기능(cursor-autopilot)에서는 작동하는 것으로 보이지만
- 공식 API가 아니므로 버전에 따라 다를 수 있음
- AI가 이 문법을 이해하지 못할 수 있음

### 3. **Rules 적용 시점의 문제**

- Rules는 **응답 생성 전**에 컨텍스트에 포함됨
- 하지만 "응답 완료 후 파일 생성"은 **응답 생성 후**에 해야 함
- AI가 응답을 완료한 후에도 Rules를 기억하고 실행해야 하는데, 이는 보장되지 않음

### 4. **컨텍스트 윈도우 제한**

- 많은 Rules나 큰 Rules 내용은 컨텍스트에서 제외될 수 있음
- `alwaysApply: true`라도 실제로는 포함되지 않을 수 있음

## 해결 방안

### 현재 구현된 방식: 문서 모니터링 (Polling)

Rules에 의존하지 않고, **채팅 문서를 직접 모니터링**하는 방식:

1. 활성 에디터 변경 감지
2. 문서 변경 이벤트 감지
3. 0.5초마다 문서 내용 폴링
4. AI 응답 패턴 감지 (Assistant:, AI:, Cursor: 등)
5. 감지된 응답을 WebSocket으로 전송

**장점**:
- Rules에 의존하지 않음
- AI의 협조가 필요 없음
- 더 확실하고 예측 가능함

**단점**:
- 폴링 방식이라 약간의 지연 가능
- 문서 구조에 의존 (패턴 매칭)

### 대안: Hooks 사용 (이미 시도했지만 실패)

`hooks.json`의 `afterAgentResponse` 이벤트를 사용하려고 했지만:
- Cursor IDE가 이 이벤트를 제대로 트리거하지 않음
- 포트 충돌 문제
- 안정성 부족

## 결론

**Rules는 "요청"일 뿐이며, AI가 이를 따를 의무는 없습니다.**

따라서:
1. ✅ **문서 모니터링 방식이 더 안정적**입니다 (현재 구현)
2. ❌ Rules에 의존하는 것은 **신뢰할 수 없습니다**
3. 🔄 Rules 파일은 생성하되, **백업 방식으로만 사용**합니다

## 개선 사항

1. ✅ `setupRulesBasedChatCapture`에서 `ensureRulesFile` 호출 추가
2. ✅ Rules 내용을 더 강제적으로 수정
3. ✅ 문서 모니터링을 주 방식으로 유지

## 테스트 방법

1. Cursor IDE 재로드
2. Extension Output 확인:
   - "✅ Created/updated rules file" 메시지 확인
   - "🔄 Starting chat document polling..." 메시지 확인
3. 채팅에서 프롬프트 전송
4. Extension Output에서 "📥 Detected AI response" 메시지 확인
5. `.cursor/CHAT_SUMMARY` 파일이 생성되는지 확인 (Rules가 작동하면)

**예상 결과**:
- 문서 모니터링 방식으로는 응답이 감지됨 ✅
- Rules 방식으로는 파일이 생성되지 않을 수 있음 ❌ (정상)
