# Building Flight Deck

This repo is being turned from Hit List into Flight Deck, the tool promised by the pilot reel of "How to use Claude better than everyone at your job".

- Spec: [docs/superpowers/specs/2026-10-08-flight-deck-design.md](superpowers/specs/2026-10-08-flight-deck-design.md)
- Plan: [docs/superpowers/plans/2026-10-08-flight-deck-build-plan.md](superpowers/plans/2026-10-08-flight-deck-build-plan.md), ten tasks in three phases, executed task by task with subagent-driven development.
- Phase 0 (manual tests, Joe) decides whether server mode's hourly pull works for a desktop-app user. Results go in `docs/decisions/`. Phase 1 can start before Phase 0 is done.
- Pre-change state is preserved on branch `hit-list-legacy`.
- The paths in the plan are relative to this repo. The script and reel project it serves live in the Content repo under `brands/joe-b/writing-room/reels/2026-10-07-slack-email-hit-list/`.

`CLAUDE.md` at the root is the end-user setup runbook, not build instructions; it gets rewritten in Task 8.
