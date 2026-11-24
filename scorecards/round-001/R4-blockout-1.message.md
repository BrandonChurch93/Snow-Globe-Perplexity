### R4 blockout · Phase 2 only

You are told the images are an unfinished blockout made of placeholder shapes.

- Pack: the whole film sheets from the blockout, one sheet across each shake, the framing of each camera in `cameras` on the placeholder globe beside the approved winter image, and the app's screen with its controls in the three screen formats.
- Judge only: whether each camera frames what it is for, the order and pace of the shots, whether the opening shows no edge of the glass in its first frame and shows one by the frame marked as the reveal, whether each shake is the same length and lands where the next shot begins, and whether the controls are placed well and clear of the globe.
- Do not judge the glass, the materials, the particles, the light or the realism. None of it exists yet.
- A pair may come with lines headed `Settled`. Each names one difference from the target that is intended. Do not list it as an issue and do not lower the score for it.
- Score 10 when the cameras, the timing and the layout could be finished as they are.

### The severity scale

Every critic uses this scale, so small things are not inflated.

- `severe`: a viewer would notice it at once, in the app at normal size or in the playing video at normal speed.
- `major`: visible on a still at delivery size when you look for a moment. A native-size crop is delivery size.
- `minor`: visible only when zoomed past delivery size, or only by measuring against the target.

### The answer

Return one JSON object in this shape and nothing else.

```json
{
  "critic": "R3",
  "score": 7,
  "pass": false,
  "issues": [
    { "severity": "major", "file": "set-A-01.jpg", "where": "the collar where the glass meets the base", "what": "the glass ends on a hard line with no seat and no shadow", "fix": "seat the sphere in the collar and add the thin dark line under it" }
  ]
}
```

- `score` is 1 to 10. Issues are listed most severe first.

### Files

- `set-A-01.jpg`: the whole film in 12 frames, every shot at least once
- `set-A-02.jpg`: the shot open: a hold on winter. The first frame of the film is the one labelled 0 0.00 s, and the frame marked as the reveal is the one labelled 180 3.00 s reveal
- `set-A-03.jpg`: the shot shake-1: one sheet across the shake from winter to spring
- `set-A-04.jpg`: the shot spring: a hold on spring
- `set-A-05.jpg`: the shot shake-2: one sheet across the shake from spring to summer
- `set-A-06.jpg`: the shot summer: a hold on summer
- `set-A-07.jpg`: the shot shake-3: one sheet across the shake from summer to fall
- `set-A-08.jpg`: the shot fall: a hold on fall
- `set-A-09.jpg`: the shot shake-4: one sheet across the shake from fall to winter
- `set-A-10.jpg`: the shot close: a hold on winter
