// Pages middleware: proxy /api/* to the dedicated Worker; serve static otherwise.
// Required while testing on *.pages.dev (no Workers Route there).
// After NS swap, requests to listen.jongheon.click/api/* hit the Worker
// directly via wrangler.toml route — this proxy is bypassed and harmless.

const API_ORIGIN = 'https://listen-up-api.heon0128.workers.dev';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      const target = API_ORIGIN + url.pathname + url.search;
      const forwarded = new Request(target, request);
      return fetch(forwarded);
    }
    return env.ASSETS.fetch(request);
  },
};
