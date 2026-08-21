# Changelog

## 0.2.0 - 2026-08-21

### Added

- 增加 Token 用量概览，支持今日、最近 7 天和最近 30 天范围。
- 增加费用趋势图、计价覆盖率、请求数和主要模型摘要。
- 多模型趋势按模型分段着色并显示图例，统一图表尺寸并降低日期轴密度。

### Fixed

- 统一直接进入和浮窗进入 Token 计费页时的导航状态，并恢复费用树和趋势内容。
- 修复会话与费用树入口错误回到会话详情的问题。
- 余额刷新失败时保留最近一次可用结果并展示明确状态。

## 0.2.1 - 2026-08-21

### Added

- 更新 DeepSeek 官方价格快照至 `deepseek-official-pricing-2026-08-21`，新增 `deepseek-v4-flash-vision-exp` 峰谷计费；图片由 DeepSeek 换算成输入 Token 后与文本一并计费。
- 发布包统一命名为 `@mymeter/dsh-cost-meter`，新增 dsh invariant、声明文件、tarball 消费者检查与 CI 发布门禁。
- JSON 文件账本恢复现在会报告隔离位置，跳过并隔离损坏事件，并合并同一进程中指向相同路径的多个 repository 写入。
- 新增 `ledgerFormat: append` 显式 opt-in；默认仍为 `json`，JSON 到 append 会生成 `<ledgerPath>.legacy.json`，append 切回 JSON 会安全导出 schema-v1 JSON。
- append adapter 检测到 stale writer 时会拒绝提交并要求重开；同一 `ledgerPath` 仍只允许一个 dsh 进程写入。
- DeepSeek 余额错误不再透传厂商响应正文，汇率查询增加固定超时和第三方数据边界说明。
- 将模型价格版本、官方来源、别名和费率表拆分到 `@mymeter/core/pricing/` 的厂商目录，并保留 `@mymeter/core/pricing` 兼容入口。
- 根据 dsh/pi-ai provider catalog 新增 OpenAI、Anthropic、Google Gemini、Moonshot/Kimi、MiniMax、Mistral、Groq、Together、Fireworks 和 Cerebras 的版本化价格快照；统一将美元价格按快照汇率换算到 CNY 账本。
- 新增 xAI/Grok 官方价格快照，覆盖 Grok 4.6、4.5、4.3、4.20 与 Grok Build/Code Fast；xAI 不显示峰谷时段，美元费率按版本化汇率换算到 CNY 账本。
- Grok 计费段现在显示实际输入、缓存和输出费率、价格版本及计价汇率。
- Code Plan、订阅、代理和 gateway route 统一按底层模型对应厂商的 API 价格估算；新增 Kimi Code、OpenAI Codex、Moonshot/MiniMax 中国站、Vertex 和 Azure OpenAI route alias，并支持按唯一模型归属回退。
- 新增缓存命中节省、预算阈值和 DeepSeek 峰谷倒计时洞察；Client 在全局和会话详情中展示预算/倒计时，会话详情在单价明确时展示缓存节省。
- 新增子 Agent 费用树、费用趋势/异常报告和 CSV/JSON 安全导出，并通过 Host Remote/Typert `getSessionCostTree`、`getCostAnalytics`、`exportLedger` 按需暴露。
- 新增远程价格更新库级安全核心和 Host 下载流程：签名 manifest、trusted key 校验、UTC 时间戳规范、版本策略、HTTPS/大小限制、catalog SHA-256 校验和 activate/rollback seam；生产插件尚未调用该路径，默认不自动联网，production activation adapter 仍未接入。

### Fixed

- 生产 bundle 不再挂载测试专用 invariant，避免普通 dsh Web profile 因缺少 `invariants` 服务而停留在 pending 状态。
- `settings.plugin.item` 现在按 dsh keyed slot 契约提供 `key: mymeter`，Host 同时注册对应 settings namespace，避免 Web Client 插件激活失败。
- 历史会话启动回放改为按 session 批量提交，并跳过账本中未变化的已结算事件，避免反复同步重写完整账本拖死 HTTP 和 WebSocket 事件循环。
- 生产 bundle 不再引用未随发布包分发的 sourcemap。
- Grok 请求不再套用 DeepSeek 价格版本或高峰/空闲时段，也不再对已支持的 Grok 模型显示空费率。
- 远程价格 manifest 验证会跳过不受信任或 malformed 的无效签名候选，允许后续可信签名继续验证；无时区或非 UTC ISO 的时间戳会被拒绝。

## 0.1.0 - 2026-08-17

已发布到 npm registry：[`@mymeter/dsh-cost-meter@0.1.0`](https://www.npmjs.com/package/@mymeter/dsh-cost-meter/v/0.1.0)。

### Added

- 初始 dsh-cost-meter 插件基础版，包名为 `@mymeter/dsh-cost-meter`。
- DeepSeek V4 Flash / V4 Pro 峰谷计费快照，版本为 `deepseek-official-pricing-2026-08-17`。
- 缓存命中、缓存未命中、输出三类 Token 费用分桶，以及推理 Token 已包含于输出费用的展示口径。
- 流式估算、最终 usage 结算、同一 attempt 去重和本地账本重启恢复。
- 插件启动时自动扫描并回放未加载的持久化历史会话，优先使用 `sessionQuery`，并支持 `sessionPersistence` 只读降级。
- dsh Cordis Host 适配、Typert Remote、Client `shell.overlay` 漂浮层和卸载清理。
- 当前请求、当前会话、全局会话列表、会话详情、设置和位置持久化。
- dsh“插件配置”中的 dsh-cost-meter 配置卡，与悬浮窗共享浏览器显示偏好。
- 浏览器显示偏好支持同页多挂载实例实时同步；本地存储不可用时仍立即更新当前界面。
- 计费浮窗和 Token 计费页直接使用 dsh 的 `--dsw-alias-*` 全局主题变量，不提供插件独立主题系统或主题选择。
- 计费浮窗统一显示会话 Token 数、缓存命中/未命中/输出分项费用、推理 Token 包含口径、总 Token 与当前高峰/空闲计费时段。
- Token 分桶使用更直观的展示名称：输入 Token(无缓存)、输入 Token(缓存)、输出 Token；底层计费字段保持兼容。
- 明细较长时悬浮窗保持在可视区域内，标题栏固定，内容区可滚动查看完整计费数据。
- 会话中切换模型、推理强度、Agent 预设、峰谷时段或价格版本时，按连续请求切分计费阶段，并通过横向 Tab 查看各阶段 Token、费用、请求与上下文。
- 请求元数据在请求开始及重试开始时冻结，避免执行中切换配置污染旧请求的计费归属。
- 兼容 dsh 的 `step/start -> request/header -> usage` 真实事件顺序：请求头可在首个 usage 前补全模型和推理强度，修复真实运行时一直显示“费用未知”、折叠态不吐小票的问题。
- assistant 消息携带模型来源时会回填缺失的请求元数据；该阶段曾把取消或缺少最终 usage 的请求显示为“费用待核算”，后续已统一为“估算/费用估算/未知”口径。
- 模型请求开始后即通过非持久化运行态显示“计费中”和动态小票；流式文本、推理和工具参数增量会先按 UTF-8 字节数生成临时 Token/费用估算，最终 usage 到达后再校正为准确账单。
- 折叠态小票在请求结算后继续保留，结束时停止出票动画并展示静态最终轮次与会话合计。
- 小票和会话详情按 dsh `turnId` 聚合轮次；同一轮内的多个模型 step/重试仍逐请求计费，但 Token 与费用合并到同一轮展示，不再把模型请求数误报为对话轮数。
- Client Remote 轮询缩短到 200ms，使流式估算能在浮窗中准实时变化，并降低短模型步骤被整段错过的概率。
- Active 小票在该阶段只对 DeepSeek 计价模型启用，后续已扩展为所有能解析到已登记价格目录的 provider/model；重试前已有 usage 投影时会先把旧 attempt 收口为失败费用，避免估算金额残留或重复累计。
- 会话总费用固定在阶段 Tab 外；失败请求金额计入阶段总额但不计入已结算金额，历史阶段无可靠上下文快照时明确提示不可用。
- 阶段 Tab 支持方向键、Home/End 键盘导航及移动端横向触摸滚动；悬浮窗拖拽手势限制在标题栏。
- Cordis 失败/中止 turn 会使用最后一份可靠 usage 投影收口计费；没有 usage 的中止请求当时显示“费用待核算”，当前已由“估算/费用估算/未知”口径取代，仍不会误报为已知 `¥0.000`。
- 阶段时间使用本地时区并显示到秒；历史阶段以本阶段最后一次请求活动收口，不再把两阶段之间的空闲时段计入阶段时间。
- 失败或中止请求以流式估算收口时保留真实完成时间，确保费用事件、轮次结束时间和阶段最后活动时间一致。
- Host-only DeepSeek 余额客户端、dsh credentials/settings 接线、缓存、密钥轮换与 stale/unavailable 状态测试。
- Token 计费页按 dsh 活动模型厂商分别列出账户余额；DeepSeek 显示余额，未接入余额适配的厂商显示“暂不支持显示余额”。
- DeepSeek CNY/USD 余额低于 5 个货币单位时显示充值提醒并跳转官方充值页。
- 高频 projection 与 20,000 条费用事件的大账本性能回归测试。
- 安装、配置、隐私、价格版本与已知限制文档。

### Verified

- `npm run typecheck` 通过。
- `npm test`、`npm run typecheck`、`npm run build` 和 `npm run verify:package` 纳入发布门禁。
- 构建生成 Host、Client、Remote、invariant 和自包含声明文件；发布包不包含源码与 sourcemap。
- 已在隔离 dsh profile 中验证安装、Web 启动、`remote.mymeter` 空闲快照、真实 `shell.overlay`、插件配置卡、卸载后页面 contribution 清理和重装。

### Known Limitations

- 余额链路尚未使用真实 DeepSeek 账户完成数值对账。
- 尚未用真实 DeepSeek 请求完成 production usage 与金额对账。
- dsh-cost-meter 是本地估算和账本工具，不是 DeepSeek 官方账单。
- 暂不支持未登记 gateway/云账户 route 的价格目录；远程价格更新默认不联网且缺少生产 activation adapter。
