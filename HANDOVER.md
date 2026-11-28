# The shutter's comb: handover

Branch `agent/p6-shutter`. All times UTC, Nov 27. Pictures are in this folder; `captions.txt` says what each one is.

## What was wrong

In a frame where the ball moves fast, small bright things (the tree's lights, the lamp, bright edges of icicles, the glass's own outline) were drawn as a row of copies along the motion. The cause was not the cap of 96 samples. No frame of film B or of the loop reached it (the largest count was 91 of 96). There were three causes.

1. The sample times were uneven. The moments of a frame were not spaced evenly through the shutter: most steps were 0.86 of the mean and every seventh was 1.86 of it, so a streak had a hole after every seventh copy.
2. The place in the pixel ran as a sawtooth in time order. Each sample is drawn at its own place inside the pixel, and that place moved in step with the moment, so along the motion the copies bunched.
3. The marks that measure a frame's travel were blind to a twist of the ball. The base moved up to twice as far as the marks said, so a twisting frame got too few samples.

Even times and an evenly filling place alone did not cure it (proved on frame 631 at 1920 x 1080): the copies were then 0.74 px apart and beat against the pixel grid, which left dotted streaks and upright stripes on the star.

## The mend

It applies to the final tier only, and there only to a frame whose travel is 6 px or more (`tiers.final.motion.evenFromPx`). Every other frame, and every frame of the draft and review tiers, is drawn as before, byte for byte.

- The marks (`TRAVEL_MARKS` in `src/film/motion.ts`) now hold the centre, the top, three rings on the glass, the foot and the rim of the base, and their mirror images in the table. A mark other than the centre and the top counts only while it is inside the picture.
- `evenSet` gives a travelling frame even moments, and lays the place in the pixel so that it fills the pixel evenly along and across the travel.
- Each sample of a travelling frame is spread along the ball's own motion on the picture before it joins the mean (`spreadAt` in `src/film/motion.ts`, `SPREAD_PASS` in `src/core/accumulator.ts`). The spread is a tent over three sample spacings to either side, not a box over one spacing. A box over one spacing was tried in arithmetic first: it equals a blur of 0.09, 0.81, 0.09 and does almost nothing. The spread touches only pixels whose ray meets the glass (a sphere 0.75 mm larger than the glass) or the base (an upright cylinder 4 mm wider than the base). The table, the backdrop and the table's mirror image of the ball are copied bit for bit.
- The cap is 128 instead of 96. No frame reaches it; the most is 100.
- The masters draw a frame through the counted tier `final-N` instead of `samples-N`. The rule's line and every chunk's record name `evenFromPx`, so a chunk drawn under the old rule cannot be joined with a new one. `samples-N` (the test `--samples N`) keeps the old way for every frame.

## Proofs

Drawn on one machine with lavapipe, one render at a time. "Before" for the travelling frames is plain b2faf0a1, "after" is b2faf0a1 with the mend, so the pair differs by the mend alone. The rest frames were drawn a second time on main fe0f0202 and on the head that holds it.

- A frame at standstill is byte equal, 3840 x 2160 final, sha256 of the PNG. Frame 300 (winter at rest): 312cdbf6d4da3627a63330e11535c121f1aa515243d0c50d174a95f08b487465 on b2faf0a1 and with the mend; 36859a181ab5059096324c649abb2f2fd1b486543c7ab15a537c15e476857026 on main fe0f0202 and on the merged head. Frame 1990 (summer at rest): 91d0cae2e62f021209e9cf25424421977cadcb8d04608402bf1bd528014b2427 on b2faf0a1 and with the mend; 6033fcebc74e4aa89e9b92318582dd3cb9142cb6e86f72dc57b72881d91e1100 on main fe0f0202 and on the merged head.
- `npm run master -- --calibrate` prints 7b2f538355785c2d071d754d38c4b6563a09773e951a0b04adf15cd6f7cb9683 on plain main fe0f0202 and on the merged head, on this machine. (On 99712bfc both printed e77fbdcd3ad20f6ae809e2d7d360ae48f10adc1ac9b84202e6c438c4f724da7d.) The line ba63d3b2... belongs to an older build; main has changed winter at rest since.
- The eight draft stills at hd, hero camera, on the merged head, first 16 of the sha256: winter-rest d5672ee1320cefc7, winter-landed 746bbbf14d3b8a24, spring-rest ce894c94fbe32a33, spring-landed 1182d6354c88ede9, summer-rest 84ae57dcb99178a6, summer-landed c55d03a56031a79d, fall-rest 17a5b136806c3e56, fall-landed cd375fd50a246a14. These are the list for fe0f0202.
- Three film frames inside shake 1 at the draft tier, 1920 x 1080, byte equal before and after: 631 f4b254d911db00c04b0825df09040fb96bc35fefc8fa21ce58a104fc03f972e5, 655 ba6e46300ee432a5bf573775b1616cf9e39937e3f5e7b4a3fc1ac094ec17085f, 678 ed18abf75441e74b09d89ffa1bdc0602d7f01c0f950aa45a9eef41fe9eea3109.
- The same frame drawn twice, and drawn first in a run and second in a run, gives the same bytes: frames 633 and 634 at 1920 x 1080 final with the mend, both travelling frames, drawn in one page as 633 then 634 and in another page as 634 then 633. 633: f86cedfbce92b680f7b9b747fbee402c3470c34804aa762206b11db580668a6d both times. 634: 928933776a139de2cc6f2b897c03833a837bf4ac3ec1334eeeaa2b17957e1055 both times.
- The travelling frames after the mend, 3840 x 2160 final: 631 3013ed7e5c0b9f4be5033416cac1abceb805c0bb02c17e500b6fe3be855fade9 (before 922bbd180883c4cf0f6e656d762389fbef0075f212bf99ee93f027da4e9076a2), 643 07106c4003a6a52d64328b1a2fcc7e6fb37b40bd0bb00034c282318554cf0e38 (before 817cbe617fe0d59a401b72b0a713726dce636cb6a20b805d485b86ca6d25e193), 678 a80844dbbe9a712f28ac930a78f0aa202dbcbb2f1921965d97bb0f532e2930e3 (before 10cd3e5db22c71e3faf6977ee50697000acece7b117da696821867f2eb095eb6).
- The book keeping: `tierOf` in `tools/lib/master.mjs` gives `final-N` under a rule with `evenFromPx` and `samples-N` otherwise; `tools/master.mjs` and `tools/sanity-scan.mjs` read the same rule; the rule's line and the record carry `evenFromPx`. Tests in `tests/shutter.test.ts` and `tests/master.test.ts` hold this, among them that a chunk drawn under the rule as it was cannot stand for one drawn under this rule.
- On the merged head 4f9c26b4 (holds main fe0f0202): `npx tsc --noEmit` exit 0; the whole `npx vitest run`: 64 files passed, 1 skipped; 900 tests passed, 8 skipped. The skipped ones are the four of `tests/shake-looks.test.ts` and four of `tests/mix.test.ts` that want the music tracks, which this machine does not hold. `tests/shutter.test.ts` is new, 17 tests: the marks, the even set, the spread's matrices and weights, which tier draws the new way, and the masters' rule.

## Cost

- Sum of samples, film B: 93,508 before, 96,077 after (2.7 percent more). 798 of 3,600 frames are drawn the new way; 384 draw more than the base of 24; the most is 100 (frame 2118, 74.34 px).
- Sum of samples, the loop: 13,014 before, 13,549 after (4.1 percent more). 131 frames are drawn the new way; the most is 91 (frame 150, 67.53 px).
- Seconds a frame at 3840 x 2160 final on this machine, before and after: 631 506.3 s (60 samples) and 444.9 s (63 samples); 643 308.1 s (49) and 351.8 s (56); 678 799.8 s (91) and 792.1 s (99); 300 at rest 95.1 s and 93.3 s (24 both).
- The before times of 631 and 678 are not clean: other work ran on the machine while they drew. The clean reading of what the spread itself costs is at 1920 x 1080 final with nothing else running: 633 82.6 s before and 81.0 s and 75.1 s after, 634 78.6 s before and 79.2 s and 86.3 s after, 24 samples each. So the spread costs nothing that can be measured above the noise, and a frame costs more only by its count.
- Seconds a sample at 3840 x 2160 final here: 3.9 to 5.1 at rest, 6.3 in frame 643, 7.1 in frame 631, 8.0 in frame 678 (the petal veil).

## What I did not see

- No frame of the loop was drawn at the final tier. The loop goes through the same code; its travel and counts were measured, not its pictures.
- Only shake 1 was drawn (631, 643, 678). Shakes 2, 3 and 4 were measured for travel, not drawn.
- Frame 678, the fastest of shake 1, shows no lights: the petal veil of the change covers the inside. The lights are judged on 631 and 643.
- No frame was found where the table's mirror image of the ball is sharp. `631-foot-and-mirror-image.jpg` shows the mirror image of the foot, which is soft. The spread does not touch the mirror image; if a frame holds small bright things in the mirror image, they keep even times and an even place but get no spread.
- Outside the glass and the base, frame 631 at 1920 x 1080 with the spread differs from the same frame without it in 1,032 pixels, each by one level of 255, in a halo around the ball. I take this to be the glow of the frame, which is drawn after the mean from the whole picture. I did not prove it by a render without the glow.
- The inside lags behind the glass. The spread moves the inside with the ball. In 631 and 643 the lights read as unbroken streaks; I did not study a frame where the lag is at its largest.
- A frame just under 6 px of travel is drawn the old way and the next just over it the new way. I did not draw such a pair one after the other to look for a step.
- No chunk was drawn by `npm run master` at 3840. One test chunk was drawn by it at 1920 x 1080 on the merged head (`--what film-b --first 632 --last 633 --format hd --chunk 2`): it counted 30 and 24 samples before it drew, drew them, coded the chunk and wrote a record whose `motion` is `{spacingPx 0.75, maxSamplesPerFrame 128, evenFromPx 6}` and whose `frameSamples` are 30 and 24. No joined film and no sound were made.
- Film frame 1875 (lying sand under a moving camera, reported by another builder) is not covered by the mend, for three reasons. Its travel by the marks is 4.66 px, under the floor of 6 px, so it is drawn the old way. The grains lie on the table at the picture's low right, outside the glass and the base, and the spread leaves the table untouched. And its copies come from the 24 lens points across a blur disc of 4 to 5 px, about a pixel and a half apart in two directions, while the spread works along the motion alone. It belongs to the lens fill or to the grains' own sprite. I drew nothing for it.

## Tools left behind

- `node tools/shutter-travel.mjs --what film-b|loop` lists the travel and the count of every frame, their sum and how many frames are drawn with even times.
- `node tools/shutter-frame.mjs --what film-b|loop --frames A,B [--tier final] [--format uhd] [--tag name]` draws single frames as the masters draw them and prints travel, samples, seconds and the sha256 of each PNG.

## A warning about this kind of machine

A 3840 x 2160 final frame takes most of an 8 GB machine's memory. Two renders at once hung this machine for twelve minutes. One render at a time.

## Second round, 03:16 to 06:41 UTC Nov 27

This part is newer than everything above it. Where the two disagree, this part holds.

### What changed in the mend

- The floor of the new way, `tiers.final.motion.evenFromPx`, went from 6 px of travel to 1.5. It was found by drawing, not guessed. Film B, 3840 final, 24 samples, the old way beside the new way on the same frame, looked at six times enlarged: at 4.82 px (frame 604) and 2.75 px (606) the old way weaves on the lit edges of the base's leaf, and at 4.82 it doubles the glints; at 2.19 px (607) it is faintly rough on the lit ridges; at 1.59 px (728), 1.02 px (855) and 0.50 px (729) it is clean and I cannot tell the two ways apart. The new way is clean at every one of them. 1.5 is 1.59 rounded down to a half pixel.
- The spread has its own lower end now, `spreadFromPx` 6, and keeps its upper end `spreadFullPx` 18. Under 6 px there is no spread, from 18 px the whole of it, a straight line between (`spreadReach`). Before this the spread came in whole at the floor and the frames just over 6 px were softer than those just under (frost 7.34 against 8.90 between frames 602 and 603).
- The lens points of a frame drawn the new way are dealt out again (`lensOrder` in `src/film/motion.ts`). Left with their rank in time they leaned with the new places in the pixel (about 0.37, the sign turning with the direction of the travel), and what lies a little out of focus was drawn sharper or softer by direction: the base 8 percent sharper at 0.5 and 1 px, the table 2.5 percent softer. Now they lean with the place and the moment as they do in the set at rest (test bound 0.05). On frame 604 the table measures 2.698 the new way against 2.690 the old.
- The rule line, every record, the README and the tests name `evenFromPx`, `spreadFromPx` and `spreadFullPx`.
- With the floor at 1.5, 1,785 of film B's 3,600 frames are drawn the new way and 1,815 the old (1,449 of those under 0.5 px).

### What argues for a floor at all

- A frame at rest must be byte for byte what the stills' path draws.
- The new way is not the judged sample set. Its places and moments are new, so its picture differs a little in character from the old way even where there is no weave, and the difference grows with the travel. Same frame both ways, mean absolute Laplacian, new against old: at 1.59 px five crops within 2.2 percent; at 2.19 px frost 7.5 percent up, base 3.8 up, cottage and table 1.0 down; at 4.82 px frost 8 percent down, cottage 4.5 down, base 14 down (the weave gone). So the two ways agree at the floor and part above it, slowly.

### Proofs of the second round

- Pushed head `9c255ac5` (= `ba82e4fc` merged with main `fe261991`): `npx tsc --noEmit` exit 0; the whole `npx vitest run` 66 files passed, 1 skipped; 921 tests passed, 8 skipped (the eight want the music tracks). Calibration on it and on plain `fe261991`, both drawn on this machine: `ad1c6495e7f09eec6324eca368580a7416a288a9228fbc681a340112f61612d4`, the same.
- Byte proofs, film B, final tier, 1920 x 1080 (not 3840, to save time), my head against plain `fe261991`: a frame at rest, 300, `40d1d42094497fa579bd525c2b9d8b02f89d92a3d157cb7332c1c74bbebd7273` on both; a frame under the floor, 728 at 0.80 px, `009e1ddcf8cdaabfb4359cc58866ecfb771d4aa53bbb10035d5128b81cb79715` on both; a frame at full reach, 632 at 22.49 px and 30 samples, `d1f65022b21d221cacad25b21e5f48b55a8e2ba623e2ff02b434f5b3f3bbdd49` twice in two processes on my head. The last is not equal to main and cannot be since the lens mend: every frame drawn the new way changed its bytes with it.
- No step at the floor: frame 728 (1.59 px, the first above the floor in its run) both ways at 3840, mean absolute Laplacian old and new: base right 19.41 and 19.57, base left 12.35 and 12.07, table left 3.027 and 2.978, table right 3.802 and 3.751, inside 3.336 and 3.387. All within 2.2 percent.
- No step where the old floor sat: frames 601 to 604 (6.22, 6.03, 5.75, 4.82 px), all the new way, at 3840: frost 7.29, 7.45, 7.83, 8.69; cottage 9.98, 10.32, 10.67, 11.20; base 6.17, 6.32, 6.47, 6.63; table 2.703, 2.701, 2.704, 2.698.
- Frame 1875 (4.66 px, summer's lying sand): the old way drew each grain as about three separate copies, the new way draws each as one soft smear along the travel. On main `d13d29c6`, where the sand draws a lying grain once as a soft disc, the new way gives one clean soft disc a grain, a little longer along the travel. Grain strip, mean absolute Laplacian: 14.77 the old way on the old sand, 12.01 the new way on the old sand, 4.68 the new way on the new sand. The old way on the new sand was not drawn.

### The lens points' slow swing, found on shake 2 and mended

- Frame 1337 (shake 2, 37.54 px, 51 samples) at 3840, the old way beside the new way of `9c255ac5`: the fine weave was cut to a third or a half, but a slow unevenness stayed on small bright things out of focus: soft upright teeth on the grey things in the glass, a wavy line on a small light's streak (a wave about every 9 px), beads on the strand of the base.
- The cause, read by the root and confirmed by a test: the lens points were dealt by one even stride, and their part along the travel, read in the order of time, swung slowly. At 51 samples the period of 12.8 samples held 0.26 of the variance; 12.8 samples at 0.74 px a sample is 9.4 px. A thing out of focus is drawn in each sample at its place along the travel plus its blur disc times the lens point, so where the lens points of neighbours in time lie together the copies bunch. The set's own order has no such peak.
- The mend, in `lensOrder` alone: a deal is judged by the lean it must keep (as before) plus the sum through the shutter of the squared mean of the lens points under the spread's own seven weights (1, 2, 3, 4, 3, 2, 1), after the straight trend with the moment is taken off. That mean is what the spread cannot close: the weights pass a swing of period 13 at 0.74 of its size, of period 6 at 0.19, of periods 3 and 5 at 0.06, of periods 2 and 4 at nothing. The search starts from the best even stride and lets pairs of samples change places while the cost falls, in five rounds, the lean held loosely first and steeply last. No random number and no clock: the same set and travel give the same order.
- Numbers (the sum; white noise gives 0.344): the set's own order 0.09 to 0.30; the deal at 24 samples 0.017 to 0.043, at 51 0.006 to 0.009, at 96 to 128 0.005 to 0.007. The lean stays within 0.05 of the rest set's.
- Frame 1337 again at 3840 (on `48b04e39` with the new deal, main `d13d29c6`), sha256 `d02e056562df9a3422d7ed66d7f21e5ba4da866067c53587c0062a1e92678587`. Fine and slow measure (mean absolute difference of a pixel from the mean of 3, and of the mean of 3 from the mean of 9, along the rows), the old way, the even stride, the new deal: grey thing in the glass fine 1.35, 0.39, 0.36 and slow 1.24, 1.02, 0.78; small light's streak fine 2.13, 0.99, 0.80 and slow 3.77, 3.91, 2.36; strand on the base fine 1.83, 0.62, 0.52 and slow 2.04, 1.79, 1.24; chimney fine 0.78, 0.39, 0.36 and slow 1.07, 1.14, 0.95; moss fine 1.14, 0.41, 0.36 and slow 1.13, 1.01, 0.69. The small light's streak is a straight bar with a faint ripple left at four times; the grey things show a striation only at four times. The root passed this frame by its own look.

### Other things asked and what was found

- The table's mirror image is not spread (the spread is on the pixels of the glass and the base only). On frame 1337 at three times it is smooth both ways. A row of nine coloured spots there (x 1285 to 1446, y about 2015, 16 to 25 px apart) is the same in the old way, the even stride and the new deal, and is the scene's own: the pool at the foot of the trickle, with its rings and glints. A spread that follows the mirror image was described to the root and not made.
- The inside's lag as a doubled edge on the miniature: none seen on frame 1337 at 37.5 px.

### Proofs of the state pushed as e53ce501

All on this machine (lavapipe, 4 CPUs, 7.6 GiB), one render at a time.

- `agent/p6-shutter` is `e53ce501`: `ebf15da4` (the new deal) on `48b04e39` (merge of main `d13d29c6`), then `daeb3c9e` (merge of main `b4bc96c0`), then a comment with the measured numbers in `tests/shutter.test.ts`.
- `npx tsc --noEmit -p .` exit 0 and the whole `npx vitest run` on `daeb3c9e`: 66 files passed, 1 skipped; 925 tests passed, 8 skipped. On `e53ce501` only `tests/shutter.test.ts` was run again: 22 passed.
- Calibration on `e53ce501` (build `3384a1c3ea8ce692`) and on plain `b4bc96c0` (build `842a8d88438fc72c`): `ad1c6495e7f09eec6324eca368580a7416a288a9228fbc681a340112f61612d4`, the same.
- Bytes at 1920 x 1080, film B, final tier, the head against plain `b4bc96c0`: frame 300 at rest `40d1d42094497fa579bd525c2b9d8b02f89d92a3d157cb7332c1c74bbebd7273` on both; frame 728 (0.80 px at 1920, under the floor) `7fa07925299be61829a417b22976b7dd2d1afc926545f441a2c1a99ac01a91a1` on both. Frame 632 (22.49 px, 30 samples, full reach) twice in two processes on the head: `4bb28d5c1734112081a2f4288607bc8989bbb9b00e93fe67430357d645f119df` both times.
- The chunk at 3840 x 2160 through the masters' own path, `npm run master -- --what film-b --first 712 --last 715 --chunk 4`, twice in two processes on `e53ce501` (engine `3384a1c3ea8ce692`), finished 06:01:51 and 06:14:05 UTC: travel 5.99, 9.25, 12.48, 13.23 px, 24 samples each, 712 without spread and 713 to 715 on the ramp. `frameHashes` the same in both records: `c713a02af8d998c42f8af3bebae254384286da2207bd844ee51a684b876ba75c`, `20d24395cb7a6f211cfddf2fc0d649975ceb404f40637db1b79febcaa8a86469`, `76a594f28de18edd8b0ad0e379a654520b76f88a91db7f93b4691c0d03309aaa`, `a9105762ffdb8f4f12c5e2f81a107628e13ef75bb92dfce68a70fc143074e3dc`; the two intermediates the same bytes, sha256 `73efbc8878a23e673fbfd1410e9f3cd1ff70663f412e8c4eb117bc875cd91bb2`; no value that is no number; luma PSNR least 50.87 dB. 176 s a frame on this machine. In the four frames, looked at twice enlarged from the decoded intermediate: no comb, no doubled edge, no step.
- Frame 1398 (71.49 px, 96 samples) both ways at 3840: new way `69347159eb9741fa84606c8acab1e716384438e9443c8e1276ce08536897e40f`, old way `450d9fec63865836a4aa75414ed7df5af21c20dd64e0fcb4d3ac8725c7498807`. The miniature's small lights: a dotted weave the old way, smooth bars the new way (fine 0.83 then 0.32, slow 0.70 then 0.47). The frame lies in the change of season and the miniature is washed out, so it cannot show a lag of the inside well.
- Frame 2064 (19.34 px, 26 samples): new deal `b80140814a13ffbb8b267dcd00e1235f979f503d6437f767e8922c1b0285496a`. The old way's weave on the base's sand and shells is gone (sand at four times: fine 1.41, 0.39, 0.39 and slow 1.31, 0.93, 0.96 for the old way, the even stride, the new deal). At 26 samples the new deal measures the same as the even stride.

### What was not seen

- Shake 4 (frame 2784) either way, and frame 2118.
- The old way of frame 1875 on main `d13d29c6`.
- Any frame of the loop in the second round.
- Any frame on a head that holds main `a7f9032b` or later. The branch holds `b4bc96c0`.
- The whole vitest on `e53ce501` itself; it ran on `daeb3c9e`, and `e53ce501` adds one comment in a test.
- A frame with a clear miniature faster than 37.5 px, for the inside's lag.
- The table's mirror image is still drawn without a spread. A spread that follows it was described to the root and waits for the root's word.

## The scatter in the air as a smear (decision 220, open item 268)

Written 23:40 UTC, 27 November 2026, the lines on frame 2121 added at 23:50 UTC, those on the frames at 3840 on the head at 00:38 UTC on 28 November. The whole report is `streak-report.txt` beside this file; the pictures are `streak-1` to `streak-15`, named in `captions.txt`.

- Code: `agent/p6-petal-streak`, head `beed6a06` (one commit `beb62adb` on main `5b76c959`, then merges of main `8f763981` and `48a2e3b7`). Engine `8dec00b8dd77ff93`. Five files: `src/core/materials.ts`, the two slabs of spring and fall, one exported word in `src/shake/change.ts`, `tests/gust-streak.test.ts`.
- What it does: in a film frame of 8 samples or more, while a petal or a leaf is in the air, each sample's share of the shutter is cut into 8 parts, the scatter is drawn at each, and every pixel keeps one by its level in the still tile. The row of copies becomes one smear with a fine grain.
- The live page never takes this path: it has no sample, so the second mesh is never made and the first mesh's shader is the one it was.
- Proven: frame 1388 and fall's frame 2827 at 3840 before and after; frames 1386 to 1391 at preview; the eight guards equal to chain 39's list on the head; tsc; the whole vitest (1054 passed, 8 skipped).
- The arriving scatter, one frame: frame 2121 at preview (fall's leaves blown in) on main `48a2e3b7` and on the head. Before, the leaves are rows of copies; after, smears. 35,530 pixels differ, none above row 353 (`streak-8`).
- On the head at 3840: frame 2121 (leaves arriving, one smear each), frames 1388 and 1389 as a pair. The grain inside a smear is unrelated from one frame to the next (correlation 0.02) and about 2 levels wide, against 26.5 levels of change in the smear itself. Section 10 of the report.
- Below the bar, found on that pair: a faint rib stays at one place of frame 1388 (x 585 to 649, y 1612 to 1645), as strong as before the mend, about 3 levels from crest to trough. Taken for a petal thrown by the foot's kick, whose jump this change does not cut into parts. Not proven. `streak-13`.
- Change 1, frames 679 to 682 at preview, before and after: the rows of copies are smears; the grainy fringe beside the petals at 680 is the same before and after, so it is not the gust's. At preview's 24 samples the smear's own grain is coarse. Section 11 of the report, `streak-14` and `streak-15`.
- Not seen: the two frames played at speed; the arriving scatter of change 2 before and after; any master chunk; the page in a browser during a change; the cost on a graphics card (23 percent on frame 1388 in software).

### The weave in the smears (open item 278), added 02:35 UTC, 28 November

- The rib of frame 1388 and the crossed weave the root saw at one to one in frames 1388 and 1389 are one thing: ribs across the smears, 6 to 12 px apart. They are older than the smear (frame 1388 before any mend has them). The guess about the foot's kick was wrong.
- Two mends tried and dropped, unproven as a gain: the still tile at a place of its own in every sample, and the front at each part's own moment. Section 12, `streak-16` to `streak-20`.
- The cause: a sample is seen from one lens point, so the eight parts of a sample of a petal out of focus bunch together. The mend: each part of the second mesh is seen from a lens point of its own (`gustLensPoint`, `stageGustSeen`).
- Code: `agent/p6-shutter-c`, not merged. Commit `43aaf2a6`, then merges of main `342102e1` (head `f8f103fd`, engine `530b5d1ac19d93c3`, on which the frames were drawn) and `2340c4f7` (head `07c94d0a`, engine `144059cb99b0d134`).
- Measured at 3840 on `f8f103fd`, frames drawn by the root's helpers: the strongest wave of 3.5 to 12 px at the rib of 1388 fell from 1.656 to 0.872 levels, at the root's place in 1389 from 1.439 to 0.605. The first is over the half of the head's by 0.044; the band is flat there, so the number reads the grain.
- The price: a finer grain without pattern. The spread of the fine part rose by about a fifth where the ribs stood (1.601 to 1.945 at the rib) and by 3 to 10 percent over the cuts. Whether that reads better than the ribs is the root's judgement at full size.
- Frames with nothing in the air are the same bytes with and without: 668 and 2108 at 3840, four frames at draft, two at preview at the final tier. The eight guards equal chain 42's list on `07c94d0a`. The whole vitest: 1064 passed, 8 skipped.
- Not seen: anything played; the petals arriving (680 to 682) and change 4 at 3840 with the mend; any film frame on `07c94d0a`. Section 13, `streak-21` to `streak-36`.

### The mend beside main on change 4 and change 1 (decision 258), added 03:02 UTC, 28 November

- Helpers drew the frames at 3840, final tier: the mend on `07c94d0a`, main on `60f4d0ae`. The section above says 02:35; it was written at 02:34.
- Frame 2828 (the leaves leaving): the leaves are dark and the two frames differ on them by one level mostly. On their footprint the spread of the fine part is 0.695 on main and 0.708 with the mend. Boxes of 200 x 60 px where a wave of 3.5 to 12 px stands out over 2.0 times the middle wave: 32 on main, 17 with the mend. No new single pixels by count.
- Seen in 2828: at true levels no rib and no row of copies with the mend. With the levels times 4 a faint trace of main's comb is left on one leaf (x 3040 to 3110, y 1705 to 1735; 0.941 levels on main, 0.776 with the mend). Section 14, `streak-43` to `streak-45`.
- Frames 682 and 681 (the petals arriving): main carries rows of copies and ribs across the smears; with the mend they are gone to a fine grain. Boxes of 200 x 60 px where a wave stands out over 2.0 times the middle wave: 84 on main and 53 with the mend in 682, 77 and 31 in 681.
- The price there is plain: single pixels standing over their 5 x 5 by more than 8 levels on the flown parts are 4,978 on main and 6,707 with the mend in 682, 3,744 and 5,643 in 681. Edges that were smooth on main are sandy with the mend (682: the small petal at x 1647 to 1680, y 1908 to 1950; 681: x 3240 to 3500, y 1530 to 1660). That petal's edge is also softer, 3.627 px against 4.163 px from 10 to 90 percent of its step; three other flown edges are within two hundredths.
- The thin scatter of single pink pixels beside the first petals is not taken away by the mend; outside the flown parts it is the same to the pixel, at the smears' edges a little more. Section 14, `streak-37` to `streak-42`, `streak-46`, `streak-47`.
- Frame 2829: the leaves are all but gone. At true levels the two frames look alike; boxes where a wave stands out over 2.0 times: 14 on main, 3 with the mend; single pixels equal by count. `streak-48` to `streak-50`.
- Not seen: the frames played; anything above the table beyond a count.

