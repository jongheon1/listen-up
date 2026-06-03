import type { Env, SttResult } from '../types';

export const audioKey = (filename: string) => `audio/${filename}`;
export const sttKey = (filename: string) => `stt/${filename}.json`;

export async function putAudio(env: Env, filename: string, body: ReadableStream | ArrayBuffer | Blob): Promise<void> {
  await env.MEDIA.put(audioKey(filename), body, {
    httpMetadata: { contentType: 'audio/mpeg' },
  });
}

export async function deleteAudio(env: Env, filename: string): Promise<void> {
  await env.MEDIA.delete(audioKey(filename));
}

export async function audioExists(env: Env, filename: string): Promise<boolean> {
  const head = await env.MEDIA.head(audioKey(filename));
  return head !== null;
}

export async function putStt(env: Env, filename: string, result: SttResult): Promise<void> {
  await env.MEDIA.put(sttKey(filename), JSON.stringify(result, null, 2), {
    httpMetadata: { contentType: 'application/json' },
  });
}

export async function getStt(env: Env, filename: string): Promise<SttResult | null> {
  const obj = await env.MEDIA.get(sttKey(filename));
  if (!obj) return null;
  return obj.json() as Promise<SttResult>;
}

export async function deleteStt(env: Env, filename: string): Promise<void> {
  await env.MEDIA.delete(sttKey(filename));
}

/** Parse HTTP Range header. Returns { offset, length } or null. */
export function parseRange(rangeHeader: string | undefined | null, size: number): { offset: number; length: number; end: number } | null {
  if (!rangeHeader) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
  if (!m) return null;
  const startStr = m[1];
  const endStr = m[2];
  let start: number;
  let end: number;
  if (startStr === '' && endStr !== '') {
    // suffix length: last N bytes
    const suffix = parseInt(endStr, 10);
    if (isNaN(suffix) || suffix <= 0) return null;
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = parseInt(startStr, 10);
    if (isNaN(start)) return null;
    end = endStr === '' ? size - 1 : parseInt(endStr, 10);
    if (isNaN(end)) return null;
  }
  if (start > end || start >= size) return null;
  end = Math.min(end, size - 1);
  return { offset: start, length: end - start + 1, end };
}

export async function streamAudio(env: Env, filename: string, rangeHeader: string | null): Promise<Response> {
  const key = audioKey(filename);
  if (rangeHeader) {
    const head = await env.MEDIA.head(key);
    if (!head) return new Response('Not found', { status: 404 });
    const range = parseRange(rangeHeader, head.size);
    if (!range) return new Response('Invalid range', { status: 416 });
    const obj = await env.MEDIA.get(key, { range: { offset: range.offset, length: range.length } });
    if (!obj) return new Response('Not found', { status: 404 });
    return new Response(obj.body, {
      status: 206,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': String(range.length),
        'Content-Range': `bytes ${range.offset}-${range.end}/${head.size}`,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'private, max-age=3600',
      },
    });
  }
  const obj = await env.MEDIA.get(key);
  if (!obj) return new Response('Not found', { status: 404 });
  return new Response(obj.body, {
    status: 200,
    headers: {
      'Content-Type': 'audio/mpeg',
      'Content-Length': String(obj.size),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
