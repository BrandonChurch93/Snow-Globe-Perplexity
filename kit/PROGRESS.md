# Progress

The Builder's memory. Read it at the start of every task and after every compaction. Keep every section. Write `none` where there is nothing.

## Status

- Build: in progress
- Phase: 0
- Review: not reached
- Review round: none
- Review round step: none
- Review rounds: 0
- After review step: none
- Soundtrack chosen: none
- Budget: running
- Continuations: 0
- Extensions: 0
- Extension step: none
- App URL: none yet
- Review page: none yet
- Repo is private: no. Measured 2026-11-24 01:48 UTC through the GitHub API: visibility public. `repo.expectPrivate` is true, so the two disagree and the public rules apply
- Sound files: held back from the repo because it is public. Prompts, settings and measurements are committed as text. The files live in the workspace under `audio/` and in the published app, and one archive of every kept file is attached with each status that follows new sounds and with the REVIEW block

## Latest pictures

The pictures of the newest status, with their captions and the time. Files are in `out/stills/status/`.

Status 1 · 2026-11-24 01:52 UTC

- `out/stills/status/status-1.jpg`: the eight approved images: winter, spring, summer, fall, each at rest and just after a landing

## Clock

Copied from the last tick of `npm run clock`.

```
2026-11-24 01:51 UTC
clock: phase 0, tick of 1.1 minutes
phase 0: 0.02 h used of its 4.00 h box
allowance (before the review): 0.02 h used of 36.00 h allowed
all time before the review: 0.02 h, after it: 0.00 h, in review rounds: 0.00 h, in extensions: 0.00 h
extra rounds: yes
half point: not reached
box end: not reached
budget report: not due
minutes since the last status: 0
```

## Phases

| Phase | State | Started | Ended | Gate evidence |
| --- | --- | --- | --- | --- |
| 0 · Ground truth | in progress | 2026-11-24 01:45 UTC | | |
| 1 · The rough cut | not started | | | |
| 2 · Engine and blockout | not started | | | |
| 3 · The look lock | not started | | | |
| 4 · The other seasons and the changes | not started | | | |
| 5 · The whole globe, the soundtrack and the review | not started | | | |
| 6 · The films and delivery | not started | | | |

## Units

| Unit | State | Rounds run | Best round | Commit | What ended its loop |
| --- | --- | --- | --- | --- | --- |
| `winter` | not started | 0 | | | |
| `spring` | not started | 0 | | | |
| `summer` | not started | 0 | | | |
| `fall` | not started | 0 | | | |
| `change` | not started | 0 | | | |
| `globe` | not started | 0 | | | |
| `film` | not started | 0 | | | |

### Parts

A summary of `parts/PARTS.json`: every part that is not `built`, with its state and why.

none

## Workspace record

Measured in Phase 0.

none

## Tool record

The inline display method. What can be called. The sound tools, with their test calls. The audio evaluation tool. The names of the prompt screen skill and the audio map skill, or that they were not found. The terms that were read. The hosting limits.

### Inline display

- Method, proven 2026-11-24 01:52 UTC with `references/approved/contact-sheet.jpg`: the pictures are written into one JSON file, `out/work/status/gallery.json`, as `{"lines": [...], "pics": [{"label", "w", "h", "src"}]}` where `src` is a JPEG data URL at most `status.pictureLongEdgePx` on the long edge. The file is shown with the inline visualization tool, passed as a JSON source named `pics`, through a small widget that creates one `img` per entry and sets its `src` from the data URL. The picture appeared in the thread with no download.
- External URLs and workspace paths are not used as image sources: the widget's content policy allows only `data:` and `blob:`.
- A source file may be at most 10 MB. Four pictures at 1200 px come to well under 2 MB.
- Links cannot be clicked inside the widget, so the app and review links are also written in the message text.

## Pinned versions

none

## Render budget

Seconds per sample at each format, the cost of one simulated second, and the time each long job should take. Measured in Phases 0, 2 and 3.

none

## Judged list

Written in Phase 2. The film's part is replaced once in Phase 6.

none

## Look lock

Written at the end of Phase 3: what was learned from the real photographs and footage, every locked setting, what worked, what did not, and the five recipes.

none

## Sound

Every cue with its state: kept, open, or not made yet. Takes used. Which candidate soundtracks exist. After the review: which soundtrack was approved and where it came from. Credits spent on sound in all.

none

## Card

The season of the card loop, and the votes of the pick if it was run.

none

## Decisions made by the Builder

Numbered. What, why, and the date.

none

## Notes from Brandon

Numbered, in his words, with the date and how each was applied. Review round items carry their round's number.

none

## Probe results

none

## Declined issues

The issue, the critic, the round, and the approved image or stated choice it would have moved away from.

none

## Open items

Severe and major issues still open when a limit was reached: the unit, the still, the critic's words, what was tried, what to try next.

none

## Review items not done

none

## For Brandon to decide

Things only he can settle. Nothing waits on them.

none

## Running jobs

The command, the range, the log file, the VM, the time it should take, when it started.

none

## Running agents

The name, the branch, the folders it owns, its job, its limit, when it started.

none

## Rounds

One line per round: its number, the unit, the commit it judged, each part ticked off as it finished, the scores, and what changed next.

none

## Final scores

From the record round.

none

## QA results

One line per item of `kit/09-QA-GAUNTLET.md`, with its evidence.

none

## Failed QA items

none

## Last report block

The last `REVIEW`, `BUDGET REPORT` or `BUILD COMPLETE` block, exactly as it was posted.

none

## Push log

- 2026-11-24 01:49 UTC: `4c24ecc` pushed to `main`. The first push of the build succeeded.

## Session log

One entry per task: when it started, what it did, where it stopped.

### Task 1 · started 2026-11-24, about 01:45 UTC

- 01:45 to 01:49: pulled the repo at `6cc59f6`, checked stop condition 1 (manifest present, all nine hashes match, every image named in `keys` exists), read `AGENTS.md` and the kit in its reading order. No addenda. This reading time is before the clock existed and is not counted by it.
- 01:49: Phase 0 step 1. Wrote `in progress` under "Build" and pushed.
- 01:50: steps 2 and 3. `package.json` created. `npm run clock`, `npm run look` and `npm run progress` built. Clock started.
- 01:52: step 4. The contact sheet was shown inline in the thread. Repo measured public. First status posted.
