import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SttService } from './stt.service.js';
import { OpenAiSttProvider } from './providers/openai-stt.provider.js';
import { LocalSttProvider } from './providers/local-stt.provider.js';

@Module({
  providers: [
    SttService,
    OpenAiSttProvider,
    LocalSttProvider,
    {
      provide: 'STT_PROVIDER',
      useFactory: (
        configService: ConfigService,
        openai: OpenAiSttProvider,
        local: LocalSttProvider,
      ) => {
        const provider = configService.get<string>('STT_PROVIDER') || 'openai';
        return provider === 'local' ? local : openai;
      },
      inject: [ConfigService, OpenAiSttProvider, LocalSttProvider],
    },
  ],
  exports: [SttService],
})
export class SttModule {}
