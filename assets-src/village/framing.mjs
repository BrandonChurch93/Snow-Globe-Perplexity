import { loadLayout } from './layout.mjs'
import { lensPlace, sphereCentreMm } from '../../tools/lib/lens.mjs'
import { loadConfig } from '../../tools/lib/paths.mjs'
const L = await loadLayout()
const cfg = loadConfig()
const RAD = Math.PI / 180
const hd = cfg.formats.hd
function viewOf(c) {
  const yaw = c.yawDeg * RAD, pitch = c.pitchDeg * RAD
  const back = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)]
  const eye = [back[0] * c.distanceMm, c.aimHeightMm + back[1] * c.distanceMm, back[2] * c.distanceMm]
  const fwd = back.map((v) => -v)
  const right = [Math.cos(yaw), 0, -Math.sin(yaw)]
  const up = [right[1] * fwd[2] - right[2] * fwd[1], right[2] * fwd[0] - right[0] * fwd[2], right[0] * fwd[1] - right[1] * fwd[0]]
  const f = hd.height / 2 / Math.tan((c.fovDeg * RAD) / 2)
  const project = (p) => { const v = [p[0] - eye[0], p[1] - eye[1], p[2] - eye[2]]; const z = v[0] * fwd[0] + v[1] * fwd[1] + v[2] * fwd[2]; return { x: (hd.width / 2 + f * (v[0] * right[0] + v[1] * right[1] + v[2] * right[2]) / z) / hd.width, y: (hd.height / 2 - f * (v[0] * up[0] + v[1] * up[1] + v[2] * up[2]) / z) / hd.height, z } }
  const inside = (p) => { const r = lensPlace([p[0], p[1] + sphereCentreMm, p[2]], eye, [0, sphereCentreMm, 0]); return { ...project(r.apparent), seen: r.seen } }
  const box = (roles) => { const b = { left: Infinity, right: -Infinity, top: Infinity, foot: -Infinity }; for (const s of L.shapes) { if (!roles.includes(s.role)) continue; for (const p of L.shapePoints(s)) { const q = inside(p); b.left = Math.min(b.left, q.x); b.right = Math.max(b.right, q.x); b.top = Math.min(b.top, q.y); b.foot = Math.max(b.foot, q.y) } } return b }
  return { inside, box }
}
const fmt = (b) => Object.fromEntries(Object.entries(b).map(([k, v]) => [k, typeof v === 'number' ? +v.toFixed(3) : v]))
const all = ['cottage', 'roof', 'chimney', 'trunk', 'crown', 'post', 'lamp', 'fence', 'path']
console.log('interior now', fmt(viewOf(cfg.cameras.interior).box(all)))
const m = viewOf(cfg.cameras.macro)
console.log('macro now door', fmt(m.inside(L.anchors.door)), 'win', fmt(m.inside(L.anchors.window)), 'chimney', fmt(m.box(['chimney'])), 'house', fmt(m.box(['cottage', 'roof', 'chimney'])), 'lamp', fmt(m.box(['post', 'lamp'])), 'trunk', fmt(m.box(['trunk'])))
for (const aim of [64, 66, 68, 70]) for (const dist of [134, 150, 165]) { const v = viewOf({ ...cfg.cameras.macro, aimHeightMm: aim, distanceMm: dist }); console.log('macro aim', aim, 'dist', dist, 'chimney', fmt(v.box(['chimney'])), 'house', fmt(v.box(['cottage', 'roof', 'chimney'])), 'lamp', fmt(v.box(['post', 'lamp'])), 'trunk', fmt(v.box(['trunk'])), 'door', fmt(v.inside(L.anchors.door))) }
for (const aim of [73, 75, 77.5]) for (const dist of [330, 350, 370, 395]) { const v = viewOf({ ...cfg.cameras.interior, aimHeightMm: aim, distanceMm: dist }); console.log('interior aim', aim, 'dist', dist, fmt(v.box(all))) }
console.log('--- search')
for (const yaw of [6, 0, -6]) for (const aim of [65, 66, 67]) { const v = viewOf({ ...cfg.cameras.macro, aimHeightMm: aim, yawDeg: yaw }); const h = v.box(['cottage', 'roof', 'chimney']); const l = v.box(['post', 'lamp']); const t = v.box(['trunk']); console.log('macro yaw', yaw, 'aim', aim, 'gap', +(l.left - h.right).toFixed(3), 'chimneyTop', +v.box(['chimney']).top.toFixed(3), 'houseLeft', +h.left.toFixed(3), 'trunk', fmt(t), 'lampFoot', +l.foot.toFixed(3), 'door', fmt(v.inside(L.anchors.door))) }
for (const aim of [66, 68, 70, 72]) for (const dist of [290, 300, 310, 320]) { const v = viewOf({ ...cfg.cameras.interior, aimHeightMm: aim, distanceMm: dist }); const b = v.box(all); console.log('interior aim', aim, 'dist', dist, fmt(b), 'span', +(b.foot - b.top).toFixed(3)) }
