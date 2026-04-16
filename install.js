#!/usr/bin/env node
'use strict';

/**
 * plugin-auto — Instalador / Desinstalador
 *
 * Uso:
 *   node install.js           → instala o hook e configura backend de IA
 *   node install.js uninstall → remove o hook do settings.json
 */

const fs       = require('fs');
const path     = require('path');
const os       = require('os');
const readline = require('readline');

const HOOK_SCRIPT   = path.resolve(__dirname, 'src', 'hook.js').replace(/\\/g, '/');
const SETTINGS_PATH = path.join(os.homedir(), '.claude', 'settings.json');
const HOOK_COMMAND  = `node "${HOOK_SCRIPT}"`;
const HOOK_MARKER   = 'plugin-auto';

// ─── Settings ─────────────────────────────────────────────────────────────────

function readSettings() {
  try {
    if (fs.existsSync(SETTINGS_PATH))
      return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8'));
  } catch {
    console.warn('Não foi possível ler settings.json, criando do zero.');
  }
  return {};
}

function writeSettings(settings) {
  const dir = path.dirname(SETTINGS_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2) + '\n', 'utf-8');
}

// ─── Prompts ──────────────────────────────────────────────────────────────────

function ask(rl, question) {
  return new Promise((resolve) => rl.question(question, (a) => resolve(a.trim())));
}

async function promptBackend(rl, settings) {
  const hasAnthropicKey = !!settings?.env?.ANTHROPIC_API_KEY;
  const hasOllamaUrl    = !!settings?.env?.OLLAMA_URL;

  const currentBackend = hasOllamaUrl ? 'Ollama' : hasAnthropicKey ? 'Anthropic API' : 'Nenhum';

  console.log('\n  ┌─ BACKEND DE IA (validação inteligente de comandos) ────────────────┐');
  console.log('  │                                                                     │');
  console.log('  │  Comandos classificados como ask/deny são enviados à IA antes de    │');
  console.log('  │  bloquear ou pedir confirmação — reduz falso-positivos.             │');
  console.log('  │                                                                     │');
  console.log('  │  (1) Anthropic API  — cloud, ~$0.01/mês para uso típico            │');
  console.log('  │      Chave em: https://console.anthropic.com > API Keys            │');
  console.log('  │                                                                     │');
  console.log('  │  (2) Ollama         — local, gratuito, requer Ollama instalado      │');
  console.log('  │      Download em: https://ollama.com                               │');
  console.log('  │                                                                     │');
  console.log('  │  (3) Nenhum         — apenas regras estáticas (sem chamadas de IA) │');
  console.log('  │                                                                     │');
  console.log(`  │  Configuração atual: ${currentBackend.padEnd(43)}│`);
  console.log('  └─────────────────────────────────────────────────────────────────────┘\n');

  const choice = await ask(rl, '  Escolha o backend [1/2/3]: ');

  if (choice === '1') {
    if (hasAnthropicKey) {
      const key = settings.env.ANTHROPIC_API_KEY;
      console.log(`\n  ANTHROPIC_API_KEY já configurada (${key.substring(0, 12)}...).`);
      const replace = await ask(rl, '  Substituir? [s/N]: ');
      if (replace.toLowerCase() !== 's') return;
    }
    const key = await ask(rl, '\n  Cole a ANTHROPIC_API_KEY e pressione Enter: ');
    if (key) {
      if (!settings.env) settings.env = {};
      delete settings.env.OLLAMA_URL;
      delete settings.env.OLLAMA_MODEL;
      settings.env.ANTHROPIC_API_KEY = key;
      console.log('  Chave salva.');
    } else {
      console.log('  Entrada vazia — backend não alterado.');
    }

  } else if (choice === '2') {
    if (hasOllamaUrl) {
      console.log(`\n  Ollama já configurado: ${settings.env.OLLAMA_URL} (modelo: ${settings.env.OLLAMA_MODEL || 'glm-5.1:cloud'}).`);
      const replace = await ask(rl, '  Reconfigurar? [s/N]: ');
      if (replace.toLowerCase() !== 's') return;
    }
    const url   = await ask(rl, '\n  URL do Ollama [enter para http://localhost:11434]: ');
    const model = await ask(rl, '  Modelo Ollama [enter para glm-5.1:cloud]: ');
    if (!settings.env) settings.env = {};
    delete settings.env.ANTHROPIC_API_KEY;
    settings.env.OLLAMA_URL   = url   || 'http://localhost:11434';
    settings.env.OLLAMA_MODEL = model || 'glm-5.1:cloud';
    console.log(`  Ollama configurado: ${settings.env.OLLAMA_URL} (${settings.env.OLLAMA_MODEL}).`);

  } else if (choice === '3') {
    if (!settings.env) settings.env = {};
    delete settings.env.ANTHROPIC_API_KEY;
    delete settings.env.OLLAMA_URL;
    delete settings.env.OLLAMA_MODEL;
    console.log('  Backend removido — apenas regras estáticas.');

  } else {
    console.log('  Opção inválida — backend não alterado.');
  }
}

async function promptVerbose(rl, settings) {
  const current = !!settings?.env?.PLUGIN_AUTO_VERBOSE;
  const label   = current ? 'ativado' : 'desativado';

  console.log(`\n  Modo verbose — exibir classificação (✓ allow / ⚠ ask) em todos os comandos.`);
  console.log(`  Configuração atual: ${label}`);

  const answer = await ask(rl, `  Ativar modo verbose? [s/N]: `);
  if (!settings.env) settings.env = {};

  if (answer.toLowerCase() === 's') {
    settings.env.PLUGIN_AUTO_VERBOSE = '1';
    console.log('  Modo verbose ativado.');
  } else if (answer !== '') {
    delete settings.env.PLUGIN_AUTO_VERBOSE;
    console.log('  Modo verbose desativado.');
  } else {
    console.log(`  Mantendo: ${label}.`);
  }
}

// ─── Install / Uninstall ──────────────────────────────────────────────────────

async function install() {
  console.log('\n[plugin-auto] Instalando hook no Claude Code...');
  console.log(`  Script:   ${HOOK_SCRIPT}`);
  console.log(`  Settings: ${SETTINGS_PATH}\n`);

  if (!fs.existsSync(HOOK_SCRIPT)) {
    console.error(`ERRO: ${HOOK_SCRIPT} não encontrado.`);
    process.exit(1);
  }

  const settings = readSettings();

  // ── 1. Registrar hook ──────────────────────────────────────────────────────
  if (!settings.hooks) settings.hooks = {};
  if (!settings.hooks.PreToolUse) settings.hooks.PreToolUse = [];

  const alreadyInstalled = settings.hooks.PreToolUse.some((e) => e._id === HOOK_MARKER);
  if (!alreadyInstalled) {
    settings.hooks.PreToolUse.unshift({
      _id: HOOK_MARKER,
      matcher: '.*',
      hooks: [{
        type: 'command',
        command: HOOK_COMMAND,
        timeout: 15,
        statusMessage: 'Avaliando segurança do comando...',
      }],
    });
    console.log('[plugin-auto] Hook registrado.');
  } else {
    console.log('[plugin-auto] Hook já registrado.');
  }

  // ── 2. Configurar backend de IA e verbose ─────────────────────────────────
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    await promptBackend(rl, settings);
    await promptVerbose(rl, settings);
  } finally {
    rl.close();
  }

  writeSettings(settings);

  const backend = settings?.env?.OLLAMA_URL
    ? `Ollama (${settings.env.OLLAMA_URL}, modelo: ${settings.env.OLLAMA_MODEL || 'glm-5.1:cloud'})`
    : settings?.env?.ANTHROPIC_API_KEY
      ? 'Anthropic API (Haiku)'
      : 'Nenhum (somente regras estáticas)';

  const verboseStatus = settings?.env?.PLUGIN_AUTO_VERBOSE ? 'ativado' : 'desativado';

  console.log('\n[plugin-auto] Instalação concluída!');
  console.log('  Reinicie o Claude Code para aplicar as alterações.\n');
  console.log(`  Backend de IA:  ${backend}`);
  console.log(`  Modo verbose:   ${verboseStatus}`);
  console.log('  Comportamento:');
  console.log('    allow  → Read, Glob, Grep, Write, Edit, ls, git status...');
  console.log('    ask    → git push, npm install, rm, docker run...');
  console.log('    deny   → prompt ⛔ com override manual disponível\n');
}

function uninstall() {
  console.log('\n[plugin-auto] Removendo hook do Claude Code...');

  const settings = readSettings();

  if (!settings.hooks?.PreToolUse) {
    console.log('[plugin-auto] Não está instalado. Nenhuma alteração feita.');
    return;
  }

  const before = settings.hooks.PreToolUse.length;
  settings.hooks.PreToolUse = settings.hooks.PreToolUse.filter((e) => e._id !== HOOK_MARKER);
  const after = settings.hooks.PreToolUse.length;

  if (before === after) {
    console.log('[plugin-auto] Não estava instalado. Nenhuma alteração feita.');
    return;
  }

  if (settings.hooks.PreToolUse.length === 0) delete settings.hooks.PreToolUse;
  if (Object.keys(settings.hooks).length === 0) delete settings.hooks;

  writeSettings(settings);
  console.log('[plugin-auto] Removido com sucesso.');
  console.log('  Nota: variáveis de ambiente (ANTHROPIC_API_KEY, OLLAMA_URL...) foram mantidas.\n');
}

// ─── CLI ──────────────────────────────────────────────────────────────────────
const cmd = process.argv[2];
if (cmd === 'uninstall') {
  uninstall();
} else {
  install().catch((err) => {
    console.error(`[plugin-auto] Erro durante instalação: ${err.message}`);
    process.exit(1);
  });
}
