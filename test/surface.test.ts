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
});
