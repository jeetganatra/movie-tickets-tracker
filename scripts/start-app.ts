import { spawn, type ChildProcess } from "node:child_process";

type ManagedProcess = {
  name: string;
  process: ChildProcess;
  exited: boolean;
};

const children: ManagedProcess[] = [];
let shuttingDown = false;

function startProcess(name: string, command: string, args: string[]): void {
  const child = spawn(command, args, {
    stdio: "inherit",
    env: process.env,
  });

  const managed: ManagedProcess = {
    name,
    process: child,
    exited: false,
  };

  children.push(managed);

  child.on("exit", (code, signal) => {
    managed.exited = true;

    if (shuttingDown) {
      return;
    }

    const status = signal ? `signal ${signal}` : `code ${code ?? "unknown"}`;
    console.error(
      `[Supervisor] ${name} exited with ${status}; stopping service for launchd restart`
    );
    void shutdown(code === 0 ? 1 : code ?? 1);
  });

  child.on("error", (error) => {
    if (!shuttingDown) {
      console.error(`[Supervisor] Failed to start ${name}:`, error);
      void shutdown(1);
    }
  });
}

async function shutdown(exitCode: number): Promise<void> {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  for (const child of children) {
    if (!child.exited && child.process.pid) {
      child.process.kill("SIGTERM");
    }
  }

  const killTimer = setTimeout(() => {
    for (const child of children) {
      if (!child.exited && child.process.pid) {
        child.process.kill("SIGKILL");
      }
    }
    process.exit(exitCode);
  }, 5000);
  killTimer.unref();

  await Promise.all(
    children.map(
      (child) =>
        new Promise<void>((resolve) => {
          if (child.exited) {
            resolve();
            return;
          }

          child.process.once("exit", () => resolve());
        })
    )
  );

  process.exit(exitCode);
}

process.on("SIGINT", () => {
  void shutdown(0);
});

process.on("SIGTERM", () => {
  void shutdown(0);
});

process.on("uncaughtException", (error) => {
  console.error("[Supervisor] Uncaught exception:", error);
  void shutdown(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("[Supervisor] Unhandled rejection:", reason);
  void shutdown(1);
});

console.log("[Supervisor] Starting web and cron processes");
startProcess("web", "next", ["start"]);
startProcess("cron", process.execPath, ["--import", "tsx", "scripts/start-cron.ts"]);
