"""Generate two MPFB variants from the saved original; never save the .blend.

Run with Blender --background --factory-startup --disable-autoexec
--python export_variants.py. Requires the installed MPFB extension.
"""
from pathlib import Path
import hashlib
import json
import runpy
import bpy

root = Path(__file__).resolve().parents[2]
source = root / 'data/processed/makehuman/runner-test.blend'
source_hash = hashlib.sha256(source.read_bytes()).hexdigest()
bpy.ops.preferences.addon_enable(module='bl_ext.user_default.mpfb')
from bl_ext.user_default.mpfb.entities.objectproperties import HumanObjectProperties
from bl_ext.user_default.mpfb.services.targetservice import TargetService
from bl_ext.user_default.mpfb.services.rigservice import RigService

for name, gender in [('male', 1.0), ('female', 0.0)]:
    bpy.ops.wm.open_mainfile(filepath=str(source))
    body = bpy.data.objects['Human']
    rig = body.find_armature()
    HumanObjectProperties.set_value('gender', gender, entity_reference=body)
    bpy.context.view_layer.objects.active = body
    body.select_set(True)
    TargetService.reapply_macro_details(body)
    RigService.refit_existing_armature(rig, body)
    bpy.context.view_layer.update()
    phenotype = TargetService.get_macro_info_dict_from_basemesh(body)
    runpy.run_path(str(Path(__file__).with_name('export_runner.py')), init_globals={
        'export_name': 'runner-' + name,
        'variant_info': {'model_type': name, 'mpfb_gender': gender,
                         'macro_settings': phenotype, 'rig_refitted': True},
    })

assert source_hash == hashlib.sha256(source.read_bytes()).hexdigest(), 'Source changed'
print('VARIANTS_COMPLETE original_unchanged=' + source_hash)
