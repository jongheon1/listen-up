#!/usr/bin/env python3
"""faster-whisper wrapper: outputs JSON with words, text, duration."""
import sys
import json
from faster_whisper import WhisperModel

audio_path = sys.argv[1]
model_size = sys.argv[2] if len(sys.argv) > 2 else "small"

model = WhisperModel(model_size, compute_type="int8")
segments, info = model.transcribe(audio_path, word_timestamps=True)

words = []
text_parts = []
for segment in segments:
    text_parts.append(segment.text.strip())
    for word in segment.words:
        words.append({
            "word": word.word.strip(),
            "start": round(word.start, 3),
            "end": round(word.end, 3),
        })

print(json.dumps({
    "words": words,
    "text": " ".join(text_parts),
    "duration": round(info.duration, 3),
}))
