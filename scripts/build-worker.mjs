import { build } from "esbuild";

await build({
  entryPoints: ["scripts/check-worker.ts"],
  outfile: ".worker/check-worker.cjs",
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  packages: "external",
  // Playwright serializes page callbacks; injected name helpers cannot follow them.
  keepNames: false,
});
