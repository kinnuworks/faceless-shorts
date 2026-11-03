---
name: faceless-shorts
description: Make a finished faceless YouTube Short (9:16, 30-45 s) from one sentence. Researches and fact-checks the topic, writes the script, voices it with ElevenLabs, builds every frame on the voice's word timings (photoreal 3D in Blender, or a fast browser engine), adds captions and sound effects, and masters to -14 LUFS. Also copies the feel of a style from screenshots and runs as a daily autopilot. Use when the user asks for a Short, a faceless video, "make a video about X", "set it up", a new style, or a daily Short.
---

# Faceless Shorts (by Code Kinnu)

One sentence in, a finished Short out. The rule that makes it look made, not generated: **voice first, then picture.**
The narration is generated before anything is drawn, and every visual event is placed on the exact time of its word.

## "Set it up" (first run)

1. Run `npm install` in this folder.
2. Run `node scripts/doctor.mjs`. It checks Node, ffmpeg, Chrome, Blender, the ElevenLabs key and the voice, and says what to fix.
   - If the key is missing, tell the user to create `.env` in this folder with a line `ELEVENLABS_API_KEY=...`.
   - The key goes in that file. **Never ask for the key in chat, and never print it.**
   - Optional: `ELEVENLABS_VOICE_ID=...` sets the default voice.
3. Make the test Short:
   - `node scripts/voice.mjs _test`
   - `node scripts/render.mjs _test --draft`
   - Show the user `shorts/_test/out/_test_draft.mp4`. If it plays with voice and captions, setup is done.

Notes:
- ElevenLabs is a paid tool for monetized channels: the free plan has no commercial licence. Say so once.
- Blender is only needed for the 3D look. It's free from blender.org, and the user never has to open it.

## Make a Short

Work in `shorts/<slug>/`. Stop and show the user each **[check]** before moving on.

1. **Research.** Two or more sources for every claim, saved in `script.json` → `sources`.
   - Drop anything you can't source.
   - When sources disagree, use wording that is true either way, and say which way they disagree.
   - Check how old a number is before saying it as current.
2. **Script** in `script.json`, 85-120 words, 30-45 s:
   - Fields: `title`, `text`, `voice_id`, `model_id: eleven_v4`, `speed`.
   - Shape:
     - a hook in the first 1.5 s
     - 3-4 beats the viewer can see
     - one twist or number
     - a last line that loops back to the first
   - **[check]** Show the script and its sources.
3. **Voice.** `node scripts/voice.mjs <slug>` writes `voice.mp3` and `words.json`, with every word's start and end time and phrase ends marked.
   - If the user made the audio elsewhere, put it at `voice.mp3` and run `scripts/align.sh <slug>` instead.
   - `node scripts/words.mjs <slug>` prints the timings as a table.
4. **Picture.** Pick the style (`styles/<name>/style.json`, default `studio-macro`) and its engine.
   - **blender** (photoreal):
     - Write `blender/<slug>.py` with `from kinnu import *`.
     - Build the objects, define `set_state(t)` and call `render(set_state)`.
     - `blender/zipper_v3.py` is a full example.
     - Render: `Blender -b -P blender/<slug>.py -- --slug <slug>` (add `--scale .5 --step 45` for checks). About 2 s per frame on an M-series Mac.
     - Then write `scene.js` as the overlay layer (captions, big numbers) that reads `out/frames/`. Copy `shorts/zipper-v3/scene.js`.
   - **three** (fast 3D in the browser, about 1 min per Short): `scene.js` exports `create({kit, clock, THREE})`. Copy `shorts/how-a-zipper-works-3d/scene.js`.
   - **canvas** (2D): `scene.js` default-exports `scene(g, t, clock, kit)`. Copy `shorts/_test/scene.js`.
   - Rules for every engine:
     - Every frame is a pure function of `t`: no timers, no state.
     - Place every event with `at('word', n)`, the nth time the word is spoken. **Always give the count for repeated words** ("and", "the", "one"), or a shot lands on the wrong one.
     - Something changes on screen at least every 1.5 s. Hard cuts between shots, smooth moves inside them.
     - For cutaways, use X-ray glass, not boolean slices (a sliced solid is still solid).
     - Textures only add detail: set colours yourself (free textures bring their own colours).
     - Keep text out of the bottom 20% and the right-hand 120 px (the Shorts buttons).
     - Draw and build everything yourself. No AI images, no stock footage, no other creators' characters or art.
5. **Contact sheet.** `node scripts/contact.mjs <slug>` writes one frame every 1.5 s.
   - For Blender, render the check frames first with `--scale .5 --step 45`.
   - **[check]** Show it and fix what's clipped, empty, mistimed or off-colour **before** the full render.
6. **Sound effects.** Optional `sfx.json`: `[{ "file": "sfx/zip.mp3", "t": 0.0, "gain_db": -8 }]`. Generate the effects with ElevenLabs sound generation and place each one on its word.
7. **Final.** `node scripts/render.mjs <slug> [--music bed.mp3]` outputs 1080×1920 at 30 fps, H.264 CRF 16, AAC 256k, about -14 LUFS.
8. **Metadata** in `out/metadata.md`:
   - a title under 60 characters, which the video must pay off
   - a description with the sources
   - 5 tags
   - a pinned comment

## New style from screenshots

Follow `styles/README.md`: measure the palette, light, lens, captions and composition from 2-3 screenshots, and write a new `style.json`.
**Take the feel, never the content**: no characters, logos, artwork or wording from the references.
Test it with a 10-second scene before a full Short.

## Autopilot

- `autopilot/topics.md` is the queue.
- `autopilot/TASK.md` is the prompt for a daily scheduled task in Claude.
- `autopilot/settings.json` picks the style and voice.
- Each run makes one Short, leaves it in `shorts/<slug>/out/` with `metadata.md`, and ticks the topic.
- **It never uploads.** A human checks the facts and bulk-schedules the week in YouTube Studio.

## Licences

- `assets/polyhaven/`: CC0 (Poly Haven).
- `engine/fonts/`:
  - Fredoka: OFL.
  - DejaVu Sans: free licence, see `DejaVu-LICENSE.txt`.
  - Verdana is used only if it's installed on the user's system.
- Everything else here: MIT.
