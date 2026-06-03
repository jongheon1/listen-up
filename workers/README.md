# listen-up-api (Cloudflare Worker)

Hono-based port of the NestJS backend. R2 for audio + STT JSON, KV for metadata.

## Bindings
- `MEDIA` — R2 bucket `listen-up-media`
- `META` — KV namespace `listen-up-meta`
- `OPENAI_API_KEY` — secret (`wrangler secret put OPENAI_API_KEY`)

## Local dev

```bash
npm install
# Put dev OpenAI key
echo 'OPENAI_API_KEY="sk-..."' > .dev.vars
npm run dev
```

## Deploy

After `terraform apply` (creates R2 bucket + KV namespace), fill the KV id in `wrangler.toml`, then:

```bash
wrangler secret put OPENAI_API_KEY
npm run deploy
```

## Routes (same paths as old NestJS API)
- `GET    /api/files`
- `POST   /api/files/upload`
- `DELETE /api/files/:id`
- `GET    /api/files/:id/audio` (range-aware streaming from R2)
- `GET    /api/files/:id/stt`
- `POST   /api/files/:id/stt` (reprocess)
- `PUT|POST /api/files/:id/progress`
- `GET    /api/files/:id/progress`
- `PUT    /api/files/:id/stt/segments`
- `GET|POST|PUT|DELETE /api/playlists[/:id]`
- `GET|PUT /api/settings`
