import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { runScraperWorker } from "./tracker-check";
import { withCheckLock } from "./check-lock";

const workerPath = path.join(process.cwd(), "scripts/fixtures/check-worker.cjs");
const row = (id: string) => ({ id }) as Parameters<typeof runScraperWorker>[0];

test("worker returns a result only after exiting", async () => {
  const result = await runScraperWorker(row("ok"), undefined, { workerPath });
  assert.equal(result.tracker.id, "ok");
});

test("worker crashes reject without hanging", async () => {
  await assert.rejects(runScraperWorker(row("fail"), undefined, { workerPath }), /exited with code 1/);
});

test("deadline stops a hung worker", async () => {
  await assert.rejects(runScraperWorker(row("hang"), undefined, { workerPath, timeoutMs: 500 }), /deadline/);
});

test("request cancellation stops worker and pre-aborted requests never start", async () => {
  const controller = new AbortController();
  const promise = runScraperWorker(row("hang"), controller.signal, { workerPath });
  setTimeout(() => controller.abort(), 500);
  await assert.rejects(promise, /cancelled/);
  await assert.rejects(runScraperWorker(row("hang"), controller.signal, { workerPath }), /cancelled/);
});

test("lock rejects overlap and releases after success or failure", async () => {
  let release!: () => void;
  const pending = withCheckLock(() => new Promise<void>((resolve) => { release = resolve; }));
  const busy = await withCheckLock(async () => "unexpected");
  assert.ok(busy instanceof Response);
  assert.equal(busy.status, 409);
  release();
  await pending;
  await assert.rejects(withCheckLock(async () => { throw new Error("failure"); }), /failure/);
  assert.equal(await withCheckLock(async () => "ready"), "ready");
});
