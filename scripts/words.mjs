// Print a Short's word timings as a readable table: start time, end time, word (phrase ends marked).
// usage: node scripts/words.mjs <slug> [count=14]
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const [slug, count = 14] = process.argv.slice(2);
const words = JSON.parse(fs.readFileSync(path.join(root, 'shorts', slug, 'words.json'), 'utf8'));
const cyan = s => `\x1b[38;5;117m${s}\x1b[0m`, dim = s => `\x1b[2m${s}\x1b[0m`;
console.log(dim('  start    end   word'));
for (const w of words.slice(0, Number(count)))
  console.log(`  ${w.s.toFixed(2).padStart(5)}  ${w.e.toFixed(2).padStart(5)}   ${cyan(w.w)}${w.p ? dim('  |') : ''}`);
console.log(dim(`  … ${words.length} words, ${words.at(-1).e.toFixed(2)} s`));
