# MXGARAGE Wrap Studio 部署准备文档（DEPLOY）

> 本文档只做部署准备说明，不执行部署、不配置任何密钥、不推送远程。
> 适用项目：`van-sticker-studio`（MXGARAGE 拉花网页应用）
> 关联任务单：P0「网页应用端到端跑通：配通 AI 生图并部署上线」
> 编写口径：README 的 `Server AI configuration` 与 `Develop and verify` 两节、`package.json` scripts、`vite.config.ts`、`.dev.vars.example` / `.env.example`、`.gitignore`。

---

## 当前状态（2026-10-23 核实）

| 项 | 状态 |
| --- | --- |
| 运行环境 | Node `v24.22.1`（满足 `package.json` 的 `engines: node >=22.13.0`） |
| 依赖安装 | `npm ci` 可完成安装 |
| 自动化测试 | `npm test` — 37/37 通过 |
| 代码检查 | `npm run lint` — 0 error / 0 warning |
| 类型检查与构建 | `npx tsc --noEmit` 与 `npm run build` 当前仅因缺失 `.openai/hosting.json` 失败，其余无报错 |
| 服务器密钥 | `OPENAI_API_KEY` 尚未配置；`GET /api/status` 应为 `configured: false`，页面走诚实报错 + 样例模式（见第 3、4 节） |
| 线上部署 | 尚未部署，无公开 URL |
| 内置样例 | `public/stickers/` 下 4 张 GPT Image 样例图可用，明确标注为样例，从不冒充实时 AI 结果 |

**关于 `.openai/hosting.json` 缺失（关键阻塞）：**

- 该文件是 owner 私有的 Site 身份文件，`vite.config.ts` 在加载时直接从中解构绑定名：

  ```ts
  import hostingConfig from './.openai/hosting.json';
  const { d1, r2 } = hostingConfig;
  ```

  解构出的 `d1`、`r2` 用于组装本地的 D1 / R2 绑定配置（`localBindingConfig`）。
- 本仓库快照内不包含该文件，因此在取回前 `tsc` 与 `build` 必然失败——这是预期行为，不是代码缺陷。
- 部署 / 构建前必须从 owner 原有环境（原 Site 创建环境）取回原件，放到项目根目录下的 `.openai/hosting.json`。
- **严禁伪造占位文件绕过**：不要手写一个含假 `d1` / `r2` 值、假 database id 的 `hosting.json` 让构建「假通过」。伪造文件会把本地绑定指向不存在的资源，且掩盖 Site 身份不一致问题，后续部署会以更难排查的方式失败。

---

## 1. 前置条件清单

在执行构建或部署前，逐项确认：

- [ ] **Node 版本**：`node -v` 为 `>=22.13.0`（2026-10-23 实测环境为 `v24.22.1`）。版本过低时 `vinext` / `vite` 构建可能直接报错，不要用系统自带的旧 Node 混跑。
- [ ] **包管理器**：使用 `npm`，以 `package-lock.json` 为准。首次或依赖变更后执行：

  ```bash
  npm ci
  ```

  `npm ci` 按锁文件干净安装，与 CI / 部署环境行为一致；日常开发也可用 README 中的 `npm install`，但部署前以 `npm ci` 结果为准。

- [ ] **`.openai/hosting.json` 已取回**：
  - 来源：owner 原有环境（创建该 Site 时的环境 / 原工作机），不在本仓库快照内，不从网络下载、不从他人处索取。
  - 放置路径：项目根目录下 `.openai/hosting.json`（与 `vite.config.ts` 中 `import ... from './.openai/hosting.json'` 相对应）。
  - 只确认文件存在且可被 JSON 解析、且包含 `d1`、`r2` 两个字段即可；本文档与仓库内任何文档都不记录、不展示其中的真实绑定值。
  - 该文件属于 owner 私有身份文件，不要提交到公开仓库；`.gitignore` 已列 `.openai/`。
    注意：`.gitignore` 对已被跟踪的文件无效；是否从仓库取消跟踪（以及构建如何在没有该文件时运行）由 owner 决定，agent 不读取、不删除该文件。
- [ ] **本地密钥文件（如需本地联调）**：按 `.dev.vars.example` / `.env.example` 说明，将示例复制为 `.dev.vars` 后再填值（见第 3 节）。`.dev.vars` 与 `.env*` 已被 `.gitignore` 忽略（`.dev.vars.example` 与 `.env.example` 除外），不要强制 `git add -f`。
- [ ] **Cloudflare 账号（正式部署时）**：准备好 owner 本人的 Cloudflare 账号，且该账号对目标 Worker / Site 有部署权限。本文档不代登录、不代执行（见第 2 节）。
- [ ] **OpenAI 密钥（配置时）**：准备好 owner 本人的 `OPENAI_API_KEY`，仅通过 server secret 渠道配置（见第 3 节），不经过聊天、文档或仓库传递明文。

### 构建四项验证命令及通过标准

部署前必须四项全绿，缺一不部署：

| # | 命令 | 对应 script | 通过标准 |
| --- | --- | --- | --- |
| 1 | `npm test` | `node --experimental-strip-types --test tests/*.test.ts` | 全部通过（2026-10-23 基线为 37/37）；覆盖生成契约、批量排序、运动、GLB 一致性、制图边界与雨刷间隙等 |
| 2 | `npm run lint` | `oxlint app components/studio lib tests` | 0 error / 0 warning |
| 3 | `npx tsc --noEmit` | —（TypeScript 直查） | 退出码 0，无类型错误。前置：`.openai/hosting.json` 已取回，否则此项会因缺文件失败 |
| 4 | `npm run build` | `vinext build` | 退出码 0 成功，且产物 `dist/` 与 `dist/server/wrangler.json` 已生成（见第 2 节）。前置同上 |

> 说明：README 的 `Develop and verify` 节列出的正是 `npm run lint` / `npm test` / `npx tsc --noEmit` / `npm run build` 四项，与上表一致。本地日常可用 `npm run dev`（`vinext dev`，端口 3000）预览，但 `dev` 通过不替代四项验证。

---

## 2. 构建与部署步骤

### 2.1 构建产物结构

```bash
npm run build
```

- 底层为 `vinext build`，成功后在项目根目录生成 `dist/`（已被 `.gitignore` 忽略，不提交仓库）。
- `dist/` 内包含前端静态资源与服务端产物；其中 `dist/server/wrangler.json` 是构建生成的 Wrangler 配置，供本地预览与部署共用——手改源码后应重新 `build` 让其再生，不要手改 `dist/` 内的文件当修复。
- 构建失败先看第 1 节：九成是 `.openai/hosting.json` 未取回或 Node 版本不符，不要先改业务代码。

### 2.2 本地以生产形态预览：`npm start`

```bash
npm start
# 实际执行：wrangler dev --config dist/server/wrangler.json
```

含义：

- 不是 `next start`，也不是 `vite dev`。它用 Wrangler 以 Cloudflare Workers 运行时（本地 Miniflare / workerd）加载构建产物 `dist/server/wrangler.json` 来跑，更接近线上行为——`cloudflare:workers` 的 `env`（含 server secret）、`app/api/` 下的路由都在这个运行时里验证。
- 使用顺序固定为先 `npm run build` 再 `npm start`；只改了源码没重新 build 时，`npm start` 跑的仍是旧产物。
- 本地 secret 走 `.dev.vars`（见第 3 节），Wrangler 会自动读取。

### 2.3 到 Cloudflare Workers 的正式部署路径（一般步骤，本文档不执行）

本节只写路径，实际执行须由 owner 在其 Cloudflare 账号下完成或明确授权后另行执行：

1. 完成第 1 节前置条件与四项验证（四项全绿）。
2. 确认 `.openai/hosting.json` 对应的 Site 身份无误，且目标 Cloudflare 账号与该 Site / Worker 归属一致。
3. 登录 Wrangler（owner 账号）：

   ```bash
   npx wrangler login
   npx wrangler whoami
   ```

4. 先配置生产 secret，再部署（顺序不要反，见第 3 节）：用 `wrangler secret put` 或 Cloudflare 控制台为目标 Worker 写入 `OPENAI_API_KEY`。
5. 执行部署（以构建生成的配置为准）：

   ```bash
   npm run build
   npx wrangler deploy --config dist/server/wrangler.json
   ```

   若项目后续改走 OpenAI Sites 的托管发布流程，则以该 Site 在 `.openai/hosting.json` 对应的发布入口为准，产物仍来自同一次 `npm run build`；两种路径二选一，不要混用同一环境的配置。
6. 记录部署输出的线上 URL 与部署时间，回填到 P0 issue。
7. 按第 5 节清单做上线后验收（无痕访问、`/api/status`、生成全流程、安全检查、手机实测）。
8. 部署后如修改了 secret，需重新部署或按控制台提示让新 secret 生效，并再次请求 `GET /api/status` 验证。

> 注意：`wrangler deploy` 会把当前 `dist/` 产物发布到线上，属于不可在文档阶段预演的外向动作。执行人必须确认当前目录、当前账号与目标 Worker 三者无误后再运行。

### 2.4 合并与上线分离（main 不自动上线）

- 规则：合并进 main 只生成新版本，不切生产流量；生产上线只由维护者执行（constitution 第 1 条、AGENTS.md §13）。
- Cloudflare Workers Builds 设置（owner 在控制台维护，agent 不改）：
  - 生产分支 `main` 的 Deploy command 必须是 `npx wrangler versions upload`（只上传版本、生成 Version URL，不切流量），不得是 `npx wrangler deploy`。
  - 非生产分支用 Preview 构建（PR 预览），不使用生产配置。
  - 设置变更后，owner 在「维护者决策」issue 记录一次当前值与核对时间。
- 合并后：合并者在验收台账写明本次版本 ID 与 Version URL（见 CONTRIBUTING.md §9）。注意 Version URL 使用该 Worker 的生产资源与 secret，验收时的生成请求会产生真实费用。
- 上线（维护者执行，二选一）：
  1. Cloudflare 控制台 → Workers & Pages → 目标 Worker → Deployments → 选中已验收的版本 → Deploy（100%）。
  2. 命令行（owner 账号）：`npx wrangler versions deploy <version-id>@100%`。
- 生产回滚（维护者执行）：同样方式把 100% 流量切回上一个已知正常版本；main 上的代码回滚另走 revert PR。
- 上线后：维护者或其指定的 agent 在验收台账回填生产版本 ID 与上线时间，再按第 5 节清单复验。

---

## 3. 服务器密钥配置

### 3.1 硬性规则

- `OPENAI_API_KEY` 必须作为 **server secret** 配置，浏览器永远拿不到密钥。
- **严禁**使用 `NEXT_PUBLIC_` 前缀变量：带该前缀的变量会被打进前端 bundle，等于公开密钥。
- **严禁**写入仓库：不要写进源码、README、本文档、`.env.example` / `.dev.vars.example`（示例文件只留占位），不要提交 `.env` / `.dev.vars`。`.gitignore` 已忽略 `.env*`、`.dev.vars`、`/dist/`、`/.wrangler/`，提交前仍要用第 5 节的安全检查复核一遍。
- `app/api/status/route.ts` 与 `app/api/generate/route.ts` 均通过 `cloudflare:workers` 的 `env` 在服务端读取密钥，这是唯一正规通道；前端只调用本站 `/api/*`，不直连模型厂商。

### 3.2 可选变量

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `OPENAI_API_KEY` | 是（真实生图时） | OpenAI API 密钥，server secret |
| `OPENAI_IMAGE_MODEL` | 否 | 生图模型名，未配置时默认 `gpt-image-2`（见 `lib/generation.ts` 的 `GenerationEnv` 与 README）。更换模型前先确认尺寸 / 透明背景等参数兼容性，不要随手改默认值 |

### 3.3 本地开发场景：`.dev.vars`

```bash
cp .dev.vars.example .dev.vars
# 编辑 .dev.vars，填入本地用的 OPENAI_API_KEY；OPENAI_IMAGE_MODEL 可保留默认
npm run build
npm start
```

- `.dev.vars.example` 内容即两行示例（key 占位 + `OPENAI_IMAGE_MODEL=gpt-image-2`）；`.env.example` 的注释也明确写了「Local development only. Copy to .dev.vars and enter your key there; never commit it.」
- 填好后请求 `GET /api/status` 应返回 `configured: true`（见 3.5）。本地文件只留在本机，不要截图外发、不要随项目打包分享。

### 3.4 生产场景：Cloudflare secret（二选一）

**方式一：Wrangler 命令行（在完成 build 后执行）**

```bash
npx wrangler secret put OPENAI_API_KEY --config dist/server/wrangler.json
# 按提示在终端粘贴密钥，输入过程不回显；不要把密钥写在命令行参数里（会进 shell 历史）
npx wrangler secret list --config dist/server/wrangler.json
# list 只应看到变量名，不应看到明文值
```

如需设置模型名，同法 `put OPENAI_IMAGE_MODEL`；不设则走默认 `gpt-image-2`。

**方式二：Cloudflare 控制台**

Cloudflare Dashboard → Workers & Pages → 选中目标 Worker → Settings → Variables and Secrets → Add → 类型选 Secret → 变量名填 `OPENAI_API_KEY` → 值填密钥 → 保存 / 部署。

若部署走 OpenAI Sites 托管，则在对应 Site 的服务器密钥（Sites server secret）设置入口填同名变量，原则不变：服务端密钥区，不进前端变量区。

### 3.5 配置验证标准

```bash
curl https://<线上域名>/api/status
# 期望：{"configured":true}
```

- 返回 `true` 只证明服务端读到了非空的 `OPENAI_API_KEY`（实现见 `app/api/status/route.ts`：`Boolean(vars.OPENAI_API_KEY)`，并带 `Cache-Control: no-store`），不证明密钥有效或额度充足；有效性要再走一次真实生成（第 5 节）验证。
- 返回 `false` 时不要反复点生成：先按第 6 节顺序排查 secret 是否存在于正确环境（本地 `.dev.vars` vs 生产 secret 是两套，配了本地不等于配了线上）。

---

## 4. 公开 demo 成本闸门方案

背景：P0 目标是「任何人打开线上链接，输入一句描述就能生成」。一旦公开且配上真实 key，每次生成会向 OpenAI 发出 4 个不同艺术方向的请求（两路并发，见 `lib/generation.ts`），成本由 owner 承担，必须在公开前设闸门。以下两案二选一（也可组合，见推荐）。

### 方案 A：样例模式默认 + 真实生成限流

- 默认状态：访客先看到 4 张内置样例，可完整体验选图、贴车双侧、拖动 / 缩放 / 锁定、机位与开合交互，零生图成本。
- 真实生成需访客显式点击生成并经过一次成本提示确认（如「本次将调用 AI 生成 4 个方案」），确认后才走 `POST /api/generate`。
- 限流：按 IP 和 / 或会话限次（例如每 IP 每日 N 批、全局每日总批次上限），超限后明确提示并回落到样例模式；保留管理员一键关停开关（改环境标志或删除 secret 即停）。
- 优点：与 P0 验收口径完全一致——无痕访客无需任何自备凭证即可跑通全流程；体验摩擦最低，适合作为公开作品 / 求职 demo。
- 缺点：owner 仍承担限额内的成本，需要监控与预算告警；限流存储与防刷要额外开发。

### 方案 B：BYOK（Bring Your Own Key，访客自填 key）

- 访客在页面输入自己的 OpenAI API key，仅保存在浏览器内存（不进 `localStorage`、不落盘、不写日志），请求时经本站 `/api` 转发到上游，服务端不持久化该 key。
- 优点：owner 生图成本为零；密钥不出浏览器内存 + 本站转发，相对可控。
- 缺点：绝大多数访客（尤其非技术背景的评审者 / 招聘方）没有 OpenAI key，全流程在第一步就断，与 P0「任何人打开就能生成」的目标直接冲突；输入框本身也会引发「这个站要我的 key 是否安全」的信任成本；服务端转发他人 key 还需额外处理日志脱敏与滥用边界。

### 推荐：方案 A 为主，BYOK 不作为公开 demo 的默认路径

理由结合本项目现状：

1. 项目已具备方案 A 的诚实底座：未配 key 时 `POST /api/generate` 返回 `503` + `AI_NOT_CONFIGURED` 并明确提示「AI 生成功能等待服务器配置……你现在可以选择下方四款示例」，样例从不冒充 AI 结果（`lib/generation.ts` 现有行为）。方案 A 是在这一行为上加限流与确认，不是推翻重做。
2. P0 完成定义要求需求方本人及无痕访客直接打开 URL 确认全流程可用；BYOK 会让验收与公开演示都依赖访客自备 key，等于把核心卖点关在门外。
3. 成本可控性上，方案 A 的风险是「有限且可关停」的：限次 + 全局上限 + 随时删 secret 停服，最坏成本有天花板；先小限额公开、观察用量再调整，比一开始就 BYOK 更符合 demo 阶段目标。
4. BYOK 可作为后续可选增强（给高频 / 专业访客的自备通道），但不应替代 A 成为默认入口；若未来做 BYOK，必须单独评审内存存储与转发日志脱敏，不在本期范围内。

### 上线前要补的代码点（只列清单，不在本文档实现）

- [ ] 生成入口的成本提示确认：首次点击生成时弹出说明（调用次数 / 方案数），确认后才发请求；取消则停留在样例模式。
- [ ] 限流中间层：按 IP + 会话维度计数（可借助 Cloudflare Rate Limiting、KV / D1 计数或 Worker 内限流逻辑），维度与阈值做成服务端配置，不写死在前端。
- [ ] 全局预算闸门：每日总批次上限与超限后的统一回落响应（明确错误码 + 样例引导），前端能识别并诚实展示，不把限流伪装成上游故障。
- [ ] 管理开关：服务端环境标志（如生成总开关）可一键停用真实生成，停用时 `/api/status` 或生成接口给出可区分的状态，页面回落样例模式。
- [ ] 防刷基础项：沿用现有同源校验（`lib/generation.ts` 已校验 `Origin`），评估是否需要 Turnstile 等人机校验；生成接口不得对未授权跨域来源开放。
- [ ] 用量可观测：记录每批生成的成功 / 部分成功 / 失败与上游状态（只记元数据，严禁记录 key 与完整 prompt 外的敏感信息），便于事后对账与调限额。
- [ ] 前端状态区分：把「未配置」「被限流」「上游失败」三种提示文案与样式区分开，延续现有失败诚实原则，样例区在任何状态下都明确标注为样例。

---

## 5. 上线前检查清单

取自 P0 验收标准中与部署直接相关的条目，上线前后逐项勾选并回填证据：

### 部署与配置

- [ ] 四项验证全绿：`npm test` 全部通过、`npm run lint` 无错误、`npx tsc --noEmit` 无错误、`npm run build` 成功
- [ ] `.openai/hosting.json` 为 owner 原件（非伪造占位），构建未报缺文件错误
- [ ] 生产环境 `GET /api/status` 返回 `configured: true`
- [ ] 线上 URL、部署时间已记录并回填 P0 issue

### 无痕访问全流程

- [ ] 无痕 / 未登录窗口打开线上 URL：车辆加载完成，可拖拽旋转、滚轮缩放，五个机位预设可切换
- [ ] 输入验收描述「复古绿白露营风，山野与海岸元素」点击生成：4 个方案按设计号顺序流式出现，首个成功方案自动贴到车身左右两侧且两侧均可见
- [ ] 点选其他方案可立即切换两侧贴图；内置 4 张样例仍可点选贴车
- [ ] 生成中点击停止：未完成请求被终止，已完成方案保留可点选；紧接着再次生成，新结果不被旧请求覆盖
- [ ] 既有交互无回退：车门 / 侧窗 / 天窗 / 侧帐开合、一键露营、雨刷、拉花拖动 / 缩放 / 锁定均正常

### 失败诚实

- [ ] 模拟失败场景（未配 key 或上游报错）：页面给出明确错误提示，不白屏、不无限转圈
- [ ] 失败时已贴在车上的拉花不消失；部分成功时成功方案可正常使用
- [ ] 样例在任何状态下都只以样例身份展示，不被文案或顺序冒充为 AI 实时生成结果

### 安全检查

- [ ] 在构建产物（`dist/`）与页面源码（查看源代码 / 前端 JS）中全文搜索，搜不到 API key 及 key 的片段
- [ ] 浏览器开发者工具 Network 面板核查：浏览器请求只走本站 `/api`（如 `/api/status`、`/api/generate`），不直连模型厂商域名；密钥不出现在请求头、请求体或响应中
- [ ] 仓库复核：`git status` / 提交内容中不含 `.env`、`.dev.vars`、`.openai/hosting.json` 的敏感内容与任何明文 key
- [ ] 生产 secret 只存在于服务端（`wrangler secret list` 只见变量名），前端环境变量中无 `NEXT_PUBLIC_` 形式的 key

### 手机实测记录

- [ ] 手机浏览器实测线上 URL，并记录：机型、系统 / 浏览器版本、网络条件（Wi-Fi / 4G / 5G）、首屏可交互时间
- [ ] 手机端复测：车辆可旋转缩放、生成全流程可完成、贴图双侧可见，结果回填 P0 issue
- [ ] 附交付证据：生成结果贴车双侧截图附在 P0 issue，需求方本人打开线上 URL 确认全流程可用

---

## 6. 回滚与故障

### 6.1 回滚方式

- **部署失败（构建或 `wrangler deploy` 报错）**：线上仍是上一版本，不要带病重试连发。先保存完整报错，按第 1 节逐项核前置条件（Node 版本、`.openai/hosting.json`、四项验证），修复后重新 `npm run build` 再部署。
- **新版本上线后异常**：在 Cloudflare 控制台 Workers & Pages → 目标 Worker → Deployments 中，将流量回滚 / 重新部署到上一个已知正常的部署版本；或用上一个正常版本的源码重新 `npm ci && npm run build && wrangler deploy`。回滚后立即请求 `GET /api/status` 并打开页面做冒烟检查。
- **生成成本失控或被刷**：最快止血是关停生成而非下线整站——删除 / 置空生产 `OPENAI_API_KEY` secret 或关闭第 4 节的管理开关，页面会回落到诚实的未配置提示 + 样例模式，站点其余功能不受影响。处置完再查限流与日志。
- **secret 配错 / 疑似泄露**：立即在 OpenAI 侧吊销旧 key 并生成新 key，按第 3.4 节重新 `put` 新 secret 并验证 `/api/status` 与一次真实生成；同时复查第 5 节安全检查项，确认旧 key 未进仓库与构建产物。

### 6.2 生成接口异常排查顺序

按顺序排查，不要跳步、不要先改代码：

1. **先查状态接口**：请求 `GET /api/status`。
   - `configured: false` → 密钥根本没进当前环境，转第 2 步。
   - `configured: true` 但生成仍失败 → 密钥存在，转第 3 步查上游。
2. **再查 secret 是否存在于正确环境**：确认本地查的是 `.dev.vars`、线上查的是目标 Worker 的 secret（`wrangler secret list` 或控制台），两者互不相通是最常见误配；同时确认变量名拼写为 `OPENAI_API_KEY`（及可选的 `OPENAI_IMAGE_MODEL`），没有误用 `NEXT_PUBLIC_` 前缀、没有多余空格。
3. **最后查上游错误，并坚持原文回显原则**：查看 `POST /api/generate` 的响应与 Worker 日志。现有实现已按上游状态给出可区分提示（见 `lib/generation.ts`：401 / 403 提示密钥或模型权限需管理员检查、429 提示额度不足或请求较多、400 提示描述无法处理、其余提示稍后重试），未配 key 时返回 `503` + `AI_NOT_CONFIGURED`。排查时保留这些明确提示与上游状态信息，不要把错误吞成笼统的「生成失败」、更不要在失败时拿样例图冒充结果——失败诚实是硬性要求，定位问题靠的是错误原文，不是掩盖错误。
4. 仍无法定位时，记录复现条件（时间、描述文本、`/api/status` 返回、生成接口状态码与错误文案、Worker 日志片段，注意脱敏不带 key）后回填 P0 issue，再决定是否回滚。

---

## 附：命令速查

```bash
npm ci                    # 按锁文件安装依赖
npm test                  # 自动化测试（基线 37/37）
npm run lint              # 代码检查
npx tsc --noEmit          # 类型检查
npm run build             # 构建，产物 dist/ 与 dist/server/wrangler.json
npm start                 # wrangler dev --config dist/server/wrangler.json（生产形态本地预览）
npm run dev               # 日常开发预览（vinext dev，端口 3000）
curl https://<域名>/api/status   # 期望 {"configured":true}
```

*本文档状态：部署准备完成，部署与密钥配置均未执行，等待 owner 取回 `.openai/hosting.json` 并在其 Cloudflare / OpenAI 账号下按本文档执行。*
