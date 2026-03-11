# Listen Up

A sentence-level audio player for language learning. Upload audio files, get automatic transcription and translation, then navigate sentence by sentence with keyboard shortcuts.

Built as an alternative to [Language Reactor](https://www.languagereactor.com/video-file)'s media player — with file management, playlists, and sentence-level navigation that the original lacks.

## Features

- **Sentence-level navigation** — Arrow keys jump between sentences, not arbitrary time offsets
- **Auto-Pause (AP)** — Automatically pauses at the end of each sentence
- **Dual subtitles** — Source text + translation side by side
- **Configurable languages** — Pick any source/target language pair from the UI
- **STT with timestamps** — Powered by OpenAI Whisper for accurate word-level timing
- **File library** — Upload multiple MP3s, track progress, resume where you left off
- **Playlists** — Group and reorder files
- **Segment editing** — Fine-tune sentence boundaries with drag handles and nudge buttons
- **Keyboard-driven** — Full shortcut support for hands-free study

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `←` / `→` | Previous / Next sentence |
| `Shift+←` / `Shift+→` | Skip 5 seconds |
| `Space` | Play / Pause |
| `R` | Replay current sentence |
| `Shift+R` | Toggle loop |
| `Enter` | Toggle translation visibility |
| `↑` / `↓` | Speed up / down |

## Quick Start

```bash
git clone <repo-url> && cd listen-up
npm install
```

Create a `.env` file:

```
OPENAI_API_KEY=sk-...
SOURCE_LANG=English
TARGET_LANG=Korean
```

Build and run:

```bash
npm run build
npm run build:frontend
npm run start
```

Open `http://localhost:3000`. Drag and drop `.mp3` files to get started.

## How It Works

1. Upload MP3 files via the browser
2. Server runs Whisper STT → gets word-level timestamps
3. Words are grouped into sentences with precise start/end times
4. Sentences are translated via GPT
5. The player uses `audio.currentTime` to jump between sentence boundaries

All data is stored locally in `data/` — audio files, STT results, progress, and settings.

## Tech Stack

- **Backend**: NestJS + TypeScript
- **Frontend**: Vanilla TypeScript + esbuild
- **STT**: OpenAI Whisper API
- **Translation**: OpenAI GPT API
- **Storage**: Local filesystem (JSON + MP3)

## Project Structure

```
src/
├── files/          # File upload, streaming, CRUD
├── stt/            # Whisper STT + GPT translation
├── playlists/      # Playlist management
├── settings/       # Language configuration
└── meta/           # File metadata persistence
public-src/         # Frontend TypeScript source
public/             # Built frontend assets
data/               # Runtime data (audio, STT results, settings)
```

## License

MIT
