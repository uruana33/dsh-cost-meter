# dsh-cost-meter

![Node.js](https://img.shields.io/badge/node-%5E22.19.0%20%7C%7C%20%3E%3D24.0.0-339933)
![Status](https://img.shields.io/badge/status-early%20preview-f59e0b)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

dsh-cost-meter 是面向 dsh / DeepSeek Harness 的多厂商 LLM Token 费用仪表插件。它把本机观察到的请求用量转换为可追溯的本地账本，并在 dsh Web profile 中提供实时小票、会话账单和用量分析。

> [!WARNING]
> 这是本地观测、估算和回放工具，不是 DeepSeek、OpenAI、Anthropic、xAI 或其他厂商的官方账单。流式阶段会先估算，收到 provider usage 后再校正；实际扣费、发票和账户余额请以厂商控制台为准。

## 当前版本

当前发布包为 [`@mymeter/dsh-cost-meter@0.2.1`](https://www.npmjs.com/package/@mymeter/dsh-cost-meter)。近期版本的重点是：

- 全局用量概览支持今日、最近 7 天和最近 30 天，显示费用、Token、请求数、计价覆盖率和主要模型。
- `Token计费` 页面统一会话、费用树和趋势/异常视图；趋势图按模型着色并提供范围切换，账本可导出为 JSON/CSV。
- DeepSeek 价格快照新增 `deepseek-v4-flash-vision-exp`，图片 Token 沿用 provider usage，并继续按北京时间峰谷价格计费。
- 账本默认使用 JSON；可显式选择 append 格式。余额刷新失败时保留最近一次可用结果并显示状态。

完整变更见 [CHANGELOG](CHANGELOG.md)，价格快照和覆盖范围见[价格目录文档](docs/pricing-catalog.md)。

## 快速开始

### 从 npm 安装（推荐）

```bash
dsh plugin --profile web add @mymeter/dsh-cost-meter
```

### 从源码验证或开发

```bash
npm ci
npm run build
npm run pack:plugin
npm run verify:package
dsh plugin --profile web add ./mymeter-dsh-cost-meter-0.2.1.tgz
```

重新加载对应的 dsh Web profile 后，打开一个会话即可使用。运行环境要求 Node.js `^22.19.0 || >=24.0.0`，以及启用 Web bundle 的 dsh profile。

完整安装、配置、更新、卸载和排错流程见[安装与使用](docs/getting-started.md)。

## 使用路径

### 运行中的请求

对话页右上角的 Token 小浮窗会显示当前请求的 Token 和费用。流式输出期间金额是临时估算；最终 `assistant/message.usage` 到达后，同一请求会被校正为已结算事件。小浮窗点击后可进入完整的 `Token计费` 页面。

### 会话账单

会话详情按阶段和轮次展示：

- 输入 Token（无缓存）、输入 Token（缓存）、输出 Token，以及包含在输出费用中的推理 Token；
- 当前请求、已结算金额、估算金额、失败/未知状态和模型价格版本；
- 预算阈值、缓存命中节省、DeepSeek 当前峰谷时段和下一次切换倒计时；
- 多币种原币金额。需要人民币折算时，可手动查询 USD/CNY 汇率，折算只影响展示，不改写账本。

### 全局会话与分析

全局 `Token计费` 页面使用统一的视图 Tab：

| 视图 | 内容 |
| --- | --- |
| 会话 | 搜索、排序、状态筛选和会话累计；可进入任意会话详情 |
| 费用树 | 按父子 Agent 展示自身费用、子树费用和异常关系 |
| 趋势/异常 | 今日/7 天/30 天用量概览、费用趋势、主要模型、计价覆盖率和本地异常提示 |

趋势范围为今日按小时、7 天或 30 天按自然日；多模型柱状图按模型着色并提供图例。分析和费用树通过按需 Remote 加载，不会塞进每次轻量快照。页面还可以下载安全字段 allowlist 内的 JSON/CSV 账本，不包含提示词、回复正文、工具内容或 API Key。

## 界面与演示

以下素材来自 dsh Web profile，余额、会话、Token 和金额均为模拟数据，不代表实际账户或厂商账单。

### Token 计费页

![Token 计费页：DeepSeek 会话费用与 Token 分桶](docs/assets/pic0.png)

没有可用 usage 或无法匹配价格时，页面会明确显示估算、未知或不可用状态，不会用 `¥0.000` 冒充精确费用。

![Token 计费页：不适用或待核对的计费状态](docs/assets/pic1.png)

### 对话页与 Token 小浮窗

![对话页中的 Token 计费小浮窗](docs/assets/pic2.png)

视频文件位于 `docs/assets`，可直接播放：

- [深色主题下的小浮窗基础交互（约 15 秒）](docs/assets/video1.mp4)
- [浅色主题下的小浮窗生成过程（约 23 秒）](docs/assets/video2.mp4)

## 计费与价格

### Token 口径

- 计费事件按 `(sessionId, turnId, stepId, attemptId)` 去重；最终 usage 会替换同一次请求的流式估算，而不是与估算相加。
- 推理 Token 是输出 Token 的子集，展示出来便于核对，但不会重复收费。
- 没有最终 usage 时，流式文本、推理和工具增量只能用于输出 Token 的临时估算；输入缓存分桶要等 provider usage 才能补齐。
- 订阅、Code Plan、代理、云平台和 gateway route 没有独立单价时，按能唯一识别的底层厂商 API 价格做等价估算，不代表套餐实际扣费。

### DeepSeek 官方快照

当前版本为 `deepseek-official-pricing-2026-08-21`，单价为每百万 Token 的人民币价格。高峰时段为北京时间 `09:00-12:00`、`14:00-18:00`，其余为闲时。

| 模型 | 高峰：命中 / 未命中 / 输出 | 闲时：命中 / 未命中 / 输出 |
| --- | --- | --- |
| `deepseek-v4-flash` | ¥0.10 / ¥3.00 / ¥9.00 | ¥0.05 / ¥1.50 / ¥4.50 |
| `deepseek-v4-flash-vision-exp` | ¥0.10 / ¥3.00 / ¥9.00 | ¥0.05 / ¥1.50 / ¥4.50 |
| `deepseek-v4-pro` | ¥0.30 / ¥9.00 / ¥27.00 | ¥0.15 / ¥4.50 / ¥13.50 |

视觉模型的图片由 DeepSeek 换算成输入 Token；本项目直接使用 provider 返回的 Token 用量，不在插件内重复估算图片 Token。

### 已登记厂商

价格目录包含 DeepSeek、xAI、OpenAI、Anthropic、Google Gemini、Moonshot/Kimi、MiniMax、Mistral、Groq、Together、Fireworks 和 Cerebras。海外目录保留 USD 原币，并使用版本化汇率生成兼容的人民币金额；实时汇率只在用户手动查询时用于展示折算。

route alias（例如 `openai-codex`、`kimi-coding`、`google-vertex`、`azure-openai-responses`）会映射到底层公开 API 目录。无法唯一归属或尚未登记价格的模型会显示未知/不可用，不会套用 DeepSeek 价格。

## 本地数据与边界

- 发布包默认将账本写入 `$DSH_HOME/mymeter/ledger.json`，格式默认为 `json`；可在 dsh profile 配置中显式使用 `ledgerFormat: append`。
- JSON 与 append 都只允许一个 dsh 进程写入同一个 `ledgerPath`。切换格式时会保留 legacy/恢复/隔离文件，备份或清理时应将相邻文件作为一组处理。
- API Key、账本文件和余额请求只在 Host 侧；Client/Remote 只接收脱敏 DTO。prompt、completion、消息正文和工具参数不会进入账本或导出文件。
- 当前生产余额 adapter 只支持 DeepSeek 官方 `/user/balance`；余额不可用不影响本地费用账本。
- 价格目录随插件发布，不会自动联网热更新。仓库中的签名清单、HTTPS 下载和 SHA-256 校验目前只是库级能力，生产插件尚未接线。

## 文档导航

- [安装与使用](docs/getting-started.md)：安装、首次验证、配置、凭据、更新、卸载、备份清理和排错。
- [计费口径](docs/billing.md)：估算与结算、Token 分桶、峰谷价格、币种和目录解析。
- [价格目录来源与覆盖范围](docs/pricing-catalog.md)：厂商价格快照、route alias 和未知模型处理。
- [数据与隐私](docs/privacy.md)：本地数据、凭据边界、网络请求、删除方式和自更新权限。
- [常见问题](docs/faq.md)：金额差异、余额、历史账本、账本格式和安装问题。
- [架构与实现](docs/architecture.md)：模块边界、事件流、账本、Remote 和构建发布。
- [CHANGELOG](CHANGELOG.md)：版本变更和验证记录。
- [English README](README_EN.md)：英文首页。

## 状态与限制

当前版本已通过插件构建、类型检查、测试、包校验、tarball 消费者检查，以及隔离 dsh profile 的安装/Web/卸载/重装验收。仍需注意：

- 尚未使用真实 DeepSeek API Key 完成生产 usage/金额对账，也尚未用真实账户核对余额数值。
- 全局分析和导出依赖当前 dsh 版本提供对应 Remote 能力；旧版本会显示不可用。
- 多宽度自动化视觉回归、完整键盘路径和无障碍回归仍需补齐。

## 社区与许可证

欢迎通过 issue 或 PR 补充厂商价格、余额 adapter、真实对账结果、视觉/无障碍回归和文档示例。提交价格或余额能力变更时，请附上官方来源、快照日期和测试覆盖。

- [贡献指南](CONTRIBUTING.md)
- [支持指南](SUPPORT.md)
- [安全策略](SECURITY.md)
- [社区行为准则](CODE_OF_CONDUCT.md)

dsh-cost-meter 采用 [MIT License](LICENSE) 发布。
