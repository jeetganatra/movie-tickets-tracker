import { execFileSync, spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadLocalEnv(): void {
  try {
    const contents = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");

    for (const line of contents.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const separator = trimmed.indexOf("=");
      if (separator === -1) {
        continue;
      }

      const key = trimmed.slice(0, separator).trim();
      const value = trimmed.slice(separator + 1).trim();
      process.env[key] ??= value;
    }
  } catch {
    // Next.js can still use values supplied by the parent environment.
  }
}

function readKeychainSecret(
  environmentKey: string,
  serviceKey: string
): void {
  if (process.env[environmentKey]) {
    return;
  }

  const service = process.env[serviceKey];
  const account =
    process.env.AUTH_KEYCHAIN_ACCOUNT || "movie-tickets-tracker";

  if (!service) {
    throw new Error(
      `Set ${environmentKey} or configure ${serviceKey} in .env.local`
    );
  }

  process.env[environmentKey] = execFileSync(
    "/usr/bin/security",
    ["find-generic-password", "-a", account, "-s", service, "-w"],
    { encoding: "utf8" }
  ).trim();
}

loadLocalEnv();
readKeychainSecret("AUTH_SECRET", "AUTH_SECRET_KEYCHAIN_SERVICE");
readKeychainSecret(
  "AUTH_GOOGLE_SECRET",
  "AUTH_GOOGLE_SECRET_KEYCHAIN_SERVICE"
);

const [command, ...args] = process.argv.slice(2);

if (!command) {
  throw new Error("A command is required");
}

const child = spawn(command, args, {
  env: process.env,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
