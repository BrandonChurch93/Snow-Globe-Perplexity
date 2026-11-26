# The farm: how one machine joins, and how the joining machine checks what came

The films are drawn in ranges by many machines and encoded once by one. This page is the short road. The long one is "The master" in `tools/README.md`.

## A machine joins

1. Set it up. On Debian: `bash tools/farm/setup-debian.sh`. That script is written by `farm_machine_2` on the branch `agent/p6-farm-setup`; take it from there. It must leave: a clone at the ONE commit of `main` that `/root` names, `npm ci` done, ffmpeg and ffprobe with libx264, the pinned browser (`tools/browser.json`), Mesa 26 or newer with lavapipe (`mesa-vulkan-drivers`), and `npm run build` done. By hand, the same lines are in `tools/README.md` under "A render agent".
2. Calibrate: `npm run master -- --calibrate`. One fixed picture, a few minutes.
3. Read the two lines it must print.
   - The first line of every run: `limits: N GiB of memory, C CPUs`. That is what the machine may really use (its cgroup's limit, not the node's numbers). If it is not what you were promised, say so before you draw.
   - `calibration <sha256>`. It must be the line `/root` names, the same on every machine that draws for one master. A machine that prints another line draws nothing: tell `/root` the line and stop. (Build `4708b960e00eb5d2`, lavapipe, one sandbox machine: `ba63d3b2ceb11deb5db2ee01024ba807d9354f4447e9d849af15add72629607d`.)
4. Draw the range `/root` gave it. The range lies on chunk lines of 30 frames; one off the lines is refused with the nearest that are.

```
npm run master -- --what film-b --first 600 --last 899 --ship agent/p6-chunks-NAME
```

- `--what` is `film-b`, `loop` or `opening`. `--ship` is optional: it pushes each chunk's record and look (small) to a branch of the machine's own, never the picture.
- `--procs P` only when the memory holds it: about 4.1 GB a process at 4K with 24 samples, and the tool refuses more. On 8 CPUs a second process adds about 10 percent and a third nothing; the tool says so and runs.
- Never `--local`: it opens the installed Chrome in a window with a graphics card, which is another renderer.
- `NOT A NUMBER: film-b frame F holds N values ...` means the picture's mean of that frame held values that are no number, which the lens spreads into a dark speck. The tool has read the count after the frame, kept its PNG under `out/work/master/<what>/not-a-number/`, marked the chunk `NOT A NUMBER` in its record (its intermediate exists for looking and no master is ever encoded from it), and drawn every other chunk; the run ends with an error that lists the frames. Tell `/root` the frame and the count, and send the other chunks. Never draw it again hoping: the same frame on the same build draws the same values, and the mend is a change of the engine, which is `/root`'s to name.
- To stop and go on: run the same command again. A drawn frame is never drawn twice. When a process stops by itself, the last line of the run is the exact command that goes on.

## How its chunks travel

The picture never goes through git. When the range is finished the tool prints:

```
to send to the joining agent by attachment: N files, ... MB, none over 45 MB, in M messages of at most 10:
  message 1: out/master/film-b/film-b-000600-000629.json out/master/film-b/film-b-000600-000629.mp4 ...
```

Send exactly those files, in those groups, to the joining agent: at most 10 files a message, every file under 45 MB (the tool has cut a larger one into `.part-` files). Names and order do not matter on the other side. Keep `out/master/` until the joining agent says the range is there.

When a push fails (the sign-in is away on and off): nothing is lost and the render goes on. The tool tries a push 4 times, 5, 15 and 30 s apart, then again after the next chunk and at the next run. If a run cannot even start because the remote asks for a name, start it without `--ship`. The join does not need the branch: every record is among the attachments. If the branch is wanted anyway, attach it as one file, a bundle (a code change travels the same way, `git bundle create NAME.bundle origin/main..HEAD`):

```
git -C out/work/master/ship/* bundle create "$PWD/chunks-NAME.bundle" HEAD
```

## The joining machine checks what came

Save every attachment into one flat folder, under any names. Then:

```
npm run master -- --collect out/work/collected --files out/work/inbox --no-branches
```

`--no-branches` skips the fetch of the record branches; leave it off when the sign-in works. A bundle is checked with `git bundle verify FILE` and read with `git fetch FILE HEAD:refs/heads/chunks-NAME`. What `--collect` does and prints:
- It finds the records by what they hold, and takes each chunk or each set of parts only if its sha256 is the one its record names. Parts are put together again.
- `NOT COMPLETE: ...` names a chunk whose file or part has not come yet. Ask its machine for exactly that file.
- It decodes every chunk it took. `FLAT: ...` names a chunk and its machine with a frame of one flat value: that range is drawn again, never encoded.
- One line a timeline: how many chunks of how many, the ranges that are there, the ranges that are missing.
- `NOT A NUMBER: ...` names a chunk, its machine and its frames (with each count) whose mean held values that are no number. It is never encoded; `/root` is told the frames.
- It ends with an error while anything is `NOT COMPLETE`, `FLAT` or `NOT A NUMBER`.

Then one encode a film: `npm run master -- --encode film-b|film-a|loop --from out/work/collected`. It refuses a gap, two builds, two renderers, two calibrations, two sample counts, a test chunk, and a chunk marked `NOT A NUMBER`, each with a plain list.

## One rule for every agent that touches raw video

ffmpeg 8 takes raw yuv without tags as full range. Whoever pipes raw frames into it writes `-color_range tv -colorspace bt709 -color_primaries bt709 -color_trc bt709` before that input. Two streams are compared only on the same time base (`settb=1/60,setpts=N`).
