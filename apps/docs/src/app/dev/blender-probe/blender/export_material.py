# Exports one Blender material for the /dev/blender-probe route: its node
# graph as JSON, a flat reference render of the color it feeds a Principled
# BSDF's Base Color, and a lit render for context. The probe rebuilds the
# graph in TSL from the JSON and compares its canvas with the reference.
#
#   /Applications/Blender.app/Contents/MacOS/Blender --background \
#     --factory-startup --disable-autoexec <file.blend> \
#     --python export_material.py -- \
#     --material "Polished Jade Marble" --name green-marble --out <dir>
#
# --factory-startup keeps add-ons out of the run, and --disable-autoexec keeps
# any script saved in the .blend from running.

import argparse
import json
import math
import os
import re
import sys

import bpy

# ----------------------------------------------------------------------------
# Arguments
# ----------------------------------------------------------------------------

parser = argparse.ArgumentParser()
parser.add_argument('--material', required=True)
parser.add_argument('--name', required=True, help='file stem for the outputs')
parser.add_argument('--out', required=True, help='output folder')
# Edge of the square reference render in pixels. The probe draws its canvas
# at the same number of device pixels, so the two line up pixel for pixel.
parser.add_argument('--size', type=int, default=1024)
# Samples for the lit context render. The reference always takes one.
parser.add_argument('--lit-samples', type=int, default=128)
parser.add_argument('--skip-lit', action='store_true')
# Render one node's output instead of the Base Color, to find which node a
# mismatch starts at. The path names the group nodes to open from the
# material's tree, then the node and its output: "Group/Noise Texture:Color".
# The render goes to <name>@<slug>.reference.png, the slug as tapSlug in
# graph/tap.ts makes it, and the lit render is skipped.
parser.add_argument('--tap')
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1 :])

os.makedirs(args.out, exist_ok=True)
material = bpy.data.materials[args.material]

# ----------------------------------------------------------------------------
# Graph export
# ----------------------------------------------------------------------------

# RNA properties that only describe the editor, never the math.
UI_PROPS = {
    'rna_type', 'name', 'label', 'location', 'location_absolute', 'width',
    'height', 'dimensions', 'inputs', 'outputs', 'internal_links', 'parent',
    'select', 'show_options', 'show_preview', 'hide', 'mute', 'show_texture',
    'use_custom_color', 'color', 'color_tag', 'width_hidden', 'bl_idname',
    'bl_label', 'bl_description', 'bl_icon', 'bl_static_type',
    'bl_width_default', 'bl_width_min', 'bl_width_max', 'bl_height_default',
    'bl_height_min', 'bl_height_max', 'type', 'warning_propagation',
}


def plain(value):
    """A socket or property value as JSON: a number, a string, or a list."""
    if isinstance(value, (bool, int, str)):
        return value
    if isinstance(value, float):
        return value
    try:
        return [plain(v) for v in value]
    except TypeError:
        return None


def export_node(node):
    props = {}
    for prop in node.bl_rna.properties:
        if prop.identifier in UI_PROPS:
            continue
        if prop.type not in {'BOOLEAN', 'INT', 'FLOAT', 'STRING', 'ENUM'}:
            continue
        value = getattr(node, prop.identifier, None)
        if prop.type == 'ENUM' and prop.is_enum_flag:
            value = sorted(value)
        props[prop.identifier] = plain(value)
    if node.bl_idname == 'ShaderNodeValToRGB':
        ramp = node.color_ramp
        props['ramp'] = {
            'color_mode': ramp.color_mode,
            'interpolation': ramp.interpolation,
            'hue_interpolation': ramp.hue_interpolation,
            'elements': [
                {'position': e.position, 'color': plain(e.color)} for e in ramp.elements
            ],
        }
    if node.bl_idname == 'ShaderNodeGroup':
        props['group'] = node.node_tree.name if node.node_tree else None
    if node.bl_idname == 'ShaderNodeTexCoord':
        # Object coordinates relative to another object, when set.
        props['object'] = node.object.name if node.object else None

    def socket(s):
        entry = {'id': s.identifier, 'name': s.name, 'type': s.type, 'enabled': s.enabled}
        if hasattr(s, 'default_value'):
            entry['default'] = plain(s.default_value)
        return entry

    return {
        'name': node.name,
        'type': node.bl_idname,
        'mute': node.mute,
        'props': props,
        'inputs': [socket(s) for s in node.inputs],
        'outputs': [socket(s) for s in node.outputs],
    }


def export_tree(tree):
    return {
        'nodes': [export_node(n) for n in tree.nodes if n.bl_idname != 'NodeFrame'],
        'links': [
            {
                'from': link.from_node.name,
                'fromSocket': link.from_socket.identifier,
                'to': link.to_node.name,
                'toSocket': link.to_socket.identifier,
            }
            for link in tree.links
            if link.is_valid and not link.is_muted
        ],
    }


def collect_groups(tree, found):
    for node in tree.nodes:
        if node.bl_idname == 'ShaderNodeGroup' and node.node_tree:
            if node.node_tree.name not in found:
                found[node.node_tree.name] = node.node_tree
                collect_groups(node.node_tree, found)
    return found


# ----------------------------------------------------------------------------
# Find the Base Color tap
# ----------------------------------------------------------------------------
# The probe renders the color a Principled BSDF takes as its Base Color. The
# BSDF can sit inside nested groups, so the tap records the group nodes to
# open on the way down, from the material's own tree.


def find_principled(tree, path):
    for node in tree.nodes:
        if node.bl_idname == 'ShaderNodeBsdfPrincipled' and not node.mute:
            return path, node
    for node in tree.nodes:
        if node.bl_idname == 'ShaderNodeGroup' and node.node_tree and not node.mute:
            found = find_principled(node.node_tree, path + [node.name])
            if found:
                return found
    return None


group_path, principled = find_principled(material.node_tree, [])

graph = {
    'blender': bpy.app.version_string,
    # The space every color in the graph is in, which sets the luma weights.
    'workingSpace': bpy.data.colorspace.working_space,
    'material': material.name,
    'tap': {'groupPath': group_path, 'node': principled.name, 'socket': 'Base Color'},
    'root': export_tree(material.node_tree),
    'groups': {
        name: export_tree(tree)
        for name, tree in collect_groups(material.node_tree, {}).items()
    },
}

with open(os.path.join(args.out, f'{args.name}.graph.json'), 'w') as f:
    json.dump(graph, f, indent=1)

# ----------------------------------------------------------------------------
# Lit context render
# ----------------------------------------------------------------------------
# The material as the file shows it: the file's own scene, light, and view
# transform, through a camera this script adds in front of the object. The
# probe shows it beside the comparison, because lighting is not part of what
# the TSL port reproduces.

source_scene = bpy.context.scene
target = next(o for o in source_scene.objects if material.name in [s.material.name for s in o.material_slots if s.material])

if not args.skip_lit and not args.tap:
    camera_data = bpy.data.cameras.new('ProbeLitCamera')
    camera_data.lens = 50
    camera = bpy.data.objects.new('ProbeLitCamera', camera_data)
    source_scene.collection.objects.link(camera)
    radius = max(target.dimensions) / 2
    # Far enough back that the object fills about 80% of a 36mm sensor at 50mm.
    distance = radius * 50 / (36 * 0.4)
    camera.location = target.location.copy()
    camera.location.y -= distance
    camera.rotation_euler = (math.pi / 2, 0, 0)
    source_scene.camera = camera
    source_scene.render.resolution_x = args.size
    source_scene.render.resolution_y = args.size
    source_scene.render.resolution_percentage = 100
    source_scene.cycles.samples = args.lit_samples
    source_scene.render.image_settings.file_format = 'JPEG'
    source_scene.render.image_settings.quality = 90
    source_scene.render.filepath = os.path.join(args.out, f'{args.name}.lit.jpg')
    bpy.ops.render.render(write_still=True, scene=source_scene.name)

# ----------------------------------------------------------------------------
# Base Color reference render
# ----------------------------------------------------------------------------
# Route the Base Color through an Emission shader up to the material output.
# A camera ray that hits an emission surface returns its color exactly, so
# the render is the graph's color with no lighting, shading, or bounce.


def tree_at(path):
    tree = material.node_tree
    nodes = []
    for name in path:
        nodes.append((tree, tree.nodes[name]))
        tree = tree.nodes[name].node_tree
    return tree, nodes


def find_socket(sockets, key):
    return next(s for s in sockets if s.identifier == key or s.name == key)


if args.tap:
    *tap_groups, tap_target = args.tap.split('/')
    tap_node_name, tap_output = tap_target.split(':')
    tap_tree, parents = tree_at(tap_groups)
    source = find_socket(tap_tree.nodes[tap_node_name].outputs, tap_output)
else:
    tap_tree, parents = tree_at(group_path)
    base_color = principled.inputs['Base Color']
    source = base_color.links[0].from_socket if base_color.is_linked else None

emission = tap_tree.nodes.new('ShaderNodeEmission')
emission.inputs['Strength'].default_value = 1.0
if source:
    tap_tree.links.new(source, emission.inputs['Color'])
else:
    emission.inputs['Color'].default_value = base_color.default_value

# Carry the emission out through each group: a new shader output on the
# group's interface, linked from inside, read from the group node outside.
shader_out = emission.outputs['Emission']
tree = tap_tree
for parent_tree, group_node in reversed(parents):
    item = tree.interface.new_socket('ProbeEmission', in_out='OUTPUT', socket_type='NodeSocketShader')
    group_output = next(n for n in tree.nodes if n.bl_idname == 'NodeGroupOutput' and n.is_active_output)
    tree.links.new(shader_out, group_output.inputs[item.identifier])
    shader_out = group_node.outputs[item.identifier]
    tree = parent_tree

material_output = next(
    n for n in material.node_tree.nodes if n.bl_idname == 'ShaderNodeOutputMaterial' and n.is_active_output
)
material.node_tree.links.new(shader_out, material_output.inputs['Surface'])
for link in list(material_output.inputs['Displacement'].links):
    material.node_tree.links.remove(link)

# A fresh scene, so nothing from the file's render settings leaks in.
scene = bpy.data.scenes.new('ProbeReference')
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 1
scene.cycles.use_adaptive_sampling = False
scene.cycles.use_denoising = False
scene.cycles.seed = 0
scene.cycles.max_bounces = 0
# A 0.01px filter puts the single sample within 0.005px of the pixel center,
# where the probe's fragment shader samples too.
scene.cycles.filter_width = 0.01
scene.render.resolution_x = args.size
scene.render.resolution_y = args.size
scene.render.resolution_percentage = 100
scene.render.dither_intensity = 0
scene.render.film_transparent = False
# Standard is the plain sRGB transfer, the same one the probe's output stage
# applies. Filmic or AgX would tone-map the color first.
scene.display_settings.display_device = 'sRGB'
scene.view_settings.view_transform = 'Standard'
scene.view_settings.look = 'None'
scene.view_settings.exposure = 0
scene.view_settings.gamma = 1
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGB'
scene.render.image_settings.color_depth = '8'
scene.render.image_settings.compression = 100

# A 2x2 plane through the object's origin, so Object coordinates run -1..1
# across the frame, the range the sphere's own surface spans.
mesh = bpy.data.meshes.new('ProbePlane')
mesh.from_pydata([(-1, -1, 0), (1, -1, 0), (1, 1, 0), (-1, 1, 0)], [], [(0, 1, 2, 3)])
mesh.materials.append(material)
plane = bpy.data.objects.new('ProbePlane', mesh)
scene.collection.objects.link(plane)

camera_data = bpy.data.cameras.new('ProbeCamera')
camera_data.type = 'ORTHO'
camera_data.ortho_scale = 2
camera = bpy.data.objects.new('ProbeCamera', camera_data)
camera.location = (0, 0, 5)
scene.collection.objects.link(camera)
scene.camera = camera

if args.tap:
    slug = re.sub(r'[^A-Za-z0-9]+', '-', args.tap).strip('-').lower()
    reference_name = f'{args.name}@{slug}.reference.png'
else:
    reference_name = f'{args.name}.reference.png'
scene.render.filepath = os.path.join(args.out, reference_name)
bpy.ops.render.render(write_still=True, scene=scene.name)

# The probe lists every export in the folder from this index.
names = sorted(f[: -len('.graph.json')] for f in os.listdir(args.out) if f.endswith('.graph.json'))
with open(os.path.join(args.out, 'index.json'), 'w') as f:
    json.dump(names, f)
