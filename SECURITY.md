# 安全策略

## 支持版本

dsh-cost-meter 当前版本为 `0.1.0`，仍处于 pre-1.0 阶段。安全修复只面向最新发布版本；当前默认分支和由其构建的本地 tarball 按尽力原则处理，不承诺长期维护。

| 版本 | 安全支持 |
| --- | --- |
| 默认分支及由其构建的本地 tarball | 发布前尽力协助 |
| 最新 npm 发布版本 | `0.1.0`；支持最新发布版本 |
| 旧版本 | 不支持；请升级到最新版本后复测 |

## 私下报告漏洞

请不要在公开 Issues、Discussions、PR、聊天记录或日志中披露安全漏洞、API Key、访问令牌、cookie、账本文件、profile 配置或可复现的 secret。

首选报告渠道是 GitHub Security Advisory：

1. 打开本仓库的 **Security** 页面。
2. 选择 **Report a vulnerability**。
3. 按下面模板填写。

如果仓库未启用 GitHub Private Vulnerability Reporting，请打开仓库所有者的 GitHub 个人主页，通过其公开列出的邮箱或其他私密联系方式，请求一个私密安全报告渠道。如果只能使用公开渠道，第一条消息只能请求私密联系方式，不得包含漏洞类型、复现步骤、影响范围、附件、凭据或任何可帮助利用漏洞的细节。不要新建公开 Issue 报告漏洞。

## 报告模板

```text
标题：

影响版本：

受影响环境：
- 操作系统：
- Node.js 版本：
- dsh 版本：
- dsh-cost-meter 安装方式：

漏洞类型：
- 凭据泄露 / 本地文件写入 / 自更新供应链 / XSS / 远程调用越权 / 拒绝服务 / 其他：

复现步骤：
1.
2.
3.

预期结果：

实际结果：

影响范围：
- 是否需要本机访问：
- 是否需要已登录 dsh：
- 是否会暴露 API Key 或账本数据：
- 是否会修改文件或执行命令：

已尝试的缓解措施：

附件：
- 请先脱敏，不要包含真实 API Key、cookie、token、私有 URL、完整账本或对话正文。
```

## 已核实的安全边界

- API Key 只在 Host 侧解析和使用，不进入 Client bundle、Remote DTO、浏览器本地存储、账本或日志。
- 账本只保存会话/请求标识、模型、Token 分桶、费率和金额，不保存 prompt、completion、工具参数或消息正文。
- DeepSeek 余额请求携带 API Key；汇率请求、同源健康探测和更新检查不携带 dsh-cost-meter 账本或凭据。
- 当前 npm 版本的自更新 RPC 使用 loopback authority，且要求 Cordis `ctx.baseUrl` 是可解析本地 profile 目录的 `file:` URL；安装动作固定为 `pnpm add --save-exact @mymeter/dsh-cost-meter@<version>`，并校验包名、版本和 dsh manifest。
- 账本与 recovery checkpoint 使用临时文件写入后原子重命名；损坏或不兼容文件会尝试移动到隔离文件。

## 风险提示

- 不要把 `ledgerPath` 指向共享目录、同步盘冲突目录或多个 dsh 进程同时写入的位置；当前没有跨进程文件锁。
- 不要在 bug 报告中粘贴真实 `$DSH_HOME/mymeter/ledger.json`、`*.recovery.json`、`cordis.yml` 或环境变量原文。
- 自更新会以运行 dsh 的本地用户权限修改当前 dsh profile 依赖。只在信任 npm registry、网络和当前 profile 配置时使用。
- 如果怀疑 API Key 已泄露，先在提供商控制台撤销或轮换密钥，再提交脱敏后的安全报告。
