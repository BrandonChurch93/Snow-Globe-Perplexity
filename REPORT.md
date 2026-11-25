# Report: spring_base (base-spring, surface-dressing-spring, arrival-spring)

1. Branch `agent/p4-spring_base`, last commit `81fb823` (merge of `main`; my last change is `24bd568`); looks branch `agent/p4-spring_base-looks`. Longer notes: `HANDOVER.md` beside this file.
2. Stand-in or fallback left: none. `standIns` in `slab.ts` is empty, nothing carries `userData.standIn`, no named fallback was used. `npm run still -- --season spring --state rest --camera hero --tier draft --format hd --diag standins --force` at 02:43 UTC on the last commit: every one of the 2,073,600 pixels is black.
3. Still wrong, worst first (pictures on this branch; the failing measures are in 8):
   - Moss too even and too bright a green band with a clean hem; the image has a dark body, warm lit tips on the right, shade on the left, ragged thin edges (`02-base-crop.jpg`).
   - Trickle thinner and darker than the image's glassy stream; the pool at its foot hardly shows at the hero (`02-base-crop.jpg`, `01-rest-hero.jpg`).
   - Near petals read as flat cutouts: no shadow, no mirror image under them (`04-surface-camera.jpg`).
   - Roots darker and thicker than the image's pale forked roots (`02-base-crop.jpg`).
   - Base camera: moss reads as a knitted carpet, stone under the trickle is a smooth dark channel (`03-base-camera.jpg`).
4. Built: the base as geometry measured from the approved image (turned profile, cobbles, moss cushions, the trickle's channel; roots as tapering knotted tubes; mushrooms, flowers) with relief and cover maps and three generated sheets; a moving trickle that darkens the stone it wets; 300 real petals near the foot, a few wet, and a far picture of 440; the pool; the arrival (petals jump and resettle, the first water runs from the lip, the pool fills, the old base gives way inside the bloom), all from the pose alone.
5. Make targets, in order: `npm run make -- base-spring` (about 70 s), `npm run make -- slab-spring` (about 4 s); then `npm run texpack`, `npm run build`. Both makes must be rerun after every merge of `main`.
6. Tests on the last commit: `npx tsc --noEmit` clean; `npx vitest run` printed "Test Files 32 passed | 1 skipped (33); Tests 432 passed | 4 skipped (436)".
7. `npm run determinism` at 02:40 UTC printed "determinism: pass · 3 pictures, 4 page loads, preview, draft, 335 s". It ran on the commit before the last one; the last one changes 541 normals at the hidden centre of the cup and nothing else. Not rerun after that change.
8. `npm run measure -- --unit spring --only M1,M2,M3,M6 --tier draft` at 02:33 UTC, one commit before the last (M1 again on the last):
   - M1 FAIL spring-base: 3 invalid values (one pixel) from the base camera; the other cameras 0. Still 3 on the last commit (02:48 UTC), and still 3 at 02:55 UTC with the whole base and the whole surface dressing hidden (a local test, not committed), so the pixel is not in my parts: it is in the glass, the miniature's underside, the slab or the backdrop as that camera sees them. `spring_air` saw the same with its dressing hidden. Open, for `/root`.
   - M1 FAIL spring-interior: the miniature touches the edge of the frame (not my part).
   - M2 FAIL spring-rest 0.0592, spring-shake 0.0664, spring-settled 0.0593 (threshold 0.03); pass spring-base 0.0113, spring-surface 0.0296, spring-interior 0. Whose pixels are soft at the hero was not looked at.
   - M3 FAIL spring-rest 0.6483 (threshold 0.75): base 0.648, miniature 0.703. The base is softer than the approved image; not fixed.
   - M6 pass on all six (spring-shake 24 of 102000 inside a solid).
9. Size: my files 6.20 MiB of 6.5 MiB after texpack. `main` still holds 18 stale `base-*.tile.w1024.*` files of stage 1 (9.05 MiB) that nothing writes or loads. Triangles 157,056, none added since 00:57 UTC.
10. Looks used: base-spring 40 of 40, surface-dressing-spring 5 of 40, arrival-spring 4 of 40. A hero still that checked both is counted to the base.
11. Generated pictures: moss, stone, bark, petals, one take each of six, all kept; rows for `ASSETS.md` are in `HANDOVER.md`.
