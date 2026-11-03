// Render a Short to MP4: seek every frame in headless Chrome, blend subframes for motion blur,
// pipe JPEGs into ffmpeg, then mux the voice (and an optional music bed) and master to -14 LUFS.
//
// usage: node scripts/render.mjs <slug> [--draft] [--music path.mp3]
//   --draft  : 15 fps, no motion blur (fast preview)
import { chromium } from 'playwright';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import fs from 'fs';
import path from 'path';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const slug = process.argv[2];
const draft = process.argv.includes('--draft');
const musicIdx = process.argv.indexOf('--music');
const music = musicIdx > 0 ? process.argv[musicIdx + 1] : null;
if (!slug) { console.error('usage: render.mjs <slug> [--draft] [--music file]'); process.exit(1); }

const dir = path.join(root, 'shorts', slug), out = path.join(dir, 'out');
fs.mkdirSync(out, { recursive: true });
const fps = draft ? 15 : 30, sub = draft ? 1 : 2;

const browser = await chromium.launch({ channel: 'chrome', args: ['--allow-file-access-from-files', '--use-angle=metal', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
page.on('pageerror', e => { console.error('scene error:', e.message); process.exit(1); });
await page.goto(`file://${root}/engine/player.html?short=${slug}`);
await page.waitForFunction(() => window.ready === true, null, { timeout: 30000 });
const duration = await page.evaluate(() => window.duration);
const frames = Math.ceil(duration * fps);
const sceneSub = await page.evaluate(() => window.subframes);

const silent = path.join(out, 'video_silent.mp4');
const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
  '-c:v', 'libx264', '-preset', draft ? 'veryfast' : 'slow', '-crf', draft ? '26' : '16',
  '-pix_fmt', 'yuv420p', '-r', '30', silent], { stdio: ['pipe', 'inherit', 'inherit'] });

const t0 = Date.now();
for (let i = 0; i < frames; i++) {
  const b64 = await page.evaluate(([t, s]) => window.frameJPEG(t, s), [i / fps, Math.min(sub, sceneSub)]);
  if (!ff.stdin.write(Buffer.from(b64, 'base64'))) await new Promise(r => ff.stdin.once('drain', r));
  if (i % 60 === 0) process.stdout.write(`\rframe ${i}/${frames}`);
}
ff.stdin.end();
await new Promise(r => ff.on('close', r));
await browser.close();
console.log(`\rrendered ${frames} frames in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

// audio: voice, plus music bed ~18 dB under it, then two-pass loudness to -14 LUFS / -1.5 dBTP
const voice = path.join(dir, 'voice.mp3');
const final = path.join(out, `${slug}${draft ? '_draft' : ''}.mp4`);
const sfxFile = path.join(dir, 'sfx.json');
const sfx = fs.existsSync(sfxFile) ? JSON.parse(fs.readFileSync(sfxFile, 'utf8')) : [];
const inputs = ['-i', silent, '-i', voice, ...(music ? ['-stream_loop', '-1', '-i', music] : []), ...sfx.flatMap(s => ['-i', path.join(dir, s.file)])];
const sfxBase = music ? 3 : 2;
const sfxChain = sfx.map((s, k) => `[${sfxBase + k}:a]aresample=48000,volume=${s.gain_db}dB,adelay=${Math.round(s.t * 1000)}:all=1[s${k}];`).join('');
const sfxMix = sfx.length ? `[vx]${sfx.map((_, k) => `[s${k}]`).join('')}amix=inputs=${sfx.length + 1}:duration=first:normalize=0` : null;
const mix0 = music
  ? `[1:a]aresample=48000,acompressor=threshold=-22dB:ratio=3:attack=5:release=90[v];[2:a]aresample=48000,volume=-18dB,afade=t=out:st=${(duration - 1.5).toFixed(2)}:d=1.5[m];` +
    `[v][m]amix=inputs=2:duration=first:normalize=0,apad`
  : `[1:a]aresample=48000,acompressor=threshold=-22dB:ratio=3:attack=5:release=90,apad`;
const mix = sfx.length ? `${mix0}[vx];${sfxChain}${sfxMix}` : mix0;
const run = args => new Promise((res, rej) => {
  const p = spawn('ffmpeg', args); let err = '';
  p.stderr.on('data', d => err += d);
  p.on('close', c => c ? rej(new Error(err)) : res(err));
});
const target = 'I=-14:TP=-1.5:LRA=7';
const measured = await run(['-hide_banner', ...inputs, '-filter_complex', `${mix},loudnorm=${target}:print_format=json[a]`,
  '-map', '[a]', '-t', duration.toFixed(3), '-f', 'null', '-']);
const m = JSON.parse(measured.match(/\{[^{}]*"input_i"[^{}]*\}/)[0]);
// straight gain to -14 LUFS, with a brickwall limiter catching the few peaks it pushes past -1.5 dBTP
const gain = (-14 - Number(m.input_i)).toFixed(2);
await run(['-v', 'error', '-y', ...inputs, '-filter_complex',
  `${mix},volume=${gain}dB,aresample=192000,alimiter=limit=-1.8dB:level=false:attack=1:release=60,aresample=48000[a]`,
  '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-t', duration.toFixed(3), final]);
console.log('wrote', final);
