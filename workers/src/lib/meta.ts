import type { Env, MetaData, FileMeta, PlaylistMeta, LangSettings } from '../types';

const META_KEY = 'meta';
const SETTINGS_KEY = 'settings';

const DEFAULT: MetaData = { files: {}, playlists: {}, lastPlayedFileId: null };

export async function loadMeta(env: Env): Promise<MetaData> {
  const raw = await env.META.get(META_KEY, 'json');
  if (!raw) return structuredClone(DEFAULT);
  return raw as MetaData;
}

export async function saveMeta(env: Env, data: MetaData): Promise<void> {
  await env.META.put(META_KEY, JSON.stringify(data));
}

export async function mutateMeta(
  env: Env,
  fn: (data: MetaData) => void | Promise<void>,
): Promise<MetaData> {
  const data = await loadMeta(env);
  await fn(data);
  await saveMeta(env, data);
  return data;
}

export async function loadSettings(env: Env): Promise<LangSettings> {
  const raw = await env.META.get(SETTINGS_KEY, 'json') as LangSettings | null;
  return {
    sourceLang: raw?.sourceLang || env.SOURCE_LANG || 'English',
    targetLang: raw?.targetLang || env.TARGET_LANG || 'Korean',
  };
}

export async function saveSettings(env: Env, settings: LangSettings): Promise<void> {
  await env.META.put(SETTINGS_KEY, JSON.stringify(settings));
}

export function addFile(data: MetaData, meta: FileMeta): void {
  data.files[meta.id] = meta;
}

export function updateFileInPlace(
  data: MetaData,
  id: string,
  patch: Partial<FileMeta>,
): boolean {
  if (!data.files[id]) return false;
  Object.assign(data.files[id], patch);
  return true;
}

export function deleteFileInPlace(data: MetaData, id: string): boolean {
  if (!data.files[id]) return false;
  delete data.files[id];
  if (data.lastPlayedFileId === id) data.lastPlayedFileId = null;
  for (const pl of Object.values(data.playlists)) {
    pl.fileIds = pl.fileIds.filter((fid) => fid !== id);
  }
  return true;
}

export function addPlaylist(data: MetaData, pl: PlaylistMeta): void {
  data.playlists[pl.id] = pl;
}

export function updatePlaylistInPlace(
  data: MetaData,
  id: string,
  patch: Partial<PlaylistMeta>,
): PlaylistMeta | null {
  if (!data.playlists[id]) return null;
  Object.assign(data.playlists[id], patch);
  return data.playlists[id];
}

export function deletePlaylistInPlace(data: MetaData, id: string): boolean {
  if (!data.playlists[id]) return false;
  delete data.playlists[id];
  return true;
}
