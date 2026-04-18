#!/usr/bin/env bash
# ask.sh — send a bash command through hook.js for AI evaluation
# Usage: ./ask.sh "npm install lodash"
#        ./ask.sh rm -rf dist/

set -euo pipefail

if [ $# -eq 0 ]; then
  echo "Usage: $0 <command>" >&2
  exit 1
fi

COMMAND="$*"
HOOK="$(dirname "$0")/src/hook.js"
SETTINGS="$HOME/.claude/settings.json"

if [ ! -f "$HOOK" ]; then
  echo "hook.js not found at $HOOK" >&2
  exit 1
fi

# Load env vars from ~/.claude/settings.json (same source Claude Code uses)
if [ -f "$SETTINGS" ]; then
  eval "$(node -e "
    try {
      const s = JSON.parse(require('fs').readFileSync(process.env.HOME + '/.claude/settings.json', 'utf-8'));
      Object.entries(s.env || {}).forEach(([k,v]) => console.log('export ' + k + '=' + JSON.stringify(v)));
    } catch(e) {}
  " 2>/dev/null)"
fi

INPUT=$(printf '{"tool_name":"Bash","tool_input":{"command":"%s"}}' \
  "$(echo "$COMMAND" | sed 's/\\/\\\\/g; s/"/\\"/g')")

echo "$INPUT" | node "$HOOK"
