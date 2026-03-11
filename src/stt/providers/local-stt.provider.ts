import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'child_process';
import { join } from 'path';
import { SttProvider, TranscriptionResult } from './stt-provider.interface.js';

@Injectable()
export class LocalSttProvider implements SttProvider {
  private readonly logger = new Logger(LocalSttProvider.name);
  private readonly model: string;

  constructor(private readonly configService: ConfigService) {
    this.model = this.configService.get<string>('WHISPER_MODEL') || 'small';
  }

  transcribe(audioPath: string): Promise<TranscriptionResult> {
    const scriptPath = join(process.cwd(), 'scripts', 'transcribe.py');

    return new Promise((resolve, reject) => {
      execFile(
        'python',
        [scriptPath, audioPath, this.model],
        { timeout: 10 * 60 * 1000, maxBuffer: 50 * 1024 * 1024 },
        (error, stdout, stderr) => {
          if (error) {
            this.logger.error(`faster-whisper failed: ${stderr}`);
            reject(error);
            return;
          }

          try {
            const result = JSON.parse(stdout);
            resolve({
              words: result.words,
              text: result.text,
              duration: result.duration ?? null,
            });
          } catch (parseErr) {
            this.logger.error(`Failed to parse transcribe.py output: ${stdout}`);
            reject(parseErr);
          }
        },
      );
    });
  }
}
