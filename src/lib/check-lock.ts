// Shared across route bundles in the single local Next server process.
const state = globalThis as typeof globalThis & { movieTrackerCheckBusy?: boolean };

export async function withCheckLock<T>(work: () => Promise<T>): Promise<T | Response> {
  if (state.movieTrackerCheckBusy) {
    return Response.json({ error: "A ticket check is already running" }, { status: 409 });
  }
  state.movieTrackerCheckBusy = true;
  try {
    return await work();
  } finally {
    state.movieTrackerCheckBusy = false;
  }
}
