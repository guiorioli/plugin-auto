#TO DO

## Em andamento

## Backlog

### v1.3.0 — Modo verbose, defaults Ollama e UX do instalador

- [x] **hook-9**    `src/hook.js` — modo verbose: se `PLUGIN_AUTO_VERBOSE=1`, adicionar reason em decisões `allow`/`ask` sem reason existente
- [x] **hook-10**   `src/hook.js` — alterar default `OLLAMA_MODEL` de `mistral` para `glm-5.1:cloud`
- [x] **install-6** `install.js` — adicionar pergunta de verbose ao final da instalação
- [x] **install-7** `install.js` — ajustar prompts com defaults: `[mistral]` → `[enter para glm-5.1:cloud]`, `[http://...]` → `[enter para http://...]`

### v1.2.0 — Ollama, regras aprofundadas e override deny

- [x] **hook-4** `src/hook.js` — `callOllama()` via `http` nativo + `getAiVerdict()` dispatcher (Ollama > Anthropic > null)
- [x] **hook-5** `src/hook.js` — expandir DENY_BASH: pipe-to-shell, fork bomb, sobrescrita /etc/passwd etc.
- [x] **hook-6** `src/hook.js` — expandir ASK_BASH: wget, cp, ln, tar x, unzip, git clone, ssh/scp/rsync, systemctl, service, apt/yum/dnf/brew
- [x] **hook-7** `src/hook.js` — expandir ALLOW_BASH: ping, traceroute, nslookup/dig, checksums, sleep, mkdir, touch, systemctl status, archive listing
- [x] **hook-8** `src/hook.js` — decisão `deny` → output `ask` com ⛔ aviso (override manual disponível, default negar)
- [x] **install-4** `install.js` — menu de seleção de backend: Anthropic / Ollama / Nenhum
- [x] **install-5** `install.js` — prompt Ollama: URL (default localhost:11434) e modelo (default mistral), salvar em settings.json env
- [x] **test-1** `test.js` — adicionar testes para novos padrões e comportamento deny-override

### v1.1.0 — Validação Inteligente via Claude API

- [x] **hook-1** `src/hook.js` — adicionar `callClaude(apiKey, command, tier)` usando `https` nativo (modelo Haiku, timeout 10s, system prompt anti-injection)
- [x] **hook-2** `src/hook.js` — integrar `callClaude` na decisão `deny`: se Claude → safe, retornar `allow`; se unsafe/erro → manter `deny`
- [x] **hook-3** `src/hook.js` — integrar `callClaude` na decisão `ask` (somente Bash): se Claude → safe, retornar `allow`; se unsafe/erro → manter `ask`
- [x] **install-1** `install.js` — exibir instruções de onde obter a `ANTHROPIC_API_KEY` (console.anthropic.com)
- [x] **install-2** `install.js` — solicitar a chave interativamente via stdin (pular se já configurada em settings.json)
- [x] **install-3** `install.js` — persistir a chave em `settings.json["env"]["ANTHROPIC_API_KEY"]`
- [x] **docs-1** `README.md` — documentar a nova funcionalidade de validação inteligente
