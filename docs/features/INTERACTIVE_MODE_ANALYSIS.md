# Cursor CLI 대화형 모드 분석

## 현재 상태

### 현재 사용 중인 모드
```typescript
// cli-handler.ts
const args = ['-p', '--output-format', 'json', '--force', text];
this.currentProcess = child_process.spawn(cliCommand, args, {
    stdio: ['ignore', 'pipe', 'pipe'], // stdin은 무시
});
```

- `-p`: 비대화형 모드 (프롬프트 모드)
- 각 호출마다 새로운 프로세스 생성 및 종료
- stdin을 무시 (`'ignore'`)

## 대화형 모드 옵션

### 1. `-p` 옵션 제거 (기본 대화형 모드)

**명령어**:
```bash
agent "프롬프트 텍스트"
```

**특성**:
- 대화형 모드로 실행
- 사용자 입력을 기다릴 수 있음
- JSON 출력 형식이 제대로 작동하지 않을 수 있음
- 프로세스가 종료되지 않고 계속 실행될 수 있음

**문제점**:
- 자동화에 적합하지 않음
- JSON 파싱이 어려울 수 있음
- 프로세스 관리가 복잡해짐

### 2. 프로세스 유지 + stdin을 통한 연속 프롬프트

**구현 방법**:
```typescript
// 프로세스를 한 번만 생성하고 유지
if (!this.currentProcess) {
    this.currentProcess = child_process.spawn(cliCommand, ['-p', '--output-format', 'json'], {
        stdio: ['pipe', 'pipe', 'pipe'], // stdin 활성화
    });
}

// stdin을 통해 프롬프트 전송
this.currentProcess.stdin.write(text + '\n');
```

**장점**:
- 프로세스가 세션 컨텍스트를 유지할 수 있음
- 이전 대화 내용을 기억할 수 있음

**문제점**:
- Cursor CLI가 stdin을 통한 연속 프롬프트를 지원하는지 불명확
- 프로세스가 종료되지 않아 리소스 관리 어려움
- 에러 처리 복잡도 증가
- JSON 출력 형식이 각 프롬프트마다 제대로 작동하는지 불명확

### 3. 대화형 모드 + JSON 출력 조합

**명령어**:
```bash
agent --output-format json "프롬프트 텍스트"
```

**특성**:
- `-p` 없이 실행하면 대화형 모드
- JSON 출력 형식 지정 가능
- 프로세스가 종료될 때까지 대기

**문제점**:
- 사용자 입력을 기다릴 수 있음
- 자동화에 적합하지 않을 수 있음

## 권장 방안

### 방안 1: 대화형 모드 테스트 (권장)

먼저 대화형 모드가 실제로 세션을 유지하는지 테스트:

```typescript
// 테스트: -p 옵션 제거
const args = ['--output-format', 'json', '--force', text];
```

**확인 사항**:
1. 프로세스가 자동으로 종료되는가?
2. JSON 출력이 제대로 작동하는가?
3. 여러 프롬프트를 보낼 때 세션이 유지되는가?

### 방안 2: 프로세스 유지 + stdin (고급)

프로세스를 유지하고 stdin을 통해 연속 프롬프트 전송:

```typescript
class CLIHandler {
    private persistentProcess: child_process.ChildProcess | null = null;
    
    async initializePersistentProcess() {
        if (!this.persistentProcess) {
            this.persistentProcess = child_process.spawn(cliCommand, [
                '--output-format', 'json'
            ], {
                stdio: ['pipe', 'pipe', 'pipe'],
            });
            
            // stdout/stderr 처리
            this.setupProcessHandlers();
        }
    }
    
    async sendPrompt(text: string) {
        await this.initializePersistentProcess();
        if (this.persistentProcess?.stdin) {
            this.persistentProcess.stdin.write(text + '\n');
        }
    }
}
```

**주의사항**:
- Cursor CLI가 stdin을 통한 연속 입력을 지원하는지 확인 필요
- 프로세스가 종료되지 않을 경우 리소스 관리 필요
- 에러 발생 시 프로세스 재시작 로직 필요

### 방안 3: 대화 히스토리 관리 (현재 권장)

대화형 모드가 작동하지 않을 경우를 대비하여 대화 히스토리 관리:

- Extension에서 히스토리 저장
- 다음 프롬프트에 이전 대화 포함
- 안정적이고 예측 가능한 동작

## 테스트 계획

### 1단계: 대화형 모드 테스트
```bash
# 터미널에서 직접 테스트
agent --output-format json "첫 번째 프롬프트"
agent --output-format json "두 번째 프롬프트"
```

### 2단계: stdin 테스트
```bash
# stdin을 통한 연속 입력 테스트
echo "첫 번째" | agent --output-format json
echo "두 번째" | agent --output-format json
```

### 3단계: 프로세스 유지 테스트
- 프로세스를 유지하고 stdin으로 여러 프롬프트 전송
- 세션 컨텍스트가 유지되는지 확인

## 결론

**대화형 모드 사용 가능 여부**: 
- 기술적으로는 가능하지만, Cursor CLI의 실제 동작을 확인해야 함
- `-p` 옵션 제거 시 대화형 모드가 되지만, 자동화에 적합한지 불명확

**권장 접근**:
1. 먼저 대화형 모드 테스트
2. 작동하지 않으면 대화 히스토리 관리 방식 사용
3. 두 방식을 조합하여 최적의 해결책 찾기
