# launchd Service

MovieTracker can run as a macOS LaunchAgent while keeping the web UI available at:

```text
http://localhost:3000
```

The LaunchAgent uses:

- Label: `com.$USER.movietracker` by default
- Working directory: the checkout where `npm run launchd:install` is run
- Command: `npm run start`
- Logs:
  - `logs/launchd.out.log`
  - `logs/launchd.err.log`

## Install Or Update

```bash
npm run launchd:install
```

This renders `launchd/com.movietracker.plist.template` into:

```text
~/Library/LaunchAgents/com.$USER.movietracker.plist
```

The generated plist captures the current project path and the `npm` executable found on the user's machine.

## Status

```bash
npm run launchd:status
tail -n 100 logs/launchd.out.log
tail -n 100 logs/launchd.err.log
curl http://localhost:3000/api/trackers
```

## Stop

```bash
npm run launchd:stop
```

## Custom Label

Set `MOVIETRACKER_LAUNCHD_LABEL` when installing:

```bash
MOVIETRACKER_LAUNCHD_LABEL=com.example.movietracker npm run launchd:install
```

## Notes

- `scripts/start-cron.ts` has a timeout and skips overlapping cron ticks, so one slow scrape should not block future checks indefinitely.
- If dependencies are rebuilt with a different Node version, run `npm rebuild better-sqlite3` before restarting the service.
