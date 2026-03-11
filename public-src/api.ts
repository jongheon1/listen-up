import type { FileMeta, SttResult, PlaylistMeta } from './types';

const BASE = '/api';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export async function listFiles(): Promise<{
  files: FileMeta[];
  lastPlayedFileId: string | null;
}> {
  return request('/files');
}

export async function uploadFiles(files: FileList | File[]): Promise<FileMeta[]> {
  const form = new FormData();
  for (const f of files) {
    form.append('files', f);
  }
  return request('/files/upload', { method: 'POST', body: form });
}

export async function deleteFile(id: string): Promise<void> {
  await request(`/files/${id}`, { method: 'DELETE' });
}

export function audioUrl(id: string): string {
  return `${BASE}/files/${id}/audio`;
}

export async function getStt(id: string): Promise<SttResult | null> {
  try {
    const result = await request<any>(`/files/${id}/stt`);
    if (result.status === 'not_ready') return null;
    return result as SttResult;
  } catch {
    return null;
  }
}

export async function reprocessStt(id: string): Promise<void> {
  await request(`/files/${id}/stt`, { method: 'POST' });
}

export async function saveProgress(
  id: string,
  currentTime: number,
  segmentIndex: number,
): Promise<void> {
  await request(`/files/${id}/progress`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentTime, segmentIndex }),
  });
}

export async function updateSegmentTimes(
  id: string,
  segments: { id: number; start: number; end: number }[],
): Promise<void> {
  await request(`/files/${id}/stt/segments`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ segments }),
  });
}

export async function getProgress(
  id: string,
): Promise<{ currentTime: number; segmentIndex: number }> {
  return request(`/files/${id}/progress`);
}

// Playlists
export async function listPlaylists(): Promise<PlaylistMeta[]> {
  return request('/playlists');
}

export async function createPlaylist(
  name: string,
  fileIds: string[],
): Promise<PlaylistMeta> {
  return request('/playlists', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, fileIds }),
  });
}

export async function updatePlaylist(
  id: string,
  update: Partial<PlaylistMeta>,
): Promise<PlaylistMeta> {
  return request(`/playlists/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(update),
  });
}

export async function deletePlaylist(id: string): Promise<void> {
  await request(`/playlists/${id}`, { method: 'DELETE' });
}
