# Flashback Lab

A playable, independently implemented Flashback 2 X4 behavior study with **actual Mutable Instruments Braids DSP**, a Wasp-style filter, eight authored synth demonstrations, and a cited research report.

The delay and filter are approximations. No exact pedal schematic, proprietary DSP, factory TonePrint data, or hardware reference recordings were available. This is not a complete or verified hardware replica. The research report explains the limits in detail.

## Run

For a Git checkout, use Docker as described below. To populate the comparison recordings when serving the checkout directly, run `node tools/render.mjs` first. Generated WAVs and offline bundles are excluded from Git.

In the full offline distribution, open **public/standalone.html** in Chrome or Edge. It contains the oscillator and all audio code and works without a server. The offline comparison room is **public/listening-offline.html**. Keep the extracted folder together so the report and comparison links work.

Alternatively, serve the ordinary modular build. The compiled oscillator is included. No build is necessary:

```sh
cd /home/ubuntu/flashback-lab
python3 -m http.server 18742 --bind 127.0.0.1 --directory public
```

Open http://127.0.0.1:18742 and click **Enable audio**, then **Play sequence**. The site also works on an HTTPS static host. Opening index.html directly with file:// is not supported because it uses modules and an AudioWorklet.

- Instrument: `public/index.html`
- Synchronized dry/processed comparisons: `public/listening.html`
- Research and fidelity report: `public/research.html` and printable `public/Research.pdf`
- Eight processed and eight dry stereo WAVs: `public/demos/`
- Exact render parameters and measurements: `public/demos/manifest.json`
- DSP results: `public/test-results.json`
- Browser results: `public/browser-test-results.json`

## Controls

- Eight demonstration patches; all 47 normal Braids models; eight voices.
- Two ADSRs, Wasp-style low/notch/high and band-pass response, nonlinear input drive.
- Two LFOs, four modulation routes, MASH and expression mappings.
- Nine delay algorithms, rhythmic subdivisions, tap tempo, 20–7000 ms manual range.
- Two banks of three presets, six local recipes; saved in browser localStorage.
- Stereo/mono looper with overdub, one-level undo/redo, pause, play-once and clear.
- Audio-file input, performance recording and sequence WAV rendering.
- Computer keyboard: A W S E D F T G Y H U J K. Space starts/stops when focus is outside controls.
- Web MIDI note input; pedal controls on channel 6, clock input. Hardware MIDI has not been verified.

**Render WAV** prepares a file; click **Download WAV** when ready. It exports two cycles of the selected sequence with current settings and an echo tail. It does not export live keyboard playing, an existing loop, or an imported file. **Record output** captures those live performances in the browser's supported media format.

Dry audition clears the delay memory. Use the footswitch and Trails setting for actual bypass/trail experiments. Switching algorithms clears the current tail. Time sweeps in all modes can bend pitch; only Tape uses the slower glide constant. Paired subdivisions use two read taps sharing feedback. Crystal has additional grain latency. These choices are documented approximations.

## Build the actual Braids engine

Upstream revisions:

- eurorack `08460a69a7e1f7a81c5a2abcc7189c9a6b7208d4`
- stmlib `d18def816c51d1da0c108236928b2bbd25c17481`

Place Zig 0.14.1 for Linux x86-64 at `tools/zig-x86_64-linux-0.14.1/`, then:

```sh
bash tools/build.sh
```

The wrapper renders Braids at 96 kHz and downsamples through a 63-tap FIR to 48 kHz. The selected upstream oscillator code is unmodified. Eight separate instances provide host polyphony; the analog hardware, control firmware, and DAC are not reproduced. Source licenses are preserved in `public/LICENSES.txt` and upstream headers.

## Validate and render

With Node 22 or newer:

```sh
node tools/test.mjs
node tools/render.mjs
```

For browser checks, install Playwright and Chromium, start the local server, then run `node tools/browser-test.mjs`. The browser test detects optional local browser libraries automatically and writes results to `artifacts/`. Chromium is the tested browser. Plain HTTP LAN addresses use a 2048-sample ScriptProcessor compatibility backend with the same DSP; HTTPS and localhost use AudioWorklet. The compatibility path has higher latency and may stutter if the main thread is busy. Web MIDI availability and recording formats vary by browser.

The WAV renders contain ten seconds of tails and are not independently normalized. Measurements are sample peak and RMS, not LUFS or true peak. Tests establish properties of this software, not a measured hardware match.

## Files

`public/dsp.js` contains the original synth host, delay and looper. `public/worklet.js` bridges that engine to Web Audio. `public/render-worker.js` uses the same engine for browser WAV export. `src/braids-wrapper.cc` is the WebAssembly interface and resampler. `public/presets.js` contains every sequence and patch value.

Original host code is MIT-licensed. TC Electronic and Mutable Instruments names identify research targets; this project is unaffiliated with either. The published Wasp schematic is linked in the report and is not relicensed as project artwork.

## Docker and GitHub Actions

Build and start the interactive instrument, comparison room and research report:

```sh
docker compose up -d --build
```

Open `http://localhost:10101` on the host, or `http://<host-ip>:10101` from your LAN. Plain HTTP uses the tested compatibility audio backend; localhost and HTTPS use AudioWorklet. Click **Enable audio**, then choose a preset and play. Audio is synthesized in your browser; the container needs no audio device.

If an existing server is using port 10101, either stop that server or choose another port:

```sh
PORT=10102 docker compose up -d --build
docker compose logs -f
docker compose down
```

The multi-stage Dockerfile downloads pinned Braids/stmlib source revisions and checksum-verified Zig 0.14.1, compiles the oscillator, runs DSP tests, and renders all 16 WAV comparisons. The final image serves static files with nginx as a non-root user. Compose uses a read-only filesystem with temporary storage in `/tmp`. Offline single-file bundles are omitted from the hosted image.

### Publish from GitHub

Create an empty GitHub repository and push this project folder (not its parent). No repository URL needs to be embedded in the workflow:

```sh
git init -b main
git add .
git commit -m "Add Flashback Lab and Docker build pipeline"
git remote add origin https://github.com/YOUR-OWNER/YOUR-REPO.git
git push -u origin main
```

`.github/workflows/docker.yml` builds and tests pull requests and branch pushes. Chromium tests actual audio output, preset controls, looper, WAV export and mobile layout through the container, using both AudioWorklet and the insecure-HTTP compatibility backend. Successful default-branch pushes publish `ghcr.io/your-owner/your-repo:latest`; `v*` tags also publish version tags. Images support `linux/amd64` and `linux/arm64`. Publishing uses GitHub's built-in `GITHUB_TOKEN` with package write permission; no registry secret is required. Actions and base images are pinned, with Dependabot configured for updates.

GitHub package visibility controls who can pull the image. For private packages, authenticate with `docker login ghcr.io` using credentials with package read access. To run the published image without rebuilding (use the lowercase owner/repository name):

```sh
FLASHBACK_IMAGE=ghcr.io/your-owner/your-repo:latest docker compose pull
FLASHBACK_IMAGE=ghcr.io/your-owner/your-repo:latest docker compose up -d --no-build
```

Local browser verification against a running container:

```sh
npm ci
npx playwright install --with-deps chromium
LAB_TEST_URL=http://127.0.0.1:10101 LAB_EXPECT_BACKEND=worklet npm run test:browser
LAB_TEST_URL=http://flashback.test:10101 LAB_EXPECT_BACKEND=compatibility LAB_HOST_RESOLVER="MAP flashback.test 127.0.0.1" npm run test:browser
```
