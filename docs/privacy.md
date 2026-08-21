# 隐私与数据边界

最后核实日期：2026-08-19。

dsh-cost-meter 是 dsh 的本地费用观测插件。它把 dsh 会话事件中的模型、Token 用量和价格目录换算为本地费用快照；它不是模型提供商的官方账单系统。

## 数据清单

### Host 侧账本数据

当配置了 `ledgerPath` 时，dsh-cost-meter 在 Host 侧写入本地账本。默认包配置使用 `$DSH_HOME/mymeter/ledger.json` 和 `ledgerFormat: json`；`ledgerFormat` 可选 `json` 或 `append`，append 是显式 opt-in，不是默认格式。未配置 `ledgerPath` 时只使用内存账本，重启后不保留累计。

账本条目包含：

- 事件标识：`id`、`eventKey`、`sessionId`、`turnId`、`stepId`、`attemptId`、`parentSessionId`。
- 请求元数据：`requestStartedAt`、`completedAt`、`requestOutcome`、`provider`、`model`、`reasoningEffort`、`agentPreset`。
- 计费数据：状态、币种、金额、Token 分桶、单价、价格版本、DeepSeek 峰谷时段。

账本不包含 prompt、completion、工具参数、工具返回值、消息正文或 API Key。

### Client 侧偏好数据

浏览器本地存储 key 为 `mymeter.settings`。保存内容限于显示偏好：减少动画、静音、刷新间隔、预算阈值、固定会话、悬浮层开关和兼容字段。拖拽位置仅在当前页面实例中生效；保存时会恢复默认锚点位置。

### Remote 展示数据

Host Remote 向 Client 返回的是展示 DTO，包括汇总金额、会话列表、会话详情、Token 分桶、阶段/轮次状态、上下文 Token 分类、余额快照和汇率快照。费用树、趋势/异常报告和账本导出是按需 Remote 方法，不写入默认 snapshot。Remote DTO 不包含 API Key 或对话正文。

## 不保存内容

dsh-cost-meter 的流式估算会在 Host 内存中短暂读取 `assistant/chunk` 的文本增量、reasoning 增量或工具参数增量，并立即归约为 UTF-8 字节数和 Token 估算。代码路径只保存字节数、Token 数和金额，不把原始内容写入账本、Remote DTO、浏览器存储或插件日志。

历史回填会通过 dsh 的 `sessionPersistence.listSnapshots()`、`sessionQuery` 或 `sessionPersistence` 读取会话事件，用同一套桥接逻辑提取计费字段。列表阶段优先使用可提供 revision 的 `listSnapshots()`；对实际需要读取的变化会话，内容读取仍优先走 `sessionQuery.readSession()`，失败或不可用时降级到 `sessionPersistence.inspect()`。读取过程用于补算费用，不把会话正文另存为 dsh-cost-meter 数据。

## API Key 与凭据

余额查询只在 Host 侧解析凭据。dsh-cost-meter 优先读取 `llm-deepseek` 设置中的 `apiKeyEnv`，再回退到 `DEEPSEEK_API_KEY`；如果 dsh credentials 服务可用，则通过 `ctx.credentials.resolve(ref)` 获取值，否则读取 launch environment 或进程环境变量。

API Key 只用于发起 DeepSeek 余额请求，不进入 Client bundle、Remote DTO、浏览器本地存储、账本文件或日志。凭据或设置更新时，Host 会清理余额缓存。

## 外部网络请求

dsh-cost-meter 代码中存在以下运行时网络请求：

- DeepSeek 余额：Host 向配置的 `baseUrl` 请求 `/user/balance`，默认 `https://api.deepseek.com/user/balance`，携带 `Authorization: Bearer <API Key>`。可通过 `balanceEnabled: false` 关闭。
- 汇率刷新：用户手动触发 USD/CNY 折算时，Host 请求 `https://api.frankfurter.app/latest?from=USD&to=CNY`，只发送普通 JSON 请求头，不发送会话、账本或凭据，8 秒超时。
- 自更新检查：用户在本机页面点击“检查更新”后，Host 通过 npm registry 读取 `@mymeter/dsh-cost-meter` manifest，默认 registry 为 `https://registry.npmjs.org`，5 秒超时。当前公开 `latest` 为 `0.2.0`。
- 自更新安装：用户确认安装时，Host 会在 dsh profile 目录执行 `pnpm add --save-exact @mymeter/dsh-cost-meter@<version>`。实际下载来源由 pnpm/npm 配置决定。
- 更新后健康探测：Client 在等待 dsh 重启时默认请求同源 `/`（内部 probe 支持配置其他 path），使用 `cache: "no-store"`，不发送 dsh-cost-meter 账本或凭据；`fetch` 或页面 origin 不可用时直接视为未恢复。
- 充值入口：Client 只展示 DeepSeek 官方充值链接 `https://platform.deepseek.com/top_up`；点击后由浏览器访问。

远程价格更新当前是未接入生产运行时的库级能力，没有官方 endpoint 或 trusted key，也没有默认调用点，因此不会自动联网。该库支持 Host 按调用方提供的 HTTPS manifest URL、trusted key 和 activation adapter 下载签名价格清单及 catalog：manifest 和 catalog 都有大小上限，catalog 必须匹配 manifest 中的 SHA-256。下载成功后只把已验证 bundle 交给调用方提供的 `activate()`；动态 catalog schema 校验、持久化目录应用和生产调度由该 adapter 负责。

dsh-cost-meter 没有发现独立的分析、遥测、埋点、`sendBeacon`、第三方监控或错误上报代码。

## 存储位置与删除

- 账本：配置的 `ledgerPath`，默认包配置为 `$DSH_HOME/mymeter/ledger.json`。
- 账本临时文件：写入期间短暂创建 `<ledgerPath>.<pid>.<timestamp>.tmp`，成功后原子重命名。
- 账本隔离文件：损坏、schema 不匹配或包含非法事件时，旧文件会被移动到 `<ledgerPath>.<reason>-<timestamp>-<pid>`。
- append sidecar：启用 `ledgerFormat: append` 时，`ledgerPath` 保存当前 manifest，相邻生成 `<ledgerPath>.g*.snapshot.json` 和 `<ledgerPath>.g*.log`。
- legacy JSON 备份：从 `json` 切到 `append` 时，Host 自动生成 `<ledgerPath>.legacy.json`。
- recovery checkpoint：仅在配置 durable `ledgerPath` 时写入 `<ledgerPath>.recovery.json`。checkpoint 保存 source/projection 版本、账本 content fingerprint 和 session revision，用于跳过未变化历史；未配置 `ledgerPath` 的内存账本不会生成 checkpoint。
- 浏览器偏好：当前浏览器 profile 的 `localStorage["mymeter.settings"]`。
- symlink：append 模式和 append -> JSON 降级会拒绝 final symlink `ledgerPath`。JSON adapter 保持既有行为，原子写会替换 symlink 本身而不是 target；不要把 final symlink 当作可写账本别名。目录级 symlink 不在这个限制内。

删除方式：

- 删除账本累计：先停止所有使用同一 `ledgerPath` 的 dsh 进程，再成组删除 `ledgerPath`、`<ledgerPath>.recovery.json`、`<ledgerPath>.legacy.json`、`<ledgerPath>.g*.snapshot.json`、`<ledgerPath>.g*.log` 和相邻的 `.corrupt-*` 隔离副本。
- 删除浏览器偏好：在浏览器站点数据中清理 dsh 站点的 localStorage，或由产品内“重置设置”触发 `removeItem("mymeter.settings")`。
- 删除余额缓存：重启插件、卸载插件，或触发 credentials/settings 更新；缓存只在内存中保留，默认有效期 5 分钟。

## 损坏隔离与恢复

账本读取失败、schema 版本不匹配或事件无法恢复时，dsh-cost-meter 会尽量隔离原文件并继续启动：

- JSON 损坏或不支持的 schema：将原账本重命名到隔离路径，使用空账本继续。
- 部分事件非法：将原账本重命名到隔离路径，把可恢复事件写回新账本。
- JSON 切到 append：导入现有 JSON 事件，保留 `<ledgerPath>.legacy.json` 作为旧格式备份。
- append 切回 JSON：从 append generation 安全导出完整 schema-v1 JSON；导出校验失败时不会替换旧状态。
- recovery checkpoint 损坏或 schema 不匹配：将 checkpoint 重命名到隔离路径，并退回完整历史读取。
- recovery checkpoint 的 source、projection 版本或账本 content fingerprint 与当前运行态不匹配：不信任旧 revision，退回完整历史读取。

隔离依赖本地文件系统 `rename`。如果重命名失败，原文件会保留在原位，插件继续按可恢复状态运行或抛出写入错误。

## 多进程风险

JSON adapter 的同一进程多实例在写入前会先读取磁盘并合并事件，降低覆盖风险。append adapter 不做多实例合并；当检测到 active generation 或 owner 状态已过期时会拒绝提交，调用方必须重开账本实例后再写。不同 dsh 进程同时写入同一个 `ledgerPath` 时没有跨进程文件锁或跨进程协调；最后一次写入可能覆盖或拒绝另一进程刚写入的内容。无论使用 `json` 还是 `append`，同一个 `ledgerPath` 仍只允许一个 dsh 进程写入。

同一个约束也适用于 final symlink `ledgerPath`：不要把多个 symlink 名称当成同一账本 target 的可写别名。

## 自更新权限边界

`@mymeter/dsh-cost-meter@0.2.0` 已发布到 npm registry。自更新仍只在 loopback Web UI、可写 profile 且 `ctx.baseUrl` 为 `file:` URL 的环境中可用。

自更新 RPC 只以 loopback authority 注册，Client 必须通过本机 dsh 连接调用；Host 的 Cordis `ctx.baseUrl` 还必须是能解析本地 profile 目录的 `file:` URL，非 `file:` URL 会被拒绝。安装前会校验目标包名必须是 `@mymeter/dsh-cost-meter`、目标版本必须是 SemVer 且高于当前版本、registry manifest 包名和版本必须匹配，并要求 manifest 具备 dsh client/bundle 字段。

自更新的权限边界仍等同于运行 dsh 的本地用户：一旦用户点击安装，Host 会在当前 dsh profile 目录运行 `pnpm add --save-exact` 修改 profile 依赖。它不会请求 sudo，也不会主动修改 profile 目录以外的文件，但 pnpm 可按用户 npm 配置访问网络和缓存。

## 核实依据

- `packages/plugin/cordis.patch.yml`：默认 `ledgerPath`。
- `packages/host/src/ledger.ts`：账本读写、原子写入、隔离文件。
- `packages/host/src/ledger-format.ts`：`ledgerFormat` 选择、append 到 JSON 的降级导出。
- `packages/host/src/append-ledger.ts`：append manifest、generation snapshot/log、legacy JSON 备份、schema-v1 JSON 导出。
- `packages/host/src/recovery-checkpoint.ts`：checkpoint 文件、content fingerprint、原子写入、损坏隔离。
- `packages/host/src/types.ts`：账本事件字段。
- `packages/host/src/balance.ts`：DeepSeek 余额请求、凭据使用、内存缓存。
- `packages/plugin/src/cordis-host.ts`：dsh 事件桥接、checkpoint 接线、凭据解析、内容归约为字节数。
- `packages/plugin/src/index.tsx`：Host Remote DTO、汇率请求、余额映射。
- `packages/host/src/remote-pricing-update.ts`：远程价格 manifest/catalog 下载、大小限制、SHA-256 校验和 activation seam。
- `packages/plugin/src/self-update.ts`：npm registry 检查、自更新安装、loopback RPC。
- `packages/client/src/store.ts`：浏览器本地偏好、充值链接。
- `packages/client/src/update-controller.ts`：同源健康探测。
