import { Hono } from 'hono';
import type { Env, PlaylistMeta } from '../types';
import {
  loadMeta,
  mutateMeta,
  addPlaylist,
  updatePlaylistInPlace,
  deletePlaylistInPlace,
} from '../lib/meta';

const playlists = new Hono<{ Bindings: Env }>();

playlists.get('/', async (c) => {
  const data = await loadMeta(c.env);
  return c.json(Object.values(data.playlists));
});

playlists.post('/', async (c) => {
  const body = (await c.req.json()) as { name: string; fileIds?: string[] };
  const pl: PlaylistMeta = {
    id: crypto.randomUUID(),
    name: body.name,
    fileIds: body.fileIds ?? [],
    createdAt: new Date().toISOString(),
  };
  await mutateMeta(c.env, (d) => addPlaylist(d, pl));
  return c.json(pl);
});

playlists.put('/:id', async (c) => {
  const id = c.req.param('id');
  const body = (await c.req.json()) as { name?: string; fileIds?: string[] };
  let result: PlaylistMeta | null = null;
  await mutateMeta(c.env, (d) => {
    result = updatePlaylistInPlace(d, id, body);
  });
  if (!result) return c.json({ message: 'Playlist not found' }, 404);
  return c.json(result);
});

playlists.delete('/:id', async (c) => {
  const id = c.req.param('id');
  let ok = false;
  await mutateMeta(c.env, (d) => {
    ok = deletePlaylistInPlace(d, id);
  });
  if (!ok) return c.json({ message: 'Playlist not found' }, 404);
  return c.json({ success: true });
});

export default playlists;
