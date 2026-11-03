// "How a Zipper Actually Works" v3: the picture is rendered in Blender (blender/zipper_v3.py → out/frames/).
// This layer only adds what sits on top of the film: Zack-style captions and the year.
export async function create({ kit, clock }) {
  const { W, H, prog, ease, zackCaptions, captionChunks } = kit;
  const dir = new URL('.', import.meta.url).href;                 // this Short's folder
  const meta = await (await fetch(dir + 'out/frames.json')).json();
  const base = dir + 'out/frames/';
  const chunks = captionChunks(clock.words);
  const t1923 = clock.at('1923'), tName = clock.at('named');
  let frame = null;

  const draw = (g, t) => {
    g.setTransform(1, 0, 0, 1, 0, 0);
    if (frame) g.drawImage(frame, 0, 0, W, H);
    if (t >= t1923 - .05 && t < tName + 1.2) {     // the year, set big over the boot shot
      const p = prog(t, t1923 - .05, .22, ease.outCubic);
      g.save(); g.globalAlpha = p; g.translate(540, 560); g.scale(.92 + .08 * p, .92 + .08 * p);
      g.font = '700 230px Cap'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = '#000'; g.fillText('1923', 16, 18); g.lineWidth = 18; g.strokeStyle = '#000'; g.strokeText('1923', 0, 0);
      g.fillStyle = '#fff'; g.fillText('1923', 0, 0); g.restore();
    }
    zackCaptions(g, t, chunks);
  };
  draw.prepare = async t => {
    const f = Math.min(meta.frames - 1, Math.max(0, Math.round(t * meta.fps)));
    const img = new Image(); img.src = base + String(f).padStart(4, '0') + '.png';
    await img.decode(); frame = img;
  };
  draw.subframes = 1;
  draw.tail = .8;
  return draw;
}
export default { tail: .8 };
