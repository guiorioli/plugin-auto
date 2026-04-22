#!/usr/bin/env bash
# ask.sh — send a bash command through hook.js for AI evaluation
# Usage: ./ask.sh "npm install lodash"
#        ./ask.sh rm -rf dist/
#        ./ask.sh --model=claude-haiku-4-5-20251001 "npm install"
#        ./ask.sh --dir=/path/to/project "npm test"
#        ./ask.sh --dir=/custom/project/dir "rm -rf node_modules" /another/dir

set -euo pipefail

SCRIPT_START=$(date +%s%3N)

# Parse args: separate --model=, --dir=, project_dir, and command
MODEL_ARG=""
DIR_ARG=""
PROJECT_DIR_ARG=""
COMMAND_ARGS=()
for arg in "$@"; do
  case "$arg" in
    --model=*) MODEL_ARG="$arg" ;;
    --dir=*)   DIR_ARG="${arg#--dir=}" ;;
    *)
      if [ -z "$PROJECT_DIR_ARG" ] && [ -d "$arg" ]; then
        PROJECT_DIR_ARG="$arg"
      else
        COMMAND_ARGS+=("$arg")
      fi
      ;;
  esac
done

PROJECT_DIR="${DIR_ARG:-${PROJECT_DIR_ARG:-$(cd "$(dirname "$0")" && pwd)}}"
COMMAND="${COMMAND_ARGS[*]:-}"
if [ -z "$COMMAND" ]; then
  echo "Usage: $0 [--model=<name>] [--dir=<path>] [--] <command> [project_dir]" >&2
  exit 1
fi

FORCE_MODEL="${MODEL_ARG#--model=}"
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

INPUT=$(printf '{"tool_name":"Bash","tool_input":{"command":"%s"},"project_dir":"%s"}' \
  "$(echo "$COMMAND" | sed 's/\\/\\\\/g; s/"/\\"/g')" \
  "$(echo "$PROJECT_DIR" | sed 's/\\/\\\\/g; s/"/\\"/g')")

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
