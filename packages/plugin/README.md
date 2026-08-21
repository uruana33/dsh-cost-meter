# @mymeter/dsh-cost-meter

Provider-aware LLM cost metering, local ledger, balance display, and dsh Web UI for DeepSeek Harness.

> [!WARNING]
> dsh-cost-meter is a local observability and estimation tool, not an official bill from any model provider. Pricing snapshots ship with each release, and streaming estimates may differ from final provider usage. Treat provider consoles, invoices, and actual charges as the source of truth.

## Requirements

- Node.js `^22.19.0 || >=24.0.0`
- A matching dsh release with the Web bundle enabled
- React `^18.2.0` supplied by the dsh Web runtime

## Features

- Versioned pricing snapshots for DeepSeek, xAI, OpenAI, Anthropic, Google Gemini, Moonshot/Kimi, MiniMax, Mistral, Groq, Together, Fireworks, and Cerebras.
- Streaming cost estimates corrected by final provider usage, with cached/uncached input and output token buckets.
- Floating receipt, session stages and turns, local totals, budget hints, cache-hit savings, and the DeepSeek peak/off-peak countdown.
- On-demand session cost tree, trend/anomaly analysis, and safe JSON/CSV ledger export.
- A local durable JSON ledger by default, with an explicitly opt-in append ledger and revision checkpoint recovery.
- Host-only DeepSeek balance lookup and manual USD/CNY display conversion.

## Install

The package is published to the npm registry as `0.3.0`:

```sh
dsh plugin --profile web add @mymeter/dsh-cost-meter
```

For source validation or offline development, build and pack this repository:

```sh
npm ci
npm run build
npm run pack:plugin
npm run verify:package
dsh plugin --profile web add ./mymeter-dsh-cost-meter-0.3.0.tgz
```

The package ships prebuilt Host, Client, Remote, invariant, and declaration artifacts. Direct Git installation is not supported because the source build depends on this repository's workspaces.

## Data Boundaries

- API credentials remain on the Host and are never sent through the plugin Remote.
- Streaming text and tool arguments are reduced in memory to byte counts for temporary estimates; their contents are not stored or sent to the Client.
- The local ledger stores usage and cost metadata, not conversation content.
- The dsh bundle patch defaults to `$DSH_HOME/mymeter/ledger.json`; direct custom Host composition without `ledgerPath` uses an in-memory ledger.
- `ledgerFormat` accepts `json` or `append`; the default remains `json`, and `append` must be explicitly opted in.
- Manual exchange-rate refresh sends a metadata-free USD/CNY request to `api.frankfurter.app` and times out after eight seconds.

When opting in to append from a dsh profile patch, keep `ledgerPath` in the replacement config block:

```yaml
- id: mymeter
  config:
    ledgerPath: !!js dshHomePath('mymeter/ledger.json')
    ledgerFormat: append
```

Switching from JSON to append creates `<ledgerPath>.legacy.json`. Switching back to JSON exports a schema-v1 JSON ledger before the JSON adapter opens it.

Use one dsh process per configured `ledgerPath`. Before backup or cleanup, stop every dsh process using that path and handle `ledgerPath`, `<ledgerPath>.recovery.json`, `<ledgerPath>.legacy.json`, `<ledgerPath>.g*.snapshot.json`, `<ledgerPath>.g*.log`, and adjacent `.corrupt-*` quarantine files as one set. Uninstalling the plugin does not delete user ledger data.

## License

MIT. See `LICENSE` in the package.
