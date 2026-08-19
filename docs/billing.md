# dsh-cost-meter 计费口径

dsh-cost-meter 是 dsh 的本地费用观测和估算工具。它根据 dsh 事件里的模型、厂商、Token usage 或流式输出，按插件内置价格快照计算费用；它不是 DeepSeek、OpenAI、xAI 或任何代理商的官方账单，也不能替代厂商控制台、发票或订阅额度页面。

## 金额状态

dsh-cost-meter 同时使用“请求状态”和“金额口径”：

| 状态 | 含义 | 是否进入本地累计 |
| --- | --- | --- |
| 计费中 | Client 看到一个支持计价的 active request，或已有未完成的流式估算 | 按当前估算进入会话累计 |
| 估算 | 只有 projection、流式字节估算、缺少最终 usage，或使用保守/当前快照补算 | 进入 `estimated` 累计 |
| 已结算 | 收到最终 `assistant/message.usage`，usage 有效，且能匹配价格目录 | 进入 `settled` 累计 |
| 失败 | dsh 标记失败或中止，且有可用 usage 或流式估算 | 进入 `failed` 累计，不算已结算 |
| 费用估算/未知 | 无法匹配价格目录、模型无法唯一归属，或没有可用计费数据 | 保留未知次数，不用零元冒充 |

“待核算”不是当前实现里的独立状态。界面会把未最终结算的金额标为估算，或在没有可靠价格/Token 时显示不可用、费用估算或未知次数。

## 请求生命周期

1. dsh 进入 `step/start` 后，插件记录会话、turn、step、attempt，并在收到 `request/header`、`request/context` 或 assistant message source 后补齐 provider/model/reasoningEffort。
2. 流式阶段如果 chunk 自带 usage，就按 usage 生成 projection；如果没有 usage，但模型支持计价，就把文本、reasoning、tool-call 增量按 UTF-8 字节数估算输出 Token，当前规则是 `ceil(bytes / 4)`。
3. 收到最终 `assistant/message.usage` 后，以最终 usage 重新计算费用，并用 `(sessionId, turnId, stepId, attemptId)` 作为 event key 替换同一次请求的估算，避免重复计费。
4. 如果最终 message 没有 usage，已有估算会保留为估算；没有估算则可能是零 Token 估算、失败/中止记录或未知记录，取决于是否有可匹配价格和请求结果。

## Token 分桶

账本保存以下 Token 桶：

| 桶 | 来源字段 | 计费方式 |
| --- | --- | --- |
| 缓存命中 | `cacheReadTokens`、`cacheHitTokens`、`cachedTokens`、`prompt_tokens_details.cached_tokens` 等 | 使用缓存命中单价 |
| 缓存未命中 | `cacheMissTokens`；或把 dsh 的 `inputTokens` 当作无缓存输入；或用 `promptTokens - cacheHitTokens - cacheWriteTokens` 推导 | 使用输入未命中单价 |
| 缓存写入 | `cacheWriteTokens` | 有独立写入单价时使用独立单价，否则并入缓存未命中单价；展示在输入未命中桶里 |
| 输出 | `outputTokens`、`completionTokens` | 使用输出单价 |
| 其中推理 | `reasoningTokens` 或 `completion_tokens_details.reasoning_tokens` | 只作输出桶的子集展示，不重复计费 |

流式字节估算只能可靠估输出和其中推理，输入、缓存命中和缓存写入会等 provider usage 到达后补齐。

## 价格目录

价格快照位于 `packages/core/src/pricing/`，`catalog.ts` 负责多厂商注册和 route/model 归属，`versions.ts` 维护价格版本。当前已登记 DeepSeek、xAI、OpenAI、Anthropic、Google、Moonshot/Kimi、MiniMax、Mistral、Groq、Together、Fireworks 和 Cerebras。

DeepSeek 使用 CNY 价目表。海外厂商价目表保留 USD 原币种，同时保存一个按固定快照汇率 `1 USD = ¥7.20` 换算出的 micro-CNY 兼容金额，用于本地聚合和旧 DTO 兼容。价格版本本身不包含当天汇率。

每次计算会保存 provider、model、pricingZone、priceVersion、priceSource、Token 桶、原币种金额和 micro-CNY 兼容金额。已结算历史事件恢复时优先保留事件里保存的价格版本和金额；非已结算的 legacy/projection 事件会用当前内置目录重估。

## 峰谷价

DeepSeek 按请求开始时间判断北京时间计价时段：

- 高峰：`09:00-12:00`、`14:00-18:00`
- 空闲：其余时间

一次请求即使跨越峰谷边界，也按请求开始时间锁定整次请求费率。xAI 和其他海外目录当前不使用峰谷价，`pricingZone` 为 `unknown`；xAI 会在输入上下文达到 200K Token 时使用长上下文档位，其他目录按各自登记的 tier 阈值处理。

Client 还会基于同一套 DeepSeek 峰谷规则展示下一次费率段切换倒计时。倒计时只用于提示用户当前时段和下一时段，不会回写账本，也不会改变已经按请求开始时间锁定的费率。

## 预算、缓存节省和异常

预算阈值是浏览器显示偏好，默认值为 `¥50`，保存在 `mymeter.settings`。它只用于 Client 洞察和 alerts，不会阻止请求、不会写入 Host 配置，也不是厂商预算。全局预算按“DSH 本地累计”计算，会话预算按该会话的 settled + estimated 金额计算；混合币种场景以当前展示金额口径为准。

缓存节省金额只在会话详情中展示，条件是同一会话同时有缓存命中、缓存未命中、明确的同币种单价，且单价不是混合推断值。节省金额按“缓存命中 Token 如果也按未命中单价收费”的基线计算；缺少单价、混合币种或混合单价时显示不可用，不做猜测。

Host analytics 按日/小时生成趋势和异常报告，当前异常规则包括日费用突增、小时费用集中、unknown 比例偏高和 failed 比例偏高。unknown 事件只计次数，不把未知金额当成 0 元进入趋势总额。

## 导出

Host Remote 可按需导出账本 JSON 或 CSV。导出使用字段 allowlist，只包含事件标识、会话/父会话关系、请求元数据、状态、金额、Token 分桶、价格版本和币种字段；不导出 prompt、completion、工具正文或 API Key。CSV 字符串字段会对 `=`、`+`、`-`、`@` 开头的值加前缀，避免表格软件公式注入。

费用树与趋势/异常报告也已作为按需 Remote 接口提供，默认快照不携带这些大对象。

## Route 和订阅的 API 等价估算

Code Plan、订阅、代理、云平台和 gateway route 通常没有公开的独立 Token 单价。dsh-cost-meter 不声称能还原这些 route 的实际扣费，而是按“底层模型对应厂商 API 价格”做可比较估算：

- `azure-openai-responses`、`openai-codex` 映射到 OpenAI 目录。
- `google-vertex` 映射到 Google 目录。
- `kimi-coding` 映射到 Moonshot/Kimi 目录。
- `minimax-cn` 映射到 MiniMax 目录。
- `moonshotai-cn` 映射到 Moonshot/Kimi 目录。
- 自定义 route 如果模型 ID 只命中一个已登记厂商目录，也使用该厂商目录，例如 `grok-4.6` 命中 xAI，`gpt-5.6-sol` 命中 OpenAI。
- 已知 route 只用于同名模型存在多个目录时消歧；如果模型本身不在目录里，不会仅凭 route 生成价格。

这类金额是 API 等价估算，不代表订阅套餐、代理商、云账户或 gateway 的真实扣费，也不代表这些 route 支持余额读取。

## 币种和汇率

本地事件保留原币种。DeepSeek 为 CNY，海外厂商为 USD。界面会按原币种分别汇总；当同一会话或全局累计同时有 CNY 和 USD 时，用户可手动触发“查询最新汇率”获取 USD/CNY 折算显示。

汇率查询由 Host 请求 `https://api.frankfurter.app/latest?from=USD&to=CNY`，8 秒超时，不携带会话、账本、prompt 或凭据。查询到的汇率只影响展示中的人民币折算，不改写原币账本、价格版本或历史事件。

## 余额

当前生产接线只支持 DeepSeek 官方余额：Host 使用 `llm-deepseek` 的 credential 引用或 `DEEPSEEK_API_KEY`，请求 DeepSeek `/user/balance`，默认缓存 5 分钟。余额失败、凭据缺失或过期只影响余额显示，不影响本地费用账本。

dsh 已注册的其他厂商仍可参与 Token 费用估算，但不会在余额区域展示。dsh-cost-meter 不会把 DeepSeek 余额复用到 OpenRouter、OpenAI、Kimi Coding、xAI、Vercel AI Gateway 或其他 route。

## 远程价格更新

仓库提供远程价格更新的库级能力，包括签名验证、HTTPS 下载、catalog SHA-256 校验和 activate/rollback seam；但生产插件当前没有调用该路径，也没有官方 endpoint、trusted key、动态目录持久化 adapter 或后台调度。因此当前版本不会自动联网拉取价格，也不会热更新运行中目录。

## 历史回填

插件启动后会回放可读取的 dsh 持久化会话：

- 列历史时优先使用 `sessionPersistence.listSnapshots()`，因为它能提供 session `revision`；如果不可用或失败，再降级到 `sessionQuery.listSessions()`，最后使用 `sessionPersistence.list()`。
- 对确实需要读取的变化会话，内容读取仍优先使用 `sessionQuery.readSession()`；query 读取失败或不可用时，再降级到 `sessionPersistence.inspect()`。
- 回填按批次提交，默认 8 个会话或 5000 个事件一批，并在批次间让出事件循环。
- live 会话会被跳过，单个历史会话读取失败不会阻断其他会话。
- 重复回放依赖 event key 和 journal 去重，最终 usage 会替换同 attempt 的估算。

只有配置 durable `ledgerPath` 时才启用 checkpoint sidecar `<ledgerPath>.recovery.json`。checkpoint 保存 source/projection 版本、账本 content fingerprint 和 session revision；revision 未变化的 session 可在下次启动跳过。checkpoint 损坏、schema 不匹配、source/projection 版本不匹配或 ledger fingerprint 不匹配时，会退回完整历史回放。live 账本提交后，checkpoint 的 ledger fingerprint 会以 debounce 方式刷新，避免每次 live commit 都同步写 sidecar。

历史回填沿用当前价格目录：有最终 usage 的请求可补算为已结算；只有流式内容时只能按输出字节估算并保持估算。首次安装后回填出来的历史金额使用当前插件内置价格版本，不能用于替代厂商历史账单。

## 误差来源

dsh-cost-meter 金额可能与厂商账单不同，常见原因包括：

- 流式估算用 UTF-8 字节数近似输出 Token，最终 usage 到达前会偏差。
- provider 是否把 reasoning Token 计入 completion/output、是否返回 cache read/write 字段，取决于 provider usage。
- 订阅、Code Plan、代理、云平台和 gateway 可能有套餐额度、区域价、平台加价、折扣、税费或免费额度。
- 内置价格目录随插件发布，不会运行时抓取官网；价格更新、模型改名或厂商临时调整需要新版本快照。
- USD 目录的 micro-CNY 兼容金额使用固定 `¥7.20` 快照汇率；手动查询的最新汇率只用于展示折算。
- 小额金额按 micro-unit 计算后展示到 3 或 6 位小数，界面四舍五入可能与明细逐项相加的显示值略有差异。
- 本地账本范围只包括本机插件观察到的 dsh 事件；不会包含厂商控制台中的其他 API Key、其他机器、团队成员或非 dsh 消耗。
