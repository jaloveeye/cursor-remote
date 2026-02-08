#!/bin/sh
# Git Flow 가드 훅을 .git/hooks 에 설치
# 프로젝트 루트에서 실행: ./scripts/install-git-flow-hooks.sh

set -e
SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
GIT_ROOT=$(cd "$SCRIPT_DIR/.." && git rev-parse --show-toplevel 2>/dev/null) || true
HOOKS_SRC="${SCRIPT_DIR}/git-hooks"
if [ -z "$GIT_ROOT" ]; then
  echo "오류: git 저장소 루트가 아닙니다."
  exit 1
fi
HooksDir="${GIT_ROOT}/.git/hooks"

install_hook() {
  local name="$1"
  local src="${HOOKS_SRC}/${name}"
  local dst="${HooksDir}/${name}"
  if [ ! -f "$src" ]; then
    echo "오류: $src 없음"
    exit 1
  fi
  cp "$src" "$dst"
  chmod +x "$dst"
  echo "  설치됨: $name"
}

echo "Git Flow 가드 훅 설치 중..."
install_hook pre-commit
install_hook commit-msg
echo "완료. main/develop 에서의 커밋이 차단되며, Conventional Commits 형식이 검사됩니다."
