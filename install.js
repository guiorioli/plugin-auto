#!/usr/bin/env node
'use strict';

/**
 * plugin-auto — Installer / Uninstaller
 *
 * Usage:
 *   node install.js           → installs the hook and configures AI backend
 *   node install.js uninstall → removes the hook from settings.json
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
    console.warn('Could not read settings.json, creating from scratch.');
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

async function promptOllamaCloud(rl, settings) {
  const hasKey = !!settings?.env?.OLLAMA_API_KEY;

  console.log('\n  ┌─ OLLAMA CLOUD API ─────────────────────────────────────────────┐');
  console.log('  │                                                                 │');
  console.log('  │  Use Ollama models remotely via api.ollama.com without a        │');
  console.log('  │  local Ollama instance. Requires an Ollama account.             │');
  console.log('  │                                                                 │');
  console.log('  │  Plans: Free (light usage, 1 concurrent model) or               │');
  console.log('  │  Pro ($20/mo, 50x more usage, 3 concurrent models).             │');
  console.log('  │                                                                 │');
  console.log('  │  Get your API key at:                                           │');
  console.log('  │  https://ollama.com/settings/keys                               │');
  console.log('  │                                                                 │');
  console.log('  │  Default model: gemma3:27b-cloud                                │');
  console.log('  └─────────────────────────────────────────────────────────────────┘\n');

  if (hasKey) {
    const key = settings.env.OLLAMA_API_KEY;
    console.log(`  OLLAMA_API_KEY already configured (${key.substring(0, 12)}...).`);
    const replace = await ask(rl, '  Replace? [y/N]: ');
    if (replace.toLowerCase() !== 'y' && replace !== '') return;
  }

  const key = await ask(rl, '  Paste the OLLAMA_API_KEY and press Enter: ');
  if (key) {
    if (!settings.env) settings.env = {};
    settings.env.OLLAMA_API_KEY = key;
    settings.env.OLLAMA_URL = 'https://ollama.com';
    settings.env.OLLAMA_MODEL = 'gemma3:27b-cloud';
    // Clean up other backends
    delete settings.env.ANTHROPIC_API_KEY;
    console.log(`  Ollama Cloud configured: api.ollama.com (model: ${settings.env.OLLAMA_MODEL}).`);
  } else {
    console.log('  Empty input — backend unchanged.');
  }
}

async function promptOllamaLocal(rl, settings) {
  const hasOllamaUrl = !!settings?.env?.OLLAMA_URL;
  const hasApiKey = !!settings?.env?.OLLAMA_API_KEY;

  if (hasOllamaUrl && hasApiKey) {
    console.log(`\n  Ollama already configured for local: ${settings.env.OLLAMA_URL} (model: ${settings.env.OLLAMA_MODEL || 'gemma3:27b-cloud'}).`);
    console.log('  Warning: OLLAMA_API_KEY is also set — it will be sent to any Ollama URL.');
    const replace = await ask(rl, '  Reconfigure? [y/N]: ');
    if (replace.toLowerCase() !== 'y' && replace !== '') return;
  } else if (hasOllamaUrl) {
    console.log(`\n  Ollama already configured: ${settings.env.OLLAMA_URL} (model: ${settings.env.OLLAMA_MODEL || 'gemma3:27b-cloud'}).`);
    const replace = await ask(rl, '  Reconfigure? [y/N]: ');
    if (replace.toLowerCase() !== 'y' && replace !== '') return;
  }

  const url   = await ask(rl, '\n  Ollama URL [enter for http://localhost:11434]: ');
  const model = await ask(rl, '  Ollama model [enter for gemma3:27b-cloud]: ');
  if (!settings.env) settings.env = {};
  delete settings.env.ANTHROPIC_API_KEY;
  delete settings.env.OLLAMA_API_KEY; // clean up if switching from Ollama Cloud
  settings.env.OLLAMA_URL   = url   || 'http://localhost:11434';
  settings.env.OLLAMA_MODEL = model || 'gemma3:27b-cloud';
  console.log(`  Ollama configured: ${settings.env.OLLAMA_URL} (${settings.env.OLLAMA_MODEL}).`);
}

async function promptAnthropic(rl, settings) {
  const hasKey = !!settings?.env?.ANTHROPIC_API_KEY;

  if (hasKey) {
    const key = settings.env.ANTHROPIC_API_KEY;
    console.log(`\n  ANTHROPIC_API_KEY already configured (${key.substring(0, 12)}...).`);
    const replace = await ask(rl, '  Replace? [y/N]: ');
    if (replace.toLowerCase() !== 'y' && replace !== '') return;
  }
  const key = await ask(rl, '\n  Paste the ANTHROPIC_API_KEY and press Enter: ');
  if (key) {
    if (!settings.env) settings.env = {};
    delete settings.env.OLLAMA_URL;
    delete settings.env.OLLAMA_MODEL;
    delete settings.env.OLLAMA_API_KEY;
    settings.env.ANTHROPIC_API_KEY = key;
    console.log('  Key saved.');
  } else {
    console.log('  Empty input — backend unchanged.');
  }
}

async function promptBackend(rl, settings) {
  const hasCloud  = !!settings?.env?.OLLAMA_API_KEY;
  const hasLocal  = !!settings?.env?.OLLAMA_URL && !settings?.env?.OLLAMA_API_KEY;
  const hasAnthro = !!settings?.env?.ANTHROPIC_API_KEY;

  const currentBackend = hasCloud   ? 'Ollama Cloud API'
                       : hasLocal   ? 'Ollama (local)'
                       : hasAnthro  ? 'Anthropic API'
                       : 'None (static rules)';

  console.log('\n  ┌─ AI BACKEND (smart command validation) ───────────────────────────┐');
  console.log('  │                                                                     │');
  console.log('  │  Commands classified as ask/deny are sent to AI before             │');
  console.log('  │  blocking or prompting — reduces false positives.                  │');
  console.log('  │                                                                     │');
  console.log('  │  (1) Ollama Cloud API — cloud via api.ollama.com, free tier avail. │');
  console.log('  │      Key at: https://ollama.com/settings/keys                      │');
  console.log('  │                                                                     │');
  console.log('  │  (2) Ollama Local     — local, free, requires Ollama installed     │');
  console.log('  │      Download at: https://ollama.com                                │');
  console.log('  │                                                                     │');
  console.log('  │  (3) Anthropic API    — cloud, ~$0.01/mo for typical usage          │');
  console.log('  │      Key at: https://console.anthropic.com > API Keys              │');
  console.log('  │                                                                     │');
  console.log('  │  (4) None             — static rules only (no AI calls)             │');
  console.log('  │                                                                     │');
  console.log(`  │  Current: ${currentBackend.padEnd(50)}│`);
  console.log('  └─────────────────────────────────────────────────────────────────────┘\n');

  const choice = await ask(rl, '  Choose backend [1/2/3/4]: ');

  if (choice === '1') {
    await promptOllamaCloud(rl, settings);
  } else if (choice === '2') {
    await promptOllamaLocal(rl, settings);
  } else if (choice === '3') {
    await promptAnthropic(rl, settings);
  } else if (choice === '4') {
    if (!settings.env) settings.env = {};
    delete settings.env.ANTHROPIC_API_KEY;
    delete settings.env.OLLAMA_URL;
    delete settings.env.OLLAMA_MODEL;
    delete settings.env.OLLAMA_API_KEY;
    console.log('  Backend removed — static rules only.');
  } else {
    console.log('  Invalid option — backend unchanged.');
  }
}

async function promptVerbose(rl, settings) {
  const current = !!settings?.env?.PLUGIN_AUTO_QUIET;
  const label   = current ? 'quiet (labels hidden)' : 'verbose (labels shown)';

  console.log(`\n  Verbose mode — show classification (✓ allow / ⚠ ask) on every command.`);
  console.log(`  Default: verbose. Current setting: ${label}`);

  const answer = await ask(rl, `  Enable quiet mode (hide labels)? [y/N]: `);
  if (!settings.env) settings.env = {};

  if (answer.toLowerCase() === 'y') {
    settings.env.PLUGIN_AUTO_QUIET = '1';
    delete settings.env.PLUGIN_AUTO_VERBOSE;
    console.log('  Quiet mode enabled — labels hidden.');
  } else if (answer !== '') {
    delete settings.env.PLUGIN_AUTO_QUIET;
    delete settings.env.PLUGIN_AUTO_VERBOSE;
    console.log('  Verbose mode kept — labels shown on every command.');
  } else {
    console.log(`  Keeping: ${label}.`);
  }
}

// ─── Install / Uninstall ──────────────────────────────────────────────────────

async function install() {
  console.log('\n[plugin-auto] Installing hook in Claude Code...');
  console.log(`  Script:   ${HOOK_SCRIPT}`);
  console.log(`  Settings: ${SETTINGS_PATH}\n`);

  if (!fs.existsSync(HOOK_SCRIPT)) {
    console.error(`ERROR: ${HOOK_SCRIPT} not found.`);
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
        timeout: 20,
        statusMessage: '[plugin-auto] checking permission',
      }],
    });
    console.log('[plugin-auto] Hook registered.');
  } else {
    console.log('[plugin-auto] Hook already registered.');
  }

  // ── 2. Configure AI backend and verbose mode ───────────────────────────────
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    await promptBackend(rl, settings);
    await promptVerbose(rl, settings);
  } finally {
    rl.close();
  }

  writeSettings(settings);

  const backend = settings?.env?.OLLAMA_API_KEY
    ? `Ollama Cloud API (${settings.env.OLLAMA_URL}, model: ${settings.env.OLLAMA_MODEL || 'gemma3:27b-cloud'})`
    : settings?.env?.OLLAMA_URL
      ? `Ollama Local (${settings.env.OLLAMA_URL}, model: ${settings.env.OLLAMA_MODEL || 'gemma3:27b-cloud'})`
      : settings?.env?.ANTHROPIC_API_KEY
        ? 'Anthropic API (Haiku)'
        : 'None (static rules only)';

  const verboseStatus = settings?.env?.PLUGIN_AUTO_QUIET ? 'quiet (labels hidden)' : 'verbose (labels shown)';

  console.log('\n[plugin-auto] Installation complete!');
  console.log('  Restart Claude Code to apply changes.\n');
  console.log(`  AI backend:     ${backend}`);
  console.log(`  Display mode:  ${verboseStatus}`);
  console.log('  Behavior:');
  console.log('    allow  → Read, Glob, Grep, Write, Edit, ls, git status...');
  console.log('    ask    → git push, npm install, rm, docker run...');
  console.log('    deny   → ⛔ prompt with manual override available\n');
}

function uninstall() {
  console.log('\n[plugin-auto] Removing hook from Claude Code...');

  const settings = readSettings();

  if (!settings.hooks?.PreToolUse) {
    console.log('[plugin-auto] Not installed. No changes made.');
    return;
  }

  const before = settings.hooks.PreToolUse.length;
  settings.hooks.PreToolUse = settings.hooks.PreToolUse.filter((e) => e._id !== HOOK_MARKER);
  const after = settings.hooks.PreToolUse.length;

  if (before === after) {
    console.log('[plugin-auto] Was not installed. No changes made.');
    return;
  }

  if (settings.hooks.PreToolUse.length === 0) delete settings.hooks.PreToolUse;
  if (Object.keys(settings.hooks).length === 0) delete settings.hooks;

  writeSettings(settings);
  console.log('[plugin-auto] Successfully removed.');
  console.log('  Note: environment variables (ANTHROPIC_API_KEY, OLLAMA_URL...) were preserved.\n');
}

// ─── CLI ──────────────────────────────────────────────────────────────────────
const cmd = process.argv[2];
if (cmd === 'uninstall') {
  uninstall();
} else {
  install().catch((err) => {
    console.error(`[plugin-auto] Error during installation: ${err.message}`);
    process.exit(1);
  });
}
