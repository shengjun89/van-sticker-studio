# 需求池子：房车 / 宿营车 / 床车 改装-美化 用户痛点

> 用途：MXGARAGE 房车后市场创业的持续需求输入。支撑 10+5 访谈提纲、3 笔 B 端试单 offer、拉花美化方案卖点。
> 更新节奏：每周二、六 08:30 自动采集（定时任务 `mxgarage-decal-social-radar`，2026-10-22 建，首轮同日手动触发）。
> 采集口径（2026-10-22 扩大）：小红书 / 抖音 / Bilibili / 微信生态（朋友圈私域为盲区，只覆盖公众号/视频号/索引转发）/ Instagram / YouTube / Facebook / X(Twitter)；2026-10-22 起聚焦车拉花/车贴/改色膜专项，只收"用户真实痛点"，不收商家软文；每轮同步报告须含机会点+产品修改建议。
> 相关性标签：高=直接影响拉花美化/3D预览/1:64车模/B端试单；中=间接影响；低=通用背景。

## 采集说明（给定时任务 worker）

1. 用 `social.search`（IG/Threads/FB）中文检索：房车改装痛点 / 房车后悔 / 宿营车避坑 / 床车缺点 / 露营车美化。
2. 用 `browser.search` 检索 YouTube 与被索引的小红书/抖音帖：关键词"房车改装 痛点 / 后悔 / 避坑 / 美化"。
3. 抖音/小红书站内用 `browser.spawn_task` 打开站内搜索（免登录可见部分即可，不要登录）。
4. 提取去重后追加到本文件"条目"区，字段：日期 | 平台 | 原帖链接 | 痛点摘要（一句话）| 相关性。
5. 每条写进 `~/memory/YYYY-MM-DD.md` 一句话日志。
6. 只有当次新增 ≥3 条"高/中"相关性条目时，才在聊天里发一条简短摘要；否则静默（文件已更新）。

## 条目

### 2026-10-14（首批 pilot，共 19 条）

| # | 平台 | 原帖 | 痛点摘要 | 相关性 |
|---|------|------|----------|--------|
| P1 | Instagram | https://www.instagram.com/reel/DaZkP-kPxX5/ （@adul002 北漂小乔，2026-07-05，9.1K赞） | 驻车温控差：无保温+驻车空调不给力，冬天像冰窖、夏天像桑拿 | 低 |
| P2 | Instagram | 同上 | 水电续航短：128L 水箱只用 4–5 天，洗衣服不够用 | 低 |
| P3 | Instagram | 同上 | 排污麻烦：黑水箱 3–5 天清空一次，还要买专用化学剂（约70元/瓶） | 低 |
| P4 | Instagram / 360doc | 同上；http://www.360doc.com/content/25/1026/20/36515047_1163713865.shtml （2025-10-26） | 停车难：城市车位稀缺且贵；景区甚至拒绝房车停放，有车主找3小时车位无果 | 低 |
| P5 | Instagram | https://www.instagram.com/reel/DaZkP-kPxX5/ | 隔音差：在城市过夜睡觉要戴耳塞 | 低 |
| P6 | 媒体（新浪财经） | https://finance.sina.cn/2026-10-09/detail-iniuqywr7873372.d.html （2026-10-09） | 床车行车躺卧有安全风险：急刹时人体被抛射、气囊错位致二次伤害（山西高速交警提示） | 低（但说明用户对"改装合规红线"敏感） |
| P7 | 媒体（新浪财经） | 同上 | 社会接受度争议：公厕洗漱、污水随意倾倒、蹭酒店厕所和水源，把成本转嫁给当地 | 低 |
| P8 | 360doc | http://www.360doc.com/content/25/1026/20/36515047_1163713865.shtml | 买后使用率低：大部分时间停着吃灰，高购车成本换来极低使用频率 | 中（低频用户对"值不值"更敏感，影响美化方案话术） |
| P9 | 360doc | 同上 | 持有成本高：保险比普车贵、维修零部件小众且贵、油耗高，外加停车/过路/营地费 | 中（价格敏感 → 美化方案要强调性价比与保值） |
| P10 | 360doc | 同上 | 空间局促、布局不合理：床不舒服、厨房挨着卫生间做饭有异味 | 低（内饰） |
| P11 | 360doc | 同上 | 维护麻烦：漏水、电路短路频发，维修费时费力且需要专业知识 | 低 |
| P12 | 360doc | 同上 | 旅行受限：营地分布少（水电排污补给难）、偏远地区路况差进不去 | 低 |
| P13 | YouTube（TVBS新闻） | https://www.youtube.com/watch?v=xq3pl9Xb8xY | 改装车验车难过：法规滞后、各地标准不一，玩家感叹"法令跟不上时代" | 高（外观改装/拉花的合规边界——MXGARAGE 方案必须附合规说明） |
| P14 | 汽车之家车家号 | https://chejiahao.autohome.com.cn/info/24516702 | 大水大电有安全隐患 → 轻量化改装诉求强烈 | 低 |
| P15 | YouTube（车宿改装） | https://www.youtube.com/watch?v=cssDG1EvG0s | 床椅做满导致只能盘腿/弯腰爬行，"终结盘腿地狱"成为改装卖点 | 低（内饰动线） |
| P16 | YouTube（车宿改装） | https://www.youtube.com/watch?v=cssDG1EvG0s （关键词：车顶架验车、风切声） | 车顶架等外观附件：验车麻烦 + 高速风切噪音 | 中（外观附件改装的实用性顾虑，拉花方案可对比强调"零验车风险"） |
| P17 | YouTube | https://www.youtube.com/watch?v=Tx9wdK00K-A （七十岁老车友几千块自改）；https://www.youtube.com/watch?v=OcaBNwRvdCg （3000元小车改装） | 改装价格不透明、预算焦虑：几千块到几十万跨度大，用户怕被坑 | 高（B端试单定价与美化方案价格锚点的直接输入） |
| P18 | YouTube | https://www.youtube.com/watch?v=zbzHuiI7XKI （老婆大人：香港大叔露营车美学改装DIY） | "露营车美学"改装成内容趋势：用户不只求实用，开始为外观美学付费 | 高（直接验证"美化"需求存在，是 MXGARAGE 拉花业务的核心论据） |
| P19 | Facebook（东森新闻） | https://www.facebook.com/reel/1260790080446335/ （2026-07-28） | 改装店纠纷：车主花11万装气动避震，店家疑似偷换原装件后跑路，多名受害者 | 中（施工环节信任痛点 → MXGARAGE"施工评估"环节的价值点） |

### 2026-10-14（第二轮：拉花/车身改色专项，共 5 条）

> 采集说明：本轮聚焦 MXGARAGE 核心业务（车身拉花/改色）的合规边界与定价锚点，补上 pilot 待办中的"拉花专项"。部分来源为 AI 生成内容（已标注），引用时打折；"30% 线"为多信源重复的监管口径，但地方执行细节可能有差异，试单 1 合规一页纸建议写"以当地车管所口径为准"。

| # | 平台 | 原帖 | 痛点摘要 | 相关性 |
|---|------|------|----------|--------|
| P20 | 媒体（新浪看点） | https://k.sina.cn/article_7879923687_1d5ae17e706801eqme.html?ab=qiche （2026-09-29） | 改色面积超 30% 须 10 日内到车管所办理变更登记（费用约百元）；2026 新规后备案流程已简化至约半小时。用户痛点：不知道"30% 线"在哪，怕备案麻烦 | 高（拉花方案"≤30% 免备案"是核心卖点依据；试单 1 合规一页纸直接引用） |
| P21 | 360doc（用户转载） | http://www.360doc.com/content/25/1119/18/54192271_1165190501.shtml （解读 2025-12-01 公安部《机动车安全技术检验规程（2025 版）》）；http://www.360doc.com/content/25/1225/10/85877976_1167285525.shtml | 车身贴纸 ≤30% 且不覆盖主体颜色：免备案，年检"直接过"、检测站放行。用户痛点：超 30% 贴纸年检前要自拆 | 高（"零验车风险"话术的法规依据；注意：检测站仍有自由裁量，话术须诚实打折，B9 访谈题正是验证这一点） |
| P22 | 媒体（新浪看点） | https://k.sina.cn/article_7879776555_1d5abd92b068020zry.html （2026-10-07，内容由 AI 生成，引用打折） | 车身拉花 ≤30% 免备案；全车改色膜若超 30% 必须 10 日内备案并更换行驶证照片。用户痛点：全车改色还要换行驶证照片，流程心理门槛高 | 高（拉花 vs 全车改色的"合规成本差"，是拉花方案定价与话术的差异化支点） |
| P23 | 媒体（新浪看点） | https://k.sina.cn/article_7879996055_1d5af329706801gdsa.html （2026-09-22 左右） | 小众色三年保值率仅 52%（贬值 38%），白色 68.5%；重度改色影响二手流通。用户痛点：改色一时爽，卖车时折价 | 中（拉花可逆、撕膜不伤原漆 → 相对喷漆/全车改色的保值卖点；需二手车商一手口径验证） |
| P24 | 媒体（新浪看点） | https://k.sina.cn/article_7879849621_1d5acf69506801vd7s.html?ab=qiche （2026-09-27） | 政策面：商务部等九部门 2026-06 通知"规范有序发展汽车改装"、分级分类管理；工信部 2026-09 透露汽车改装管理办法即将出台 | 中（顺风证据：合规化加速降低"拉花合规"话术阻力；红队 A3 口径不变——政策红利非订单，不替代访谈验证） |

补充价格锚点（非痛点，记入试单定价参考）：全车改色贴膜约 3000–8000 元（国产膜，来源 P20 同文）；PET 改色膜 3000–5000 元、TPU 8000–15000 元（来源为改色店软文 https://k.sina.cn/article_7879776516_1d5abd90406801cvpk.html ，引用打折）。拉花局部施工成本应显著低于全车改色——试单报价单可做"透明分项"对比。

### 2026-10-22（第三轮：全社媒拉花雷达首轮，共 13 条）

> 采集说明：mxgarage-decal-social-radar 首轮（用户 2026-10-22 手动触发，goal:mxgarage）。英文 social.search（IG/FB）命中率高，中文 social.search 全是噪音（"起泡"匹配到水泡/烫伤医疗帖，已弃用）。抖音/小红书站内被登录墙/反爬挡住，搜索引擎只能索引到商家软文（不收）；X 无直接抓取，经 Jalopnik 媒体转述拿到车主 X 原声；微信朋友圈为私域盲区，公众号/视频号本轮无相关索引结果；Bilibili 本轮未直接打开站内搜索（待下轮验证免登录部分）。本轮只收拉花/车贴/改色直接相关痛点，通用房车痛点不收。

| # | 平台 | 原帖 | 痛点摘要 | 相关性 |
|---|------|------|----------|--------|
| P25 | Facebook | https://www.facebook.com/strawberri.mcgary.5/posts/pfbid02X4WdKYtHqptE3TbL7v3nipd63s7YjKE15BLSLvc9NovcNojsSmpQSQdTqCVqfTLhl | 【用户原声】车主发帖：拉花贴两周就起边脱落，怪施工方手艺差，宣布改回喷漆；评论区多人共鸣"wrap 不如 paint"——施工翻车→信任崩塌→转向喷漆 | 高 |
| P26 | Facebook 群组（Roadtrek 房车社群） | https://www.facebook.com/groups/roadtrekincofficial/permalink/10165822616906983/ | 【用户原声】半退休房车车主 Bob Uppington：2000 年款 Dodge 190V 房车漆面/清漆大面积剥落，喷漆报价太高，问社区"拉花/贴膜能不能省钱"——房车漆面翻新预算焦虑 | 高 |
| P27 | Instagram | https://www.instagram.com/reel/DZS4JhvJYTc/ （@ecowashhawaii，620 赞） | 【用户原声】汽车美容师实拍：碳纤维纹拉花贴警车车顶一年后撕下，编织纹永久压进原漆——廉价膜撕除伤漆新证据 | 高 |
| P28 | Instagram | https://www.instagram.com/reel/DeBIcaRvUNE/ （@jmeteo，110 赞） | 【用户原声】车主实拍：黑色 Nissan SUV 拉花贴 4 年后撕下，原漆出现白斑与划痕——打破"拉花保护漆"预期 | 高 |
| P29 | Facebook 群组（Vinyl Wrap 施工群） | https://www.facebook.com/groups/1393090294262754/permalink/4258918014346620/ | 【用户原声】DIY 玩家 Bryan Xavier：Bronco DIY 贴膜，门把手/后视镜处持续起小圆泡——DIY 施工翻车，曲面/包角部位是重灾区 | 高 |
| P30 | Instagram | https://www.instagram.com/reel/Da-3GOWMfCp/ （@thatmidtaco） | 【用户原声】车主投诉：vvivid 拉花膜大面积褪色发白、起白点——膜材褪色一手证据（单一品牌投诉，普适性打折） | 中 |
| P31 | Instagram | https://www.instagram.com/reel/DZWYCBWyRCs/ （@americandreamhoney） | 【用户原声】车主：粉色 Tesla Model Y 拉花 4 年（超常规 2–3 年寿命），沙漠暴晒屋顶边缘膜烧脆——超年限+暴晒=边缘焦脆；房车长期户外暴晒同理 | 中 |
| P32 | Facebook 群组（Hummer 社群） | https://www.facebook.com/groups/hummernetwork/permalink/1944113013144174/ | 【用户原声】车主 Bruce Olson：原漆好不愿喷漆（怕贬值）才想拉花；评论警告撕膜会带掉旧漆——保值两难一手口径（呼应 P23） | 中 |
| P33 | Facebook 群组（Vinyl Wrap 施工群） | https://www.facebook.com/groups/1393090294262754/permalink/4465841350320951/ | 【施工方一手口径】资深施工师 Dean Howell：撕膜带掉老车漆被客户追责，客户事前口头同意、事后反悔——施工纠纷责任归属（呼应 P19） | 中 |
| P34 | 房车论坛 irv2 | https://www.irv2.com/threads/my-solution-for-diamond-shield-blistering-paint.1780413/ | 【用户原声】房车车主：房车 Diamond Shield 漆面起泡病，用拉花膜遮盖修复（打磨+IPA 擦拭+3M/Avery 膜）——拉花作为"房车漆面病翻新"手段的隐藏需求 | 高 |
| P35 | 行业论坛 signs101（2026-10-21 更新） | https://www.signs101.com/threads/vinyl-attacks-paint.184290/ | 【施工方一手口径】贴膜撕下时把后喷漆直接带掉；增塑剂迁移致漆面发软成橡皮——原厂漆 vs 后喷漆是施工红线，"不给后喷漆面做质保"成行业行规 | 高 |
| P36 | 媒体转述（Jalopnik，援引车主 X 账号 @aaronjcash） | https://www.jalopnik.com/wraps-and-stickers-are-permanently-damaging-tesla-cyber-1851696035/ | 【媒体转述车主原声】Cybertruck 贴商业字 8 个月撕下，字样"蚀刻"进不锈钢车身，多种清洁剂去不掉——撕除留痕/不可逆风险 | 中 |
| P37 | TikTok（商家施工记录） | https://www.tiktok.com/@vinyldestinationgraphic/video/7621653657473469718 | 【商家施工记录】经典 Volvo 上盖开贴即失败：引擎盖不知何时补过漆，膜直接带掉漆面，只能打磨重贴——漆面病史不明是施工翻车前因（引用打折，商家账号） | 中 |

### 待下次采集补充

- 抖音/小红书站内直采（两轮 pilot 均主要覆盖被搜索引擎索引的内容，站内原生帖需 browser 免登录打开验证，或用户转发人工入库）。
- 二手车商对"拉花/改色"的一手态度（P23 仍为媒体二手口径）。
- 上汽大通 V80 / 宿营车垂直社群的拉花案例与纠纷帖。

### 2026-10-24（第四轮：全社媒拉花雷达第二轮，共 8 条）

> 采集说明：mxgarage-decal-social-radar 2026-10-24（周六）轮。Facebook 兴趣群特关首次用 facebook-cli 真实执行：搜出 5 个拉花/美容相关群（Vehicle Wrap Design 2.2 万、Wrap & Print Collective 1 万、Metro Restyling Vinyl Wraps Community 5 千、Car Wrapping 3.8 万、Commercial Wrap Design Masterminds 2 千），但群帖检索均返回空——details 显示这些群均为"非公开小组"（帖子仅成员可见），账号非成员故读不到帖子，已按口径如实标注，未申请加群。群线索清单新增上述 5 群。Facebook 痛点仍靠 social.search 公开索引补足（拿到 1 个 FB 公开群组原声帖 + 多个 FB/IG reels）。X 站内无直接索引结果，仅经 Torque News 媒体转述拿到 Cybertruck 车主 FB 群组原声（X 个人账号原文未直接抓到）；微信朋友圈仍为私域盲区，公众号/视频号本轮无拉花相关索引；抖音/小红书站内仍被登录墙/反爬挡住，中文搜索引擎本轮只返回商家软文（凹陷修复、贴膜店广告），未入库。YouTube 本轮拿到施工方视角的翻车归因视频（不计用户原声）。本轮 8 条全部去重，无 URL 与 P1–P37 重复（IG @jmeteo 2026-10-03 帖与 P28 同 URL，已剔除；P25 同作者新帖与 P25 同 URL，已剔除）。

| # | 平台 | 原帖 | 痛点摘要 | 相关性 |
|---|------|------|----------|--------|
| P38 | Threads | https://www.threads.com/@sol_jia_built_it/post/Dekr0zcEeUk （2026-10-16） | 【用户原声】车主自嘲：拉花贴了几个月就开始起皮/脱落，称"epic fail"——短命脱落又添一例（呼应 P25 的"两周起边"） | 高 |
| P39 | Instagram | https://www.instagram.com/reel/De1o7V0SuIp/ （2026-10-23） | 【用户原声】车主实拍：撕下拉花时连清漆一起带掉，侧裙两侧、前杠、尾盖全部中招——撕除带漆发生在原厂漆车辆上（呼应 P27/P28/P35） | 高 |
| P40 | Facebook 公开群组（Frisco Hills，本地社区群，4000 成员） | https://www.facebook.com/groups/1084112748292863/permalink/28406307632313339/ （2026-09-22） | 【用户原声】车主：2026 款宝马 X5 贴膜仅 11 个月撕下，前杠/格栅/引擎盖边缘/车顶/轮拱/大灯遍布残胶+鬼影+漆面划痕，发帖问"能不能修复" | 高 |
| P41 | Instagram（钣喷店职业账号） | https://www.instagram.com/p/Dd4poOlkidF/ （2026-09-29） | 【施工方一手口径】钣金喷漆店公开警告：3000 美元拉花贴超年限撕不掉，撕后留渍+开裂，最后要花 1–1.5 万美元重做漆——"wrap 总拥有成本"陷阱 | 高 |
| P42 | Facebook | https://www.facebook.com/reel/1737341477156334/ （2026-07-09） | 【用户原声】户外博主 Keith Warren：Tundra 拉花贴太久才撕，赞助商字样"ARLINGTON, TX"鬼影永久蚀刻进漆面——超年限留痕（呼应 P36 的 Cybertruck 蚀刻） | 中 |
| P43 | Facebook | https://www.facebook.com/reel/1819985382474407/ （2026-10-12） | 【用户原声】车主 DIY 给 Corvette Z06 贴拉花，施工翻车造成车身多处损伤——DIY 门槛又一实证（呼应 P29） | 中 |
| P44 | Facebook 群组（Vinyl Wrap 施工群 1393090294262754，已追踪） | https://www.facebook.com/groups/1393090294262754/permalink/4512068269031592/ （2026-09-07） | 【用户原声】车主撕膜记录：红色轿跑拉花开裂/翘起，露出底漆+残胶，后窗周围漆面损伤 | 高 |
| P45 | 媒体转述（Torque News，援引车主 Facebook 群组原声；该车主同时在个人 X 账号发布，X 原文未直接抓到） | https://www.torquenews.com/1/no-happy-took-my-cybertruck-recall-and-now-i-have-bi-color-truck | 【媒体转述车主原声】Cybertruck 车主：召回换件后拉花被切成两截成"阴阳车"，贴膜店在 3 小时车程外、配不到同色，考虑全撕——维修/召回让拉花变成维护负债 | 中 |
