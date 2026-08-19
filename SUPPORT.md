# 支持指南

## 问题分类

请先判断问题类型：

- 普通使用问题：安装、配置、界面显示、价格口径、余额不可用、汇率刷新、历史回填状态。
- 缺陷报告：崩溃、测试失败、金额明显错误、账本恢复异常、浏览器 UI 异常。
- 功能请求：新模型价格、新 provider 余额适配、新展示维度、配置项调整。
- 安全漏洞：凭据泄露、越权 Remote 调用、任意文件写入、自更新供应链风险、XSS。不要发公开 Issue，请按 `SECURITY.md` 私下报告。

## 提问前请准备

普通问题或缺陷报告请尽量提供：

- dsh-cost-meter 版本和安装方式：npm、tarball 或源码。
- dsh 版本、Node.js 版本和操作系统。
- 相关配置项：`ledgerPath`、`balanceEnabled`、`apiKeyEnv`、`baseUrl`、`balanceCacheTtlMs`。
- 问题发生时间、操作步骤、预期结果和实际结果。
- 是否使用多进程或多个 dsh profile 共享同一个账本路径。
- 控制台错误、Host 日志中的 dsh-cost-meter 错误、测试命令输出摘要。
- 对金额问题，请提供 provider、model、请求开始时间、Token 分桶、价格版本和厂商账单对账差异。

## 隐私与脱敏

提交信息前请脱敏：

- 不要提供真实 API Key、Bearer token、cookie、SSH key、npm token 或 OAuth 凭据。
- 不要提供完整 prompt、completion、工具参数、工具返回值或私有对话正文。
- 不要直接粘贴完整账本；只保留必要字段，例如 provider、model、Token 数、金额、状态和价格版本。
- 路径中如果包含用户名、客户名、项目代号或内部仓库名，请替换为占位符。
- 余额截图请遮挡账户标识、充值记录、交易流水和密钥页面。

推荐用占位符替换敏感值：

```text
DEEPSEEK_API_KEY=sk-REDACTED
ledgerPath=/Users/REDACTED/.dsh/mymeter/ledger.json
sessionId=session-REDACTED
baseUrl=https://api.deepseek.com
```

## 可自行检查

- 余额不可用：确认 `balanceEnabled` 未关闭、`apiKeyEnv` 指向正确凭据、`baseUrl` 可访问。
- 历史累计丢失：确认当前 profile 使用的 `ledgerPath` 是否改变，账本是否被删除或隔离为 `*.corrupt-*`、`*.schema-*`、`*.invalid-events-*`。
- 汇率不可用：确认运行环境可以访问 `https://api.frankfurter.app`。
- 更新失败：请确认当前环境有 `pnpm`，dsh profile 目录可写，Cordis `ctx.baseUrl` 为可解析 profile 目录的 `file:` URL，并且 npm registry 能访问 `@mymeter/dsh-cost-meter`。
- 金额异常：确认模型已在价格目录登记；未知模型会显示不可用或估算，不应按 `¥0.000` 当作真实账单。
