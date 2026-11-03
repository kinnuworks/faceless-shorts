// Today's topic for the autopilot: prints the first unticked topic and its slug; --done <slug> ticks it.
// usage: node scripts/next-topic.mjs            → "How a zipper actually works	how-a-zipper-actually-works"
//        node scripts/next-topic.mjs --done <slug>
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const file = path.join(path.resolve(fileURLToPath(new URL('..', import.meta.url))), 'autopilot', 'topics.md');
const lines = fs.readFileSync(file, 'utf8').split('\n');
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const open = lines.map((l, i) => [l, i]).filter(([l]) => /^- \[ \] /.test(l));
if (process.argv[2] === '--done') {
  const hit = open.find(([l]) => slug(l.slice(6)) === process.argv[3]);
  if (!hit) { console.error('no open topic with slug', process.argv[3]); process.exit(1); }
  lines[hit[1]] = hit[0].replace('- [ ] ', '- [x] ');
  fs.writeFileSync(file, lines.join('\n')); console.log('ticked', process.argv[3]);
} else if (!open.length) console.log('the topic list is empty');
else console.log(`${open[0][0].slice(6)}\t${slug(open[0][0].slice(6))}`);
