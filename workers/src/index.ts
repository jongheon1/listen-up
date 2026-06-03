import { Hono } from 'hono';
import type { Env } from './types';
import files from './routes/files';
import playlists from './routes/playlists';
import settings from './routes/settings';

const app = new Hono<{ Bindings: Env }>();

app.get('/api/health', (c) => c.json({ ok: true }));

app.route('/api/files', files);
app.route('/api/playlists', playlists);
app.route('/api/settings', settings);

app.onError((err, c) => {
  console.error('Unhandled error', err);
  return c.json({ message: err.message ?? 'Internal error' }, 500);
});

export default app;
