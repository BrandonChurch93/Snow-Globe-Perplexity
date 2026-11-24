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
    { "severity": "major", "file": "set-B-01.jpg", "where": "the collar where the glass meets the base", "what": "the glass ends on a hard line with no seat and no shadow", "fix": "seat the sphere in the collar and add the thin dark line under it" }
  ]
}
```

- `score` is 1 to 10. Issues are listed most severe first.

### Files

- `set-B-01.jpg`: the camera hero, which is for the whole globe and its base, large in the frame; every shake is seen from it with the camera locked, and the globe lifts 13.5 mm off the surface in a shake, so the frame keeps that much room above the glass at rest: the picture marked a is the target, the picture marked b is this camera on the placeholder globe
- `set-B-02.jpg`: the camera macro, which is for the film's first and last frame: the lit cottage, the lamppost and the foot of the tree from close, filling the frame, with no edge of the glass in it; a check keeps every corner of this frame within 0.85 of the glass's radius from its centre: the picture marked a is the target, the picture marked b is this camera on the placeholder globe
- `set-B-03.jpg`: the camera interior, which is for the miniature inside the glass: the picture marked a is the target, the picture marked b is this camera on the placeholder globe
- `set-B-04.jpg`: the camera base, which is for the base alone, filling the width of the frame; each season has its own sculpted base and this camera is how it is judged: the picture marked a is the target, the picture marked b is this camera on the placeholder globe
- `set-B-05.jpg`: the camera surface, which is for the surface the globe stands on, with the foot of the base and its reflection: the picture marked a is the target, the picture marked b is this camera on the placeholder globe
- `set-B-06.jpg`: the camera low, which is for the whole globe from low down, so the face of the base is seen nearly straight on with the dome above it: the picture marked a is the target, the picture marked b is this camera on the placeholder globe
- `set-C-01.jpg`: the app's screen with its controls, 1920 by 1080
- `set-C-02.jpg`: the app's screen with its controls, 390 by 844
- `set-C-03.jpg`: the app's screen with its controls, 1024 by 1366

### Settled

`set-B-01.jpg`

- In -a the globe may sit a little left or right of centre. In -b it is centred. Compare the globe, the base and the surface around them, not where they sit in the frame.
- In -a the dark background carries a faint grid of 8 pixel blocks left by image compression. In -b the background is smooth.
- In -a the snowfall is thin and most flakes are one size. In -b the snow is far denser, with fine and large flakes at many depths, some close to the glass.
- In -a a faint pale band runs down the far left of the frame. In -b it is absent.
