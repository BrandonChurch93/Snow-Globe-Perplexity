# The glass: handover for the next round

Branch `agent/p5-glass`. All line numbers are in `src/globe/shell.ts` at the tip unless a file is named.
Every season sets its glass through `setGlass(season, {...})` (line 102; winter's defaults at line 99 draw the kept picture).
The values live in `src/seasons/spring/glass.ts:33`, `src/seasons/summer/glass.ts:28`, `src/seasons/fall/glass.ts:27`, `src/seasons/winter/frost.ts:24`.
The shell measures everything in `s`, the share of the radius on screen (1 is the outline; 1 percent is 3.8 px at hd).

## Item 64: the ring at the top (not mended)

What the picture shows: spring, summer and fall keep a dark band about 13 px deep under the top outline. The teal band is gone.
Ruled out, each by its own render: the mirror band (line 617, `mirBand`), the ring mesh (line 596, `ringCover` at 0), the rim zone's even glow (line 523, `uRimGlow` at 0, kept at 0 because the band got darker and less ring-like).
Not yet tried, in the order I would try them:
1. Line 578, `alpha`: the term `rim.clear * uRimAmt.x * rimZone` darkens the inside from `rim.from` 0.96 to the outline. The band's depth (13 px is 0.966) matches `rim.to` 0.967. Set `rimClear: 0` in one season and render the top.
2. Lines 551 to 554, `wallZone` (`body.from` 0.962 to `body.to` 0.978) and the `wall` plate (line 51, `to: [0.966, 0.976]`): both end where the band starts. Give each an amount as `rimGlow` has and set it to 0.
3. Line 47, `band` (`from` 0.976, `shade` 0.3, `side: [-0.2, 0.5]`): it shades the inside over the top left.
A draft still of one season takes 70 s; the top band is plain at 2 samples, so judge it at draft and prove it at final.

## Items 65 and 150: the outline (not mended)

What the picture shows: at the final tier (24 samples) the kept keys have a smooth outline. Where the ring is thinned (`ringCover: 0.35`, `ringThin: 1`), a stepped 1 px bright line showed at the top left, the same steps as at 2 samples, so it is something the samples do not average.
Commit `cf3d349` (line 596: the ring's outermost line, `ring.edge` 0.989 to 0.994, always covers) hides most of it; spring is still faintly stepped at 4x.
Next:
1. Find the line itself. It is either brighter than the display's white, so one sample in 24 saturates the pixel (candidates: `edge.line` at line 48 with `gain` 1.3 and `glint` 1.8, `rimCard` at line 37 with `tint [2.63, 2.29, 1.6]`), or it is read from a picture that does not move with the samples (`uBehind`, filled by `resolveBehind` in `src/core/accumulator.ts`, not the glass's file). Test: render fall at final with `ringCover: 0` and clamp `col` to 1 before the limb fade; if the steps go, it is the first.
2. `glassLimb` (line 209) fades the shell over `limbPx` pixels (line 45) inside the outline; whatever lies behind shows through that fade. If the inside's own edge is hard there, the fade exposes it. Report it to whoever holds `src/core/accumulator.ts`.
3. Mottle: `ringMottle: 0.3` in three seasons. Winter keeps 1.

## Items 66, 75, 83, 121, 149: nothing bent near the rim (not mended)

Numbers: the lens (`src/globe/lens.ts`, `lensPlace`) is right. Cottage 1.44x wider with it (247 px against 172 px in the `refraction` view), 1.333 at the centre in theory, 1.0 at the rim, and the last tenth of the radius holds central-plane radii 0.727R to R.
What hid it is now off in three seasons: `bend: 0`, `ringCover: 0.35`, `ringThin: 1`, `rimClear: 0.3`. Winter keeps `bend: 1` (line 638).
Why it still does not read: particles are sprites. `src/particles/draw/shader.ts` line 103 places the centre through the lens, but line 120 `mag` is the on-axis magnification and line 125 `rPx` uses it in both directions, so a flake at share 0.97 is as round as one at the centre.
Next (not the glass's file, give it to the particles' owner): after line 103 call `lensPlace` for a second point a small step outward along the radius, take the ratio of the seen step to the true step, and scale the sprite's extent along the screen radius by it. `src/core/materials.ts` lines 148 to 149 do the same for the stage.
Tried in the shell and dropped: `bend` at 0.22 (no visible change) and a monotone remap of `uBehind` over the last 14 percent (leaves were stretched toward the rim, because a remap with fixed ends must stretch somewhere). Do not repeat these.
The ground's front edge and the fence are geometry in `src/scene/` and already go through the lens; their look at the rim is the scene's.

## The layered arcs at the rim (not started)

What the approved images show: thin bright arcs lying along the rim over the last 8 to 10 percent of the radius, orange in fall, golden in summer, pink-white in spring, warm glints in winter. They are the room's lights and the inside's own lights squeezed by the glass.
What exists: the through view (`THROUGH`, `glassPoints`) draws the room's lights through the sphere; the mirror band (lines 597 to 617) marches the inside's light grid and is multiplied by `ringCover`, so it is nearly off in three seasons.
Next:
1. Raise the through view's fourth order near the rim (`windowGain[3]`) and look for arcs at share 0.9 to 0.98.
2. Give the mirror band its own amount, separate from `ringCover` (the two lines after `mirBand`, `mirCover` and `gl_FragColor`, multiply by `uRingAmt.x`), and widen `ring.mirror.wide` 0.022 so that the inside's lamps show as streaks. Tint it by `gridLit`, not by `uSky`.
3. Summer: the window's soft reflection ends in a straight lower edge near the right rim. Raise `windowSoftDeg` from 5 or fade the window by `s` above 0.9.
4. Winter: the left strip (`strip`, line 38) is a teal blade; the approved image has a soft blue patch. Set `strip` below 1 in `frost.ts` and widen `strip.wideDeg`.

## Commands that drew the pictures

Kept keys: check out the kept commit in a second tree, `npm run still -- --key winter-rest --tier final --force`, copy `out/work/stills/winter-rest-hd-final.png` and its `.json` to `kept-winter-rest-final.png`. Mine: the same on the tip, to `mine-winter-rest-final.png`.
Side by side, kept, mine, approved, rows left, right, top, front (the circle of each approved image is in `fcmp.sh`): `fcmp.sh winter`.
The same at 3x for chosen places (x and y in radii from the centre): `python3 z.py winter 0.9,0.1 -0.85,-0.3`.
The outline at 4x, kept, before, after: `python3 kink.py out.jpg summer`.
Detail through the glass, mine over kept: `python3 hf.py winter`.
Draft of one season in 70 s: `npm run still -- --season fall --state rest --camera hero --tier draft --format hd --force --look no`.
The scripts follow in full. They read the pictures from the folder they run in; the paths in them point at my sandbox and need changing.

### fcmp.sh

```
#!/bin/bash
# fcmp.sh season  -> v/f-season.jpg (kept | mine | approved; left,right,top,front)
declare -A C=([winter]=1411.3,652,553 [spring]=1413.2,654.8,547.9 [summer]=1407,658.4,550.7 [fall]=1418.8,659.6,564.1)
s=$1
CW=${CW:-330} CH=${CH:-250} python3 /home/user/workspace/t/cmp.py /home/user/workspace/v/f-$s.jpg ${2:-left,right,top,front} kept:/home/user/workspace/t/kept-$s-rest-final.png mine:/home/user/workspace/t/mine-$s-rest-final.png approved:/home/user/workspace/Snow-Globe-Perplexity/references/approved/$s-rest.png:${C[$s]}
```

### cmp.py

```
import sys, json, os
from PIL import Image, ImageDraw
# usage: cmp.py out.jpg label:img[:cx,cy,r] ...   regions fixed
R0 = 377.0
REG = {'left': (-0.86, 0.05), 'right': (0.86, 0.0), 'top': (0.0, -0.86), 'front': (0.0, 0.72), 'upright': (0.62, -0.62), 'lowleft': (-0.68, 0.55)}
def load(spec):
    parts = spec.split(':')
    label, path = parts[0], parts[1]
    im = Image.open(path).convert('RGB')
    if len(parts) > 2:
        cx, cy, r = [float(x) for x in parts[2].split(',')]
    else:
        rec = json.load(open(path + '.json'))['framing']['globe']
        cx, cy, r = rec['cx'], rec['cy'], rec['r']
    return label, im, cx, cy, r
def crop(im, cx, cy, r, gx, gy, w, h):
    s = R0 / r
    if abs(s - 1) > 1e-3:
        im2 = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    else:
        im2 = im
    x = cx * s + gx * R0 - w / 2
    y = cy * s + gy * R0 - h / 2
    return im2.crop((round(x), round(y), round(x) + w, round(y) + h))
def main():
    out = sys.argv[1]
    names = sys.argv[2].split(',')
    w = int(os.environ.get('CW', 340)); h = int(os.environ.get('CH', 300))
    items = [load(s) for s in sys.argv[3:]]
    sheet = Image.new('RGB', (len(items) * (w + 4), len(names) * (h + 18)), (20, 20, 20))
    d = ImageDraw.Draw(sheet)
    for j, n in enumerate(names):
        gx, gy = REG[n]
        for i, (label, im, cx, cy, r) in enumerate(items):
            c = crop(im, cx, cy, r, gx, gy, w, h)
            sheet.paste(c, (i * (w + 4), j * (h + 18) + 16))
            d.text((i * (w + 4) + 3, j * (h + 18) + 2), f'{label} / {n}', fill=(255, 255, 255))
    sheet.save(out, quality=92)
    print(out, sheet.size)
main()
```

### z.py

```
import sys
from PIL import Image
C={'winter':(1411.3,652,553),'spring':(1413.2,654.8,547.9),'summer':(1407,658.4,550.7),'fall':(1418.8,659.6,564.1)}
s=sys.argv[1]; regs=[tuple(float(v) for v in a.split(',')) for a in sys.argv[2:]]
R=376.97
ims=[]
for n in ('kept','mine'):
    ims.append((Image.open(f'{n}-{s}-rest-final.png').convert('RGB'),960,467.68))
a=Image.open(f'/home/user/workspace/Snow-Globe-Perplexity/references/approved/{s}-rest.png').convert('RGB'); cx,cy,r=C[s]; k=R/r
a=a.resize((round(a.width*k),round(a.height*k)),Image.LANCZOS); ims.append((a,cx*k,cy*k))
W=H=150; Z=3
sheet=Image.new('RGB',(3*(W*Z+4),len(regs)*(H*Z+4)))
for j,(gx,gy) in enumerate(regs):
    for i,(im,cx,cy) in enumerate(ims):
        x=cx+gx*R-W/2;y=cy+gy*R-H/2
        sheet.paste(im.crop((round(x),round(y),round(x)+W,round(y)+H)).resize((W*Z,H*Z),Image.NEAREST if i<2 else Image.BICUBIC),(i*(W*Z+4),j*(H*Z+4)))
sheet.save(f'/home/user/workspace/v/z-{s}.jpg',quality=90); print(sheet.size)
```

### kink.py

```
import sys
from PIL import Image
R=376.97; cx,cy=960,467.68
seasons=sys.argv[2:]
pts=((-0.19,-0.985),(0.6,-0.81),(0.985,-0.1))
sheet=Image.new('RGB',(3*(100*4+4),len(seasons)*len(pts)*(36*4+4)))
row=0
for s in seasons:
    for (gx,gy) in pts:
        for i,n in enumerate(('kept','pre','mine')):
            try: im=Image.open(f'{n}-{s}-rest-final.png').convert('RGB')
            except Exception: continue
            x=cx+gx*R-50; y=cy+gy*R-18
            sheet.paste(im.crop((round(x),round(y),round(x)+100,round(y)+36)).resize((400,144),Image.NEAREST),(i*404,row*148))
        row+=1
sheet.save(sys.argv[1],quality=92); print(sheet.size)
```

### hf.py

```
import sys, numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter
def hf(path):
    im=np.asarray(Image.open(path).convert('RGB')).astype(np.float64)/255
    y=0.2126*im[...,0]+0.7152*im[...,1]+0.0722*im[...,2]
    d=(y-gaussian_filter(y,1.5))**2
    H,W=y.shape; yy,xx=np.mgrid[0:H,0:W]; cx,cy,R=960,467.68,376.97
    r=np.hypot(xx-cx,yy-cy)/R
    mini=(r<0.8)&(yy>cy-0.3*R)&(yy<cy+0.6*R)
    base=(yy>cy+1.0*R)&(abs(xx-cx)<0.9*R)
    return d[mini].mean(), d[base].mean()
for s in sys.argv[1:]:
    a=hf(f'kept-{s}-rest-final.png'); b=hf(f'mine-{s}-rest-final.png')
    print(s, 'miniature mine/kept %.4f'%(b[0]/a[0]), 'base mine/kept %.4f'%(b[1]/a[1]))
```
