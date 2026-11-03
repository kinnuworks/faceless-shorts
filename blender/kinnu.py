# Code Kinnu Blender kit: the shared parts every Blender Short uses, so a new topic only writes its own scene.
# A scene file imports this, builds its objects, defines set_state(t) and calls render(set_state).
# Every frame is a pure function of time: set_state(t) places everything, then the frame is rendered.
#
# A scene is run like:
#   Blender -b -P blender/<scene>.py -- --slug <slug> [--engine eevee|cycles] [--scale 0.5]
#                                       [--start 0] [--end -1] [--step 1] [--samples 64]
#   --end -1 renders to the end; --end -2 builds the scene and renders nothing (for checks).
import bpy, json, math, os, sys
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
def arg(name, default):
    return type(default)(argv[argv.index(name) + 1]) if name in argv else default

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
SLUG = arg('--slug', '')
FPS = arg('--fps', 30)
DIR = os.path.join(ROOT, 'shorts', SLUG)
OUT = os.path.join(DIR, 'out', 'frames')
TEX = os.path.join(ROOT, 'assets', 'polyhaven')

# ---------------- words: every event is placed on a spoken word ----------------
words = json.load(open(os.path.join(DIR, 'words.json'))) if SLUG else []
def at(w, n=1):
    """Start time of the nth time `w` is spoken. Name the count: at('and', 6), never just at('and')."""
    k = 0
    for x in words:
        if x['w'].lower().strip("'") == w.lower() and (k := k + 1) == n:
            return x['s']
    raise KeyError(f'"{w}" #{n} is not in the narration')
DUR = (words[-1]['e'] + 1.0) if words else 0

# ---------------- timing ----------------
def clamp(x, a=0.0, b=1.0): return max(a, min(b, x))
def lerp(a, b, t): return a + (b - a) * t
def inout(t): return 4 * t ** 3 if t < .5 else 1 - (-2 * t + 2) ** 3 / 2
def outc(t): return 1 - (1 - t) ** 3
def outexpo(t): return 1 if t >= 1 else 1 - 2 ** (-10 * t)
def linear(t): return t
def prog(t, t0, d, e=inout): return e(clamp((t - t0) / d))
def keys(t, ks, e=inout):
    if t <= ks[0][0]: return ks[0][1]
    for (t0, v0), (t1, v1) in zip(ks, ks[1:]):
        if t <= t1: return lerp(v0, v1, e((t - t0) / (t1 - t0)))
    return ks[-1][1]
def vlerp(a, b, p): return Vector(a).lerp(Vector(b), p)

# ---------------- scene setup ----------------
def setup(engine=None, scale=None, hdri='studio_small_09_2k.hdr', light=.8, backdrop=(.008, .012, .02)):
    """Empty 1080x1920 scene, AgX colour, HDRI light. The camera sees a dark backdrop instead of the studio."""
    engine = engine or arg('--engine', 'eevee'); scale = scale or arg('--scale', 1.0)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.fps = FPS
    sc.render.resolution_x, sc.render.resolution_y = 1080, 1920
    sc.render.resolution_percentage = int(scale * 100)
    sc.render.image_settings.file_format = 'PNG'
    sc.view_settings.view_transform = 'AgX'
    sc.view_settings.look = 'AgX - Medium High Contrast'
    if engine == 'cycles':
        sc.render.engine = 'CYCLES'
        prefs = bpy.context.preferences.addons['cycles'].preferences
        prefs.compute_device_type = 'METAL' if sys.platform == 'darwin' else 'CUDA'; prefs.get_devices()
        for d in prefs.devices: d.use = True
        sc.cycles.device = 'GPU'; sc.cycles.samples = arg('--samples', 64); sc.cycles.use_denoising = True
    else:
        for eng in ('BLENDER_EEVEE_NEXT', 'BLENDER_EEVEE'):
            try: sc.render.engine = eng; break
            except TypeError: pass
        for attr, val in (('use_raytracing', True), ('taa_render_samples', 32), ('use_shadows', True)):
            if hasattr(sc.eevee, attr): setattr(sc.eevee, attr, val)
    world = bpy.data.worlds.new('World'); sc.world = world; world.use_nodes = True
    nt = world.node_tree; n = nt.nodes
    env = n.new('ShaderNodeTexEnvironment'); env.image = bpy.data.images.load(os.path.join(TEX, hdri))
    bg = n['Background']; bg.inputs['Strength'].default_value = light
    nt.links.new(env.outputs['Color'], bg.inputs['Color'])
    lp = n.new('ShaderNodeLightPath'); dark = n.new('ShaderNodeBackground'); dark.inputs['Color'].default_value = (*backdrop, 1)
    mix = n.new('ShaderNodeMixShader')
    nt.links.new(lp.outputs['Is Camera Ray'], mix.inputs['Fac'])
    nt.links.new(bg.outputs['Background'], mix.inputs[1]); nt.links.new(dark.outputs['Background'], mix.inputs[2])
    nt.links.new(mix.outputs['Shader'], n['World Output'].inputs['Surface'])
    return sc

def material(name, base=(.8, .8, .8), metallic=0, rough=.5, coat=0, maps=None, uv_scale=1, emit=None, alpha=1):
    """Principled material. maps = {'diff','rough','nor'} files in assets/polyhaven. Diffuse maps only add
    detail (greyscale): the colour always comes from `base`, so a texture never brings its own colour."""
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
            t = n.new('ShaderNodeTexImage'); t.image = bpy.data.images.load(os.path.join(TEX, file))
            if nc: t.image.colorspace_settings.name = 'Non-Color'
            L.new(mp.outputs['Vector'], t.inputs['Vector']); return t
        if 'diff' in maps:
            d = tex(maps['diff'], False); bw = n.new('ShaderNodeRGBToBW'); g = n.new('ShaderNodeMath'); g.operation = 'MULTIPLY_ADD'
            g.inputs[1].default_value = .55; g.inputs[2].default_value = .62
            mix = n.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'; mix.inputs['Factor'].default_value = 1
            mix.inputs[6].default_value = (*base, 1)
            L.new(d.outputs['Color'], bw.inputs['Color']); L.new(bw.outputs['Val'], g.inputs[0])
            L.new(g.outputs['Value'], mix.inputs[7]); L.new(mix.outputs[2], b.inputs['Base Color'])
        if 'rough' in maps:
            r = tex(maps['rough'], True); mr = n.new('ShaderNodeMapRange')
            mr.inputs['To Min'].default_value = rough * .55; mr.inputs['To Max'].default_value = min(1, rough * 1.5)
            L.new(r.outputs['Color'], mr.inputs['Value']); L.new(mr.outputs['Result'], b.inputs['Roughness'])
        if 'nor' in maps:
            nm = tex(maps['nor'], True); nn = n.new('ShaderNodeNormalMap'); nn.inputs['Strength'].default_value = maps.get('nor_strength', 1)
            L.new(nm.outputs['Color'], nn.inputs['Color']); L.new(nn.outputs['Normal'], b.inputs['Normal'])
    return m

def obj(name, mesh, mat=None, parent=None):
    o = bpy.data.objects.new(name, mesh); bpy.context.scene.collection.objects.link(o)
    if mat: o.data.materials.append(mat)
    if parent: o.parent = parent
    return o

def hide_from_rays(o):
    """Keeps an object in the render (so booleans etc. still use it) but invisible to the camera and light."""
    for attr in ('visible_camera', 'visible_shadow', 'visible_diffuse', 'visible_glossy', 'visible_transmission', 'visible_volume_scatter'):
        setattr(o, attr, False)

def area(name, loc, energy, size, color=(1, 1, 1), target=None):
    ld = bpy.data.lights.new(name, 'AREA'); ld.energy = energy; ld.size = size; ld.color = color
    o = bpy.data.objects.new(name, ld); bpy.context.scene.collection.objects.link(o); o.location = loc
    if target:
        c = o.constraints.new('TRACK_TO'); c.target = target
    return o

class Camera:
    """A camera that looks at a target empty, with a little handheld drift and depth of field focused on the target."""
    def __init__(self, lens=35, fstop=3.2, drift=.03):
        sc = bpy.context.scene
        self.look = bpy.data.objects.new('look', None); sc.collection.objects.link(self.look)
        self.data = bpy.data.cameras.new('cam'); self.data.lens = lens; self.data.sensor_fit = 'VERTICAL'; self.data.sensor_height = 24
        self.data.dof.use_dof = True; self.data.dof.focus_object = self.look; self.data.dof.aperture_fstop = fstop
        self.ob = bpy.data.objects.new('cam', self.data); sc.collection.objects.link(self.ob); sc.camera = self.ob
        tc = self.ob.constraints.new('TRACK_TO'); tc.target = self.look; tc.track_axis = 'TRACK_NEGATIVE_Z'; tc.up_axis = 'UP_Y'
        self.drift = drift
    def shot(self, t, t0, t1, p0, p1, l0, l1, e=inout):
        """Move from position p0 → p1 while looking from l0 → l1, between t0 and t1."""
        p = e(clamp((t - t0) / (t1 - t0)))
        d = Vector((math.sin(t * 1.3) * self.drift, math.sin(t * 1.7 + 1) * self.drift, 0))
        self.ob.location = vlerp(p0, p1, p) + d; self.look.location = vlerp(l0, l1, p)

def render(set_state):
    """Render every frame (or --start/--end/--step) of the Short, then write out/frames.json for the overlay layer."""
    os.makedirs(OUT, exist_ok=True)
    sc = bpy.context.scene
    start, end, step = arg('--start', 0), arg('--end', -1), arg('--step', 1)
    total = int(DUR * FPS)
    for f in range(start, (total if end == -1 else end) + 1, step):
        set_state(f / FPS)
        sc.render.filepath = os.path.join(OUT, f'{f:04d}.png')
        bpy.ops.render.render(write_still=True)
        print(f'frame {f} done', flush=True)
    json.dump({'fps': FPS, 'frames': total + 1, 'duration': DUR}, open(os.path.join(DIR, 'out', 'frames.json'), 'w'))
