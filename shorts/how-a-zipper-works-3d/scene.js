// "How a Zipper Actually Works", 3D version. Brass teeth, chrome slider, studio light.
// Built once in create(); every frame is then a pure function of t (positions are recomputed, never stepped).
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export async function create({ kit, clock, THREE }) {
  const { W, H, keys, prog, ease, lerp, clamp, zackCaptions, captionChunks } = kit;
  const at = (w, n) => clock.at(w, n);
  const T = {
    but: at('But') - .06, slider: at("slider's"), sliderCut: at("That's") - .06, yShaped: at('Y-shaped'),
    pullUp: at('Pull') - .06, up: at('up'), squeezeEnd: at('one'), drops: at('drops'), hollow2: at('hollow', 2),
    pullDown: at('Pull', 2) - .06, down: at('down'), apart: at('apart'), design: at('This') - .06, y1913: at('1913'),
    ten: at('Ten') - .06, zip: at('Zip'), and4: at('And', 4) - .06,
    bump1: at('bump'), hollow1: at('hollow'), bump3: at('bump', 3), hollow3: at('hollow', 3),
    grab: at('grab'), wrong: at('wrong'),
  };

  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  r.setPixelRatio(1); r.setSize(W, H, false);
  r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.environment = new THREE.PMREMGenerator(r).fromScene(new RoomEnvironment(), .04).texture;

  // studio backdrops (screen-space): cool blue for most shots, warm for the rubber-boot shot
  const backdrop = (inner, outer, warm) => {
    const cv = document.createElement('canvas'); cv.width = W / 2; cv.height = H / 2;
    const bg = cv.getContext('2d'), w = cv.width, h = cv.height;
    const gr = bg.createRadialGradient(w / 2, h * .38, 40, w / 2, h / 2, h * .75);
    gr.addColorStop(0, inner); gr.addColorStop(1, outer); bg.fillStyle = gr; bg.fillRect(0, 0, w, h);
    let s = 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 30; i++) {
      const x = rnd() * w, y = rnd() * h, rad = 14 + rnd() * 50;
      const b = bg.createRadialGradient(x, y, 0, x, y, rad);
      b.addColorStop(0, rnd() > (warm ? .3 : .6) ? 'rgba(255,196,120,.16)' : 'rgba(43,217,255,.16)'); b.addColorStop(1, 'rgba(0,0,0,0)');
      bg.fillStyle = b; bg.beginPath(); bg.arc(x, y, rad, 0, 7); bg.fill();
    }
    const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; return tx;
  };
  const bgCool = backdrop('#2c4a66', '#070c16', false), bgWarm = backdrop('#5a3a26', '#120a06', true);

  // ---- materials ----
  const weave = (base) => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 256;
    const tg = cv.getContext('2d'); tg.fillStyle = base; tg.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 256; i += 4) { tg.fillStyle = 'rgba(255,255,255,.08)'; tg.fillRect(0, i, 256, 2); tg.fillStyle = 'rgba(0,0,0,.14)'; tg.fillRect(i, 0, 2, 256); }
    const tx = new THREE.CanvasTexture(cv); tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.repeat.set(3, 40); tx.colorSpace = THREE.SRGBColorSpace; return tx;
  };
  const fabric = weave('#0f3550');
  const tapeMat = new THREE.MeshStandardMaterial({ map: fabric, bumpMap: fabric, bumpScale: 1.2, roughness: .92, side: THREE.DoubleSide });
  const rubberMat = new THREE.MeshStandardMaterial({ color: '#0e0e10', roughness: .82, metalness: 0, envMapIntensity: .08, side: THREE.DoubleSide });
  const brass = new THREE.MeshPhysicalMaterial({ color: '#d9a843', metalness: 1, roughness: .26, clearcoat: .35, emissive: '#ff2a1a', emissiveIntensity: 0 });
  const chrome = new THREE.MeshPhysicalMaterial({ color: '#cdd1d8', metalness: 1, roughness: .16, transparent: true, opacity: 1 });
  const glow = new THREE.MeshBasicMaterial({ color: '#2BD9FF', transparent: true, opacity: 0, toneMapped: false });

  // ---- tooth: side profile with a bump on top and a hollow underneath, extruded along the zipper ----
  const toothGeo = (side) => {
    const s = new THREE.Shape(), L = .23, Tk = .075, b = .07, u = side * -.12;   // bump sits near the inner end
    s.moveTo(-L, -Tk); s.lineTo(u - b, -Tk); s.absarc(u, -Tk, b, Math.PI, 0, true);  // hollow (cut upward)
    s.lineTo(L, -Tk); s.lineTo(L, Tk); s.lineTo(u + b, Tk); s.absarc(u, Tk, b, 0, Math.PI, false); // bump
    s.lineTo(-L, Tk); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: .15, bevelEnabled: true, bevelSize: .018, bevelThickness: .018, bevelSegments: 3, curveSegments: 18 });
    g.rotateX(Math.PI / 2); g.translate(0, .075, 0); g.computeVertexNormals();
    return g;
  };
  const PITCH = .24, N = 110, Y0 = -13;
  const rows = [-1, 1].map(side => {
    const m = new THREE.InstancedMesh(toothGeo(side), brass, N);
    m.castShadow = m.receiveShadow = true; m.frustumCulled = false; scene.add(m); return m;
  });

  // tapes: strips whose inner edge follows the teeth
  const tapes = [-1, 1].map(side => {
    const geo = new THREE.PlaneGeometry(1, 28, 1, 280);
    const m = new THREE.Mesh(geo, tapeMat); m.receiveShadow = true; m.position.z = -.1; scene.add(m);
    return { m, side, base: geo.attributes.position.array.slice() };
  });

  // slider: body, pull tab, and the Y channel inside
  const slider = new THREE.Group(); scene.add(slider);
  const body = new THREE.Mesh(new RoundedBoxGeometry(1.75, 1.5, .62, 6, .24), chrome); body.position.z = .3; body.castShadow = true;
  const tab = new THREE.Mesh(new RoundedBoxGeometry(.5, 1.7, .12, 4, .05), chrome); tab.position.set(0, -.95, .72); tab.rotation.x = -.3; tab.castShadow = true;
  const Y = new THREE.Group();
  const bar = (len, x, y, rot) => { const b = new THREE.Mesh(new RoundedBoxGeometry(.13, len, .13, 3, .05), glow); b.position.set(x, y, .3); b.rotation.z = rot; Y.add(b); };
  bar(.75, -.27, .32, .62); bar(.75, .27, .32, -.62); bar(.6, 0, -.25, 0);
  slider.add(body, tab, Y);

  // hero tooth for the close-ups, with cyan rings on the bump and the hollow
  const hero = new THREE.Group(); scene.add(hero);
  const heroTooth = new THREE.Mesh(toothGeo(-1), brass); heroTooth.castShadow = true; heroTooth.scale.setScalar(8); hero.add(heroTooth);
  const arc = (yz, up) => {
    const pts = []; for (let a = 0; a <= Math.PI; a += Math.PI / 40) pts.push(new THREE.Vector3(.96 + Math.cos(a) * .7, .6, yz + Math.sin(a) * .7 * (up ? 1 : -1)));
    const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, .06, 10), glow.clone()); hero.add(m); return m;
  };
  const ringBump = arc(.6, true), ringHollow = arc(-.6, false);
  const heroFloor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: .35 }));
  heroFloor.rotation.x = -Math.PI / 2; heroFloor.position.y = -1.6; heroFloor.receiveShadow = true; hero.add(heroFloor);

  // lights
  const key = new THREE.DirectionalLight('#fff1da', 3.3); key.position.set(-4, 7, 9); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, { left: -7, right: 7, top: 9, bottom: -9, near: .5, far: 40 });
  key.shadow.bias = -.0004; scene.add(key, key.target);
  const rim = new THREE.DirectionalLight('#7fd9ff', 2.4); rim.position.set(6, -4, 5); scene.add(rim);
  scene.add(new THREE.AmbientLight('#ffffff', .12));
  const cam = new THREE.PerspectiveCamera(40, W / H, .1, 200);

  const chunks = captionChunks(clock.words);
  const tmp = new THREE.Object3D(), look = new THREE.Vector3();

  // where the slider is (y), and how open the rows are at height y
  const sliderY = t => keys(t, [[T.slider, -2.6], [T.up, -2.6], [T.hollow2, 2.8], [T.down, 2.8], [T.apart + .5, -2.6],
    [T.zip - .02, -3.4], [T.zip + .34, 3.6]], ease.inOutCubic);
  const openness = (t, y, sy) => t < T.slider ? 1 : clamp((y - sy - .35) / 3.2);

  function layout(t) {
    const sy = sliderY(t);
    // "can't grab": before the slider, the open rows lean in on "grab" and bounce back off each other
    const lean = t < T.slider ? Math.sin(Math.PI * prog(t, T.grab, 1.1, ease.linear)) * .55 : 0;
    rows.forEach((m, k) => {
      const side = k ? 1 : -1;
      for (let i = 0; i < N; i++) {
        const y = Y0 + i * PITCH + (side > 0 ? PITCH / 2 : 0), s = openness(t, y, sy);
        tmp.position.set(side * (.12 + s * 1.05 - lean * .7), y, 0);
        tmp.rotation.set(0, side * lean * .5, side * s * .22);
        tmp.updateMatrix(); m.setMatrixAt(i, tmp.matrix);
      }
      m.instanceMatrix.needsUpdate = true;
    });
    for (const tp of tapes) {
      const p = tp.m.geometry.attributes.position, a = p.array;
      for (let i = 0; i < p.count; i++) {
        const y = tp.base[i * 3 + 1], s = openness(t, y, sy), outer = tp.base[i * 3] > 0 ? 1 : 0;
        const inner = tp.side * (.3 + s * 1.05 - lean * .7);
        a[i * 3] = outer === (tp.side > 0 ? 1 : 0) ? inner + tp.side * 2.4 : inner;
        a[i * 3 + 2] = 0;
      }
      p.needsUpdate = true; tp.m.geometry.computeVertexNormals();
    }
    slider.position.set(0, t < T.slider ? 40 : lerp(7, sy, prog(t, T.slider, .9, ease.outCubic)), 0);
    return sy;
  }

  // camera helper: from/to positions and look targets, eased, plus a slow creep
  const shot = (t, t0, t1, from, to, lookFrom, lookTo, e = ease.inOutCubic) => {
    const p = e(clamp((t - t0) / (t1 - t0)));
    cam.position.set(lerp(from[0], to[0], p), lerp(from[1], to[1], p), lerp(from[2], to[2], p));
    look.set(lerp(lookFrom[0], lookTo[0], p), lerp(lookFrom[1], lookTo[1], p), lerp(lookFrom[2], lookTo[2], p));
    cam.lookAt(look);
  };

  const draw = (g, t) => {
    const heroShot = t < T.but || t >= T.and4;
    hero.visible = heroShot; rows.forEach(m => m.visible = !heroShot); tapes.forEach(tp => tp.m.visible = !heroShot); slider.visible = !heroShot;
    scene.background = t >= T.ten && t < T.and4 ? bgWarm : bgCool;
    tapes.forEach(tp => tp.m.material = t >= T.ten && t < T.and4 ? rubberMat : tapeMat);
    brass.emissiveIntensity = t >= T.wrong && t < T.slider ? .45 * (1 - prog(t, T.wrong, .7, ease.outCubic)) : 0;

    if (heroShot) {
      const loop = t >= T.and4, t0 = loop ? T.and4 : 0, tb = loop ? T.bump3 : T.bump1, th = loop ? T.hollow3 : T.hollow1;
      ringBump.material.opacity = prog(t, tb, .25, ease.outCubic) * (1 - prog(t, th + .2, .4));
      ringHollow.material.opacity = prog(t, th + .15, .3, ease.outCubic);
      // tip the tooth over to show the hollow underneath when it's named
      hero.rotation.set(-.35 + prog(t, th - .1, .7) * 2.3, .5 + (t - t0) * .08, 0);
      hero.position.set(0, .3, 0);
      shot(t, t0, t0 + 4.2, [0, 3.2, 11.5], [0, 2.6, 10.2], [0, .4, 0], [0, .4, 0], ease.linear);
    } else {
      const sy = layout(t);
      body.material.opacity = 1 - .78 * prog(t, T.yShaped - .05, .35) * (1 - prog(t, T.squeezeEnd, .5));
      Y.children.forEach(b => b.material.opacity = prog(t, T.yShaped - .05, .35) * (1 - prog(t, T.squeezeEnd, .5)));
      if (t < T.slider) shot(t, T.but, T.sliderCut, [-3.5, -6, 9], [-2.6, -4.5, 8], [0, -.5, 0], [0, 0, 0]);
      else if (t < T.pullUp) shot(t, T.sliderCut, T.pullUp, [3.2, -6.4, 8.2], [2.2, -5.8, 6.6], [0, -2.4, .2], [0, -2.6, .3]);
      else if (t < T.pullDown) {
        if (t < T.drops - .4) shot(t, T.pullUp, T.drops - .4, [3.4, sy - 4.6, 8.6], [3.0, sy - 4.2, 8.0], [0, sy - .6, 0], [0, sy - .6, 0], ease.linear);
        else shot(t, T.drops - .4, T.drops + .45, [3.0, sy - 4.2, 8.0], [1.1, sy - 3.4, 3.4], [0, sy - .6, 0], [0, sy - 1.6, 0]);
      } else if (t < T.design) shot(t, T.pullDown, T.design, [-3.6, sy - 5, 9.6], [-3.2, sy - 4.4, 8.8], [0, sy - .5, 0], [0, sy - .5, 0], ease.linear);
      else if (t < T.ten) shot(t, T.design, T.ten, [4, -9, 12], [3, -8, 10.5], [0, -1, 0], [0, -.8, 0], ease.linear);
      else if (t < T.zip) shot(t, T.ten, T.zip, [-3.6, -8.4, 8.6], [-3.0, -7.6, 7.6], [0, -2.5, 0], [0, -2.5, 0], ease.linear);
      else shot(t, T.zip, T.zip + .45, [-3.0, -7.6, 7.6], [-2, -1.4, 10], [0, -2.5, 0], [0, 2.2, 0], ease.outExpo);
    }
    key.target.position.copy(look);
    r.render(scene, cam);

    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(canvas, 0, 0);
    const v = g.createRadialGradient(540, 900, 520, 540, 960, 1250);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.5)'); g.fillStyle = v; g.fillRect(0, 0, W, H);

    if (t >= T.y1913 && t < T.ten) {             // the year, set big over the wide shot
      const p = prog(t, T.y1913, .22, ease.outCubic);
      g.save(); g.globalAlpha = p; g.translate(540, 560); g.scale(.9 + .1 * p, .9 + .1 * p);
      g.font = '700 220px Cap'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = '#000'; g.fillText('1913', 15, 18); g.lineWidth = 18; g.strokeStyle = '#000'; g.strokeText('1913', 0, 0);
      g.fillStyle = '#fff'; g.fillText('1913', 0, 0); g.restore();
    }
    zackCaptions(g, t, chunks);
  };
  draw.tail = 1.0;
  return draw;
}

export default { tail: 1.0 };
