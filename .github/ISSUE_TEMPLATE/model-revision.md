---
name: 模型修订
about: GLB 模型修订（R＋数字）的 handoff：改动范围、哈希链、目检缺一不可
title: "[模型修订] R"
labels: []
---

## 修订目标

<!-- 改哪里、为什么改；附用户反馈或参照依据。 -->

## 前一版哈希

<!-- 前一版 GLB sha256（完整值）；前一版 revision（如 20261025-r12-forehead-revert）。 -->

- 前一版 GLB sha256：
- 前一版 revision：

## 本版改动范围（只动部位）

<!-- 逐项列出只动的部位；其余不动要有比对证据（如逐字节/三角多重集比对结果）。
     禁止“顺手”扩大范围。 -->

## 元数据同步清单

<!-- 以下三处＋测试钉值必须同步，缺一不可： -->

- [ ] `lib/vehicle-assets.ts`：`VEHICLE_ASSET_REVISION` → 本版 revision（不含品牌词）
- [ ] `public/model/motion_metadata.json`：`glbSha256` → 本版 GLB sha
- [ ] `public/model/wiper_calibration.json`：`outputSha256` → 本版 GLB sha
- [ ] 测试中的 GLB sha 钉值同步更新

## 线稿普查对比

<!-- 真实 drawing 逻辑（`THREE.EdgesGeometry(geometry, 40)`）复现的段数对比：
     额头框 / 门侧 / 相关部位，改动前 → 改动后。 -->

## 测试

<!-- 命令原文＋退出码＋通过/失败数；先证伪：新测试先在故意改坏实现下变红。 -->

- [ ] `npm test` 全绿
- [ ] `npm run lint` 0/0
- [ ] `npx tsc --noEmit` 通过
- [ ] `npm run build` 通过

## 目检方法

<!-- 视角、模式（主页面 drawing 线稿模式）、通过标准；通过标准是维护者亲自看过，
     数值指标（侧围顶线 max-y 分档、二阶差分）已退役，禁止用作验收。 -->

## 回滚方式

<!-- 重传上一版 GLB（网页端上传覆盖）＋同步三处元数据＋测试钉值；
     上线后核对哈希链（工作树＝GitHub 原始文件＝线上 demo）三者一致。 -->
