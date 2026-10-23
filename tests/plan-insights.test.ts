import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decalRectAreaM2,
  estimateCoverage,
  estimatePrice,
  fullChartAreaM2,
  sideChartAreaM2,
  COMPLIANCE_THRESHOLD_RATIO,
  FILM_WASTE_FACTOR,
  FULL_WRAP_PRICE_HIGH_YUAN,
  FULL_WRAP_PRICE_LOW_YUAN,
  LABOR_COST_SHARE,
  MATERIAL_COST_SHARE,
} from '../lib/plan-insights.ts';

// Same body as wrap-layout tests / motion_metadata wrap chart (metres).
const body = { xMin: -2.85, length: 5.8, width: 2.22, height: 3.05 };
const bothSides = (scale: number) => [
  { center: 4, height: 1.28, scale },
  { center: 12, height: 1.28, scale },
];
const close = (actual: number, expected: number, tolerance = 1e-4) =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${actual} should be within ${tolerance} of ${expected}`,
  );

void test('chart areas derive from the wrap-layout perimeter chart', () => {
  close(sideChartAreaM2(body), 5.8 * 3.05);
  close(fullChartAreaM2(body), 16.04 * 3.05);
  close(fullChartAreaM2(body), 48.922);
});

void test('coverage at default scale uses the editor decal rectangle (3.5m base width)', () => {
  const coverage = estimateCoverage({
    placements: bothSides(1),
    aspect: 3,
    body,
  });
  // Per side: (3.5 * 1)^2 / 3 = 4.0833㎡; two sides over 2 * 5.8 * 3.05㎡.
  close(coverage.decalAreaM2, (2 * 12.25) / 3);
  close(coverage.totalSideAreaM2, 35.38);
  close(coverage.ratio, 0.23083);
  assert.equal(coverage.overThreshold, false);
  close(coverage.filmAreaM2, coverage.decalAreaM2 * FILM_WASTE_FACTOR);
  close(coverage.filmAreaM2, 10.20833);
});

void test('coverage follows scale quadratically and crosses the 30% compliance line', () => {
  const coverage = estimateCoverage({
    placements: bothSides(1.2),
    aspect: 3,
    body,
  });
  close(coverage.decalAreaM2, 11.76);
  close(coverage.ratio, 0.3324);
  assert.ok(coverage.ratio > COMPLIANCE_THRESHOLD_RATIO);
  assert.equal(coverage.overThreshold, true);
  const single = estimateCoverage({
    placements: bothSides(1).slice(0, 1),
    aspect: 3,
    body,
  });
  close(single.ratio, 0.11541);
  assert.equal(single.overThreshold, false);
});

void test('price folds the full-wrap anchor (3000-8000 yuan) by chart-area ratio', () => {
  const coverage = estimateCoverage({
    placements: bothSides(1),
    aspect: 3,
    body,
  });
  const price = estimatePrice({ decalAreaM2: coverage.decalAreaM2, body });
  close(price.fullAreaM2, 48.922);
  close(price.ratioToFullWrap, 0.16693);
  close(
    price.priceLowYuan,
    FULL_WRAP_PRICE_LOW_YUAN * price.ratioToFullWrap,
    1e-6,
  );
  close(price.priceLowYuan, 500.8, 0.5);
  close(price.priceHighYuan, 1335.46, 0.5);
  assert.equal(FULL_WRAP_PRICE_HIGH_YUAN, 8000);
  close(price.filmAreaM2, 10.20833);
});

void test('material/labor split is an explicit estimate share that sums to the total', () => {
  assert.ok(Math.abs(MATERIAL_COST_SHARE + LABOR_COST_SHARE - 1) < 1e-9);
  const price = estimatePrice({ decalAreaM2: 8, body });
  close(price.materialLowYuan + price.laborLowYuan, price.priceLowYuan, 1e-6);
  close(
    price.materialHighYuan + price.laborHighYuan,
    price.priceHighYuan,
    1e-6,
  );
  close(price.materialLowYuan, price.priceLowYuan * MATERIAL_COST_SHARE, 1e-6);
});

void test('empty or invalid input estimates zero instead of NaN', () => {
  const empty = estimateCoverage({ placements: [], aspect: 3, body });
  assert.equal(empty.decalAreaM2, 0);
  assert.equal(empty.ratio, 0);
  assert.equal(empty.overThreshold, false);
  assert.equal(decalRectAreaM2(NaN, 3), 0);
  assert.equal(decalRectAreaM2(-1, 3), 0);
  // Invalid aspect falls back to the editor default of 3.
  close(decalRectAreaM2(1, NaN), 12.25 / 3);
  const price = estimatePrice({ decalAreaM2: NaN, body });
  assert.equal(price.priceLowYuan, 0);
  assert.equal(price.filmAreaM2, 0);
});
