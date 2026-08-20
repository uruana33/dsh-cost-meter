# dsh-cost-meter FAQ

## dsh-cost-meter 是官方账单吗？

不是。dsh-cost-meter 是本机 dsh 插件，按本地观察到的 usage 和内置价格快照估算/记录费用。官方账单、发票、订阅扣费和充值余额仍以厂商控制台为准。

## “当前请求估算”和“已结算”有什么区别？

生成中先显示估算；收到最终 `assistant/message.usage` 后，用 provider 返回的最终 Token 分桶重算并替换同一次请求。已结算表示本地已按最终 usage 和本地价格目录锁定，不表示厂商已经出账。

## 为什么没有看到“待核算”？

当前实现没有独立的“待核算”状态。缺少最终 usage 时显示估算；无法匹配模型价格或没有可靠计费数据时显示费用估算、不可用或未知次数，不用 `¥0.000` 冒充已知结果。

## 为什么流式金额一开始只有输出费用？

无 usage 的流式 chunk 只能从文本、reasoning、tool-call 增量推算输出 Token，不能知道输入缓存命中、缓存未命中或缓存写入。最终 usage 到达后，这些输入分桶才会补齐。

## 推理 Token 会重复收费吗？

不会。`reasoningTokens` 作为输出 Token 的子集展示，金额计入输出桶，不再单独加一笔。

## 缓存写入 Token 怎么显示？

如果 provider 返回 `cacheWriteTokens`，有独立 cache write 单价的目录按独立单价计算；没有独立单价时按缓存未命中单价计算。界面把它并入“输入 Token(无缓存)”桶。

## DeepSeek 峰谷价按什么时候算？

按请求开始时的北京时间锁定。`09:00-12:00`、`14:00-18:00` 是高峰，其余为空闲；请求跨越边界也不会拆成两段。

## xAI、OpenAI、Anthropic 等也有峰谷价吗？

当前没有。除 DeepSeek 外，已登记的海外厂商按 USD API 价格目录估算，`pricingZone` 显示为 `unknown`。xAI 会按 200K 输入上下文阈值切换长上下文价；其他目录如有 tier，则按本地快照里的阈值计算。

## 为什么同一个页面同时显示 ¥ 和 $？

DeepSeek 原币种是 CNY，海外厂商原币种是 USD。dsh-cost-meter 保留原币种并分别汇总；需要人民币折算时，手动点“查询最新汇率”。折算只影响展示，不改写账本。

## 固定的 `1 USD = ¥7.20` 是什么？

这是 USD 价格目录写入本地 micro-CNY 兼容金额时使用的版本化换算快照，便于旧汇总字段保持可加。它不是实时汇率；实时折算需手动查询 Frankfurter ECB 汇率。

## OpenAI Codex、Kimi Coding、Code Plan 的金额准吗？

它们是 API 等价估算，不是套餐实际扣费。dsh-cost-meter 会把 `openai-codex` 映射到 OpenAI API 价目表，把 `kimi-coding` 映射到 Moonshot/Kimi API 价目表；订阅额度、代理商折扣、区域价和平台加价不会被还原。

## 自定义 route 能计费吗？

如果模型 ID 能唯一命中一个已登记厂商目录，就能按该厂商 API 价格估算，例如 `grok-4.6` 使用 xAI，`gpt-5.6-sol` 使用 OpenAI。无法唯一归属或本地没有价格表时，会显示未知/不可用。

## 为什么某个模型显示未知或不可用？

通常是模型 ID 不在内置价格目录、同名模型可归属多个目录但 route 不能消歧，或 usage 数据无效。处理方式是升级到包含该模型价格快照的插件版本，或先以厂商控制台为准。

## 失败或中止请求会计费吗？

有最终 usage 时，dsh-cost-meter 按可用 usage 计算并标记失败/中止，不计入已结算金额；只有流式估算时保留估算并标记失败；完全没有 Token 时通常只留下零 Token 的失败/未知状态。厂商是否实际扣费以厂商账单为准。

## 历史会话会自动补账吗？

会。插件启动后会回放持久化会话：列历史时优先使用可提供 revision 的 `sessionPersistence.listSnapshots()`，不可用时降级到 `sessionQuery.listSessions()` 和 `sessionPersistence.list()`；实际读取变化会话时仍优先用 `sessionQuery.readSession()`，失败或不可用时再用 `sessionPersistence.inspect()`。配置 durable `ledgerPath` 时会保存 `<ledgerPath>.recovery.json` checkpoint，用 revision 跳过未变化会话；checkpoint 损坏、schema/source/projection/账本 content fingerprint 不匹配时会退回完整回放。最终 usage 可补算，只有历史流式内容时只能按输出字节估算。

## 重启后会重复计费吗？

同一请求使用 `(sessionId, turnId, stepId, attemptId)` 去重，最终 usage 会替换同 attempt 的估算。文件账本启动时也会恢复、去重和聚合；不同 dsh 进程不应同时写同一个 `ledgerPath`。

## 本地累计为什么和厂商控制台不同？

本地累计只包括本机 dsh-cost-meter 看见的 dsh 事件。厂商控制台还可能包含其他 Key、机器、团队成员、非 dsh 请求、税费、免费额度、订阅池、代理商加价和厂商自己的舍入规则。

## DeepSeek 余额怎么读取？

Host 侧读取 `llm-deepseek` 配置的 credential 引用，默认回退到 `DEEPSEEK_API_KEY`，请求 `/user/balance`，默认缓存 5 分钟。余额请求默认 10 秒超时，并发请求会合并，失败会短暂退避；用量页的“刷新余额”会强制绕过 TTL。API Key 不会进入 Client DTO、浏览器状态或日志。

## 为什么其他厂商没有余额？

当前生产接线只支持 DeepSeek 官方余额。其他 provider 即使能估算 Token 费用，也未必有公开余额 API，或需要账户级管理权限；余额区域不会展示这些 provider，也不会复用 DeepSeek 余额。

## 汇率查询会上传我的对话或账本吗？

不会。Host 只向 Frankfurter 请求 USD/CNY 汇率，不带会话、账本、prompt、completion、工具参数或 API Key。

## dsh-cost-meter 会保存对话内容吗？

不会。Host 不保存或下发 prompt、completion、工具参数或消息正文。流式估算只在内存中读取增量内容并立即归约为 UTF-8 字节数；账本保存的是费用事件、模型、Token 分桶、状态、价格版本和金额。

## 如何让历史累计跨重启保留？

正常安装发布包时，patch 已把 Host 的 `ledgerPath` 设为 `$DSH_HOME/mymeter/ledger.json`。自定义组合如果直接调用 Host，需要显式配置 `ledgerPath`；省略时使用内存账本，重启后不会保留累计。

## `json` 和 `append` 账本该选哪个？

默认使用 `json`，兼容性和回滚路径最直接。历史会话较多、全量 JSON 写放大明显时，可显式配置 `ledgerFormat: append`；append 使用 generation snapshot/log 和增量提交，检测到 stale writer 会拒绝写入。从 JSON 切入会保留 `.legacy.json`，切回 JSON 会先安全导出 schema-v1 文件。两种格式都只允许一个 dsh 进程写同一 `ledgerPath`，完整配置和文件组见[安装与使用](getting-started.md)。

## 为什么费用树和趋势/异常不是每次刷新都返回？

Client 默认每 200ms 轮询轻量主快照。费用树、用量概览和 analytics 需要扫描或聚合更多账本数据，所以通过 `getSessionCostTree()`、`getUsageOverview()` 和 `getCostAnalytics()` 按需加载，避免把大对象塞进每次轮询。用量概览提供今日/7 天/30 天切换，今日按小时、其他范围按自然日；未知价格显示 `—`，coverage 会明确标记完整、部分计价或不可用。费用树会报告孤儿父节点和循环关系；异常报告当前覆盖日费用突增、小时集中、unknown 比例和 failed 比例，它们是本地提示，不是厂商审计结论。

## 导出的 CSV/JSON 会包含对话内容吗？

不会。`exportLedger(format)` 使用安全字段 allowlist，只导出事件/会话标识、请求元数据、Token、金额、状态、价格版本和币种等计费字段，不包含 prompt、completion、工具正文或 API Key。CSV 还会防护以 `=`、`+`、`-`、`@` 开头的公式注入值。

## 预算阈值会阻止模型请求吗？

不会。默认阈值是 `¥50`，只影响当前浏览器里的预算进度和 alerts；它不写入 Host 配置，也不会暂停、拒绝或修改 dsh/provider 请求。不同浏览器 profile 可以有不同阈值。

## dsh-cost-meter 的数据保存在哪里，怎样清除？

Host 账本位于配置的 `ledgerPath`，默认包配置是 `$DSH_HOME/mymeter/ledger.json`；浏览器显示偏好位于当前 dsh 站点的 `localStorage["mymeter.settings"]`。清除账本前先停止 dsh 并按需备份，然后删除账本及相邻隔离文件；显示偏好可在 dsh-cost-meter 设置中恢复默认，或清理该站点的本地存储。详细边界见[数据与隐私](privacy.md)。

## 可以关闭 dsh-cost-meter 的外部网络请求吗？

本地计费和账本不依赖 dsh-cost-meter 自己的第三方请求。设置 `balanceEnabled: false` 可关闭 DeepSeek 余额查询；不点击“查询最新汇率”就不会请求 Frankfurter；不点击“检查更新”或“更新插件”就不会触发 dsh-cost-meter 的 npm registry 检查或安装。npm 包已经发布，自更新可在满足 loopback 与 `file:` profile 条件时使用。模型请求本身由 dsh/provider 负责，不属于 dsh-cost-meter 的附加网络请求。

## 可以让多个 dsh 进程共用一个账本吗？

不可以。当前没有跨进程文件锁，多个 dsh 进程同时写同一 `ledgerPath` 可能互相覆盖或被拒绝。JSON adapter 的同进程多实例会在写入前合并磁盘事件；append adapter 检测到 stale writer 时会拒绝提交并要求重开。无论使用 `json` 还是 `append`，同一 `ledgerPath` 仍只允许一个 dsh 进程写入，不具备分布式数据库能力。

## 为什么不能直接从 Git 地址安装？

源码构建依赖本仓库的 npm workspaces；直接 Git 安装不能得到自包含的 Host、Client、Remote 和声明文件。推荐直接安装已发布的 `@mymeter/dsh-cost-meter`；如需验证源码改动，请在仓库中依次执行 `npm ci`、`npm run build`、`npm run pack:plugin`、`npm run verify:package`，再安装生成的 tarball。

## 运行环境有什么要求？

需要 Node.js `^22.19.0 || >=24.0.0`、可运行的 dsh Web profile，以及由 dsh Web 运行时提供的 React 18。完整步骤见[安装与使用](getting-started.md)。

## 金额很小时为什么显示 `<¥0.001` 或更多小数？

内部用 micro-unit 计算，主显示通常保留 3 位小数，明细可显示 6 位。小于主显示精度但大于 0 的金额会用 `<¥0.001` 这类形式提示不是零。

## 价格更新会自动生效吗？

不会远程热更新。价格目录随插件发布，版本号在 `packages/core/src/pricing/versions.ts`。仓库虽有签名 manifest 与安全下载的库级实现，但生产插件没有调用该路径；要使用新价格，需要升级包含新快照的插件版本。

## 我应该用哪个数字做预算？

看本地 dsh 消耗时，用“DSH 本地累计”和会话累计；看厂商实际扣费、订阅剩余额度或发票时，用厂商控制台。混合币种预算要先确认是否使用原币种还是手动汇率折算值。
