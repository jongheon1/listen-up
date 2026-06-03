import { Hono } from 'hono';
import type { Env, FileMeta } from '../types';
import {
  loadMeta,
  mutateMeta,
  addFile,
  updateFileInPlace,
  deleteFileInPlace,
} from '../lib/meta';
import {
  putAudio,
  deleteAudio,
  audioExists,
  getStt as getSttFromR2,
  deleteStt,
  streamAudio,
} from '../lib/r2';
import { processFile } from '../lib/stt';

const files = new Hono<{ Bindings: Env }>();

files.get('/', async (c) => {
  const data = await loadMeta(c.env);
  return c.json({
    files: Object.values(data.files),
    lastPlayedFileId: data.lastPlayedFileId,
  });
});

files.post('/upload', async (c) => {
  const form = await c.req.formData();
  const incoming: File[] = [];
  for (const v of form.getAll('files')) {
    if (typeof v !== 'string') incoming.push(v as unknown as File);
  }

  if (incoming.length === 0) {
    return c.json({ message: 'No files uploaded' }, 400);
  }

  // Validate extension first
  for (const f of incoming) {
    if (!f.name.toLowerCase().endsWith('.mp3')) {
      return c.json({ message: 'Only .mp3 files are allowed' }, 400);
    }
  }

  // Resolve filename collisions; upload to R2 first, then persist meta as a single
  // KV write so we don't issue 1 write per file.
  const results: FileMeta[] = [];
  const data = await loadMeta(c.env);

  for (const f of incoming) {
    const original = f.name;
    const dot = original.lastIndexOf('.');
    const base = dot === -1 ? original : original.slice(0, dot);
    const ext = dot === -1 ? '' : original.slice(dot);

    let filename = original;
    if (await audioExists(c.env, filename)) {
      filename = `${base}_${Date.now()}${ext}`;
    }

    await putAudio(c.env, filename, await f.arrayBuffer());

    const meta: FileMeta = {
      id: crypto.randomUUID(),
      originalName: original,
      filename,
      duration: null,
      sttStatus: 'pending',
      createdAt: new Date().toISOString(),
    };
    addFile(data, meta);
    results.push(meta);
  }
  await c.env.META.put('meta', JSON.stringify(data));

  // Fire-and-forget STT — runs after response is sent
  for (const r of results) {
    c.executionCtx.waitUntil(processFile(c.env, r.id));
  }
  return c.json(results);
});

files.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const data = await loadMeta(c.env);
  const file = data.files[id];
  if (!file) return c.json({ message: 'File not found' }, 404);

  await deleteAudio(c.env, file.filename).catch(() => {});
  await deleteStt(c.env, file.filename).catch(() => {});

  deleteFileInPlace(data, id);
  await c.env.META.put('meta', JSON.stringify(data));
  return c.json({ success: true });
});

files.get('/:id/audio', async (c) => {
  const id = c.req.param('id');
  const data = await loadMeta(c.env);
  const file = data.files[id];
  if (!file) return c.json({ message: 'File not found' }, 404);
  return streamAudio(c.env, file.filename, c.req.header('range') ?? null);
});

files.get('/:id/stt', async (c) => {
  const id = c.req.param('id');
  const data = await loadMeta(c.env);
  const file = data.files[id];
  if (!file) return c.json({ message: 'File not found' }, 404);
  const result = await getSttFromR2(c.env, file.filename);
  if (!result) return c.json({ status: 'not_ready', segments: [] });
  return c.json(result);
});

files.post('/:id/stt', async (c) => {
  const id = c.req.param('id');
  const data = await loadMeta(c.env);
  if (!data.files[id]) return c.json({ message: 'File not found' }, 404);
  c.executionCtx.waitUntil(processFile(c.env, id));
  return c.json({ status: 'processing' });
});

async function handleProgress(c: any) {
  const id = c.req.param('id');
  const body = (await c.req.json()) as { currentTime: number; segmentIndex: number };
  const updated = await mutateMeta(c.env, (d) => {
    if (!d.files[id]) return;
    updateFileInPlace(d, id, { progress: { currentTime: body.currentTime, segmentIndex: body.segmentIndex } });
    d.lastPlayedFileId = id;
  });
  if (!updated.files[id]) return c.json({ message: 'File not found' }, 404);
  return c.json({ success: true });
}
files.put('/:id/progress', handleProgress);
files.post('/:id/progress', handleProgress);

files.get('/:id/progress', async (c) => {
  const id = c.req.param('id');
  const data = await loadMeta(c.env);
  const file = data.files[id];
  if (!file) return c.json({ message: 'File not found' }, 404);
  return c.json(file.progress ?? { currentTime: 0, segmentIndex: 0 });
});

files.put('/:id/stt/segments', async (c) => {
  const id = c.req.param('id');
  const body = (await c.req.json()) as { segments: { id: number; start: number; end: number }[] };

  const data = await loadMeta(c.env);
  const file = data.files[id];
  if (!file) return c.json({ message: 'File not found' }, 404);

  const stt = await getSttFromR2(c.env, file.filename);
  if (!stt) return c.json({ message: 'STT not found' }, 404);

  const upd = new Map(body.segments.map((u) => [u.id, u] as const));
  for (const seg of stt.segments) {
    const u = upd.get(seg.id);
    if (u) {
      seg.start = u.start;
      seg.end = u.end;
    }
  }
  const { putStt } = await import('../lib/r2');
  await putStt(c.env, file.filename, stt);
  return c.json({ success: true });
});

export default files;
