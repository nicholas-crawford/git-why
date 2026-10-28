#!/bin/sh
# Install git-why for every repo on this machine:
#   - a config-based post-commit hook in your global git config
#   - `git why`, via a symlink in $BIN_DIR (default ~/.local/bin)
# Re-running it is safe.
set -eu

ROOT=$(cd "$(dirname "$0")" && pwd -P)
BIN_DIR=${BIN_DIR:-$HOME/.local/bin}

warn() { printf 'warning: %s\n' "$*" >&2; }

command -v node >/dev/null 2>&1 || warn "node not found on PATH; interviews will be queued until it is"
command -v claude >/dev/null 2>&1 || warn "claude not found on PATH; interviews will be queued until it is"
if command -v node >/dev/null 2>&1 &&
  ! node -e 'const [a,b]=process.versions.node.split(".").map(Number); process.exit(a>22||(a===22&&b>=18)?0:1)'; then
  warn "node $(node --version) is too old to run TypeScript directly; need 22.18 or later"
fi

chmod +x "$ROOT/bin/post-commit" "$ROOT/bin/git-why"

git config --global hook.git-why.command "$ROOT/bin/post-commit"
git config --global --replace-all hook.git-why.event post-commit

# Config-based hooks are a recent git feature; older versions ignore the keys
# above without complaint. Check that this git actually lists the hook.
probe=$(mktemp -d)
git init -q "$probe"
if git -C "$probe" hook list post-commit 2>/dev/null | grep -q git-why; then
  echo "hook installed: runs after every commit, alongside any repo hooks (husky etc.)"
else
  warn "$(git --version) doesn't support config-based hooks (hook.<name>.command); upgrade git"
fi
rm -rf "$probe"

mkdir -p "$BIN_DIR"
ln -sf "$ROOT/bin/git-why" "$BIN_DIR/git-why"
case ":$PATH:" in
  *":$BIN_DIR:"*) echo "git why installed: $BIN_DIR/git-why" ;;
  *) warn "$BIN_DIR is not on your PATH; add it so 'git why' works" ;;
esac

central=$(git config --global --type=path --get why.centralLog || printf '%s' "$HOME/Documents/decisions/decisions.md")
echo "central log: $central (change with: git config --global why.centralLog <path>)"
