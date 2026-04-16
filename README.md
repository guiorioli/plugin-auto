# plugin-auto

Hook PreToolUse para Claude Code que implementa avaliação inteligente de permissões. Aprova automaticamente operações seguras, pede confirmação para ações arriscadas e bloqueia comandos destrutivos — sem precisar perguntar para cada ação rotineira.

Se a `ANTHROPIC_API_KEY` estiver configurada, comandos classificados como `ask` ou `deny` são verificados pelo Claude (Haiku) antes da decisão final, reduzindo falso-positivos.

## Arquitetura

```
plugin-auto/
├── src/
│   └── hook.js       # Avaliador principal (Node.js built-in, zero deps npm)
├── install.js        # Script de instalação/desinstalação
├── test.js           # Testes da lógica estática
├── package.json
├── REQUIREMENTS.md   # PRD completo
├── TODO.md
└── DONE.md
```

**Tecnologias:** Node.js (≥14), sem dependências externas.

**Integração:** Hook `PreToolUse` registrado no `~/.claude/settings.json` via `install.js`.

## Lógica de Classificação

```
comando Bash
    │
    ├─ DENY (regex)? ──► [API key?] ──► Claude: unsafe → deny
    │                                           safe   → allow
    │
    ├─ ASK (regex)?  ──► [API key?] ──► Claude: unsafe → ask (prompt usuário)
    │                                           safe   → allow
    │
    ├─ ALLOW (regex)? ─► allow (sem chamada API)
    │
    └─ desconhecido  ──► [API key?] ──► Claude: unsafe → ask
                                                safe   → allow
```

| Decisão | Sem API key | Com API key |
|---------|-------------|-------------|
| `allow` | Auto-aprovado | Auto-aprovado (sem chamada) |
| `ask`   | Prompt ao usuário | Claude verifica → safe: auto-aprova / unsafe: prompt |
| `deny`  | Bloqueado | Claude verifica → safe: auto-aprova / unsafe: bloqueado |

### Ferramentas sempre permitidas (allow, sem classificação Bash)
`Read`, `Glob`, `Grep`, `WebSearch`, `WebFetch`, `Write`, `Edit`, `NotebookEdit`

### Bash — allow (leitura/inspeção)
`ls`, `cat`, `head`, `tail`, `grep`, `find`, `diff`, `echo`, `cd`, `pwd`, `env`, `git status`, `git log`, `git diff`, `git show`, `npm list`, `pip list`, `tsc`, `eslint`, versões (`--version`) e cmdlets PowerShell de leitura (`Get-Content`, `Get-ChildItem`...)

### Bash — ask (altera estado)
`git commit`, `git push`, `git merge`, `git reset`, `npm install`, `pip install`, `rm`, `chmod`, `sudo`, `docker run`, `curl -X POST`, `kill`, `mv`, redirecionamento `> arquivo`...

### Bash — deny (destrutivo ao sistema)
`rm -rf /`, `rm -rf ~`, `format C:`, `mkfs`, `dd of=/dev/sda`, `shutdown`, `reboot`, `Stop-Computer`...

## Instalação

```bash
# Na pasta do projeto:
node install.js

# O instalador irá:
# 1. Registrar o hook no ~/.claude/settings.json
# 2. Solicitar sua ANTHROPIC_API_KEY (opcional)
#    → Obtida em: https://console.anthropic.com > API Keys > Create Key

# Reinicie o Claude Code para aplicar
```

## Desinstalação

```bash
node install.js uninstall
# Nota: a ANTHROPIC_API_KEY em settings.json não é removida automaticamente.
```

## Testes

```bash
node test.js
```

## Como funciona internamente

O Claude Code executa `src/hook.js` antes de cada chamada de ferramenta.
O script lê o JSON do evento via stdin e escreve a decisão no stdout:

```json
{ "hookSpecificOutput": { "hookEventName": "PreToolUse", "permissionDecision": "allow" } }
```

Para comandos `ask`/`deny` com API key configurada, o hook chama `api.anthropic.com/v1/messages`
(modelo Haiku, timeout 10s) e usa a resposta para sobrescrever a decisão se o comando for seguro.

Em caso de erro (API indisponível, timeout, parse failure), a decisão original é mantida — o hook
nunca bloqueia a execução por falha interna.
