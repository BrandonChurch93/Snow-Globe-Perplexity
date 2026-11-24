# 10 · Kickoff

For Brandon. The Builder does not act on this file.

The reference run is done, and you approved its eight images on 2026-11-23. This is the build. It runs start to finish with one stop: when the globe is finished it shows you everything and plays you the soundtrack it made. You can send notes as many times as you like. When you approve, it cuts the films to that sound and delivers.

## Before you start

1. Make the repo private, in its settings on GitHub. The sound tool's terms do not allow its sound effects to sit as loose files in a public repo. With a private repo every sound is saved with the build. With a public one the build still runs, and the sounds are kept out of the repo and attached to the thread for you.
2. In Computer, check that the GitHub connector and the ElevenLabs connector are still connected.
3. Use your highest effort setting with Multiagent on.

## Start the build

Paste this prompt.

```
BUILD MODE.

Repo: https://github.com/BrandonChurch93/Snow-Globe-Perplexity

Pull the repo. Read AGENTS.md, then kit/00-README.md, then the kit in its reading order. Build the whole thing from the kit: work every phase in kit/08-BUILD-ORDER.md in order, close every gate by passing it or by reaching its limit, run the critic rounds inside their limits and the clock, and log everything in kit/PROGRESS.md.

Run this as one continuous task. Do not ask me questions. Decide, log the decision and continue. Stop only at the review stop, the budget report, BUILD COMPLETE or a blocker as AGENTS.md defines one.

Show your work as you go, as AGENTS.md says: statuses with pictures displayed inline in this thread at the rhythm it sets, and the app published as it grows so I can shake the globe myself. If I write in this thread, apply it and carry on.

Use supporting agents wherever the kit calls for them. Do not lower the bar to finish sooner.
```

## What you will see, in order

1. A first status showing your eight approved images, proving pictures show up inline.
2. A link to the app, and a review page at the same address under `review.html`. Everything the build shows you is also there.
3. A status with pictures at least every half hour, and one at the end of every round and every finished unit.
4. A rough cut of the film made from your approved images. The build does not wait for you.
5. The blockout: the whole globe working with placeholder shapes. You can already shake it through four seasons.
6. Winter, finished first, with the shake. Every shared technique is proven there.
7. Spring, summer and fall, built side by side. Then the four changes between them.
8. The whole globe, polished, and the soundtrack. Then `REVIEW`, the one stop.
9. After you approve: the films cut to the sound, the prompt opening of film A, the card loop, and `BUILD COMPLETE`.

If the time you allowed runs out first, you get `BUDGET REPORT` instead, with what is done and what is left.

## Steering while it runs

- If a status shows something going the wrong way, say so in the Computer thread in plain words. The Builder applies it and carries on.
- For anything bigger, bring it to the planning chat. It goes into the repo as a numbered addendum, and the build picks it up at its next phase or its next push.
- If you want the build to differ from one of your approved pictures on purpose, bring that to the planning chat too. It is added as a settled difference, so the critics stop asking for the picture on that point.

## The review stop

When the globe is finished the task ends with a block headed `REVIEW`. It gives you links to the app and to the review page.

1. Open the review page and go to Listen. Each soundtrack plays against the film. Under them every sound can be played on its own.
2. Open the app and shake it. Turn the sound on.
3. Watch the cut. It is on a placeholder beat until you approve the sound.

### If you want changes

Send this as many times as you like. Each one is a bounded piece of work that ends with the `REVIEW` block again.

```
BUILD MODE.

Review notes.

Pull https://github.com/BrandonChurch93/Snow-Globe-Perplexity and continue from kit/PROGRESS.md. Read AGENTS.md and kit/addenda/ first. Same rules.

What to change:
<your notes, in plain words. Name the sounds or the music you mean, and say what is wrong with each>
```

### When the sound and the globe are right

Replace the lines in angle brackets. If you would rather use your own audio file, attach it and write "my own file" on the Soundtrack line. Your file is only used as the music when that line says so.

```
BUILD MODE.

The review is done.

Pull https://github.com/BrandonChurch93/Snow-Globe-Perplexity and continue from kit/PROGRESS.md. Read AGENTS.md and kit/addenda/ first. Same rules.

Soundtrack: <one-piece, four-tracks, or my own file>

Anything else to change:
<your notes, or "Nothing">

Speed results, if you ran the speed page:
<paste them, or leave this out>
```

- If the repo is still public, the `REVIEW` message has one archive of the sounds attached. Attach that same file to this prompt, and to any review notes prompt, so the build works with the sounds you heard.
- The first status after this says, in its first line, which soundtrack the films are being cut to.
- There is no second stop. Anything in your notes that cannot be done inside the limits is listed at the end.

## The limits you have

| What | Value | Config key |
| --- | --- | --- |
| The most the build may run before the review stop | 36 hours | `budget.runHours` |
| The most it may run after you approve | 12 hours | `budget.afterReviewHours` |
| Those two together | 48 hours | |
| The most each round of review notes may run | 3 hours | `budget.reviewRoundHours` |
| Extra time each time you say continue | 12 hours | `budget.continueHours` |
| Longest gap between statuses | 30 minutes | `budget.statusMaxGapMinutes` |
| Pictures per status | up to 4 | `status.maxPictures` |
| Rounds on winter and the shake | up to 5 | `quality.lookLockMaxRounds` |
| Rounds on each other season, and on the changes | up to 3 | `quality.maxRoundsPerUnit` |
| Rounds on the whole globe | up to 2 | `quality.globeMaxRounds` |
| Polish rounds before the review | up to 2 | `quality.polishMaxRounds` |
| Rounds on the films | up to 2 | `quality.filmMaxRounds` |
| The score a part needs to pass | 9 out of 10 | `quality.passScore` |
| Takes of one sound or piece of music, and again each time you name it in review notes | up to 3 | `audio.maxTakesPerCue` |
| The most the hosted site may weigh | 95 MB | `host.maxShippedMb` |

- The time counted is working time. Time when no task is running, and time you spend listening, is not counted.
- These are caps, not forecasts.

## If the build reports at the budget

`BUDGET REPORT` lists what is done, what is left and what it looks like now. To carry on, start a new task with:

```
BUILD MODE.

Continue past the budget.

Pull https://github.com/BrandonChurch93/Snow-Globe-Perplexity and continue from kit/PROGRESS.md. Read AGENTS.md and kit/addenda/ first. Same rules.
```

## If a task ends early for any other reason

```
BUILD MODE.

Pull https://github.com/BrandonChurch93/Snow-Globe-Perplexity and continue from kit/PROGRESS.md. Read AGENTS.md and kit/addenda/ first. Same rules.
```

## To ask for a status at any time

```
Post a status now: the phase, the unit and the round, what changed, what is next, the time used, and the current pictures shown inline. Do not stop working.
```

## After BUILD COMPLETE

Bring it back to the planning chat. Three things happen there:

1. Film B, film A and the card loop are rendered on your Mac, frame by frame at 4K and 60 frames a second, with the sound laid in. The commands are in `README.md`, and the first one renders a ten second test for you to look at before the full render.
2. The repo is connected to Vercel, and the address opens the globe for anyone to shake.
3. The card still and the loop in `deliver/` go onto your portfolio card.

## If you want more polish after it completes

Each of these buys one more bounded polish pass on the open items. Add notes under the last line if you have any.

```
BUILD MODE.

Extension.

Pull https://github.com/BrandonChurch93/Snow-Globe-Perplexity. Read AGENTS.md, kit/PROGRESS.md and kit/addenda/. Run one extension as AGENTS.md and kit/08-BUILD-ORDER.md define it, and end with the BUILD COMPLETE block again.
```

## Two things only you can decide

- Music rights. On the plan the sound tool is on, its terms were read in another build as allowing commercial use of generated music except in "film, TV, radio and Studio Games", with "film" left undefined. The build makes the music and plays it to you either way. Before a film with that music is posted, check with the team that the plan covers it. Your own licensed track drops in at the review with no other change.
- The repo being public or private, as the first step above explains.
