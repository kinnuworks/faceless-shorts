# Daily Short (prompt for a scheduled task)

Paste this as the prompt of a scheduled task in Claude, set to run every morning (for example 08:00),
with this folder as the working folder.

---

Make today's faceless Short with the faceless-shorts skill in this folder.

1. Run `node scripts/next-topic.mjs` to get today's topic and slug. If it says the list is empty, stop and say so.
2. Make the Short end to end, following SKILL.md, in the style named in `autopilot/settings.json` (default `studio-macro`).
   Research and source every fact. If a fact can't be sourced, drop it.
3. Check the contact sheet yourself. Fix anything clipped, empty or unreadable before the final render.
4. Write `shorts/<slug>/out/metadata.md`:
   - a title under 60 characters
   - a description with the sources
   - 5 tags
   - a pinned comment
5. Run `node scripts/next-topic.mjs --done <slug>` to tick the topic.
6. Do **not** upload or post anything. Finish with a one-line summary: the topic, the file path, and anything a human should check.
