import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { createReadStream } from 'fs';
import { SttProvider, TranscriptionResult } from './stt-provider.interface.js';

@Injectable()
export class OpenAiSttProvider implements SttProvider {
  private openai: OpenAI;

  constructor(private readonly configService: ConfigService) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
    });
  }

  async transcribe(audioPath: string): Promise<TranscriptionResult> {
    const transcription = await this.openai.audio.transcriptions.create({
      file: createReadStream(audioPath),
      model: 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularities: ['word'],
    });

    const words: { word: string; start: number; end: number }[] =
      (transcription as any).words || [];
    const text: string = (transcription as any).text || '';
    const duration: number | null = (transcription as any).duration || null;

    return { words, text, duration };
  }
}
