# plugin-auto

A [Claude Code](https://claude.ai/code) `PreToolUse` hook that adds intelligent permission evaluation to every tool call. Safe operations are approved automatically, risky ones are confirmed by the user, and destructive commands are blocked — without interrupting routine development work.

When an AI backend is configured (Anthropic API or a local Ollama instance), commands flagged as `ask` or `deny` are sent to an AI model for a second opinion before the final decision, reducing false positives.

## How it works

```
Bash command
    │
    ├─ DENY pattern? ──► [AI backend?] ──► unsafe / no AI → ⛔ prompt (override available)
    │                                              safe    → allow
    │
    ├─ ASK pattern?  ──► [AI backend?] ──► unsafe / no AI → prompt user
    │                                              safe    → allow
    │
    ├─ ALLOW pattern? ─► allow  (no AI call)
    │
    └─ unknown        ──► [AI backend?] ──► unsafe / no AI → prompt user
                                                   safe    → allow
```

| Decision | No AI backend | With AI backend |
|----------|--------------|-----------------|
| `allow`  | Auto-approved (no API call) | Auto-approved (no API call) |
| `ask`    | Prompts user | AI checks → safe: auto-approve / unsafe: prompt user |
| `deny`   | ⛔ Override prompt (default: deny) | AI checks → safe: auto-approve / unsafe: ⛔ override prompt |

Non-Bash tools (`Agent`, unknown MCP tools, etc.) that aren't in the always-allow list always go through the `ask` path.

## Decision tiers

### Always allowed (no classification)
`Read`, `Glob`, `Grep`, `WebSearch`, `WebFetch`, `Write`, `Edit`, `NotebookEdit`

### Bash — allow (read-only / no side effects)
`ls`, `cat`, `head`, `tail`, `grep`, `find`, `diff`, `echo`, `cd`, `pwd`, `env`,
`ping`, `traceroute`, `nslookup`, `dig`, `md5sum`, `sha256sum`, `sleep`, `mkdir`, `touch`,
`git status`, `git log`, `git diff`, `git show`, `git fetch`,
`npm list`, `pip list`, `tsc`, `eslint`,
`systemctl status/list`, `tar tf` (list), `unzip -l`,
`--version` / `--help` flags, read-only PowerShell cmdlets (`Get-*`, `Select-String`…)

### Bash — ask (state-changing)
`git commit/push/merge/reset/clone`, `npm install`, `pip install`, `brew install`, `apt install`,
`rm`, `cp`, `mv`, `ln`, `chmod`, `sudo`, `docker run`, `ssh`, `scp`, `rsync`,
`wget`, `curl -O`, `tar xvf`, `unzip`, `systemctl start/stop/restart`,
`kubectl apply/delete`, `terraform apply`, `curl -X POST/PUT/DELETE`, and more

### Bash — deny (system-destructive, override prompt shown)
`rm -rf /`, `rm -rf ~`, `curl … | bash`, `format C:`, `mkfs`, `dd of=/dev/sda`,
`shutdown`, `reboot`, `Stop-Computer`, fork bomb, overwrite of `/etc/passwd` / `/etc/shadow`…

## Prerequisites

- **Node.js ≥ 14** — no external npm dependencies required

## Installation

```bash
node install.js
```

The installer will:
1. Register the `PreToolUse` hook in `~/.claude/settings.json`
2. Let you choose an AI backend for smarter evaluations (optional)
3. Let you enable verbose mode (shows classification on every command)

**Restart Claude Code after installing to apply changes.**

## AI backends

| Backend | Setup | Cost |
|---------|-------|------|
| **Anthropic API** | Get a key at [console.anthropic.com](https://console.anthropic.com) → API Keys → Create Key | ~$0.01/month typical usage (Haiku model) |
| **Ollama** (local) | Install [Ollama](https://ollama.com), run a model locally | Free |
| **None** | No extra config needed | Free |

Priority order: `OLLAMA_URL` → `ANTHROPIC_API_KEY` → static rules only.

## Verbose mode

By default, the hook adds a visible label to every decision:

- `✓ allow — git status`
- `⚠ ask — npm install`
- `⛔ BLOCKED — shutdown now` (deny-tier override prompt)

To hide labels (quiet mode), set `PLUGIN_AUTO_QUIET=1` in `~/.claude/settings.json`:

```json
"env": {
  "PLUGIN_AUTO_QUIET": "1"
}
```

## Uninstall

```bash
node install.js uninstall
```

Environment variables (`ANTHROPIC_API_KEY`, `OLLAMA_URL`, etc.) are preserved and must be removed manually if desired.

## Tests

```bash
node test.js   # 70 cases, 0 failures
```

## Project structure

```
plugin-auto/
├── src/
│   └── hook.js       # Core evaluator — zero npm dependencies (Node.js built-ins only)
├── install.js        # Installer / uninstaller
├── test.js           # Static rule test suite
├── package.json
├── REQUIREMENTS.md   # Full PRD
├── TODO.md
└── DONE.md
```

**Stack:** Node.js ≥ 14, no external dependencies.

## How it works internally

Claude Code spawns `src/hook.js` as a subprocess before every tool call. The hook reads the event JSON from stdin and writes the decision to stdout:

```json
{ "hookSpecificOutput": { "hookEventName": "PreToolUse", "permissionDecision": "allow" } }
```

For `ask`/`deny` commands with an AI backend configured, the hook calls the AI API (timeout: 10s) and upgrades the decision to `allow` if the model confirms the command is safe.

Any internal error (network failure, parse error, timeout) leaves the original decision intact — the hook never blocks execution due to its own failures.
