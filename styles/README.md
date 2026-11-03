# Styles

A style is a folder with a `style.json`: the look and feel that every Short made in that style follows.
It has the palette, materials, lighting, camera rules, story shape, captions and sound. Scenes read it, so
"warmer light, slower camera" is an edit to this file, and every Short after that follows it.

## Copy the feel of a style from screenshots

When the user gives 2-3 screenshots (or frames) of Shorts they like:

1. Look at each image and measure what you can see:
   - **Palette:** the 4-6 main colours, as hex values.
   - **Light:** where it comes from, how hard it is, warm or cool.
   - **Lens:** depth of field, and wide or macro.
   - **Captions:** font family type, size relative to the frame, case, outline, shadow, position, words per chunk.
   - **Composition:** where the subject sits.
2. Write `styles/<name>/style.json` in the same shape as `studio-macro/style.json`, plus a short `STYLE.md`
   saying what was taken from the references.
3. **Take the feel, never the content.** Do not reproduce the references' characters, mascots, logos, artwork,
   channel name, wording or music. If a style depends on a character, design a new one that does a similar job.
   Say this to the user.
4. Make one 10-second test scene in the new style and show a contact sheet before using it for a full Short.

## Caption presets

- `zack`: the measured big-Shorts look.
  - White bold wide sans in sentence case.
  - Thin black outline and a hard drop shadow down-right.
  - 1-3 words per chunk, broken at phrase ends.
  - Hard cuts, centred at 78% of the height.
  - `kit.zackCaptions()` draws it.
- `pill`: uppercase words that pop in one by one, key words in the accent colour. `kit.captions()` draws it.
