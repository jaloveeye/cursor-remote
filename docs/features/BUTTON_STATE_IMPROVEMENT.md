# 버튼 상태 개선 사항

## 개요

"Send to Prompt" 버튼이 대기 중일 때 비활성화되면, 응답이 오지 않거나 문제가 생겼을 때 사용자가 아무것도 할 수 없게 됩니다. 따라서 버튼 비활성화를 제거하고, Stop 버튼을 통해 명시적으로 중단할 수 있도록 개선했습니다.

## 변경 사항

### 1. "Send to Prompt" 버튼 비활성화 제거

**이전**:
```dart
onPressed: (_isConnected && !_isWaitingForResponse) ? () { ... } : null,
```

**변경 후**:
```dart
onPressed: _isConnected ? () { ... } : null,
```

- 대기 중일 때도 버튼이 활성화되어 있어 사용자가 언제든지 새로운 프롬프트를 보낼 수 있습니다.
- 대기 중일 때는 버튼 텍스트가 "대기 중..."으로 변경되고 로딩 인디케이터가 표시됩니다.

### 2. Stop 버튼 개선

**이전**:
```dart
onPressed: _isConnected ? () { ... } : null,
```

**변경 후**:
```dart
onPressed: (_isConnected && _isWaitingForResponse) ? () {
  setState(() {
    _isWaitingForResponse = false; // Stop 버튼 클릭 시 대기 상태 해제
  });
  _sendCommand('stop_prompt');
} : null,
```

- Stop 버튼은 대기 중일 때만 활성화됩니다.
- Stop 버튼을 누르면 즉시 `_isWaitingForResponse = false`로 설정하여 대기 상태를 해제합니다.
- 서버에 `stop_prompt` 명령을 전송하여 Cursor CLI 프로세스를 중단합니다.

### 3. Enter 키 단축키 개선

**이전**:
```dart
if (event is KeyDownEvent &&
    event.logicalKey == LogicalKeyboardKey.enter &&
    !HardwareKeyboard.instance.isShiftPressed &&
    _commandFocusNode.hasFocus &&
    _isConnected &&
    !_isWaitingForResponse) { // 대기 중일 때 비활성화
```

**변경 후**:
```dart
if (event is KeyDownEvent &&
    event.logicalKey == LogicalKeyboardKey.enter &&
    !HardwareKeyboard.instance.isShiftPressed &&
    _commandFocusNode.hasFocus &&
    _isConnected) { // 대기 중일 때도 활성화
```

- 대기 중일 때도 Enter 키로 새로운 프롬프트를 보낼 수 있습니다.

### 4. 서버 응답 처리 개선

**extension.ts**:
```typescript
wsServer.send(JSON.stringify({ 
    id: commandId,
    type: 'command_result', 
    success: true,
    command_type: command.type, // 명령 타입 포함
    ...result
}));
```

- `command_result`에 `command_type`을 포함시켜, `stop_prompt` 명령의 성공 응답을 받았을 때도 대기 상태를 해제할 수 있도록 했습니다.

**main.dart**:
```dart
if (type == 'command_result') {
  if (decoded['success'] == true) {
    final commandType = decoded['command_type'] ?? '';
    if (commandType == 'stop_prompt') {
      _isWaitingForResponse = false;
    }
  }
}
```

## Cursor CLI 중단 기능

Cursor CLI는 `SIGINT` 신호를 받으면 프롬프트 작업을 중단할 수 있습니다. `cli-handler.ts`의 `stopPrompt()` 메서드가 이를 처리합니다:

```typescript
async stopPrompt(): Promise<{ success: boolean }> {
    if (this.currentProcess) {
        this.currentProcess.kill('SIGINT');
        this.currentProcess = null;
        return { success: true };
    }
    return { success: true };
}
```

## 사용자 경험

1. **대기 중에도 새로운 프롬프트 전송 가능**: 사용자가 응답을 기다리는 중에도 새로운 프롬프트를 보낼 수 있습니다.
2. **명시적 중단**: Stop 버튼을 눌러서 현재 실행 중인 CLI 프로세스를 명시적으로 중단할 수 있습니다.
3. **안전한 상태 관리**: Stop 버튼 클릭 시 즉시 대기 상태를 해제하고, 서버 응답도 확인하여 이중으로 대기 상태를 해제합니다.

## 테스트 시나리오

1. 프롬프트 전송 후 대기 중일 때:
   - "Send to Prompt" 버튼이 "대기 중..."으로 표시되지만 활성화 상태 유지
   - Stop 버튼이 활성화됨
   - Enter 키로 새로운 프롬프트 전송 가능

2. Stop 버튼 클릭:
   - 즉시 대기 상태 해제
   - 서버에 `stop_prompt` 명령 전송
   - CLI 프로세스 중단

3. 응답 수신:
   - `chat_response` 수신 시 대기 상태 해제
   - Stop 버튼 비활성화

---

**작성 시간**: 2026년 1월 21일  
**수정 시간**: 2026년 1월 21일
