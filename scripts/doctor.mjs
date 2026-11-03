// Checks everything the skill needs and says exactly what to fix. Never prints the API key.
// usage: node scripts/doctor.mjs
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const ok = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`), bad = (m, fix) => { console.log(`  \x1b[31m✗\x1b[0m ${m}\n      → ${fix}`); failed++; };
const has = cmd => { try { return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return null; } };
let failed = 0;

console.log('\nFaceless Shorts: setup check\n');
const [major] = process.versions.node.split('.').map(Number);
major >= 20 ? ok(`Node ${process.versions.node}`) : bad(`Node ${process.versions.node}`, 'install Node 20 or newer from nodejs.org');
has('ffmpeg -version') ? ok('ffmpeg') : bad('ffmpeg not found', 'macOS: brew install ffmpeg · Windows: winget install ffmpeg');
fs.existsSync(path.join(root, 'node_modules', 'playwright')) ? ok('Playwright and three.js installed') : bad('packages missing', 'run: npm install');

const chrome = ['/Applications/Google Chrome.app', 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'].some(p => fs.existsSync(p)) || has('which google-chrome');
chrome ? ok('Google Chrome') : bad('Google Chrome not found', 'install Chrome (the renderer drives it)');

const blender = process.env.BLENDER || ['/Applications/Blender.app/Contents/MacOS/Blender'].find(p => fs.existsSync(p)) || has('which blender');
const bv = blender && has(`"${blender}" --version`);
bv ? ok(`${bv.split('\n')[0]}  (3D looks)`) : bad('Blender not found (only needed for the 3D look)', 'install it free from blender.org, or set BLENDER=/path/to/blender');

has('which whisper-cli') ? ok('whisper-cli (optional: timings for audio you recorded yourself)') : console.log('  · whisper-cli not installed (optional)');

const envFile = path.join(root, '.env');
const env = fs.existsSync(envFile) ? Object.fromEntries(fs.readFileSync(envFile, 'utf8').split('\n').filter(l => /^[A-Z_]+=/.test(l)).map(l => [l.split('=')[0], l.slice(l.indexOf('=') + 1).trim()])) : {};
if (!env.ELEVENLABS_API_KEY) bad('no ElevenLabs key', `create ${envFile} with a line ELEVENLABS_API_KEY=<your key> (paste it in the file, never in a chat)`);
else {
  try {
    const r = await fetch('https://api.elevenlabs.io/v1/user/subscription', { headers: { 'xi-api-key': env.ELEVENLABS_API_KEY } });
    if (!r.ok) bad(`ElevenLabs key rejected (${r.status})`, 'make a new key in ElevenLabs → Developers → API Keys, with text-to-speech access');
    else {
      const s = await r.json();
      ok(`ElevenLabs: ${s.tier} plan, ${s.character_limit - s.character_count} characters left this month`);
      if (s.tier === 'free') console.log('      note: the free plan has no commercial licence; use a paid plan if you monetize');
    }
  } catch { bad('cannot reach ElevenLabs', 'check your internet connection'); }
}
env.ELEVENLABS_VOICE_ID ? ok('default voice set') : console.log('  · no ELEVENLABS_VOICE_ID in .env; each script.json must name its voice_id');

console.log(failed ? `\n${failed} thing(s) to fix above.\n` : '\nAll set. Next: make the test Short.\n');
process.exit(failed ? 1 : 0);
