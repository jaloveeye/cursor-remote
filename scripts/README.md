# scripts

프로젝트 보조 스크립트 모음.

## Git Flow 가드 훅

Git Flow 규칙([.cursor/rules/git_flow.mdc](../.cursor/rules/git_flow.mdc))을 **로컬에서 자동 적용**하려면:

```bash
./scripts/install-git-flow-hooks.sh
```

- **pre-commit**: `main` / `develop` 에서의 커밋 차단
- **commit-msg**: Conventional Commits 형식 검사 (`feat:`, `fix:` 등)

새로 클론한 뒤에는 위 설치를 한 번 더 실행해야 합니다.
