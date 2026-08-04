# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/). From 1.0.0 onward, what counts as a breaking
change is spelled out in [VERSIONING.md](./VERSIONING.md).

## [1.0.0] - 2026-08-05

First stable release. The API is unchanged from 0.1.1 apart from the type widening below; the point
of 1.0.0 is the commitment, not new surface.

### Added

- **Stability policy** ([VERSIONING.md](./VERSIONING.md)) — what is frozen until 2.0.0, what ships
  additively in a minor, and the status of thrown errors.
- Anthropic and OpenAI are both supported providers, each with its own proxy route: Anthropic resolves
  to `<endpoint>/anthropic` (no `/v1` — the Anthropic SDK appends `/v1/messages` itself), OpenAI to
  `<endpoint>/openai/v1` (the OpenAI SDK omits it). This asymmetry is now a frozen part of the contract.

### Changed

- **`Idem0ClientConfig["defaultHeaders"]` is now open to additional headers.** It was the closed
  literal `{ "x-idem0-key": string }`; it is now `{ "x-idem0-key": string; [header: string]: string }`.
  `x-idem0-key` remains guaranteed present — omitting it still fails to compile. This is forward
  compatibility bought before 1.0.0 freezes the type: adding a client-level header later
  (`x-idem0-version`, a tenant selector, …) is now a minor instead of a breaking type change.
  Type-level only — the emitted JavaScript is byte-for-byte identical.

  Consumers asserting on the *exact* key set (`Object.keys(defaultHeaders)`) should read
  `defaultHeaders["x-idem0-key"]` instead; the key set is explicitly not guaranteed.

## [0.1.1] - 2026-08-03

### Fixed

- Documentation examples referenced models that no longer matched the provider docs; aligned on
  `claude-haiku-4-5` and `gpt-5-nano`.

## [0.1.0] - 2026-08-02

Initial pre-stable release: `idem0()` and `idempotencyKey()`, BYOK (the provider token never reaches
idem0), zero runtime dependencies, dual ESM + CJS.

[1.0.0]: https://github.com/F-LLM/idem0-sdk/releases/tag/v1.0.0
[0.1.1]: https://github.com/F-LLM/idem0-sdk/releases/tag/v0.1.1
[0.1.0]: https://github.com/F-LLM/idem0-sdk/releases/tag/v0.1.0
