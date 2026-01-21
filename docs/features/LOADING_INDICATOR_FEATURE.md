# 응답 대기 중 표시 기능

## 개요

모바일 앱에서 "Send to Prompt"를 실행하면 응답을 받을 때까지 "응답을 기다리는 중"이라는 표시가 나타납니다.

## 구현 사항

### 1. 상태 변수 추가

```dart
bool _isWaitingForResponse = false; // 응답 대기 중 상태
```

### 2. 프롬프트 전송 시 대기 상태 활성화

`_sendCommand` 함수에서 프롬프트 전송 시:
```dart
if (prompt == true && execute == true) {
  setState(() {
    _isWaitingForResponse = true;
  });
}
```

### 3. 응답 수신 시 대기 상태 해제

다음 이벤트에서 대기 상태를 해제:
- `chat_response` 타입 메시지 수신 시
- `command_result`에서 `success: false` 시
- `error` 타입 메시지 수신 시

### 4. UI 표시

#### AppBar에 로딩 인디케이터
- 상단 AppBar의 actions에 "응답 대기 중..." 표시
- CircularProgressIndicator와 텍스트 표시

#### 메시지 리스트에 로딩 메시지
- 메시지 리스트 맨 아래에 "응답을 기다리는 중..." 메시지 추가
- CircularProgressIndicator와 함께 표시

#### 버튼 상태 변경
- "Send to Prompt" 버튼이 대기 중일 때:
  - 비활성화 (회색)
  - "대기 중..." 텍스트와 로딩 인디케이터 표시

## 사용자 경험

1. 사용자가 "Send to Prompt" 버튼 클릭
2. 즉시 다음이 표시됨:
   - AppBar에 "응답 대기 중..." 인디케이터
   - 메시지 리스트에 "응답을 기다리는 중..." 메시지
   - 버튼이 "대기 중..."으로 변경되고 비활성화
3. 응답을 받으면:
   - 모든 로딩 인디케이터 제거
   - 버튼이 다시 활성화
   - 응답이 메시지 리스트에 표시

## 에러 처리

- 명령 전송 실패 시 대기 상태 해제
- 에러 메시지 수신 시 대기 상태 해제
- 연결 끊김 시 대기 상태 해제

---

**작성 시간**: 2026년 1월 21일  
**수정 시간**: 2026년 1월 21일
