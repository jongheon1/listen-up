import type { Env, SttResult, Segment } from '../types';
import { transcribe, translateChunk } from './openai';
import { buildSentenceSegments } from './sentences';
import { audioKey, putStt } from './r2';
import { loadSettings, mutateMeta, updateFileInPlace } from './meta';

const TRANSLATE_CHUNK = 50;

/**
 * Run the full STT pipeline for a file: Whisper → sentence split → translate → save.
 * Updates file meta status: processing → done / error.
 */
export async function processFile(env: Env, fileId: string): Promise<void> {
  // Mark processing
  await mutateMeta(env, (d) => {
    updateFileInPlace(d, fileId, { sttStatus: 'processing' });
  });

  let filename: string | null = null;
  try {
    const data = await mutateMeta(env, () => {}); // just load
    const file = data.files[fileId];
    if (!file) throw new Error(`File not found: ${fileId}`);
    filename = file.filename;

    // 1. Pull audio from R2 as Blob for OpenAI
    const obj = await env.MEDIA.get(audioKey(filename));
    if (!obj) throw new Error(`Audio missing in R2: ${filename}`);
    const buf = await obj.arrayBuffer();
    const audioBlob = new Blob([buf], { type: 'audio/mpeg' });

    // 2. Whisper
    const transcription = await transcribe(env.OPENAI_API_KEY, audioBlob, filename);

    // 3. Sentence segments
    const segments: Segment[] = buildSentenceSegments(transcription.words, transcription.text);

    // 4. Translate (chunks)
    const { sourceLang, targetLang } = await loadSettings(env);
    for (let i = 0; i < segments.length; i += TRANSLATE_CHUNK) {
      const chunk = segments.slice(i, i + TRANSLATE_CHUNK);
      const lines = chunk.map((s) => `${s.id}|${s.text}`);
      try {
        const out = await translateChunk(env.OPENAI_API_KEY, sourceLang, targetLang, lines);
        for (const seg of chunk) {
          const tr = out.get(seg.id);
          if (tr) seg.translation = tr;
        }
      } catch (err) {
        console.warn(`translate chunk at ${i} failed`, err);
      }
    }

    const result: SttResult = { segments, duration: transcription.duration };

    // 5. Save STT to R2
    await putStt(env, filename, result);

    // 6. Update meta
    await mutateMeta(env, (d) => {
      updateFileInPlace(d, fileId, { sttStatus: 'done', duration: transcription.duration });
    });
    console.log(`STT done: ${file.originalName} (${segments.length} segments)`);
  } catch (err) {
    console.error(`STT failed for ${fileId}:`, err);
    await mutateMeta(env, (d) => {
      updateFileInPlace(d, fileId, { sttStatus: 'error' });
    });
  }
}
