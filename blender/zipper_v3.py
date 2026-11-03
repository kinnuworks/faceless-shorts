# Code Kinnu: "How a Zipper Actually Works" v3, built and rendered in Blender from Python.
# Every frame is a pure function of time: set_state(t) places everything, then the frame is rendered.
#
# usage:
#   Blender -b -P blender/zipper_v3.py -- --slug zipper-v3 [--engine eevee|cycles] [--scale 0.5]
#                                         [--start 0] [--end -1] [--step 1] [--fps 30] [--samples 64]
import bpy, bmesh, json, math, os, sys
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
def arg(name, default):
    return type(default)(argv[argv.index(name) + 1]) if name in argv else default
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
SLUG = arg('--slug', 'zipper-v3')
ENGINE = arg('--engine', 'eevee')
SCALE = arg('--scale', 1.0)
FPS = arg('--fps', 30)
DIR = os.path.join(ROOT, 'shorts', SLUG)
OUT = os.path.join(DIR, 'out', 'frames')
TEX = os.path.join(ROOT, 'assets', 'polyhaven')
os.makedirs(OUT, exist_ok=True)

words = json.load(open(os.path.join(DIR, 'words.json')))
def at(w, n=1):
    k = 0
    for x in words:
        if x['w'].lower().strip("'") == w.lower() and (k := k + 1) == n:
            return x['s']
    raise KeyError(w)
DUR = words[-1]['e'] + 1.0

# ---------------- timing helpers ----------------
def clamp(x, a=0.0, b=1.0): return max(a, min(b, x))
def lerp(a, b, t): return a + (b - a) * t
def inout(t): return 4 * t ** 3 if t < .5 else 1 - (-2 * t + 2) ** 3 / 2
def outc(t): return 1 - (1 - t) ** 3
def outexpo(t): return 1 if t >= 1 else 1 - 2 ** (-10 * t)
def prog(t, t0, d, e=inout): return e(clamp((t - t0) / d))
def keys(t, ks, e=inout):
    if t <= ks[0][0]: return ks[0][1]
    for (t0, v0), (t1, v1) in zip(ks, ks[1:]):
        if t <= t1: return lerp(v0, v1, e((t - t0) / (t1 - t0)))
    return ks[-1][1]
def vlerp(a, b, p): return Vector(a).lerp(Vector(b), p)

T = dict(
    zoom=at('Zoom') - .05, bump=at('bump'), hollow=at('hollow'), push=at('Push') - .05, slide=at('slide'),
    wrong=at('wrong'), secret=at('The', 3) - .05, inside=at('inside'), yshaped=at('Y-shaped'),
    pullup=at('Pull') - .05, up=at('up'), one=at('one', 2), drops=at('drops'), hollow2=at('hollow', 2),
    pulldown=at('Pull', 2) - .05, down=at('down'), apart2=at('apart', 2), now=at('Now') - .05, ykk=at('YKK'),
    company=at('One', 3) - .05, andname=at('And', 6) - .05, rubber=at('rubber'), y1923=at('1923'), zip=at('Zip'),
)

# ---------------- scene ----------------
if bpy.app.background:
    bpy.ops.wm.read_factory_settings(use_empty=True)
else:                                                  # opened in the Blender window: keep the UI, clear the default scene
    for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
sc = bpy.context.scene
sc.render.fps = FPS
sc.render.resolution_x, sc.render.resolution_y = 1080, 1920
sc.render.resolution_percentage = int(SCALE * 100)
sc.render.image_settings.file_format = 'PNG'
sc.view_settings.view_transform = 'AgX'
sc.view_settings.look = 'AgX - Medium High Contrast'
if ENGINE == 'cycles':
    sc.render.engine = 'CYCLES'
    prefs = bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type = 'METAL'; prefs.get_devices()
    for d in prefs.devices: d.use = True
    sc.cycles.device = 'GPU'; sc.cycles.samples = arg('--samples', 64); sc.cycles.use_denoising = True
else:
    for eng in ('BLENDER_EEVEE_NEXT', 'BLENDER_EEVEE'):
        try: sc.render.engine = eng; break
        except TypeError: pass
    ee = sc.eevee
    for attr, val in (('use_raytracing', True), ('taa_render_samples', 32), ('use_shadows', True)):
        if hasattr(ee, attr): setattr(ee, attr, val)

world = bpy.data.worlds.new('World'); sc.world = world; world.use_nodes = True
wn = world.node_tree.nodes; env = wn.new('ShaderNodeTexEnvironment')
env.image = bpy.data.images.load(os.path.join(TEX, 'studio_small_09_2k.hdr'))
bgn = wn['Background']; bgn.inputs['Strength'].default_value = .8
world.node_tree.links.new(env.outputs['Color'], bgn.inputs['Color'])
lp = wn.new('ShaderNodeLightPath'); dark = wn.new('ShaderNodeBackground'); dark.inputs['Color'].default_value = (.008, .012, .02, 1)
mixw = wn.new('ShaderNodeMixShader'); out = wn['World Output']
world.node_tree.links.new(lp.outputs['Is Camera Ray'], mixw.inputs['Fac'])
world.node_tree.links.new(bgn.outputs['Background'], mixw.inputs[1]); world.node_tree.links.new(dark.outputs['Background'], mixw.inputs[2])
world.node_tree.links.new(mixw.outputs['Shader'], out.inputs['Surface'])

def img(name, non_color=False):
    i = bpy.data.images.load(os.path.join(TEX, name))
    if non_color: i.colorspace_settings.name = 'Non-Color'
    return i

def material(name, base=(.8, .8, .8), metallic=0, rough=.5, coat=0, maps=None, uv_scale=1, emit=None, alpha=1):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; n = nt.nodes; L = nt.links; b = n['Principled BSDF']
    b.inputs['Base Color'].default_value = (*base, 1); b.inputs['Metallic'].default_value = metallic
    b.inputs['Roughness'].default_value = rough; b.inputs['Coat Weight'].default_value = coat
    if emit:
        b.inputs['Emission Color'].default_value = (*emit, 1); b.inputs['Emission Strength'].default_value = 0
    if alpha < 1:
        b.inputs['Alpha'].default_value = alpha
        if hasattr(m, 'surface_render_method'): m.surface_render_method = 'BLENDED'
    if maps:
        tc = n.new('ShaderNodeTexCoord'); mp = n.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (uv_scale,) * 3
        L.new(tc.outputs['UV'], mp.inputs['Vector'])
        def tex(file, nc):
            t = n.new('ShaderNodeTexImage'); t.image = img(file, nc); L.new(mp.outputs['Vector'], t.inputs['Vector']); return t
        if 'diff' in maps:
            d = tex(maps['diff'], False); mix = n.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'
            mix.inputs['Factor'].default_value = 1; mix.inputs[6].default_value = (*base, 1)
            bw = n.new('ShaderNodeRGBToBW'); gain = n.new('ShaderNodeMath'); gain.operation = 'MULTIPLY_ADD'
            gain.inputs[1].default_value = .55; gain.inputs[2].default_value = .62
            L.new(d.outputs['Color'], bw.inputs['Color']); L.new(bw.outputs['Val'], gain.inputs[0])
            L.new(gain.outputs['Value'], mix.inputs[7]); L.new(mix.outputs[2], b.inputs['Base Color'])
        if 'rough' in maps:
            r = tex(maps['rough'], True); mr = n.new('ShaderNodeMapRange')
            mr.inputs['To Min'].default_value = rough * .55; mr.inputs['To Max'].default_value = min(1, rough * 1.5)
            L.new(r.outputs['Color'], mr.inputs['Value']); L.new(mr.outputs['Result'], b.inputs['Roughness'])
        if 'nor' in maps:
            nm = tex(maps['nor'], True); nn = n.new('ShaderNodeNormalMap'); nn.inputs['Strength'].default_value = maps.get('nor_strength', 1)
            L.new(nm.outputs['Color'], nn.inputs['Color']); L.new(nn.outputs['Normal'], b.inputs['Normal'])
    return m

brass = material('brass', (.92, .66, .28), 1, .3, .25, {'rough': 'metal_plate_Rough.jpg'}, 3, emit=(1, .1, .05))
chrome = material('chrome', (.9, .91, .93), 1, .16, 0, {'rough': 'metal_plate_Rough.jpg'}, 2.5)
tape_m = material('tape', (.015, .03, .06), 0, .85, 0, {'diff': 'stretch_poplin_Diffuse.jpg', 'rough': 'stretch_poplin_Rough.jpg', 'nor': 'stretch_poplin_nor_gl.jpg'}, 6)
jacket_m = material('jacket', (.06, .075, .1), 0, .9, 0, {'diff': 'caban_Diffuse.jpg', 'rough': 'caban_Rough.jpg', 'nor': 'caban_nor_gl.jpg', 'nor_strength': 1.4}, 1.2)
rubber_m = material('rubber', (.02, .02, .022), 0, .42, .3)
glow = material('glow', (0, 0, 0), 0, .5, emit=(.17, .85, 1.0))
glow.node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value = 12


def prim(kind, name, mat=None, **kw):
    """A cube or cylinder built directly (no operators), so the scene builds the same in the window and in the background."""
    bm = bmesh.new()
    if kind == 'cube': bmesh.ops.create_cube(bm, size=1)
    else: bmesh.ops.create_cone(bm, cap_ends=True, segments=kw.get('vertices', 48), radius1=kw.get('radius', .5), radius2=kw.get('radius', .5), depth=kw.get('depth', 1))
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); sc.collection.objects.link(o)
    if mat: o.data.materials.append(mat)
    return o

def obj(name, mesh, mat=None, parent=None):
    o = bpy.data.objects.new(name, mesh); sc.collection.objects.link(o)
    if mat: o.data.materials.append(mat)
    if parent: o.parent = parent
    return o

# ---- tooth: side profile with a bump on top and a hollow underneath, extruded along the zipper (y) ----
def tooth_mesh(side):
    L, Tk, b, u, D = .23, .075, .07, side * -.12, .15
    prof = [(-L, -Tk)]
    prof += [(u - b * math.cos(a), -Tk + b * math.sin(a)) for a in [i * math.pi / 12 for i in range(13)]]   # hollow
    prof += [(L, -Tk), (L, Tk)]
    prof += [(u + b * math.cos(a), Tk + b * math.sin(a)) for a in [i * math.pi / 12 for i in range(13)]]   # bump
    prof += [(-L, Tk)]
    bm = bmesh.new()
    front = [bm.verts.new((x, 0, z)) for x, z in prof]
    back = [bm.verts.new((x, D, z)) for x, z in prof]
    bm.faces.new(front[::-1]); bm.faces.new(back)
    for i in range(len(prof)):
        j = (i + 1) % len(prof); bm.faces.new((front[i], front[j], back[j], back[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(f'tooth{side}'); bm.to_mesh(me); bm.free()
    return me

def bevel(o, w=.012, seg=3):
    m = o.modifiers.new('bevel', 'BEVEL'); m.width = w; m.segments = seg; m.limit_method = 'ANGLE'
    o.modifiers.new('wn', 'WEIGHTED_NORMAL')

PITCH, N, Y0 = .24, 116, -14
teeth = {}
for side in (-1, 1):
    me = tooth_mesh(side)
    for i in range(N):
        o = obj(f't{side}_{i}', me, brass); teeth[(side, i)] = o
    bevel(teeth[(side, 0)])
    for i in range(1, N):
        for m in teeth[(side, 0)].modifiers:
            nm = teeth[(side, i)].modifiers.new(m.name, m.type)
            if m.type == 'BEVEL': nm.width, nm.segments, nm.limit_method = m.width, m.segments, m.limit_method

# ---- tape + jacket strips (one mesh per side, columns measured outward from the teeth) ----
COLS = [0, .12, .25, .4, .6, .9, 1.3, 1.8, 2.4, 3.2, 4.2, 5.4, 7, 9]
ROWS = [Y0 + i * .1 for i in range(int(28 / .1) + 1)]
TAPE_W = .45
strips = {}
for side in (-1, 1):
    bm = bmesh.new(); grid = []
    for y in ROWS: grid.append([bm.verts.new((0, y, 0)) for _ in COLS])
    uv = bm.loops.layers.uv.new()
    for r in range(len(ROWS) - 1):
        for c in range(len(COLS) - 1):
            vs = (grid[r][c], grid[r][c + 1], grid[r + 1][c + 1], grid[r + 1][c]) if side > 0 else (grid[r][c + 1], grid[r][c], grid[r + 1][c], grid[r + 1][c + 1])
            f = bm.faces.new(vs); f.material_index = 0 if COLS[c] < TAPE_W else 1
            for l in f.loops:
                ci = next(k for k in range(len(COLS)) if grid[r][k] is l.vert or grid[r + 1][k] is l.vert)
                l[uv].uv = (COLS[ci] * .5, l.vert.co.y * .5)
    me = bpy.data.meshes.new(f'strip{side}'); bm.to_mesh(me); bm.free()
    o = obj(f'strip{side}', me); o.data.materials.append(tape_m); o.data.materials.append(jacket_m)
    sub = o.modifiers.new('sub', 'SUBSURF'); sub.levels = sub.render_levels = 1
    so = o.modifiers.new('solid', 'SOLIDIFY'); so.thickness = .06; so.offset = -1
    strips[side] = o
lining = obj('lining', bpy.data.meshes.new('lining'), material('lining', (.05, .05, .06), 0, .95, 0, {'nor': 'caban_nor_gl.jpg'}, 3))
bm = bmesh.new(); bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=20); bm.to_mesh(lining.data); bm.free()
lining.location = (0, 0, -.55)
for poly in lining.data.polygons: poly.use_smooth = True
lining.data.uv_layers.new()
# puffy jacket folds: a displace on the jacket region only (vertex group by column)
for side, o in strips.items():
    vg = o.vertex_groups.new(name='jacket')
    for v in o.data.vertices:
        col = v.index % len(COLS)
        vg.add([v.index], clamp((COLS[col] - .7) / 1.5), 'REPLACE')
    tx = bpy.data.textures.new(f'folds{side}', 'CLOUDS'); tx.noise_scale = 1.4
    d = o.modifiers.new('folds', 'DISPLACE'); d.texture = tx; d.vertex_group = 'jacket'; d.strength = .55; d.texture_coords = 'UV'
    o.modifiers.move(o.modifiers.find('folds'), 0)

# ---- slider: rounded body, pull tab, Y channel, and a cutter that slices it open ----
slider = bpy.data.objects.new('slider', None); sc.collection.objects.link(slider)
body = prim('cube', 'body')
xray = material('xray', (.75, .9, 1), 0, .08, 0, emit=(.17, .85, 1.0))
xb = xray.node_tree.nodes['Principled BSDF']; xb.inputs['Transmission Weight'].default_value = 1; xb.inputs['IOR'].default_value = 1.2
if hasattr(xray, 'surface_render_method'): xray.surface_render_method = 'BLENDED'
body.scale = (1.75, 1.5, .62); body.location = (0, .2, .3); body.parent = slider; body.data.materials.append(chrome)
bv = body.modifiers.new('bevel', 'BEVEL'); bv.width = .2; bv.segments = 8; body.modifiers.new('wn', 'WEIGHTED_NORMAL')
cutter = prim('cube', 'cutter')
cutter.scale = (4, 4, 2); cutter.display_type = 'WIRE'
for attr in ('visible_camera', 'visible_shadow', 'visible_diffuse', 'visible_glossy', 'visible_transmission', 'visible_volume_scatter'):
    setattr(cutter, attr, False)
cutter.data.materials.append(material('invisible', alpha=0))
tab = prim('cube', 'tab')
tab.scale = (.5, 1.7, .12); tab.location = (0, -.95, .72); tab.rotation_euler = (-.3, 0, 0); tab.parent = slider; tab.data.materials.append(chrome)
tb = tab.modifiers.new('bevel', 'BEVEL'); tb.width = .05; tb.segments = 5
hole = prim('cyl', 'tabhole', radius=.13, depth=1, vertices=48)
hole.parent = tab; hole.location = (0, -.32, 0); hole.scale = (1 / .5, 1 / 1.7, 1 / .12 * .5)
for attr in ('visible_camera', 'visible_shadow', 'visible_diffuse', 'visible_glossy', 'visible_transmission', 'visible_volume_scatter'):
    setattr(hole, attr, False)
hb = tab.modifiers.new('hole', 'BOOLEAN'); hb.operation = 'DIFFERENCE'; hb.object = hole; hb.solver = 'EXACT'; tab.modifiers.move(tab.modifiers.find('hole'), 0)
# the Y channel: thin glowing bars inside the body, seen when the body turns to X-ray glass
ybars = []
for (L, x, y, rz) in ((.9, -.3, .4, .62), (.9, .3, .4, -.62), (.7, 0, -.28, 0)):
    b = prim('cube', 'ybar')
    b.scale = (.09, L, .09); b.location = (x, y, .3); b.rotation_euler = (0, 0, rz); b.parent = slider; b.data.materials.append(glow)
    ybars.append(b)

# hero tooth for the close-up, with emissive rings at the bump and the hollow
hero = obj('hero', tooth_mesh(-1), brass); bevel(hero, .01, 4); hero.scale = (6, 6, 6)
def ring(name, z, up):
    curve = bpy.data.curves.new(name, 'CURVE'); curve.dimensions = '3D'; curve.bevel_depth = .006
    sp = curve.splines.new('POLY'); pts = [(.12 + .07 * math.cos(a) * 1.25, .075, z + (.075 * math.sin(a) * 1.25) * (1 if up else -1)) for a in [i * math.pi / 30 for i in range(31)]]
    sp.points.add(len(pts) - 1)
    for p, c in zip(sp.points, pts): p.co = (*c, 1)
    o = bpy.data.objects.new(name, curve); sc.collection.objects.link(o); o.parent = hero; o.data.materials.append(glow); return o
ring_bump, ring_hollow = ring('ring_bump', .075, True), ring('ring_hollow', -.075, False)

# a wall of sliders for "a huge share of the world's zippers"
wall = []
for r in range(14):
    for c in range(8):
        for src in (body, tab):
            o = src.copy(); o.data = src.data; sc.collection.objects.link(o); o.parent = None
            o.location = Vector((40 + c * 2.3 + (r % 2) * 1.15, r * 2.1, 0)) + (src.location if src is tab else Vector((0, .2, .3)))
            o.rotation_euler = src.rotation_euler
            if src is body:
                o.data.materials[0] = chrome
            wall.append(o)

# lights and camera
def area(name, loc, energy, size, color=(1, 1, 1)):
    ld = bpy.data.lights.new(name, 'AREA'); ld.energy = energy; ld.size = size; ld.color = color
    o = bpy.data.objects.new(name, ld); sc.collection.objects.link(o); o.location = loc; return o
key = area('key', (-6, 4, 10), 2200, 6, (1, .95, .88))
rim = area('rim', (7, -6, 4), 900, 3, (.55, .85, 1))
for L in (key, rim):
    c = L.constraints.new('TRACK_TO'); c.target = slider
look = bpy.data.objects.new('look', None); sc.collection.objects.link(look)
camd = bpy.data.cameras.new('cam'); camd.lens = 35; camd.sensor_fit = 'VERTICAL'; camd.sensor_height = 24
camd.dof.use_dof = True; camd.dof.focus_object = look; camd.dof.aperture_fstop = 3.2
cam = bpy.data.objects.new('cam', camd); sc.collection.objects.link(cam); sc.camera = cam
tc = cam.constraints.new('TRACK_TO'); tc.target = look; tc.track_axis = 'TRACK_NEGATIVE_Z'; tc.up_axis = 'UP_Y'

# ---------------- state as a function of time ----------------
def slider_y(t):
    return keys(t, [[0, -9], [1.1, 4], [T['zoom'], 4], [T['zoom'] + .01, -2.4], [T['up'], -2.4], [T['hollow2'], 3.0],
                    [T['down'], 3.0], [T['apart2'] + .3, -2.4], [T['zip'] - .02, -9], [T['zip'] + .4, 4]])

def openness(t, y, sy):
    if T['push'] <= t < T['secret']: return 1.0                       # the open-rows demo has no slider in play
    return clamp((y - sy - .35) / 3.2)

def set_state(t):
    sy = slider_y(t)
    lean = math.sin(math.pi * prog(t, T['push'] + .2, 2.2, lambda x: x)) * .55 if T['push'] <= t < T['secret'] else 0
    for (side, i), o in teeth.items():
        y = Y0 + i * PITCH + (PITCH / 2 if side > 0 else 0); s = openness(t, y, sy)
        o.location = (side * (.12 + s * 1.05 - lean * .7), y, 0)
        o.rotation_euler = (0, side * lean * .5, side * s * .22)
    for side, o in strips.items():
        vs = o.data.vertices; nc = len(COLS)
        for r, y in enumerate(ROWS):
            s = openness(t, y, sy); inner = side * (.3 + s * 1.05 - lean * .7)
            for c, u in enumerate(COLS):
                v = vs[r * nc + c]; v.co.x = inner + side * u; v.co.z = -.12 - (.25 * clamp((u - .5) / 3)) * (1 - s)
        o.data.update()
    rubber = T['andname'] <= t < T['zip']
    for o in strips.values(): o.material_slots[1].material = rubber_m if rubber else jacket_m
    slider.location = (0, sy, 0)
    cut = prog(t, T['inside'], .5) * (1 - prog(t, T['pulldown'], .3))      # slice the slider open, then close it
    body.material_slots[0].material = xray if cut > .5 else chrome     # quick swap on the word, like a scan
    xb.inputs['Alpha'].default_value = .22; xb.inputs['Emission Strength'].default_value = .6 + 1.6 * (1 - prog(t, T['inside'] + .25, .5))
    for b in ybars: b.hide_render = cut < .5
    glow_on = prog(t, T['yshaped'], .4) * (1 - prog(t, T['pulldown'], .3))
    glow.node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value = 1 + 14 * glow_on
    brass.node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value = 2.5 * (1 - prog(t, T['wrong'], .6, outc)) if T['wrong'] <= t < T['secret'] else 0

    heroShot = T['zoom'] + 1.4 <= t < T['push']
    hero.hide_render = not heroShot
    hero.location = (0, 0, 2.2); hero.rotation_euler = (prog(t, T['hollow'] - .15, .7) * 2.6 - .5, 0, .4 + (t - T['zoom']) * .12)
    ring_bump.hide_render = not (heroShot and t >= T['bump'] and t < T['hollow'] + .3)
    ring_hollow.hide_render = not (heroShot and t >= T['hollow'] + .2)
    for o in teeth.values(): o.hide_render = heroShot
    for o in strips.values(): o.hide_render = heroShot
    body.hide_render = tab.hide_render = heroShot

    # ---- camera: one function per shot; small handheld drift everywhere ----
    drift = Vector((math.sin(t * 1.3) * .03, math.sin(t * 1.7 + 1) * .03, 0))
    def shot(t0, t1, p0, p1, l0, l1, e=inout):
        p = e(clamp((t - t0) / (t1 - t0)))
        cam.location = vlerp(p0, p1, p) + drift; look.location = vlerp(l0, l1, p)
    if t < T['zoom']:
        shot(0, T['zoom'], (2.5, -6, 13), (2, -4, 11.5), (0, sy - 1.5, 0), (0, 1.5, 0))
    elif not heroShot and t < T['push']:   # the dive from jacket scale down to the teeth
        shot(T['zoom'], T['zoom'] + 1.4, (2, -4, 11.5), (.6, -3.6, 1.6), (0, 1.5, 0), (0, -2.9, 0), outc)
    elif heroShot:
        shot(T['zoom'] + 1.4, T['push'], (0, -4.5, 7.5), (0, -3.6, 6.4), (0, 0, 2.2), (0, 0, 2.2), lambda x: x)
    elif t < T['secret']:
        shot(T['push'], T['secret'], (-3.2, -7.5, 8.5), (-2.4, -6.5, 7.2), (0, -1, 0), (0, -.5, 0))
    elif t < T['pullup']:
        shot(T['secret'], T['pullup'], (3.6, sy - 6.2, 6.6), (2.4, sy - 4.6, 4.6), (0, sy, .2), (0, sy + .1, .3))
    elif t < T['pulldown']:
        if t < T['drops'] - .4: shot(T['pullup'], T['drops'] - .4, (3.2, sy - 5, 6.4), (2.9, sy - 4.6, 6), (0, sy - .4, 0), (0, sy - .4, 0), lambda x: x)
        else: shot(T['drops'] - .4, T['drops'] + .5, (2.9, sy - 4.6, 6), (1, sy - 3.1, 2.6), (0, sy - .4, 0), (0, sy - 1.5, 0))
    elif t < T['now']:
        shot(T['pulldown'], T['now'], (-3.4, sy - 5.6, 8.2), (-3, sy - 5, 7.4), (0, sy - .4, 0), (0, sy - .4, 0), lambda x: x)
    elif t < T['company']:   # macro on the pull tab, the spot where the brand is stamped
        shot(T['now'], T['company'], (1.4, sy - 4.2, 2.6), (.8, sy - 3.6, 2.0), (0, sy - 1.3, .75), (0, sy - 1.15, .75), lambda x: x)
    elif t < T['andname']:   # pull back across a wall of sliders
        shot(T['company'], T['andname'], (48, 14, 5), (48, 9, 26), (48, 14, 0), (48, 13, 0), outc)
    elif t < T['zip']:
        shot(T['andname'], T['zip'], (-3.6, -8.6, 7.6), (-3, -7.6, 6.6), (0, -2.6, 0), (0, -2.4, 0), lambda x: x)
    else:
        shot(T['zip'], T['zip'] + .45, (-3, -7.6, 6.6), (2, -3, 12), (0, -2.4, 0), (0, 2.5, 0), outexpo)
    camd.dof.aperture_fstop = 1.8 if (heroShot or T['drops'] - .4 <= t < T['pulldown'] or T['now'] <= t < T['company']) else 3.5
    key.data.color = (1, .78, .55) if rubber else (1, .95, .88)

start, end, step = arg('--start', 0), arg('--end', -1), arg('--step', 1)
frames = range(start, (int(DUR * FPS) if end == -1 else end) + 1, step)   # --end -2 builds the scene and renders nothing
for f in frames:
    set_state(f / FPS)
    sc.render.filepath = os.path.join(OUT, f'{f:04d}.png')
    bpy.ops.render.render(write_still=True)
    print(f'frame {f} done', flush=True)
json.dump({'fps': FPS, 'frames': int(DUR * FPS) + 1, 'duration': DUR}, open(os.path.join(DIR, 'out', 'frames.json'), 'w'))
