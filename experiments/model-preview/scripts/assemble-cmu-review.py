"""Assemble local renderer captures; no downloaded video. Run after capture-cmu-review.cjs."""
from pathlib import Path
from PIL import Image
paths=sorted(Path('outputs/cmu-review').glob('frame-*.png'))
frames=[Image.open(p).convert('RGB') for p in paths]
# GIF timing is quantized to 10ms; preserve the 120Hz source duration to that precision.
indices=[int(p.stem.split('-')[-1]) for p in paths]
duration=[round(min(i+5,167)*100/120)*10-round(i*100/120)*10 for i in indices]
frames[0].save('docs/assets/images/cmu-35-17-preview.gif',save_all=True,
               append_images=frames[1:],duration=duration,loop=0,optimize=True)
