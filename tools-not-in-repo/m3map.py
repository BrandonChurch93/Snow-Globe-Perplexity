#!/usr/bin/env python3
# usage: m3map.py [out.png] [still.png ids.png]: M3 of the miniature reproduced (crops sheet of the last measure, or a still + its ids view
# against the approved resampled the same way), split by region of the 696x392 crop; writes a map of where energy is missing.
import sys, numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter
out = sys.argv[1] if len(sys.argv) > 1 else None
def luma(a):
    a = a.astype(np.float64) / 255
    return 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]
if len(sys.argv) > 3:
    S = Image.open(sys.argv[2]).convert('RGB'); ids = np.asarray(Image.open(sys.argv[3]).convert('RGB')).astype(int)
    A = Image.open('references/approved/summer-rest.png').convert('RGB')
    a = np.asarray(A.resize((696, 392), Image.LANCZOS, box=(898.62, 454.67, 898.62 + 1016.77, 454.67 + 572.66)))
    b = np.asarray(S)[328:720, 612:1308]
else:
    sh = np.asarray(Image.open('out/work/measure/m3-summer-rest-final-crops-1.png').convert('RGB'))
    a = sh[0:392, 0:696]; b = sh[0:392, 704:1400]
    ids = np.asarray(Image.open('out/work/stills/summer-rest-hd-final-ids.png').convert('RGB')).astype(int)
m = ids[328:720, 612:1308]
mask = (abs(m[..., 0] - 68) <= 2) & (abs(m[..., 1] - 47) <= 2) & (abs(m[..., 2] - 218) <= 2)
la, lb = luma(a), luma(b)
ha = (la - gaussian_filter(la, 1.5, mode='nearest')) ** 2
hb = (lb - gaussian_filter(lb, 1.5, mode='nearest')) ** 2
print(f'miniature ratio {hb[mask].mean() / ha[mask].mean():.4f}  approved {ha[mask].mean()*1e4:.2f} build {hb[mask].mean()*1e4:.2f}  px {mask.sum()}')
tot = ha[mask].sum()
# regions in crop px (x0,y0,x1,y1)
regs = dict(crownTop=(300,0,640,110), crownLow=(300,110,640,200), trunkLamps=(380,200,620,300), cottageRoof=(90,140,300,215), cottageWall=(90,215,300,310), leftGarden=(0,200,90,392), midGrass=(200,300,420,345), rightGrass=(420,280,696,345), pond=(230,335,560,375), front=(0,345,696,392))
for n, (x0, y0, x1, y1) in regs.items():
    k = mask[y0:y1, x0:x1]
    if k.sum() == 0: print(n, 'no px'); continue
    ea = ha[y0:y1, x0:x1][k]; eb = hb[y0:y1, x0:x1][k]
    print(f'{n:12s} px {k.sum():6d} approved {ea.mean()*1e4:7.2f} build {eb.mean()*1e4:7.2f} ratio {eb.mean()/ea.mean():5.2f}  share of approved energy {ea.sum()/tot*100:5.1f} %  missing {(ea.sum()-eb.sum())/tot*100:6.1f} %')
if out:
    pa = np.sqrt(gaussian_filter(ha * mask, 4)); pb = np.sqrt(gaussian_filter(hb * mask, 4)); s = 0.07
    top = np.concatenate([a, np.zeros((392, 8, 3), np.uint8), b], axis=1)
    g = np.concatenate([np.clip(pa / s, 0, 1), np.zeros((392, 8)), np.clip(pb / s, 0, 1)], axis=1)
    g = (np.stack([g] * 3, -1) * 255).astype(np.uint8)
    Image.fromarray(np.concatenate([top, g], axis=0)).save(out); print(out)
