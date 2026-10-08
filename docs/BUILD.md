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
| 0. Phase 0 manual tests | Not started | Step 1 (headless pull sees connectors) gates Tasks 3 and 7b. |
| 1. Rename to Flight Deck | Done in code | GitHub repo is still `hit_list`; rename it (Step 2) and update the remote. README and runbook already use the `flight-deck` clone URL, which only resolves after the rename. |
| 2. Test harness | Done | `npm test` runs `node --test tests/*.test.js` (a bare `tests/` directory argument fails on current Node). Installs and runs on Node 25. |
| 3. Hourly refresh | Not started | |
| 4. Corrections and triage rules | Not started | See "Known plan fixes" 1 and 3. |
| 5. Waiting days in red | Not started | |
| 6. Claude Desktop button | Not started | See "Known plan fixes" 2. |
| 7. Beginner config | Not started | |
| 7b. Sources scaffold | Not started | Proposed design, spec 3a. Joe to confirm before build. |
| 8. Runbook and README | Not started | Needs Phase 0 results. |
| 9. Guide page | Not started | Lives in the site repo. |
| 10. Folder mode | Not started | Gated on Phase 0. |

## Known plan fixes

Found on review of the plan against the code (2026-10-08). Apply these when you reach the task.

1. **Task 4, rewrite trigger.** `corrections.at` is SQLite format (`2026-10-08 12:00:00`); `triageRulesWrittenAt` returns ISO (`2026-10-08T12:00:00.000Z`). Compared as strings, corrections made the same UTC day the rules were written never count. Normalize both to one format and add a test.
2. **Task 6, deep link encoding.** `URLSearchParams` writes spaces as `+`. Whether Claude Desktop decodes `+` is unverified, and the plan's test cannot catch it. Build the query with `encodeURIComponent` (`%20`).
3. **Task 4, saving rules.** The prompt tells headless Claude to save rules with `curl -d '{...}'`, which breaks on an apostrophe. Have it pipe the JSON body from a heredoc (`--data-binary @-`).
4. Line numbers in the plan drift by about ten lines in places. Match on the code, not the number.
