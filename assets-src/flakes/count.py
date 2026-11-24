import sys
from PIL import Image
import numpy as np
from scipy import ndimage as ndi

ref = Image.open(sys.argv[1] if len(sys.argv) > 1 else 'references/approved/winter-rest.png').convert('RGB')
ren = Image.open(sys.argv[2] if len(sys.argv) > 2 else 'out/work/stills/winter-rest-hero-hd-draft-rig.png').convert('RGB')
box = tuple(int(v) for v in sys.argv[3].split(',')) if len(sys.argv) > 3 else (1000, 230, 1420, 530)
k = ren.width / ref.width


def stats(name, im, scale):
    a = np.asarray(im).astype(np.float32)
    lum = a.mean(axis=2)
    back = ndi.median_filter(lum, size=max(3, int(41 * scale) | 1))
    d = lum - back
    out = [name, 'median', np.round(np.median(a.reshape(-1, 3), axis=0)).tolist()]
    for th in (12, 30, 60):
        lab, n = ndi.label(d > th)
        sizes = ndi.sum(np.ones_like(lab), lab, range(1, n + 1)) if n else np.array([])
        diam = 2 * np.sqrt(sizes / np.pi) / scale if n else np.array([])
        spread = [round(float(v), 1) for v in (np.percentile(diam, 50), np.percentile(diam, 90), diam.max())] if n else []
        out += [f'over {th}: blobs', n, 'cover', round(float((d > th).mean()), 4), 'diameters in approved px, median, 90 percent, largest', spread]
    top = a.reshape(-1, 3)[np.argsort(lum.reshape(-1))[-max(1, int(lum.size * 0.003)):]]
    out += ['brightest 0.3 percent', np.round(top.mean(axis=0)).tolist()]
    print(*out)


stats('approved', ref.crop(box), 1.0)
stats('build', ren.crop(tuple(round(v * k) for v in box)), k)
