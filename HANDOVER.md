# Fall base, handover

Branch agent/p6-fall-base, head 8da51e4e (main 99712bfc merged in). Files touched: src/seasons/fall/base.ts, assets-src/base-fall/mesh.mjs, assets-src/base-fall/RECIPE.md. The asset script changed in the first round and not since, so `npm run make -- base-fall` must still be run and its files committed by /root (77930 triangles; public glb 1298012 bytes, sha 326c0105cd559786 on this VM).

## Second list, what was done
- Vines: every broad lobe at the front is off. A vine is near black and carries one long cool highlight read from the tube's own round, widened by what the normal turns across a pixel, so it does not narrow under about a pixel and a half. Fibre streaks run along and round the vine. Thorns are black with one soft cool face.
- Leather: the speckle is gone. Two crease fields stretched along the height, blue grey paint, a bluer sheen on the backs of the folds.
- Pumpkins: rinds lifted and lit over the body, falling off toward the rim. The right one is kept dark and cool as the approved picture shows it.
- Left tangle: thin twigs kept, warm golden glints on the fibres. The trade for thicker twisted vines was tried and left: it came to 78282 triangles, over the 77930 allowed, and M3 did not rise.
- Wax and web: untouched.
- Under the lip: with the air off the box reads 57,48,37 against 83,110,67 with it and 49,61,45 approved. The green gap is the air. Nothing was changed in the base for it.

## Where it stands
- M3 at hd review on 8da51e4e: base 0.723, miniature 0.804, bar 0.75. Not passed, but over 0.700.
- Boxes at hd review, approved against this branch: band median 10.1 and 9.9, 90th percentile 28.7 and 36.0; middle pumpkin median 29.2 and 31.0; left pumpkin 102,52,29 median 29 against 100,51,15 median 34; right flank 23,26,29 against 24,24,27.

## What is still short against the approved picture
- The band's 90th percentile is 36, not 30, and the low vines read 43 against 27.
- The left pumpkin is short of blue (15 against 28) and its median is 5 over.
- The leather reads as crinkled hide; approved is softer, with fewer and longer folds. Softer folds were tried (fold 3, crinkle 2.8) and M3 fell to 0.691.
- The left tangle is thin twigs with striped glints; approved is fewer, thicker, twisted vines. At 3840 the glints on the thicker vines read as painted stripes.
- The cool highlight on the vines of the front band is faint; approved shows it plainly on the upper edges.
- Wax brighter and more winding than approved; web untouched.

## Not seen
- The base in the storm at full size beside fall-shake.png in this round.
- The landed still in this round.
- Strict, determinism and the stand-ins picture were taken on 983bc44e (main 7f68d26e merged in); base.ts has not changed since. The four 3840 frames were taken on fd4a77f8, same base.ts.

## Where to go next
- Tones are constants at the top of base.ts (BRAMBLE, DRUM_SHEEN, DRUM_FOLD, DRUM_CRINKLE, PUMPKIN_BODY).
- M3 energy by column: the left tangle holds 0.26 of the approved's total here against 0.34 there, the right end 0.28 against 0.42. Form there (thicker twisted vines, the web's strands) is where the rest of the number is.
