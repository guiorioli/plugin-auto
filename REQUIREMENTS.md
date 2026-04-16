# REQUIREMENTS — plugin-auto

## Visão Geral
Plugin para Claude Code que implementa avaliação inteligente de permissões de ferramentas. Ao invés de perguntar ao usuário antes de cada comando, o próprio sistema valida automaticamente se a operação é segura, pedindo confirmação apenas para ações potencialmente destrutivas ou importantes.

## Objetivo
Reduzir o atrito de aprovação de comandos no Claude Code sem abrir mão de segurança. Comandos de leitura e operações seguras são aprovados automaticamente; operações de escrita/estado são confirmadas; operações destrutivas são bloqueadas.

---

## Requisitos Funcionais

### RF-01 — Hook PreToolUse
O plugin deve registrar um hook do tipo `PreToolUse` no Claude Code (via `settings.json`) que intercepta todas as chamadas de ferramentas antes da execução.

### RF-02 — Classificação de Ferramentas
O hook deve classificar cada chamada de ferramenta em três categorias:
- **allow** — aprovação automática, sem prompt ao usuário
- **ask** — exibe prompt de confirmação ao usuário (inclusive em modo auto)
- **deny** — bloqueia a execução e exibe motivo ao Claude

### RF-03 — Ferramentas Sempre Permitidas (allow)
As seguintes ferramentas são sempre aprovadas automaticamente:
- `Read`, `Glob`, `Grep`, `WebSearch`, `WebFetch` — operações de leitura pura
- `Write`, `Edit`, `NotebookEdit` — escrita de arquivos (fluxo normal de desenvolvimento)

### RF-04 — Comandos Bash Seguros (allow)
Comandos Bash que correspondem a padrões de leitura/inspeção são aprovados:
- Listagem: `ls`, `dir`, `cat`, `head`, `tail`, `type`
- Navegação: `pwd`, `echo`, `date`, `whoami`, `hostname`, `uname`
- Busca: `grep`, `find`, `diff`, `sort`, `uniq`, `awk`, `jq`
- Git (leitura): `git status`, `git log`, `git diff`, `git show`, `git branch`, `git fetch`
- Package managers (leitura): `npm list`, `pip list`, `pip freeze`, `yarn info`
- Info do sistema: `ps`, `df`, `du`, `free`, `env`
- PowerShell (leitura): `Get-Content`, `Get-ChildItem`, `Get-Process`

### RF-05 — Comandos Bash Arriscados (ask)
Comandos que alteram estado do sistema devem exigir confirmação:
- Remoção de arquivos: `rm`, `rmdir`, `del`
- Elevação de privilégio: `sudo`, `su`, `runas`
- Permissões: `chmod`, `chown`, `icacls`
- Git (escrita): `git commit`, `git push`, `git reset`, `git merge`, `git rebase`, `git add`, `git pull`, `git stash pop`
- Package managers (escrita): `npm install`, `pip install`, `yarn add`, `composer install`, `cargo build`
- Rede com escrita: `curl -X POST/PUT/PATCH/DELETE`, `curl -d`, `wget --post`
- Banco de dados: `DROP TABLE`, `TRUNCATE`, `DELETE FROM`
- Processos: `kill`, `pkill`, `taskkill`
- Docker: `docker run`, `docker rm`, `docker-compose up/down`
- Redirecionamento de saída: `> arquivo` (não `>>` append, mas ambos devem ser verificados)

### RF-06 — Comandos Bash Perigosos (deny)
Comandos extremamente destrutivos são bloqueados automaticamente:
- Deleção recursiva de raiz: `rm -rf /`, `rm -rf ~`
- Formatação de disco: `format C:`, `mkfs`, `fdisk`
- DD em dispositivo físico: `dd of=/dev/sda`
- Desligamento do sistema: `shutdown`, `reboot`, `poweroff`, `halt`
- PowerShell destrutivo: `Stop-Computer`, `Restart-Computer`

### RF-07 — Ferramentas Desconhecidas (ask)
Ferramentas não mapeadas (ex: `Agent`, MCP tools desconhecidas) devem solicitar confirmação por padrão.

### RF-08 — Funcionamento em Todos os Modos
O plugin deve funcionar em todos os modos de permissão do Claude Code (`default`, `auto`, `acceptEdits`, `bypassPermissions`). Em especial, deve forçar confirmação (`ask`) mesmo em modo `auto` para operações arriscadas.

### RF-09 — Instalação Automatizada
Um script de instalação (`install.js`) deve:
1. Ler o `settings.json` global do Claude Code (`~/.claude/settings.json`)
2. Adicionar o hook `PreToolUse` apontando para `src/hook.js`
3. Preservar configurações existentes
4. Detectar se já está instalado e não duplicar

### RF-10 — Desinstalação
O script de instalação deve suportar `node install.js uninstall` para remover o hook do `settings.json`.

### RF-11 — Validação Inteligente via Claude API (ask tier)
Para comandos Bash classificados como `ask`, o hook deve consultar a Claude API antes de devolver a decisão:
- Se Claude avaliar como seguro → decisão muda para `allow` (auto-aprovado)
- Se Claude avaliar como inseguro ou API indisponível → mantém `ask` (prompt ao usuário)

### RF-12 — Validação Inteligente via Claude API (deny tier)
Para comandos Bash classificados como `deny`, o hook deve consultar a Claude API para reduzir falso-positivos:
- Se Claude avaliar como seguro → decisão muda para `allow`
- Se Claude avaliar como inseguro ou API indisponível → mantém `deny`

### RF-13 — Fallback Seguro sem API Key
Se `ANTHROPIC_API_KEY` não estiver definida, o hook deve operar sem a validação Claude (comportamento original: `ask` → prompt, `deny` → bloqueio).

### RF-14 — Resistência a Prompt Injection
O system prompt enviado à API deve instruir o modelo a ignorar comandos/instruções embutidas na string do comando avaliado.

### RF-15 — Configuração da API Key via Instalador
O `install.js` deve:
1. Solicitar a `ANTHROPIC_API_KEY` durante a instalação, com instruções de onde obtê-la
2. Persistir a chave em `settings.json` na seção `env` (para que Claude Code a injete no hook)
3. Se a chave já estiver configurada, pular o prompt

### RF-16 — Instruções de Obtenção da API Key
O instalador deve exibir: acesse `https://console.anthropic.com`, faça login, vá em **API Keys** e clique em **Create Key** (a chave começa com `sk-ant-`).

### RF-17 — Suporte a Ollama (backend local gratuito)
O hook deve suportar Ollama como alternativa à API Anthropic:
- Configurado via `OLLAMA_URL` (ex: `http://localhost:11434`) e `OLLAMA_MODEL` (ex: `mistral`)
- Prioridade: Ollama > Anthropic API > somente regras estáticas
- Instalador deve oferecer menu de seleção de backend (Anthropic / Ollama / Nenhum)

### RF-18 — Regras Estáticas Aprofundadas
Expandir as listas DENY, ASK e ALLOW com padrões críticos faltantes:
- **DENY**: pipe para shell (`curl | bash`), fork bomb, sobrescrita de arquivos críticos do sistema
- **ASK**: `wget`, `cp`, `ln`, `tar` extração, `unzip`, `git clone`, `ssh`/`scp`/`rsync`, `systemctl` state-change, `service` state-change, package managers adicionais (`apt`, `yum`, `dnf`, `brew`), PowerShell adicional
- **ALLOW**: `ping`, `traceroute`/`tracert`, `nslookup`/`dig`, checksums (`md5sum`, `sha256sum`...), `sleep`, `mkdir`, `touch`, `systemctl status/list`, listagem de archives

### RF-20 — Modo Verbose (visibilidade de todas as decisões)
Deve existir uma opção configurável (`PLUGIN_AUTO_VERBOSE=1` em `settings.json["env"]`) que, quando ativa, faz o hook incluir um reason em **toda** decisão `allow` e `ask` sem reason existente, permitindo que o usuário veja a classificação mesmo para comandos aprovados silenciosamente.

### RF-21 — Configuração do Modo Verbose no Instalador
O `install.js` deve perguntar ao usuário se deseja ativar o modo verbose e persistir a configuração.

### RF-19 — Override para Comandos Deny
Comandos classificados como `deny` NÃO devem ser silenciosamente bloqueados. Em vez disso:
- Retornar `ask` com mensagem de aviso (⛔) destacando o risco
- O default da dialog de confirmação é "Não" (usuário precisa confirmar ativamente)
- Permite override manual para falso-positivos
- Se AI avaliou como seguro → `allow` (sem prompt)

---

## Requisitos Não-Funcionais

### RNF-01 — Performance
Para comandos classificados como `allow`, o hook deve completar em menos de 100ms (lógica local). Para `ask`/`deny` com API key, o tempo adicional da chamada Claude é aceitável (até o timeout do hook de 15s).

### RNF-02 — Resiliência
Erros no hook (parse failure, exceção JS) NÃO devem bloquear a execução. Em caso de falha, o hook deve sair com código 0 sem output, deixando o comportamento padrão do Claude Code acontecer.

### RNF-03 — Compatibilidade
- Node.js v14+
- Windows 10/11 e Linux/macOS
- Claude Code qualquer versão com suporte a hooks PreToolUse

### RNF-04 — Zero Dependências
O hook principal (`src/hook.js`) não deve ter dependências npm — apenas Node.js built-in modules (`https`, `http`, etc.).
