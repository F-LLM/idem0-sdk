import { defineConfig } from "vitest/config";

// Pure/offline unit + integration tests (Node environment — the SDK does no
// I/O; the integration test stubs the provider SDKs' `fetch`). Istanbul
// coverage with a strict > 70% gate on the SDK source (P10).
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    coverage: {
      provider: "istanbul",
      include: ["src/**"],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
      },
    },
  },
});
