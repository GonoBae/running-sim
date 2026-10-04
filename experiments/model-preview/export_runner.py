"""Export the user's saved MPFB model without changing the input .blend.

Run using Blender --background --factory-startup --disable-autoexec input.blend
--python export_runner.py. The script validates hm08 topology before cleaning.
"""
from pathlib import Path
import hashlib
import json
import bpy
import bmesh

root = Path(__file__).resolve().parents[2]
source_blend = Path(bpy.data.filepath)
source_obj = root / 'data/raw/makehuman/mpfb-2.0.17/data/3dobjs/base.obj'
export_name = globals().get('export_name', 'runner-test')
if export_name not in ('runner-test', 'runner-male', 'runner-female'):
    raise RuntimeError('Unsupported export name')
output = root / ('experiments/model-preview/public/models/' + export_name + '.glb')
output.parent.mkdir(parents=True, exist_ok=True)
body = bpy.data.objects.get('Human')
if body is None or body.type != 'MESH':
    raise RuntimeError('Expected the saved MPFB Human mesh.')
rig = body.find_armature()
if rig is None:
    raise RuntimeError('The Human mesh has no connected armature.')
if bpy.context.object and bpy.context.object.mode != 'OBJECT':
    bpy.ops.object.mode_set(mode='OBJECT')
body_indices = set()
body_faces = []
group = ''
all_faces = 0
vertex_count = 0
for line in source_obj.read_text(encoding='utf-8').splitlines():
    if line.startswith('v '):
        vertex_count += 1
    elif line.startswith('g '):
        group = line[2:]
    elif line.startswith('f '):
        all_faces += 1
        if group == 'body':
            indices = tuple(int(token.split('/')[0]) - 1 for token in line.split()[1:])
            body_indices.update(indices)
            body_faces.append(indices)
if len(body.data.vertices) != vertex_count or len(body.data.polygons) != all_faces:
    raise RuntimeError('Saved mesh topology differs from the hm08 source; refusing index-based cleanup.')
for polygon, expected in zip(body.data.polygons, body_faces):
    if set(polygon.vertices) != set(expected):
        raise RuntimeError('Body face indices differ from source; cleanup stopped.')
keys_before = [(k.name, k.value) for k in body.data.shape_keys.key_blocks]
if any(p.matrix_basis.to_quaternion().angle > 1e-5 for p in rig.pose.bones):
    raise RuntimeError('Save a neutral pose before exporting this test model.')

bpy.ops.object.select_all(action='DESELECT')
body.hide_set(False)
body.select_set(True)
bpy.context.view_layer.objects.active = body
for modifier in list(body.modifiers):
    if modifier.type == 'MASK':
        body.modifiers.remove(modifier)
    elif modifier.type != 'ARMATURE':
        raise RuntimeError('Unexpected mesh modifier: ' + modifier.type)
# Edit-mode deletion updates every shape key while removing only helper vertices.
bpy.ops.object.mode_set(mode='EDIT')
bpy.context.tool_settings.mesh_select_mode = (True, False, False)
bpy.ops.mesh.select_all(action='DESELECT')
edit_mesh = bmesh.from_edit_mesh(body.data)
edit_mesh.verts.ensure_lookup_table()
for vertex in edit_mesh.verts:
    vertex.select_set(vertex.index not in body_indices)
bmesh.update_edit_mesh(body.data)
bpy.ops.mesh.delete(type='VERT')
bpy.ops.object.mode_set(mode='OBJECT')
assert len(body.data.vertices) == len(body_indices), (len(body.data.vertices), len(body_indices))
assert len(body.data.polygons) == len(body_faces)
keys_after = [(k.name, k.value) for k in body.data.shape_keys.key_blocks]
assert keys_before == keys_after
for key in body.data.shape_keys.key_blocks:
    assert len(key.data) == len(body_indices)
for face in body.data.polygons:
    face.use_smooth = True
if not body.data.materials:
    material = bpy.data.materials.new('Neutral inspection material')
    material.diffuse_color = (0.43, 0.46, 0.42, 1)
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = material.diffuse_color
    bsdf.inputs['Roughness'].default_value = 0.76
    body.data.materials.append(material)
rig.hide_set(False)
rig.select_set(True)
bpy.context.view_layer.update()
result = bpy.ops.export_scene.gltf(
    filepath=str(output), export_format='GLB', use_selection=True,
    export_apply=False, export_skins=True, export_morph=True,
    export_morph_normal=True, export_animations=False,
    export_materials='EXPORT', export_rest_position_armature=True,
    export_cameras=False, export_lights=False,
)
assert result == {'FINISHED'} and output.is_file()
report = {
    'source_blend': str(source_blend),
    'source_sha256': hashlib.sha256(source_blend.read_bytes()).hexdigest(),
    'output_glb': str(output.relative_to(root)).replace('\\', '/'),
    'glb_sha256': hashlib.sha256(output.read_bytes()).hexdigest(),
    'bytes': output.stat().st_size, 'body_vertices': len(body.data.vertices),
    'body_faces': len(body.data.polygons), 'bones': len(rig.data.bones),
    'shape_keys': [{'name': name, 'value': value} for name, value in keys_after[1:]],
    'changes': ['removed helper geometry', 'smooth surface normals', 'neutral material for inspection'],
    'skin_influence_limit': 4,
    'variant': globals().get('variant_info'),
    'limitations': ['no running animation', 'no skin textures or clothing', 'morph values are internal targets, not centimeters or kilograms', 'runtime morph edits do not refit the skeleton', 'skinning keeps at most four strongest influences per vertex and normalizes them; full Blender deformation equivalence is unverified'],
}
(output.with_suffix('.export.json')).write_text(json.dumps(report, indent=2, ensure_ascii=False)+'\n', encoding='utf-8')
print(json.dumps(report, ensure_ascii=False))
