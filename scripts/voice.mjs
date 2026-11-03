// Narrate a Short with ElevenLabs and save word timings.
// Reads shorts/<slug>/script.json ({ text, voice_id?, speed? }) and writes voice.mp3 + words.json.
// The API key comes from ELEVENLABS_API_KEY (env or the skill's .env file), never from the script.
//
// usage: node scripts/voice.mjs <slug>
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const envFile = path.join(root, '.env');
if (fs.existsSync(envFile))
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }

const slug = process.argv[2];
const dir = path.join(root, 'shorts', slug);
const cfg = JSON.parse(fs.readFileSync(path.join(dir, 'script.json'), 'utf8'));
const key = process.env.ELEVENLABS_API_KEY;
if (!key) { console.error('ELEVENLABS_API_KEY missing: add it to faceless-shorts/.env, or record voice.mp3 and run scripts/align.sh'); process.exit(1); }

const voice = cfg.voice_id || process.env.ELEVENLABS_VOICE_ID;
const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}/with-timestamps?output_format=mp3_44100_192`, {
  method: 'POST',
  headers: { 'xi-api-key': key, 'content-type': 'application/json' },
  body: JSON.stringify({
    text: cfg.text,
    model_id: cfg.model_id || 'eleven_v4',
    voice_settings: { stability: .5, similarity_boost: .8, style: .1, use_speaker_boost: true, speed: cfg.speed ?? 1.08 },
  }),
});
if (!res.ok) { console.error('ElevenLabs error', res.status, await res.text()); process.exit(1); }
const data = await res.json();
fs.writeFileSync(path.join(dir, 'voice.mp3'), Buffer.from(data.audio_base64, 'base64'));

// characters → words (skip [direction tags] like [American accent])
const a = data.normalized_alignment || data.alignment;
const words = [];
let cur = null, inTag = false;
a.characters.forEach((ch, i) => {
  if (ch === '[') inTag = true;
  if (inTag) { if (ch === ']') inTag = false; return; }
  if (/[\s]/.test(ch)) { if (cur) words.push(cur); cur = null; return; }
  if (!cur) cur = { w: '', s: a.character_start_times_seconds[i], e: 0 };
  cur.w += ch; cur.e = a.character_end_times_seconds[i];
});
if (cur) words.push(cur);
// p marks the end of a phrase (the word carried . , ! ? ; :), which is where captions break
const clean = words.filter(w => /[a-z0-9]/i.test(w.w)).map(w => ({
  ...w, w: w.w.replace(/[^\w'.-]/g, '').replace(/\.+$/, ''), ...(/[.,!?;:]["')\]]*$/.test(w.w) ? { p: true } : {}),
}));
fs.writeFileSync(path.join(dir, 'words.json'), JSON.stringify(clean, null, 1));
console.log(`voice ${clean.length} words, ${clean.at(-1).e.toFixed(2)}s`);
