import test from 'node:test';
import assert from 'node:assert/strict';
import { readStickerBatch } from '../lib/sticker-stream.ts';
import { waitingPose } from '../lib/stage-motion.ts';
import { SceneEngine } from '../components/studio/scene-engine.ts';
import * as THREE from 'three';
import type { Sticker } from '../lib/stickers.ts';
const variant = (index: number) => ({
  type: 'variant',
  index,
  sticker: {
    id: `design-${index}`,
    name: `Design ${index}`,
    subtitle: 'TEST',
    image: `/test-${index}.png`,
    color: '#335544',
    source: 'generated',
  },
});
const stream = (text: string) =>
  new ReadableStream<Uint8Array>({
    start(c) {
      const b = new TextEncoder().encode(text);
      c.enqueue(b.slice(0, 39));
      c.enqueue(b.slice(39, 113));
      c.enqueue(b.slice(113));
      c.close();
    },
  });
void test('batch completion orders concurrent results before the default design is chosen', async () => {
  const batch = await readStickerBatch(
    stream(
      [variant(1), variant(0), variant(3), variant(2), { type: 'complete' }]
        .map((event) => JSON.stringify(event))
        .join('\n'),
    ),
    () => {},
  );
  assert.deepEqual(
    batch.map((s) => s.id),
    ['design-0', 'design-1', 'design-2', 'design-3'],
  );
  assert.equal(batch[0].id, 'design-0');
});
void test('a failed first slot selects the first successful numbered design', async () => {
  const batch = await readStickerBatch(
    stream(
      [
        variant(3),
        { type: 'error', index: 0, message: 'failed' },
        variant(1),
        { type: 'complete' },
      ]
        .map((event) => JSON.stringify(event))
        .join('\n'),
    ),
    () => {},
  );
  assert.equal(batch[0].id, 'design-1');
});
void test('an interrupted stream retains received options without reporting a completed batch', async () => {
  let count = 0;
  await assert.rejects(
    readStickerBatch(stream(JSON.stringify(variant(0))), (_event, items) => {
      count = items.length;
    }),
    // Default UI language is now English (zh text lives in the dictionary);
    // this asserts the new English default of stream.endedEarly.
    /connection ended early/i,
  );
  assert.equal(count, 1);
});
void test('cancelled generation never returns an automatic application candidate', async () => {
  const abort = new AbortController();
  abort.abort();
  await assert.rejects(
    readStickerBatch(
      stream(
        [variant(0), { type: 'complete' }]
          .map((event) => JSON.stringify(event))
          .join('\n'),
      ),
      () => {},
      abort.signal,
    ),
    { name: 'AbortError' },
  );
});
void test('waiting motion is staggered, bounded and returns exactly to the user pose', () => {
  assert.ok(waitingPose('rooflight', 1.2, 0, 1) > 0.2);
  assert.equal(waitingPose('window-2', 1.2, 0, 1), 0);
  for (let seconds = 0; seconds < 30; seconds += 0.1)
    for (const id of ['rooflight', 'entry-door', 'window-2'])
      for (const base of [0, 0.5, 1]) {
        const pose = waitingPose(id, seconds, base, 1);
        assert.ok(pose >= 0 && pose <= 1);
        assert.equal(waitingPose(id, seconds, base, 0), base);
      }
  assert.equal(waitingPose('awning', 3, 0, 1), 0);
});
void test('a decoded sticker applies immediately without moving the camera or changing hinges', async (t) => {
  const previousImage = Object.getOwnPropertyDescriptor(globalThis, 'Image');
  const decodes: { resolve: () => void; reject: (reason: Error) => void }[] =
    [];
  class TestImage {
    src = '';
    decoding = '';
    decode() {
      return new Promise<void>((resolve, reject) =>
        decodes.push({ resolve, reject }),
      );
    }
  }
  Object.defineProperty(globalThis, 'Image', {
    value: TestImage,
    configurable: true,
  });
  t.after(() => {
    if (previousImage)
      Object.defineProperty(globalThis, 'Image', previousImage);
    else Reflect.deleteProperty(globalThis, 'Image');
  });
  // Exercise the production image/commit flow without allocating a WebGL renderer.
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(-7, 3, 5);
  const target = new THREE.Vector3(0.2, 1.4, 0.1);
  const committed: (Sticker | null)[] = [];
  const engine = Object.assign(Object.create(SceneEngine.prototype), {
    imageVersion: 0,
    disposed: false,
    chosen: null,
    stickerId: null,
    camera,
    controls: { target },
    host: { clientWidth: 1200, clientHeight: 800 },
    values: new Map([
      ['entry-door', 1],
      ['rooflight', 0.5],
    ]),
    drafting: [],
    drawingLines: [],
    drawingGrid: { visible: true },
    environment: 'studio',
    hooks: { onCommit: (sticker: Sticker | null) => committed.push(sticker) },
  }) as SceneEngine;
  const sticker = variant(0).sticker as Sticker;
  const first = engine.applySticker(sticker);
  assert.deepEqual(
    committed,
    [],
    'keep the previous image until the replacement decodes',
  );
  decodes[0].resolve();
  assert.equal(
    await Promise.race([
      first.then(() => 'applied'),
      new Promise<string>((resolve) =>
        setTimeout(() => resolve('still animating'), 25),
      ),
    ]),
    'applied',
  );
  assert.equal(committed[0], sticker);
  assert.deepEqual(camera.position.toArray(), [-7, 3, 5]);
  assert.deepEqual(target.toArray(), [0.2, 1.4, 0.1]);
  assert.deepEqual(Object.fromEntries(engine.values), {
    'entry-door': 1,
    rooflight: 0.5,
  });

  const failed = engine.applySticker(variant(1).sticker as Sticker);
  decodes[1].reject(new Error('unavailable'));
  // The engine now reports failures as language-agnostic codes; the React
  // layer localizes them, so assert the code instead of any one language.
  await assert.rejects(failed, /sticker-image-failed/);
  assert.equal(
    committed.length,
    1,
    'a failed image must not clear the displayed sticker',
  );

  const old = engine.applySticker(variant(2).sticker as Sticker);
  const oldAborted = assert.rejects(old, { name: 'AbortError' });
  await engine.applySticker(null);
  decodes[2].resolve();
  await oldAborted;
  assert.deepEqual(
    committed,
    [sticker, null],
    'late images cannot restore a cleared sticker',
  );
});
void test('waiting motion stays continuous while a manual hinge crosses halfway', () => {
  const before = waitingPose('rooflight', 1.2, 0.499, 1);
  const after = waitingPose('rooflight', 1.2, 0.501, 1);
  assert.ok(after > before);
  assert.ok(after - before < 0.003);
});
