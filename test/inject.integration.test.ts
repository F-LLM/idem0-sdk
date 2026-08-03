import { describe, it, expect } from "vitest";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { idem0, idempotencyKey } from "../src/index";

// T013 [US1 + US2 + P11] — the PROOF: inject the idem0 config into the REAL
// @anthropic-ai/sdk + openai clients and capture the outbound request (via the
// constructor `fetch` override — order-independent, no global mutation, no
// network). This is the sole task proving FR-003 (both idem0 headers on the
// wire together). It FAILS if the OpenAI baseURL loses its `/v1`.

const ENDPOINT = "https://proxy.example.com";
const IDEM0_KEY = "idem0-live-key-abc";

interface Captured {
  url: string;
  headers: Record<string, string>;
}

/** A capturing `fetch` that records the outbound request and returns a canned 200 JSON. */
function makeCapture(body: unknown): { calls: Captured[]; fetch: typeof fetch } {
  const calls: Captured[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const req = input instanceof Request ? input : new Request(input, init);
    calls.push({ url: req.url, headers: Object.fromEntries(req.headers) }); // header keys are lowercased
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  return { calls, fetch: fetchImpl };
}

describe("integration — inject idem0 config into the REAL provider SDKs (US1 + US2 + P11)", () => {
  it("Anthropic → <endpoint>/anthropic/v1/messages, idem0 headers present, BYOK token intact", async () => {
    const { calls, fetch } = makeCapture({
      id: "msg_1",
      type: "message",
      role: "assistant",
      content: [],
      model: "claude-opus-4-8",
      stop_reason: "end_turn",
      stop_sequence: null,
      usage: { input_tokens: 1, output_tokens: 1 },
    });
    const client = new Anthropic({
      apiKey: "sk-ant-test",
      fetch,
      ...idem0({ endpoint: ENDPOINT, idem0Key: IDEM0_KEY, provider: "anthropic" }),
    });

    await client.messages.create(
      { model: "claude-opus-4-8", max_tokens: 16, messages: [{ role: "user", content: "ping" }] },
      { headers: idempotencyKey("job-42") },
    );

    expect(calls).toHaveLength(1);
    const call = calls[0]!;
    expect(call.url).toBe("https://proxy.example.com/anthropic/v1/messages");
    expect(call.headers["x-idem0-key"]).toBe(IDEM0_KEY);
    expect(call.headers["idempotency-key"]).toBe("job-42");
    // BYOK: the provider token rides untouched, and idem0 never altered it (P11)
    expect(call.headers["x-api-key"]).toBe("sk-ant-test");
  });

  it("OpenAI → <endpoint>/openai/v1/chat/completions (the corrected /v1), idem0 headers present, BYOK token intact", async () => {
    const { calls, fetch } = makeCapture({
      id: "cmpl_1",
      object: "chat.completion",
      created: 0,
      model: "gpt-4o-mini",
      choices: [],
    });
    const client = new OpenAI({
      apiKey: "sk-oai-test",
      fetch,
      ...idem0({ endpoint: ENDPOINT, idem0Key: IDEM0_KEY, provider: "openai" }),
    });

    await client.chat.completions.create(
      { model: "gpt-4o-mini", messages: [{ role: "user", content: "ping" }] },
      { headers: idempotencyKey("job-42") },
    );

    expect(calls).toHaveLength(1);
    const call = calls[0]!;
    // The /v1 MUST be here — this assertion fails if idem0's OpenAI baseURL regresses to <endpoint>/openai.
    expect(call.url).toBe("https://proxy.example.com/openai/v1/chat/completions");
    expect(call.headers["x-idem0-key"]).toBe(IDEM0_KEY);
    expect(call.headers["idempotency-key"]).toBe("job-42");
    // BYOK: the provider token rides untouched (P11)
    expect(call.headers["authorization"]).toBe("Bearer sk-oai-test");
  });
});
