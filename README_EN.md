# dsh-cost-meter

![Node.js](https://img.shields.io/badge/node-%5E22.19.0%20%7C%7C%20%3E%3D24.0.0-339933)
![Status](https://img.shields.io/badge/status-early%20preview-f59e0b)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

dsh-cost-meter is a multi-provider LLM token cost meter for dsh / DeepSeek Harness. It turns locally observed request usage into a traceable local ledger, live receipts, session billing, and usage analysis inside a dsh Web profile.

> [!WARNING]
> This is a local observability, estimation, and replay tool, not an official bill from DeepSeek, OpenAI, Anthropic, xAI, or any other provider. Streaming output is estimated first and corrected when provider usage arrives. Provider consoles, invoices, and actual charges remain the source of truth.

## Current Release

The published package is [`@mymeter/dsh-cost-meter@0.2.1`](https://www.npmjs.com/package/@mymeter/dsh-cost-meter). Recent release highlights:

- Global usage overview for today, the last 7 days, and the last 30 days, with cost, tokens, request count, coverage, and top models.
- A unified `Token计费` page with session, cost-tree, and trend/anomaly views; model-colored trends with range switching; and JSON/CSV ledger export.
- A new `deepseek-v4-flash-vision-exp` entry in the DeepSeek snapshot, using provider-reported image tokens and the existing Beijing peak/off-peak schedule.
- JSON remains the default ledger format, append is opt-in, and failed balance refreshes preserve the last usable result with an explicit status.

See [CHANGELOG](CHANGELOG.md) for the full history and the [pricing catalog](docs/pricing-catalog.md) for snapshot coverage.

## Quick Start

### Install from npm (recommended)

```bash
dsh plugin --profile web add @mymeter/dsh-cost-meter
```

### Build and validate from source

```bash
npm ci
npm run build
npm run pack:plugin
npm run verify:package
dsh plugin --profile web add ./mymeter-dsh-cost-meter-0.2.1.tgz
```

Reload the target dsh Web profile and open a session. The runtime requires Node.js `^22.19.0 || >=24.0.0` and a dsh profile with the Web bundle enabled.

See [Getting Started](docs/getting-started.md) for configuration, credentials, updates, uninstall, cleanup, and troubleshooting.

## User Flows

### While a request is running

The Token widget in the upper-right of the conversation view shows the current request's tokens and cost. During streaming the amount is provisional; when `assistant/message.usage` arrives, the same request is corrected to a settled event. Open the widget to reach the full `Token计费` page.

### Session billing

Session details are grouped by stages and turns and include:

- uncached input, cached input, output, and reasoning tokens (reasoning is included in output cost);
- current request, settled and estimated amounts, failed/unknown states, and the model pricing version;
- budget threshold, cache-hit savings, and the current DeepSeek peak/off-peak zone with its next transition;
- native currency totals. A manual USD/CNY lookup adds a display conversion only and never rewrites the ledger.

### Global sessions and analysis

The global `Token计费` page uses one set of view tabs:

| View | Contents |
| --- | --- |
| Sessions | Search, sort, status filters, and session totals; select any session for details |
| Cost tree | Parent/child Agent costs, subtree totals, and relationship anomalies |
| Trend/anomaly | Today/7-day/30-day overview, cost trend, top models, pricing coverage, and local anomaly hints |

Today is bucketed by hour; 7-day and 30-day ranges use calendar days. Multi-model bars are colorized with a legend. The cost tree and analytics are loaded through on-demand Remote calls instead of every lightweight snapshot. JSON/CSV downloads use a safe field allowlist and exclude prompts, response bodies, tool content, and API keys.

## UI And Demos

The following assets come from a dsh Web profile. Balances, sessions, token counts, and amounts are simulated and do not represent a real account or provider invoice.

### Token billing view

![Token billing view: DeepSeek session cost and token buckets](docs/assets/pic0.png)

When usage is unavailable or a model cannot be matched, the UI reports an estimated, unknown, or unavailable state instead of presenting `¥0.000` as a precise amount.

![Token billing view: unavailable or pending billing state](docs/assets/pic1.png)

### Conversation view and Token widget

![Token billing widget in the conversation view](docs/assets/pic2.png)

The videos are stored in `docs/assets`:

- [Token widget basics in dark theme (about 15 seconds)](docs/assets/video1.mp4)
- [Token widget generation flow in light theme (about 23 seconds)](docs/assets/video2.mp4)

## Billing And Pricing

### Token semantics

- Billing events are deduplicated by `(sessionId, turnId, stepId, attemptId)`. Final usage replaces the streaming estimate for that request; it is not added on top.
- Reasoning tokens are a subset of output tokens. They are shown for inspection but are not charged twice.
- Without final usage, streaming text, reasoning, and tool deltas can only estimate output tokens. Cached and uncached input buckets require provider usage.
- When a subscription, Code Plan, proxy, cloud platform, or gateway route has no independent unit price, the plugin estimates against an identifiable underlying provider API catalog. This is not the route's actual subscription charge.

### DeepSeek official snapshot

The current snapshot is `deepseek-official-pricing-2026-08-21`. Prices below are CNY per million tokens. Beijing peak hours are `09:00-12:00` and `14:00-18:00`; all other hours are off-peak.

| Model | Peak: hit / miss / output | Off-peak: hit / miss / output |
| --- | --- | --- |
| `deepseek-v4-flash` | ¥0.10 / ¥3.00 / ¥9.00 | ¥0.05 / ¥1.50 / ¥4.50 |
| `deepseek-v4-flash-vision-exp` | ¥0.10 / ¥3.00 / ¥9.00 | ¥0.05 / ¥1.50 / ¥4.50 |
| `deepseek-v4-pro` | ¥0.30 / ¥9.00 / ¥27.00 | ¥0.15 / ¥4.50 / ¥13.50 |

DeepSeek converts images for the vision model into input tokens. dsh-cost-meter uses provider-reported usage and does not estimate image tokens a second time.

### Registered providers

The pricing catalog includes DeepSeek, xAI, OpenAI, Anthropic, Google Gemini, Moonshot/Kimi, MiniMax, Mistral, Groq, Together, Fireworks, and Cerebras. Overseas catalogs retain USD as the native currency and use a versioned rate for compatible CNY fields; a current exchange rate is fetched only when the user requests a display conversion.

Route aliases such as `openai-codex`, `kimi-coding`, `google-vertex`, and `azure-openai-responses` resolve to the corresponding public API catalog. Models that cannot be uniquely attributed or are not in a local snapshot remain unknown/unavailable instead of falling back to DeepSeek pricing.

## Local Data And Boundaries

- The published patch defaults the ledger to `$DSH_HOME/mymeter/ledger.json` with `json` format. `ledgerFormat: append` is an explicit opt-in.
- Both formats allow only one dsh process to write a given `ledgerPath`. Format switches preserve legacy, recovery, and quarantine files; treat adjacent files as one backup/cleanup set.
- API keys, ledger files, and balance requests stay on the Host. Client/Remote receives sanitized DTOs only. Prompts, completions, message bodies, and tool arguments are not stored in the ledger or exports.
- The production balance adapter currently supports only the DeepSeek `/user/balance` endpoint; balance unavailability does not affect the local cost ledger.
- Pricing ships with the plugin and is not hot-updated over the network. Signed manifests, HTTPS downloads, and SHA-256 checks currently exist as library-level capabilities only; the production plugin does not wire them in.

## Documentation

- [Getting Started](docs/getting-started.md): install, first validation, configuration, credentials, updates, uninstall, cleanup, and troubleshooting.
- [Billing Semantics](docs/billing.md): estimates, settlement, token buckets, peak pricing, currencies, and catalog resolution.
- [Pricing Catalog Coverage](docs/pricing-catalog.md): provider snapshots, route aliases, and unknown-model handling.
- [Data And Privacy](docs/privacy.md): local data, credential boundaries, network requests, deletion, and self-update permissions.
- [FAQ](docs/faq.md): cost differences, balances, history, ledger formats, and installation questions.
- [Architecture](docs/architecture.md): module boundaries, event flow, ledger, Remote, and release builds.
- [CHANGELOG](CHANGELOG.md): release changes and verification records.
- [中文 README](README.md): Chinese homepage.

## Status And Limits

The current release has passed plugin build, typecheck, test, package validation, tarball consumer checks, and isolated dsh profile install/Web/uninstall/reinstall validation. Remaining caveats:

- Production usage/cost reconciliation with a real DeepSeek API key and numerical reconciliation against a real balance account are still outstanding.
- Global analytics and export depend on the corresponding Remote capabilities in the installed dsh version; older versions report them as unavailable.
- Automated multi-width visual regression, full keyboard paths, and accessibility regression coverage are still incomplete.

## Community And License

Issues and PRs are welcome for provider pricing, balance adapters, real reconciliation results, visual/accessibility coverage, and documentation examples. Pricing or balance changes should include an official source, snapshot date, and tests.

- [Contributing Guide](CONTRIBUTING.md)
- [Support Guide](SUPPORT.md)
- [Security Policy](SECURITY.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)

dsh-cost-meter is released under the [MIT License](LICENSE).
