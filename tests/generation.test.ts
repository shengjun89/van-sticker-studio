import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validatePrompt,
  imageRequest,
  generateResponse,
} from '../lib/generation.ts';
void test('empty and oversized prompts fail before generation', () => {
  assert.throws(() => validatePrompt('  '));
  assert.throws(() => validatePrompt('a'.repeat(1001)));
  assert.equal(validatePrompt(' coast '), 'coast');
});
void test('four distinct briefs preserve the user description and transparent output', () => {
  const variants = [0, 1, 2, 3].map((i) => imageRequest('海岸 COAST CLUB', i));
  assert.equal(new Set(variants.map((v) => v.prompt)).size, 4);
  for (const v of variants) {
    assert.match(v.prompt, /海岸 COAST CLUB/);
    assert.equal(v.background, 'transparent');
    assert.equal(v.n, 1);
  }
  assert.throws(() => imageRequest('x', 4));
});
void test('missing server key is explicit, never a fake generated result', async () => {
  const r = await generateResponse(
    new Request('https://studio.test/api/generate', {
      method: 'POST',
      body: JSON.stringify({ prompt: 'mountains' }),
    }),
    {},
  );
  assert.equal(r.status, 503);
  assert.equal(
    ((await r.json()) as { code: string }).code,
    'AI_NOT_CONFIGURED',
  );
});
void test('reject foreign origin', async () => {
  const r = await generateResponse(
    new Request('https://studio.test/api/generate', {
      method: 'POST',
      headers: { origin: 'https://elsewhere.test' },
      body: '{}',
    }),
    {},
  );
  assert.equal(r.status, 403);
});
void test('streams four independently identified images from the upstream and never returns credentials', async () => {
  let requests = 0;
  const fetcher = async () => {
    requests++;
    return Response.json({ data: [{ b64_json: 'dGVzdA==' }] });
  };
  const r = await generateResponse(
    new Request('https://studio.test/api/generate', {
      method: 'POST',
      body: JSON.stringify({ prompt: 'coast' }),
    }),
    { OPENAI_API_KEY: 'secret-test' },
    fetcher as typeof fetch,
  );
  const raw = await r.text();
  const events = raw
    .trim()
    .split('\n')
    .map((s) => JSON.parse(s));
  assert.equal(requests, 4);
  assert.equal(events.filter((x) => x.type === 'variant').length, 4);
  assert.equal(events.at(-1).successes, 4);
  assert.ok(!raw.includes('secret-test'));
});
void test('upstream errors retain partial successes and return useful per-slot status', async () => {
  let i = 0;
  const f = async () =>
    ++i === 2
      ? new Response('{}', { status: 429 })
      : Response.json({ data: [{ b64_json: 'dGVzdA==' }] });
  const r = await generateResponse(
    new Request('https://studio.test/api/generate', {
      method: 'POST',
      body: JSON.stringify({ prompt: 'coast' }),
    }),
    { OPENAI_API_KEY: 'test' },
    f as typeof fetch,
  );
  const e = (await r.text())
    .trim()
    .split('\n')
    .map((s) => JSON.parse(s));
  assert.equal(e.at(-1).successes, 3);
  assert.equal(e.filter((x) => x.type === 'error').length, 1);
});
