# Fall base, handover

Branch agent/p6-fall-base, head af07c508 (main b2faf0a1 merged in). Files touched: src/seasons/fall/base.ts, assets-src/base-fall/mesh.mjs, assets-src/base-fall/RECIPE.md. The asset script changed, so `npm run make -- base-fall` must be run and its files committed by /root (77930 triangles; public glb 1298012 bytes, sha 326c0105cd559786 on this VM).

## Where it stands
- M3 at hd review on af07c508: base 0.645, bar 0.75, before 0.700. Not passed. The old 0.700 came from scaly dents on the vines and thin wax drips, which the approved picture does not have; both are gone.
- G15 passes on af07c508: high 1791103 of 1800000 triangles (main b2faf0a1 reads 1791325 by /root).
- The other three seasons at rest, draft hd, are byte equal to /root's hashes on b2faf0a1.

## What is still short against the approved picture
- The approved vines are wet and glossy with long soft highlights; here they are matte bark with short highlights. No specular lobe is tighter than power 40, for the twinkle at 3840.
- Left tangle: coarser, more brassy, fewer thin twigs than approved.
- Right flank leather: speckle, not wrinkle.
- Pumpkins: rinds darker than approved, glow stays near the carving.
- Wax: greyer than approved, foot runs wind.
- Cobweb fan geometry untouched.
- The band under the lip is far brighter than approved (fog, and the globe sits about 12 px lower); not this job's files.

## Not seen
- The base in the storm at full size beside fall-shake.png (only the shake-3 draft sheet at about 380 px a frame).
- The four neighbouring 3840 frames after the last cut of sides (wax runs 14 to 12 sides, foot runs 12 to 8, pools 28 to 20 segments, twigs thinner than 0.55 at 4 sides and every second ring).
- Strict, determinism and the stand-ins picture were run on earlier heads (strict and stand-ins on 3b88c607, determinism on 4387d88f); the shader has not changed since.

## Where to go next
- Form for M3: the approved's fine energy sits in the left tangle (many thin twigs), the leather wrinkle on the right flank and the web. More twigs cost triangles; fall has about 8900 left at high. A wrinkle map for the leather costs none.
- Tones are constants at the top of base.ts (BRAMBLE, DRUM_SHEEN).
