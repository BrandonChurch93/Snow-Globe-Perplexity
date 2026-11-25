# HANDOVER — fall air (fall_air3), Phase 4

Branch `agent/p4-fall_air3`, looks `agent/p4-fall_air3-looks`. Files: `src/seasons/fall/glass.ts`, `veil.ts`, `rig.ts`, `backdrop.ts`, the leaf, ember and bat rows of `src/particles/engine/kinds.ts`, `assets-src/dressing-fall/**`, `assets-src/refrig/fall.json`, and (by /root's leave at the 05:31 freeze) fall's `sparks` emitter list in `src/scene/layout.ts`.

## Open, worst first

1. **Rim of the glass (R1 #1 severe, R3-1 set-C-02 minor).** The key is now a dim cream ([1, 0.9, 0.78] at 0.5), so the shoulder streak is no longer white-blue. The blue fringe on the silhouette and the thick rim did NOT move with fall's sky (tested [0.097, 0.1, 0.07], reverted): they are the shared shell, `src/globe/shell.ts` (`rim`, `edge`, `ceiling` tints on `uSky` and `uKeyCol`), open items 65 and 76. Not in these files.
2. **M3 fall-rest red.** Review tier on 2dd31bf + warm key: base 0.382, miniature 0.395; with the fog sheets and the lip off the miniature reads 0.436, the base the same. The fog's share is 0.041; the rest is the base's and the miniature's detail. Draft readings run far above final ones.
3. **Storm fog against the approved shake.** The strands are thin ribbons now (`ribbon`, `ribbonBody` in `look.fog`; the line where the weave crosses 0.585 and 0.45). The approved's are fewer, broader (1 to 2 mm) and brighter, with dark clear water between. Next step: weigh the weave toward `s1` (lower `s3`'s 0.2) for fewer, longer bands, and raise `swirl`. Mind `broad`: it feeds the flood at the swap and so M4.
4. **Crack.** One crack with two arms, bowed between the traced points, lit in stretches. No refraction of what lies behind it and no fine splinters at the hub. `faint 0.07` may be too faint on the film; `0.1` is the middle.
5. **Sparks.** Softer and larger than the approved's points; the glow sprite is `src/particles/draw/**` (kinds3). The row is `sizeMm [0.12, 0.75], sizeSkew 3`.
6. **Leaves afloat at rest.** About 55 at 10,000 (`floats 0.08, renew 0.05`); the approved has 60 to 70, larger. The 3 % that only float (`floats` minus `renew`) hang at 0.3 to 1.8 mm/s and never land: the motion critic's cloud (R4 set-C-01) is thinner, not gone. Not seen in motion.
7. **Haze at rest** stands higher up the back wall than the approved's (`hazeMm 12`).
8. **Low fog band.** Darker, uneven, thinner to the sides now; fall_mini3 adds grass and stones through it. If the pond's near shore is still covered, lower `lip` (1.1) or `lipFrontMm` (3).

## How things work (read before touching)

- `look.fog` in `glass.ts` holds every number. 46 sheets from back to front plus one lip shell on the wall. `uFog.y` is the lift (0 pooled, 1 through the dome), `uFogTurn.y` the flood (1 through the swap, `floodHeld` at landed).
- Lifted fog is not lit by the lamp grid (`warmLifted 0.9`): with it lit, thin fog before the house stood as a pale veil. Do not undo.
- `liftedFront`, `liftedMiddle` thin the fog before and inside the scene; `liftedFrontHigh` lets strands round the front above the roof.
- Leaf row: `u5 < renew` falls at `renewMmS`, lands, lies `dwellSeconds`, is reborn; `renew <= u5 < floats` hangs for ever; the rest land at `settleMmS`.
- Embers: 55 % are born anywhere (kinds3's `BORN_WIDE`), 45 % at the `sparks` spots of `src/scene/layout.ts`, each spot an equal share whatever its radius. A small spot over a wall makes a cluster.
- The leaf count (10,000, decision 88) is /root's in `config/showcase.json`.
- Changing an emitter row: render winter rest and landed hero draft before and after and `cmp` them (identical both times so far).

## Commands

`npm run texpack && npm run -s build`; `npm run still -- --season fall --state rest|landed|settled --camera hero --tier draft --format hd --force` (65 to 80 s); pairs with the approved: `python3 out/work/v/pair.py <still> rest|shake <out.jpg>` (untracked helper). `npm run measure -- --unit fall --only M3 --tier draft|review --force` (100 s / 190 s). `node out/work/bin/tris.mjs fall`. Never run `still --help` or `measure --help`: they start a render.
