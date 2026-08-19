# 价格目录来源与覆盖范围

更新时间：2026-08-19

价格目录是随插件发布的版本化快照，不在每次请求时访问厂商官网。这样可以保证历史账单在价格调整后仍能重放。国内价格表保留 CNY，海外价格表保留 USD；价格版本不包含汇率。混合币种的人民币折算由单独的 USD/CNY 汇率快照提供，用户触发“查询最新汇率”后才更新展示值。费率以本地快照为准，官网仅用于人工复核和更新，不构成运行时价格数据源。

## dsh 厂商来源

dsh 的 `llm-pi-ai` 使用 `@earendil-works/pi-ai` 的内置 provider/model catalog。当前 provider id 清单来自同级仓库：

- dsh 上游仓库中的 `packages/llm/llm-pi-ai/src/catalog.ts`
- `getBuiltinProviders()` 返回的清单当前口径对齐到 `packages/core/src/pricing/catalog.ts` 的 `DSH_PROVIDER_IDS`；这是版本化静态快照，不是运行时自动同步。
- `deepseek-official` 是 dsh 原生 `llm-deepseek` 路由，不属于 `llm-pi-ai` 的内置 provider 清单；价格解析仍通过 DeepSeek 目录单独接入。

配置中声明的自定义 route 仍可能超出这份内置清单。当前产品口径是统一展示底层模型的厂商 API 等价费用：route 没有独立价格表时，如果模型 ID 能唯一命中一个已登记厂商目录，就使用该厂商 API 快照；无法唯一归属时保持 `-`。

## 已接入价格目录

下表对应 `packages/core/src/pricing/` 中的独立厂商文件；所有版本号集中登记在 `packages/core/src/pricing/versions.ts`。费率数字来自随插件发布的本地价格快照，厂商官方价格页面仅作为人工复核和后续更新入口。

| provider | 价格表文件 | 官方来源 |
| --- | --- | --- |
| `deepseek` | `deepseek.ts` | [DeepSeek Pricing](https://api-docs.deepseek.com/zh-cn/quick_start/pricing/) |
| `xai` | `xai.ts` | [xAI Pricing](https://docs.x.ai/developers/pricing) |
| `openai` | `openai.ts` | [OpenAI Pricing](https://developers.openai.com/api/docs/pricing) |
| `anthropic` | `anthropic.ts` | [Anthropic Pricing](https://platform.claude.com/docs/en/about-claude/pricing) |
| `google` | `google.ts` | [Gemini API Pricing](https://ai.google.dev/gemini-api/docs/pricing) |
| `moonshotai` | `moonshotai.ts` | [Moonshot Pricing](https://platform.kimi.ai/docs/pricing/chat) |
| `minimax` | `minimax.ts` | [MiniMax Pricing](https://platform.minimax.io/docs/guides/pricing-paygo) |
| `mistral` | `mistral.ts` | [Mistral Pricing](https://docs.mistral.ai/inference/pricing) |
| `groq` | `groq.ts` | [Groq Models and Pricing](https://console.groq.com/docs/models) |
| `together` | `together.ts` | [Together Pricing](https://www.together.ai/pricing) |
| `fireworks` | `fireworks.ts` | [Fireworks Pricing](https://docs.fireworks.ai/serverless/pricing) |
| `cerebras` | `cerebras.ts` | [Cerebras Pricing](https://inference-docs.cerebras.ai/support/pricing.md) |

## Route 的 API 等价估算

Code Plan、订阅、代理、云平台和 gateway 的实际账单可能包含套餐、额度、区域或平台加价。dsh-cost-meter 不把这些 route 的实际结算规则当作 Token 单价，而是按以下规则生成可比较的厂商 API 等价费用：

- 明确 route alias：`kimi-coding -> moonshotai`、`openai-codex -> openai`、`moonshotai-cn -> moonshotai`、`minimax-cn -> minimax`、`google-vertex -> google`、`azure-openai-responses -> openai`。
- 模型 alias：`k3`、`k3-256k -> kimi-k3`；其他模型继续使用各厂商目录内登记的 alias。
- 自定义或未登记 route：模型 ID 仅在唯一命中一个已登记厂商目录时回退，例如 `grok-4.6 -> xai`、`gpt-5.6-sol -> openai`。
- `qwen-token-plan*`、`zai*`、`xiaomi*` 等 route 如果模型尚未进入本地厂商价格表，仍保持不可用；后续需新增独立价格快照。

以上映射只改变费用估算口径，不改变余额适配，也不表示 route 的实际扣费等于厂商 API 账单。接入新厂商时，仍应新增独立文件、官方来源、版本化快照和计费测试，再加入 `ADDITIONAL_PRICING_CATALOGS`。
