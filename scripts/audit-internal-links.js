#!/usr/bin/env node

/**
 * Internal Link Audit
 * ===================
 *
 * SEO diagnosis showed link equity is hoarded by nav/utility pages while
 * individual articles are link-starved (few or zero inbound internal links).
 * Google treats orphaned/under-linked articles as low-priority → they don't
 * rank. This script surfaces the fix: concrete `[[wikilink]]` pairs to add.
 *
 * It reads the posts collection (read-only — content is a submodule, never
 * edited here), builds the existing article→article link graph, then for every
 * under-linked article finds topically-related articles that SHOULD link to it
 * but don't. Output is a human-actionable Markdown report + a JSON file.
 *
 * Usage:  node scripts/audit-internal-links.js
 *         pnpm audit-links
 *
 * Flags:  --min-backlinks=N   under-linked threshold (default 2)
 *         --max-suggestions=N  inbound suggestions per article (default 5)
 *         --top=N              cap orphan/under-linked sections (default 60)
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");
const POSTS_DIR = join(projectRoot, "src", "content", "posts");
const OUT_MD = join(projectRoot, "internal-link-audit.md");
const OUT_JSON = join(projectRoot, "internal-link-audit.json");
const OUT_PRIORITY = join(projectRoot, "seo-priority.md");
const OUT_PRIORITY_JSON = join(projectRoot, "seo-priority.json");

const arg = (name, def) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? Number(hit.split("=")[1]) : def;
};
const gscArg = process.argv.find((a) => a.startsWith("--gsc="));
const GSC_PATH = gscArg ? gscArg.split("=")[1] : join(projectRoot, "seo", "gsc-queries.csv");
const MIN_BACKLINKS = arg("min-backlinks", 2);
const MAX_SUGGESTIONS = arg("max-suggestions", 5);
const TOP = arg("top", 60);

// ── ID generation (mirrors generate-graph-data.js so link targets resolve) ────
function generateNodeId(filePath) {
  let id = filePath.replace(/^src\/content\/posts\//, "");
  id = id.replace(/\.mdx?$/, "").replace("/index", "");
  id = id.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "");
  return id;
}

function extractWikilinks(content) {
  const out = [];
  const re = /!?\[\[([^\]]+)\]\]/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    if (m[0].startsWith("!")) continue; // image wikilink
    const inner = m[1].includes("|") ? m[1].split("|", 2)[0] : m[1];
    const base = inner.split("#")[0];
    out.push(generateNodeId(base));
  }
  return out;
}

function extractStandardLinks(content) {
  const out = [];
  const re = /\[([^\]]+)\]\(([^)]+)\)/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    let url = m[2].trim();
    if (/^(https?:|mailto:|#)/.test(url)) continue;
    let link = url.split("#")[0];
    if (link.startsWith("/posts/")) link = link.slice(7);
    else if (link.startsWith("posts/")) link = link.slice(6);
    link = link.replace(/\.mdx?$/, "").replace(/\/index$/, "");
    if (!link) continue;
    out.push(generateNodeId(link));
  }
  return out;
}

// ── Frontmatter parse (regex, same style as generate-graph-data.js) ───────────
function parseFile(content, id) {
  const fm = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!fm) return null;
  const [, frontmatter, body] = fm;
  const lines = frontmatter.split(/\r?\n/);
  const data = {};
  let key = null, arr = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const t = line.trim();
    if (!t) continue;
    const ci = line.indexOf(":");
    if (ci > 0 && !line.startsWith(" ")) {
      if (key && arr.length) { data[key] = [...arr]; arr = []; }
      const k = line.slice(0, ci).trim();
      let v = line.slice(ci + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (v.startsWith("[") && v.endsWith("]")) {
        const inner = v.slice(1, -1).trim();
        data[k] = !inner ? [] : inner.split(",").map((s) => s.trim().replace(/^['"]|['"]$/g, "")).filter(Boolean);
        key = null;
      } else if (i + 1 < lines.length && lines[i + 1].trim().startsWith("- ")) {
        key = k; arr = [];
      } else {
        data[k] = v === "true" ? true : v === "false" ? false : v;
      }
    } else if (t.startsWith("- ")) {
      arr.push(t.slice(2).trim().replace(/^['"]|['"]$/g, ""));
    }
  }
  if (key && arr.length) data[key] = [...arr];
  return { id, data, body };
}

function readPosts(dir) {
  const posts = [];
  for (const item of readdirSync(dir)) {
    const p = join(dir, item);
    const st = statSync(p);
    if (st.isDirectory()) {
      const idx = ["index.md", "index.mdx"].map((f) => join(p, f)).find(existsSync);
      if (idx) { const parsed = parseFile(readFileSync(idx, "utf-8"), item); if (parsed) posts.push(parsed); }
    } else if (/\.mdx?$/.test(item)) {
      const parsed = parseFile(readFileSync(p, "utf-8"), item.replace(/\.mdx?$/, ""));
      if (parsed) posts.push(parsed);
    }
  }
  return posts;
}

// ── Text tokenisation for topical similarity ──────────────────────────────────
const STOP = new Set(("the a an and or but of to in on at for with is are was were be been being this that " +
  "it its as by from into about have has had do does did not no if then than so such also can will would " +
  "what which who whom whose why how when where all any some more most other one two i you he she they we").split(" "));

function tokens(text) {
  return (text.toLowerCase().match(/[a-z][a-z'-]{2,}/g) || []).filter((w) => !STOP.has(w));
}
function keyTerms(text, n = 12) {
  const freq = new Map();
  for (const w of tokens(text)) freq.set(w, (freq.get(w) || 0) + 1);
  return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([w]) => w);
}

// ── GSC merge helpers ─────────────────────────────────────────────────────────
// Search tokeniser that KEEPS numbers & references (e.g. "5825", "2167a",
// "44:54") — these are the highest-signal terms for matching a hadith/verse
// query to the exact article. Also splits hyphenated alpha into parts.
function searchTokens(text) {
  const rawToks = (text.toLowerCase().match(/[a-z0-9][a-z0-9:'’._-]*/g) || []);
  const out = [];
  for (let t of rawToks) {
    t = t.replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "");
    if (!t) continue;
    const hasDigit = /\d/.test(t);
    if (hasDigit) { if (t.length >= 2) out.push(t); continue; }
    if (t.length < 3 || STOP.has(t)) continue;
    out.push(t);
    if (t.includes("-")) for (const part of t.split("-")) if (part.length >= 3 && !STOP.has(part)) out.push(part);
  }
  return out;
}

// Minimal RFC-4180 CSV parser (handles quoted fields, doubled quotes, commas).
function parseCSV(text) {
  const rows = [];
  let row = [], field = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.length && r.some((c) => c.trim() !== ""));
}

function loadGSC(path) {
  const rows = parseCSV(readFileSync(path, "utf-8"));
  const header = rows.shift().map((h) => h.trim().toLowerCase());
  const qi = header.findIndex((h) => h.includes("quer") || h.includes("page") || h.includes("top"));
  const ci = header.findIndex((h) => h.includes("click"));
  const ii = header.findIndex((h) => h.includes("impress"));
  const pi = header.findIndex((h) => h.includes("position"));
  return rows.map((r) => ({
    query: (r[qi < 0 ? 0 : qi] || "").trim(),
    clicks: Number(r[ci]) || 0,
    impressions: Number(r[ii]) || 0,
    position: parseFloat(r[pi]) || 0,
  })).filter((r) => r.query);
}

// Brand / navigational queries — people already know the site; exclude from
// the ranking-opportunity analysis (they're not informational demand).
const BRAND_RE = /open\s*islam|openislam/i;

function main() {
  if (!existsSync(POSTS_DIR)) {
    console.error(`❌ Posts dir not found: ${POSTS_DIR}\n   Content submodule not checked out?`);
    process.exit(1);
  }

  const raw = readPosts(POSTS_DIR).filter((p) => !p.data.draft);
  const byId = new Map(raw.map((p) => [p.id, p]));
  const ids = new Set(byId.keys());

  // Build per-post model: existing outgoing links, tags, category, key terms.
  const posts = raw.map((p) => {
    const links = new Set([...extractWikilinks(p.body || ""), ...extractStandardLinks(p.body || "")].filter((t) => ids.has(t) && t !== p.id));
    const tags = (Array.isArray(p.data.tags) ? p.data.tags : []).filter(Boolean).map((t) => String(t).toLowerCase());
    const category = p.data.category ? String(p.data.category).toLowerCase() : null;
    const title = p.data.title || p.id;
    return {
      id: p.id,
      title,
      category,
      tags: new Set(tags),
      links,                                   // outgoing article links (existing)
      titleTerms: new Set(keyTerms(title, 8)),
      bodyTerms: new Set(keyTerms(`${title} ${p.body || ""}`, 40)),
    };
  });

  // Backlink counts (inbound existing internal links).
  const backlinks = new Map(posts.map((p) => [p.id, 0]));
  for (const p of posts) for (const t of p.links) backlinks.set(t, (backlinks.get(t) || 0) + 1);

  // ── Relatedness score between a source S and target T (S should link T) ──────
  // Only counts when S does not already link to T.
  function score(S, T) {
    if (S.id === T.id || S.links.has(T.id)) return null;
    let s = 0;
    const reasons = [];
    if (S.category && T.category && S.category === T.category) { s += 3; reasons.push(`category:${T.category}`); }
    let shared = 0;
    for (const tag of S.tags) if (T.tags.has(tag)) shared++;
    if (shared) { s += 2 * shared; reasons.push(`${shared} shared tag${shared > 1 ? "s" : ""}`); }
    // S's body already talks about T's topic (T's title terms appear in S) → strong "should link" signal.
    let termHits = 0;
    for (const w of T.titleTerms) if (S.bodyTerms.has(w)) termHits++;
    if (termHits) { s += termHits; reasons.push(`mentions ${termHits} of target's key terms`); }
    return s >= 4 ? { score: s, reasons } : null;
  }

  // For each target, find best sources that should link to it — prioritise
  // under-linked targets since those are the ones starved of equity.
  const inboundSuggestions = new Map(); // targetId → [{source, score, reasons}]
  for (const T of posts) {
    const cands = [];
    for (const S of posts) {
      const r = score(S, T);
      if (r) cands.push({ source: S.id, sourceTitle: S.title, ...r });
    }
    cands.sort((a, b) => b.score - a.score);
    inboundSuggestions.set(T.id, cands.slice(0, MAX_SUGGESTIONS));
  }

  const withBl = posts.map((p) => ({ ...p, backlinks: backlinks.get(p.id) || 0 }));
  const orphans = withBl.filter((p) => p.backlinks === 0).sort((a, b) => a.title.localeCompare(b.title));
  const underlinked = withBl.filter((p) => p.backlinks > 0 && p.backlinks < MIN_BACKLINKS).sort((a, b) => a.backlinks - b.backlinks);
  const totalOutgoing = posts.reduce((n, p) => n + p.links.size, 0);
  const avgBl = (totalOutgoing / posts.length).toFixed(2);
  const topHubs = [...withBl].sort((a, b) => b.backlinks - a.backlinks).slice(0, 10);

  // ── Markdown report ─────────────────────────────────────────────────────────
  const L = [];
  L.push(`# Internal Link Audit\n`);
  L.push(`_Generated ${new Date().toISOString().slice(0, 10)} · ${posts.length} published posts_\n`);
  L.push(`## Summary\n`);
  L.push(`| Metric | Value |`);
  L.push(`|---|---|`);
  L.push(`| Published posts | ${posts.length} |`);
  L.push(`| Article→article links (total) | ${totalOutgoing} |`);
  L.push(`| Avg inbound links / post | ${avgBl} |`);
  L.push(`| **Orphans (0 inbound)** | **${orphans.length}** |`);
  L.push(`| Under-linked (< ${MIN_BACKLINKS} inbound) | ${underlinked.length} |`);
  L.push(``);
  L.push(`> **How to use:** each article below lists related posts that should link *to* it.`);
  L.push(`> In Obsidian, open the **source** post and add \`[[target-id]]\` in relevant body text.`);
  L.push(`> Start with orphans — they currently receive **zero** internal PageRank.\n`);

  L.push(`## Most-linked articles (your internal hubs)\n`);
  L.push(`| Inbound | Article |`);
  L.push(`|---:|---|`);
  for (const p of topHubs) L.push(`| ${p.backlinks} | ${p.title} \`${p.id}\` |`);
  L.push(``);

  function suggestBlock(list, heading) {
    L.push(`## ${heading} (${list.length})\n`);
    if (!list.length) { L.push(`_None 🎉_\n`); return; }
    for (const p of list.slice(0, TOP)) {
      const sugg = inboundSuggestions.get(p.id) || [];
      L.push(`### ${p.title}`);
      L.push(`\`${p.id}\` · ${p.backlinks} inbound · category: ${p.category || "—"}\n`);
      if (!sugg.length) {
        L.push(`_No confident related source found — consider linking from a category/index page._\n`);
      } else {
        L.push(`Add \`[[${p.id}]]\` in these related posts:\n`);
        for (const s of sugg) L.push(`- **${s.sourceTitle}** \`${s.source}\` — _${s.reasons.join(", ")}_`);
        L.push(``);
      }
    }
    if (list.length > TOP) L.push(`\n_…and ${list.length - TOP} more (raise \`--top\` to see all)._\n`);
  }

  suggestBlock(orphans, "🔴 Orphan articles — zero inbound links");
  suggestBlock(underlinked, `🟡 Under-linked articles (< ${MIN_BACKLINKS} inbound)`);

  writeFileSync(OUT_MD, L.join("\n"));
  writeFileSync(OUT_JSON, JSON.stringify({
    generated: new Date().toISOString(),
    stats: { posts: posts.length, totalOutgoing, avgBacklinks: Number(avgBl), orphans: orphans.length, underlinked: underlinked.length },
    orphans: orphans.map((p) => ({ id: p.id, title: p.title, category: p.category, suggestions: inboundSuggestions.get(p.id) })),
    underlinked: underlinked.map((p) => ({ id: p.id, title: p.title, backlinks: p.backlinks, suggestions: inboundSuggestions.get(p.id) })),
  }, null, 2));

  console.log(`✅ Internal link audit complete`);
  console.log(`   Posts: ${posts.length} · Orphans: ${orphans.length} · Under-linked(<${MIN_BACKLINKS}): ${underlinked.length} · Avg inbound: ${avgBl}`);
  console.log(`   📄 ${OUT_MD}`);
  console.log(`   📄 ${OUT_JSON}`);

  // ── GSC merge → prioritised SEO to-do (only if a GSC export is present) ──────
  if (existsSync(GSC_PATH)) {
    mergeGSC({ raw, posts, withBl, backlinks, inboundSuggestions, N: posts.length });
  } else {
    console.log(`\nℹ️  No GSC export at ${GSC_PATH} — skipped priority report.`);
    console.log(`   Export GSC → Performance → Queries (or Pages) → CSV to enable it.`);
  }
}

function mergeGSC({ raw, posts, withBl, backlinks, inboundSuggestions, N }) {
  const bodyById = new Map(raw.map((p) => [p.id, p.body || ""]));
  const modelById = new Map(withBl.map((p) => [p.id, p]));

  // Inverted index: token → Map(articleId → weight). Title tokens weight 3.
  const index = new Map();
  const add = (tok, id, w) => {
    let m = index.get(tok);
    if (!m) index.set(tok, (m = new Map()));
    m.set(id, Math.max(m.get(id) || 0, w));
  };
  for (const p of posts) {
    for (const t of new Set(searchTokens(p.title))) add(t, p.id, 3);
    for (const t of new Set(searchTokens(bodyById.get(p.id) || ""))) add(t, p.id, 1);
  }
  const idf = (tok) => Math.log(N / (index.get(tok)?.size || N));

  // Match one query to its best article. Rare/numeric tokens dominate via IDF;
  // ubiquitous non-numeric tokens (df > 40% of corpus) are ignored as noise.
  function matchQuery(q) {
    const qToks = [...new Set(searchTokens(q))];
    const scores = new Map();
    let rareHit = false;
    for (const tok of qToks) {
      const posting = index.get(tok);
      if (!posting) continue;
      const df = posting.size;
      const numeric = /\d/.test(tok);
      if (!numeric && df / N > 0.4) continue; // too common to disambiguate
      if (numeric || df <= 4) rareHit = true;
      const w = idf(tok);
      for (const [id, tw] of posting) scores.set(id, (scores.get(id) || 0) + w * tw);
    }
    if (!scores.size) return null;
    const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
    const [id, score] = ranked[0];
    if (score < 3) return null;
    const runnerUp = ranked[1]?.[1] || 0;
    const confidence = rareHit && score >= runnerUp * 1.3 ? "high"
      : score >= 6 && score >= runnerUp * 1.15 ? "medium" : "low";
    return { id, score, confidence };
  }

  // Aggregate GSC rows onto articles.
  const gsc = loadGSC(GSC_PATH);
  const stats = new Map(); // id → { impressions, clicks, bestPos, queries: [] }
  let matched = 0, brand = 0;
  for (const row of gsc) {
    if (BRAND_RE.test(row.query)) { brand++; continue; }
    const m = matchQuery(row.query);
    if (!m || m.confidence === "low") continue;
    matched++;
    let s = stats.get(m.id);
    if (!s) stats.set(m.id, (s = { impressions: 0, clicks: 0, bestPos: Infinity, queries: [] }));
    s.impressions += row.impressions;
    s.clicks += row.clicks;
    s.bestPos = Math.min(s.bestPos, row.position || Infinity);
    s.queries.push({ query: row.query, impressions: row.impressions, clicks: row.clicks, position: row.position, confidence: m.confidence });
  }

  // Opportunity = impressions × position-band × orphan-bonus. Already-ranking
  // orphans are the sweet spot: real demand, page-1-ish, zero internal support.
  const posBand = (p) => (p < 11 ? 1 : p < 21 ? 0.6 : p < 41 ? 0.3 : 0.12);
  const rows = [...stats.entries()].map(([id, s]) => {
    const bl = backlinks.get(id) || 0;
    const orphanMult = bl === 0 ? 1.6 : bl < MIN_BACKLINKS ? 1.25 : 1;
    const opportunity = s.impressions * posBand(s.bestPos) * orphanMult;
    return { id, ...s, backlinks: bl, opportunity };
  }).sort((a, b) => b.opportunity - a.opportunity);

  // ── Priority report ─────────────────────────────────────────────────────────
  const L = [];
  L.push(`# SEO Priority — GSC × Internal Links\n`);
  L.push(`_Generated ${new Date().toISOString().slice(0, 10)} · ${gsc.length} GSC queries (${brand} brand skipped) · ${matched} matched to articles_\n`);
  L.push(`Opportunity = impressions × position-band × orphan-bonus. Fix top-down: real search demand + already ranking + no internal links = fastest gains.\n`);

  L.push(`## 🎯 Do these first\n`);
  L.push(`| # | Opp | Article | Inbound | Best pos | Impr | Top query |`);
  L.push(`|--:|--:|---|--:|--:|--:|---|`);
  rows.slice(0, 30).forEach((r, i) => {
    const m = modelById.get(r.id);
    const top = [...r.queries].sort((a, b) => b.impressions - a.impressions)[0];
    const flag = r.backlinks === 0 ? "🔴0" : r.backlinks < MIN_BACKLINKS ? `🟡${r.backlinks}` : r.backlinks;
    L.push(`| ${i + 1} | ${Math.round(r.opportunity)} | ${(m?.title || r.id).slice(0, 60)} | ${flag} | ${r.bestPos.toFixed(1)} | ${r.impressions} | ${top.query.slice(0, 40)} |`);
  });
  L.push(``);

  L.push(`## Details — top ${Math.min(rows.length, 40)} opportunities\n`);
  for (const r of rows.slice(0, 40)) {
    const m = modelById.get(r.id);
    L.push(`### ${m?.title || r.id}`);
    L.push(`\`${r.id}\` · **${r.backlinks} inbound** · best pos ${r.bestPos.toFixed(1)} · ${r.impressions} impr · ${r.clicks} clicks · category: ${m?.category || "—"}\n`);
    L.push(`**Ranking for:**`);
    for (const q of [...r.queries].sort((a, b) => a.position - b.position).slice(0, 8)) {
      L.push(`- \`${q.position.toFixed(1)}\` · ${q.impressions} impr — ${q.query}${q.confidence === "medium" ? " _(fuzzy match — verify)_" : ""}`);
    }
    if (r.backlinks < MIN_BACKLINKS) {
      const sugg = inboundSuggestions.get(r.id) || [];
      if (sugg.length) {
        L.push(`\n**Add \`[[${r.id}]]\` in:**`);
        for (const s of sugg) L.push(`- ${s.sourceTitle} \`${s.source}\` — _${s.reasons.join(", ")}_`);
      }
    } else {
      L.push(`\n_Already internally linked — if CTR is low, rewrite its \`title\`/\`description\` to match the query above._`);
    }
    L.push(``);
  }

  writeFileSync(OUT_PRIORITY, L.join("\n"));
  writeFileSync(OUT_PRIORITY_JSON, JSON.stringify({ generated: new Date().toISOString(), matched, brandSkipped: brand, rows }, null, 2));

  const orphanOpps = rows.filter((r) => r.backlinks === 0).length;
  console.log(`\n🎯 SEO priority report`);
  console.log(`   GSC queries: ${gsc.length} (${brand} brand skipped) · matched to ${stats.size} articles`);
  console.log(`   Of those, ${orphanOpps} are ORPHANS already ranking — highest ROI.`);
  console.log(`   📄 ${OUT_PRIORITY}`);
  console.log(`   📄 ${OUT_PRIORITY_JSON}`);
}

main();
