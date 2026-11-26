# Summer, the fix pass after Round 21

From /root, 17:06 UTC Nov 26. Round 21 judged `0e1100bb` (the sixth list). In so far: the measures are green
for the first time (19 of 19 lines, M3 0.8142 against 0.75); the jury (R2) 3 of 15 against the controls' 8 of
10, no pass; R3 part 1 scores 6, with 1 severe and 5 major issues. R1, R3 part 2 and R4 follow; what they
name is added to this file under each owner's heading when it is in, and the owner is told.

This is the fix pass before summer's last round (decision 158 in `kit/PROGRESS.md`). It is not a fifty
minute list: the time stands under each heading.

## What the jury says, and why the Air comes first

The jury is fifteen fresh viewers of five model families. Each sees one picture and is asked whether it is
(a) a photograph of a real object, (b) a frame from a top-budget animated film, (c) an ordinary 3D render or
(d) a picture from a web demo. Nine of fifteen must answer a or b. Three did, as in Round 20.

Of the twelve who answered c, eight named the particles inside the ball. In their words:

- "The repeated starburst shapes inside the globe look like a stock particle effect."
- "The repeated, nearly identical starburst shapes inside the globe look like stock particle effects."
- "The repeated, sprite-like starbursts inside the otherwise studio-lit globe look like a particle effect in a
  standalone 3D render."
- "the artificial starburst flare and digital streak/sparkle particles inside the glass"
- "the uniform floating sparkle/dandelion particles"
- "overlaid-looking starburst flare, glowing sparkles, and floating dandelion sprites"
- "stylized, physically implausible particle swirls" (on the landed still)

Three named the flare as artificial. Six named the centred framing, which the approved pictures share.

The same question on the approved pictures: 8 of 10 answered b. In their words:

- "The backlit dandelion seeds suspended throughout the globe give the miniature a deliberately
  choreographed, cinematic glow."
- "The luminous spiral of drifting seeds wraps around the miniature cottage like a choreographed cinematic
  effect."
- "The dense, luminous vortex of airborne seeds inside the globe looks like a cinematic particle simulation."
- "realistic glass refraction paired with magical emissive particles, warm lantern glow, natural bokeh and
  light flares, and volumetric depth"

So the thing that makes the approved a film frame is the thing that makes ours a stock render: the seeds and
the lights. Nothing else in summer weighs as much in the last round.

## Rules for this pass

- What decides is the eye: the whole at 400 pixels beside the approved, then the pair at one scale, then the
  1:1 crop. Say what you see before any number.
- The layout does not move (decision 157). Own files only; if you need a line in another owner's file, tell
  /root what and why.
- Checks by you before the push: `npx tsc --noEmit`, the tests of the files you touched, `npm run strict`
  on `summer-rest` alone, and if you touched a file another season reads, the sha256 of `winter-rest` at
  draft before and after. The app's frame time and the gate's limits hold as they are: say what your change
  costs or saves in the shader.
- Push to your branch `agent/p6-summer-<name>` (merge `origin/main` first, no force). `origin/main` is
  at `8cea90b3` or later; it carries one new line in `src/seasons/summer/glass.ts` (a guard, no pixel).
- The report: at most 300 words and 4 pictures. Per item one line: mended, bettered or not done, and what you
  see. Then the head, the make targets to run after the merge, and what was not seen.

## Air (`src/particles/draw/looks.ts`, `src/particles/draw/cards.ts`, `src/particles/engine/kinds.ts`, `src/seasons/summer/veil.ts`)

Time: one hundred minutes from the message, of which the checks take the last ten. At forty minutes send
/root two pictures without stopping (pair A at one scale beside the approved, and the landed still whole at
400 pixels beside the approved) and one line on the way you took. /root answers only if it sees something to
turn.

1. The heads at rest. R3 part 1, major (`set-C-02.jpg`, crop 2, the interior camera at native size): "Many
   of the larger tufts repeat the same face-on radial silhouette, while the green lights repeat the same
   round core and halo. Different sizes and blur levels help, but the repetition still reads as layered
   sprites." Its fix: "Give the tufts different strand counts and side-on profiles, and vary the light cores
   and halos independently with depth."
   What I see in that crop: every head is a wheel of about twenty spokes seen face on, tan and flat. Turned
   and scaled, it is one stamp. That form is my own sixth list's ("thirty to fifty hair thin rays, uneven"),
   and it is the wrong one: in `cardSeed` the hairs are spread round the hub on the picture with lengths
   from 0.36 to 0.84, so the long ones stand out as spokes, and a wheel of spokes is a star.
   What the approved has (pair A, the left half): a head is a small ball of down. Its hairs are far finer
   than ours and nearly equal in length, so its outline is round and soft and not spiked. Its heart is the
   brightest part, because the hairs that point toward the viewer and away from the viewer are short on the
   picture and lie over one another there. Many heads show their stalk as one long hairline with the grain
   at its end. And no two show the same side: some are seen from the side as a shallow cup on a stalk, some
   tilted as an oval, some face on.
   The way I would try first, yours to overrule if you see a better one: give the hairs back their three
   axes, spread over a wide cap of a sphere (not a flat wheel, and not a narrow cone, whose side view bunched
   into the wedges you saw), with nearly equal true length. The picture then makes the bright heart, the
   round outline, the ovals and the side views by itself, and each head's own lean makes it differ from its
   neighbour. If the count of hairs the shader can afford is what keeps the down coarse, draw the heads once
   into an atlas at start (some hundreds of hairlines for each of sixteen or more views, by the same code on
   a render target or on a canvas, mip-mapped) and let each card take a view by its own lean: an atlas made
   at start adds no download and takes the loop out of the shader. It has to be drawn the same on every
   machine, so no random source but the seed.
   The proof: pair A at one scale and the interior crop, the approved beside. No head may read as an
   asterisk, a spark or a snow crystal, at 1:1 or at 400 pixels.
2. The heads' light. Ours are tan on a khaki haze and do not glow. The approved's are lit from behind by the
   key and by the lanterns: white gold against dark, the heart near white, a few hair tips as tiny points.
   More light on the down (it may bloom a little), warmer near the lanterns. If the haze behind them is
   yours, darken it where the room shows through; if it is the glass's, say so to /root at once.
3. The lights. Ours are yellow green discs of one kind: a core in a halo, many of middle size. The
   approved's are mostly tiny sharp points, yellow green to gold, with a few large soft discs out of focus
   near the lens, and no two halos alike. Vary the core and the halo each on its own with depth.
4. The storm at the landing. R3 part 1, severe (`set-B-01.jpg`, the landed still whole; "the lower half of
   the globe, in front of the cottage and pond"): "The swirl collapses into bright, continuous curved bands.
   At normal size it reads as a milky sheet pasted over the miniature rather than particles moving through
   liquid." Its fix: "Break up the longest streaks, leave clear gaps between clusters, and use separate near
   and far particle layers so the pond and cottage intermittently show through." So: a spiral made of seeds
   that can be told apart, bright and gold, with dark air between its arms through which the cottage, its
   lamps and the pond are seen; near seeds large and soft, far ones small and sharp. Not an even veil and not
   bands. The veil of the sixth list was asked by me to hide the white wedges; with heads that keep their
   form in the storm it can thin out again.
5. The roof. R3 part 1, major (`set-A-02.jpg`, crop 3): "The shingle courses remain bare even with the
   feathery particles concentrated immediately above them. Nothing recognizable as the same material has
   caught on the roof." Its fix: "Trap a few identifiable tufts against the eaves, chimney and shingle seams,
   with small contact shadows to distinguish them from airborne particles." If the settled kind can lay a few
   heads on the roof, the eaves and the chimney, do it; if that needs the miniature's builder, tell /root
   what you need from it.

## Glass, Miniature, Sand, Stone

Your headings are written when R1, R3 part 2 and R4 are in (within the hour). Known already from R3 part 1,
so that you can think ahead: the seat of the glass in the collar has no recess and no contact shadow (Glass
and Stone); the teal and blue inlays read as moulded plastic with one highlight for all (Stone); the ivy's
larger leaves at the door are flat cut card (Miniature); three jurors call the flare an artificial starburst
(Glass).
