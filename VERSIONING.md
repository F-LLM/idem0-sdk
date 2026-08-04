# Versioning & stability

`@idem0/sdk` follows [Semantic Versioning](https://semver.org/). From **1.0.0** onward, the
commitments below are the contract. They exist so you can pin `^1` and stay on it.

## What "the public API" means here

Covered by this policy:

- the two exported functions, `idem0()` and `idempotencyKey()`;
- the exported types `Idem0Options`, `Idem0ClientConfig`, and `Provider`;
- the wire-level shape of what `idem0()` produces (the `baseURL` path and the `x-idem0-key` header),
  because that is what actually reaches the proxy.

Not covered: anything not exported (`basePathFor`, the `DEFAULT_ENDPOINT` constant as a *symbol*),
the layout of `dist/`, and devDependency versions.

## Frozen — changing these requires a major

**The header name.** The idem0 client key is sent as `x-idem0-key`. The per-call idempotency header
is `Idempotency-Key`. Renaming either is a major.

**`x-idem0-key` is always present.** `idem0()` always returns a `defaultHeaders` containing
`x-idem0-key` set to the `idem0Key` you passed, verbatim. Removing it, renaming it, or transforming
the value is a major.

**`idem0()` takes a single options object.** `idem0({ idem0Key, provider, endpoint? })`. Moving to
positional arguments, making `endpoint` required, or removing `idem0Key`/`provider` is a major.

**`baseURL` and `defaultHeaders` are always there, and always mean the same thing.** `idem0()`
returns an object carrying `baseURL: string` (the proxy route to hand the provider SDK) and
`defaultHeaders: { "x-idem0-key": string, … }` (the client-level headers to send on every request).
Removing either, or repurposing either, is a major.

What is *not* frozen is that these are the only two fields — the return type is open in the same way
`defaultHeaders` is. See "Additive" below.

**The `/v1` asymmetry in `baseURL`.** Anthropic gets `<endpoint>/anthropic` (no `/v1` — the Anthropic
SDK appends `/v1/messages` itself); OpenAI gets `<endpoint>/openai/v1` (the OpenAI SDK's base
normally carries the `/v1`, so this SDK supplies it). This looks like an implementation detail; it is
not. Changing it silently misroutes every request, so it is a major.

**`idempotencyKey()` passes the key through verbatim.** It never generates, hashes, prefixes, or
normalizes a key. Any of those would silently change which requests dedupe against each other, so it
is a major.

**The default endpoint.** With no `endpoint`, requests go to `https://api.idem0.dev`. Pointing the
default at a different host is a major.

**Dual ESM + CJS, Node >= 20.** Dropping either module format, or raising the minimum Node version,
is a major.

## Additive — these ship in a minor

**A new provider in the `Provider` union.** Adding e.g. `"gemini"` does not affect existing callers
passing `"anthropic"` or `"openai"`. See the caveat on exhaustive switches below.

**A new client-level header in `defaultHeaders`.** This is why the type carries an open index
signature rather than the closed `{ "x-idem0-key": string }` it had in 0.x: adding
`x-idem0-version`, a tenant selector, or similar stays a minor instead of forcing a major on a
type-only change. **Do not assert on the exact key set** — see below.

**A new optional field on `Idem0Options`.** Existing call sites keep compiling and keep their current
behavior; the new field's default must preserve it.

**A new top-level field on the `idem0()` return value.** Same reasoning as the header map, one level
up: idem0 may eventually need to configure something client-side that is neither a URL nor a header —
a timeout, or a retry policy aligned with the idempotency semantics, which is squarely the point of
this product. Adding such a field is a minor. It is safe for callers because the intended use is to
spread the result into the provider SDK constructor, where an unknown extra key is inert: TypeScript
applies no excess-property check to a spread, and the provider SDKs ignore options they do not know.
Any field added this way must be optional in effect — omitting it, or running against a provider SDK
that ignores it, must leave existing behavior unchanged.

**A previously-rejected `provider` value becoming valid.** Today an unknown provider throws. If a
later minor adds that provider, the throw becomes a working config. Code that *relies on* an unknown
provider throwing is not a supported use.

## Errors

**The contract: invalid input throws, synchronously, from the call itself.** `idem0()` rejects an
empty or malformed `endpoint` (a non-http(s) or hostless URL), an empty `idem0Key`, and an unknown
`provider`. `idempotencyKey()` rejects an empty or whitespace-only key. It never returns a
half-built config and never silently falls back to a default on a bad *explicit* value — a
self-hosting typo fails loudly instead of misrouting to the hosted proxy.

**Also part of the contract: what is thrown satisfies `instanceof TypeError`.** This is worth
freezing because it costs nothing — a future dedicated class (`Idem0ConfigError extends TypeError`)
keeps `instanceof TypeError` true — while giving you something stable to write in a `catch`. So
introducing such a subclass is a **minor**, not a major; switching to an error type that is *not* a
`TypeError` would be a major.

**Not part of the contract: the message strings.** Messages are descriptive and meant to be read by a
human debugging a misconfiguration. They will be reworded in minors and patches. Do not match on
them. (This SDK's own tests do assert on message fragments — internal tests are deliberately stricter
than the public contract.)

## Explicitly not guaranteed

- **The exact key set of `defaultHeaders.`** `Object.keys(cfg.defaultHeaders)` may grow in a minor.
  Read `cfg.defaultHeaders["x-idem0-key"]`; do not compare the key list.
- **The exact top-level key set of the `idem0()` return value.** Same rule one level up:
  `Object.keys(cfg)` may grow in a minor. Read the fields you need; do not compare the key list.
  Spreading the whole result into the provider SDK constructor — the intended use — is unaffected.
- **Exhaustive `switch` over `Provider`.** If you `switch` on a `Provider` with a `never` exhaustiveness
  check, adding a provider in a minor will fail *your* compile. That is a known and accepted
  consequence of `Provider` being a public union — TypeScript has no way to widen a union additively.
  Add a `default` branch if you want minors to stay drop-in.
- **Error message text**, as above.

## Deprecation

Anything on the removal path is marked `@deprecated` in a minor, keeps working for the rest of the
major, and is removed only in the next major. No removals without a released deprecation first.
