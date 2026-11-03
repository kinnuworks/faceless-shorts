# Faceless Shorts

A Claude skill that makes a finished faceless YouTube Short from one sentence:
- researches and fact-checks the topic
- writes the script
- voices it with ElevenLabs
- builds every frame on the exact timing of each spoken word (photoreal 3D in Blender, or a fast browser engine)
- adds captions and sound effects
- masters to −14 LUFS

The idea behind it: **voice first, then picture.** The narration is made before anything is drawn, and every visual event waits for its word.

Made by Code Kinnu.

## What you need

- [Claude Code](https://claude.com/claude-code)
- Node.js 20+, ffmpeg, Google Chrome
- [Blender](https://www.blender.org/) (free), for the 3D look only. You never have to open it.
- An [ElevenLabs](https://elevenlabs.io/) account for the voice. The free plan has no commercial licence, so use a paid plan if you monetize.

## Setup

```bash
git clone https://github.com/kinnuworks/faceless-shorts.git
cd faceless-shorts
npm install
cp .env.example .env      # then put your ElevenLabs key in .env
node scripts/doctor.mjs   # checks everything and says what to fix
```

Or open the folder in Claude Code and say **"set it up"**. To use it as a skill from any project, copy or symlink the folder into `~/.claude/skills/faceless-shorts`.

## Make a Short

In Claude Code: **"make a Short on how a lock and key actually work"**. Claude:
1. researches the topic
2. shows you the script and its sources
3. voices it
4. builds the scene
5. shows a contact sheet for your OK
6. renders `shorts/<slug>/out/<slug>.mp4` with `metadata.md`

The steps by hand:

```bash
node scripts/voice.mjs <slug>        # ElevenLabs voice + word timings
node scripts/words.mjs <slug>        # print the timings
node scripts/contact.mjs <slug>      # one frame every 1.5 s, check before rendering
node scripts/render.mjs <slug>       # final 1080x1920, 30 fps, about -14 LUFS
```

`shorts/zipper-v3/` is a full example: the Blender scene is `blender/zipper_v3.py`, rendered with
`Blender -b -P blender/zipper_v3.py -- --slug zipper-v3`.

## Styles

Give Claude two or three screenshots of a look you like and it writes a style sheet in `styles/<name>/`, covering palette, light, lens, camera rules and captions. It takes **the feel, never the content**: no characters, logos or artwork from the references. See `styles/README.md`.

## Autopilot

`autopilot/TASK.md` is a prompt for a daily scheduled task in Claude, and `autopilot/topics.md` is the queue. Each run makes one Short and its metadata into a folder. **It never uploads.** You check the facts and schedule the week in YouTube Studio.

## Licence

MIT, see [LICENSE](LICENSE). Textures are CC0 from Poly Haven. Fonts keep their own open licences.
