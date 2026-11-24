import sys
from PIL import Image
import numpy as np

ref = Image.open(sys.argv[1] if len(sys.argv) > 1 else 'references/approved/winter-shake.png').convert('RGB')
ren = Image.open(sys.argv[2] if len(sys.argv) > 2 else 'out/work/stills/winter-landed-hero-hd-draft-rig.png').convert('RGB')
k = ren.width / ref.width
boxes = {'upper dome': (1000, 180, 1500, 540), 'bank': (1100, 900, 1700, 1050), 'centre': (1250, 500, 1600, 800)}
for name, im, s in (('approved', ref, 1.0), ('build', ren, k)):
    out = [name]
    for b, box in boxes.items():
        a = np.asarray(im.crop(tuple(round(v * s) for v in box))).astype(np.float32)
        out += [b, 'mean', np.round(a.reshape(-1, 3).mean(axis=0)).tolist(), 'spread', round(float(a.mean(axis=2).std()), 1)]
    print(*out)
