# First frame: handover

Branch `agent/p6-first`. Job: must-fix 3, open item 215. The page showed an empty dark screen and a black 300 x 150 canvas box
from first paint to first picture.

## What a visitor gets now

1. First paint, from the page alone (about 25 kB): a soft, out of focus picture of the opening season, made of a few hundred
   inline bytes, lying where the globe will be.
2. One request later (one still, under 60 kB as AVIF, under 90 kB as WebP): the still of that season at rest, in the app's own
   framing for that screen. `?season=fall` gets fall's, no season gets `defaultSeason`'s.
3. The canvas stays at opacity 0 until the app's first whole picture (its second drawn frame), then comes in over the still in
   half a second. The still is the same picture, so the fade reads as the grain starting to move. The still is removed once the
   canvas is fully in (or after 1.5 s, whichever is first).
4. Nothing else is shown: no spinner, bar, percentage, word or logo. The controls arrive as they did before, after the first
   picture.
5. Where WebGL2 is missing, the `cannot` page keeps the still, dimmed to 32 %, behind its words.

## How it is built

- `tools/poster.mjs` opens the built site as a visitor does, once a season, keeps the frame the app calls its first picture,
  then resizes the same page to each other screen shape and keeps one frame at each. Shapes: `hd` 1920 x 1080, `wide`
  2560 x 1080, `tablet` 1024 x 1366, `phone` 390 x 844, and the phone with its browser bars in (`phone750`, `phone667`,
  `phone590`). Four seasons, seven shapes, 28 stills, each as AVIF and WebP under a byte budget (`BUDGET`).
- The tool writes the stills to `public/first/`, what each was drawn from to `public/first/stills.json`, and a table into
  `index.html` between `/*first:begin*/` and `/*first:end*/`.
- The table holds: the stills (size, where the glass is in each, a version for the URL), the app's framing sampled over aspect
  and height (read from `src/app/framing.ts` through the build, never copied as constants), and the soft inline pictures.
- The page script picks the still whose shape is nearest the screen, and lays it so that its glass is exactly where the table
  says the app will put the glass on this screen. Edges the still does not cover get an enlarged, dimmed copy under it.
- `src/app/app.ts` calls `window.firstStill.place(globe)` with the app's own framing numbers when it starts and on resize, so
  the still is corrected to the exact place even where the table was read between its nodes; it sets `data-live` on the canvas
  at the first whole picture and calls `window.firstStill.end()` when the fade is over.
- Autopilot, loop and capture pages have no still and show their canvas at once.

## Remaking the stills

```
npm run build
node tools/poster.mjs            # draws only what is stale; about 19 minutes for all 28 on software GL
npm run build                    # the table is part of the page
node tools/poster.mjs --check    # must print: poster: pass
```

`--season winter,fall` and `--shape phone,wide` redraw those whatever they were drawn from. `--keep` keeps stills drawn from
another build when the framing is unchanged; use it only for a change known to move no pixel. A still is stale when the app's
build, the season's files, the framing or the coding rules changed since it was drawn, so after any change to a look or to the
framing every still is drawn again. `/root` was asked to add `"poster": "node tools/poster.mjs"` to `package.json`.

Commit `public/first/` and `index.html` together: the table names the stills by content version.

## What is still wrong, worst first

### 1. The globe moves in the second after the takeover (not mended)

The still and the first live frame agree (see the numbers below). What follows does not hold still: the app frames the globe
with `roomUnder(height, bar, width)`, and `bar` is the default until the interface is on screen. The interface is loaded only
after the first picture, its controls are measured every 20 frames, and the room then eases at `FRAME.easeRate`. So within
about a second of the takeover the globe moves to make room for the controls as they arrive. This was already so before this
work; it is now the one visible seam of the opening.

Size of the move on the merged build (framing numbers from `src/app/framing.ts`, controls as measured in the page):
- phone 390 x 844: default bar 96 px puts the glass at cy 349.5, r 155.6; the controls measure 154 px, and a bar of 160 gives
  cy 316.8: the globe rises about 30 px.
- hd 1920 x 1080: default cy 378.9, r 330.9; the controls measure 74 px, and a bar of 80 gives cy 384.6, r 336.1: about 8 px
  down and 6 px larger.
- tablet 1024 x 1366: default cy 503.4, r 410.1; a bar of 80 gives cy 528.7 (controls measured 86 px before the merges):
  about 20 px down.
These are the framing's numbers before main's ce9548e2; the move itself was not photographed (the "later" pictures are 10 to
12 frames after the takeover, and the controls are first measured at frame 20).

It cannot be closed from the page alone: the controls' height depends on `pointer: coarse`, the orientation and
`env(safe-area-inset-bottom)` as well as on width and height, so the still cannot know it before the interface's CSS is there.

The mend, about an hour of work in files this job owns plus one full run of the poster:

1. `src/app/app.ts`: mount the interface before the first frame (its chunk is about 10 kB of script and 14 kB of CSS), measure
   the controls while they are unseen, set `bar` before frame 1, call `placeStill()` with that bar, and publish the measured
   pixels for the tools (for example `document.documentElement.dataset.under`). The measurement has to be taken with the
   controls' arrival animation off, since it starts 6 px low: a rule
   that turns animation and transition off, at the highest priority, for `#ui[data-measure]` and all it holds, in `index.html`,
   for the one synchronous reading.
2. `tools/poster.mjs`: hide the interface with `opacity:0` rather than `display:none` so the stills are drawn with the measured
   bar; keep the bar in each still's record; sample the table as G(aspect, bar / height), since the framing is free of scale;
   add the interface's media queries and a map from their match vector to the bar in pixels, sampled with a fine and a coarse
   pointer in pages whose `requestAnimationFrame` never fires.
3. `index.html`: read those with `matchMedia`, look the bar up, and place the still with it. `tests/first-frame.test.ts` then
   needs a small stand-in for `matchMedia`.

Until then the opening is: still, seamless takeover, then the globe settling as the controls come in.

### 2. The stills on the head are stale (one tool run mends it)

The stills were drawn at commit abe4c1b8, where `node tools/poster.mjs --check` printed
`poster: pass · 28 stills and the table agree with the framing (45 aspects by 22 heights)`. Main then moved twice under the
branch: ce9548e2 turns the camera 1.2 degrees on screens narrower than 0.6 (the phone, phone750 and phone667 shapes: twelve
stills now show the room from the old angle), and 27e83641 makes the tools draw with the second software renderer. On the head
`--check` prints `poster: FAIL · 28 stills: drawn from another build of the app or other files`. Run the four lines under
"Remaking the stills" once every look and the framing are final. Until then a phone's room turns a little during the fade
(not photographed).

### 3. On a slow machine the live picture softens right after the takeover

The stills are drawn at the top quality level, which is the level the app draws its first frames at. On the measuring machine
(software GL) the app's governor drops to a lower level within a few frames, so in the phone's takeover picture the canvas is
already 390 x 844 under a 780 x 1688 still, and the table's reflection has changed: mean difference 9.3 of 255 on the phone
(2.2 on hd, where the pixel ratio is 1 either way). Place and size agree to the pixel on both. On a machine that holds the top
level this was not seen, because there is none here.

### 4. Between the sampled shapes the room behind the glass is approximate

A screen gets the still of the nearest shape, laid so that the glass is exact. On a shape far from all seven (a very wide
window, a square one) the room behind the glass is a little off until the live picture comes in. Stills lose fine detail at
their byte budget (60 kB AVIF at 780 x 1688).

### 5. Less before the first live picture: not done

The live picture still needs the same 13.8 MB in 32 requests. Lowering it means texpack choices (`tree-sprigs.srgb.w512`
496 kB and `frost-grain.lin.tile` 426 kB are the largest first files) or splitting the 7.9 MB model file; both are outside
this job's files. What changed is what the visitor looks at meanwhile.

## Numbers

- Before (main, hd): `live: the first picture after 14.2 s from 13.83 MB in 32 requests; the whole pictures after 52.2 s,
  45.54 MB more in 53 requests`, with an empty dark page until then.
- After (head, hd): `live: the first picture after 15.0 s from 13.92 MB in 36 requests; the whole pictures after
  76.2 s, 45.54 MB more in 52 requests`, `nothing logged`. That is four requests and 0.09 MB more than before: the
  still's file is one of them (under 60 kB); the other three were not traced, and main moved in between.
  The whole pictures took 76.2 s against 52.2 s; the tools drew with the second software renderer in this run (main's
  27e83641) and the cause was not traced. The tool's own line for the still named the soft inline picture (`the still after 0.06 s from 28.2 kB in 1
  requests`); `tools/firstlook.mjs` was then changed (f16f8b97) to wait for the still's file. The line was not printed again by a run;
  what it reads was seen on hd with the app's script held back: the soft picture loads after 55 ms, `first/winter-hd.avif`
  after 105 ms, and the file is fetched under the name the tool matches.
- Phone profile 390 x 844 at ratio 2, local server, software GL, two loads of the head: the still's file (59,523 bytes, AVIF)
  had arrived after 43 and 38 ms; first paint after 872 ms (first page of a new browser) and 164 ms (second load); the still was
  in place before that paint on the second load, so the first thing painted was the still itself. The live picture took over
  after 15.8 and 14.3 s. Before the still there is only the dark ground of the page, or the soft inline picture where the
  still's file is slower than the first paint.
- First paint with the app's script already in the cache (the reason for the wait in `src/main.ts`): phone 128 to 504 ms with
  the script free against 64 ms with it held back; hd 248 to 304 ms against 188 ms. Before the wait a cached load painted
  nothing until the app had set up its graphics (1104 ms against 124 ms in one measure under load).
- Takeover at abe4c1b8 (stills fresh): phone, still against live shift 0 px in five windows, mean difference 9.3 of 255 (see 3);
  hd shift 0 px, mean 2.2 of 255, 10.1 % of pixels over 8, 1.6 % over 24. The still does not change while the app loads
  (still against half way: 0). No console message and no failed request on either load.

## The wait in `src/main.ts`

Before it sets up the graphics the app waits for one frame of the page (a frame, then a task, or 100 ms at most, and only
where the page is visible and is not a capture page). Without it a load from the cache ran the app's set-up before the page
had painted anything. It moves no pixel: the app's frames use frame times only as differences and a counted seed. That is why
the stills were stamped with `--keep` after it instead of being drawn again.

## The page that cannot draw

Seen on phone (winter) and hd (`?season=fall`) with WebGL2 taken away (cannot-looks.jpg): the season's still at 32 %, the
canvas unseen, and the app's words across the middle of the glass. On hd the words are small against the dimmed picture. The
app throws `This browser has no WebGL2` on that page, as it did before.

## Checks

- Head f46b0ee8: `npx tsc --noEmit` exit 0; `npx vitest run`: 50 files passed, 1 skipped; 582 tests passed, 7 skipped;
  `npm run build` exit 0 (at cad9f69b; no file of the build changed after it).
- `node tools/poster.mjs --check`: pass at abe4c1b8, FAIL (28 stale) on the head, as fault 2 says.
- `npm run firstlook -- --live` at cad9f69b: the lines under "Numbers"; `nothing logged`.
- `npm run hostcheck` (tracked files of cad9f69b): all eight loads printed `ok` (each season, and each at `quality=low`, first picture after 12.6 to 17.5 s, for example `ok · ?season=fall · first picture after 13.4 s, fall lit, 89726 colours`); its closing line had not printed when my time ran out, so it is not a seen pass.
- Not run, for want of time (the checks ran one at a time and hostcheck alone took over fifteen minutes): `npm run determinism`, `npm run strict` (no shader was touched, so there is no last line to quote), the `--diag standins` still, and the eight judged keys by hash. The keys are grabbed on a capture page, where `src/app/app.ts` does not run and `src/main.ts` differs only by two style properties on the canvas and skips its wait; that is an argument, not a seen result.

## Things not checked

- The `v` in a still's URL is the same for every season of a shape (`winter-hd.avif?v=71fe24d1`, `fall-hd.avif?v=71fe24d1`).
  Whether it changes when only one season's files change was not checked; if it does not, a host that caches `first/` for
  long would keep an old still.

## Not seen with my own eyes

- The four moments on the tablet, and for summer on the phone, 2560 x 1080 and 360 x 800: the run takes three and a half
  minutes a screen here and was stopped after phone and hd when main moved. Summer's and fall's stills themselves were looked
  at as sheets (all seven shapes), and summer's soft first paint on hd.
- The takeover on the head after ce9548e2 and 27e83641 (stale stills).
- The fade as motion: only the frame with the canvas at half opacity over the still, and the frames either side.
- A real phone, a real GPU, a real network.
- The move of the globe as the controls arrive (see 1).
