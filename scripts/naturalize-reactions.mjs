#!/usr/bin/env node
/**
 * Rewrites defaultMessages + notificationTemplates for all 120 predefined reactions
 * in src/constants/reactions.ts and functions/src/helpers/reactions.ts.
 *
 * Usage: node scripts/naturalize-reactions.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MESSAGE_BANKS } from './reaction-message-banks.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CLIENT_PATH = path.join(ROOT, 'src/constants/reactions.ts');
const FUNCTIONS_PATH = path.join(ROOT, 'functions/src/helpers/reactions.ts');

const BANNED_PATTERNS = [
  /—/,
  /–/,
  /--/,
  /^puchu,\s/i,
  /^meri jaan,\s/i,
  /^baccha,\s/i,
  /^baby,\s/i,
  /today'?s feeling:/i,
  /^just wanted to say:/i,
  /^a little note:/i,
  /^from my heart:/i,
  /^randomly:/i,
  /^softly saying:/i,
  /^one more:/i,
  /^tumhare liye:/i,
  /^aaj bas:/i,
  /^sending you this:/i,
  /^bas ek baat:/i,
  /^today I feel:/i,
  /^a little love with:/i,
  /^one tiny message:/i,
  /^aaj tumhare naam:/i,
  /^my little message:/i,
  /^and yes:/i,
  /^listen puchu/i,
  /^okay cutie/i,
  /^my heart says:/i,
  /^no reason, just:/i,
  /^from your favourite person:/i,
  /^come here,/i,
  /mood:\s*\w+/i,
  /thinking of \w+ for you/i,
  /a little \w+ for you/i,
  /sent a little love/i,
  /is feeling:/i,
  /says softly:/i,
  /checked in:/i,
  /just sent:/i,
  /\bsent:\s/i,
  /\bsays:\s/i,
];

function sanitize(text) {
  return text
    .replace(/—/g, ' - ')
    .replace(/–/g, ' - ')
    .replace(/--/g, ' - ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isValidMessage(text) {
  if (!text || text.length < 2) return false;
  return !BANNED_PATTERNS.some((re) => re.test(text));
}

function toNotification(message, index) {
  return index % 4 === 1 ? `{name} - ${message}` : `{name}: ${message}`;
}

function ensureFifty(id, seeds) {
  const out = [];
  const seen = new Set();

  const add = (raw) => {
    const msg = sanitize(raw);
    if (!msg || seen.has(msg) || !isValidMessage(msg)) return;
    seen.add(msg);
    out.push(msg);
  };

  for (const seed of seeds) add(seed);

  if (out.length < 50) {
    throw new Error(`Reaction ${id} only produced ${out.length} valid messages`);
  }

  return out.slice(0, 50);
}

function escapeTsString(value) {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function parsePredefinedMeta(tsSource) {
  const start = tsSource.indexOf('const predefined');
  const end = tsSource.indexOf('const meta');
  const block = tsSource.slice(start, end);
  const re =
    /\{\s*\n\s*id: (\d+),\s*\n\s*emoji: '([^']+)',\s*\n\s*title: '((?:\\'|[^'])*)',[\s\S]*?animationId: '([^']+)',\s*\n\s*category: '([^']+)'/g;
  const items = [];
  let m;
  while ((m = re.exec(block))) {
    items.push({
      id: Number(m[1]),
      emoji: m[2],
      title: m[3].replace(/\\'/g, "'"),
      animationId: m[4],
      category: m[5],
    });
  }
  return items;
}

function formatStringArray(values, indent) {
  const pad = ' '.repeat(indent);
  const inner = ' '.repeat(indent + 2);
  return `[\n${values.map((v) => `${inner}${escapeTsString(v)},`).join('\n')}\n${pad}]`;
}

function renderReactionEntry(entry, messages, { includeCategory }) {
  const defaultMessage = messages[0];
  const notificationTemplate = toNotification(defaultMessage, 0);
  const notificationTemplates = messages.map((msg, i) => toNotification(msg, i));

  const lines = [
    '  {',
    `    id: ${entry.id},`,
    `    emoji: ${escapeTsString(entry.emoji)},`,
    `    title: ${escapeTsString(entry.title)},`,
    `    defaultMessage: ${escapeTsString(defaultMessage)},`,
    `    notificationTemplate: ${escapeTsString(notificationTemplate)},`,
    `    defaultMessages: ${formatStringArray(messages, 4)},`,
    `    notificationTemplates: ${formatStringArray(notificationTemplates, 4)},`,
    `    animationId: ${escapeTsString(entry.animationId)},`,
  ];
  if (includeCategory) {
    lines.push(`    category: ${escapeTsString(entry.category)},`);
  }
  lines.push('  },');
  return lines.join('\n');
}

function rebuildClientFile(original, entries) {
  const predefinedStart = original.indexOf('const predefined');
  const metaStart = original.indexOf('const meta');
  const exportStart = original.indexOf('export const PREDEFINED_REACTIONS');
  if (predefinedStart < 0 || metaStart < 0 || exportStart < 0) {
    throw new Error('Could not locate client reaction sections');
  }

  const header = original.slice(0, predefinedStart);
  const tail = original.slice(exportStart);

  const blocks = entries.map((entry) => {
    const messages = ensureFifty(entry.id, MESSAGE_BANKS[entry.id]);
    return renderReactionEntry(entry, messages, { includeCategory: true });
  });

  return `${header}const predefined: ReactionDefinition[] = [\n${blocks.join('\n')}\n];\n\n${original.slice(metaStart, exportStart)}${tail}`;
}

function rebuildFunctionsFile(original, entries) {
  const predefinedStart = original.indexOf('const predefined');
  const metaStart = original.indexOf('const meta');
  const exportStart = original.indexOf('export const PREDEFINED_REACTIONS');
  if (predefinedStart < 0 || metaStart < 0 || exportStart < 0) {
    throw new Error('Could not locate functions reaction sections');
  }

  const header = original.slice(0, predefinedStart);
  const metaBlock = original.slice(metaStart, exportStart);
  const tail = original.slice(exportStart);

  const blocks = entries.map((entry) => {
    const messages = ensureFifty(entry.id, MESSAGE_BANKS[entry.id]);
    return renderReactionEntry(entry, messages, { includeCategory: false });
  });

  return `${header}const predefined: ReactionDefinition[] = [\n${blocks.join('\n')}\n];\n\n${metaBlock}${tail}`;
}

function extractQuotedStrings(block) {
  return [...block.matchAll(/'((?:\\'|[^'])*)'/g)].map((m) =>
    m[1].replace(/\\'/g, "'"),
  );
}

function verifyMessageStrings(source, label) {
  const sections = [
    ...source.matchAll(/defaultMessages: \[([\s\S]*?)\],\s*\n\s*notificationTemplates:/g),
    ...source.matchAll(/notificationTemplates: \[([\s\S]*?)\],\s*\n\s*animationId:/g),
  ];
  for (const [, block] of sections) {
    for (const msg of extractQuotedStrings(block)) {
      if (/—|–|--/.test(msg)) {
        throw new Error(`Found em dash or double dash in ${label} message: ${msg}`);
      }
    }
  }
}

function verify() {
  const client = fs.readFileSync(CLIENT_PATH, 'utf8');
  const functions = fs.readFileSync(FUNCTIONS_PATH, 'utf8');

  verifyMessageStrings(client, 'client');
  verifyMessageStrings(functions, 'functions');

  const ids = [...client.matchAll(/^\s+id: (\d+),/gm)].map((m) => Number(m[1]));
  const unique = new Set(ids);
  if (unique.size !== 120 || Math.max(...ids) !== 120) {
    throw new Error(`Expected 120 numeric reactions, got ${unique.size}`);
  }

  for (const sampleId of [1, 59, 100, 120]) {
    const re = new RegExp(
      `id: ${sampleId},[\\s\\S]*?defaultMessages: \\[([\\s\\S]*?)\\],\\n\\s*notificationTemplates:`,
    );
    const match = client.match(re);
    if (!match) throw new Error(`Missing reaction ${sampleId}`);
    const msgs = [...match[1].matchAll(/'((?:\\'|[^'])*)'/g)].map((m) =>
      m[1].replace(/\\'/g, "'"),
    );
    if (msgs.length !== 50) {
      throw new Error(`Reaction ${sampleId} has ${msgs.length} messages, expected 50`);
    }
  }

  if (!client.includes('export function buildOneTapFeelings')) {
    throw new Error('buildOneTapFeelings export missing from client file');
  }

  console.log('Verification passed: 120 reactions, sample ids have 50 msgs, no em dashes.');
}

function main() {
  const clientOriginal = fs.readFileSync(CLIENT_PATH, 'utf8');
  const functionsOriginal = fs.readFileSync(FUNCTIONS_PATH, 'utf8');
  const entries = parsePredefinedMeta(clientOriginal);

  if (entries.length !== 120) {
    throw new Error(`Expected 120 predefined entries, found ${entries.length}`);
  }

  for (const entry of entries) {
    if (!MESSAGE_BANKS[entry.id] || MESSAGE_BANKS[entry.id].length < 50) {
      throw new Error(`Missing or short message bank for reaction ${entry.id}`);
    }
  }

  const newClient = rebuildClientFile(clientOriginal, entries);
  const newFunctions = rebuildFunctionsFile(functionsOriginal, entries);

  fs.writeFileSync(CLIENT_PATH, newClient);
  fs.writeFileSync(FUNCTIONS_PATH, newFunctions);
  verify();

  console.log('Updated:');
  console.log(`  ${CLIENT_PATH}`);
  console.log(`  ${FUNCTIONS_PATH}`);
}

main();
