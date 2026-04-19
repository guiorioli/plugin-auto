#!/usr/bin/env bash
# ask.sh — send a bash command through hook.js for AI evaluation
# Usage: ./ask.sh "npm install lodash"
#        ./ask.sh rm -rf dist/

set -euo pipefail

SCRIPT_START=$(date +%s%3N)

FORCE_MODEL=""
ARGS=()
for arg in "$@"; do
  case "$arg" in
    --model=*) FORCE_MODEL="${arg#--model=}" ;;
    *) ARGS+=("$arg") ;;
  esac
done

if [ ${#ARGS[@]} -eq 0 ]; then
  echo "Usage: $0 [--model=<name>] <command>" >&2
  exit 1
fi

COMMAND="${ARGS[*]}"
HOOK="$(dirname "$0")/src/hook.js"
SETTINGS="$HOME/.claude/settings.json"

if [ ! -f "$HOOK" ]; then
  echo "hook.js not found at $HOOK" >&2
  exit 1
fi

# Load env vars from ~/.claude/settings.json (same source Claude Code uses)
# Prefer jq (fast startup ~10ms) over node (~1-2s on Windows)
if [ -f "$SETTINGS" ]; then
  if command -v jq &>/dev/null; then
    eval "$(jq -r '(.env // {}) | to_entries[] | "export \(.key)=\(.value | @sh)"' "$SETTINGS" 2>/dev/null)"
  else
    eval "$(node -e "
      try {
        const s = JSON.parse(require('fs').readFileSync(process.env.HOME + '/.claude/settings.json', 'utf-8'));
        Object.entries(s.env || {}).forEach(([k,v]) => console.log('export ' + k + '=' + JSON.stringify(v)));
      } catch(e) {}
    " 2>/dev/null)"
  fi
fi

INPUT=$(printf '{"tool_name":"Bash","tool_input":{"command":"%s"}}' \
  "$(echo "$COMMAND" | sed 's/\\/\\\\/g; s/"/\\"/g')")

if [ -n "$FORCE_MODEL" ]; then
  if [ -n "${OLLAMA_URL:-}" ]; then
    export OLLAMA_MODEL="$FORCE_MODEL"
  else
    export ANTHROPIC_MODEL="$FORCE_MODEL"
  fi
fi

AI_START=$(date +%s%3N)
echo "$INPUT" | node "$HOOK" >/dev/null
AI_END=$(date +%s%3N)

SCRIPT_END=$(date +%s%3N)
AI_MS=$(( AI_END - AI_START ))
TOTAL_MS=$(( SCRIPT_END - SCRIPT_START ))

echo "" >&2
printf "AI: %dms | total: %dms\n" "$AI_MS" "$TOTAL_MS" >&2
