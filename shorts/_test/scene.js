// The ten-second setup test: if this renders with voice and captions, every part of the pipeline works.
export default function scene(g, t, c, k) {
  const { W, H, prog, ease, captionChunks, zackCaptions, CYAN } = k;
  const bg = g.createRadialGradient(W / 2, H * .4, 50, W / 2, H / 2, H * .8);
  bg.addColorStop(0, '#1d2b3f'); bg.addColorStop(1, '#05070c'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
  // a ring that fills as the narration plays, and a tick that lands on "works"
  const p = Math.min(1, t / c.duration);
  g.lineWidth = 34; g.lineCap = 'round';
  g.strokeStyle = 'rgba(255,255,255,.08)'; g.beginPath(); g.arc(W / 2, 760, 260, 0, 7); g.stroke();
  g.strokeStyle = CYAN; g.beginPath(); g.arc(W / 2, 760, 260, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2); g.stroke();
  const tick = prog(t, c.at('works'), .35, ease.outCubic);
  if (tick > 0) {
    g.lineWidth = 40; g.strokeStyle = '#fff'; g.beginPath();
    g.moveTo(W / 2 - 120, 770); g.lineTo(W / 2 - 120 + 90 * Math.min(1, tick * 2), 770 + 90 * Math.min(1, tick * 2));
    if (tick > .5) g.lineTo(W / 2 - 30 + 180 * (tick - .5) * 2, 860 - 230 * (tick - .5) * 2);
    g.stroke();
  }
  scene.chunks ??= captionChunks(c.words);
  zackCaptions(g, t, scene.chunks);
}
scene.tail = .8;
