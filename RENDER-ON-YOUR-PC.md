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

With Brandon's yes, step 2 also sends copies of them to the remote team (2.5).

On Windows, Chrome draws the film through Direct3D 11. Before this file existed, the film's pictures had been
measured on Linux only, drawn in software. Step 1 is the first time this film is drawn by a Windows graphics
card. That is why step 1 draws a little, compares it, reports and stops.

## Rules for the agent

1. Do not edit any file of the repo. Do not repair code, shaders, settings or tests. A fault is mended by the remote
   team. A shader that does not compile is such a fault: copy its message whole into what you give Brandon.
2. Do not commit and do not push. One line of this file writes to GitHub: the upload of 2.5. Run it only after
   Brandon has said yes to it.
3. Run only the commands written in this file, exactly as written, one line at a time. Use no other switches,
   set no variables, and do not join lines with `&&` or `;`. Beyond these lines you do one thing only: you may
   open a report file this file names with your own file reader, to give its text to Brandon.
4. Ask Brandon only for a password, a sign in, or a system prompt that asks for his leave, and for what this file
   tells you, word for word, to ask him. Ask him nothing else and decide nothing for him.
5. When anything fails, stop. Give Brandon the report file the failing command names, whole, and wait. Do not try
   another way.
6. Do step 1, then stop. Do step 2 only when Brandon says so in his own words, after step 1 has passed.
7. While a line answers `RUNNING:`, do not end your turn and do not start another line beside it. Run the same line
   again until it answers `PASS:` or `FAIL:`.
8. Change no setting of Windows, of the graphics driver or of Chrome, and no registry value. Where a report names a
   setting, it is for Brandon to change.
9. Never mix the work of two computers. Copy nothing from another machine into the clone's folder `out`. The tool
   refuses frames that another graphics card drew.

## How every command here behaves

- Every line is the same in PowerShell and in Git Bash.
- Give every command a time limit of 10 minutes (600000 ms). No command here needs more in one go.
- Each `node tools/handoff.mjs` line prints its last line as one of three words and a sentence:

| last line starts with | exit code | what it means | what to do |
| --- | --- | --- | --- |
| `PASS:` | 0 | the step is done and good | go to the next line of this file |
| `RUNNING:` | 3 | the work goes on in the background and nothing is wrong | run the very same line again, as often as it takes. Start nothing else in between |
| `FAIL:` | 1 | the step did not pass | stop, and give Brandon the report (rule 5) |

- Long work (setup, test, render, check, upload) runs in a process of its own. If a line is cut off by a time limit, or the
  terminal is closed, the work goes on. The same line run again follows it. Nothing is started twice and nothing
  finished is done again.
- Each line writes its report to `out/work/handoff/report-<word>.txt` inside the clone and prints it between
  `===== REPORT: ... =====` and `===== END OF REPORT =====`.
- Every `node tools/handoff.mjs` line is run inside the clone's folder `Snow-Globe-Perplexity`. If node answers
  `Cannot find module` with a path that ends in `tools\handoff.mjs`, you are in the wrong folder: run
  `cd Snow-Globe-Perplexity` once and run the line again. If your shell forgets the folder between two commands,
  name the clone's folder as the working folder of each command in your own tool. Do not join lines to get there.
- The tool writes its reports itself, as plain UTF-8 text. Do not send a command's output into a file of your own.
- If you are started again in the middle of the work (the agent or the computer was restarted): in step 1, begin
  again at 1.3. In step 2, run the line of 2.2 again; it carries on from the last finished frames. If a line then
  answers `FAIL: "<word>" is still at work in the background`, the work outlived the restart and nothing is wrong:
  run the line that sentence names until it ends, then go on. This is the one `FAIL:` that is not a stop.
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

Run the clone in the folder you were started in. A folder with spaces in its name is fine. Everything the render
writes goes into the clone, so the clone must lie on a drive with room: the doctor of 1.4 says how much is needed
and how much is free there. If it is too little, that is for Brandon: he starts you again in a folder on a larger
drive, and you begin at 1.2 there.

The sign in. The repo may be private by the time you read this. Then git needs Brandon's GitHub account once:

- Git for Windows opens a small window by itself that says `Connect to GitHub`. Tell Brandon, word for word:
  "A GitHub sign in window has opened. Please sign in." Wait for the clone to end. Git keeps the sign in, and no
  later line asks again.
- If no window opens and the clone ends with `fatal: Authentication failed`, with `fatal: repository ... not found`
  or with `fatal: could not read Username`, stop and tell Brandon, word for word: "The clone needs your GitHub sign
  in and no window opened here. Please open a PowerShell window of your own in this folder, run the clone line
  below, sign in when it asks, and tell me when it has ended." Give him the clone line and the folder you are in.
  When he says it is done, run only `cd Snow-Globe-Perplexity` and go on.
- What is known of this: the clone of the public repo was run on Windows and macOS test machines and asked for no
  sign in. The sign in of a private repo was tried on no test machine, because it needs Brandon's own account.

Bad: any other `fatal:` line: stop and report it. A folder `Snow-Globe-Perplexity` that is here without this file in
it (a clone that was cut off): stop and report it. Delete nothing.

### 1.3 Setup: the packages and the build

```
node tools/handoff.mjs setup
```

Good: `PASS: the packages are installed and the build is made, engine <16 signs>, the stamp's`. A few minutes.
The 16 signs are the engine hash: a sum over everything that draws the film. `the stamp's` says it is the same
hash that `render/STAMP.json` in the clone records, so this clone draws the film the references were made from.

Bad: `FAIL:` with the reason. Stop and report.

### 1.4 The doctor: what this machine is

```
node tools/handoff.mjs doctor
```

It reads the processor, the memory, every video card with its driver, the system, the tools and the free disk from
the machine itself and prints them. It opens Chrome in a window, as the render will, and prints what draws the page.
A Chrome window opens and closes by itself. Do not touch it.

Good: `PASS: this machine can draw the film: ...` with the name of the graphics card that draws.

The doctor reads the video cards from Windows and the name of what draws from the page itself. The page must draw
on the strong card of this machine (an NVIDIA card before an AMD one, and of two cards of one maker the one with
more memory), named by the model words the system gives it. Nothing about the card is written into the tool.

A report may end with a block `TO LOOK AT`, each of its lines beginning with `LOOK`. That is no failure and you go
on. Give the block to Brandon with the report, as it is.

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
itself is expected to take. Chrome windows open and close by themselves. Do not touch them. The tool keeps the
computer awake by itself while it draws; you change no power setting.

It answers `RUNNING:` every few minutes: run the same line again each time.

Before you run it, tell Brandon, word for word: "The test opens Chrome windows for some minutes. Please do not
minimize them, do not lock the screen and do not start a game until I say it is done."

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
  its reference: the reference on the left, this machine on the right, with a row of cuts at full size.
- While the frames are drawn the test asks the NVIDIA card every two seconds how busy it is (with `nvidia-smi`,
  which comes with the driver) and prints the busiest reading and the most memory in use. A card that stayed idle
  while the page says it draws there is written as a `LOOK` line.
- After the two seconds of film are drawn, the test reads from each chunk's own record what drew it. It must be the
  card the doctor named. So a test that drew nothing, or drew elsewhere, cannot pass as proof of the card.

Good: `PASS: the short test passed on <the graphics card>: ...`. The test film is then on the Desktop as
`Snow Globe Seasons - Test - 3840x2160.mp4`, with the sheet of pictures beside it as
`Snow Globe Seasons - Test - Contact Sheet.jpg`.

If the two final sound mixes are not in the clone, the test still passes and says in one line that its film is
silent and why. That is expected in step 1.

Bad: `FAIL:` with the reason. Stop and report.

### 1.6 Report and STOP

Give Brandon the whole text of `out/work/handoff/report-test.txt` as one block, with its `TO LOOK AT` block if it
has one. Say where the test film and the sheet of pictures are, and ask him to open both and look.

If the report holds a line that begins `MORE THAN 10 HOURS`, say that line to Brandon first, before the block.
The test has passed all the same. Whether a render that long is started on this machine is for the remote team
to decide, not for you.

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

Good: the pull says `Already up to date.` or `Fast-forward`, and the three lines each end with `PASS:`.

Bad: the pull says anything with `fatal` or `error`, or asks to merge: stop and report. Do not merge, stash or reset.
git asks for a sign in: that is for Brandon.

If the test film of step 1 is still open in a player, this test writes its film beside it with `(new)` in the
name and says so in a `LOOK` line. That is no failure.

If the test of this step says that its film is silent, the two final sound mixes are not in the clone, and the
render of 2.2 refuses without them. Do not run 2.2 then. Tell Brandon what the second row of the table in 2.2
says, and wait. When he says the two files are there, run the test line again and go on.

### 2.2 The render

```
node tools/handoff.mjs render
```

It answers `RUNNING:` every few minutes with a line that says how many frames are done and when it expects to
end. Run the same line again each time, for as long as it takes. Do nothing else on this machine with the
graphics card meanwhile, and leave the Chrome windows alone.

Before you run it, tell Brandon, word for word: "The render opens Chrome windows for hours. Please do not minimize
them, do not lock the screen, do not start a game and do not let Chrome update until I say it is done."

The tool keeps the computer awake by itself while it draws and lets it sleep again when it ends. It changes no
power setting. It never draws a finished frame twice, and it never joins frames of two graphics cards into one film.

Good: `PASS: the two films, the loop and the screenshot are made in ...`.

Bad, each with the one thing to do:

| the FAIL says | do this |
| --- | --- |
| `the film is not released for its final render yet; step 1 only` | stop and tell Brandon. The remote team releases the film; nothing here can |
| a final mix is missing or is not the one the stamp names | stop and tell Brandon: the two files `audio/final/film-a.wav` and `audio/final/film-b.wav` must be put into the clone by him |
| it was stopped before it ended (sleep, restart, a closed window) | run the same line again. It carries on from the last finished frames. If it stops a second time at the same place, stop and report |
| `the WebGL context was lost` (the driver reset the card, or the card ran out of memory) | run the same line again, once. It carries on. If it is lost a second time at the same place, stop and report. Change no setting (rule 8) |
| `Chrome is now version ...: the browser was updated` | Chrome updated itself in the middle. Run `node tools/handoff.mjs test` again. When it ends with `PASS:`, run the render line again: it carries on from the last finished frames, and the report names both versions of Chrome. When the test ends with `FAIL:`, do not run the render line: nothing more is drawn with a browser the test did not pass on (the tool refuses it too). Stop and give Brandon `out/work/handoff/report-test.txt` |
| the page draws in software, or on another card | stop and report. Nothing drawn is lost |
| too little free disk | stop and report. Nothing drawn is lost |
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

If the FAIL says that a file on the Desktop `could not be written, because another program holds it open`, tell
Brandon, word for word: "A film from an earlier run is open in a player on your Desktop. Please close the player
and tell me." Then run the same line again.

What the files weigh: each film at most 500 MB, the loop under 2,000 MB (2.3 checks it), the screenshot some tens
of MB. They stay in that folder. 2.5 sends copies of them, and only if Brandon says yes.

Bad: `FAIL:`. Stop and report.

### 2.5 Send the files to the remote team, only when Brandon says yes

This line writes to Brandon's repo on GitHub. Before you run it, ask Brandon, word for word: "The files are on your
Desktop. May I send copies to the remote team now, as a draft release of the repo? A draft is shown to no one
else." Run the line only after he says yes. If he says no, go on with 2.6.

```
node tools/handoff.mjs upload
```

It makes a draft release in the repo, named for the day, the engine hash and this machine. Into it go the two
films, the loop, the screenshot, a file of sums (sha256, bytes, frames, seconds and size in pixels of each) and
the records of the render as one zip. A draft is published to no one and makes no tag. The line answers
`RUNNING:` while it sends; run the same line again each time. After the last file it reads the release back from
GitHub and compares every name, size and sum.

Good: `PASS: the draft release "..." holds the 6 files, each read back by its name, its bytes and its sum: ...`
with the address of the release. Give Brandon that address.

Bad, each with the one thing to do:

| the FAIL says | do this |
| --- | --- |
| `gh, the GitHub program that sends the files, is not on this machine` | run the install line below, then the upload line again |
| `gh, the GitHub program, is not signed in on this machine` | tell Brandon, word for word: "The upload needs your GitHub sign in. Please open a terminal yourself, run `gh auth login`, answer what it asks, and tell me when it is done." Then run the upload line again |
| the sign in `does not see the repo` or `may not write to it` | the same words to Brandon, and add: "It must be the account that owns the repo." Then run the upload line again |
| `the repo ... is not private, so nothing is sent` | stop and tell Brandon. The remote team makes the repo private; nothing here can |
| `the check has not passed` or a file `is not the file that was checked` | run the line of 2.3 again, then the upload line. If it says the same again, stop and report |
| a file `did not go through`, or GitHub `could not be asked` (the connection dropped) | run the same line again. It sends only what is missing or short. If it fails three times in a row, stop and report |
| a file is 2,000 MB or more | stop and report. The remote team names another way |
| anything else | stop and report |

```
winget install --id GitHub.cli -e --source winget --accept-package-agreements --accept-source-agreements
```

What was tried: sending, carrying on after a cut connection and reading back were run with stand-in files of a
few bytes, on Linux and on a hosted Windows machine. The refusal for a missing sign in was run on the hosted
Windows and macOS machines, after a small render there. The refusal for a repo that is not private was run on
Linux only, while the repo was public. `gh auth login` was run on no test machine, and no whole film was sent by
this line before Brandon's own run.

### 2.6 Clean up, only after the delivery passed

```
node tools/handoff.mjs clean
```

Good: `PASS: the work files are deleted and ... GB of disk is regained ...`. The files on the Desktop, the reports
and the clone stay.

Bad: `FAIL:`. Stop and report. Delete nothing by hand.

### 2.7 Report

Give Brandon the whole text of `Snow Globe Seasons - Render Report.txt` from the folder `Snow Globe Seasons` on
the Desktop as one block, and the last line of each command of 2.2 to 2.6 that was run. If 2.5 was run, give him
the address of the draft release too.

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

The sign in on the MacBook, if the repo is private: the first clone can fail in the agent's own shell, because no
sign in window can open there. If the clone line below ends with `fatal: Authentication failed`, with
`fatal: repository ... not found` or with `fatal: could not read Username`, stop and tell Brandon, word for word:
"The clone needs your GitHub sign in. Please open Terminal yourself, run `gh auth login`, then `gh auth setup-git`,
and tell me when both are done." If he says `gh` is not found, he runs `brew install gh` first. Then run the clone
line again. This was tried on no test machine, because it needs Brandon's own account.

If the upload of 2.5 says that `gh` is not on the machine, the line is `brew install gh`.

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
node tools/handoff.mjs upload
node tools/handoff.mjs clean
```

The upload line is run only after Brandon has said yes to it, as in 2.5. If he says no, leave it out.

Keep the MacBook on its charger and its lid open for the whole render.
