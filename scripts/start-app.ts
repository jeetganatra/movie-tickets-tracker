import { spawn, type ChildProcess } from "node:child_process";

const mode = process.argv[2];

if (mode !== "dev" && mode !== "start") {
  throw new Error('Expected mode "dev" or "start"');
}

const children: ChildProcess[] = [
  spawn("next", [mode], {
    env: process.env,
    stdio: "inherit",
  }),
  spawn("node", ["--import", "tsx", "scripts/start-cron.ts"], {
    env: process.env,
    stdio: "inherit",
  }),
];

let stopping = false;

function stop(signal: NodeJS.Signals): void {
  if (stopping) {
    return;
  }

  stopping = true;
  children.forEach((child) => child.kill(signal));
}

process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));

children.forEach((child) => {
  child.on("exit", (code, signal) => {
    if (!stopping) {
      stop("SIGTERM");
    }

    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 1);
  });
});
