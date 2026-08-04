import { describe, it, expect } from "vitest";
import * as sdk from "../src/index";

// T014 [US4] — the SDK is a config producer, not a client.
describe("public surface (US4) — config producer, not a client", () => {
  it("exposes exactly the two functions at runtime — no provider client / method wrapper", () => {
    expect(Object.keys(sdk).sort()).toEqual(["idem0", "idempotencyKey"]);
    expect(typeof sdk.idem0).toBe("function");
    expect(typeof sdk.idempotencyKey).toBe("function");
    // no wrapped provider surface leaked
    expect(sdk).not.toHaveProperty("messages");
    expect(sdk).not.toHaveProperty("chat");
    expect(sdk).not.toHaveProperty("Anthropic");
    expect(sdk).not.toHaveProperty("OpenAI");
  });

  it("idem0's input type carries no provider-token field (compile-time guard)", () => {
    // @ts-expect-error — Idem0Options has no `apiKey`/token property; adding one MUST fail to compile.
    const bad: sdk.Idem0Options = { endpoint: "https://h", idem0Key: "k", provider: "anthropic", apiKey: "sk-x" };
    void bad;
  });

  it("defaultHeaders is open to extra headers but still requires x-idem0-key (compile-time guard)", () => {
    // Extra client-level headers must type-check — this is what keeps adding one
    // (x-idem0-version, a tenant selector, …) a MINOR release after 1.0.0.
    const widened: sdk.Idem0ClientConfig["defaultHeaders"] = {
      "x-idem0-key": "k",
      "x-idem0-version": "1",
    };
    expect(widened["x-idem0-version"]).toBe("1");

    // …but the guarantee is not lost: omitting x-idem0-key MUST fail to compile.
    // @ts-expect-error — `x-idem0-key` is required.
    const missing: sdk.Idem0ClientConfig["defaultHeaders"] = { "x-idem0-version": "1" };
    void missing;
  });
});
