// @idem0/sdk — the entire public surface (a config producer, not a client).
//
// Two pure functions turn "route my LLM calls through the idem0 proxy with
// idempotency" into two spread-in calls, WITHOUT wrapping the provider SDK:
//   - idem0(options)      → client-level config to spread into the provider
//                           SDK constructor (set ONCE): { baseURL, defaultHeaders }
//   - idempotencyKey(key) → the per-call header to drop into request options
//
// The SDK is token-agnostic (BYOK): it never accepts, stores, or emits the
// provider token — that stays in the caller's provider-SDK `apiKey`. It owns
// its own tiny types (no `@idem0/core` import) and has zero runtime deps.

/** The upstreams idem0 routes today — also the proxy path selectors. */
export type Provider = "anthropic" | "openai";

export interface Idem0Options {
  /**
   * OPTIONAL. Omit it to target the hosted idem0 proxy (the default,
   * `https://api.idem0.dev`). Pass it ONLY to point at a self-hosted proxy:
   * a bare host (no selector, no `/v1`) — the SDK appends the provider-aware
   * path itself. When provided it must be a well-formed absolute http(s) URL.
   */
  endpoint?: string;
  /** The idem0 client key — sent as `x-idem0-key`. NOT the provider token (BYOK). */
  idem0Key: string;
  /** Which upstream this client targets; also the proxy path selector. */
  provider: Provider;
}

export interface Idem0ClientConfig {
  /** `<endpoint>/anthropic` or `<endpoint>/openai/v1` — spread into the provider SDK constructor's `baseURL`. */
  baseURL: string;
  /**
   * Spread into the provider SDK constructor's `defaultHeaders`.
   *
   * `x-idem0-key` is GUARANTEED present — that part of the contract is frozen.
   * The open index signature is deliberate forward-compat room: adding a
   * client-level header later (`x-idem0-version`, a tenant selector, …) stays a
   * MINOR release instead of a breaking type change, and callers may merge their
   * own headers in without a cast. Never carries the provider token — that stays
   * in the caller's provider-SDK `apiKey` (BYOK).
   */
  defaultHeaders: {
    "x-idem0-key": string;
    [header: string]: string;
  };
}

/**
 * The path idem0 appends after the endpoint, per provider.
 *
 * Provider-aware `/v1` asymmetry (verified against the real SDKs + the proxy):
 * the Anthropic SDK's base is `https://api.anthropic.com` and it appends
 * `/v1/messages`, so Anthropic needs no `/v1` here; the OpenAI SDK's base is
 * `https://api.openai.com/v1` (the `/v1` lives in the base) and it appends only
 * `/chat/completions`, so idem0 must supply the `/v1`. The proxy strips the
 * first selector segment and forwards the rest verbatim, so the requests arrive
 * as `…/anthropic/v1/messages` and `…/openai/v1/chat/completions`.
 *
 * Takes `string` (not `Provider`) so the `default` guard is reachable for JS
 * callers who bypass the type system.
 */
function basePathFor(provider: string): string {
  switch (provider) {
    case "anthropic":
      return "anthropic";
    case "openai":
      return "openai/v1";
    default:
      throw new TypeError(
        `idem0: unknown provider ${JSON.stringify(provider)} — expected "anthropic" or "openai".`,
      );
  }
}

/**
 * The hosted idem0 proxy — the default `endpoint`. Callers on the hosted service
 * write `idem0({ idem0Key, provider })` and never pass an endpoint; self-hosters
 * override it via `idem0({ endpoint, … })`. Change this one line if the canonical
 * proxy host ever moves. Kept module-private on purpose: the public runtime surface
 * stays exactly the two functions (asserted by surface.test.ts) — this is a config
 * default, not part of the API contract.
 */
const DEFAULT_ENDPOINT = "https://api.idem0.dev";

/**
 * Build the client-level idem0 config to spread into the provider SDK constructor
 * (`new Anthropic({ ...idem0(...) })` / `new OpenAI({ ...idem0(...) })`). Set once per
 * client. On the hosted service call `idem0({ idem0Key, provider })` — `endpoint`
 * defaults to the hosted proxy; pass `endpoint` only when self-hosting.
 */
export function idem0(options: Idem0Options): Idem0ClientConfig {
  const { endpoint, idem0Key, provider } = options;

  // `endpoint` is OPTIONAL. Omitted (undefined) → the hosted proxy DEFAULT_ENDPOINT,
  // a known-valid constant that needs no validation. Provided → validated STRICTLY, as
  // a self-hosted URL must be: a malformed EXPLICIT endpoint fails fast HERE rather than
  // silently misrouting (stripping the authority "//" from "https://" would otherwise
  // yield "https:/anthropic" → host "anthropic"). We NEVER fall back to the default on a
  // bad explicit value — that would mask a self-host misconfiguration.
  let trimmedEndpoint: string;
  if (endpoint === undefined) {
    trimmedEndpoint = DEFAULT_ENDPOINT;
  } else {
    if (typeof endpoint !== "string" || endpoint.trim() === "") {
      throw new TypeError(
        "idem0: `endpoint`, when provided, must be a non-empty string (a self-hosted idem0 proxy base URL) — omit it to use the hosted idem0 proxy.",
      );
    }
    trimmedEndpoint = endpoint.trim();
    let parsed: URL;
    try {
      parsed = new URL(trimmedEndpoint);
    } catch {
      throw new TypeError(
        `idem0: \`endpoint\` must be a valid absolute URL, e.g. "https://proxy.example.com" (got ${JSON.stringify(endpoint)}).`,
      );
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new TypeError(
        `idem0: \`endpoint\` must be an http(s) URL, e.g. "https://proxy.example.com" (got protocol ${JSON.stringify(parsed.protocol)}).`,
      );
    }
  }
  if (typeof idem0Key !== "string" || idem0Key.trim() === "") {
    throw new TypeError(
      "idem0: `idem0Key` must be a non-empty string (the idem0 client key sent as `x-idem0-key`).",
    );
  }
  const basePath = basePathFor(provider); // throws on an unknown provider
  const base = trimmedEndpoint.replace(/\/+$/, ""); // trim trailing slashes → never `<host>//<selector>`
  return {
    baseURL: `${base}/${basePath}`,
    defaultHeaders: { "x-idem0-key": idem0Key },
  };
}

/**
 * Build the per-call idempotency header — drop it into the request options
 * `{ headers }` (e.g. `messages.create(params, { headers: idempotencyKey(key) })`).
 * The key is caller-owned and passed through verbatim (never generated).
 */
export function idempotencyKey(key: string): { "Idempotency-Key": string } {
  if (typeof key !== "string" || key.trim() === "") {
    throw new TypeError(
      "idempotencyKey: `key` must be a non-empty string (a stable, caller-owned idempotency key).",
    );
  }
  return { "Idempotency-Key": key };
}
