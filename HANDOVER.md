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
- The table holds: the stills (size, where the glass is in each, a version for the URL), the app's framing as a row for an aspect over the height of the
  controls, and the heights of the controls by the interface's media rules (both read from the built app, never copied as
  constants; see fault 1), and the soft inline pictures.
- The page script picks the still whose shape is nearest the screen, and lays it so that its glass is exactly where the table
  says the app will put the glass on this screen. Edges the still does not cover get an enlarged, dimmed copy under it.
- `src/app/app.ts` calls `window.firstStill.place(globe)` with the app's own framing numbers when it starts and on resize, so
  the still is corrected to the exact place even where the table was read between its nodes; it sets `data-live` on the canvas
  at the first whole picture and calls `window.firstStill.end()` when the fade is over.
- Autopilot, loop and capture pages have no still and show their canvas at once.

## Remaking the stills

```
npm run build
node tools/poster.mjs            # measures the controls, draws what is stale, writes the table
npm run build                    # the table is part of the page
node tools/poster.mjs --check    # must print: poster: pass
```

Every still is stale after any change under `src/` or `config/`: the full run draws all 28. Timed on Mesa lavapipe at
f577539f: the measure of the controls 4 to 5 s; three stills of one season (phone, tablet, hd) 65 s; the table 165 s the
first time on a build (42,124 places of the framing asked) and nothing the second time, since the answers are kept in
`out/work/poster/framing-<build>.json`; `--check` 2 s after a run on the same build. A full run was not timed on lavapipe.

`--season winter,fall` and `--shape phone,wide` redraw those whatever they were drawn from; with `--only` nothing but those is
drawn (and `node tools/poster.mjs --only` alone draws nothing and writes the table anew). `--keep` keeps stills drawn from
another build when the framing is unchanged; use it only for a change known to move no pixel. `/root` was asked to add
`"poster": "node tools/poster.mjs"` to `package.json`.

Commit `public/first/` and `index.html` together: the table names the stills by content version.

## What is still wrong, worst first

### 1. The globe moved in the second after the takeover (mended in the second job, f577539f)

The first pictures, and the still under them, stood on an estimate of the bar (96 px on the phone, where the controls measure
154 px). The app measured its controls every 20th frame after the takeover and the globe then moved: about 30 px up on the
phone, 20 px on a tablet, 8 px on hd.

What stands now:

- `src/app/app.ts` fetches the interface beside the first files (about 12 kB of script and 14 kB of CSS) and measures its
  controls before the first frame, on a copy that is taken away before anything is painted: the interface is mounted once for
  the measure and disposed again, the holders of the shake control are copied, anything hidden in the copy is shown, the copy
  is measured with the app's own `controlsPx` and removed. A copy is not hidden and does not rise into place as the arriving
  controls do, so the measure is the height at rest. The camera has the measured room from its first picture, the still is
  placed with it, and the measure is said on the document (`data-controls` on `<html>`, an empty string where there is no
  interface). The interface's real mount is in the frame of the first picture, so the controls come in after it as before.
- `tools/poster.mjs` draws the stills over the measured controls (the interface is out of sight by `opacity: 0`, not out of the
  page), and refuses a frame whose `data-controls` is not the height it expects. Before it draws, it asks the app how high the
  controls stand on every screen beside a number that one of the interface's media rules names, with a mouse and with a
  finger; it keeps the rules the measure changes with (7 on this build) and, for each way they hold together, the height and
  the safe area it rises from (heights 50, 54, 60, 62, 74, 86, 96 and 154 px). That goes into the table as `c`.
- The table of the framing is a row for an aspect (`a`, `g`): the glass at the heights of the controls where its line bends,
  as shares of the screen's height. The framing is straight between a few bends, so a row is three to seven points: 121 rows,
  618 points, 11.6 kB, where a grid of aspects by heights came to 91 kB. Both sides of the two steps of the framing (aspects
  0.6 and 1) are rows a millionth apart, so no screen is read across a step. The page is 29,956 bytes (28,358 before).
- `index.html` reads the rules with `matchMedia` and the safe area under the page, looks the height up, and lays the still
  where the globe will stay. Where the rules hold together in a way the tool did not meet it takes the nearest it met.

Seen, winter, on the built page at f577539f, Mesa lavapipe, the globe's place by matching five windows around the glass:

| screen | controls | still against takeover | takeover against 51 to 53 frames later | before |
| --- | --- | --- | --- | --- |
| phone 390 x 844 at 2, touch | 154 px | 0 px | 0 px | about 30 px up |
| tablet 820 x 1180 at 1, touch | 86 px | within 1 px | 0 px | about 20 px |
| hd 1920 x 1080 at 1, mouse | 74 px | 0 px | 0 px | about 8 px |

The later frame is 51 to 53 frames after the takeover, past the measures at frames 20 and 40. On this machine that is 64 to
95 s, not two seconds: a frame takes over a second here. No console message, no failed request. The tablet 820 x 1180 has no
still of its own: it is served the 1024 x 1366 one.

The page's reading of the table against the app's own framing, on 33 common screens (phones, tablets both ways, desktops, a
square, an aspect of exactly 0.6): within 0.17 px on 32 of them and 0.87 px on 360 x 800. The tool says of the whole table:
within 0.100 % of the height where it tested between rows wider apart than its finest, and within 0.218 % where rows are as
near as they go (0.008 in aspect). The app corrects the still to the exact place when it starts, as before.

### 1b. A faint arc over the glass on screens no still is drawn for (seen, not mended in f577539f)

On the tablet 820 x 1180 the still does not reach the top of the screen, a larger copy of it lies under it there, and the
still thins out into the copy over 66 px. The copy's own glass, 14 % larger, shows its top highlight through that thinned
edge: a faint arc about 45 px over the real glass (p2-tablet-arc.jpg). It goes when the live picture takes over. It was so
before this job; the geometry is the same as on the merged build. The mend is in `index.html`, `lay()`: the thinning must end
before it reaches the copy's glass.

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

## The second job: checks, and what was not seen

- Pushed head 9bcc9fdc (f577539f with main 16dcd6ae merged in): `npx tsc --noEmit` exit 0; `npx vitest run`: 53 files passed,
  1 skipped; 641 tests passed, 7 skipped; `npm run build` exit 0.
- The numbers of fault 1 were measured at f577539f, before main's opening (bef56f56) and its point mend (16dcd6ae) were merged
  in. They were not measured again on the pushed head.
- `node tools/poster.mjs --check` passed for the three winter stills at f577539f and failed on the 25 others (other build). On
  the pushed head it fails on all 28 and on the controls (measured on another build), since main changed `src/`: the stills
  are drawn again by `/root` on the frozen build.
- Not seen: a real phone, a real GPU; a press in the first frames with reduced motion; a real safe area (the page's reading of
  it is tested in a stand-in only); spring, summer and fall after the mend; the films, the loop and the capture pages after
  the mend (they have no interface, and `data-controls` is empty there); two seconds of real time after the takeover (51 to
  53 frames were waited for instead).
- The first picture now also waits for the interface's files. The effect on the time to the first picture was not measured.

## Checks of the first job

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
