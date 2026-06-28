import { execFileSync, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";

const account = "movie-tickets-tracker";
const authSecretService = "MovieTracker-Auth-Secret";
const googleSecretService = "MovieTracker-Google-OAuth-Secret";

execFileSync(
  "/usr/bin/security",
  [
    "add-generic-password",
    "-U",
    "-a",
    account,
    "-s",
    authSecretService,
    "-w",
    randomBytes(32).toString("base64url"),
  ],
  { stdio: "ignore" }
);

console.log("[Auth] Generated and stored the Auth.js session secret.");
console.log("[Auth] Enter the Google OAuth client secret at the secure prompt.");

const result = spawnSync(
  "/usr/bin/security",
  [
    "add-generic-password",
    "-U",
    "-a",
    account,
    "-s",
    googleSecretService,
    "-w",
  ],
  { stdio: "inherit" }
);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log("[Auth] Google OAuth client secret stored in macOS Keychain.");
