import { describe, it, expect } from "vitest";
import { idem0, type Provider } from "../src/index";

const ENDPOINT = "https://proxy.example.com";
const KEY = "idem0-live-key-123";

// T010 [US1] — Anthropic config + the general idem0() guards.
describe("idem0() — Anthropic (US1) + general guards", () => {
  it("returns baseURL <endpoint>/anthropic (no /v1) + the x-idem0-key header", () => {
    const cfg = idem0({ endpoint: ENDPOINT, idem0Key: KEY, provider: "anthropic" });
    expect(cfg.baseURL).toBe("https://proxy.example.com/anthropic");
    expect(cfg.baseURL).not.toContain("/v1"); // the Anthropic SDK appends /v1/messages itself
    // `x-idem0-key` must be PRESENT and verbatim — not necessarily alone (the
    // header map is open by design, so a future client header stays non-breaking).
    expect(cfg.defaultHeaders["x-idem0-key"]).toBe(KEY);
  });

  it("normalizes trailing slashes, including multiple (never //)", () => {
    for (const ep of ["https://h/", "https://h//", "https://h///"]) {
      expect(idem0({ endpoint: ep, idem0Key: KEY, provider: "anthropic" }).baseURL).toBe(
        "https://h/anthropic",
      );
    }
    // a sub-path proxy endpoint is preserved
    expect(idem0({ endpoint: "https://h/proxy/", idem0Key: KEY, provider: "anthropic" }).baseURL).toBe(
      "https://h/proxy/anthropic",
    );
  });

  it("throws on empty endpoint / empty idem0Key / unknown provider", () => {
    expect(() => idem0({ endpoint: "", idem0Key: KEY, provider: "anthropic" })).toThrow(TypeError);
    expect(() => idem0({ endpoint: "   ", idem0Key: KEY, provider: "anthropic" })).toThrow(/endpoint/);
    expect(() => idem0({ endpoint: ENDPOINT, idem0Key: "", provider: "anthropic" })).toThrow(TypeError);
    expect(() => idem0({ endpoint: ENDPOINT, idem0Key: "  ", provider: "anthropic" })).toThrow(/idem0Key/);
    // a JS caller bypassing the type system with an unknown provider:
    expect(() =>
      idem0({ endpoint: ENDPOINT, idem0Key: KEY, provider: "gemini" as Provider }),
    ).toThrow(/unknown provider/);
  });

  it("rejects a malformed / hostless / non-http endpoint (fail fast, never a silent misroute)", () => {
    // These pass a naive non-empty check but must NOT yield a config that
    // silently misroutes (e.g. "https://" → host "anthropic").
    for (const bad of ["https://", "http://", "https:///", "https://///", "/", " / ", "not-a-url", "://nohost", "http://:80", "ftp://host"]) {
      expect(() => idem0({ endpoint: bad, idem0Key: KEY, provider: "anthropic" }), bad).toThrow(TypeError);
    }
  });

  it("trims surrounding whitespace on the endpoint (guard and producer agree)", () => {
    expect(
      idem0({ endpoint: "  https://proxy.example.com  ", idem0Key: KEY, provider: "anthropic" }).baseURL,
    ).toBe("https://proxy.example.com/anthropic");
  });

  it("is token-agnostic: the output exposes ONLY baseURL + defaultHeaders (no token field)", () => {
    const cfg = idem0({ endpoint: ENDPOINT, idem0Key: KEY, provider: "anthropic" });
    expect(Object.keys(cfg).sort()).toEqual(["baseURL", "defaultHeaders"]);
    // The header map is intentionally OPEN (forward-compat), so assert the
    // invariant that actually matters: `x-idem0-key` is there, and NO header is
    // token-shaped — rather than pinning the exact key list.
    expect(cfg.defaultHeaders).toHaveProperty("x-idem0-key", KEY);
    for (const name of Object.keys(cfg.defaultHeaders)) {
      expect(name).not.toMatch(/^(authorization|x-api-key)$/i);
    }
    // nothing token-shaped leaks into the config
    expect(JSON.stringify(cfg)).not.toMatch(/sk-|bearer|authorization|x-api-key/i);
  });
});

// T011 [US2] — OpenAI config: the /v1 asymmetry (the corrected behavior).
describe("idem0() — OpenAI (US2): the /v1 asymmetry", () => {
  it("returns baseURL <endpoint>/openai/v1 (WITH /v1 — the OpenAI SDK omits it)", () => {
    const cfg = idem0({ endpoint: ENDPOINT, idem0Key: KEY, provider: "openai" });
    expect(cfg.baseURL).toBe("https://proxy.example.com/openai/v1");
    expect(cfg.defaultHeaders["x-idem0-key"]).toBe(KEY);
  });

  it("normalizes trailing slashes for openai too", () => {
    expect(idem0({ endpoint: "https://h//", idem0Key: KEY, provider: "openai" }).baseURL).toBe(
      "https://h/openai/v1",
    );
  });
});

// T015 — `endpoint` is OPTIONAL: omitted → the hosted default (https://api.idem0.dev).
describe("idem0() — default endpoint (hosted proxy) when endpoint is omitted", () => {
  it("Anthropic: no endpoint → https://api.idem0.dev/anthropic (no /v1)", () => {
    expect(idem0({ idem0Key: KEY, provider: "anthropic" }).baseURL).toBe(
      "https://api.idem0.dev/anthropic",
    );
  });

  it("OpenAI: no endpoint → https://api.idem0.dev/openai/v1 (the /v1 asymmetry preserved)", () => {
    expect(idem0({ idem0Key: KEY, provider: "openai" }).baseURL).toBe(
      "https://api.idem0.dev/openai/v1",
    );
  });

  it("still carries the x-idem0-key header with the default endpoint", () => {
    expect(idem0({ idem0Key: KEY, provider: "anthropic" }).defaultHeaders).toHaveProperty(
      "x-idem0-key",
      KEY,
    );
  });

  it("an explicit endpoint still overrides the default (self-host), and its guards still bite", () => {
    // override honored
    expect(
      idem0({ endpoint: "https://self.example.com", idem0Key: KEY, provider: "anthropic" }).baseURL,
    ).toBe("https://self.example.com/anthropic");
    // an EXPLICIT bad endpoint is NOT silently replaced by the default — it fails fast
    expect(() => idem0({ endpoint: "", idem0Key: KEY, provider: "anthropic" })).toThrow(/endpoint/);
    expect(() => idem0({ endpoint: "not-a-url", idem0Key: KEY, provider: "anthropic" })).toThrow(
      TypeError,
    );
  });
});
