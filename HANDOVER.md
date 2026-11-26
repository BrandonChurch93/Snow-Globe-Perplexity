# First frame: handover

Branch `agent/p6-first`. Job: must-fix 3, open item 215. The page showed an empty dark screen and a black 300 x 150 canvas box
from first paint to first picture.

## What a visitor gets now

1. First paint, from the page alone (about 25 kB): a soft, out of focus picture of the opening season, made of a few hundred
   inline bytes, lying where the globe will be. A browser that knows `rel=expect` holds its first paint until that picture
   is laid (see "The fourth job").
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
  2560 x 1080, `tablet` 1024 x 1366, `phone` 390 x 844, the phone with its browser bars in (`phone750`, `phone667`,
  `phone590`), and three for the windows nearly square that have a phone's controls under them (`square` 719 x 720, `low`
  719 x 481, `mid` 719 x 600; see "The fourth job"). Four seasons, ten shapes, 40 stills, each as AVIF and WebP under a byte
  budget (`BUDGET`).
- The tool writes the stills to `public/first/`, what each was drawn from to `public/first/stills.json`, and a table into
  `index.html` between `/*first:begin*/` and `/*first:end*/`.
- The table holds: the stills (size, where the glass is in each, a version for the URL, the soft picture that goes with it,
  where the foot of its globe ends), the app's framing as a row for an aspect over the height of the
  controls, and the heights of the controls by the interface's media rules (both read from the built app, never copied as
  constants; see fault 1), and the soft inline pictures.
- The page script picks the still whose shape is nearest the screen, and lays it so that its glass is exactly where the table
  says the app will put the glass on this screen. Where the still does not reach an edge of the screen, up to four copies of
  it lie under it, each only so much larger than the picture over it that its glass and its foot stay hidden (see "The
  fourth job").
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

Every still is stale after any change under `src/` or `config/`, also one that moves no pixel of the first picture (during the fourth job main's change
to the masters' settings in the config and then the fourth job of the change of season, four files under `src/`, each made
all of them stale, and the files came out the same bytes): the full run draws all 40. Timed on
Mesa lavapipe at b91bdb3b: the measure of the controls 5 s; the table 250 s the first time on a build
(61,822 places of the framing asked) and nothing the second time, since the answers are kept in
`out/work/poster/framing-<build>.json`; the ten stills of a season 123 to 151 s; the whole run 13 to 14.5 min; `--check`
2 s after a run on the same build. A run on an unchanged scene draws the same files, byte for byte (seen three times
in the fourth job: the 28 older stills after the first two were added, the 36 older ones after the third, and all 40 again
after main's change of `src/core/materials.ts`).

`--season winter,fall` and `--shape phone,wide` redraw those whatever they were drawn from; with `--only` nothing but those is
drawn (and `node tools/poster.mjs --only` alone draws nothing and writes the table anew). `--keep` keeps stills drawn from
another build when the framing is unchanged; use it only for a change known to move no pixel. `/root` was asked to add
`"poster": "node tools/poster.mjs"` to `package.json`.

Commit `public/first/` and `index.html` together: the table names the stills by content version. The recipe of the folder,
in the form of `kit/06-ASSETS.md`, is `assets-src/first/RECIPE.md`.

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

### 1b. A faint arc over the glass on screens no still is drawn for (mended in the fourth job, b91bdb3b)

Mended, with the three other forms of the same fault: see "The fourth job". What was written at f577539f:

On the tablet 820 x 1180 the still does not reach the top of the screen, a larger copy of it lies under it there, and the
still thins out into the copy over 66 px. The copy's own glass, 14 % larger, shows its top highlight through that thinned
edge: a faint arc about 45 px over the real glass (p2-tablet-arc.jpg). It goes when the live picture takes over. It was so
before this job; the geometry is the same as on the merged build. The mend is in `index.html`, `lay()`: the thinning must end
before it reaches the copy's glass.

### 2. The stills on the head are stale (mended: all 40 are drawn by one run on the engine of b91bdb3b)

They go stale again with the next change under `src/` or `config/` on main. What was written at 9bcc9fdc:

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

A screen gets the still of the nearest shape, laid so that the glass is exact. On a shape far from all ten (a very wide
window, a tablet between the stills) the room behind the glass is a little off until the live picture comes in, and
copies fill what the still does not reach (see "What stays" under "The fourth job"). Stills lose fine detail at
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

## The fourth job: one globe on any screen, and stills for the windows nearly square

Head b91bdb3b (main a0d81a5c merged in). All 40 stills were drawn by one run on that engine. `node tools/poster.mjs --check`
printed `poster: pass · 40 stills and the table agree with the framing (108 aspects and 563 bends, with both sides of the 2 steps the framing makes, read within 0.099 % of the height from the app and within 0.218 % where its rows are as near as they go (61822 places asked, 0 s))`.

### What was wrong

Where a still did not reach an edge of the screen, one copy of it lay under it, drawn larger about the glass until it did.
The copy's globe showed wherever the still thinned out or ended. One fault in four forms, each seen:

- tablets no still is drawn for (820 x 1180, 834 x 1210, 853 x 1280, 912 x 1368): a faint arc over the glass (1b above);
- windows nearly square (600 x 600, 650 x 561), which got a phone's still: a whole second globe at both sides;
- low touch screens (650 x 550): a bright cap at the top and a second foot past the bottom;
- wide low windows (1920 x 600): a second wreath under the foot.

### What stands now

- `index.html`, `copies()` and `lay()`: as many copies as it takes, up to four (`MOST`), each only so much larger than the
  picture over it that its glass (with a rim of 2 %, `RIM`) and its foot stay behind the part of that picture that does not
  thin out. A picture thins out over at most 6 % of the still's longer side (`SOFT`) and at most three times the band it
  leaves bare. The fewest copies are taken that leave every picture its whole part to thin out in; where four do not reach,
  all parts are cut by one share. Any shortfall gets a copy, however small (at 320 x 658 a sliver of 0.02 px stayed open
  while the rule asked for half a pixel).
- The row of a still in the table ends with where the foot of its globe ends, as a share of the height. `tools/poster.mjs`
  reads it from the framing (`edges(rig).heap`), so the page keeps clear of the foot the app draws.
- Three stills more a season: `low` 719 x 481, `mid` 719 x 600 and `square` 719 x 720, at two pixels a point. A window under
  720 px wide and from 481 px high has a phone's controls (154 px), and there the camera stands by the height of the window
  alone. So a still 719 wide is every narrower window of its height, whole, and three heights serve the family:
  on the grid `low` gets the windows up to 569 px high, `mid` those from 570 to 654 and `square` those from 655. `mid` is
  where half the screen of a small laptop falls (683 wide and 600 to 645 high, of a screen 1366 x 768), and it is the
  square window of 600 x 600 exactly. A soft picture of `low` is in the page for their first paint.
- The 24 added files weigh 1,766,561 bytes in the repository (`square` 586,777, `low` 589,288, `mid` 590,496; an AVIF 54.9
  to 59.6 kB, a WebP 87.3 to 90.0 kB). A visitor fetches one of them. All 80 files of `public/first/` are 5,888,611 bytes.
  The page is 34,574 bytes (29,832 before this job; the limit of the test is 40,000).
- A simpler means was weighed and not taken: the soft picture at the sides instead of copies. It is the room from another
  camera, out of focus beside a sharp still, with a seam where the two meet; a still of the window's own shape is the app's
  own picture to the edge.

### The grid

20,104 screens, 300 to 3840 wide, 280 to 2600 high, with a mouse and with a finger, laid by the page's own script
(`out/work/tmp/scan3.mjs`, a scratch file, not in the repository; `tests/first-frame.test.ts` holds the same rule on a
grid of its own).

| on the grid | before (9d00c74a) | after |
| --- | --- | --- |
| a second glass or foot shows by over half a pixel | 8,195 screens, at worst by 144.7 px (1700 x 2556) | 0 screens |
| screens with no copy at all | 3,593 | 6,114 |
| the still leaves over 5 % of the screen to copies | 9,576 | 6,404 |
| over 10 % | 6,491 | 3,732 |
| over 20 % | 3,874 | 1,640 (at worst 43.5 %, 890 x 280 with a finger) |
| distance of the still's camera from the screen's (what `choose()` picks by), mean | 0.1501 | 0.1248 |

The windows nearly square with a phone's controls (under 720 wide, from 481 high, aspect from 0.7) are 1,630 of the grid:

| on those 1,630 | before | after |
| --- | --- | --- |
| the stills they get | `phone590` 1,406, `hd` 210, `phone667` 8, `wide` 6 | `low` 618, `square` 590, `mid` 414, `phone590` 6, `phone667` 2 |
| bare at a side: median, nine in ten, most | 46, 114, 147 px | 0, 0, 15 px |
| a side bare by over 3 px | 1,316 windows | 20 windows |
| share of the window left to copies, mean | 21.5 % | 0.3 % |
| camera distance, mean and worst | 0.1320, 0.483 | 0.0235, 0.21 |

With `low` and `square` alone (the state before `mid` was added, measured the same way): a side bare by over 3 px on 58
windows, any edge on 312 (the bottom by up to 26.7 px at 590 x 621), camera distance 0.0323. With `mid`: 20, 282 (the bottom
by up to 17.7 px at 610 x 655) and 0.0235. A third still does not end the bands, it makes them a third lower, and it is the
window's own camera around 600 px high.

### What stays

- Copies still fill the bands a still does not reach: the top and the bottom of tablets between the stills (820 x 1180:
  60 px at the top, 27 px at the bottom, three copies), the sides of wide low windows (1920 x 600: 275 px a side, three
  copies; the lights out of focus in the room repeat there, larger and dimmer, far out at the sides), the bottom of square
  windows on a desk, which get `hd` (1000 x 1000: 18 px, one copy). A copy shows the room, never a second glass or foot.
  Only the glass and the foot are kept clear by the rule, not the dressing beside the foot.
- Windows nearly square between the three heights: 282 of 1,630 have an edge bare by over 3 px. `mid` on 102 (570 to 591
  high, the bottom by up to 10.4 px), `square` on 174 (655 to 992 high, the bottom by up to 17.7 px), `phone590` on 6
  (450 to 470 wide, the sides by up to 8.7 px). One copy fills each.
- `choose()` picks the still by the nearest camera, not by cover: a window just lower than a still's own height gets that
  still with a band under it, where the next lower still would cover it. It was not retuned in this job (fault 3 of the
  second job, the tablet 820 x 1180 on the 1024 x 1366 still, is the same matter).
- A shortfall of a hundredth of a pixel gets a copy too (600 x 600 on `mid`: 0.01 px at the bottom). It is one more picture
  of the same file under the still and cannot be seen.
- Four screens of the grid (touch windows 860 to 890 wide, 281 to 288 high) get a third copy for a band of 3 px at the
  bottom, thinned out over 7 px.
- During the fade the lights out of focus behind the glass stand displaced where the still's camera is not the window's.
  Seen at 600 x 600 while it got `low` (by about their own size); with `mid` they stand in place there. It stays on windows
  between two stills' heights and on the tablets between the stills.

### The first paint waits for the soft picture

Found, mended and measured by `controls_finisher` in its walk, taken in here with its two lines: now and then the page
painted its flat dark ground for 0.3 to 0.9 s before the soft picture, when the parser stopped between the start of the
body and the end of the script that lays the picture (a busy processor, a slow line). The head now holds
`<link rel="expect" href="#first-laid" blocking="render" />` and an empty hidden element with that name stands right after
the script. A browser that knows the link (Chromium from 124 and Safari from 18.2, by its reading) paints nothing until the
element has been parsed, so its first paint has the soft picture in it; any other browser ignores the link. Its numbers: under the load of
a walk 4 flat first paints of 100 before and 0 of 100 after; on a slow line 60 of 60 before and 0 of 60 after.

Seen here on the built page, Chromium 147, 820 x 1180, the app's script held back (`out/work/tmp/expect.mjs`):

| the page | sent | first paint | the soft picture laid | the first paint shows |
| --- | --- | --- | --- | --- |
| without the two lines | in two parts 400 ms apart | 20 to 56 ms | 409 to 414 ms | the flat ground, 3 of 3 |
| with them | in two parts 400 ms apart | 512 to 524 ms | 408 to 411 ms | the picture, 3 of 3 |
| without | whole | 148 and 156 ms | 25 and 35 ms | the picture |
| with | whole | 136 and 140 ms | 21 and 23 ms | the picture |
| with, the script throwing at its first line | in two parts | 412 and 416 ms | never | the flat ground |
| with, the script throwing | whole | 28 ms | never | the flat ground |

So a page whose script throws still paints, once the element is parsed. Not seen: a browser that does not know the link.
The switch tried to take the feature out of Chromium 147 (`--disable-blink-features=DocumentRenderBlocking`) changed
nothing, so that row is an argument, not a look: an unknown `rel` is ignored and the element is hidden and empty. Also
not seen: what a visitor looks at while the paint is held. A picture asked 250 ms into a hold of 800 ms did not come within
400 ms (the browser had no frame to give); the page without the two lines gave its flat ground in 11 ms (seen). It should be
what the browser showed before (the page left, or an empty tab), where it was the flat ground. After the hold the two pages
show the same picture (0 of 255 apart, seen at 600 x 600).

### Two faults of the tool, found and mended

- A run that began with a shape drawn at two pixels a point was grabbed at one: the first shape of a run now gets its window
  by `Emulation.setDeviceMetricsOverride` before the page is opened, as the others get theirs.
- Between two rows of the framing's table the tool read the app at three places. With a row just under a square screen it
  passed over the turn the framing makes between a square screen and one a twentieth broader, where the controls stand
  low. It now reads at every place a row could stand (`FINEST.aspect`).

### Checks

- `npx tsc --noEmit` exit 0; `npx vitest run`: 54 files passed and 1 skipped, 702 tests passed and 8 skipped (4 of `tests/mix.test.ts` and the 4 of `tests/shake-looks.test.ts`, none of this work), exit 0; `npm run build` exit 0; `--check` as quoted above.
- The page's reading of the glass against the page before, on 99,550 screens (`out/work/tmp/tablecmp.mjs`):
  mean 0.0016 % of the height; 8 over 0.1 %, none over 0.2 %; 41 over 1 px, at worst 1.38 px (930 x 1196 with a finger).
- The files of the stills that were there before this job came out of the full runs the same, byte for byte:
  the 56 files of the 28 older stills in both runs (`git status` showed none of them changed), and the 80 files of the second run are the 80 of the first (SHA-256 of each).

### Seen and not seen

Seen with my own eyes, on the built page with the app's script held back (first paint and still), Chromium 147 with
lavapipe, one pixel a point. The 15 screens that kept their still when `mid` was added came out the same pixels after it
(0 of 255 apart), and were looked at before it:

- Tablets 820 x 1180 and 912 x 1368 (winter), 853 x 1280 (spring), 834 x 1210 (summer), three or four copies: the whole
  pictures, and their tops at three times the brightness. No arc over the glass, no line where the bands at the top and the
  bottom begin.
- Windows nearly square: 600 x 600 winter, 683 x 630 fall, 590 x 621 winter, 620 x 640 with a finger spring (`mid`);
  650 x 561 and 700 x 500 fall, 650 x 550 with a finger spring, 500 x 500 summer (`low`); 673 x 841 with a finger winter,
  700 x 900 spring, 694 x 768 with a finger fall (`square`). One globe, the whole room, nothing repeated.
- Windows with a band under the still: 640 x 580 spring (`mid`, 7 px) and 610 x 655 summer (`square`, 17.7 px, the worst of
  the family). No line at the bottom.
- Wide low windows: 1920 x 600 fall (three copies), 2660 x 837 summer (two), 1820 x 572 with a finger winter (four). No
  second wreath or base, no cap; the sides read as room; the lights out of focus repeat far out at the sides. 1000 x 1000
  fall (`hd`, one copy): a band at the bottom, no line.
- No page error on any of the 21 screens.
- The takeover, the app running: 600 x 600 winter on `mid`: the glass in the same place and size (0 px in four windows
  around it, 1 px in the fifth), the lights of the room in place, the still against the live picture 9.9 of 255 in the mean
  (the controls and the darker ground under them, the reflection under the base, the snow inside the glass). 694 x 768 with
  a finger, fall, on `square`: 0 px in four windows, 1 px in the fifth, 7.9 of 255. No page error on either.

Numbers only, not looked at: the grid, the page's reading of the table, the weights, the first paint's times.

Not seen: a real phone, tablet or GPU; any browser but Chromium 147; the fade as motion; spring and summer in a takeover;
every window of the family in every season (each was seen in one or two); what stands on the screen while the first paint
is held (a picture asked 250 ms into the hold did not come within 400 ms, where the page without the two lines gave its
flat ground in 11 ms). The stills of the second full run, the ones committed, were not looked at again: all 80 files are the same bytes as those of the first run, which every picture named here was taken from.

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
