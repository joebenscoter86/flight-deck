# Phase 0 results

**Decision (Step 1 only): server mode works. Build Phases 1 and 2 as written.** Headless `claude -p` sees the account's connectors once the CLI is signed in. Three things the test turned up need fixing before the pull is right; they are listed under "Second run". Steps 2 to 5 are still open.

## Step 1: does headless `claude -p` see the connectors?

**PASS on the second run.** The first run failed on sign-in, which is its own finding.

### First run

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

### Second run (after `claude auth login`)

Same command, clean environment. The session listed 30 Gmail tools and 9 Google Calendar tools, and reported that a Slack connector exists on the account but is not authorized, so it had no Slack tools.

1. **Connectors reach a headless session with no extra config.** No `--mcp-config` needed. Tool names are `mcp__claude_ai_Gmail__*` and `mcp__claude_ai_Google_Calendar__*`.
2. **The pull prompt names tools that no longer exist.** It tells Claude to call `gcal_list_events`, `gmail_search_messages`, `gmail_read_message`, `slack_search_public_and_private` and so on. Today's names are `mcp__claude_ai_Google_Calendar__list_events`, `mcp__claude_ai_Gmail__search_threads`, `mcp__claude_ai_Gmail__get_thread`. Connector tool names change; the prompt should describe what to do ("search Gmail for unread inbox threads") and let Claude pick the tool, not hard-code names.
3. **A connector can exist but be unauthorized.** Joe's own account is the "core source missing" case from spec 3a: Slack is listed but not connected. Setup must test each core source by actually listing its tools, not by asking the user, and the pull must skip a source that has no tools without failing the run.
4. **The pull session can send and delete, not just read.** With `--permission-mode bypassPermissions` the headless session holds `Gmail__send_message`, `reply`, `forward`, `trash_thread`, `Google_Calendar__delete_event`, plus Bash. It reads untrusted text (every unread email) every hour. An email written to instruct the model could get mail sent or deleted from the user's account. The spec says sending email is out of scope; the pull should enforce it by restricting the session to read tools and the local write-back (`--allowedTools` / `--disallowedTools`), and the "what leaves your computer" section of the guide should not be written until that is in.

## Steps 2 to 5

Not started.

## Follow-up the same day: locking the session down, and a live refresh

Tested on Joe's Mac, CLI 2.1.208:

- `--tools ToolSearch --allowedTools <rules>` in default permission mode gives a session with no shell that can still find and call connector tools. A tool not on the list is refused and shows up in `permission_denials`.
- Allow rules accept a trailing wildcard inside a tool name: `mcp__claude_ai_Gmail__list_l*` allowed `list_labels` and refused `list_drafts`. So read access can be granted by verb (`get_*`, `list_*`, `search_*`...) without knowing exact tool names.
- `claude mcp list` prints each connector with Connected or Needs authentication, without running a model.
- With `ENABLE_TOOL_SEARCH=false` every tool (571 on this Mac) loads up front; one trivial run reported $11 of notional usage against about $0.50 with ToolSearch. Do not use it.

Live refresh through the rebuilt pull, scratch state folder: finished in 43 seconds, exit 0, no refused calls. Gmail was searched (201 unread in 14 days, none from a person waiting on Joe, so no tasks). Google Calendar showed Connected in `claude mcp list` but returned "token expired" when read; the run reported it and left the meeting list alone. Slack was skipped as not connected. Nothing was written to Joe's real state.
