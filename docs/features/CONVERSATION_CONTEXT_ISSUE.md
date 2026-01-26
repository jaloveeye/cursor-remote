# 대화 컨텍스트 유지 문제 분석

## 문제 현상

클라이언트에서 연속으로 프롬프트를 보내도 이전 대화 내용을 이해하지 못하고, 대화를 이어가기 어려운 상황입니다.

## 원인 분석

### 1. 각 프롬프트가 독립적인 CLI 프로세스로 실행됨

**현재 코드 동작** (`cli-handler.ts`):

```typescript
async sendPrompt(text: string, execute: boolean = true): Promise<void> {
    // 실행 중인 프로세스가 있으면 종료
    if (this.currentProcess) {
        previousProcess.kill('SIGTERM');
        // 프로세스 완전 종료 대기
    }
    
    // 새로운 CLI 프로세스 생성
    const args = ['-p', '--output-format', 'json', '--force', text];
    this.currentProcess = child_process.spawn(cliCommand, args, {
        cwd: cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
    });
}
```

**문제점**:
- 각 프롬프트마다 새로운 `agent` 프로세스가 생성됨
- 이전 프로세스는 완전히 종료됨
- 프로세스 간 상태 공유가 없음

### 2. Cursor CLI의 비대화형 모드 (`-p`) 특성

**CLI 실행 방식**:
```bash
agent -p --output-format json --force "사용자 프롬프트"
```

**특성**:
- `-p`: 비대화형 모드 (프롬프트 모드)
- 각 호출이 독립적인 세션
- 이전 대화 내용을 기억하지 않음
- 프로세스가 종료되면 모든 컨텍스트가 사라짐

### 3. 대화 히스토리 저장/전달 메커니즘 부재

**현재 상태**:
- 이전 대화 내용을 저장하는 코드 없음
- 다음 프롬프트에 이전 대화를 포함하는 로직 없음
- Cursor CLI에 컨텍스트를 전달하는 방법 없음

## 해결 방안

### 방안 1: Extension에서 대화 히스토리 관리 (권장)

**구현 방법**:
1. **대화 히스토리 저장**
   - `.cursor/CHAT_HISTORY.json` 파일에 대화 저장
   - 사용자 메시지와 어시스턴트 응답을 쌍으로 저장
   - 최근 N개 대화만 유지 (메모리 절약)

2. **프롬프트에 히스토리 포함**
   ```typescript
   private buildPromptWithHistory(userMessage: string): string {
       const recentHistory = this.chatHistory.slice(-10); // 최근 10개
       const historyContext = recentHistory
           .map(entry => `User: ${entry.user}\nAssistant: ${entry.assistant}`)
           .join('\n---\n');
       
       return `이전 대화 내용:\n${historyContext}\n---\n\n현재 요청:\n${userMessage}`;
   }
   ```

3. **히스토리 자동 저장**
   - 사용자 메시지 전송 시 저장
   - 어시스턴트 응답 수신 시 저장

**장점**:
- 구현이 간단함
- Cursor CLI 변경 없이 동작
- 프로젝트별 독립적인 히스토리 관리

**단점**:
- 프롬프트 길이가 길어질 수 있음 (토큰 사용량 증가)
- 파일 I/O 오버헤드

### 방안 2: Cursor CLI 세션 유지

**구현 방법**:
- CLI 프로세스를 종료하지 않고 유지
- stdin을 통해 연속으로 프롬프트 전송
- 프로세스가 세션 컨텍스트를 유지하도록 함

**문제점**:
- Cursor CLI가 세션 모드를 지원하는지 불명확
- 프로세스 관리 복잡도 증가
- 에러 처리 어려움

### 방안 3: Cursor CLI의 컨텍스트 파일 사용

**가정**:
- Cursor CLI가 컨텍스트 파일을 지원한다면
- `--context` 옵션이나 히스토리 파일 전달

**현재 상태**:
- Cursor CLI 문서에서 컨텍스트 관련 옵션 확인 필요
- 지원 여부 불명확

## 권장 구현 계획

### 1단계: 대화 히스토리 저장 기능
- [ ] `ChatHistoryEntry` 인터페이스 정의
- [ ] `.cursor/CHAT_HISTORY.json` 파일 관리
- [ ] 사용자 메시지 저장
- [ ] 어시스턴트 응답 저장

### 2단계: 프롬프트에 히스토리 포함
- [ ] 최근 N개 대화 로드
- [ ] 프롬프트에 히스토리 컨텍스트 추가
- [ ] 토큰 사용량 최적화 (최근 10개만 포함)

### 3단계: 히스토리 관리 최적화
- [ ] 최대 저장 개수 제한 (50개)
- [ ] 오래된 히스토리 자동 삭제
- [ ] 프로젝트별 독립적인 히스토리

## 예상 동작

### 이전 (컨텍스트 없음)
```
사용자: "안녕하세요. 제 이름은 김형진입니다."
AI: "안녕하세요 김형진님! ..."

사용자: "제 이름이 뭐였죠?"
AI: "죄송하지만 이전 대화 내용을 기억하지 못합니다."
```

### 이후 (컨텍스트 유지)
```
사용자: "안녕하세요. 제 이름은 김형진입니다."
AI: "안녕하세요 김형진님! ..."

사용자: "제 이름이 뭐였죠?"
[Extension이 자동으로 이전 대화 포함]
→ "이전 대화 내용:
   User: 안녕하세요. 제 이름은 김형진입니다.
   Assistant: 안녕하세요 김형진님! ...
   ---
   
   현재 요청:
   제 이름이 뭐였죠?"

AI: "김형진님이시죠!"
```

## 참고

- Stash에 대화 히스토리 관리 기능의 초기 구현이 저장되어 있음
- `stash@{0}`: 대화 히스토리 관련 변경사항
