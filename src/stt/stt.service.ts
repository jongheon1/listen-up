import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MetaService } from '../meta/meta.service.js';
import OpenAI from 'openai';
import { createReadStream } from 'fs';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import sbd from 'sbd';

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

      // 1. Whisper transcription
      const audioPath = join(AUDIO_DIR, file.filename);
      const transcription = await this.openai.audio.transcriptions.create({
        file: createReadStream(audioPath),
        model: 'whisper-1',
        response_format: 'verbose_json',
        timestamp_granularities: ['word'],
      });

      const words: { word: string; start: number; end: number }[] =
        (transcription as any).words || [];
      const segments = this.buildSentenceSegments(words);

      // 2. Translate with GPT
      const translated = await this.translateSegments(segments);

      // 3. Save results
      const duration = (transcription as any).duration || null;
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
  ): Segment[] {
    if (words.length === 0) return [];

    const fullText = words.map((w) => w.word).join(' ');
    const sentences: string[] = sbd.sentences(fullText);

    const segments: Segment[] = [];
    let wordIdx = 0;

    for (let i = 0; i < sentences.length; i++) {
      const sentenceWords = sentences[i].trim().split(/\s+/);
      const start = words[wordIdx]?.start ?? 0;
      const endIdx = Math.min(wordIdx + sentenceWords.length - 1, words.length - 1);
      const end = words[endIdx]?.end ?? start;

      segments.push({
        id: i,
        start,
        end,
        text: sentences[i].trim(),
        translation: '',
      });

      wordIdx = endIdx + 1;
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
