#!/bin/sh
# Word timings for an existing voice.mp3 (made in the ElevenLabs app or recorded), using local whisper.
# usage: scripts/align.sh <slug>
set -e
cd "$(dirname "$0")/.."
dir="shorts/$1"
model="${WHISPER_MODEL:-../models/ggml-base.en.bin}"
tmp=$(mktemp -d)
ffmpeg -v error -y -i "$dir/voice.mp3" -ar 16000 -ac 1 "$tmp/v.wav"
whisper-cli -m "$model" -f "$tmp/v.wav" -ml 1 -sow -oj -of "$tmp/w" -np >/dev/null 2>&1
python3 - "$tmp/w.json" "$dir/words.json" "$dir/script.json" <<'EOF'
# whisper gives the timing; the script gives the spelling ("pries", not "prize")
import json, re, sys, difflib
segs = json.load(open(sys.argv[1]))["transcription"]
heard = []
for s in segs:
    w = s["text"].strip()
    if any(ch.isalnum() for ch in w):
        heard.append({"w": w.strip(".,!?\"'"), "s": s["offsets"]["from"] / 1000, "e": s["offsets"]["to"] / 1000})
text = re.sub(r"\[[^\]]*\]", " ", json.load(open(sys.argv[3]))["text"])
script = [w.strip(".,!?\"'") for w in text.split() if any(c.isalnum() for c in w)]
norm = lambda w: re.sub(r"[^a-z0-9]", "", w.lower())
sm = difflib.SequenceMatcher(None, [norm(h["w"]) for h in heard], [norm(w) for w in script], autojunk=False)
words = []
for op, a0, a1, b0, b1 in sm.get_opcodes():
    if op == "equal" or (op == "replace" and a1 - a0 == b1 - b0):
        for k in range(b1 - b0):
            words.append({**heard[a0 + k], "w": script[b0 + k]})
    elif op == "replace" or op == "insert":
        s0 = heard[a0 - 1]["e"] if a0 else 0
        s1 = heard[a1]["s"] if a1 < len(heard) else s0 + .3 * (b1 - b0)
        if op == "replace": s0, s1 = heard[a0]["s"], heard[a1 - 1]["e"]
        step = (s1 - s0) / (b1 - b0)
        for k in range(b1 - b0):
            words.append({"w": script[b0 + k], "s": s0 + k * step, "e": s0 + (k + 1) * step})
json.dump(words, open(sys.argv[2], "w"), indent=1)
print(len(words), "words,", round(words[-1]["e"], 2), "s")
EOF
rm -rf "$tmp"
