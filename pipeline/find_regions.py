# Run from the repo root: python3 pipeline/find_regions.py
import json
import math
import os
import sys

import cv2
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
APPROVED = os.path.join(ROOT, 'references', 'approved')
OUT_JSON = os.path.join(ROOT, 'references', 'regions.json')
WORK = os.path.join(ROOT, 'out', 'work', 'regions')
NAMES = [
    'winter-rest', 'winter-shake', 'spring-rest', 'spring-shake',
    'summer-rest', 'summer-shake', 'fall-rest', 'fall-shake',
]
OVERLAY_MAX = (1400, 788)
CIRCLE_COLOUR = (255, 0, 255)
BASE_COLOUR = (0, 255, 255)

# Hand corrections, in pixels of the original file, made after looking at the
# overlays and the native-size tiles. A key that is present replaces the
# automatic value.
CORRECTIONS = {
    'winter-rest': {'base': {'left': 872, 'right': 1939, 'top': 1075, 'foot': 1443}},
    'winter-shake': {'base': {'left': 873, 'right': 1938, 'top': 1075, 'foot': 1443}},
    'spring-rest': {'base': {'left': 861, 'right': 1976, 'top': 1086, 'foot': 1441}},
    'spring-shake': {'base': {'left': 861, 'right': 1976, 'top': 1086, 'foot': 1441}},
    'summer-rest': {'base': {'left': 862, 'right': 1940, 'top': 1087, 'foot': 1442}},
    'summer-shake': {'globe': {'cx': 1405.6, 'cy': 652.1, 'r': 544.7}, 'base': {'left': 866, 'right': 1940, 'top': 1085, 'foot': 1441}},
    'fall-rest': {'base': {'left': 883, 'right': 1938, 'top': 1083, 'foot': 1442}},
    'fall-shake': {'base': {'left': 883, 'right': 1938, 'top': 1080, 'foot': 1442}},
}


def decode(path):
    data = np.frombuffer(open(path, 'rb').read(), dtype=np.uint8)
    im = cv2.imdecode(data, cv2.IMREAD_COLOR)
    if im is None:
        raise RuntimeError('cannot decode ' + path)
    return im


def fit_circle(pts):
    x, y = pts[:, 0], pts[:, 1]
    a = np.column_stack([2 * x, 2 * y, np.ones(len(x))])
    b = x * x + y * y
    sol, *_ = np.linalg.lstsq(a, b, rcond=None)
    cx, cy = sol[0], sol[1]
    return cx, cy, math.sqrt(max(sol[2] + cx * cx + cy * cy, 1e-6))


def robust_circle(pts, tol):
    rng = np.random.RandomState(7)
    best, best_in = None, -1
    n = len(pts)
    for _ in range(600):
        idx = rng.choice(n, 3, replace=False)
        try:
            c = fit_circle(pts[idx])
        except Exception:
            continue
        d = np.abs(np.hypot(pts[:, 0] - c[0], pts[:, 1] - c[1]) - c[2])
        k = int((d < tol).sum())
        if k > best_in:
            best_in, best = k, c
    for _ in range(4):
        d = np.abs(np.hypot(pts[:, 0] - best[0], pts[:, 1] - best[1]) - best[2])
        keep = d < tol
        if keep.sum() < 8:
            break
        best = fit_circle(pts[keep])
    return best, best_in / max(n, 1)


def ray_edges(gray, cx, cy, r, band, outermost):
    h, w = gray.shape
    lo, hi = r * (1 - band), r * (1 + band)
    radii = np.arange(lo, hi, 0.5)
    pts = []
    for deg in np.arange(-199.0, 19.01, 0.5):
        t = math.radians(deg)
        xs = cx + radii * math.cos(t)
        ys = cy + radii * math.sin(t)
        if xs.min() < 2 or ys.min() < 2 or xs.max() > w - 3 or ys.max() > h - 3:
            continue
        prof = cv2.remap(gray, xs.astype(np.float32).reshape(1, -1), ys.astype(np.float32).reshape(1, -1), cv2.INTER_LINEAR).ravel()
        prof = cv2.GaussianBlur(prof.reshape(1, -1), (0, 0), 2.0).ravel()
        g = np.abs(np.gradient(prof))
        g[:3] = 0
        g[-3:] = 0
        top = g.max()
        if top < 0.6:
            continue
        if outermost:
            peaks = np.where((g[1:-1] >= g[:-2]) & (g[1:-1] >= g[2:]) & (g[1:-1] >= 0.5 * top))[0] + 1
            i = int(peaks.max()) if len(peaks) else int(g.argmax())
        else:
            i = int(g.argmax())
        pts.append((xs[i], ys[i]))
    return np.array(pts)


def find_globe(im):
    h, w = im.shape[:2]
    gray = cv2.GaussianBlur(cv2.cvtColor(im, cv2.COLOR_BGR2GRAY).astype(np.float32), (0, 0), 1.5)
    small = cv2.resize(cv2.cvtColor(im, cv2.COLOR_BGR2GRAY), (w // 4, h // 4), interpolation=cv2.INTER_AREA)
    small = cv2.medianBlur(small, 5)
    found = cv2.HoughCircles(small, cv2.HOUGH_GRADIENT, dp=1, minDist=h // 8, param1=80, param2=30,
                             minRadius=int(0.28 * h / 4), maxRadius=int(0.42 * h / 4))
    cx, cy, r = w / 2, 0.37 * h, 0.35 * h
    if found is not None:
        cands = found[0]
        d = np.hypot(cands[:, 0] * 4 - w / 2, cands[:, 1] * 4 - 0.37 * h)
        k = int(np.argmin(d + 0 * cands[:, 2]))
        if d[k] < 0.15 * h:
            cx, cy, r = cands[k, 0] * 4, cands[k, 1] * 4, cands[k, 2] * 4
    score = 0.0
    for band, outermost, tol in [(0.14, False, 6.0), (0.05, False, 4.0), (0.025, True, 3.0), (0.015, True, 2.0)]:
        pts = ray_edges(gray, cx, cy, r, band, outermost)
        if len(pts) < 40:
            break
        (cx, cy, r), score = robust_circle(pts, tol)
    return float(cx), float(cy), float(r), float(score)


def find_base(im, cx, cy, r):
    h, w = im.shape[:2]
    gray = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY).astype(np.float32)
    gx = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)
    energy = cv2.GaussianBlur(np.hypot(gx, gy), (0, 0), 6.0)
    y0, y1 = int(cy + 0.75 * r), int(min(h - 1, cy + 1.75 * r))
    x0, x1 = int(max(0, cx - 1.5 * r)), int(min(w - 1, cx + 1.5 * r))
    band = energy[y0:y1, x0:x1]
    thr = 0.35 * np.percentile(band, 95)
    mask = (band > thr).astype(np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((15, 15), np.uint8))
    n, labels, stats, _ = cv2.connectedComponentsWithStats(mask)
    seed_x, seed_y = int(cx - x0), int(cy + 1.2 * r - y0)
    seed_y = min(max(seed_y, 0), mask.shape[0] - 1)
    lab = labels[seed_y, seed_x]
    if lab == 0 and n > 1:
        lab = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    comp = labels == lab
    cols = comp.sum(axis=0)
    rows = comp[:, max(0, seed_x - int(0.3 * r)):seed_x + int(0.3 * r)].sum(axis=1)
    if cols.max() == 0 or rows.max() == 0:
        return int(cx - 0.95 * r), int(cx + 0.95 * r), int(cy + 0.9 * r), int(cy + 1.55 * r)
    xs = np.where(cols > 0.35 * cols.max())[0]
    ys = np.where(rows > 0.5 * rows.max())[0]
    left, right = x0 + int(xs.min()), x0 + int(xs.max())
    foot = y0 + int(ys.max())
    half = min(r * 0.98, (right - left) / 2 * 0.86)
    top = int(round(cy + math.sqrt(max(r * r - half * half, 0))))
    return left, right, top, foot


def draw(im, g, b, scale, thick):
    out = im.copy()
    cv2.circle(out, (int(round(g['cx'] * scale)), int(round(g['cy'] * scale))), int(round(g['r'] * scale)), CIRCLE_COLOUR, thick, cv2.LINE_AA)
    cv2.drawMarker(out, (int(round(g['cx'] * scale)), int(round(g['cy'] * scale))), CIRCLE_COLOUR, cv2.MARKER_CROSS, 16, thick)
    l, rgt, t, f = [int(round(v * scale)) for v in (b['left'], b['right'], b['top'], b['foot'])]
    cv2.line(out, (l, t - int(60 * scale)), (l, f + int(60 * scale)), BASE_COLOUR, thick)
    cv2.line(out, (rgt, t - int(60 * scale)), (rgt, f + int(60 * scale)), BASE_COLOUR, thick)
    cv2.line(out, (l - int(60 * scale), t), (rgt + int(60 * scale), t), BASE_COLOUR, thick)
    cv2.line(out, (l - int(60 * scale), f), (rgt + int(60 * scale), f), BASE_COLOUR, thick)
    return out


def tile(im, x, y, tw, th):
    h, w = im.shape[:2]
    x0 = int(min(max(round(x - tw / 2), 0), w - tw))
    y0 = int(min(max(round(y - th / 2), 0), h - th))
    return im[y0:y0 + th, x0:x0 + tw]


def sheet(tiles, cols):
    rows = []
    for i in range(0, len(tiles), cols):
        row = tiles[i:i + cols]
        gap = np.zeros((row[0].shape[0], 6, 3), np.uint8)
        parts = []
        for j, t in enumerate(row):
            if j:
                parts.append(gap)
            parts.append(t)
        rows.append(np.hstack(parts))
    gap = np.zeros((6, rows[0].shape[1], 3), np.uint8)
    parts = []
    for j, rrow in enumerate(rows):
        if j:
            parts.append(gap)
        parts.append(rrow)
    return np.vstack(parts)


def main():
    os.makedirs(WORK, exist_ok=True)
    result = {}
    report = []
    for name in NAMES:
        path = os.path.join(APPROVED, name + '.png')
        im = decode(path)
        h, w = im.shape[:2]
        cx, cy, r, score = find_globe(im)
        auto_g = {'cx': round(cx, 1), 'cy': round(cy, 1), 'r': round(r, 1)}
        l, rgt, t, f = find_base(im, cx, cy, r)
        auto_b = {'left': l, 'right': rgt, 'top': t, 'foot': f}
        fix = CORRECTIONS.get(name, {})
        g = {**auto_g, **fix.get('globe', {})}
        b = {**auto_b, **fix.get('base', {})}
        result[name] = {
            'file': 'references/approved/' + name + '.png',
            'width': w, 'height': h, 'globe': g, 'base': b,
        }
        report.append((name, auto_g, auto_b, g, b, score))

        scale = min(OVERLAY_MAX[0] / w, OVERLAY_MAX[1] / h, 1.0)
        small = cv2.resize(im, (int(round(w * scale)), int(round(h * scale))), interpolation=cv2.INTER_AREA)
        cv2.imwrite(os.path.join(WORK, name + '-overlay.jpg'), draw(small, g, b, scale, 1), [cv2.IMWRITE_JPEG_QUALITY, 92])

        marked = draw(im, g, b, 1.0, 1)
        tw, th = 460, 380
        rim = []
        for deg in (-150, -90, -30, 180, -60, 0):
            a = math.radians(deg)
            rim.append(tile(marked, g['cx'] + g['r'] * math.cos(a), g['cy'] + g['r'] * math.sin(a), tw, th))
        cv2.imwrite(os.path.join(WORK, name + '-rim.jpg'), sheet(rim, 3), [cv2.IMWRITE_JPEG_QUALITY, 92])
        mid = (b['left'] + b['right']) / 2
        base = [
            tile(marked, b['left'], b['top'], tw, th), tile(marked, mid, b['top'], tw, th), tile(marked, b['right'], b['top'], tw, th),
            tile(marked, b['left'], b['foot'], tw, th), tile(marked, mid, b['foot'], tw, th), tile(marked, b['right'], b['foot'], tw, th),
        ]
        cv2.imwrite(os.path.join(WORK, name + '-base.jpg'), sheet(base, 3), [cv2.IMWRITE_JPEG_QUALITY, 92])

    thumbs = []
    for name in NAMES:
        o = cv2.imread(os.path.join(WORK, name + '-overlay.jpg'))
        thumbs.append(cv2.resize(o, (347, 195), interpolation=cv2.INTER_AREA))
    cv2.imwrite(os.path.join(WORK, 'contact.jpg'), sheet(thumbs, 4), [cv2.IMWRITE_JPEG_QUALITY, 92])
    for part, names in (('contact-1', NAMES[:4]), ('contact-2', NAMES[4:])):
        halves = [cv2.resize(cv2.imread(os.path.join(WORK, n + '-overlay.jpg')), (697, 392), interpolation=cv2.INTER_AREA) for n in names]
        cv2.imwrite(os.path.join(WORK, part + '.jpg'), sheet(halves, 2), [cv2.IMWRITE_JPEG_QUALITY, 92])

    with open(OUT_JSON, 'w') as fh:
        json.dump(result, fh, indent=2)
        fh.write('\n')
    for name, ag, ab, g, b, score in report:
        print(name, 'auto', ag, ab, 'inliers %.2f' % score)
        print(' ' * len(name), 'used', g, b)


if __name__ == '__main__':
    sys.exit(main())
