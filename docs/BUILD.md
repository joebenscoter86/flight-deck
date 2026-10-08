# Building Flight Deck

Read this first if you are an agent (or a person) changing this repo. `CLAUDE.md` at the root is the end-user setup runbook, not build instructions; it gets rewritten in Task 8.

## What this repo is for

Flight Deck is an open-source giveaway. Joe makes videos about using Claude at work; viewers comment a keyword and get sent this repo. He also hands it to friends and family when they set up Claude. Every decision follows from who receives it:

- **The person is not technical.** A knowledge worker on a brand-new computer who has never opened a terminal, GitHub or npm. They give the repo link to Claude and Claude builds it. If a step needs them to type a command, the step is wrong.
- **Cold start.** Assume nothing is installed: no Node, no Homebrew, no CLI. The runbook installs what is missing and warns before any password prompt.
- **The repo works out of the box.** All code ships in the repo. Setup is clone, install, answer a handful of questions, done. No build step, no accounts to create, no API keys for the default path.
- **Two readers.** The README and runbook are written for the agent doing the install, with the user watching. Product copy the user sees is plain language, no jargon, no em dashes.
- **It is a scaffold for the user's own tools.** Gmail, Slack and Google Calendar are the core three because that is most of a knowledge worker's day. Setup expects all three and carries on with whichever are available. Beyond those, the list should pull from any other connector the user already has in Claude (Monday.com, Asana, Linear, and so on) without code changes. See spec section 3a.
- **GuideCX and Fathom are legacy.** They are direct-API sources from Joe's previous job. They stay in the code, off by default, documented only for power users. Do not design new features around them; new sources go through connectors (spec 3a).

## Documents

- Spec: [docs/superpowers/specs/2026-10-08-flight-deck-design.md](superpowers/specs/2026-10-08-flight-deck-design.md)
- Plan: [docs/superpowers/plans/2026-10-08-flight-deck-build-plan.md](superpowers/plans/2026-10-08-flight-deck-build-plan.md), tasks in three phases, executed task by task.
- Phase 0 (manual tests) decides whether server mode's hourly pull works for a desktop-app user. Results go in `docs/decisions/`. Phase 1 can start before Phase 0 is done.
- Pre-change state is preserved on branch `hit-list-legacy`.
- The paths in the plan are relative to this repo. The script and reel project it serves live in Joe's Content repo under `brands/joe-b/writing-room/reels/2026-10-07-slack-email-hit-list/`, so those links are dead from here.

## This build spans many sessions

No single session finishes this. Before you start, read the Status table below and the plan task you are picking up. When you stop, update the table in the same commit as your work: what is done, what is half done, and anything the next session must know. Commit after every task. Record test results and decisions in `docs/decisions/`, not in chat.

## Status

| Task | State | Notes |
|---|---|---|
| 0. Phase 0 manual tests | Step 1 PASS | Headless pull sees Gmail and Calendar connectors; server mode goes ahead. Slack is not authorized on Joe's account. Steps 2 to 5 open. See `docs/decisions/2026-10-08-phase-0-results.md`. |
| 1. Rename to Flight Deck | Done | GitHub repo renamed to `joebenscoter86/flight-deck` on 2026-10-08. |
| 2. Test harness | Done | `npm test` runs `node --test tests/*.test.js` (a bare `tests/` directory argument fails on current Node). Installs and runs on Node 25. |
| 3. Hourly refresh | Done | Checked live with a 1-minute interval. What the pull does when the CLI is signed out is not handled; see Known plan fixes 6. |
| 4. Corrections and triage rules | Done in code | Unit tested. Not yet seen live: ten real tier changes followed by a pull that rewrites `triage.md`. |
| 5. Waiting days in red | Done | Checked in the browser. Age counts from when Flight Deck first saw the item; see Known plan fixes 5. |
| 6. Claude Desktop button | Done in code | Fix 2 applied and tested. Not yet clicked for real: confirm Claude Desktop opens the Code tab with the prompt filled in (plan Task 6 Step 5). |
| 7. Beginner config | Done | |
| 7b. Sources scaffold | Done in code | Live refresh ran against Gmail and Calendar on 2026-10-08. Slack path and extra sources are built but untested (no Slack on Joe's account; no extra connector tried). |
| 8. Runbook and README | Written, not dry-run | `CLAUDE.md` and `README.md` rewritten for the new pull. Still to do: plan Task 8 Step 3, a cold run from the pasted prompt on a Mac without Flight Deck, logged in `docs/decisions/`. `npm run install:agent` has not been run since the rename. README has no screenshot yet. |
| 9. Guide page | Not started | Lives in the site repo. |
| 10. Folder mode | Not started | Gated on Phase 0. |

## How the pull works now (differs from the plan)

The plan had the headless session write tasks back itself with `curl`, under `bypassPermissions`. That was replaced on 2026-10-08 because the session reads untrusted text and held send and delete tools plus a shell. Now:

1. `claude mcp list` (no model run) says which connectors are connected. `src/sources.js` matches them to the configured sources.
2. One `claude -p` session runs with `--tools ToolSearch` (no shell, no files), default permission mode, and `--allowedTools` limited to read-style tool names on the connectors in use. It prints one JSON document after `RESULT_JSON:`.
3. `src/pipeline/ingest.js` validates that JSON and writes it. Learned triage rules come back in the same JSON, so nothing is saved by curl.

The prompt names no connector tools; the session finds them with ToolSearch. Do not reintroduce `bypassPermissions`, Bash, or hard-coded tool names. Do not set `ENABLE_TOOL_SEARCH=false`: it loads every tool up front and one run cost about twenty times more.

## Open items for the next session

- **Usage per pull.** The pull now defaults to `sonnet` and Gmail only reads mail since the last refresh. Measured on Joe's Mac: first run (two weeks of mail) about $1.40 notional, steady-state hourly run about $0.77 and 42 seconds. Much of the steady cost is Joe's own plugins loading into the session (`--setting-sources user` is required; without it the connectors do not load). Measure on a clean account before deciding whether hourly is too often.
- **A connector can say Connected and still fail.** Joe's Google Calendar showed Connected but returned "token expired" when read. The pull now reports this ("could not be read, reconnect it"), on the refresh toast only. A persistent banner in the UI would be better for a non-technical user; same for the signed-out message.
- **launchd and `claude`.** `scripts/install.js` now puts `~/.local/bin` on the agent's PATH. Whether a desktop-only user has a `claude` binary there at all is still Phase 0 Step 2.
- **The runbook installs Node with Homebrew** (password prompt, Xcode tools, and `git` for the clone). A no-password route is possible: download the official Node build into `~/.flight-deck` and fetch the repo as a tarball with `curl`. Untested; worth trying during the cold dry run.
- Fixes 1, 2, 3, 5, 6, 7 and 8 below are done. 6 is done as far as detection and message; the runbook check belongs to Task 8.

## Known plan fixes

Found on review of the plan against the code (2026-10-08). Apply these when you reach the task.

1. **Task 4, rewrite trigger.** `corrections.at` is SQLite format (`2026-10-08 12:00:00`); `triageRulesWrittenAt` returns ISO (`2026-10-08T12:00:00.000Z`). Compared as strings, corrections made the same UTC day the rules were written never count. Normalize both to one format and add a test.
2. **Task 6, deep link encoding.** `URLSearchParams` writes spaces as `+`. Whether Claude Desktop decodes `+` is unverified, and the plan's test cannot catch it. Build the query with `encodeURIComponent` (`%20`).
3. **Task 4, saving rules.** The prompt tells headless Claude to save rules with `curl -d '{...}'`, which breaks on an apostrophe. Have it pipe the JSON body from a heredoc (`--data-binary @-`).
4. Line numbers in the plan drift by about ten lines in places. Match on the code, not the number.
5. **Task 5, age of a brand-new item.** `waitingDays` counts from when Flight Deck first saw an item, so a two-week-old Slack message found today shows 0 days and is not red. The reel shows exactly that message in red on the first morning. Fix in the pull prompt when doing Task 4: have each Slack and Gmail POST include `"original_date"` set to the date the message was sent (the tasks API already accepts it). Also, the first-ever pull only looks back 24 hours in Slack; give the first run a longer window (two weeks) so old unanswered messages are found at all.
6. **Signed-out CLI.** The pull fails with "OAuth session expired" when the CLI's sign-in lapses (seen on Joe's Mac, Phase 0 results). Detect that in `runClaudePull`, surface it in the UI in plain words, and have the runbook confirm the CLI is signed in. Not in the plan yet; add as a task once Phase 0 Step 2 is known.
7. **Pull prompt hard-codes stale tool names** (`gcal_list_events`, `gmail_search_messages`, `slack_search_public_and_private`). Current connector tools are `mcp__claude_ai_Gmail__search_threads` and the like. Rewrite the steps to describe the action and let Claude choose the tool. Do this with Task 7b, which restructures the prompt anyway.
8. **Lock down the pull session.** It runs with `bypassPermissions` and holds send, reply, trash and delete tools while reading untrusted email. Restrict it to read tools plus the localhost write-back before this ships to anyone. Treat as a release blocker.
