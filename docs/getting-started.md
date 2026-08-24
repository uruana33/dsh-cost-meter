# 安装与使用

本文面向第一次安装和验证 dsh-cost-meter 的 dsh 用户。正式包名为 `@mymeter/dsh-cost-meter`，当前 npm `latest` 为 `0.2.2`。

> dsh-cost-meter 只做本地费用观测和估算，不是模型厂商官方账单。首次上线前请用小额真实请求与厂商控制台对账。

## 前置要求

- Node.js `^22.19.0 || >=24.0.0`。
- 可运行的 dsh / DeepSeek Harness Web profile。
- dsh Web 运行时提供 React 18；插件包只声明 React peer dependency。
- 如果要显示 DeepSeek 余额，需要可被 dsh credentials 或启动环境解析的 DeepSeek API Key。
- 正常安装发布包时，账本默认保存到 `$DSH_HOME/mymeter/ledger.json`，账本格式默认是 `json`；自定义 Host 组合可以用 `ledgerPath` 改写位置，用 `ledgerFormat: append` 显式启用 append。

## 从 npm 安装（推荐）

`web` 是 dsh Web profile 的名称，直接安装 npm 上的正式版本：

```bash
dsh plugin --profile web add @mymeter/dsh-cost-meter
```

也可以固定已验证版本：

```bash
dsh plugin --profile web add @mymeter/dsh-cost-meter@0.2.2
```

如果 dsh 使用自定义 npm registry，请确认该 registry 已同步此公开包。包发布页见
[npmjs.com/package/@mymeter/dsh-cost-meter](https://www.npmjs.com/package/@mymeter/dsh-cost-meter)。

## 从本地 tarball 安装（开发与离线验证）

适合源码开发、离线环境或验证尚未打包到 npm 的本地改动：

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run pack:plugin
npm run verify:package
dsh plugin --profile web add ./mymeter-dsh-cost-meter-0.2.2.tgz
```

安装后重启或重新加载该 profile 的 dsh Web。包内 `dsh.bundle.patch` 会注册 Host，`dsh.client` 会注册 Web Client；不需要手工复制 `packages/plugin/cordis.patch.yml`。

当前不支持直接从 Git 地址安装。源码构建依赖本仓库 workspace，Git 安装不能得到自包含发布产物。

## 首次验证

1. 打开已安装插件的 dsh Web profile。
2. 进入一个会话并发送一次模型请求。
3. 请求生成期间，确认会话区域出现 dsh-cost-meter 浮动小票；点击小票应切换到 `Token计费` 会话页。
4. 在 `Token计费` 页确认会话总费用、Token 分桶、阶段 Tab、轮次明细和当前 provider 余额区域正常展示。
5. 如需查看费用树、趋势/异常或导出账本，可切换到对应的按需面板；这些能力默认不进入主快照。
6. 正常发布包安装会使用默认 JSON 文件账本；重启后应能从 `$DSH_HOME/mymeter/ledger.json` 恢复已写入事件。只有自定义组合直接调用 Host 且省略 `ledgerPath` 时才使用内存账本。

如果没有真实 API Key，余额可能显示不可用；这不影响本地 Token 费用估算。

## UI 使用

- 浮动小票：显示当前会话的 Token 和费用摘要，生成中会显示临时估算，结算后显示最终金额。
- `Token计费` 会话页：显示账户余额、会话总费用、原币费用、人民币折算入口、阶段 Tab、Token 计费明细、上下文快照和轮次明细。
- 费用洞察：全局页显示预算进度和 DeepSeek 峰谷倒计时；会话详情在此基础上显示缓存命中节省金额。预算阈值只影响提示，不会阻止模型请求。
- 会话列表：支持搜索、按最近/金额/状态排序，以及按状态筛选。
- 设置面板：可调整减少动画、默认静音、余额刷新间隔、预算阈值，并可恢复默认。
- dsh 插件配置页：`设置 -> 插件 -> 插件配置 -> dsh-cost-meter` 中也会出现同一组浏览器显示偏好。

浏览器显示偏好保存在本地存储 `mymeter.settings`。这些偏好不会写入 Host 配置，也不会影响计费结果。

## Host 配置

| 配置项 | 类型 | 默认值/来源 | 说明 |
| --- | --- | --- | --- |
| `ledgerPath` | `string` | 发布包为 `$DSH_HOME/mymeter/ledger.json` | 本地费用账本路径。自定义组合若不传该配置，Host 使用内存账本。 |
| `ledgerFormat` | `"json" \| "append"` | `json` | 本地账本格式。`append` 仍是显式 opt-in，不是默认格式。 |
| `balanceEnabled` | `boolean` | `true` | 是否启用 DeepSeek 余额读取。 |
| `apiKeyEnv` | `string` | `llm-deepseek.apiKeyEnv`，再回退 `DEEPSEEK_API_KEY` | DeepSeek 凭据引用名。 |
| `baseUrl` | `string` | `llm-deepseek.baseURL`，再回退 `DEEPSEEK_BASE_URL` 和 `https://api.deepseek.com` | DeepSeek API 地址。 |
| `balanceCacheTtlMs` | `number` | 5 分钟 | Host 余额缓存时长。 |

具体配置入口由 dsh profile 的插件管理器和配置系统决定。dsh-cost-meter 仓库已验证 `apply(ctx, { ledgerPath, ledgerFormat })` 的 JSON 默认、append opt-in、重启恢复和升降级路径，但不在文档中假定未核实的 profile 配置命令。

dsh profile 的用户 patch 会整块替换插件 `config`。启用 append 时必须同时保留 `ledgerPath`，否则会丢掉 durable 文件路径并退回内存账本：

```yaml
- id: mymeter
  config:
    ledgerPath: !!js dshHomePath('mymeter/ledger.json')
    ledgerFormat: append
```

从 `json` 切到 `append` 时，Host 会把原 JSON 账本导入 append generation，并自动生成 `<ledgerPath>.legacy.json` 作为旧格式备份。从 `append` 切回 `json` 时，Host 会先从 append generation 安全导出完整 schema-v1 JSON，再用 JSON adapter 读取。

`ledgerPath` 的最后一级文件不要使用 symlink。append 模式和 append -> JSON 降级会拒绝 final symlink；JSON adapter 保持既有行为，原子写会替换 symlink 本身而不是 target。目录级 symlink 不在这个限制内。

## 凭据

DeepSeek 余额读取只在 Host 侧执行：

- 优先使用插件配置 `apiKeyEnv`。
- 未配置时继承 `llm-deepseek.apiKeyEnv`。
- 再回退到 `DEEPSEEK_API_KEY`。
- `baseUrl` 同理优先使用插件配置，再继承 `llm-deepseek.baseURL`，再回退 `DEEPSEEK_BASE_URL` 和官方地址。

Host 会通过 dsh credentials 解析引用；没有 credentials 服务时才读取启动环境变量。API Key 不会进入 Client bundle、Remote DTO、浏览器本地存储或日志。

## 更新

- 在 dsh Web 的 loopback 连接中，`Token计费` 页提供“检查更新/更新插件”入口；Host 还要求 Cordis `ctx.baseUrl` 是可解析 profile 目录的 `file:` URL。更新检查读取 npm registry，安装完成后需要重启或等待 dsh 恢复。
- 当前已安装版本可直接在 loopback Web UI 检查更新；也可以重新构建并通过 dsh 插件管理器安装新的本地 tarball。具体更新命令以 dsh 插件管理器当前版本为准。
- 远程价格更新与插件自更新是不同功能：前者只是尚未接入生产插件的安全下载库，没有官方 endpoint/trusted key，不会自动联网；后者只在 loopback Web UI 显示，并从 npm registry 安装更高版本。
- 源码发布校验仍建议执行 `npm run build`、`npm run pack:plugin` 和 `npm run verify:package`；`npm run verify` 只有在根 tarball 已是当前构建产物时才会通过。

## 卸载

请通过 dsh 插件管理器移除 `@mymeter/dsh-cost-meter`。本仓库当前只验证了卸载后 `shell.overlay`、`conversation.view` 和 Remote contribution 会被清理；未在文档中假定具体的 `dsh plugin remove` 命令。

卸载插件不会自动删除你配置的账本文件、append sidecar、恢复 checkpoint、隔离文件或浏览器本地存储。

## 备份与清理

- 先停止所有使用同一 `ledgerPath` 的 dsh 进程；同一个 `ledgerPath` 仍只允许一个 dsh 进程写入。
- 账本文件组：备份或清理时成组处理 `ledgerPath`、`<ledgerPath>.recovery.json`、`<ledgerPath>.legacy.json`、`<ledgerPath>.g*.snapshot.json`、`<ledgerPath>.g*.log` 和相邻的 `.corrupt-*` 隔离副本。
- recovery checkpoint：配置 durable `ledgerPath` 时，Host 会在同路径旁写入 `<ledgerPath>.recovery.json`，用于记录历史回填 revision 和账本 content fingerprint。自定义组合未配置 `ledgerPath` 时不会生成 checkpoint。
- 浏览器偏好：dsh-cost-meter 使用 `mymeter.settings` 保存显示偏好。需要重置时，可优先在设置面板点击“恢复默认”。
- 并发写入：不要让多个 dsh 进程同时写同一个 `ledgerPath`，即使它们使用相同 `ledgerFormat`；也不要把 final symlink 当作可写账本别名。

## 排错

| 现象 | 检查项 |
| --- | --- |
| 看不到浮动小票 | 确认已重启 dsh Web、当前会话有可计费事件、浮窗开关没有关闭。 |
| `Token计费` 页不存在 | 确认插件安装在当前 profile，且 Host/Client bundle 使用同一发布包。 |
| 余额不可用 | 检查 DeepSeek API Key 引用、`llm-deepseek` 配置、`baseUrl`、网络访问，以及 `balanceEnabled` 是否为 `false`。 |
| 其他厂商没有余额项 | 当前余额区域只展示 `deepseek-official`；其他厂商不展示余额，这是预期行为。 |
| 金额显示 `-`、费用估算或未知 | 模型未登记价格、provider usage 缺失，或模型无法唯一归属到已登记厂商目录。当前没有独立“费用待核算”状态。 |
| 历史累计重启后丢失 | 检查是否配置了 `ledgerPath`；未配置时使用内存账本。 |
| 混合币种无法折算人民币 | 在 `Token计费` 页点击“查询最新汇率”；该请求只查询 USD/CNY，不上传会话、账本或凭据。 |
| 账本恢复警告 | dsh-cost-meter 会尽量保留可恢复事件并隔离损坏内容；请备份原账本和隔离文件后再排查。 |

## 验证命令

开发或发布前可运行：

```bash
npm run typecheck
npm test
npm run build
npm run pack:plugin
npm run verify:package
```

`npm run verify:package` 会重新临时 `npm pack`，检查发布文件清单、关键声明文件、根 tarball 内容一致性、临时消费者类型检查和 Host 入口加载。旧的根 tarball、缺 `LICENSE`/`README.md`/`cordis.patch.yml` 或声明文件不完整时会失败。`npm run verify` 可作为综合检查，但最终 tarball 发布前仍应按 `build -> pack:plugin -> verify:package` 顺序校验。
