#DONE

## v1.3.0 — Verbose, defaults Ollama e UX instalador (2026-04-16)

- [x] src/hook.js — modo verbose (`PLUGIN_AUTO_VERBOSE=1`): reason `✓ allow`/`⚠ ask` em todas as decisões sem reason existente
- [x] src/hook.js — default `OLLAMA_MODEL` alterado de `mistral` para `glm-5.1:cloud`
- [x] install.js — `promptVerbose()`: pergunta se ativa verbose e persiste `PLUGIN_AUTO_VERBOSE` em settings.json
- [x] install.js — prompts Ollama: `[x]` → `[enter para x]`, default modelo atualizado

## v1.2.0 — Ollama, regras aprofundadas e override deny (2026-04-16)

- [x] src/hook.js — `callOllama()` + `getAiVerdict()` dispatcher (Ollama > Anthropic > null)
- [x] src/hook.js — DENY_BASH expandido: pipe-to-shell, fork bomb, sobrescrita /etc/passwd
- [x] src/hook.js — ASK_BASH expandido: wget, cp, ln, tar x, unzip, git clone, ssh/scp/rsync, systemctl state-change, apt/yum/dnf/brew, kubectl, terraform, PowerShell adicional
- [x] src/hook.js — ALLOW_BASH expandido: ping, traceroute, nslookup/dig, checksums, sleep, mkdir, touch, systemctl status, archive listing
- [x] src/hook.js — decisão `deny` → output `ask` com ⛔ aviso (override manual, default negar)
- [x] install.js — menu backend: Anthropic / Ollama (URL + modelo) / Nenhum
- [x] test.js — suite ampliada para 70 casos (0 falhas)

## v1.1.0 — Validação inteligente via Claude API (2026-04-16)

- [x] src/hook.js — `callClaude()`: chamada à API Anthropic (Haiku, timeout 10s, anti-injection)
- [x] src/hook.js — decisão `deny` consulta Claude; se safe → `allow`
- [x] src/hook.js — decisão `ask` (Bash) consulta Claude; se safe → `allow`
- [x] install.js — prompt interativo para `ANTHROPIC_API_KEY` com instruções de obtenção
- [x] install.js — persiste API key em `settings.json["env"]`
- [x] test.js — suite de 18 testes da lógica estática (0 falhas)
- [x] README.md — diagrama de fluxo e tabela com/sem API key

## v1.0.0 — Implementação inicial (2026-04-16)

- [x] REQUIREMENTS.md — PRD completo com RF e RNF
- [x] src/hook.js — avaliador PreToolUse com classificação allow/ask/deny
- [x] src/hook.js — fix: `ask` agora emite output explícito para sobrescrever modo `auto`
- [x] src/hook.js — fix: `cd` adicionado ao ALLOW, corrigindo compostos como `cd /path && ls`
- [x] install.js — instalador/desinstalador do hook no settings.json global
- [x] package.json — configuração do projeto Node.js
- [x] README.md — arquitetura, tabela de classificação, instruções de uso
