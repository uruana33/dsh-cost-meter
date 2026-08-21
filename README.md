# dsh-cost-meter

![Node.js](https://img.shields.io/badge/node-%5E22.19.0%20%7C%7C%20%3E%3D24.0.0-339933)
![Status](https://img.shields.io/badge/status-early%20preview-f59e0b)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

dsh-cost-meter 是面向 dsh / DeepSeek Harness 的多厂商 LLM Token 费用仪表插件，把本机请求用量换算为可追溯的本地账本和实时计费视图。

> [!WARNING]
> dsh-cost-meter 是本地观测、估算和回放工具，不是 DeepSeek、OpenAI、Anthropic、xAI 或任何模型厂商的官方账单。价格快照随插件发布，流式阶段会先估算、再用 provider usage 校正；请以厂商控制台、发票和实际扣费为准。

## 界面与演示

以下截图展示 dsh Web profile 中的主要使用场景。示例中的余额、会话、Token 和金额均为模拟数据，不代表实际账户或厂商账单。

### Token 计费页

Token 计费页按会话展示余额、会话总费用、预算状态、缓存节省、模型价格版本，以及输入（无缓存）、输入（缓存）、输出和推理 Token 的分桶明细。

![Token 计费页：DeepSeek 会话费用与 Token 分桶](docs/assets/pic0.png)

当当前模型没有可用的 usage 数据或价格无法匹配时，页面会明确显示“不适用”或估算状态，而不是伪造精确费用。

![Token 计费页：不适用或待核对的计费状态](docs/assets/pic1.png)

### 对话页与 Token 小浮窗

对话页右上角的小浮窗用于快速查看当前请求的 Token 和费用；点击后可以回到完整的 Token 计费页查看会话与轮次明细。

![对话页中的 Token 计费小浮窗](docs/assets/pic2.png)

### Token 小浮窗视频

视频文件保存在仓库的 `docs/assets` 目录中。在 GitHub 页面中可直接点击链接播放；支持 HTML5 视频预览的客户端也会显示内嵌播放器。

<video controls preload="metadata" width="320" src="docs/assets/video1.mp4"></video>

[播放视频 1：深色主题下的 Token 小浮窗基础交互（约 15 秒）](docs/assets/video1.mp4)

<video controls preload="metadata" width="320" src="docs/assets/video2.mp4"></video>

[播放视频 2：浅色主题下的 Token 小浮窗生成过程（约 23 秒）](docs/assets/video2.mp4)

## 亮点

- 多厂商价格目录：已登记 DeepSeek、xAI、OpenAI、Anthropic、Google Gemini、Moonshot/Kimi、MiniMax、Mistral、Groq、Together、Fireworks 和 Cerebras 的版本化价格快照。
- Token 分桶计费：区分输入 Token（无缓存）、输入 Token（缓存）和输出 Token；推理 Token 明确标注为已包含在输出费用中。
- 实时小票和最终结算：生成中按流式增量估算，最终 `assistant/message.usage` 到达后替换为已结算事件。
- 会话级追踪：展示当前请求、当前会话、本机累计、会话列表、阶段 Tab、轮次明细、模型、推理强度、Agent 预设和价格版本。
- 成本洞察：会话页和全局页展示预算进度、DeepSeek 峰谷倒计时；会话级缓存命中节省在单价明确时展示。全局页提供费用、Token、请求数和 coverage 摘要，并支持今日/7 天/30 天的轻量趋势图与主要模型排行。
- 本地持久账本：发布包默认写入 `$DSH_HOME/mymeter/ledger.json`，账本格式默认是 `json`，重启可恢复聚合结果；可用 `ledgerFormat: append` 显式启用 append。
- 按需分析接口：Host Remote 提供费用树、用量概览、趋势/异常报告和 CSV/JSON 导出，默认快照不携带这些大对象。
- Host/Client 分离：API Key、账本和余额请求只在 Host 侧；Client 只接收脱敏展示 DTO。
- dsh 原生体验：注册 `shell.overlay`、`conversation.view` 和 dsh 插件配置卡，视觉跟随 dsh 全局主题变量。

## 快速开始

1. 直接从 npm 安装正式发布包（推荐）：

   ```bash
   dsh plugin --profile web add @mymeter/dsh-cost-meter
   ```

   当前 `latest` 版本为 `0.1.0`，详见 [npm package](https://www.npmjs.com/package/@mymeter/dsh-cost-meter)。

2. 如需从源码验证或参与开发，再在本仓库构建、打包并验证 tarball：

   ```bash
   npm ci
   npm run build
   npm run pack:plugin
   npm run verify:package
   ```

3. 安装生成的本地 tarball：

   ```bash
   dsh plugin --profile web add ./mymeter-dsh-cost-meter-0.1.0.tgz
   ```

4. 重启或重新加载对应 dsh Web profile，打开一个会话；在会话页面查看右侧浮动小票，或打开 `Token计费` 会话页查看余额、阶段和 Token 明细。

> [!NOTE]
> npm 版本已经发布。若 dsh profile 使用了自定义 registry，请确保该 registry 能访问 `@mymeter/dsh-cost-meter`

完整安装和排错流程见[安装与使用](docs/getting-started.md)。

## 支持厂商概览

| 能力 | 当前状态 |
| --- | --- |
| 价格估算 | DeepSeek、xAI、OpenAI、Anthropic、Google Gemini、Moonshot/Kimi、MiniMax、Mistral、Groq、Together、Fireworks、Cerebras |
| DeepSeek 余额 | `deepseek-official` 已接入 `/user/balance`，支持 CNY/USD 余额和低余额提醒 |
| 其他公开余额候选 | OpenRouter、Moonshot/Kimi、xAI、Vercel AI Gateway 等需要独立 adapter 和权限语义 |
| 暂不显示余额 | 未接入余额 adapter 的 provider 不会在余额区域展示；当前仅展示 DeepSeek 余额 |
| 订阅、代理、gateway route | 无独立 Token 单价时，按可识别底层模型的公开 API 价格做等价估算 |

价格来源与覆盖范围见 [价格目录来源与覆盖范围](docs/pricing-catalog.md)。

## 文档导航

- [安装与使用](docs/getting-started.md)：安装、首次验证、UI、配置、凭据、更新、卸载、备份清理和排错。
- [计费口径](docs/billing.md)：估算与结算、Token 分桶、峰谷价格、币种和价格目录解析。
- [数据与隐私](docs/privacy.md)：本地数据、凭据边界、网络请求、删除方式和自更新权限。
- [常见问题](docs/faq.md)：金额差异、未知模型、余额、历史账本和安装问题。
- [架构与实现](docs/architecture.md)：模块边界、事件流、计费状态机、账本、Remote 和构建发布。
- [价格目录来源与覆盖范围](docs/pricing-catalog.md)：厂商价格快照、route alias 和未知模型处理。
- [Changelog](CHANGELOG.md)：发布变更和验证记录。
- [English README](README_EN.md)：英文版首页。

## 状态与限制

- 当前是早期基础版，已经通过插件构建、`npm run verify:package`、tarball 消费者检查和隔离 dsh profile 的安装/Web/卸载/重装验收。
- `@mymeter/dsh-cost-meter@0.1.0` 已发布到 npm registry；新 profile 可直接使用 npm 安装，已安装用户可在 loopback Web UI 中检查更新。自更新仍要求当前 dsh profile 使用可解析本地目录的 `file:` baseUrl。
- 最终 tarball 已完成隔离 profile 验收；尚未使用真实 DeepSeek API Key 完成生产请求 usage/金额对账，也尚未用真实账户核对余额数值。
- 价格表随代码发布；仓库提供远程价格更新的签名清单验证、HTTPS 下载、SHA-256 校验和 activate/rollback 库级能力，但生产插件尚未接线，也没有官方 endpoint/trusted key，默认不会自动联网或热更新目录。
- CSV/JSON 导出只包含安全字段 allowlist，不导出 prompt、completion、工具正文或 API Key；CSV 会防护公式注入。
- 多宽度自动化视觉回归、完整键盘路径和无障碍回归仍需补齐。
- 同一个 `ledgerPath` 不应被多个 dsh 进程同时写入；JSON adapter 的同进程多实例写前会合并磁盘事件，append adapter 检测到 stale writer 时会拒绝提交并要求重开。

## 社区与许可证

欢迎通过 issue 或 PR 补充厂商价格、余额 adapter、真实对账结果、视觉/无障碍回归和文档示例。提交价格或余额能力变更时，请附上官方来源、快照日期和测试覆盖。

- [贡献指南](CONTRIBUTING.md)
- [支持指南](SUPPORT.md)
- [安全策略](SECURITY.md)
- [社区行为准则](CODE_OF_CONDUCT.md)

dsh-cost-meter 采用 [MIT License](LICENSE) 发布。
