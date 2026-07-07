#!/usr/bin/env node
// Validates the DEFAULT_WORDS list in words.js:
//  - every entry is "word=meaning", word is pure Cyrillic (hyphen allowed)
//  - meaning is Latin/ASCII text
//  - no duplicate words
//  - all 33 Cyrillic letters are covered
//  - reports count and per-letter frequency
const fs = require('fs');
const src = fs.readFileSync(require('path').join(__dirname, 'words.js'), 'utf8');
const m = src.match(/DEFAULT_WORDS = `([\s\S]*?)`/);
if (!m) { console.error('FAIL: could not extract DEFAULT_WORDS'); process.exit(1); }

const entries = m[1].split(',').map(s => s.trim()).filter(Boolean);
const ALPHABET = 'абвгдеёжзийклмнопрстуфхцчшщъыьэюя'.split('');
const seen = new Map();
const problems = [];
const letterCount = Object.fromEntries(ALPHABET.map(l => [l, 0]));

for (const e of entries) {
  const eq = e.indexOf('=');
  if (eq < 1) { problems.push(`bad format: "${e}"`); continue; }
  const word = e.slice(0, eq).trim();
  const meaning = e.slice(eq + 1).trim();
  if (!/^[а-яё-]+$/i.test(word)) { problems.push(`non-Cyrillic word: "${e}"`); continue; }
  if (!meaning || !/^[\x20-\x7E’]+$/.test(meaning)) { problems.push(`bad meaning: "${e}"`); continue; }
  if (seen.has(word.toLowerCase())) { problems.push(`duplicate: "${word}"`); continue; }
  seen.set(word.toLowerCase(), meaning);
  for (const ch of word.toLowerCase()) if (ch in letterCount) letterCount[ch]++;
}

const missing = ALPHABET.filter(l => letterCount[l] === 0);
const rare = ALPHABET.filter(l => letterCount[l] > 0 && letterCount[l] < 3);

console.log(`entries: ${entries.length}, valid unique words: ${seen.size}`);
if (problems.length) {
  console.log(`\nPROBLEMS (${problems.length}):`);
  problems.forEach(p => console.log('  ' + p));
}
if (missing.length) console.log(`\nMISSING letters: ${missing.join(' ')}`);
if (rare.length) console.log(`rare letters (<3 uses): ${rare.map(l => `${l}:${letterCount[l]}`).join(' ')}`);
if (!problems.length && !missing.length && seen.size >= 1000) {
  console.log('\nOK: all checks passed');
  process.exit(0);
}
process.exit(problems.length || missing.length ? 1 : 2);
