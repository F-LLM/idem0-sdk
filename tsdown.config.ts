import { defineConfig } from "tsdown";

// Dual ESM + CJS build with format-matched declarations (.d.mts / .d.cts).
// tsdown is a DEV dependency only — it bundles at build time and adds no
// runtime dependency (the published package keeps `"dependencies": {}`).
//
// publint + attw are deliberately NOT enabled here. To run them, tsdown packs the
// package internally (`npm pack --pack-destination <tmp>`); nested inside
// `npm publish`'s `prepublishOnly` that inner pack fails to locate its tarball
// ("Failed to find packed tarball file"), aborting the publish — even though the
// package itself is valid. They are run standalone via `npm run check:pkg`
// (dev/CI), where no outer pack is in flight. `build` therefore stays a PURE
// artifact build and is safe on the publish path — the published files are identical.
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
});
