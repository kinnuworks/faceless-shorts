// Contact sheet of a Short: one frame every <step> seconds, tiled 6 wide, left to right.
// The skill shows this to the user for approval before the full render.
// usage: node scripts/contact.mjs <slug> [step=1.5]
import { chromium } from 'playwright';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import fs from 'fs';
import path from 'path';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const slug = process.argv[2], step = Number(process.argv[3] || 1.5);
const out = path.join(root, 'shorts', slug, 'out'), tmp = path.join(out, 'contact');
fs.mkdirSync(tmp, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', args: ['--allow-file-access-from-files', '--use-angle=metal', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
page.on('pageerror', e => { console.error('scene error:', e.message); process.exit(1); });
await page.goto(`file://${root}/engine/player.html?short=${slug}`);
await page.waitForFunction(() => window.ready === true);
const duration = await page.evaluate(() => window.duration);
let n = 0;
for (let t = .2; t < duration; t += step, n++) {
  const b64 = await page.evaluate(tt => window.frameJPEG(tt, 1), t);
  fs.writeFileSync(path.join(tmp, `f${String(n).padStart(3, '0')}.jpg`), Buffer.from(b64, 'base64'));
}
await browser.close();
const sheet = path.join(out, 'contact_sheet.jpg');
execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', '1', '-i', path.join(tmp, 'f%03d.jpg'), '-vf',
  `scale=270:480,tile=6x${Math.ceil(n / 6)}:padding=4`,
  '-frames:v', '1', sheet]);
fs.rmSync(tmp, { recursive: true });
console.log('wrote', sheet, n, 'frames');
