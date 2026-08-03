# @idem0/sdk

**Drop-in idempotency for LLM API calls.** Get exactly-once semantics for [`@anthropic-ai/sdk`](https://www.npmjs.com/package/@anthropic-ai/sdk) and [`openai`](https://www.npmjs.com/package/openai) — without changing how you call them.

idem0 is a lightweight proxy in front of your LLM provider. This SDK is a tiny **config producer** (not a client wrapper): you spread its output into the provider SDK you already use, and add one header per call. Your provider token never leaves your process — idem0 is **BYOK** and never sees it.

## Install

```bash
npm i @idem0/sdk
```

Keep using your provider's official SDK — idem0 sits alongside it.

## Quick start

### Anthropic

```ts
import Anthropic from "@anthropic-ai/sdk";
import { idem0, idempotencyKey } from "@idem0/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY, // your token — BYOK, never seen by idem0
  ...idem0({ idem0Key: process.env.IDEM0_KEY, provider: "anthropic" }),
});

const message = await client.messages.create(
  { model: "claude-opus-4-8", max_tokens: 1024, messages: [{ role: "user", content: "Hello" }] },
  { headers: idempotencyKey("job-42") }, // stable, caller-owned key → exactly-once
);
```

### OpenAI

```ts
import OpenAI from "openai";
import { idem0, idempotencyKey } from "@idem0/sdk";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // your token — BYOK, never seen by idem0
  ...idem0({ idem0Key: process.env.IDEM0_KEY, provider: "openai" }),
});

const completion = await client.chat.completions.create(
  { model: "gpt-4o-mini", messages: [{ role: "user", content: "Hello" }] },
  { headers: idempotencyKey("job-42") },
);
```

Retry a request with the same `Idempotency-Key` and you get the original result back — instead of running, and being billed for, the call twice.

## API

The entire surface is two pure functions.

### `idem0({ idem0Key, provider, endpoint? })`

Client-level config to spread **once** into the provider SDK constructor. Returns `{ baseURL, defaultHeaders }`.

| Option     | Required | Description                                                                                          |
| ---------- | -------- | ---------------------------------------------------------------------------------------------------- |
| `idem0Key` | yes      | Your idem0 client key, sent as `x-idem0-key`. **Not** your provider token.                            |
| `provider` | yes      | `"anthropic"` or `"openai"` — selects the upstream route.                                             |
| `endpoint` | no       | Defaults to the hosted proxy (`https://api.idem0.dev`). Set it only if you self-host idem0.           |

### `idempotencyKey(key)`

The per-call header. Returns `{ "Idempotency-Key": key }` — drop it into a request's `headers`. The key is **caller-owned and passed through verbatim** (idem0 never generates it): use a stable id tied to your unit of work (a job id, an order id) so a retry maps to the same operation.

## BYOK — your provider token stays yours

idem0 only ever handles the `x-idem0-key`. Your provider `apiKey` rides in the provider SDK's own `Authorization` / `x-api-key` header, untouched — idem0 never accepts, stores, or logs it.

## Self-hosting

Running your own idem0 proxy? Pass `endpoint` — a bare host, no path and no `/v1` (the SDK appends the provider-aware path):

```ts
idem0({ endpoint: "https://idem0.internal.acme.com", idem0Key: "…", provider: "anthropic" });
```

---

Part of [idem0](https://idem0.dev). Released under the [MIT License](./LICENSE).
