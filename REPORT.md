# REPORT — fall air (fall_air3), Phase 4, third set

Branch `agent/p4-fall_air3`, tip **5998056** (pushed 08:25 UTC: a fast-forward to main, which already held my c1977fa; my last own commit is e0cd067, and c1977fa is what every test below ran on unless said). Looks branch `agent/p4-fall_air3-looks`. Session 05:38 to 08:38 UTC.

## On 5998056 (main's tip at 08:24, with kinds3 b329515, fall_mini3 and fall_base3 merged)

`npx tsc --noEmit` clean, `npx vitest run` 436 passed, 4 skipped. One look only, rest hero draft hd (`a3-rest-on-main.jpg`): the ring on top of the glass is gone, the crown is thinner; the leaves afloat read fewer and smaller than on c1977fa (about 30 to 35 against about 55), with kinds3's newer drawing and engine lines, my row unchanged. If the count afloat matters at the freeze, raise `floats` in the leaf row (0.08 to about 0.12) and look. Landed, settled, determinism and the measures were NOT rerun on 5998056.

## Stand-ins and fallbacks

None. No generated picture, no placeholder, no asset of mine changed: code only. Make targets: none.

## Still wrong, worst first

1. Rim of the glass (R1 #1 severe; R3-1 set-C-02): the blue fringe on the silhouette and the thick rim are the shared shell (`src/globe/shell.ts`), not fall's rig; fall's sky was tested against it and made no visible difference. Only the key's streak on the right shoulder was mine, now a dim cream.
2. M3 fall-rest red: draft 0.4405 (base 0.591, miniature 0.441) on c1977fa with main's miniature; review tier 0.3819 (base 0.382, miniature 0.395). With my fog sheets and lip off (diagnostic, never committed) the miniature reads 0.436 at review and the base the same: the fog's share is 0.041. No final-tier reading of mine (11 minutes each).
3. M1 fall-interior red: the miniature touches the edge of the frame (fall_mini3's crown; not these files).
4. Storm fog: thin ribbons now, but finer and dimmer than the approved's fewer broad bright bands.
5. Crack: bowed, lit in stretches; no refraction, no splinters at the hub; may be too faint on film (`faint 0.07`).
6. Sparks softer and larger than the approved's points (the sprite is kinds3's drawing).
7. Leaves afloat at rest: about 55, the approved has 60 to 70 and larger; 3 % still hang without landing (thinner cloud than the motion critic saw, not gone). Not seen in motion by me.
8. Haze at rest stands higher up the back wall than the approved's.

## What I built (commits, all on the branch)

- f0b3fc7: mist at rest stands behind the house and tree in banks; the lip rises up the wall in tufts behind the scene.
- 7c14ebf: sparks rise through the whole dome (R1 #5 of Round 10, `src/scene/layout.ts` `sparks`), storm fog greener and thinner over the scene, the crack's second line.
- c6cc937: the crack bows between its traced points, warmer, lit in beads.
- deb668b: narrower, greener strands with clear water between; strands round the front above the roof.
- 2db3557: lifted fog no longer lit by the lamp grid (the pale veil over the house), thinner before the scene; leaf row.
- d3e070e: ribbons (Round 13 R1 #6), low fog band darker, uneven, thinner to the sides (R1 #4, R3-2 #1, my half), crack faint between its lit stretches (R3-2 #2), window and door spark spots replaced by five in the open liquid, leaf row `floats 0.08, renew 0.05, sizeMm [1.2, 3.8], sizeSkew 1.7` (R4 set-C-01), ember row `sizeMm [0.12, 0.75]`.
- e0cd067: key [1, 0.9, 0.78] at 0.5 (R1 #1, my part).
- Leaf count: measured and asked for 10,000 (decision 88, /root's file): at 16,000 the tree was hidden at landed with my fog off too.

## Not done that was asked

- M3 with the fog off at the FINAL tier: done at review tier only (time).
- The settled state was looked at once (07:31), before d3e070e and e0cd067; not again after.
- Nothing was looked at in motion (no film rendered by me).

## Tests and what they printed (on c1977fa unless said)

- `npx tsc --noEmit`: clean. `npx vitest run`: 432 passed, 4 skipped (33 files, 1 skipped).
- `npm run determinism`: `determinism: pass · 3 pictures, 4 page loads, preview, draft, 351 s` (on e0cd067; c1977fa adds only main's scorecards and kit notes).
- `npm run measure -- --unit fall --only M1,M2,M3,M6 --tier draft --force`: see MEASURES below.
- `npm run measure -- --unit change --only M4,M5 --tier draft --force` at 10,000 leaves: M4 0.9447 / 0.9797 / 0.9194 / 0.9636 (threshold 0.85), M5 0.9878 / 1 / 0.9873 / 0.9997 (threshold 0.6): all pass.
- Winter rest and landed hero draft stills after the second emitter change: byte-identical (`cmp`) to those from before my first emitter change.

## MEASURES (draft, c1977fa, all 19 lines of `--unit fall --only M1,M2,M3,M6`)

- pass: M1, M2, M6 on fall-rest, fall-shake, fall-base, fall-surface, fall-settled; M2, M6 on fall-interior. M6 fall-shake 0.000029 (3 of 102,000 particles inside a solid).
- FAIL M3 fall-rest: 0.4405 against 0.75 (base 0.591 over 172,715 px; miniature 0.441 over 106,135 px).
- FAIL M1 fall-interior: 0 invalid values; the miniature, 457,166 px in the ids view, touches the edge of the frame.
- Review tier, M3 fall-rest only (2dd31bf plus the warm key): fog on 0.3819 (base 0.382, miniature 0.395 over 106,135 px); fog sheets and lip off: base 0.382, miniature 0.436 over 112,358 px.

## Triangles (G15, `node out/work/bin/tris.mjs fall`, 08:19 UTC on c1977fa)

My files: 31,488 (46 sheets 17,664, lip shell 1,536, crack sphere 12,288), unchanged all session. Fall: 1,606,733 of 1,800,000 high; 937,690 of 1,100,000 medium; 417,788 of 600,000 low.

## Looks used

42 numbered fall stills this session (hero, draft hd, a few macro), plus 2 for the key and sky, 3 diagnostics for the leaf count and the fog off, 4 winter stills for the emitter check, 3 M3 readings at draft and 2 at review. That is over the 40 a part allows if all are booked on the glass dressing, which the agents before me had already passed; by part it is about 32 on the fog and crack, 10 on the particle rows and emitters, 2 on the light.

## Round 13 issues in my files and where they stand

| Issue | State |
|---|---|
| R1 #1 severe, rim and upper-right arc | key warmed and dimmed (e0cd067); rim and fringe are the shared shell, open |
| R1 #4, R3-2 #1 major, green floor band | my half fixed (d3e070e); ground and pond are fall_mini3's |
| R1 #6 major, storm's milky haze | fixed in part (2db3557, d3e070e): veil gone, ribbons; streak drawing is kinds3's |
| R3-2 #2 major, straight bright lines | fixed (c6cc937, d3e070e): bowed, lit in stretches; no refraction |
| R3-1 set-C-02 minor, blue fringe | shared shell, open |
| R4 set-C-01 minor, cloud round the crown | fixed in part (d3e070e): fewer hang, three in eight afloat fall and land; not seen in motion |
| M3 fall-rest | red; fog's share measured 0.041 (review) |
| M1 fall-interior | red; fall_mini3's crown |
