# Round 2 · blockout (Phase 2, the last blockout round the config allows)

Judged commit `9ade96d` (engine hash `b98352868abb52c6`). Started 2026-11-24 07:57 UTC, part 2 answered 08:21 UTC, part 1 answered 08:38 UTC.

## Scores

| Part | What it saw | Asked on | Score | Severe | Major |
| --- | --- | --- | --- | --- | --- |
| 1 | Ten film sheets: the whole film, the opening with its reveal frame, each shake, each hold | `claude_opus_5_5`, reasoning max | 6 | 0 | 4 |
| 2 | Six camera pairs (approved image beside the stand-in from each camera) and the three screens | `gpt_6_2_astra`, reasoning max | 8 | 0 | 2 |

Merged score: 6, the lower of the two. The bar is `quality.blockoutPass` (7) with no severe issue open. No severe issue is open, and the score is one short. Round 2 does not pass, and it was the last blockout round (`quality.blockoutMaxRounds` is 2). Phase 2 closes at that limit. This is a limit, not a pass.

## Top issues

1. Major, `set-A-02.jpg`, the opening: the pull back starts nearly still and is fastest in its middle. Measured by the critic on the miniature, 15 percent of the zoom is done by frame 52. `cut/SHOTS.md` asks for a move that is already moving in frame 0, fast at first and easing to nothing.
2. Major, `set-A-04.jpg`, the spring hold: at the deepest part of the move toward `base` (frames 928 to 1138) the tree's crown and the top of the dome leave the top of the frame for about 3.5 s.
3. Major, `set-A-03.jpg`, `-05`, `-07`, `-09`, every shake: the locked `hero` leaves too little room above the glass. On the last hop before the landing the crown of the glass comes within about 1 percent of the frame height of the top edge.
4. Major, `set-B-02.jpg`, camera `macro`: the lamp meets the snow almost on the frame edge and the bottom edge cuts the right side of the tree's foot.
5. Major, `set-C-02.jpg`, the phone screen: the speaker icon straddles the pale outline of the reflected base.
6. Major as written by part 1, \"not in pack\": part 1 says the camera pairs and the three screens were not supplied. They were judged by part 2, which received exactly those nine files, as `kit/07-QUALITY-BAR.md` allows when a pack does not fit one critic. Nothing is missing from the round, and this line is not an open issue.

## What changes next

- Issue 1: the pull back is driven by an ease out on the logarithm of the distance, with frame 0 unchanged. Made at the start of Phase 3 in `src/film/moves.ts`; no blockout critic sees it, so it stays an open item until the film's sheets are judged.
- Issue 2: the spring move raises its aim as it nears `base` so the crown keeps room at the deepest frame, and gives up depth before it crops the miniature. Made with issue 1; open until judged.
- Issue 3: carried to the look lock. Phase 3 builds the real shake as a hand model, and its brief holds the path to at least 5 percent of the frame height between the glass and the top edge at `hero` on every frame. `hero` is tied to the approved winter image and to the fill check, so the camera is not pulled back.
- Issue 4: carried to the look lock, where `macro` is framed again on the real miniature (open items 18 and 19).
- Issue 5: carried to Phase 5, where the interface is finished: the sound control moves clear of the mirror image or gets a small dark backing.

## Notes on the round

- Both critics were fresh agents on their own sandbox VMs with only their part of the pack and the pack's message, word for word. Families rotated from round 1.
- Nothing is declined. Issue 3's second suggestion (pull `hero` back 5 percent) is not taken, because `hero` is fitted to the approved winter image; its first suggestion is.
- The machine checks were green for the judged build: G1 to G12 and G14 at 08:09, D2 and D3 at 08:24 once the preview film and the local render proof existed.
