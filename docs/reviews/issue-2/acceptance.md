# Issue #2：验收清单与覆盖实话

执行者：Grok（以 shengjun89 身份）。claim `grok-issue2-r13-generator-20261027`。

冻结规范：main `c1666c2af070f36189f363c41b564074f5448c7b`。

精确最终 head 记在 PR 正文。本文档与受测代码同一提交，避免在文档里写会随下一次提交变化的自引用 SHA。

独立评审必须由没有参与本次实现的人做。实现者不自审。

落地到 main、以及落地后的 GLB 哈希链，由维护者执行。本次只开 Draft PR，不合并，不推 main。

## 先红后绿

新文件 `tests/body-lab-detail.test.ts` 先对着冻结 main 的旧示意车体跑过，再对着本实现跑过。

旧代码（实现之前）：

```text
node --experimental-strip-types --test tests/body-lab-detail.test.ts
# tests 8
# pass 1
# fail 7
退出码 1
```

失败要点：

- `sh6601h4db-s-h2525` 包围盒高 2.605 m，配置高 2.525 m（旧顶板在配置高度之上加了 0.08 m）
- 没有 `wheel-tire`，胎数断言为 0
- 没有 `shell` 以及特征清单里的其它 `userData.feature`
- `app/body-lab/page.tsx` 当时没有 `front_overhang_mm` / `registryEntryForModel`

已经是绿的那一条是「11 条部分行可见、不可选、无配置输出」。这是 main 上公告库原有行为，不是新生成器测红过的行为。按先证伪纪律，这条不能算新行为的测试证据；它只是把既有门闩再钉一次。

实现之后同一命令：8 通过，0 失败，退出码 0。最终工作树（含类型收窄与本文档）于 2026-10-27 复跑，结果相同。

## 验收条目

- [x] 24 条完整行 F+WB+R=L 精确（毫米整数相等）。测试逐行断言。
- [x] 这 24 行的车体包围盒长在 ±0.01 m、高在 ±0.02 m 内。壳顶落在配置高度，车轮把最低点放在 y=0，所以包围盒高等于配置高。
- [x] 车轮接地：组包围盒 min.y 与每条前胎 min.y 的绝对值小于 1e-3 m。
- [x] 轴 x 精确：前胎 x = −L/2+前悬，后胎 x = 前轴+轴距，容差 1e-3 m。并断言这不是 ±轴距/2 的两点居中摆法。
- [x] 11 条部分行仍在登记里、有名称、不可选、`configForModelIn` 为 null。没有补造缺的尺寸。
- [ ] 测试全绿。`npm test` 退出码 1：116 项里 115 通过、1 失败。失败项在写锁之外，见下节。
- [x] lint 0 error / 0 warning。`npm run lint`（oxlint）退出码 0，无告警输出。
- [ ] `npx tsc --noEmit` 未运行。
- [ ] `npm run build` 未运行。因此不能声称构建产物包含 `/body-lab`。
- [ ] 推 main 后的线上 `/body-lab` 未验证。
- [ ] R13 GLB 上线哈希链未在本次验证。本地工作树哈希与 issue 给定值一致，见 measurement.md。

## 全量测试里的那一条失败

```text
npm test
退出码 1
# tests 116
# pass 115
# fail 1
```

失败：`tests/parametric-body-scene.test.ts` 的 `schematic body spans the configured length and height`。

实际高度 `3.050000008969009`。该测试期望默认 B 型（高 3.05 m）的包围盒高为 3.13 m，也就是旧示意顶板再加 0.08 m。

motorhome-b 已改为精细生成器，壳顶落在配置高度，所以这条旧断言不再成立。该测试文件不在本次写锁内。按写锁，没有改它，也没有为了让它变绿而在默认高度上加回 0.08 m 顶板。夜跑不自动重试这条失败。

需要 dot 决定：把写锁扩到这一条断言（期望高度改为配置高度），或保持本 PR 在全量测试上为红。

其余既有场景测试（各车种能建出、滑移舱、雨篷、空调、附件网格数、弹跳）在这次 `npm test` 里通过。

## 未运行的 tsc 与 build

`vite.config.ts` 有 `import hostingConfig from './.openai/hosting.json'`。`tsconfig.json` 的 `include` 含 `**/*.ts`，且 `resolveJsonModule` 为 true，因此 `npx tsc --noEmit` 会读该文件。`npm run build` 走 vinext，会加载同一份 vite 配置。

协调者禁止本地运行会读取 `.openai/hosting.json` 的命令。这两项没有跑。没有打开、创建或改写该文件。CI 若跑这两项，结果以 CI 为准，本次不能打勾。

`npm run lint` 的路径是 `app components/studio lib tests`，不包含 `vite.config.ts`。本次 lint 退出码 0。

## 未验证

- 浏览器截图、同视角前后对比
- 线稿模式（`THREE.EdgesGeometry` 目检）
- 线上 `/body-lab`
- 落地后的 GLB 哈希链（工作树 / GitHub 原始文件 / 线上 demo 三者）
- 体验官 drawing 验收

以上都不能当成视觉通过。模型是设计展示，不是原厂几何，不能按图开料。

## 覆盖实话

- 只替换了 motorhome-b。24 条完整公告行对应 8 个公告型号（各高度变体分行），由范式加该行登记尺寸生成精细模型。
- 11 条部分行仍缺分变体长度、后悬或其它必填字段，保持不可选，没有配置输出，没有编造尺寸。
- camper、越野、客车、C 型、皮卡、拖挂仍是示意模型。不能说已经覆盖所有车型。
- V80 以外车型的精细模型是「范式 + 本车登记尺寸 + 类别/窗位规则」，不是原厂精确几何。不声称 V80 身份，也不把客车公告写成已认证旅居车。
- 厨房窗与卫浴窗用的是 V02 实测同一对 y（1.8837–2.3067 m），缩放后中心高度相同。入户侧是额头、生活前、生活后、入户门玻璃、驾驶舱玻璃。没有额头眉带。
- 窗框边宽 0.035 m，测试检查厨房窗框包围盒比玻璃各大 0.07 m。
- 未配前后悬时（演示默认），剩余长度按 R13 前悬:后悬比例拆开，仍然是四锚点，不是轴距居中。
- Draft PR #23 也改 `app/body-lab/page.tsx`。本 PR 对该文件只加了登记前后悬接线。合并顺序由 dot 定。

## 命令

环境：Node v22.23.4。工作树 GLB 哈希见 measurement.md。时间：2026-10-27。

| 命令 | 退出码 | 结果 |
| --- | --- | --- |
| `node --experimental-strip-types --test tests/body-lab-detail.test.ts`（实现前） | 1 | 8 项，通过 1，失败 7 |
| `node --experimental-strip-types --test tests/body-lab-detail.test.ts`（实现后） | 0 | 8 项，通过 8，失败 0 |
| `npm test` | 1 | 116 项，通过 115，失败 1（`parametric-body-scene.test.ts` 高度 3.05 对期望 3.13） |
| `npm run lint` | 0 | oxlint 无 error / warning 输出 |
| `npx tsc --noEmit` | 未运行 | 会经 `vite.config.ts` 读取 `.openai/hosting.json` |
| `npm run build` | 未运行 | 同上 |

lint 曾先因 `frontOverhangMm` 可能为 undefined 失败（退出码 1，4 条 TS18048）。收窄类型后重跑 lint，退出码 0。没有为了全量测试变绿去改写锁外的断言。
