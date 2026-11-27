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
