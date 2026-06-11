# OpenIslam AI Assistant — Cloudflare Worker

The site is static (GitHub Pages) and can't run server code, so the assistant's
"brain" lives here on Cloudflare's **free tier**:

- **Workers AI** — embeddings (`bge-base-en-v1.5`) + answers (Llama 3.1 8B)
- **Vectorize** — one vector per article chunk, queried by similarity
- **Rate limiting** — 20 requests / 60s per IP (built-in binding)

The browser widget (`src/components/AiAssistant.astro`, homepage only) calls
`POST /ask`. The indexer (`scripts/ai-index.mjs`) calls `POST /ingest`.

**Strict mode:** the model may answer *only* from retrieved article excerpts. If
the corpus doesn't cover a question it says so and returns the closest matches.

---

## One-time setup

From this `ai-worker/` folder:

```bash
npm install
npx wrangler login                       # opens browser, free Cloudflare account

# 1. Create the vector index (768 dims = bge-base, cosine similarity)
npx wrangler vectorize create openislam-articles --dimensions=768 --metric=cosine

# 2. Set the shared ingest secret (any long random string)
npx wrangler secret put INGEST_SECRET    # paste the same value you'll use below

# 3. Deploy
npx wrangler deploy
```

Deploy prints your Worker URL, e.g. `https://openislam-ai.<your-subdomain>.workers.dev`.

Then, **back in the site repo**, set that URL in `src/config.ts`:

```ts
aiAssistant: {
  enabled: true,
  workerUrl: "https://openislam-ai.<your-subdomain>.workers.dev",
  ...
}
```

> The site's CSP already allows `https://*.workers.dev`. If you later put the
> Worker on a custom domain, add that origin to `connectDirective` in
> `astro.config.mjs` and to `ALLOWED_ORIGINS` in `wrangler.toml`.

---

## Build / refresh the search index

From the **site repo root** (not this folder). Re-run any time content changes:

```bash
AI_WORKER_URL=https://openislam-ai.<your-subdomain>.workers.dev \
AI_INGEST_SECRET=<same value as the secret above> \
pnpm ai:index
```

Preview without sending: `pnpm ai:index:dry`.

(On Windows PowerShell, set the env vars first:
`$env:AI_WORKER_URL="…"; $env:AI_INGEST_SECRET="…"; pnpm ai:index`)

You can also keep these in a local `.env` at the repo root (git-ignored):

```
AI_WORKER_URL=https://openislam-ai.<your-subdomain>.workers.dev
AI_INGEST_SECRET=...
AI_SITE_URL=https://www.openislam.wiki
```

---

## Local development

```bash
cp .dev.vars.example .dev.vars        # put INGEST_SECRET inside
npx wrangler dev                      # http://localhost:8787
```

`localhost` origins are always allowed by CORS, so you can point the site's
`workerUrl` at `http://localhost:8787` while testing.

---

## Cost & limits

Everything above sits inside Cloudflare's free tier for a blog's traffic:
Workers (100k req/day), Workers AI (daily free neuron allotment), and Vectorize.
The per-IP rate limit guards against a bot draining the quota. Watch live logs
with `npx wrangler tail`.

## Routes

| Method | Path      | Auth                      | Purpose                          |
|--------|-----------|---------------------------|----------------------------------|
| POST   | `/ask`    | none (CORS + rate limit)  | `{ question }` → `{ answer, sources, notFound }` |
| POST   | `/ingest` | `Bearer INGEST_SECRET`    | bulk upsert chunks (indexer)     |
