import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MetaService } from '../meta/meta.service.js';
import OpenAI from 'openai';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import sbd from 'sbd';
import type { SttProvider } from './providers/stt-provider.interface.js';

const STT_DIR = join(process.cwd(), 'data', 'stt');
const AUDIO_DIR = join(process.cwd(), 'data', 'audio');

export interface Segment {
  id: number;
  start: number;
  end: number;
  text: string;
  translation: string;
}

@Injectable()
export class SttService {
  private readonly logger = new Logger(SttService.name);
  private openai: OpenAI;

  constructor(
    private readonly metaService: MetaService,
    private readonly configService: ConfigService,
    @Inject('STT_PROVIDER') private readonly provider: SttProvider,
  ) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
    });
  }

  async processFile(fileId: string): Promise<void> {
    const file = this.metaService.getFile(fileId);
    if (!file) {
      this.logger.error(`File not found: ${fileId}`);
      return;
    }

    await this.metaService.updateFile(fileId, { sttStatus: 'processing' });

    try {
      await mkdir(STT_DIR, { recursive: true });

      // 1. Transcription via provider
      const audioPath = join(AUDIO_DIR, file.filename);
      const transcription = await this.provider.transcribe(audioPath);

      const segments = this.buildSentenceSegments(
        transcription.words,
        transcription.text,
      );

      // 2. Translate with GPT
      const translated = await this.translateSegments(segments);

      // 3. Save results
      const duration = transcription.duration;
      const result = { segments: translated, duration };
      await writeFile(
        join(STT_DIR, `${file.filename}.json`),
        JSON.stringify(result, null, 2),
      );

      await this.metaService.updateFile(fileId, {
        sttStatus: 'done',
        duration,
      });

      this.logger.log(
        `STT completed for ${file.originalName}: ${translated.length} segments`,
      );
    } catch (err) {
      this.logger.error(`STT failed for ${file.originalName}:`, err);
      await this.metaService.updateFile(fileId, { sttStatus: 'error' });
    }
  }

  private buildSentenceSegments(
    words: { word: string; start: number; end: number }[],
    fullText: string,
  ): Segment[] {
    if (words.length === 0) return [];

    const sentences: string[] = sbd.sentences(fullText);

    const segments: Segment[] = [];
    let wordIdx = 0;

    const norm = (s: string) =>
      s.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

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

    for (let i = 0; i < segments.length - 1; i++) {
      const gap = segments[i + 1].start - segments[i].end;
      if (gap < 0.02) {
        segments[i].end = segments[i + 1].start - 0.02;
      }
    }

    return segments;
  }

  private async translateSegments(segments: Segment[]): Promise<Segment[]> {
    if (segments.length === 0) return segments;

    const CHUNK_SIZE = 50;
    const result = [...segments];

    for (let i = 0; i < segments.length; i += CHUNK_SIZE) {
      const chunk = segments.slice(i, i + CHUNK_SIZE);
      const input = chunk.map((s) => `${s.id}|${s.text}`).join('\n');

      try {
        const response = await this.openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content:
                'You are a translator. Translate each English sentence to Korean. ' +
                'Input format: "id|English sentence" (one per line). ' +
                'Output format: "id|Korean translation" (one per line). ' +
                'Keep the same id numbers. Only output translations, nothing else.',
            },
            { role: 'user', content: input },
          ],
          temperature: 0.3,
        });

        const output = response.choices[0]?.message?.content || '';
        const lines = output.trim().split('\n');
        for (const line of lines) {
          const pipeIdx = line.indexOf('|');
          if (pipeIdx === -1) continue;
          const id = parseInt(line.slice(0, pipeIdx), 10);
          const translation = line.slice(pipeIdx + 1).trim();
          if (!isNaN(id) && result[id]) {
            result[id].translation = translation;
          }
        }
      } catch (err) {
        this.logger.warn(`Translation chunk failed (offset ${i}):`, err);
      }
    }

    return result;
  }
}
