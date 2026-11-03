// toy-workshop style test: Tack (a clockwork tin worker) in a tiny teal room inside a giant machine.
// Four shots on the _test voice: room wide, giant hardware, X-ray motor, low-angle glow ring.
// Built once in create(); every frame is a pure function of t.
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export async function create({ kit, clock, THREE }) {
  const { W, H, prog, spring, ease, lerp, clamp, zackCaptions, captionChunks } = kit;
  const at = (w, n) => clock.at(w, n);
  const T = {
    hear: at('hear'), read: at('read'), your: at('your') - .06, works: at('works'),
    now: at('Now') - .06, sentence: at('sentence'), and2: at('and', 2) - .06, real: at('real'), one2: at('one', 2),
  };
  const P = {
    wall: '#5f9fb8', wallLow: '#2f7896', tile: '#2c7d9c', grout: '#1b3f5c', lamp: '#ffd27a', wash: '#b8d86a',
    brass: '#b8863b', steel: '#c9ced6', red: '#c8461e', oxblood: '#7a2418', hazard: '#f2b51c', ink: '#101418',
    xray: '#7fd4ff', spark: '#e6f6ff', violet: '#8a3cff', magenta: '#d24ae8', night: '#14123a',
  };

  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  r.setPixelRatio(1); r.setSize(W, H, false);
  r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.15;
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.environment = new THREE.PMREMGenerator(r).fromScene(new RoomEnvironment(), .04).texture;
  scene.environmentIntensity = .55;

  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const tex = (w, h, paint, repeat = [1, 1]) => {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h; paint(cv.getContext('2d'), w, h);
    const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace;
    tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.repeat.set(...repeat); tx.anisotropy = 8; return tx;
  };
  const jitter = (hex, a) => { const c = new THREE.Color(hex); c.offsetHSL(0, 0, (rnd() - .5) * a); return '#' + c.getHexString(); };

  // ---- textures: tiles, plaster, hazard belt, glow ----
  const tileTex = tex(1024, 1024, (g, w) => {
    g.fillStyle = P.grout; g.fillRect(0, 0, w, w);
    const n = 8, s = w / n, gap = 14;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      g.fillStyle = jitter(P.tile, .1); g.fillRect(i * s + gap / 2, j * s + gap / 2, s - gap, s - gap);
      const hi = g.createLinearGradient(i * s, j * s, i * s + s, j * s + s);   // wet sheen across each tile
      hi.addColorStop(0, 'rgba(255,240,180,.10)'); hi.addColorStop(.5, 'rgba(255,255,255,0)'); hi.addColorStop(1, 'rgba(0,20,40,.16)');
      g.fillStyle = hi; g.fillRect(i * s + gap / 2, j * s + gap / 2, s - gap, s - gap);
    }
    for (let k = 0; k < 900; k++) { g.fillStyle = `rgba(${rnd() > .5 ? '255,255,230' : '0,20,30'},${.04 + rnd() * .08})`; g.fillRect(rnd() * w, rnd() * w, 1 + rnd() * 5, 1 + rnd() * 2); }
  }, [4, 4]);
  const plasterTex = tex(1024, 1024, (g, w, h) => {
    g.fillStyle = P.wall; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 260; k++) {
      const x = rnd() * w, y = rnd() * h * .72, rad = 30 + rnd() * 160, b = g.createRadialGradient(x, y, 0, x, y, rad);
      b.addColorStop(0, rnd() > .5 ? 'rgba(170,215,225,.07)' : 'rgba(30,80,120,.07)'); b.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = b; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    const band = h * .7; g.fillStyle = P.wallLow; g.fillRect(0, band, w, h - band);           // darker lower band
    g.fillStyle = 'rgba(10,40,60,.35)'; g.fillRect(0, band - 6, w, 10);
    for (let k = 0; k < 140; k++) { g.strokeStyle = `rgba(20,50,80,${.06 + rnd() * .1})`; g.lineWidth = 1 + rnd() * 2; g.beginPath();
      let x = rnd() * w, y = rnd() * h; g.moveTo(x, y); for (let s = 0; s < 4; s++) g.lineTo(x += (rnd() - .5) * 60, y += (rnd() - .5) * 40); g.stroke(); }
  }, [1, 1]);
  const hazardTex = tex(256, 64, (g, w, h) => {
    g.fillStyle = P.ink; g.fillRect(0, 0, w, h); g.fillStyle = P.hazard;
    for (let x = -h; x < w + h; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 32, 0); g.lineTo(x + 32 - h, h); g.lineTo(x - h, h); g.fill(); }
  }, [10, 1]);
  const glowTex = tex(128, 128, (g, w) => {
    const b = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    b.addColorStop(0, 'rgba(255,255,255,1)'); b.addColorStop(.25, 'rgba(255,255,255,.45)'); b.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = b; g.fillRect(0, 0, w, w);
  });
  const glowSprite = (color, size) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    s.scale.setScalar(size); return s;
  };

  // ---- materials ----
  const M = {
    floor: new THREE.MeshStandardMaterial({ map: tileTex, roughness: .5, metalness: .05 }),
    wall: new THREE.MeshStandardMaterial({ map: plasterTex, roughness: .95 }),
    brass: new THREE.MeshStandardMaterial({ color: P.brass, metalness: 1, roughness: .28 }),
    steel: new THREE.MeshStandardMaterial({ color: P.steel, metalness: 1, roughness: .22 }),
    dark: new THREE.MeshStandardMaterial({ color: '#20262c', metalness: .8, roughness: .4 }),
    red: new THREE.MeshStandardMaterial({ color: P.red, metalness: .3, roughness: .5 }),
    oxblood: new THREE.MeshStandardMaterial({ color: P.oxblood, metalness: .3, roughness: .55 }),
    belt: new THREE.MeshStandardMaterial({ map: hazardTex, roughness: .7 }),
    copper: new THREE.MeshStandardMaterial({ color: '#c77a45', metalness: 1, roughness: .3 }),
    enamel: new THREE.MeshPhysicalMaterial({ color: '#ff7a1c', roughness: .3, clearcoat: .8 }),
    eye: new THREE.MeshStandardMaterial({ color: '#0b0d10', roughness: .15 }),
    housing: new THREE.MeshPhysicalMaterial({ color: '#9aa6b2', metalness: .9, roughness: .3, transparent: true, opacity: 1 }),
    edge: new THREE.LineBasicMaterial({ color: P.xray, transparent: true, opacity: 0, toneMapped: false, blending: THREE.AdditiveBlending }),
    glowBlue: new THREE.MeshBasicMaterial({ color: P.xray, transparent: true, opacity: 0, toneMapped: false }),
    spark: new THREE.MeshBasicMaterial({ color: P.spark, toneMapped: false }),
  };
  const mesh = (geo, mat, parent, pos = [0, 0, 0], rot = [0, 0, 0]) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(...pos); m.rotation.set(...rot);
    m.castShadow = m.receiveShadow = true; parent.add(m); return m;
  };

  // ---- the room ----
  const room = new THREE.Group(); scene.add(room);
  mesh(new THREE.PlaneGeometry(16, 16), M.floor, room, [0, 0, 0], [-Math.PI / 2, 0, 0]);
  mesh(new THREE.PlaneGeometry(16, 9), M.wall, room, [0, 4.5, -3]);
  mesh(new THREE.PlaneGeometry(12, 9), M.wall, room, [-6, 4.5, 3], [0, Math.PI / 2, 0]);
  // brass pipe across the top with flanges and a drop down the left
  mesh(new THREE.CylinderGeometry(.32, .32, 14, 32), M.brass, room, [1, 6.4, -2.6], [0, 0, Math.PI / 2]);
  for (const x of [-4.6, -1, 2.6, 6]) mesh(new THREE.CylinderGeometry(.42, .42, .22, 32), M.brass, room, [x, 6.4, -2.6], [0, 0, Math.PI / 2]);
  mesh(new THREE.CylinderGeometry(.32, .32, 6.4, 32), M.brass, room, [-5.6, 3.2, -2.6]);
  // giant screw head bolted into the wall, and a giant hex nut leaning on the floor
  const screw = new THREE.Group(); screw.position.set(-3.6, 1.5, -2.7); room.add(screw);
  mesh(new THREE.SphereGeometry(2.4, 64, 24, 0, Math.PI * 2, 0, Math.PI / 6.5), M.steel, screw, [0, 0, -2.16], [Math.PI / 2, 0, 0]);   // low dome
  mesh(new THREE.BoxGeometry(1.3, .24, .3), M.dark, screw, [0, 0, .12]);
  mesh(new THREE.BoxGeometry(.24, 1.3, .3), M.dark, screw, [0, 0, .12]);
  const hex = new THREE.Shape(); for (let k = 0; k < 6; k++) hex[k ? 'lineTo' : 'moveTo'](Math.cos(k * Math.PI / 3) * 1.15, Math.sin(k * Math.PI / 3) * 1.15);
  const hole = new THREE.Path(); hole.absarc(0, 0, .55, 0, Math.PI * 2, true); hex.holes.push(hole);
  const nutGeo = new THREE.ExtrudeGeometry(hex, { depth: .7, bevelEnabled: true, bevelSize: .06, bevelThickness: .06, bevelSegments: 3, curveSegments: 40 });
  nutGeo.translate(0, 0, -.35);
  const nut = mesh(nutGeo, M.steel, room, [-2.1, 1.12, -1.4], [0, .5, 0]);
  // caged wall lamp: the warm practical in every room shot
  const lamp = new THREE.Group(); lamp.position.set(1.9, 3.4, -2.95); room.add(lamp);
  mesh(new THREE.CylinderGeometry(.32, .32, .08, 32), M.dark, lamp, [0, -.15, .04], [Math.PI / 2, 0, 0]);
  mesh(new THREE.CylinderGeometry(.06, .06, .3, 12), M.dark, lamp, [0, -.15, .2], [Math.PI / 2, 0, 0]);
  const bulbMat = new THREE.MeshBasicMaterial({ color: P.lamp, toneMapped: false });
  mesh(new THREE.SphereGeometry(.17, 24, 16), bulbMat, lamp, [0, .12, .35]).castShadow = false;
  for (const y of [-.05, .12, .3]) mesh(new THREE.TorusGeometry(.2, .018, 8, 32), M.brass, lamp, [0, y, .35], [Math.PI / 2, 0, 0]);
  const lampGlow = glowSprite(P.lamp, 1.8); lampGlow.position.set(0, .12, .4); lamp.add(lampGlow);
  const lampLight = new THREE.PointLight(P.lamp, 0, 12, 1.6); lampLight.position.set(0, .12, .6); lamp.add(lampLight);

  // ---- Tack: original clockwork tin worker, about 1 unit tall ----
  const tack = new THREE.Group(); room.add(tack);
  const body = mesh(new THREE.SphereGeometry(.32, 32, 24), M.copper, tack, [0, .52, 0]); body.scale.set(1, 1.1, .9);
  mesh(new THREE.TorusGeometry(.31, .025, 8, 40), M.brass, tack, [0, .5, 0], [Math.PI / 2, 0, 0]);
  const head = new THREE.Group(); head.position.set(0, .92, 0); tack.add(head);
  mesh(new THREE.SphereGeometry(.2, 32, 24), M.copper, head);
  mesh(new THREE.SphereGeometry(.23, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), M.enamel, head, [0, .03, 0]);
  mesh(new THREE.CylinderGeometry(.25, .25, .03, 32), M.enamel, head, [0, .03, .02]);
  mesh(new THREE.CylinderGeometry(.05, .05, .05, 16), bulbMat, head, [0, .14, .21], [Math.PI / 2.4, 0, 0]);
  for (const x of [-.075, .075]) mesh(new THREE.SphereGeometry(.035, 16, 12), M.eye, head, [x, -.02, .18]);
  const limb = (x, y, len, rz) => { const g = new THREE.Group(); g.position.set(x, y, 0); g.rotation.z = rz; tack.add(g);
    mesh(new THREE.CapsuleGeometry(.06, len, 6, 12), M.steel, g, [0, -len / 2, 0]); return g; };
  const armL = limb(-.3, .66, .28, -.5), armR = limb(.3, .66, .28, .5);
  limb(-.12, .26, .16, 0); limb(.12, .26, .16, 0);
  const key = new THREE.Group(); key.position.set(0, .55, -.3); tack.add(key);
  mesh(new THREE.CylinderGeometry(.03, .03, .18, 12), M.brass, key, [0, 0, -.08], [Math.PI / 2, 0, 0]);
  for (const s of [-1, 1]) mesh(new THREE.TorusGeometry(.08, .025, 8, 24), M.brass, key, [s * .09, 0, -.18], [0, Math.PI / 2, 0]);

  // ---- the machine: red base, drum, hazard belt, motor with an X-ray housing ----
  const mach = new THREE.Group(); mach.position.set(6, 0, .5); room.add(mach);
  mesh(new RoundedBoxGeometry(4.6, .8, 1.8, 4, .08), M.red, mach, [0, .4, 0]);
  mesh(new RoundedBoxGeometry(1.6, 1.6, 1.4, 4, .08), M.oxblood, mach, [-1.4, 1.5, -.1]);
  const drum = new THREE.Group(); drum.position.set(-1.4, 3.3, 0); mach.add(drum);
  mesh(new THREE.TorusGeometry(1.5, .14, 16, 64), M.dark, drum);
  mesh(new THREE.CylinderGeometry(1.45, 1.45, .5, 64, 1, true), M.steel, drum, [0, 0, -.25], [Math.PI / 2, 0, 0]);
  for (let k = 0; k < 12; k++) mesh(new THREE.BoxGeometry(.08, 1.4, .06), M.steel, drum, [0, 0, 0], [0, 0, k * Math.PI / 12]);
  const motor = new THREE.Group(); motor.position.set(1.1, 1.35, .15); mach.add(motor);
  const housingGeo = new THREE.CylinderGeometry(.62, .62, 1.3, 48);
  const housing = mesh(housingGeo, M.housing, motor, [0, 0, 0], [Math.PI / 2, 0, 0]);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(housingGeo, 10), M.edge); edges.rotation.x = Math.PI / 2; motor.add(edges);
  for (let k = 0; k < 7; k++) {   // ribbed rings read as X-ray wireframe when the housing goes glass
    const ring = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.TorusGeometry(.6, .01, 3, 40)), M.edge);
    ring.position.z = -.55 + k * .18; motor.add(ring);
  }
  const rotor = new THREE.Group(); motor.add(rotor);
  for (let k = 0; k < 6; k++) mesh(new THREE.TorusGeometry(.32, .07, 10, 32), M.copper, rotor, [0, 0, -.45 + k * .18]);
  mesh(new THREE.CylinderGeometry(.12, .12, 1.6, 16), M.steel, rotor, [0, 0, 0], [Math.PI / 2, 0, 0]);
  const plate = mesh(new THREE.CylinderGeometry(.66, .66, .12, 48), M.steel, motor, [0, 0, .7], [Math.PI / 2, 0, 0]);
  const holes = []; for (let k = 0; k < 4; k++) holes.push(mesh(new THREE.CylinderGeometry(.12, .12, .14, 20), M.dark, motor, [Math.cos(k * 1.57 + .4) * .38, Math.sin(k * 1.57 + .4) * .38, .72], [Math.PI / 2, 0, 0]));
  const coilGlow = glowSprite(P.xray, 2.2); motor.add(coilGlow);
  // belt from the motor pulley to the drum rim
  const pulley = new THREE.Vector3(1.1, 1.95, .1), rim = new THREE.Vector3(-1.4, 4.75, .1);
  const beltLen = pulley.distanceTo(rim);
  const belt = mesh(new THREE.BoxGeometry(beltLen, .05, .32), M.belt, mach, pulley.clone().add(rim).multiplyScalar(.5).toArray(), [0, 0, Math.atan2(rim.y - pulley.y, rim.x - pulley.x)]);
  // electric arcs: rebuilt per frame from a seed tied to the frame time, so t alone decides them
  const arcs = new THREE.Group(); motor.add(arcs);

  // ---- twist beat: low angle, violet glow ring on deep navy ----
  const glowSet = new THREE.Group(); glowSet.position.set(0, 0, -40); scene.add(glowSet);
  const SEG = 48, segs = [];
  mesh(new THREE.TorusGeometry(1.5, .05, 8, 96), new THREE.MeshBasicMaterial({ color: '#2a2370', toneMapped: false }), glowSet, [0, 2.6, 0]);
  for (let k = 0; k < SEG; k++) {
    const s = new THREE.Mesh(new THREE.TorusGeometry(1.5, .13, 10, 6, Math.PI * 2 / SEG * .8),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(P.violet).lerp(new THREE.Color(P.magenta), k / SEG), toneMapped: false }));
    s.position.set(0, 2.6, 0); s.rotation.z = Math.PI / 2 - (k + 1) * Math.PI * 2 / SEG; glowSet.add(s); segs.push(s);
  }
  const ringGlow = glowSprite(P.violet, 6); ringGlow.position.set(0, 2.6, -.2); glowSet.add(ringGlow);
  const glowLight = new THREE.PointLight(P.magenta, 0, 10, 1.4); glowLight.position.set(0, 2.6, 1); glowSet.add(glowLight);
  const glowFloor = mesh(new THREE.PlaneGeometry(20, 20), M.floor, glowSet, [0, 0, 0], [-Math.PI / 2, 0, 0]);

  // ---- light: cool teal fill from above, green-yellow wash grazing the wall ----
  scene.add(new THREE.HemisphereLight('#9fd2e6', '#1b3f5c', .9));
  const fill = new THREE.DirectionalLight('#bfe0ee', 1.4); fill.position.set(3, 10, 6); fill.castShadow = true;
  fill.shadow.mapSize.set(2048, 2048); Object.assign(fill.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: .5, far: 40 });
  fill.shadow.bias = -.0005; scene.add(fill, fill.target);
  const wash = new THREE.SpotLight(P.wash, 60, 30, .7, 1, 1.2); wash.position.set(-5, 8, 4); wash.target.position.set(0, 5, -3); scene.add(wash, wash.target);
  const violetFill = new THREE.DirectionalLight(P.violet, 0); violetFill.position.set(0, 4, -38); scene.add(violetFill);

  const bgRoom = new THREE.Color('#24546a'), bgNight = tex(256, 512, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#2c58a8'); gr.addColorStop(.55, P.night); gr.addColorStop(1, '#07061a');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  const cam = new THREE.PerspectiveCamera(52, W / H, .05, 200), look = new THREE.Vector3();
  const shot = (t, t0, t1, from, to, lf, lt, e = ease.linear) => {
    const p = e(clamp((t - t0) / (t1 - t0)));
    cam.position.set(lerp(from[0], to[0], p), lerp(from[1], to[1], p), lerp(from[2], to[2], p));
    look.set(lerp(lf[0], lt[0], p), lerp(lf[1], lt[1], p), lerp(lf[2], lt[2], p)); cam.lookAt(look);
  };
  const chunks = captionChunks(clock.words), end = clock.duration + 1.5;

  function buildArcs(t, amount) {
    for (const c of arcs.children) c.geometry.dispose();
    arcs.clear();
    if (amount <= 0) return;
    seed = 1 + Math.floor(t * 15);     // new arcs 15 times a second
    for (let a = 0; a < 3; a++) {
      const pts = [], a0 = rnd() * 6.28, z0 = (rnd() - .5) * .9;
      for (let k = 0; k <= 8; k++) { const ang = a0 + k * .35, rr = .36 + (rnd() - .5) * .14; pts.push(new THREE.Vector3(Math.cos(ang) * rr, Math.sin(ang) * rr, z0 + (rnd() - .5) * .25)); }
      arcs.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, .012 + .01 * amount, 5), M.spark));
    }
  }

  const draw = (g, t) => {
    const twist = t >= T.and2;
    room.visible = !twist; glowSet.visible = twist;
    (twist ? glowSet : room).add(tack);    // Tack appears in both sets
    scene.background = twist ? bgNight : bgRoom;

    // Tack: idle bob, head turns on "read", arms throw up on "works"
    const bob = Math.sin(t * 5) * .015;
    head.rotation.set(0, lerp(.7, -.45, spring(t, T.read, 9, .5)), 0);
    const cheer = spring(t, T.works, 12, .35) * (1 - prog(t, T.works + .8, .4));
    armL.rotation.z = -.5 - cheer * 2.1; armR.rotation.z = .5 + cheer * 2.1;
    key.rotation.z = t * 2.2;

    // lamp flickers on at "hear"
    const lt = t - T.hear, lampOn = lt < 0 ? 0 : lt > .32 ? 1 : (Math.sin(lt * 95) > .1 ? 1 : .15);
    lampLight.intensity = 14 * lampOn; lampGlow.material.opacity = .9 * lampOn; bulbMat.color.set(lampOn > .5 ? P.lamp : '#6b5a3a');

    // nut gives a quarter turn on "works"
    nut.rotation.z = Math.PI / 6 * prog(t, T.works, .5, ease.outCubic);

    // belt runs from "Now"; housing turns to X-ray glass on "sentence"
    const run = Math.max(0, t - T.now);
    hazardTex.offset.x = -run * 3.2; drum.rotation.z = run * 1.4; rotor.rotation.z = -run * 9;
    const xr = prog(t, T.sentence - .05, .35, ease.outCubic);
    M.housing.opacity = 1 - .8 * xr; M.housing.emissive.set(P.xray); M.housing.emissiveIntensity = .5 * xr; M.housing.depthWrite = xr < .5; plate.material = xr > .5 ? M.housing : M.steel; holes.forEach(h => h.visible = xr < .5);
    M.edge.opacity = xr; coilGlow.material.opacity = xr * (.55 + .25 * Math.sin(t * 40));
    buildArcs(t, xr);

    if (!twist) {
      tack.position.set(-.3, bob, .4); tack.rotation.set(0, .25, 0);
      if (t < T.your) shot(t, 0, T.your, [2.2, 5.4, 7.6], [1.7, 4.7, 6.5], [.1, 1.8, -1.4], [0, 1.7, -1.4]);
      else if (t < T.now) shot(t, T.your, T.now, [-.6, 2.1, 2.6], [-1.1, 2.0, 2.1], [-2.8, 1.2, -2], [-2.9, 1.3, -2]);
      else shot(t, T.now, T.and2, [9.4, 5.0, 5.2], [8.8, 4.4, 4.5], [6.4, 2.0, .3], [6.7, 1.8, .3]);
    } else {
      // low angle up at Tack under the ring, which fills toward "one"
      tack.position.set(0, bob, .8); tack.rotation.set(0, 0, 0); head.rotation.set(-.5, 0, 0);
      const fillP = prog(t, T.and2 + .1, T.one2 - T.and2, ease.inOutCubic);
      segs.forEach((s, k) => s.visible = k < Math.round(fillP * SEG));
      ringGlow.material.opacity = .35 + .5 * fillP; glowLight.intensity = 6 + 14 * fillP;
      shot(t, T.and2, end, [.5, .35, 7.4], [.3, .45, 6.6], [0, 2.3, 0], [0, 2.4, 0]);
      cam.position.z += -40; look.z += -40; cam.lookAt(look);
    }
    fill.target.position.copy(look);
    r.render(scene, cam);

    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(canvas, 0, 0);
    // grade: teal shadows, warm highlights, soft vignette
    g.save(); g.globalCompositeOperation = 'soft-light'; g.fillStyle = 'rgba(20,90,110,.35)'; g.fillRect(0, 0, W, H); g.restore();
    const v = g.createRadialGradient(540, 860, 560, 540, 960, 1250);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,10,20,.42)'); g.fillStyle = v; g.fillRect(0, 0, W, H);

    if (twist && t >= T.one2) {          // the number sits inside the ring
      const c = new THREE.Vector3(0, 2.6, -40).project(cam), x = (c.x + 1) / 2 * W, y = (1 - c.y) / 2 * H;
      const p = spring(t, T.one2, 12, .45);
      g.save(); g.translate(x, y); g.scale(.6 + .4 * p, .6 + .4 * p);
      g.font = '700 260px Cap'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.shadowColor = P.magenta; g.shadowBlur = 60; g.fillStyle = '#fff'; g.fillText('1', 0, 10); g.restore();
    }
    zackCaptions(g, t, chunks);
  };
  draw.tail = 1.5;
  return draw;
}

export default { tail: 1.5 };
