/**
 * Announcement registry gate (Slice 5, 入库制) — pure logic.
 *
 * Rule (scheme doc section 5, confirmed 2026-10-24): the panel only
 * opens registered models. Unregistered models show greyed out as
 * pending and cannot be selected; prototype envelopes must no longer
 * let an unregistered model through. Prototype placeholders survive
 * only as the demo view's default state, labelled as non-announcement.
 *
 * The shipped rows live in announcement-db.json (imported by
 * announcement-db-data.ts, which binds them to the helpers below).
 * This module stays JSON-free so it runs under node --test, which
 * rejects bare JSON imports; tests read the JSON file with fs and
 * run the same helpers over it.
 *
 * HOW TO OPEN A NEW MODEL (no panel code change):
 * 1. Add one entry to announcement-db.json with status "complete",
 *    every REQUIRED_REGISTRY_FIELDS present as a number, plus
 *    announcement_model, announcement_batch and source.
 * 2. Add the model to MODEL_CATALOG below with its kind. Catalog
 *    entries carry names only, never figures.
 * The dropdown enables the model automatically. Partial rows stay
 * visible but disabled. A new variant (other wheelbase / roof) is a
 * new entry with its own id; never stretch one row across variants.
 */
import {
  KIND_DEFAULTS,
  type BodyConfig,
  type VehicleKind,
} from './parametric-body.ts';

export interface RegistryVerified {
  length_mm?: number;
  width_mm?: number;
  height_mm?: number;
  wheelbase_mm?: number;
  front_overhang_mm?: number;
  rear_overhang_mm?: number;
  gross_mass_kg?: number;
}

export interface RegistryEntry {
  id: string;
  name: string;
  announcement_model: string;
  announcement_batch: number;
  chassis_model: string;
  status: 'complete' | 'partial';
  verified: RegistryVerified;
  source: string;
  source_url: string;
  notes: string;
}

/** Every field a row needs before its model becomes selectable. */
export const REQUIRED_REGISTRY_FIELDS: (keyof Required<RegistryVerified>)[] =
  [
    'length_mm',
    'width_mm',
    'height_mm',
    'wheelbase_mm',
    'front_overhang_mm',
    'rear_overhang_mm',
    'gross_mass_kg',
  ];

/** A row is selectable only when every required field is verified. */
export function isEntryComplete(entry: RegistryEntry): boolean {
  return REQUIRED_REGISTRY_FIELDS.every(
    (field) =>
      typeof entry.verified[field] === 'number' &&
      Number.isFinite(entry.verified[field]),
  );
}

export interface CatalogModel {
  id: string;
  name: string;
  kind: VehicleKind;
}

/**
 * Model catalog (scheme doc section 5 preset library). Names and
 * kinds only — this table carries no dimensions; dimensions live
 * exclusively in announcement-db.json.
 */
export const MODEL_CATALOG: readonly CatalogModel[] = [
  { id: 'v80', name: '大通 V80', kind: 'motorhome-b' },
  { id: 'v90', name: '大通 V90', kind: 'motorhome-b' },
  { id: 'iveco-ousheng', name: '依维柯欧胜', kind: 'motorhome-b' },
  { id: 'ford-transit', name: '福特全顺', kind: 'motorhome-b' },
  { id: 'jmc-fushun', name: '江铃福顺', kind: 'motorhome-b' },
  { id: 'jmc-teshun', name: '江铃特顺', kind: 'motorhome-b' },
  { id: 'foton-tuyano', name: '福田图雅诺', kind: 'motorhome-b' },
  { id: 'dongfeng-yufeng', name: '东风御风', kind: 'motorhome-b' },
  { id: 'jinbei-haise', name: '金杯海狮', kind: 'motorhome-b' },
  { id: 'qingling-isuzu', name: '庆铃五十铃', kind: 'motorhome-c' },
  { id: 'jmc-kaiyun', name: '江铃凯运', kind: 'motorhome-c' },
  { id: 'foton-aoling', name: '福田奥铃', kind: 'motorhome-c' },
  { id: 'yuejin', name: '跃进', kind: 'motorhome-c' },
  { id: 'poer', name: '长城炮', kind: 'motorhome-t' },
  { id: 'jmc-yuhu', name: '江铃域虎', kind: 'motorhome-t' },
  { id: 'isuzu-dmax', name: '江西五十铃 D-MAX', kind: 'motorhome-t' },
  { id: 'navara', name: '郑州日产纳瓦拉', kind: 'motorhome-t' },
  { id: 'ranger', name: '福特 Ranger', kind: 'motorhome-t' },
  { id: 'maxus-t60', name: '大通 T60', kind: 'motorhome-t' },
  { id: 'maxus-t70', name: '大通 T70', kind: 'motorhome-t' },
  { id: 'yutong', name: '宇通', kind: 'motorhome-a' },
  { id: 'zhongtong', name: '中通', kind: 'motorhome-a' },
  { id: 'kinglong', name: '金龙', kind: 'motorhome-a' },
  { id: 'coaster', name: '丰田考斯特', kind: 'motorhome-a' },
  { id: 'wuling', name: '五菱', kind: 'micro-c' },
  { id: 'changan', name: '长安', kind: 'micro-c' },
  { id: 'tank300', name: '坦克 300', kind: 'offroad' },
  { id: 'tank500', name: '坦克 500', kind: 'offroad' },
  { id: 'bj40', name: 'BJ40', kind: 'offroad' },
  { id: 'wrangler', name: '牧马人', kind: 'offroad' },
  // MIIT v4 complete variant rows (2026-10-25): one entry per height
  // option of the 8 single-length bus announcements. Height is the only
  // multi field for these models, so each row is a genuine variant, not
  // a pairing invented across fields. IDs match announcement-db.json.
  { id: 'sh6601h4db-s-h2525', name: 'SH6601H4DB-S（高2525mm变体）', kind: 'motorhome-b' },
  { id: 'sh6601h4db-s-h2740', name: 'SH6601H4DB-S（高2740mm变体）', kind: 'motorhome-b' },
  { id: 'sh6601h4db-s-h2480', name: 'SH6601H4DB-S（高2480mm变体）', kind: 'motorhome-b' },
  { id: 'sh6601h4db-s-h2700', name: 'SH6601H4DB-S（高2700mm变体）', kind: 'motorhome-b' },
  { id: 'sh6591h4db-h2735', name: 'SH6591H4DB（高2735mm变体）', kind: 'motorhome-b' },
  { id: 'sh6591h4db-h2520', name: 'SH6591H4DB（高2520mm变体）', kind: 'motorhome-b' },
  { id: 'sh6592h4db-h2740', name: 'SH6592H4DB（高2740mm变体）', kind: 'motorhome-b' },
  { id: 'sh6592h4db-h2525', name: 'SH6592H4DB（高2525mm变体）', kind: 'motorhome-b' },
  { id: 'sh6601h4db-ns-h2525', name: 'SH6601H4DB-NS（高2525mm变体）', kind: 'motorhome-b' },
  { id: 'sh6601h4db-ns-h2740', name: 'SH6601H4DB-NS（高2740mm变体）', kind: 'motorhome-b' },
  { id: 'sh6601h4db-ns-h2700', name: 'SH6601H4DB-NS（高2700mm变体）', kind: 'motorhome-b' },
  { id: 'sh6601h4db-ns-h2480', name: 'SH6601H4DB-NS（高2480mm变体）', kind: 'motorhome-b' },
  { id: 'sh6591h4db-ns-h2525', name: 'SH6591H4DB-NS（高2525mm变体）', kind: 'motorhome-b' },
  { id: 'sh6591h4db-ns-h2740', name: 'SH6591H4DB-NS（高2740mm变体）', kind: 'motorhome-b' },
  { id: 'sh6591h4db-ns-h2480', name: 'SH6591H4DB-NS（高2480mm变体）', kind: 'motorhome-b' },
  { id: 'sh6591h4db-ns-h2700', name: 'SH6591H4DB-NS（高2700mm变体）', kind: 'motorhome-b' },
  { id: 'sh6591h4db-s-h2525', name: 'SH6591H4DB-S（高2525mm变体）', kind: 'motorhome-b' },
  { id: 'sh6591h4db-s-h2740', name: 'SH6591H4DB-S（高2740mm变体）', kind: 'motorhome-b' },
  { id: 'sh6591h4db-s-h2480', name: 'SH6591H4DB-S（高2480mm变体）', kind: 'motorhome-b' },
  { id: 'sh6591h4db-s-h2700', name: 'SH6591H4DB-S（高2700mm变体）', kind: 'motorhome-b' },
  { id: 'sh6601a4db-h2372', name: 'SH6601A4DB（高2372mm变体）', kind: 'motorhome-b' },
  { id: 'sh6601a4db-h2577', name: 'SH6601A4DB（高2577mm变体）', kind: 'motorhome-b' },
  { id: 'sh6601a4db-n-h2372', name: 'SH6601A4DB-N（高2372mm变体）', kind: 'motorhome-b' },
  { id: 'sh6601a4db-n-h2577', name: 'SH6601A4DB-N（高2577mm变体）', kind: 'motorhome-b' },
];

export function entryForModel(
  entries: readonly RegistryEntry[],
  modelId: string,
): RegistryEntry | undefined {
  return entries.find((entry) => entry.id === modelId);
}

export function isModelSelectableIn(
  entries: readonly RegistryEntry[],
  modelId: string,
): boolean {
  const entry = entryForModel(entries, modelId);
  return entry !== undefined && isEntryComplete(entry);
}

export function registryStatusOf(
  entries: readonly RegistryEntry[],
): { complete: number; partial: number } {
  let complete = 0;
  let partial = 0;
  for (const entry of entries) {
    if (isEntryComplete(entry)) complete += 1;
    else partial += 1;
  }
  return { complete, partial };
}

/**
 * Build a config for a registry row, or null when the row is not
 * complete. Core dimensions and total mass come from the row; roof
 * and wheelbase class fall back to the kind's defaults (schematic
 * defaults, not announcement claims — a row is one variant, other
 * variants need their own rows). Attachments start empty.
 */
export function configForEntry(
  model: CatalogModel,
  entry: RegistryEntry,
): BodyConfig | null {
  if (!isEntryComplete(entry)) return null;
  const verified = entry.verified;
  const base = KIND_DEFAULTS[model.kind];
  return {
    ...base,
    vehicleKind: model.kind,
    chassis: entry.announcement_model,
    lengthMm: verified.length_mm as number,
    widthMm: verified.width_mm as number,
    heightMm: verified.height_mm as number,
    wheelbaseMm: verified.wheelbase_mm as number,
    estimatedMassKg: verified.gross_mass_kg as number,
    slideOuts: [],
    accessories: [],
    roofFixtures: [],
  };
}

export function configForModelIn(
  entries: readonly RegistryEntry[],
  modelId: string,
): BodyConfig | null {
  const model = MODEL_CATALOG.find((candidate) => candidate.id === modelId);
  if (model === undefined) return null;
  const entry = entryForModel(entries, modelId);
  if (entry === undefined) return null;
  return configForEntry(model, entry);
}
