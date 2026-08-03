import { describe, it, expect } from "vitest";
import { idempotencyKey } from "../src/index";

// T012 [US3] — the idempotency key is caller-owned, verbatim, and required.
describe("idempotencyKey() (US3) — verbatim, caller-owned, required", () => {
  it("returns { 'Idempotency-Key': key } verbatim", () => {
    expect(idempotencyKey("job-42")).toEqual({ "Idempotency-Key": "job-42" });
  });

  it("preserves arbitrary caller strings verbatim (uuid, unicode, punctuation, long)", () => {
    for (const k of [
      "550e8400-e29b-41d4-a716-446655440000",
      "job/42:attempt#3",
      "clé-café-🔑",
      "a".repeat(256),
    ]) {
      expect(idempotencyKey(k)).toEqual({ "Idempotency-Key": k });
    }
  });

  it("is stable: the same key twice → an identical header (never generated)", () => {
    expect(idempotencyKey("stable-key")).toEqual(idempotencyKey("stable-key"));
  });

  it("throws on an empty / whitespace-only key", () => {
    expect(() => idempotencyKey("")).toThrow(TypeError);
    expect(() => idempotencyKey("   ")).toThrow(/key/);
  });
});
