import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanContent, highlight, excerptAround, escapeHtml } from './search.js';

// ── cleanContent ──────────────────────────────────────────────────────────

test('cleanContent - removes Obsidian image embeds', () => {
  assert.strictEqual(
    cleanContent('Before ![[image.png|caption|500]] after').trim(),
    'Before  after'.trim()
  );
});

test('cleanContent - unwraps wikilinks with alias', () => {
  assert.strictEqual(cleanContent('See [[My Page|this page]] here'), 'See this page here');
});

test('cleanContent - unwraps plain wikilinks', () => {
  assert.strictEqual(cleanContent('See [[My Page]] here'), 'See My Page here');
});

test('cleanContent - removes heading markers', () => {
  assert.strictEqual(cleanContent('## Section Title'), 'Section Title');
});

test('cleanContent - strips bold markers', () => {
  assert.strictEqual(cleanContent('This is **bold** text'), 'This is bold text');
});

test('cleanContent - strips code fences', () => {
  assert.strictEqual(
    cleanContent('Intro\n```\ncode here\n```\nOutro').replace(/\n+/g, '\n').trim(),
    'Intro\nOutro'
  );
});

test('cleanContent - strips Obsidian callouts', () => {
  const result = cleanContent('> [!NOTE] This is a callout\nNormal text');
  assert.ok(!result.includes('[!NOTE]'), 'Should remove callout marker');
});

// ── escapeHtml ────────────────────────────────────────────────────────────

test('escapeHtml - escapes all four HTML entities', () => {
  assert.strictEqual(escapeHtml('<b class="x">&amp;</b>'), '&lt;b class=&quot;x&quot;&gt;&amp;amp;&lt;/b&gt;');
});

// ── highlight ─────────────────────────────────────────────────────────────

test('highlight - wraps single token in mark', () => {
  const result = highlight('Hello World', 'world');
  assert.ok(result.includes('<mark'), 'Expected <mark> tag');
  assert.ok(result.includes('World'), 'Expected original casing');
});

test('highlight - wraps multiple tokens separately', () => {
  const result = highlight('The quick brown fox', 'quick fox');
  const markCount = (result.match(/<mark/g) || []).length;
  assert.strictEqual(markCount, 2);
});

test('highlight - escapes HTML before marking (XSS safe)', () => {
  const result = highlight('<script>alert(1)</script>', 'script');
  assert.ok(!result.includes('<script>'), 'Must not contain raw <script>');
  assert.ok(result.includes('&lt;'), 'Must contain escaped <');
});

test('highlight - strips # prefix for tag searches', () => {
  const result = highlight('typescript tutorial', '#typescript');
  assert.ok(result.includes('<mark'), 'Should highlight token without #');
});

test('highlight - returns escaped text unchanged when no query', () => {
  assert.strictEqual(highlight('Hello & World', ''), 'Hello &amp; World');
});

// ── excerptAround ─────────────────────────────────────────────────────────

test('excerptAround - returns window containing query token', () => {
  const filler = 'word '.repeat(100);
  const content = filler + 'uniquetoken ' + filler;
  const { text } = excerptAround(content, 'uniquetoken', 80);
  assert.ok(text.includes('uniquetoken'));
});

test('excerptAround - falls back to start of content on no match', () => {
  const { text } = excerptAround('Hello world this is content', 'zzznomatch', 80);
  assert.ok(text.startsWith('Hello'));
});

test('excerptAround - truncated is true when content exceeds window', () => {
  const { truncated } = excerptAround('word '.repeat(500), 'word', 80);
  assert.strictEqual(truncated, true);
});

test('excerptAround - truncated is false for short content', () => {
  const { truncated } = excerptAround('Short text', 'text', 80);
  assert.strictEqual(truncated, false);
});

test('excerptAround - picks highest-density window for multi-token query', () => {
  const filler = 'irrelevant '.repeat(60);
  const dense = 'alpha beta gamma ';
  const content = filler + dense + filler;
  const { text } = excerptAround(content, 'alpha beta gamma', 80);
  assert.ok(text.includes('alpha') || text.includes('beta') || text.includes('gamma'));
});
