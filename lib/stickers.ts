import type { Lang } from './i18n.ts';

export interface Sticker {
  id: string;
  /** Canonical (English) display name; also the name returned by the server. */
  name: string;
  /** Chinese display name for built-in samples only (server designs carry a single lang-matched name). */
  nameZh?: string;
  subtitle: string;
  image: string;
  color: string;
  source: 'sample' | 'generated';
}

/** Display name in the active language: samples carry both, generated designs arrive already localized. */
export function stickerName(sticker: Sticker, lang: Lang): string {
  return lang === 'zh' && sticker.nameZh ? sticker.nameZh : sticker.name;
}

export const SAMPLES: Sticker[] = [
  {
    id: 'coast-club',
    name: 'Coast Club',
    nameZh: '海岸俱乐部',
    subtitle: 'COAST CLUB',
    image: '/stickers/coast-club.png',
    color: '#173cbb',
    source: 'sample',
  },
  {
    id: 'alpine-club',
    name: 'Alpine Wander',
    nameZh: '山野漫游',
    subtitle: 'ALPINE CLUB',
    image: '/stickers/alpine-club.png',
    color: '#315a42',
    source: 'sample',
  },
  {
    id: 'sun-chaser',
    name: 'Sun Chaser',
    nameZh: '追逐日落',
    subtitle: 'SUN CHASER',
    image: '/stickers/sun-chaser.png',
    color: '#ce6a3a',
    source: 'sample',
  },
  {
    id: 'night-route',
    name: 'Night Route',
    nameZh: '夜行公路',
    subtitle: 'NIGHT ROUTE',
    image: '/stickers/night-route.png',
    color: '#384048',
    source: 'sample',
  },
];

export interface Inspiration {
  id: string;
  labelEn: string;
  labelZh: string;
  textEn: string;
  textZh: string;
}

export const INSPIRATIONS: Inspiration[] = [
  {
    id: 'retro-coast',
    labelEn: 'Retro Coast',
    labelZh: '复古海岸',
    textEn:
      'Retro coastal campervan decal, deep blue and light blue flowing waves, minimal and bold, lettering COAST CLUB, wide horizontal composition.',
    textZh:
      '复古海岸风格的房车贴纸，深蓝和浅蓝流线海浪，简约有力量，英文 COAST CLUB，横向构图。',
  },
  {
    id: 'alpine-wander',
    labelEn: 'Alpine Wander',
    labelZh: '山野漫游',
    textEn:
      'Minimal mountain ridgelines and contour lines, deep green with off-white, a free-spirited outdoor adventure feel, lettering OUTSIDE IS HOME, wide horizontal campervan decal.',
    textZh:
      '极简山脊和等高线，墨绿配米白，有户外探险的自由感，英文 OUTSIDE IS HOME，横向房车贴纸。',
  },
  {
    id: 'sun-chaser',
    labelEn: 'Sun Chaser',
    labelZh: '追逐日落',
    textEn:
      '1970s retro road-trip decal, terracotta orange and a golden sun disc with parallel stripes, lettering SUN CHASER, wide horizontal layout.',
    textZh:
      '70年代复古公路旅行贴纸，陶土橙、金黄的日轮和平行彩带，英文 SUN CHASER，横向延展。',
  },
];

export function inspirationLabel(item: Inspiration, lang: Lang): string {
  return lang === 'zh' ? item.labelZh : item.labelEn;
}

export function inspirationText(item: Inspiration, lang: Lang): string {
  return lang === 'zh' ? item.textZh : item.textEn;
}

export type PartId =
  | 'entry'
  | 'cabLeft'
  | 'cabRight'
  | 'windows'
  | 'rooflight'
  | 'awning';
export type PartsState = Record<PartId, boolean>;
export const CLOSED: PartsState = {
  entry: false,
  cabLeft: false,
  cabRight: false,
  windows: false,
  rooflight: false,
  awning: false,
};
/* Part display names live in lib/i18n.ts (part.* keys); the former
   PART_LABELS table here was dead code and has been merged into the
   dictionary together with page.tsx motionNames and VehicleScene labels. */
export interface StudioState {
  applied: Sticker | null;
  parts: PartsState;
  wipers: boolean;
  environment: 'camp' | 'studio';
  scale: number;
  height: number;
  horizontal: number;
}
