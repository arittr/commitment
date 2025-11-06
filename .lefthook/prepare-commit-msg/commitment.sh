#!/bin/sh
# Commitment hook for prepare-commit-msg
# Arguments: $1 = commit message file, $2 = commit source (empty for regular commits)

# Only run for regular commits (no commit source means git commit without -m)
if [ -z "$2" ]; then
  ./dist/cli.js --message-only > "$1"
fi
