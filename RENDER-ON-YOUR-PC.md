# Render the film on this computer

This file is for a coding agent working on Brandon's own computer. Follow it from the top, alone.
Another agent leads the project from far away and cannot see this machine.

The film is Snow Globe Seasons. Its release files are drawn at 3840 x 2160, 60 frames a second, on the
graphics card of this computer. This file makes four files on the Desktop:

| file | what it is |
| --- | --- |
| `Snow Globe Seasons - With Prompt - 3840x2160.mp4` | the film with its opening, 4,467 frames, with sound |
| `Snow Globe Seasons - Without Prompt - 3840x2160.mp4` | the film alone, 3,600 frames, with sound |
| `Snow Globe Seasons - Portfolio Looping Video - 3840x2160.mp4` | the loop, 480 frames, no sound |
| `Snow Globe Seasons - Portfolio Screenshot - 3840x2160.png` | the first frame of the loop |

On Windows, Chrome draws the film through Direct3D 11. Before this file existed, the film's pictures had been
measured on Linux only, drawn in software. Step 1 is the first time this film is drawn by a Windows graphics
card. That is why step 1 draws a little, compares it, reports and stops.

## Rules for the agent

1. Do not edit any file of the repo. Do not repair code, shaders, settings or tests. A fault is mended by the remote team.
2. Do not commit and do not push.
3. Run only the commands written in this file, exactly as written, one line at a time. Use no other switches,
   set no variables, and do not join lines with `&&` or `;`.
4. Ask Brandon only for a password, a sign in, or a system prompt that asks for his leave.
5. When anything fails, stop. Give Brandon the report file the failing command names, whole, and wait. Do not try
   another way.
6. Do step 1, then stop. Do step 2 only when Brandon says so in his own words, after step 1 has passed.

## How every command here behaves

- Every line is the same in PowerShell and in Git Bash.
- Give every command a time limit of 10 minutes (600000 ms). No command here needs more in one go.
- Each `node tools/handoff.mjs` line prints its last line as one of three words and a sentence:

| last line starts with | exit code | what it means | what to do |
| --- | --- | --- | --- |
| `PASS:` | 0 | the step is done and good | go to the next line of this file |
| `RUNNING:` | 3 | the work goes on in the background and nothing is wrong | run the very same line again, as often as it takes. Start nothing else in between |
| `FAIL:` | 1 | the step did not pass | stop, and give Brandon the report (rule 5) |

- Long work (setup, test, render, check) runs in a process of its own. If a line is cut off by a time limit, or the
  terminal is closed, the work goes on. The same line run again follows it. Nothing is started twice and nothing
  finished is done again.
- Each line writes its report to `out/work/handoff/report-<word>.txt` inside the clone and prints it between
  `===== REPORT: ... =====` and `===== END OF REPORT =====`.
- Every `node tools/handoff.mjs` line is run inside the clone's folder `Snow-Globe-Perplexity`. If node answers
  `Cannot find module` with a path that ends in `tools\handoff.mjs`, you are in the wrong folder: run
  `cd Snow-Globe-Perplexity` once and run the line again.
- Do not use WSL. The tool refuses to run in any Linux layer on Windows, because the film must be drawn by the
  Windows graphics driver.

## Step 1 on Windows: install, check, short test, report, stop

Step 1 draws about two seconds of the film and nothing more. It may be run before the film is released.

### 1.1 The two programs everything else needs

```
git --version
node --version
```

Good: `git version 2.25` or newer, and `v20.19` or newer of 20, `v22.12` or newer of 22, or `v24` and up.

Bad, and what to do:

- git is not found or too old. Run:

```
winget install --id Git.Git -e --source winget --accept-package-agreements --accept-source-agreements
```

- node is not found or too old. Run:

```
winget install --id OpenJS.NodeJS.LTS -e --source winget --accept-package-agreements --accept-source-agreements
```

A winget line is good when its last line is `Successfully installed`, or
`No newer package versions are available from the configured sources.` (the program was there already; winget
ends with an exit code that is not 0 then, and that is no failure). Windows may show a prompt that asks for leave
to install: that is for Brandon to answer.

A program installed a moment ago is found only by a terminal opened after the install. If `git --version` or
`node --version` still finds nothing after its winget line was good, stop and tell Brandon this, word for word:
"Git or Node was installed just now. Close this terminal window, open a new one, start the agent again and give it
the same task. Nothing is lost." Then wait.

If `winget` itself is not found, stop and report that.

### 1.2 The clone

If the folder `Snow-Globe-Perplexity` is already here with this file in it, skip the first line and run only the
second.

```
git clone --filter=blob:none --single-branch --branch main https://github.com/BrandonChurch93/Snow-Globe-Perplexity.git Snow-Globe-Perplexity
cd Snow-Globe-Perplexity
```

Good: the clone ends without the word `fatal`. It takes a minute or two.

Bad: git asks for a sign in (the repo may be private): that is for Brandon. Any `fatal:` line: stop and report it.

### 1.3 Setup: the packages and the build

```
node tools/handoff.mjs setup
```

Good: `PASS: the packages are installed and the build is made, engine <16 signs>, the stamp's`. A few minutes.

Bad: `FAIL:` with the reason. Stop and report.

### 1.4 The doctor: what this machine is

```
node tools/handoff.mjs doctor
```

It reads the processor, the memory, every video card with its driver, the system, the tools and the free disk from
the machine itself and prints them. It opens Chrome in a window, as the render will, and prints what draws the page.
A Chrome window opens and closes by itself. Do not touch it.

Good: `PASS: this machine can draw the film: ...` with the name of the graphics card that draws.

Under its table the doctor also prints what the shader compiler of this machine wrote about the film's shaders,
and what the graphics card answers to a list of small sums (the maths probe). Both are for the remote team. They
are marked `noted` and fail nothing: a shader that warns still compiles and draws. Only a shader that does not
compile fails the doctor, and then its message is in the report in full.

Bad, each with the one thing to do:

| the FAIL says | do this |
| --- | --- |
| ffmpeg or ffprobe is missing or too old | run the ffmpeg line below, then the doctor again |
| Chrome is missing or too old | run the Chrome line below, then the doctor again |
| the page draws in software | stop and report. The film is never drawn in software |
| the page draws on another card than the strong one | stop and report. The report says which Windows setting Brandon can change |
| too little free disk | stop and report. The report says how much is needed |
| the engine hash differs from the stamp's | stop and report. Do not pull, reset or edit anything |
| this is WSL or another Linux layer | stop and report. Open PowerShell or Git Bash on Windows itself |
| anything else | stop and report |

```
winget install --id Gyan.FFmpeg -e --source winget --accept-package-agreements --accept-source-agreements
winget install --id Google.Chrome -e --source winget --accept-package-agreements --accept-source-agreements
```

The tool looks in the places winget installs to, so after a good winget line run the doctor again in the same
terminal. If it still does not find the program, stop and report.

### 1.5 The short test

```
node tools/handoff.mjs test
```

It draws a few single frames and about two seconds of the film at 3840 x 2160, at the quality of the final
render and through the same code. It compares the frames with reference pictures, joins the two seconds into a
short film, and measures how long the whole render will take here. Before it draws it prints how long the test
itself is expected to take. Chrome windows open and close by themselves. Do not touch them, and do not let the
computer sleep.

It answers `RUNNING:` every few minutes: run the same line again each time.

How the frames are compared, and why so:

- The reference pictures were drawn on a Linux machine in software. A graphics card under Direct3D 11 (Windows)
  or Metal (macOS) rounds its sums a little differently, so the same frame comes out a level or two apart in many
  pixels and further apart along thin bright edges. A frame is therefore never asked to be equal to its reference.
- Each frame is measured three ways. The whole picture at half size, and two cuts of 960 x 540 at full size, must
  each reach a floor in PSNR (how close the pixels are, in dB, higher is closer). The same pieces must reach a
  floor in a coarser measure, the PSNR of the means of 8 x 8 pixel blocks, which a shift of one pixel hardly
  moves. A region of the glass must keep its mean brightness and must not turn white.
- The floors are written in `render/STAMP.json` and printed in the report beside every number. They were set from
  the same frames drawn on three test renderers, with a margin under the lowest. A frame that is wrong (a layer
  missing, white glass, a flat or empty picture) falls far under them.
- The report also says, for every frame, how far the picture stands from its reference: the largest and the mean
  difference in levels of 255, how many pixels are more than 8 levels apart, and where in the picture they lie.
  These lines are marked `noted` and fail nothing. They tell the remote team where to look.
- What this machine drew is kept in `out/work/handoff/compared`, and a sheet of pictures shows each frame beside
  its reference.

Good: `PASS: the short test passed on <the graphics card>: ...`. The test film is then on the Desktop as
`Snow Globe Seasons - Test - 3840x2160.mp4`, with a sheet of pictures beside it.

If the two final sound mixes are not in the clone, the test still passes and says in one line that its film is
silent and why. That is expected in step 1.

Bad: `FAIL:` with the reason. Stop and report.

### 1.6 Report and STOP

Give Brandon the whole text of `out/work/handoff/report-test.txt` as one block, and say where the test film is.

STOP here. Do not go on to step 2 by yourself, whatever the report says.

## Step 2 on Windows: the full render, only on Brandon's word

Run step 2 only when Brandon has said to, and only after step 1 passed on this machine.
The render takes hours. The report of the short test says how many. Keep the computer on mains power.

### 2.1 Bring the clone up to date, then check again

```
git pull --ff-only
node tools/handoff.mjs setup
node tools/handoff.mjs doctor
node tools/handoff.mjs test
```

Good: the pull ends with `Already up to date.` or `Fast-forward`, and the three lines each end with `PASS:`.

Bad: the pull says anything with `fatal` or `error`, or asks to merge: stop and report. Do not merge, stash or reset.
git asks for a sign in: that is for Brandon.

### 2.2 The render

```
node tools/handoff.mjs render
```

It answers `RUNNING:` every few minutes with a line that says how many frames are done and when it expects to
end. Run the same line again each time, for as long as it takes. Do nothing else on this machine with the
graphics card meanwhile, and leave the Chrome windows alone.

Good: `PASS: the two films, the loop and the screenshot are made in ...`.

Bad, each with the one thing to do:

| the FAIL says | do this |
| --- | --- |
| `the film is not released for its final render yet; step 1 only` | stop and tell Brandon. The remote team releases the film; nothing here can |
| a final mix is missing or is not the one the stamp names | stop and tell Brandon: the two files `audio/final/film-a.wav` and `audio/final/film-b.wav` must be put into the clone by him |
| it was stopped before it ended (sleep, restart, a closed window) | run the same line again. It carries on from the last finished frames. If it stops a second time at the same place, stop and report |
| the page draws in software, or on another card, or Chrome changed its version | stop and report. Nothing drawn is lost |
| too little free disk | stop and report. Nothing drawn is lost |
| the render would take longer than about ten hours | stop and report. The remote team decides |
| anything else | stop and report |

### 2.3 Check the four files

```
node tools/handoff.mjs check
```

Good: `PASS: the two films, the loop and the screenshot pass every check ...`.

Bad: `FAIL:` with the checks that failed. Stop and report. Do not render again by yourself.

### 2.4 Deliver to the Desktop

```
node tools/handoff.mjs deliver
```

Good: `PASS: the four files and the report are in ...` with the folder `Snow Globe Seasons` on the Desktop.

Bad: `FAIL:`. Stop and report.

### 2.5 Clean up, only after the delivery passed

```
node tools/handoff.mjs clean
```

Good: `PASS: the work files are deleted and ... GB of disk is regained ...`. The files on the Desktop, the reports
and the clone stay.

Bad: `FAIL:`. Stop and report. Delete nothing by hand.

### 2.6 Report

Give Brandon the whole text of `Snow Globe Seasons - Render Report.txt` from the folder `Snow Globe Seasons` on
the Desktop as one block, and the last line of each of the four commands of 2.2 to 2.5.

## macOS: the fallback, same commands

Use this only if Brandon says to render on the MacBook Pro. The rules and the two steps are the same.
Only the installs differ. In Terminal:

```
git --version
node --version
```

Missing or too old programs are installed with Homebrew, one line for each that is missing:

```
brew install git
brew install node
brew install ffmpeg
brew install --cask google-chrome
```

If `brew` itself is not found, stop and tell Brandon that Homebrew is needed (https://brew.sh). Do not install it
by yourself.

Then the same lines as on Windows, in the same order, with the same good and bad answers:

```
git clone --filter=blob:none --single-branch --branch main https://github.com/BrandonChurch93/Snow-Globe-Perplexity.git Snow-Globe-Perplexity
cd Snow-Globe-Perplexity
node tools/handoff.mjs setup
node tools/handoff.mjs doctor
node tools/handoff.mjs test
```

STOP here and report as in 1.6. Then, only on Brandon's word:

```
git pull --ff-only
node tools/handoff.mjs setup
node tools/handoff.mjs doctor
node tools/handoff.mjs test
node tools/handoff.mjs render
node tools/handoff.mjs check
node tools/handoff.mjs deliver
node tools/handoff.mjs clean
```

Keep the MacBook on its charger and its lid open for the whole render.
