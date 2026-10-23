import test from 'node:test';
import assert from 'node:assert/strict';
import { STRINGS, SLOT_STATUSES, t, type StringKey } from '../lib/i18n.ts';
import { SAMPLES, stickerName } from '../lib/stickers.ts';
import { directionName } from '../lib/generation.ts';

void test('en and zh dictionaries expose exactly the same key set', () => {
  const enKeys = Object.keys(STRINGS.en).sort();
  const zhKeys = Object.keys(STRINGS.zh).sort();
  assert.deepEqual(zhKeys, enKeys);
  assert.ok(enKeys.length >= 130, `dictionary too small: ${enKeys.length}`);
  for (const key of enKeys) {
    assert.ok(STRINGS.en[key as StringKey].length > 0, `empty en: ${key}`);
    assert.ok(STRINGS.zh[key as StringKey].length > 0, `empty zh: ${key}`);
  }
});

void test('every slot status enum maps to a label in both languages', () => {
  assert.deepEqual([...SLOT_STATUSES].sort(), [
    'done',
    'drawing',
    'failed',
    'waiting',
  ]);
  for (const status of SLOT_STATUSES) {
    const key = `slot.${status}` as StringKey;
    assert.ok(key in STRINGS.en, `missing en ${key}`);
    assert.ok(key in STRINGS.zh, `missing zh ${key}`);
  }
  // The pre-i18n Chinese slot labels still exist in the zh dictionary.
  assert.equal(t('zh', 'slot.waiting'), '等待中');
  assert.equal(t('zh', 'slot.drawing'), '正在绘制');
  assert.equal(t('zh', 'slot.done'), '已完成');
  assert.equal(t('zh', 'slot.failed'), '未完成');
  assert.equal(t('en', 'slot.done'), 'Done');
});

void test('template parameters substitute whole sentences in both languages', () => {
  assert.equal(
    t('en', 'page.waitProgress', { done: 2, elapsed: 9 }),
    '2 / 4 designs ready · 9s',
  );
  assert.equal(
    t('zh', 'page.waitProgress', { done: 2, elapsed: 9 }),
    '2 / 4 张图纸已就绪 · 9s',
  );
  assert.equal(
    t('zh', 'toast.partOpened', { name: '侧门' }),
    '侧门打开',
  );
});

void test('legacy Chinese copy survives in the zh dictionary', () => {
  assert.equal(t('zh', 'stream.endedEarly'), '连接提前结束，已收到的方案仍可使用。');
  assert.equal(
    t('zh', 'scene.stickerImageFailed'),
    '贴纸图片未能加载，请重试或选择其他方案。',
  );
  assert.equal(t('zh', 'page.generate'), '生成 4 个方案');
  assert.notEqual(t('en', 'page.generate'), t('zh', 'page.generate'));
});

void test('samples and direction names resolve per language', () => {
  for (const sample of SAMPLES) {
    assert.ok(sample.nameZh, `sample ${sample.id} missing Chinese name`);
    assert.equal(stickerName(sample, 'zh'), sample.nameZh);
    assert.equal(stickerName(sample, 'en'), sample.name);
    assert.notEqual(stickerName(sample, 'en'), stickerName(sample, 'zh'));
  }
  assert.equal(directionName(0, 'en'), 'Flowing Lines');
  assert.equal(directionName(0, 'zh'), '流动线条');
  assert.equal(directionName(3, 'zh'), '自由轮廓');
});
