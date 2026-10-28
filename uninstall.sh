#!/bin/sh
# Remove the global hook and the `git why` link. Leaves your logs, your why.*
# settings and any queued commits in place.
set -eu

ROOT=$(cd "$(dirname "$0")" && pwd -P)
BIN_DIR=${BIN_DIR:-$HOME/.local/bin}

git config --global --remove-section hook.git-why 2>/dev/null && echo "hook removed" || echo "hook was not installed"

if [ "$(readlink "$BIN_DIR/git-why" 2>/dev/null)" = "$ROOT/bin/git-why" ]; then
  rm "$BIN_DIR/git-why"
  echo "removed $BIN_DIR/git-why"
fi

echo "queue left in ${XDG_STATE_HOME:-$HOME/.local/state}/git-why"
