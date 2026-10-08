# Phase 0 results

**Decision: none yet.** Step 1 is blocked on a sign-in, and that blocker is itself a finding (below).

## Step 1: does headless `claude -p` see the connectors?

**Not answered. The command never got as far as listing tools.**

Run on Joe's Mac, 2026-10-08, CLI 2.1.208 at `~/.local/bin/claude`, from inside a Claude Desktop Code session and again with a clean environment (`env -i` with only `HOME`, `PATH`, `USER`, which is what launchd gives the server):

```
claude -p --permission-mode bypassPermissions --setting-sources user,project,local "List the names of every MCP tool you have whose name contains slack, gmail, gcal or calendar ..."
Failed to authenticate: OAuth session expired and could not be refreshed
```

Both runs failed the same way.

### What this tells us already

- **The CLI's sign-in is separate from the desktop app's.** Joe was signed in to the desktop app (this session was running in it) while the CLI binary on the same Mac had an expired session.
- **It expires, and the server cannot fix it.** The hourly pull shells out to that binary from launchd. When the CLI session lapses, every pull fails until a person signs in again. For a non-technical user that looks like "my list stopped updating" with no visible cause.
- So even if Step 1 passes after signing in, server mode needs: (a) the runbook to confirm the CLI is signed in during setup (Phase 0 Step 2 covers whether a desktop-only user has a signed-in CLI at all), and (b) the app to detect an auth failure in the pull and say so in the UI ("Claude needs you to sign in again") instead of silently showing a stale list. Neither is in the plan yet.

### To finish Step 1

Joe signs the CLI in (`claude auth login` in a terminal, or run `claude` and use `/login`), then rerun the command above. Record the tool names, or NONE, here.

## Steps 2 to 5

Not started.
