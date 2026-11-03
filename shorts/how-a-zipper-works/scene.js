// "How a Zipper Actually Works": paper cut-out look. Every event fires on its spoken word.
const GOLD = '#f2c14e', GOLD_DARK = '#c8921f', TAPE = '#2f6f8f', METAL = '#5b5f66', METAL_HI = '#8a9099', RED = '#d9483b';

export default function scene(g, t, c, k) {
  const { W, H, keys, zoomKeys, spring, prog, ease, paper, rr, pill, stamp, captions, camera, backdrop, grainOverlay } = k;
  const at = (w, n) => c.at(w, n);

  backdrop(g, t);

  const tBut = at('But'), tSlider = at("slider's"), tUp = at('up'), tDown = at('down'), tDesign = at('design'),
    tTen = at('Ten'), tZip = at('Zip'), tAnd = at('And', 4);

  // ---- beat A and H: one giant tooth, the bump and the hollow ----
  const closeUp = t < tBut - .05 || t >= tAnd - .05;
  if (closeUp) {
    const second = t >= tAnd - .05, tb = second ? at('bump', 3) : at('bump'), th = second ? at('hollow', 3) : at('hollow');
    const t0 = second ? tAnd : 0;
    const z = zoomKeys(t, [[t0, 1.0], [t0 + 3.6, 1.12]], ease.linear);
    camera(g, z, 540, 820);
    bigTooth(g, k, 540, 760, 1.7 * spring(t, t0, 10, .5), t >= tb ? spring(t, tb, 14, .45) : 0, t >= th ? spring(t, th, 14, .45) : 0);
    pill(g, t, tb, 540, 470, 'BUMP', { size: 56 });
    pill(g, t, th, 540, 1110, 'HOLLOW', { size: 56 });
  } else {
    // ---- the zipper ----
    // slider height on screen: absent until "slider's", up on "up", down on "down", zipped fast on "Zip"
    const sliderIn = spring(t, tSlider, 11, .5);
    const sy = keys(t, [[tSlider, 1180], [tUp, 1180], [at('hollow', 2), 520], [tDown, 520], [at('apart'), 1180],
      [tZip - .05, 1180], [tZip + .35, 430]], ease.inOutCubic);
    // before the slider exists the rows hang open and parallel
    const openAll = t < tSlider ? 1 : 0;
    const tilt = t < tSlider ? Math.sin(prog(t, at('angle'), .8) * Math.PI * 3) * .18 * prog(t, at('angle'), .2) : 0;

    // camera: wide → into the slider on "Y-shaped" → onto the meshing teeth on "drops" → wide → whip on "Zip"
    const z = zoomKeys(t, [[tBut, 1.0], [at('Y-shaped') - .1, 1.0], [at('Y-shaped') + .35, 1.75], [tUp, 1.75],
      [tUp + .6, 1.1], [at('drops') - .25, 1.1], [at('drops') + .15, 2.3], [at('hollow', 2) + .5, 2.3],
      [tDown, 1.0], [tZip - .1, 1.0], [tZip + .2, 1.25], [tAnd, 1.0]], ease.inOutCubic);
    const fy = keys(t, [[tBut, 900], [at('Y-shaped'), sy], [tUp, sy], [at('drops') - .25, sy], [at('drops') + .15, sy + 300],
      [tDown, 900]], ease.inOutCubic);
    camera(g, z, 540, fy);

    zipper(g, k, t, sy, openAll, tilt, sliderIn, prog(t, at('Y-shaped'), .3) * (1 - prog(t, tUp, .4)));

    if (t >= at('wrong') && t < tSlider) bigX(g, k, 540, 760, spring(t, at('wrong'), 15, .4));
    if (t >= at('drops') && t < tDown) pill(g, t, at('drops'), 540 + 120, sy + 330, 'CLICK', { size: 34 });
  }

  // ---- 1913 and the boot ----
  g.setTransform(1, 0, 0, 1, 0, 0);
  if (t >= at('1913') - .1 && t < tTen) stamp(g, t, at('1913') - .1, 540, 520, 1913);
  if (t >= at('boot') && t < tZip) boot(g, k, 540, 600, spring(t, at('boot'), 12, .45));
  if (t >= tZip && t < tAnd) {
    const p = spring(t, tZip, 16, .4);
    g.save(); g.translate(540, 520); g.rotate(-.08); g.scale(p, p);
    g.font = '700 300px Fredoka'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    g.lineWidth = 40; g.strokeStyle = k.INK; g.strokeText('ZIP!', 0, 0);
    g.fillStyle = k.CYAN; g.fillText('ZIP!', 0, 0); g.restore();
  }

  captions(g, t, c.words, { keyWords: ['bump', 'hollow', 'slider', 'yshaped', '1913', 'zip', 'click'] });
  grainOverlay(g, .07);
}
scene.tail = 1.0;

// side view of one tooth: a block with a bump on top and a hollow cut underneath
function bigTooth(g, k, x, y, s, bumpGlow, hollowGlow) {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.beginPath();
  g.moveTo(-210, -60); g.lineTo(-70, -60);
  g.arc(0, -60, 70, Math.PI, 0);              // the bump
  g.lineTo(210, -60); g.lineTo(210, 150); g.lineTo(70, 150);
  g.arc(0, 150, 70, 0, Math.PI, true);        // the hollow
  g.lineTo(-210, 150); g.closePath();
  k.paper(g, GOLD, { lift: 1.6 });
  if (bumpGlow) { g.beginPath(); g.arc(0, -60, 70 + 14 * bumpGlow, Math.PI, 0); g.lineWidth = 12; g.strokeStyle = k.CYAN; g.globalAlpha = Math.min(1, bumpGlow); g.stroke(); g.globalAlpha = 1; }
  if (hollowGlow) { g.beginPath(); g.arc(0, 150, 70, 0, Math.PI, true); g.lineWidth = 12; g.strokeStyle = k.CYAN; g.globalAlpha = Math.min(1, hollowGlow); g.stroke(); g.globalAlpha = 1; }
  g.restore();
}

// two tapes of teeth; meshed below the slider, opening into a Y above it
function zipper(g, k, t, sy, openAll, tilt, sliderIn, channel) {
  const pitch = 44, cx = 540;
  const spread = y => openAll ? 1 : Math.min(1, Math.max(0, (sy - y) / 420));
  for (const side of [-1, 1]) {
    // tape
    g.beginPath();
    for (let y = -400; y <= 2300; y += 20) {
      const off = cx + side * (70 + spread(y) * 150 + 18) + side * tilt * (y - 900) * .3;
      y === -400 ? g.moveTo(off, y) : g.lineTo(off, y);
    }
    for (let y = 2300; y >= -400; y -= 20) {
      const off = cx + side * (70 + spread(y) * 150 + 18 + 70) + side * tilt * (y - 900) * .3;
      g.lineTo(off, y);
    }
    g.closePath(); k.paper(g, TAPE, { lift: 1.1 });
  }
  for (let i = -10; i < 50; i++) for (const side of [-1, 1]) {
    const y = i * pitch + (side > 0 ? pitch / 2 : 0);
    const s = spread(y);
    const x = cx + side * (24 + s * 150) + side * tilt * (y - 900) * .3;
    g.save(); g.translate(x, y); g.rotate(side * (s * .15 + tilt * .5));
    k.rr(g, -36, -13, 72, 26, 9); k.paper(g, GOLD, { lift: .5, grain: .06 });
    g.beginPath(); g.arc(side * -28, 0, 9, 0, 7); g.fillStyle = GOLD_DARK; g.fill();
    g.restore();
  }
  if (sliderIn <= 0) return;
  // slider body drops in from above
  const y = k.lerp(-300, sy, Math.min(sliderIn, 1.15));
  g.save(); g.translate(cx, y);
  k.rr(g, -150, -170, 300, 250, 46); k.paper(g, METAL, { lift: 1.8 });
  if (channel > 0) {
    g.globalAlpha = channel;
    k.rr(g, -136, -156, 272, 222, 38); g.fillStyle = '#3a3e45'; g.fill();
    g.beginPath(); g.moveTo(-120, -150); g.lineTo(-26, -10); g.lineTo(-26, 66); g.lineTo(26, 66); g.lineTo(26, -10);
    g.lineTo(120, -150); g.lineTo(60, -150); g.lineTo(0, -60); g.lineTo(-60, -150); g.closePath();
    g.fillStyle = k.CYAN; g.fill();
    g.globalAlpha = 1;
  } else {
    k.rr(g, -110, -130, 220, 120, 30); g.fillStyle = METAL_HI; g.fill();
  }
  k.rr(g, -36, 70, 72, 230, 34); k.paper(g, METAL, { lift: 1.2 });
  g.restore();
}

function bigX(g, k, x, y, s) {
  g.save(); g.translate(x, y); g.scale(s, s); g.rotate(.06);
  for (const r of [.78, -.78]) { g.save(); g.rotate(r); k.rr(g, -190, -36, 380, 72, 30); k.paper(g, RED, { lift: 1.4 }); g.restore(); }
  g.restore();
}

function boot(g, k, x, y, s) {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.beginPath();
  g.moveTo(-120, -230); g.lineTo(60, -230); g.lineTo(60, 40); g.quadraticCurveTo(230, 60, 240, 160);
  g.lineTo(240, 210); g.lineTo(-140, 210); g.lineTo(-140, 120); g.lineTo(-120, -230); g.closePath();
  k.paper(g, '#3b3b42', { lift: 1.6 });
  k.rr(g, -150, 190, 410, 46, 20); k.paper(g, '#24242a', { lift: .8 });
  for (let i = 0; i < 9; i++) { k.rr(g, -14, -215 + i * 30, 28, 16, 6); g.fillStyle = GOLD; g.fill(); }
  g.restore();
}
