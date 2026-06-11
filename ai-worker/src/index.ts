/**
 * OpenIslam Wiki — AI search assistant (Cloudflare Worker).
 *
 * The static site (GitHub Pages) cannot run server code, so the "brain" lives
 * here on Cloudflare's free tier:
 *   - Workers AI  : embeddings (@cf/baai/bge-base-en-v1.5) + answer (Llama 3.1)
 *   - Vectorize   : stores one vector per article chunk, queried by similarity
 *
 * Two routes:
 *   POST /ask     public  — { question } -> { answer, sources[], notFound }
 *   POST /ingest  private — bulk upsert chunks (called by scripts/ai-index.mjs)
 *
 * STRICT mode: the model may answer ONLY from retrieved article excerpts. If
 * the corpus doesn't cover the question it says so and returns closest matches.
 */

const EMBED_MODEL = '@cf/baai/bge-base-en-v1.5';
const CHAT_MODEL = '@cf/meta/llama-3.1-8b-instruct';
const TOP_K = 6;
// bge cosine similarity: relevant chunks usually score ~0.5-0.75. Below this we
// treat the topic as "not covered" rather than letting the model improvise.
const MIN_SCORE = 0.42;
const MAX_QUESTION_LEN = 600;

interface Env {
  AI: any;
  VECTORIZE: any;
  INGEST_SECRET: string;
  ALLOWED_ORIGINS?: string; // comma-separated, e.g. "https://www.openislam.wiki"
  RATE_LIMITER?: { limit: (opts: { key: string }) => Promise<{ success: boolean }> };
}

interface IngestChunk {
  id: string;
  text: string;
  title: string;
  url: string;
}

function corsHeaders(origin: string | null, env: Env): Record<string, string> {
  const allowed = (env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const isLocal = !!origin && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  const ok = !!origin && (allowed.length === 0 || allowed.includes(origin) || isLocal);
  return {
    'Access-Control-Allow-Origin': ok && origin ? origin : (allowed[0] || '*'),
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(body: unknown, status: number, extra: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...extra },
  });
}

async function embed(env: Env, texts: string[]): Promise<number[][]> {
  const res = await env.AI.run(EMBED_MODEL, { text: texts });
  return res.data as number[][];
}

async function handleAsk(request: Request, env: Env, cors: Record<string, string>): Promise<Response> {
  let body: { question?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400, cors);
  }

  const question = (body.question || '').toString().trim();
  if (!question) return json({ error: 'Empty question' }, 400, cors);
  if (question.length > MAX_QUESTION_LEN) {
    return json({ error: 'Question too long' }, 413, cors);
  }

  // Best-effort rate limit (free Cloudflare binding). Keyed per client IP.
  if (env.RATE_LIMITER) {
    const ip = request.headers.get('cf-connecting-ip') || 'anon';
    const { success } = await env.RATE_LIMITER.limit({ key: ip });
    if (!success) {
      return json(
        { error: 'Too many requests. Please wait a moment and try again.' },
        429,
        cors,
      );
    }
  }

  // 1. Embed the question, 2. find nearest article chunks.
  const [qVec] = await embed(env, [question]);
  const result = await env.VECTORIZE.query(qVec, {
    topK: TOP_K,
    returnMetadata: 'all',
  });

  const matches: Array<{ score: number; metadata: { title: string; url: string; text: string } }> =
    result.matches || [];

  // Dedupe sources by URL, preserve best score order.
  const seen = new Set<string>();
  const sources: Array<{ title: string; url: string }> = [];
  for (const m of matches) {
    const url = m.metadata?.url;
    if (url && !seen.has(url)) {
      seen.add(url);
      sources.push({ title: m.metadata.title, url });
    }
  }

  const relevant = matches.filter((m) => m.score >= MIN_SCORE);

  if (relevant.length === 0) {
    return json(
      {
        answer:
          "I couldn't find an article on OpenIslam Wiki that covers this yet. Here are the closest articles — they may still help:",
        sources: sources.slice(0, 4),
        notFound: true,
      },
      200,
      cors,
    );
  }

  const context = relevant
    .map((m, i) => `[${i + 1}] ${m.metadata.title}\n${m.metadata.text}`)
    .join('\n\n---\n\n');

  const system = [
    'You are the search assistant for OpenIslam Wiki, an Islamic scholarship and',
    'apologetics resource. Answer the user using ONLY the article excerpts provided',
    'below. Rules:',
    '- If the excerpts do not contain the answer, say the site does not have an',
    '  article on this yet — do NOT use outside knowledge or guess.',
    '- Never invent hadith gradings, citations, scholars, or facts.',
    '- Be concise: 2-5 sentences. Plain, respectful tone.',
    '- Do not write URLs or a sources list; the interface shows the source links.',
  ].join('\n');

  const user = `Article excerpts:\n\n${context}\n\nQuestion: ${question}`;

  const completion = await env.AI.run(CHAT_MODEL, {
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    max_tokens: 600,
    temperature: 0.2,
  });

  const answer = (completion.response || '').toString().trim();

  // Only surface sources that were actually relevant.
  const relevantUrls = new Set(relevant.map((m) => m.metadata.url));
  const usedSources = sources.filter((s) => relevantUrls.has(s.url)).slice(0, 4);

  return json({ answer, sources: usedSources, notFound: false }, 200, cors);
}

async function handleIngest(request: Request, env: Env, cors: Record<string, string>): Promise<Response> {
  const auth = request.headers.get('Authorization') || '';
  if (auth !== `Bearer ${env.INGEST_SECRET}`) {
    return json({ error: 'Unauthorized' }, 401, cors);
  }

  let body: { chunks?: IngestChunk[] };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400, cors);
  }

  const chunks = (body.chunks || []).filter((c) => c && c.id && c.text);
  if (chunks.length === 0) return json({ error: 'No chunks' }, 400, cors);
  if (chunks.length > 100) return json({ error: 'Max 100 chunks per request' }, 413, cors);

  const vectors = await embed(env, chunks.map((c) => c.text));
  const upserts = chunks.map((c, i) => ({
    id: c.id,
    values: vectors[i],
    metadata: {
      title: c.title,
      url: c.url,
      // Vectorize caps metadata size; keep excerpt bounded.
      text: c.text.slice(0, 4000),
    },
  }));

  await env.VECTORIZE.upsert(upserts);
  return json({ upserted: upserts.length }, 200, cors);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin');
    const cors = corsHeaders(origin, env);
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    try {
      if (request.method === 'POST' && url.pathname === '/ask') {
        return await handleAsk(request, env, cors);
      }
      if (request.method === 'POST' && url.pathname === '/ingest') {
        return await handleIngest(request, env, cors);
      }
    } catch (err: any) {
      return json({ error: 'Server error', detail: String(err?.message || err) }, 500, cors);
    }

    return json({ error: 'Not found' }, 404, cors);
  },
};
