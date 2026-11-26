# Handover: `controls_finisher`, branch `agent/p6-controls`

Start 04:04:55 UTC Nov 26, limit 07:04:55. Last commit on the branch: `249f8dbb` (main `ce9548e2` merged in). Main has moved since
(`b4635825`); I had nothing more to push.
Everything below was run in one VM with no GPU: the live app draws a frame in 3 to 4 s at 390 x 844 and in about 15 s at
1920 x 1080 (`?quality=low`).

## The five faults

### 1. The Shake control goes missing (item 214): mended
- Cause, as the brief measured it: the arrival (700 ms, opacity 0 to 1) was a style rule on each control; the hint's rule took
  its place on the Shake control, and when the hint ended or a press cut it short the arrival played again from nothing.
- Mend (`b72367f0`, `src/ui/index.ts`, `src/ui/ui.module.css`): the arrival is played once by the script when the controls
  come (and when the sound control comes late); no style rule gives a control itself an animation; the hint's colour runs on
  the word and the glyph inside the control; the hint's keyframes leave their two ends to the style under them.
- The same class of fault, found and mended in the same commit: setting and unsetting reduced motion replayed the arrival on
  all three controls; the phone's shade faded in again when the layout changed; a pointer resting on Shake made the warm rim
  and the arcs jump when the hint started and ended; the glyph snapped upright from up to 13 degrees at the landing (it now
  stops at the end of a swing); a hint that reduced motion cut short came back when it was unset.
- Proof: `out/work/p6/control-trace.mjs` (not committed; the real interface code over a mock app, every frame read) at
  390 x 844, 1920 x 1080 and 820 x 1180: the opacity of Shake, the marks and the sound control stays 1 from the end of the
  arrival through the hint, keyboard focus, Enter, the landing, a mark press and its landing. Before, Shake read 0 for 650 ms
  after the hint ended. Stills: `1-shake-control.jpg` here; the eighteen crops are in `out/work/p6/trace/` in my VM.
- In the app itself: `tools/visit.mjs` now looks at every control at every frame and at every animation or transition the page
  starts (line `controls-watched`). In the walks below it found no fault: `phone`, steps 11 and 9, 148 looks; `hd`,
  steps 11 and 9, 125 looks; on both the lowest opacity any control had was 0.6, the floor it dims to; `phone`, step 11
  again on the build of `249f8dbb`, 80 looks. Step 2 (a real shake) was not walked, so the watch never ran across a shake
  and its landing in the live app.

### 2. Reduced motion (item 218): mended
- What was wrong: the session gave the stage half a change, which the stage draws as a per pixel grain that only a shake's
  blur hides. At rest it read as noise (the reviewer's "speckled"). It also ran on the simulation's capped clock, so on a slow
  machine it took many frames and the controls stayed off.
- Mend (`51f0f46d`, `src/app/session.ts`, `src/ui/index.ts`, `src/ui/ui.module.css`, `src/copy.ts`): the season changes whole
  in one frame, after one drawn frame of the season it leaves. The interface keeps that frame on a canvas laid exactly over
  the picture and fades it out over the new season in 1.8 s on the screen's own clock: two whole pictures, crossed. The
  session stays busy for those 1.8 real seconds, then the controls come back and the status region says the season. A season
  whose files are late is waited for and given up after `live.loadWaitSeconds`. Sound: the beds cross, no lift, shake or
  landing cue.
- Proof: `tools/visit.mjs` step 9 in the live app (`?quality=low`), with reduced motion set through the browser, on the build
  of `83460ff9`. On both layouts `reduced-start`, `reduced-middle`, `reduced-end` and `reduced-alone` are ok: the press on
  Shake gave no lift, no shake, no pulse and no animation on the control.
  - `phone` 390 x 844, winter to spring: held at its start the picture is winter with the spring mark lit; at its half the
    two seasons lie over each other with the globe in one place; at the end spring is whole, `controlsHeld: 0`, the status
    region says "Spring". The half is 1.89 levels of 255 from the even mix of the start and the end; a grain of whole
    pixels of the one or the other would be 21.8 from it. A second press that the tool left alone went to summer in 13
    frames (43.1 s): the fade read 1, 1, 1, 0.9998, 0.9955 and then gone, the status region said "Summer", the controls
    were on. `2-reduced-phone.jpg`.
  - `hd` 1920 x 1080, winter to spring: the same, the half 1.33 levels from the even mix where a grain would be 18.1,
    `controlsHeld: 0`, "Spring". The second press went to summer in 10 frames (85.3 s): the fade read
    1, 1, 1, 0.9998, 0.884 and then gone, "Summer", the controls on. `3-reduced-hd.jpg`, with the half pixel for pixel.
  - Tests (`tests/app.test.ts`, "reduced motion", four): the season changes whole in one frame after one frame of the season
    it leaves, with the globe at rest; the stage is never asked for half a change; the session ends the dissolve in the
    screen's seconds (three frames on a machine that takes two seconds a frame); a late season is waited for and given up.

### 3. The floor the controls dim to (item 221 b): 36 percent to 60
- Decided by looking (`0913be14`): stills of the dimmed bar at 400 px wide over each season, at 0.36, 0.5, 0.6 and 0.7. At
  0.36 the unselected marks, the outline of Shake and the muted sound control nearly vanish; at 0.5 they are faint; at 0.6
  every control is plainly there and the bar is still plainly quieter than awake; at 0.7 it is near to awake.
  `4-dim-floor.jpg` here. The number is `timing.dimTo` in `src/copy.ts`, given to the style as `--dim-to`. The config does
  not hold it.
- `tools/ui-preview/check.mjs` line 421 stated the old floor; `/root` restated it on main with the line I sent.

### 4. Sound hooks: proven by tests of the scheduling, nothing heard
- `config.audio.sfx` already names all twenty sounds and the pack writes `sprites[id]` and `loops[id]`, so no hook was
  missing. Tests (`tests/audio.test.ts`, sixteen): each sound and each loop taken out of the index one at a time through a
  whole visit (nothing thrown, nothing to the console, only the index's files fetched, every other sound at the same time);
  an index that is missing or broken gives no sound and no audio context; with every sound in the index each season's
  `shake-`, `land-`, `amb-` and `music-` comes at its moment with no code change.
- The seam (`f6e32a5b`, `src/audio/index.ts`): a loop is played pass after pass; each pass starts one overlap before the last
  one ends and the two cross at equal power; the next pass is always scheduled already on the audio clock. The overlap is one
  bar for music (2.4 s) and 1.5 s for ambience, never more than a quarter of the loop.
- To know: an eight bar music loop is now heard with a seven bar period, because the file holds only 0.2 s of wrap and the
  overlap has to come out of the loop itself. If the music has a phrase that must stay eight bars, the pack should write one
  bar more of tail (`tools/sound.mjs`), and `seamOf` can then keep the period.
- Not heard: there is no sound file in this VM (`public/audio/` is not in the repo). The level at the seam of `music-winter`
  and `music-summer` was not measured on the real files.

### 5. The visitor's pass on `hd` and `tablet`: not walked whole
- A whole walk did not fit my three hours. The software renderer here draws the live app at about 15 s a frame at
  1920 x 1080 and 3 to 4 s at 390 x 844; a whole walk on `hd` had made 9 of its lines in 16 minutes when I stopped it.
- `hd`, the stopped whole walk (05:16 to 05:35, branch at `3298e821`): steps 1, 7, 11 and 4 as far as `first-paint` (first
  picture 15.2 s, controls 70.1 s), `sound-at-start`, `hint-pulse`, `hint-after`, `look`, `places`, `returned`, `stir`, all
  ok, and `dimmed` NOT. That NOT was the tool's: it read the computed opacity for 20 s, less than two frames at that size,
  and a page gives the value of a fade as of its last frame, so it read 1 while its own picture showed the bar at the floor
  (the brightest value in the Shake control's place 143.8 against 234.1 awake, 0.61). The tool now waits six frames of the
  page and measures the picture too (`e3b15f82`).
- `hd`, steps 11 and 9 with the mended tool (06:17 to 06:40, build of `83460ff9`): "visit hd: 11 lines, 0 not ok", no page
  error. `dimmed` reads 0.6 at a floor of 0.6 and 0.61 of awake in the picture; `returned` reads 1.
- `phone`, steps 11 and 9 (06:07 to 06:17, the same build): "visit phone: 11 lines, 1 not ok: returned", no page error.
  `dimmed` reads 0.6 and 0.63 of awake in the picture. `returned` NOT: the bar had been woken (`returned: true`) and read
  0.6, and the tool's own picture shows it dimmed. I took the cause to be the tool's taps coming further apart than the
  eight idle seconds and made the tool tap every two seconds by the clock (`e3b15f82`). That did not mend it.
- `phone`, step 11 again with the clock taps (06:40 to 06:46, build of `249f8dbb`): "visit phone: 7 lines, 1 not ok:
  returned", no page error. `hint-pulse`, `hint-after`, `look`, `places` ok; `dimmed` ok (0.6, 0.63 of awake); `returned`
  NOT again, opacity 0.6. The cause is found and is the frame time here, see 2 under what is still wrong. The commit
  message of `e3b15f82` says the clock taps were not yet walked; walked, they do not mend the line on this machine.
- `tablet`: not walked in the app. The controls alone were traced at 820 x 1180 (the real interface code over a mock app).
- Steps 2, 3, 5, 6, 8 and 10 were walked by me on no layout. The review walked the phone whole before my changes.
- No walk had a console message or a failed request (`pageErrors: []` in each `result.json`). The first phone run of step
  9 had counted one console warning, from reading the WebGL picture back to see whether it was empty; the probe now reads
  a 16 px canvas made for reading (`51f0f46d`).

## What is still wrong, worst first
1. The visitor's pass (fault 5) is not done as asked: no layout was walked whole after my changes and the tablet was not
   walked in the app at all. See 5 above for what was walked. It needs a machine that draws the app at speed; here a whole
   walk at 1920 x 1080 takes more than an hour.
2. On the phone the walk's `returned` line is NOT, twice: after the tool's tap the Shake control still reads 0.6. A probe
   that logged every frame of the page (390 x 844, touch, the live app, frames 4.0 to 4.1 s apart) shows why on this
   machine. The tap takes `data-dim` off within a millisecond. The 0.18 s fade back starts at the next frame, which is
   drawn at the fade's first value, 0.6. A tap reaches the page only once in two frames, 8.1 s apart, and the 8 s idle
   timer dims the bar again 70 ms before the second frame. So at 4 s a frame a touch layout never draws the bar awake
   once it has dimmed, and the tool cannot show it. On `hd`, woken by mouse moves, the line reads 1. At the speed of a
   real machine the tap does wake it: the real interface code over the mock app, touch, 390 x 844 and 820 x 1180, a tap
   on the dimmed bar read 0.6, then 0.77 and 0.81 at 61 ms, 0.93 at 120 ms, 1 at 250 ms and on, and it dimmed again
   8.0 s after the tap, with no console message (`out/work/p6/tap-wake.mjs`, not committed). Not seen: that same tap in
   the live app. The line needs a machine that draws at speed, or a wake in the tool that comes more often than once
   in two frames.
3. Reduced motion was never seen moving. The dissolve is two whole pictures crossed, and its start, half and end are stills
   with the fade held by the tool; at seconds a frame the page itself draws the fade as one or two steps.
4. With reduced motion, a press in the first frames after the controls come is followed by a camera move, because the app
   measures the controls every twentieth frame and only then stands the camera over them (`MEASURE_EVERY` in
   `src/app/app.ts`, the move in `src/app/framing.ts`; neither file is mine). On this renderer that is over a minute and
   the first phone run showed it as two globes at two heights at the half. On a visitor's machine it is a third of a second.
   The tool now presses after it, as a visitor does. For reduced motion that first move could be made at once and not glided.
5. An eight bar music loop is heard with a seven bar period, because the overlap comes out of the loop (see 4 above).
6. Sound was not heard at all, so the level at the seam on the real `music-winter` and `music-summer` is not measured.
7. In the stills of the dissolve the bar is dimmed, not held: more than eight seconds pass between the press and each
   still. The lines say `controlsHeld: 0` and the new season's mark is lit.

## Checks
- `npx tsc --noEmit`: exit 0, nothing printed. `npx vitest run`: "Test Files 49 passed | 1 skipped (50)", "Tests 568 passed
  | 7 skipped (575)". Both on the tree of the last commit, `249f8dbb`.
- `npm run determinism`: "determinism: pass · 3 pictures, 4 page loads, preview, draft, 447 s". It ran on the build of
  `ac4eba49`, two merges of main before the last. Those merges brought summer's air, the phone's framing and one line of
  the lighting; none of it is mine and I did not run it again on them.
- The eight judged keys at `draft`, 960 x 540: 8 of 8 the same by sha256 of the file and of the pixels, my branch at
  `11ac941e` against the main it stood on (`17e9b252`), and two `--live low` stills (winter at rest, fall in the shake) the
  same too. After `11ac941e` one line of `src/app/replay.ts` changed in my `src` files; the key stills do not use it.
- One still with `--diag standins` (winter, rest, hero, draft, preview) on the build of `83460ff9`: black, the highest
  value of any pixel is 0.
- No strict run: I touched no shader.
- `node out/work/p6/control-trace.mjs` on the last interface code: "all 18 passed" (six orders of states at 390 x 844,
  1920 x 1080 and 820 x 1180, every frame read).

## What I did not see with my own eyes
- Nothing moving. Every proof of motion here is a value read at every frame of a real browser, or stills.
- The dissolve as a visitor sees it: the start and the half are stills with the fade held by the tool; only its end ran free.
- The controls held during the dissolve: at the held start the session's 1.8 s had already ended, so the stills show the
  controls on. That the session stays busy and refuses a press through the dissolve is a test (`tests/app.test.ts`), not a
  still.
- Any sound. The seam, the cue moments and the missing cue are tests of what is scheduled on the audio clock.
- The whole visitor's pass on any layout after my changes; the tablet in the app at all; steps 3, 5, 6, 8 and 10 anywhere.
- A machine with a graphics card, a real phone, a real tablet, a real pointer or finger.
- A real shake and its landing in the live app after my changes: step 2 was not walked on any layout.
- A tap bringing the dimmed bar back on a touch layout in the live app: at 4 s a frame the bar is dimmed again before it
  is drawn awake (2 under what is still wrong). Over the mock app, at speed, the tap brings it back within 250 ms.

## Files I changed
`src/ui/index.ts`, `src/ui/ui.module.css`, `src/copy.ts`, `src/app/session.ts`, `src/app/replay.ts` (one line, asked by
`framing_finisher`), `src/audio/index.ts`, `tools/visit.mjs`, `tests/app.test.ts`, `tests/audio.test.ts`. No asset changed,
no `npm run make` target changed, no row for `ASSETS.md`.

## Scripts in my VM (never committed, `out/work/p6/`)
`control-trace.mjs` (the eighteen control states, every frame), `dim-stills.mjs`, `dim-sheet*.mjs`, `dim-preview.mjs` (the
floor), `keys8.mjs` (the eight judged keys by hash in two trees), the visit logs and pictures under `out/work/visit/`.
