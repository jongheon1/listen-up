import sbd from 'sbd';
import type { Segment } from '../types';

/**
 * Build sentence-level segments from Whisper word-level timestamps.
 * Port of NestJS SttService.buildSentenceSegments.
 */
export function buildSentenceSegments(
  words: { word: string; start: number; end: number }[],
  fullText: string,
): Segment[] {
  if (words.length === 0) return [];

  const sentences: string[] = sbd.sentences(fullText);
  const segments: Segment[] = [];
  let wordIdx = 0;

  const norm = (s: string) => s.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

  for (let i = 0; i < sentences.length; i++) {
    const sentenceNorm = norm(sentences[i]);
    const startIdx = wordIdx;
    let accumulated = '';

    while (wordIdx < words.length) {
      accumulated += norm(words[wordIdx].word);
      wordIdx++;
      if (accumulated.length >= sentenceNorm.length) break;
    }

    // Last sentence absorbs remaining words
    if (i === sentences.length - 1 && wordIdx < words.length) {
      wordIdx = words.length;
    }

    const start = words[startIdx]?.start ?? 0;
    const end = words[Math.min(wordIdx - 1, words.length - 1)]?.end ?? start;

    segments.push({
      id: i,
      start,
      end,
      text: sentences[i].trim(),
      translation: '',
    });
  }

  // Tighten boundaries to avoid bleed
  for (let i = 0; i < segments.length - 1; i++) {
    const gap = segments[i + 1].start - segments[i].end;
    if (gap < 0.02) {
      segments[i].end = segments[i + 1].start - 0.02;
    }
  }

  return segments;
}
