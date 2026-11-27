#!/usr/bin/env python3
# The crown of summer's tree, counted from one mask, for the approved picture and for our own stills alike.
#
#   python3 assets-src/tree-summer/crown-count.py approved [OUT.jpg [SHADE.jpg [FLANK.jpg]]]
#   python3 assets-src/tree-summer/crown-count.py NOAIR.png IDS.png [OUT.jpg [SHADE.jpg [FLANK.jpg]]]
#   python3 assets-src/tree-summer/crown-count.py doubt
#
# NOAIR.png is the rest still of summer at hd without the air (`npm run still -- --season summer --state rest --camera hero
# --format hd --no-air`), IDS.png the ids view of the same build (`out/work/stills/summer-rest-hd-<tier>-ids.png`, which
# `npm run measure -- --unit summer --only M3` writes). Needs python3 with numpy, scipy and pillow.
#
# One scale for both: the approved's own pixels, 12.15 to the millimetre, in the crop that crown-marks.json names. Our still is
# cut at the same place and brought to that size.
#
# The mask
#   approved  leaf by colour, mended by the hand marks of crown-marks.json where seed heads, glows and the air lie over leaf.
#             Seed heads are never lit rim.
#   ours      the still without the air, leaf by colour and inside the miniature of the ids view, so no seed head and no glow
#             is in it.
#   both      go through the same steps after that (`crown_of`): gaps under 0.33 mm are closed, spurs thinner than that are
#             dropped, the lit rim within 1 mm of the leaf is added, and holes under 0.4 mm2 are filled.
# The counts
#   fill   the crown's share of its own convex hull; the air inside the hull that is open to the outside, and the air shut in
#   notch  air between hull and crown that reaches the hull's edge: how far it cuts in (mm) and its area; the bay is the one
#          that ends at the fork
#   band   the lit rim along the upper left outline (where the way out of the leaf points up and to the left). At every pixel
#          of that outline a line runs 2 mm into the crown and its lit pixels are counted. Given: the share of the outline that
#          carries any, the thickness where it does, and the lit area per length of outline (the band as if spread evenly)
#   beads  peaks of the light among the lit pixels within 0.6 mm of that outline, per 10 mm of it
#   flank  the fine lights down the right flank of the two right domes: the outline of the right dome's and the low right pad's
#          shares that is the crown's rightmost in its row, where the way out of the leaf points to the right and not up and to
#          the left. Counted as the beads are: peaks of the light among the lit pixels within 0.6 mm of it, and per 10 mm of it.
#          FLANK.jpg shows that outline in pale blue and every speck counted in a pink ring
#   pads   the crown dealt among one marked point in each pad and one in the middle mass (each pixel to the point nearest along a
#          way inside the leaf): each pad's length, thickness and tilt, and for every pair of neighbours how far apart they are
#          (a pair within 15 percent in length or in thickness is named)
#   shade  the level inside the crown (0 to 255, the picture's own). The approved's air is set aside by the same pixels on every
#          picture (`air_aside`): its hand marks, its seed heads and its fireflies, each firefly with half a millimetre about it.
#          What is read is the body: the crown's leaf by colour, without the lit rim and one pixel about it.
#          thirds  for each pad, every column of its share cut in three: the mean level of the lower thirds over that of the
#                  upper thirds, and the same over the five pads together
#          seams   the body within 1 mm of a border between two shares, over the pads' body away from those borders
#          depth   the body by how far it lies in from the outline: within 1 mm of the upper left outline (the top), within 1 mm
#                  of the outline that faces down (the underside), and deeper than 2.5 mm from any outline (the core); and the
#                  top from 1 to 2 mm in, which the rim's own glow does not reach
#          inside  the body deeper than 1 mm: the level a twentieth, a half and nineteen twentieths of it lie under, the hue and
#                  the saturation of its mean colour, the hue of its darker and of its lighter half apart (a change in the
#                  light moves the lighter half, a change in the leaf's own tone moves both), and the share of it that is vivid
#                  green (green over red and over blue by more than 12 levels), with the mean colour of what is lighter than
#                  level 48
# `doubt` counts the approved again with the hand marks left out, grown and shrunk by 0.3 mm, with the rule for lit leaf drawn
# tighter and looser, with the rim's reach at 0.6 and 1.4 mm and with the closing at half and at one and a half times its
# strength, and gives the span of every number over those. The shade's rows are counted again with the fireflies' room at 0.3 and
# at 1.0 mm, with the hand marks grown and shrunk by 0.3 mm and with the seams 0.6 and 1.4 mm wide.
import colorsys
import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi
from scipy.spatial import ConvexHull

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
MARKS = json.load(open(os.path.join(HERE, 'crown-marks.json')))
K = MARKS['pxPerMm']
X0 = MARKS['x0']
Y0 = MARKS['y0']
BOX = tuple(MARKS['box'])
# the colour the ids view gives the miniature, read from the view
MINIATURE = (68, 47, 218)
LIT = dict(hat=35, fine=20, lum=140)
# a firefly of the approved: a core that is bright and yellow green, and the room about it (mm)
FLY = dict(lum=120, green=50, room=0.5)
SEAM_MM = 1.0

_y, _x = np.ogrid[-8:9, -8:9]
WIDE = (_x * _x + _y * _y) <= 64
_y, _x = np.ogrid[-3:4, -3:4]
FINE = (_x * _x + _y * _y) <= 10


def grid(shape):
    rows = np.arange(shape[0])[:, None]
    cols = np.arange(shape[1])[None, :]
    return (cols - X0) / K + 0 * rows, (Y0 - rows) / K + 0 * cols


def cut(path, kind=Image.LANCZOS):
    im = Image.open(path).convert('RGB')
    s = im.width / 2816.0
    box = tuple(int(round(v * s)) for v in BOX)
    return im.crop(box).resize((BOX[2] - BOX[0], BOX[3] - BOX[1]), kind)


def approved_picture():
    return np.asarray(Image.open(os.path.join(REPO, MARKS['picture'])).convert('RGB').crop(BOX)).astype(float)


def leaf_by_colour(a):
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    lum = 0.3 * r + 0.6 * g + 0.1 * b
    green = (g >= r + 2) & (g >= b + 2)
    yellow = (g >= r - 8) & ((g - b) >= 0.12 * lum + 6)
    dark = (lum < 78) & ((r - g) < 0.14 * r + 4)
    return ((green | yellow) & (lum < 200) & (lum > 8)) | (dark & (lum > 8))


def lit_of(a, rule=LIT):
    # lit leaf is bright, warm and fine: it stands out of what a disc of 1.3 mm leaves and of what a disc of 0.6 mm leaves,
    # so a slit of sky between two pads, which is as bright and as warm but smooth and wider, is not lit leaf
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
    hat = lum - ndi.grey_opening(lum, footprint=WIDE)
    fine = lum - ndi.grey_opening(lum, footprint=FINE)
    return (hat > rule['hat']) & (fine > rule['fine']) & (lum > rule['lum']) & (r >= g + 4) & ~(((g - b) > 60) & ((r - g) < 12))


def discs(shape, ds):
    xm, h = grid(shape)
    m = np.zeros(shape[:2], bool)
    for x, hh, rad in ds:
        m |= ((xm - x) ** 2 + (h - hh) ** 2) <= rad * rad
    return m


def fill_small(m, px=60):
    lab, _ = ndi.label(~m)
    size = np.bincount(lab.ravel())
    small = size < px
    small[0] = False
    return m | small[lab]


def large_parts(m):
    lab, n = ndi.label(m)
    keep = np.zeros_like(m)
    for i in range(1, n + 1):
        yy, xx = np.where(lab == i)
        if len(xx) < 800:
            continue
        cx = (xx.mean() - X0) / K
        ch = (Y0 - yy.mean()) / K
        if abs(cx) <= 16 and 17 <= ch <= 44:
            keep |= lab == i
    return keep


def in_frame(m):
    xm, h = grid(m.shape)
    return m & (h > 16.0) & (xm > -20.5) & (xm < 20.5)


def crown_of(leaf, hand, lit, close=2, reach=1.0):
    # the same steps for both pictures
    leaf = fill_small(ndi.binary_closing(leaf, iterations=close))
    body = large_parts(ndi.binary_opening(in_frame(ndi.binary_closing(leaf | hand, iterations=close)), iterations=close))
    rim = lit & (ndi.distance_transform_edt(~body) <= reach * K)
    return fill_small(ndi.binary_closing(body | rim, iterations=close))


def approved(marks='as marked', rule=LIT, reach=1.0, close=2):
    a = approved_picture()
    hand = discs(a.shape, MARKS['discs'])
    im = Image.new('L', (a.shape[1], a.shape[0]), 0)
    d = ImageDraw.Draw(im)
    for p in MARKS['polygons']:
        d.polygon([(X0 + K * x, Y0 - K * hh) for x, hh in p], fill=255)
    hand |= np.asarray(im) > 0
    if marks == 'left out':
        hand[:] = False
    if marks == 'grown':
        hand = ndi.distance_transform_edt(~hand) <= 0.3 * K
    if marks == 'shrunk':
        hand = ndi.distance_transform_edt(hand) > 0.3 * K
    lit = lit_of(a, rule) & ~discs(a.shape, MARKS['seeds'])
    leaf = leaf_by_colour(a)
    crown = crown_of(leaf, hand, lit, close, reach)
    return a, crown, lit & crown, dict(hand=hand, leaf=leaf)


def ours(noair, ids, close=2):
    a = np.asarray(cut(noair)).astype(float)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    leaf = ((g > b + 5) & (g >= r - 6)) | ((r > 150) & (g > 95) & (b < g - 25))
    mini = np.abs(np.asarray(cut(ids, Image.NEAREST)).astype(int) - np.array(MINIATURE)).max(axis=2) <= 2
    outside = 100 * (leaf & ~mini).sum() / max(1, leaf.sum())
    lit = lit_of(a) & mini
    crown = crown_of(leaf & mini, np.zeros_like(mini), lit, close)
    return a, crown, lit & crown, dict(outside=outside, leaf=leaf & mini)


def count(a, crown, lit, name='', say=True, out=None):
    H, W = crown.shape
    ys, xs = np.where(crown)
    width = (xs.max() - xs.min()) / K
    pts = np.stack([xs, ys], 1)
    him = Image.new('L', (W, H), 0)
    ImageDraw.Draw(him).polygon([tuple(map(int, pts[v])) for v in ConvexHull(pts).vertices], fill=255)
    hull = np.asarray(him) > 0
    air = hull & ~crown
    ring = ndi.binary_dilation(hull, iterations=2) & ~hull
    lab, _ = ndi.label(air | ring)
    outer = set(np.unique(lab[ring])) - {0}
    depth = ndi.distance_transform_edt(hull)
    notches = []
    for i in outer:
        l2, n2 = ndi.label((lab == i) & air & (depth > 0.8 * K))
        for j in range(1, n2 + 1):
            yy, xx = np.where(l2 == j)
            if len(xx) < 0.5 * K * K:
                continue
            k = depth[yy, xx].argmax()
            notches.append((depth[yy, xx].max() / K, len(xx) / K / K, (xx[k] - X0) / K, (Y0 - yy[k]) / K))
    notches.sort(reverse=True)
    notches = [p for p in notches if p[0] >= 2]
    shut = air.copy()
    for i in outer:
        shut &= ~(lab == i)
    bay = next((p for p in notches if abs(p[2]) < 4.5 and 24 <= p[3] <= 35), None)
    # the band
    soft = ndi.gaussian_filter(crown.astype(float), 3.0)
    gy, gx = np.gradient(soft)
    nrm = np.hypot(gx, gy) + 1e-9
    ox = -gx / nrm
    oy = -gy / nrm
    edge = crown & ~ndi.binary_erosion(crown)
    upper = edge & ((-0.6 * ox - 0.8 * oy) > 0.35)
    ey, ex = np.nonzero(upper)
    steps = np.arange(0, 2.0 * K + 0.5, 1.0)
    thick = np.zeros(len(ey))
    for i, (y, x) in enumerate(zip(ey, ex)):
        px = np.clip(np.round(x - ox[y, x] * steps).astype(int), 0, W - 1)
        py = np.clip(np.round(y - oy[y, x] * steps).astype(int), 0, H - 1)
        thick[i] = lit[py, px].sum()
    has = thick > 0
    length = len(ey)
    zone = (ndi.distance_transform_edt(~upper) <= 2.0 * K) & crown
    area = (lit & zone).sum()
    t = thick[has] if has.any() else np.zeros(1)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    l2 = ndi.gaussian_filter(0.2126 * r + 0.7152 * g + 0.0722 * b, 0.7)
    peak = lit & (ndi.distance_transform_edt(~upper) <= 0.6 * K) & (l2 >= ndi.maximum_filter(l2, size=3))
    colour = tuple(int(v) for v in a[lit & zone].mean(axis=0)) if (lit & zone).any() else (0, 0, 0)
    got = {
        'fill': 100 * crown.sum() / hull.sum(),
        'open': 100 * (air & ~shut).sum() / hull.sum(),
        'shut in': 100 * shut.sum() / hull.sum(),
        'crown mm2': crown.sum() / K / K,
        'hull mm2': hull.sum() / K / K,
        'width mm': width,
        'bay mm2': bay[1] if bay else 0.0,
        'bay depth mm': bay[0] if bay else 0.0,
        'deepest other notch mm': max([p[0] for p in notches if p is not bay], default=0.0),
        'band lit share': 100 * has.mean(),
        'band thickness mm': t.mean() / K,
        'band area per length mm': area / length / K,
        'beads per 10 mm': 10 * peak.sum() / (length / K),
    }
    if say:
        print(f"{name}: crown {got['crown mm2']:.0f} mm2, {width:.1f} mm wide, hull {got['hull mm2']:.0f} mm2; FILL {got['fill']:.1f}% of the hull; air open to the outside {got['open']:.1f}%, shut in {got['shut in']:.1f}%")
        for k, p in enumerate(notches):
            print('   notch %2d: cuts in %4.1f mm (%4.1f%% of the width), to x %+5.1f, h %4.1f; %5.1f mm2%s' % (k + 1, p[0], p[0] / width * 100, p[2], p[3], p[1], '  <- the bay at the fork' if p is bay else ''))
        print(f"   BAND upper left outline {length / K:.0f} mm; lit on {got['band lit share']:.0f}% of it; thickness where lit: median {np.median(t):.1f} px, mean {t.mean():.1f} px of this scale = {t.mean() / K:.2f} mm = {t.mean() / K * 8.28:.1f} px of the hd still; lit area per length {area / length:.2f} px = {area / length / K:.3f} mm = {area / length / K * 8.28:.2f} px of the hd still")
        print(f"   BEADS {int(peak.sum())} within 0.6 mm of it, {got['beads per 10 mm']:.1f} per 10 mm; the lit pixels' mean colour {colour}")
    if out:
        px = np.asarray(Image.fromarray(a.astype(np.uint8)).resize((W * 2, H * 2), Image.LANCZOS)).copy()

        def twice(m):
            return np.kron(m, np.ones((2, 2), bool))

        px[twice(hull & ~ndi.binary_erosion(hull))] = (255, 80, 80)
        px[twice(edge & ~upper)] = (40, 120, 200)
        px[twice(upper)] = (80, 230, 255)
        px[twice(lit & zone)] = (255, 40, 200)
        im = Image.fromarray(px)
        d = ImageDraw.Draw(im)
        for k, p in enumerate(notches):
            d.text(((X0 + K * p[2]) * 2 - 5, (Y0 - K * p[3]) * 2 - 6), str(k + 1), fill=(255, 255, 0), stroke_width=2, stroke_fill=(0, 0, 0))
        im.crop((0, 60, 1120, 960)).save(out, quality=90)
    return got


def flank(a, crown, lit, name='', say=True, out=None, near=0.6):
    # the fine lights down the right flank of the two right domes: the outline of the right dome's and the low right pad's shares
    # that is the crown's own rightmost in its row (to 2 px), where the way out of the leaf points to the right and not up and to
    # the left. Counted as the beads are: peaks of the light among the lit pixels within `near` mm of that outline.
    H, W = crown.shape
    part, _ = pads(crown, say=False)
    num = {n: i + 1 for i, n in enumerate(MARKS['pads'])}
    soft = ndi.gaussian_filter(crown.astype(float), 3.0)
    gy, gx = np.gradient(soft)
    ox = -gx / (np.hypot(gx, gy) + 1e-9)
    edge, upper, _ = outlines(crown)
    cols = np.arange(W)[None, :]
    last = np.where(crown, cols, -1).max(axis=1)[:, None]
    line = edge & ((part == num['right dome']) | (part == num['low right'])) & (cols >= last - 2) & ~upper & (ox > 0.0)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    l2 = ndi.gaussian_filter(0.2126 * r + 0.7152 * g + 0.0722 * b, 0.7)
    zone = ndi.distance_transform_edt(~line) <= near * K
    peak = lit & zone & (l2 >= ndi.maximum_filter(l2, size=3))
    length = line.sum() / K
    got = {'flank mm': length, 'flank specks': int(peak.sum()), 'flank specks per 10 mm': 10 * peak.sum() / max(length, 1e-9)}
    if say:
        print(f"   FLANK {name}: the right flank of the two right domes, {length:.1f} mm of outline; SPECKS {got['flank specks']} within {near} mm of it, {got['flank specks per 10 mm']:.1f} per 10 mm; lit pixels there {int((lit & zone).sum())}")
    if out:
        px = np.asarray(Image.fromarray(a.astype(np.uint8)).resize((W * 2, H * 2), Image.LANCZOS)).copy()

        def twice(m):
            return np.kron(m, np.ones((2, 2), bool))

        px[twice(edge & ~line)] = (40, 120, 200)
        px[twice(line)] = (80, 230, 255)
        im = Image.fromarray(px)
        d = ImageDraw.Draw(im)
        for y, x in zip(*np.nonzero(peak)):
            d.ellipse((2 * x - 4, 2 * y - 4, 2 * x + 5, 2 * y + 5), outline=(255, 40, 200))
        im.crop((int((X0 + K * 2) * 2), int((Y0 - K * 40) * 2), int((X0 + K * 22) * 2), int((Y0 - K * 14) * 2))).save(out, quality=92)
    return got


def pads(crown, say=True):
    # the crown is dealt among the marked points of crown-marks.json, one inside each pad and one in the middle mass: every pixel
    # of it goes to the point it is nearest to along a way that stays inside the leaf. Of each pad's share: its length and its
    # thickness as four times the spread along and across its own long axis (the full axes of an even ellipse of that spread),
    # and the tilt of that axis from level. The same points serve the approved and ours, so the cuts fall alike.
    xm, h = grid(crown.shape)
    names = list(MARKS['pads'])
    part = np.zeros(crown.shape, np.int32)
    for i, n in enumerate(names):
        x, hh = MARKS['pads'][n]
        spot = (((xm - x) ** 2 + (h - hh) ** 2) <= 0.25) & crown
        if not spot.any():
            sys.exit(f'the point of the pad "{n}" is not in the crown')
        part[spot] = i + 1
    cross = ndi.generate_binary_structure(2, 1)
    while True:
        new = (part == 0) & crown & (ndi.maximum_filter(part, footprint=cross) > 0)
        if not new.any():
            break
        part[new] = ndi.maximum_filter(part, footprint=cross)[new]
    got = {}
    for i, n in enumerate(names):
        yy, xx = np.where(part == i + 1)
        pts = np.stack([(xx - X0) / K, (Y0 - yy) / K])
        val, vec = np.linalg.eigh(np.cov(pts))
        ax = vec[:, 1] * (1 if vec[0, 1] >= 0 else -1)
        got[n] = dict(length=4 * np.sqrt(val[1]), thick=4 * np.sqrt(val[0]), tilt=np.degrees(np.arctan2(ax[1], ax[0])), area=len(xx) / K / K)
    if say:
        for n, g in got.items():
            if n != 'middle':
                print(f"   PAD {n:11s} {g['length']:4.1f} mm long, {g['thick']:3.1f} mm thick, tilted {g['tilt']:+5.1f} degrees (up to the right is plus), {g['area']:5.1f} mm2")
        for a, b in MARKS['neighbours']:
            dl = 100 * abs(got[a]['length'] - got[b]['length']) / max(got[a]['length'], got[b]['length'])
            dt = 100 * abs(got[a]['thick'] - got[b]['thick']) / max(got[a]['thick'], got[b]['thick'])
            print(f"   NEIGHBOURS {a} and {b}: lengths {dl:4.1f}% apart, thicknesses {dt:4.1f}% apart, tilts {abs(got[a]['tilt'] - got[b]['tilt']):4.1f} degrees apart" + ('  <- within 15%' if min(dl, dt) < 15 else ''))
    return part, got

def level(a):
    return 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]


def air_aside(room=FLY['room'], marks='as marked'):
    # the approved's air, the same pixels for every picture: the hand marks, the seed heads, and each firefly with `room` about it
    a, _, _, info = approved(marks=marks)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    fly = (level(a) > FLY['lum']) & ((g - b) > FLY['green']) & (g >= r - 5)
    air = info['hand'] | discs(a.shape, MARKS['seeds']) | (ndi.distance_transform_edt(~fly) <= room * K)
    return ndi.binary_dilation(air, iterations=1)


def outlines(crown):
    # the crown's outline where the way out of the leaf points up and to the left, and where it points down
    soft = ndi.gaussian_filter(crown.astype(float), 3.0)
    gy, gx = np.gradient(soft)
    nrm = np.hypot(gx, gy) + 1e-9
    ox = -gx / nrm
    oy = -gy / nrm
    edge = crown & ~ndi.binary_erosion(crown)
    return edge, edge & ((-0.6 * ox - 0.8 * oy) > 0.35), edge & (oy > 0.5)


def thirds(m):
    up = np.zeros_like(m)
    low = np.zeros_like(m)
    for x in np.nonzero(m.any(axis=0))[0]:
        ys = np.nonzero(m[:, x])[0]
        if len(ys) < 6:
            continue
        k = len(ys) // 3
        up[ys[:k], x] = True
        low[ys[-k:], x] = True
    return up, low


def shade(a, crown, lit, leaf, air, name='', say=True, out=None, seam=SEAM_MM):
    lum = level(a)
    part, _ = pads(crown, say=False)
    names = [n for n in MARKS['pads'] if n != 'middle']
    number = {n: i + 1 for i, n in enumerate(MARKS['pads'])}
    body = crown & leaf & ~ndi.binary_dilation(lit, iterations=1) & ~air

    def mean(m):
        return float(lum[m].mean()) if m.any() else float('nan')

    got = {}
    ups = np.zeros_like(crown)
    lows = np.zeros_like(crown)
    rows = []
    for n in names:
        up, low = thirds(part == number[n])
        ups |= up
        lows |= low
        got[f'{n}: lower over upper'] = mean(low & body) / mean(up & body)
        rows.append(f"{n} {got[f'{n}: lower over upper']:.2f} ({mean(low & body):.0f} over {mean(up & body):.0f}, {int((low & body).sum())} and {int((up & body).sum())} px)")
    got['five pads: lower over upper'] = mean(lows & body) / mean(ups & body)
    cross = ndi.generate_binary_structure(2, 1)
    border = crown & (part > 0) & (ndi.maximum_filter(part, footprint=cross) != ndi.minimum_filter(np.where(part > 0, part, 99), footprint=cross))
    seams = crown & (ndi.distance_transform_edt(~border) <= seam * K)
    padded = np.isin(part, [number[n] for n in names]) & ~seams
    got['seams over pads'] = mean(seams & body) / mean(padded & body)
    edge, upper, under = outlines(crown)
    de = ndi.distance_transform_edt(~edge) / K
    du = ndi.distance_transform_edt(~upper) / K
    dl = ndi.distance_transform_edt(~under) / K
    core = body & (de > 2.5)
    top = body & (du < 1.0) & (du <= dl)
    top2 = body & (du >= 1.0) & (du < 2.0) & (du <= dl)
    low = body & (dl < 1.0) & (dl < du)
    got['top over core'] = mean(top) / mean(core)
    got['top, 1 to 2 mm in, over core'] = mean(top2) / mean(core)
    got['underside over core'] = mean(low) / mean(core)
    got['core level'] = mean(core)
    inner = body & (de > 1.0)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    p5, p50, p95 = np.percentile(lum[inner], [5, 50, 95])
    c = a[inner].mean(axis=0)
    hue, sat, _ = colorsys.rgb_to_hsv(*(c / 255))
    hue *= 360
    vivid = inner & ((g - np.maximum(r, b)) > 12)
    light = inner & (lum >= 48)
    lc = a[light].mean(axis=0) if light.any() else np.zeros(3)
    got['inside: median level'] = float(p50)
    got['inside: level 5%'] = float(p5)
    got['inside: level 95%'] = float(p95)
    got['inside: hue'] = float(hue)
    for half, m in (('darker', inner & (lum <= p50)), ('lighter', inner & (lum > p50))):
        got[f'inside: hue of the {half} half'] = 360 * colorsys.rgb_to_hsv(*(a[m].mean(axis=0) / 255))[0]
    got['inside: saturation'] = float(sat)
    got['inside: vivid green share'] = 100 * vivid.sum() / inner.sum()
    got['inside: share lighter than 48'] = 100 * light.sum() / inner.sum()
    if say:
        print(f"   SHADE {name}: the body read is {100 * body.sum() / crown.sum():.0f}% of the crown; lower third over upper third: " + '; '.join(rows) + f"; the five pads together {got['five pads: lower over upper']:.2f} ({mean(lows & body):.0f} over {mean(ups & body):.0f})")
        print(f"   SHADE seams over pads {got['seams over pads']:.2f} ({mean(seams & body):.0f} over {mean(padded & body):.0f}, {int((seams & body).sum())} and {int((padded & body).sum())} px)")
        print(f"   SHADE depth: core {mean(core):.0f}; top (to 1 mm in) {mean(top):.0f}, {got['top over core']:.2f} of the core; top from 1 to 2 mm in {mean(top2):.0f}, {got['top, 1 to 2 mm in, over core']:.2f}; underside (to 1 mm in) {mean(low):.0f}, {got['underside over core']:.2f}")
        print(f"   SHADE inside (deeper than 1 mm): level {p5:.0f}, {p50:.0f}, {p95:.0f} (a twentieth, a half, nineteen twentieths under); mean colour ({c[0]:.0f}, {c[1]:.0f}, {c[2]:.0f}), hue {hue:.0f} degrees (the darker half {got['inside: hue of the darker half']:.0f}, the lighter half {got['inside: hue of the lighter half']:.0f}), saturation {got['inside: saturation']:.2f}; vivid green {got['inside: vivid green share']:.1f}%; lighter than 48: {got['inside: share lighter than 48']:.1f}% with mean colour ({lc[0]:.0f}, {lc[1]:.0f}, {lc[2]:.0f})")
    if out:
        H, W = crown.shape
        px = np.asarray(Image.fromarray(a.astype(np.uint8)).resize((W * 2, H * 2), Image.LANCZOS)).astype(float)

        def twice(m):
            return np.kron(m, np.ones((2, 2), bool))

        unread = twice(crown & ~body)
        px[unread] = 0.35 * px[unread] + np.array([90, 0, 90])
        for m, tone in ((ups & body, (255, 220, 60)), (lows & body, (70, 170, 255)), (core, (255, 255, 255))):
            px[twice(m & ~ndi.binary_erosion(m))] = tone
        px[twice(seams & body & (np.add.outer(np.arange(H), np.arange(W)) % 4 == 0))] = (255, 90, 60)
        Image.fromarray(px.astype(np.uint8)).crop((0, 60, 1120, 960)).save(out, quality=90)
    return got


def doubt():
    base = count(*approved()[:3], say=False)
    runs = [count(*approved(marks=m)[:3], say=False) for m in ('left out', 'grown', 'shrunk')]
    runs += [count(*approved(rule=r)[:3], say=False) for r in (dict(hat=42, fine=24, lum=150), dict(hat=28, fine=16, lum=130))]
    runs += [count(*approved(reach=r)[:3], say=False) for r in (0.6, 1.4)]
    runs += [count(*approved(close=c)[:3], say=False) for c in (1, 3)]
    print('the approved as marked, its span, and each run: marks left out, grown, shrunk; lit rule tighter, looser; rim nearer, farther; closing 1, 3')
    for k in base:
        v = [r[k] for r in runs]
        print(f'   {k:26s} {base[k]:8.2f}   {min(v + [base[k]]):8.2f} to {max(v + [base[k]]):8.2f}   ' + ' '.join(f'{x:7.2f}' for x in v))
    a, crown, lit, info = approved()
    base = shade(a, crown, lit, info['leaf'], air_aside(), say=False)
    runs = [shade(a, crown, lit, info['leaf'], air_aside(room=r), say=False) for r in (0.3, 1.0)]
    runs += [shade(a, crown, lit, info['leaf'], air_aside(marks=m), say=False) for m in ('grown', 'shrunk')]
    runs += [shade(a, crown, lit, info['leaf'], air_aside(), say=False, seam=w) for w in (0.6, 1.4)]
    print("the approved's shade, its span, and each run: the fireflies' room 0.3, 1.0 mm; the marks set aside grown, shrunk; the seams 0.6, 1.4 mm wide")
    for k in base:
        v = [r[k] for r in runs]
        print(f'   {k:34s} {base[k]:8.2f}   {min(v + [base[k]]):8.2f} to {max(v + [base[k]]):8.2f}   ' + ' '.join(f'{x:7.2f}' for x in v))


if __name__ == '__main__':
    args = sys.argv[1:]
    if not args:
        sys.exit('usage: crown-count.py approved [OUT.jpg [SHADE.jpg [FLANK.jpg]]] | NOAIR.png IDS.png [OUT.jpg [SHADE.jpg [FLANK.jpg]]] | doubt')
    if args[0] == 'doubt':
        doubt()
    elif args[0] == 'approved':
        a, crown, lit, info = approved()
        count(a, crown, lit, 'approved', out=args[1] if len(args) > 1 else None)
        pads(crown)
        shade(a, crown, lit, info['leaf'], air_aside(), 'approved', out=args[2] if len(args) > 2 else None)
        flank(a, crown, lit, 'approved', out=args[3] if len(args) > 3 else None)
    else:
        a, crown, lit, info = ours(args[0], args[1])
        print(f"of the colour rule's leaf {info['outside']:.1f}% is not the miniature and is taken out")
        count(a, crown, lit, os.path.basename(args[0]), out=args[2] if len(args) > 2 else None)
        pads(crown)
        shade(a, crown, lit, info['leaf'], air_aside(), os.path.basename(args[0]), out=args[3] if len(args) > 3 else None)
        flank(a, crown, lit, os.path.basename(args[0]), out=args[4] if len(args) > 4 else None)
