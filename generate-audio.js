#!/usr/bin/env node
// Generates audio/<index>.mp3 for every word in the default list using
// Microsoft Edge's neural Russian voice (ru-RU-DmitryNeural).
// Index-based filenames avoid Cyrillic-filename normalization issues.
// Usage: node generate-audio.js [--limit N]
const fs = require('fs');
const path = require('path');
const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');

const src = fs.readFileSync(path.join(__dirname, 'words.js'), 'utf8');
const m = src.match(/DEFAULT_WORDS = `([\s\S]*?)`/);
const words = m[1].split(',').map(s => s.trim()).filter(Boolean)
  .map(e => e.slice(0, e.indexOf('=')).trim());

const OUT = path.join(__dirname, 'audio');
fs.mkdirSync(OUT, { recursive: true });

const limitArg = process.argv.indexOf('--limit');
const limit = limitArg > -1 ? parseInt(process.argv[limitArg + 1], 10) : words.length;

async function synthOne(tts, word, file) {
  const { audioStream } = await tts.toStream(word);
  const chunks = [];
  for await (const c of audioStream) chunks.push(c);
  const buf = Buffer.concat(chunks);
  if (buf.length < 1000) throw new Error(`suspiciously small audio (${buf.length}B)`);
  fs.writeFileSync(file, buf);
}

(async () => {
  let tts = null;
  let done = 0, skipped = 0, failed = [];
  for (let i = 0; i < Math.min(words.length, limit); i++) {
    const file = path.join(OUT, i + '.mp3');
    if (fs.existsSync(file) && fs.statSync(file).size > 1000) { skipped++; continue; }
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        if (!tts) {
          tts = new MsEdgeTTS();
          await tts.setMetadata('ru-RU-DmitryNeural', OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
        }
        await synthOne(tts, words[i], file);
        done++;
        break;
      } catch (err) {
        tts = null; // reconnect on next attempt
        if (attempt === 3) failed.push(`${i}:${words[i]} (${err.message})`);
        else await new Promise(r => setTimeout(r, 1500 * attempt));
      }
    }
    if ((done + skipped) % 50 === 0) console.log(`progress: ${done + skipped}/${Math.min(words.length, limit)}`);
  }
  console.log(`\ndone: ${done} generated, ${skipped} already existed, ${failed.length} failed`);
  if (failed.length) { console.log(failed.join('\n')); process.exit(1); }
})();
