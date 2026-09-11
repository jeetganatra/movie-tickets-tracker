import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: projectRoot,
  serverExternalPackages: ["better-sqlite3", "playwright"],
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
