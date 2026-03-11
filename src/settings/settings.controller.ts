import { Controller, Get, Put, Body } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

const SETTINGS_PATH = join(process.cwd(), 'data', 'settings.json');

interface LangSettings {
  sourceLang: string;
  targetLang: string;
}

async function loadSettings(): Promise<LangSettings | null> {
  try {
    const data = await readFile(SETTINGS_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

async function saveSettings(settings: LangSettings): Promise<void> {
  await mkdir(join(process.cwd(), 'data'), { recursive: true });
  await writeFile(SETTINGS_PATH, JSON.stringify(settings, null, 2));
}

@Controller('settings')
export class SettingsController {
  constructor(private readonly configService: ConfigService) {}

  @Get()
  async getSettings(): Promise<LangSettings> {
    const saved = await loadSettings();
    return {
      sourceLang: saved?.sourceLang || this.configService.get<string>('SOURCE_LANG') || 'English',
      targetLang: saved?.targetLang || this.configService.get<string>('TARGET_LANG') || 'Korean',
    };
  }

  @Put()
  async updateSettings(@Body() body: LangSettings): Promise<LangSettings> {
    const settings: LangSettings = {
      sourceLang: body.sourceLang,
      targetLang: body.targetLang,
    };
    await saveSettings(settings);
    return settings;
  }
}
