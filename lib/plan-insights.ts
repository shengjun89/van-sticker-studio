import {
  circumference,
  type DecalPlacement,
  type WrapBody,
} from './wrap-layout.ts';

/**
 * 方案洞察的估算口径（覆盖率 / 价格）。
 *
 * 面积推导（源自 lib/wrap-layout.ts 的周长图，模型单位即米）：
 * - 编辑器着色器与 constrainDecal 一致：贴图在周长图上的矩形
 *   宽 = 3.5 * scale（沿周长坐标 s，米），高 = 宽 / aspect。
 *   单侧贴图面积 = 宽 * 高 = 12.25 * scale² / aspect。
 * - 一侧车身在周长图上的矩形面积 = body.length * body.height
 *   （长取 motion_metadata 的 wrap.xSpan=5.8，高取 wrap.zSpan=3.05）。
 *
 * 假设（推导不出来的部分，集中在此声明）：
 * 1. 分母用周长图侧面矩形面积，未扣除车窗、轮拱、把手等不可贴区域，
 *    因此是「可贴漆面总面积」的上限近似，算出的覆盖率为保守下限估算；
 *    实际漆面占比会更高，临近 30% 线时必须按实车实测复核。
 * 2. 两侧 placements 假定分别位于车身两侧且互不重叠；用户把两块贴图
 *    拖到同一侧重叠时，合计面积会重复计算。
 * 3. 贴图矩形按完整矩形计面积，未扣除图案透明像素与被玻璃/饰件
 *    裁切的部分，同样是上限近似。
 */

/** 编辑器贴图基准宽（米，scale=1 时），与 wrap-layout / 着色器保持一致。 */
export const DECAL_BASE_WIDTH_M = 3.5;

/** 合规线：贴纸覆盖率 ≤30% 通常免备案（需求池 P20/P21）。 */
export const COMPLIANCE_THRESHOLD_RATIO = 0.3;

/** 膜材用量损耗系数：包边 + 裁切损耗，估算口径。 */
export const FILM_WASTE_FACTOR = 1.25;

/** 价格锚点：全车改色膜（国产膜）3000–8000 元（需求池价格锚点注记）。 */
export const FULL_WRAP_PRICE_LOW_YUAN = 3000;
export const FULL_WRAP_PRICE_HIGH_YUAN = 8000;

/** 膜材 / 施工拆分比例，估算口径（两者之和须为 1）。 */
export const MATERIAL_COST_SHARE = 0.55;
export const LABOR_COST_SHARE = 0.45;

/** 编辑器在图片载入前的默认宽高比（vehicle-wrap-editor 的 aspect 初始值）。 */
export const DEFAULT_DECAL_ASPECT = 3;

/**
 * 厢式房车周长图车身（motion_metadata：wrap.xMin=-2.85、xSpan=5.8、
 * dimensionsMeters.width=2.22、wrap.zSpan=3.05）。
 * 仅作编辑器实时状态尚未回流时的兜底，实时路径优先用编辑器的 body。
 */
export const VAN_WRAP_BODY: WrapBody = {
  xMin: -2.85,
  length: 5.8,
  width: 2.22,
  height: 3.05,
};

const safeAspect = (aspect: number) =>
  Number.isFinite(aspect) && aspect > 0 ? aspect : DEFAULT_DECAL_ASPECT;

const safeScale = (scale: number) =>
  Number.isFinite(scale) && scale > 0 ? scale : 0;

/** 单块贴图在周长图上的矩形面积（㎡）。 */
export function decalRectAreaM2(scale: number, aspect: number): number {
  const width = DECAL_BASE_WIDTH_M * safeScale(scale);
  return (width * width) / safeAspect(aspect);
}

/** 一侧车身的周长图矩形面积（㎡）：长 × 高。 */
export function sideChartAreaM2(body: WrapBody): number {
  return body.length * body.height;
}

/** 全车周长图面积（㎡）：周长 × 高，价格折算的分母。 */
export function fullChartAreaM2(body: WrapBody): number {
  return circumference(body) * body.height;
}

export type CoverageEstimate = {
  /** 两侧贴图矩形面积合计（㎡）。 */
  decalAreaM2: number;
  /** 单侧周长图面积（㎡）。 */
  sideAreaM2: number;
  /** 两侧合计分母（㎡）。 */
  totalSideAreaM2: number;
  /** 覆盖率 0–1（估算）。 */
  ratio: number;
  /** 是否超过 30% 合规线。 */
  overThreshold: boolean;
  /** 含损耗的膜材用量（㎡）。 */
  filmAreaM2: number;
};

export function estimateCoverage(input: {
  placements: readonly DecalPlacement[];
  aspect: number;
  body: WrapBody;
}): CoverageEstimate {
  const decalAreaM2 = input.placements.reduce(
    (sum, placement) => sum + decalRectAreaM2(placement.scale, input.aspect),
    0,
  );
  const sideAreaM2 = sideChartAreaM2(input.body);
  const totalSideAreaM2 = sideAreaM2 * 2;
  const ratio = totalSideAreaM2 > 0 ? decalAreaM2 / totalSideAreaM2 : 0;
  return {
    decalAreaM2,
    sideAreaM2,
    totalSideAreaM2,
    ratio,
    overThreshold: ratio > COMPLIANCE_THRESHOLD_RATIO,
    filmAreaM2: decalAreaM2 * FILM_WASTE_FACTOR,
  };
}

export type PriceEstimate = {
  /** 含损耗的膜材用量（㎡）。 */
  filmAreaM2: number;
  /** 全车周长图面积（㎡），折算分母。 */
  fullAreaM2: number;
  /** 当前贴图面积占全车改色面积的比例 0–1。 */
  ratioToFullWrap: number;
  priceLowYuan: number;
  priceHighYuan: number;
  materialLowYuan: number;
  materialHighYuan: number;
  laborLowYuan: number;
  laborHighYuan: number;
};

/**
 * 价格折算：以全车改色膜锚点价按面积比例折算。
 * 膜材用量两侧都含同一损耗系数，比例中相互抵消，故直接用贴图面积比。
 */
export function estimatePrice(input: {
  decalAreaM2: number;
  body: WrapBody;
}): PriceEstimate {
  const fullAreaM2 = fullChartAreaM2(input.body);
  const decalAreaM2 =
    Number.isFinite(input.decalAreaM2) && input.decalAreaM2 > 0
      ? input.decalAreaM2
      : 0;
  const ratioToFullWrap = fullAreaM2 > 0 ? decalAreaM2 / fullAreaM2 : 0;
  const priceLowYuan = FULL_WRAP_PRICE_LOW_YUAN * ratioToFullWrap;
  const priceHighYuan = FULL_WRAP_PRICE_HIGH_YUAN * ratioToFullWrap;
  return {
    filmAreaM2: decalAreaM2 * FILM_WASTE_FACTOR,
    fullAreaM2,
    ratioToFullWrap,
    priceLowYuan,
    priceHighYuan,
    materialLowYuan: priceLowYuan * MATERIAL_COST_SHARE,
    materialHighYuan: priceHighYuan * MATERIAL_COST_SHARE,
    laborLowYuan: priceLowYuan * LABOR_COST_SHARE,
    laborHighYuan: priceHighYuan * LABOR_COST_SHARE,
  };
}
