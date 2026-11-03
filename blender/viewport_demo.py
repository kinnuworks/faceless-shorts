# Opens a Blender scene in the normal Blender window and performs it for a screen recording:
# material-preview viewport, the timeline playing through the story, and a slow orbit of the view.
#
# usage: Blender --window-geometry X Y W H -P blender/viewport_demo.py -- --slug zipper-v3 --scene zipper_v3 [--seconds 24]
import bpy, math, os, runpy, sys

argv = sys.argv[sys.argv.index('--') + 1:]
def arg(k, d): return type(d)(argv[argv.index(k) + 1]) if k in argv else d
here = os.path.dirname(__file__)
scene_file = os.path.join(here, arg('--scene', 'zipper_v3') + '.py')
sys.argv = [sys.argv[0], '--', '--slug', arg('--slug', 'zipper-v3'), '--end', '-2', '--scale', '0.5']
g = {}
def build():                                          # runs once the window is up, so operators have a context
    g.update(runpy.run_path(scene_file))              # builds the scene, renders nothing
    sc = bpy.context.scene
    sc.frame_start, sc.frame_end = 1, int(g['DUR'] * 30)
    bpy.app.handlers.frame_change_post.append(lambda s, d=None: g['set_state'](s.frame_current / 30))
    return None
bpy.app.timers.register(build, first_interval=.5)

def view3d():
    for win in bpy.context.window_manager.windows:
        for area in win.screen.areas:
            if area.type == 'VIEW_3D':
                return win, area, area.spaces.active
    return None, None, None

state = {'t0': None, 'yaw': 0.0}
def setup():
    win, area, space = view3d()
    if not space: return .5
    space.shading.type = 'MATERIAL'
    space.overlay.show_floor = False; space.overlay.show_axis_x = space.overlay.show_axis_y = False
    r3d = space.region_3d
    r3d.view_location = (0, -1.5, 0); r3d.view_distance = 13
    r3d.view_rotation = (0.92, 0.36, 0.06, 0.12)
    sc = bpy.context.scene
    sc.frame_set(int(9.2 * 30))                     # start on the slider shot
    with bpy.context.temp_override(window=win, area=area):
        bpy.ops.screen.animation_play()
    bpy.app.timers.register(orbit, first_interval=.05)
    return None

def orbit():
    _, _, space = view3d()
    if not space: return None
    r3d = space.region_3d
    from mathutils import Quaternion
    r3d.view_rotation = Quaternion((0, 0, 1), math.radians(.12)) @ r3d.view_rotation
    r3d.view_distance = max(7.5, r3d.view_distance - .006)
    return 1 / 60

bpy.app.timers.register(setup, first_interval=4.0)
def quit():
    bpy.ops.wm.quit_blender(); return None
bpy.app.timers.register(quit, first_interval=arg('--seconds', 24) + 6)
