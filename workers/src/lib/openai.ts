interface WhisperWord {
  word: string;
  start: number;
  end: number;
}

export interface Transcription {
  text: string;
  words: WhisperWord[];
  duration: number | null;
}

/**
 * Call OpenAI Whisper. Audio is provided as a Blob.
 * Returns transcription with word-level timestamps.
 */
export async function transcribe(
  apiKey: string,
  audio: Blob,
  filename: string,
): Promise<Transcription> {
  const form = new FormData();
  form.append('file', audio, filename);
  form.append('model', 'whisper-1');
  form.append('response_format', 'verbose_json');
  form.append('timestamp_granularities[]', 'word');

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!res.ok) {
    throw new Error(`Whisper API ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as {
    text: string;
    words?: WhisperWord[];
    duration?: number;
  };
  return {
    text: data.text || '',
    words: data.words || [],
    duration: data.duration ?? null,
  };
}

/**
 * Translate a chunk of sentences via GPT-4o-mini.
 * Input: lines "id|text"; Output: lines "id|translation"
 */
export async function translateChunk(
  apiKey: string,
  sourceLang: string,
  targetLang: string,
  lines: string[],
): Promise<Map<number, string>> {
  const result = new Map<number, string>();
  if (lines.length === 0) return result;

  const sys =
    `You are a translator. Translate each ${sourceLang} sentence to ${targetLang}. ` +
    `Input format: "id|${sourceLang} sentence" (one per line). ` +
    `Output format: "id|${targetLang} translation" (one per line). ` +
    'Keep the same id numbers. Only output translations, nothing else.';

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.3,
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: lines.join('\n') },
      ],
    }),
  });
  if (!res.ok) {
    throw new Error(`Translate API ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const out = data.choices?.[0]?.message?.content || '';
  for (const line of out.trim().split('\n')) {
    const pipe = line.indexOf('|');
    if (pipe === -1) continue;
    const id = parseInt(line.slice(0, pipe), 10);
    const tr = line.slice(pipe + 1).trim();
    if (!isNaN(id) && tr) result.set(id, tr);
  }
  return result;
}
