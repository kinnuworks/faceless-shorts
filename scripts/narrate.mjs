// Narrate a long-form script (a markdown file where spoken lines are *italic*) one section at a time.
// Each "## " section becomes one ElevenLabs take, stitched to its neighbours (previous/next text) so the
// joins sound continuous. Writes <out>/<nn>_<section>.mp3 + .words.json, and sections.json with the order.
//
// usage: node scripts/narrate.mjs <script.md> <out_dir> [--voice <id>] [--only 3]
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
for (const line of fs.readFileSync(path.join(root, '.env'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const [mdPath, outDir] = process.argv.slice(2);
const opt = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const voice = opt('--voice') || process.env.ELEVENLABS_VOICE_ID;
const only = opt('--only');
fs.mkdirSync(outDir, { recursive: true });

const md = fs.readFileSync(mdPath, 'utf8');
const sections = md.split(/^## /m).slice(1).map(block => {
  const title = block.split('\n')[0].trim();
  const spoken = block.replace(/\[[^\]]*\]/g, ' ').replace(/\*\*[^*\n]+\*\*/g, ' ');   // stage directions and bold labels are never spoken
  const text = [...spoken.matchAll(/\*([^*\n]+)\*/g)].map(m => m[1].trim()).join(' ');
  const slug = title.replace(/^[\d:.\s–-]+/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return { title, slug, text };
}).filter(s => s.text);

const toWords = a => {
  const out = []; let cur = null, tag = false;
  a.characters.forEach((ch, i) => {
    if (ch === '[') tag = true;
    if (tag) { if (ch === ']') tag = false; return; }
    if (/\s/.test(ch)) { if (cur) out.push(cur); cur = null; return; }
    if (!cur) cur = { w: '', s: a.character_start_times_seconds[i], e: 0 };
    cur.w += ch; cur.e = a.character_end_times_seconds[i];
  });
  if (cur) out.push(cur);
  return out.filter(w => /[a-z0-9]/i.test(w.w)).map(w => ({ w: w.w.replace(/[^\w'.-]/g, '').replace(/\.+$/, ''), s: w.s, e: w.e, ...(/[.,!?;:]["')\]]*$/.test(w.w) ? { p: true } : {}) }));
};

const index = [];
for (const [k, s] of sections.entries()) {
  const base = path.join(outDir, `${String(k).padStart(2, '0')}_${s.slug}`);
  index.push({ n: k, title: s.title, file: path.basename(base) + '.mp3', words: path.basename(base) + '.words.json', chars: s.text.length });
  if (only !== null && Number(only) !== k) continue;
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}/with-timestamps?output_format=mp3_44100_192`, {
    method: 'POST', headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({
      text: '[American accent] ' + s.text, model_id: 'eleven_v4',
      previous_text: sections[k - 1]?.text.slice(-400), next_text: sections[k + 1]?.text.slice(0, 400),
      voice_settings: { stability: .45, similarity_boost: .8, style: .15, use_speaker_boost: true, speed: 1.08 },
    }),
  });
  if (!res.ok) { console.error(s.title, res.status, (await res.text()).slice(0, 300)); process.exit(1); }
  const d = await res.json();
  fs.writeFileSync(base + '.mp3', Buffer.from(d.audio_base64, 'base64'));
  const words = toWords(d.normalized_alignment || d.alignment);
  fs.writeFileSync(base + '.words.json', JSON.stringify(words, null, 1));
  console.log(`${String(k).padStart(2)}  ${s.title.padEnd(34)} ${words.length} words  ${words.at(-1).e.toFixed(1)}s`);
}
fs.writeFileSync(path.join(outDir, 'sections.json'), JSON.stringify(index, null, 1));
