# REPORT: summer_air2 (Phase 4, season summer, air), Round 9 and 10 issues

Branch `agent/p4-summer_air2`, last commit 5334604 (my last work commit 8b023ab under it; pushed 05:16, in /root's 05:20 freeze merge). Looks on `agent/p4-summer_air2-looks` (01 to 21, `captions.txt`).
Times are UTC from `date -u`.

## Stand-ins and fallbacks

None. My parts are three shader quads (flare, wall layer, pool on the table) and kit values; nothing is baked, no make targets.
Stand-ins still: `npm run still -- --season summer --state rest --camera hero --tier draft --format hd --diag standins --force` on 5334604: 1920 x 1080, largest value 0, 0 pixels that are not black.

## What I changed, by issue

Commits of mine on the branch: a93dcda, the storm and backdrop commit under f41dc09, 4aaf43d, 0f3bf8b, 6729d15, 8e5323c, 042d5f3, 8b023ab.

- R1 #2 murky olive-brown haze (major): the shared veil kept a fifth of its storm haze at rest because summer's motes never land. `rest` takes it back. Fixed in a93dcda. Later (0f3bf8b) I gave a third of it back on purpose, as a thin warm dust (0.00032 per mm, tint a little redder): the approved picture's upper dome is warm tan (150,129,108) and the clear build was dark teal (38,52,52). It stands at 72,74,63 now. If a critic calls this haze again, `rest: -0.00068` clears it; I think the approved picture asks for more of it, not less.
- R1 #1, R3-1 #1 storm a tan smudge, smeared swirl (severe): veil thinned to density 0.09, golden tint, and a golden storm glow in the wall layer that follows the liquid, with slow arms and an opening over the miniature. kinds2 redrew the seeds as tufts and streaks. Landing boxes are now close to the approved (upper left 172,149,108 against 180,151,115; upper middle 162,144,107 against 177,149,121; centre 165,135,88 against 201,164,120). Not done: see "still wrong" 1.
- /root 03:55, veil thin at the landing: the shared veil follows turbulence and fell from 0.00258 per mm at the landing to 0.00004 at +1 s. `holdStorm` (summer/veil.ts) holds summer's storm density from the swap through the set down and the landing and lets go smoothly. Measured on the film (4aaf43d, rest then -0.00068): landing 0.00292, +0.5 s 0.00288, +1.5 s 0.00188, +3 s 0.00008 per mm. With `rest: -0.0004` (from 0f3bf8b on) every value is higher by the share of 0.00028 that is held, computed not measured: about 0.0032, 0.0032, 0.0021, 0.0003 (rest 0.00032). Seen on a draft sheet across the landing (looks 09): storm on 1410, 1440, 1470, thinning to clear on 1620, no step.
- R4 Round 9, interior frozen after the clear (major): UNDONE AGAIN on /root's order of 05:07. I had given the seed row a share that keeps falling, lands, fades and re-enters (seen on a draft sheet of film 1680 to 2010, looks 16). On the merged build that left dozens of large heads in the dome at rest and a pale heap over pond, lamp foot and grass, against the approved image. The image wins: see the next line. What still moves at rest is the fireflies and the fine dust; the motion critic's issue stands open.
- /root 05:07, seed heads at rest (urgent): seed row in 8b023ab: `floats: 0.003, renew: 0, settleMmS: [14, 30], sizeMm: [0.3, 0.8], sizeSkew: 2.5` (were 0.018, 0.008, [6, 14], [0.69, 1.39], 1.6). Seen at rest, hero, hd draft, beside the approved image (looks 18): no large heads in the air, only fireflies and fine dust, the miniature clear, nothing heaped on pond, lamp foot or grass. Seen at the landing (looks 19): the storm still stands, with smaller heads, because `sizeMm` is one value for storm and rest. Not measured: the share of the miniature showing at settleCheckSeconds (asked: at least 0.6); I saw rest and landing only, not the settle check moment. The heap was the 9000 rested seeds: the row can only make them small and quick to land; the count is `config/showcase.json`, the drawing of a rested seed is kinds2's.
- R1 #6, R3-1 #12, R2 flare (2D starburst on top): the flare is short soft rays fanning outward with a halo, no needle spikes. The milky band on the left wall was my own wall layer (wide air, band and glow terms), not the shared glass: the wall is clear now; the low sun is a burnt-out patch of thin lines low on the far wall with an amber spill past the limb.
- R3-1 #7 gold filaments on the table: the drawn curves are gone. The pool is a log-polar web of thin veins round a bright knot with short rays, brightest by the knot, ended by 46 mm; plus (042d5f3) a soft strip of low sun on the table past the globe's shadow.
- R2 backdrop cluster upper right: gain by the light's place in the approved picture, lift 5 high on the right, the two lights the shared layout makes brightest held down by their level colours. Upper right box p90 205,173,131 against 214,190,163; median 32,31,27 against 76,54,35.
- R1 #4 light: key 1.3, rim 0.9, warmer sky fill; directions unchanged.
- Round 10 R4 on fall, issues 1 and 3, my part: leaving, the flare, hot patch and table caustic are out 0.2 beat before the swap window opens (seen on a draft shake-3 sheet, looks 15: present to 2054, gone from 2068); the storm glow thins by `1 - mix.veil`; change_builder's line for the two-season branch is in as sent.
- kinds2's request: `nestMm?`, `nestPower?` in `Behaviour`; firefly `nestMm: 98, nestPower: 1.1`.

## Still wrong, worst first

1. Storm at the landing is flatter and creamier than the approved: no dark gaps between the arms, a broad white crescent inside the left limb (212,184,147 against 152,115,80; it is the shared veil's folds, lit), the miniature less readable. The approved is golden with crisp white strokes.
2. Upper dome at rest is still darker and greyer than the approved's warm tan (70,71,61 against 150,129,108 on 8b023ab); the crown box 69,70,59 against 115,111,100; upper left 93,81,57 against 109,98,74. A layer behind the miniature is not possible from the glass dressing (see HANDOVER).
3. Seeds: the approved image has a handful of medium heads high on the left of the dome at rest; ours has none now (`floats` 0.003 of 9000 is about 27 small ones). The storm's heads are smaller than before 8b023ab, for the same row value; a size by state would need the engine (kinds2). The interior at rest moves only by fireflies and dust (R4 of Round 9 is open again).
4. Backdrop discs are larger and fewer than the approved cluster (shared layout); the cluster's median is far below the approved.
5. Flare is softer than the approved's crisp star (R3-1 asked for shorter and softer, R2 for no 2D star; the approved has long thin rays). The white reflection band on the glass by the flare and the ring at the pole are the shared glass.
6. The strip of sun on the table (042d5f3) lies toward the front left corner; in the approved it lies further left at the level of the base, with sand sparkle in it. The caustic is paler and less streaked than the approved's.
7. Colour across the swap into fall: summer's cream flood to fall's green between 2094 and 2120 (the change and fall's volume; numbers sent to change_builder and fall_air2).
8. Not mine, seen in my stills: base and slab paler than the approved (bases2, told), table reflections of the lights cold (surface.ts), sand heap rigid (bases2).

## Tests and measures before the last push

All on 5334604 (8b023ab with origin/main merged), after the push, between 05:16 and 05:29:

- `npx tsc --noEmit`: clean.
- `npx vitest run`: 432 passed | 4 skipped (436).
- `npm run measure -- --unit change --only M4,M5 --tier draft`: M4 shake-1 0.9448, shake-2 0.9816, shake-3 0.9278, shake-4 0.9619 (threshold 0.85); M5 shake-1 0.9792, shake-2 1, shake-3 0.9698, shake-4 0.9997 (threshold 0.6). "measure change: not complete · 8 of 24 lines, 0 red · draft · 249 s" (not complete because I asked for two measures only).
- `npm run determinism`: "determinism: pass · 3 pictures, 4 page loads, preview, draft, 351 s".
- Not run: `npm run measure -- --unit summer` (no measure of that unit is mine alone; M4 and M5 are the two the veil and the seed row move).

## Triangles (G15)

My files: 3 quads, 6 triangles. Season drawn, `node out/work/bin/tris.mjs summer` on 5334604 at 05:23: high 2,050,620 of 1,800,000; medium 1,256,957 of 1,100,000; low 600,480 of 600,000. All three are over the limit (low by 480); the meshes are the miniature's and the base's, not mine. At 04:13 they were 2,330,842 / 1,493,774 / 727,418.

## Looks used (pictures I viewed, at most 40 a part)

glass (flare, wall) 13; veil and storm 12; pool on the table 10; light and backdrop 6; seed row 4; diagnostics 7. 52 in all, no part over 40.
