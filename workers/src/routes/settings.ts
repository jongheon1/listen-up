import { Hono } from 'hono';
import type { Env, LangSettings } from '../types';
import { loadSettings, saveSettings } from '../lib/meta';

const settings = new Hono<{ Bindings: Env }>();

settings.get('/', async (c) => {
  return c.json(await loadSettings(c.env));
});

settings.put('/', async (c) => {
  const body = (await c.req.json()) as LangSettings;
  const next: LangSettings = {
    sourceLang: body.sourceLang,
    targetLang: body.targetLang,
  };
  await saveSettings(c.env, next);
  return c.json(next);
});

export default settings;
