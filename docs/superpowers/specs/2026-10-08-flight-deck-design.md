# Flight Deck: design spec (2026-10-08)

The tool promised by the pilot reel of "How to use Claude better than everyone at your job"
([script](../../../brands/joe-b/writing-room/reels/2026-10-07-slack-email-hit-list/2026-10-08-flight-deck-pilot-v1.md),
[repo exploration](../../../brands/joe-b/writing-room/reels/2026-10-07-slack-email-hit-list/repo-exploration.md)).
Joe's decisions in this spec were made in conversation on 2026-10-08.

## 1. What it is, in the reel's words

Every morning you open one tab and everything you owe people is already there, pulled from
Slack and email through the Claude connections you already have, sorted into must-do /
should-do / could-do, with today's meetings beside it. It lives in a folder on your computer and
the list never leaves it. Setup is: connect Slack and email to your Claude, paste one link, go
get coffee.

## 2. Who installs it

The viewer uses the Claude desktop app, almost always Cowork. The pilot tells them, once, to
use the **Code tab** of the same app ("this is the one time you'll need Claude Code; all you do
is paste a link"). No terminal, no GitHub, no npm in the viewer's hands: the guide page gives
them the exact prompt to paste and Claude does the rest.

Rule for the whole project: **the video optimizes for retention; the guide page optimizes for
not handing anyone a dead end.** Every edge case and fallback below lives in the guide, not in
the script.

## 3. Primary path: server mode (today's Hit List, renamed and finished)

Keep the existing Node app. It already does the hard part (connector pull, dedup, tiers, UI,
MCP). Changes:

| # | Change | Why the reel needs it |
|---|---|---|
| 1 | Rename Hit List → **Flight Deck** everywhere (repo `flight-deck`, `productName`, state dir `~/.flight-deck`, launchd label `com.flightdeck.server`, UI title) | Name on screen = name they paste = keyword FLIGHTDECK |
| 2 | **Hourly refresh inside the server** (default every 60 min, configurable, quiet hours) | "You didn't even have to press refresh" |
| 3 | **Triage learning**: log every tier change the user makes; feed recent corrections into the pull prompt; after enough corrections, rewrite a `triage.md` rules file that the prompt includes | "Claude learns over a couple of days what matters; after a week it's on autopilot" |
| 4 | **Age in red**: an item waiting more than N days (default 3) shows its age and the must-do card goes red | Sally's two-week-old Slack, in red, at the top |
| 5 | **Button**: replace the `antigravity://` launch URI with the documented `claude://code/new?q=<prompt>&folder=<repo>` deep link (prefilled, user presses Enter). Keep "Copy prompt". | Episode 2; costs nothing to fix now |
| 6 | **Config for a beginner**: the runbook asks five things (name, email, Slack member ID, timezone, projects). GuideCX/Fathom stay in the code, off by default, documented only in the guide's "power user" section | Thirty minutes, not an afternoon |
| 7 | **Runbook rewritten for the desktop Code tab**: `CLAUDE.md` becomes the thing the pasted prompt points at. It checks Node (installs via Homebrew if missing and tells the user the one password prompt is theirs), clones, installs, builds config by asking, starts the server, enables auto-start, runs a first refresh, opens the tab, and ends by telling the user what to do tomorrow morning | "Paste this link in, go get coffee" |
| 8 | **Minimal test suite** (`node --test`) covering the scheduler, corrections log, triage-rule rewrite trigger, and age calculation | There are no tests today |
| 9 | Hit List's current state moves to branch `hit-list-legacy`; `main` is one path | One README, one story |

### Unknowns that gate server mode (ticket zero)

1. A desktop-app user who has never installed the CLI: does the Code tab give Claude Code with
   no further install, and is a `claude` binary available to launchd afterwards?
2. **Does `claude -p` (headless, from the server) see the Slack/Gmail/Calendar connectors on a
   desktop-only machine?** On Joe's Mac they are not in `~/.claude.json`; they reach sessions
   through the desktop app. If headless sees no connectors, the hourly pull is empty and server
   mode needs a different refresh trigger (candidates: a local desktop scheduled Code task that
   runs the pull prompt; or registering the connectors as remote MCP servers for the CLI).
3. Does the viewer's **work** account have Claude Code enabled? Team/Enterprise admins can turn
   it off while leaving Cowork on. This is a real fallback case, not a hypothetical.

## 3a. Sources: three core, plus whatever is already connected

Added 2026-10-08 after Joe's note on audience. Status: confirmed by Joe 2026-10-08 (core three expected, setup carries on without one).

The person installing this is a non-technical knowledge worker on a cold start. Their day is
Gmail, Slack and Google Calendar, so those are the **core three** and setup expects them. But the
repo is a scaffold for the user's own tools: if they already have another connector approved in
Claude (Monday.com, Asana, Linear, Notion, HubSpot), their list should pull from it too, with no
code change and no API key.

- **Core three are expected, not fatal.** The runbook checks each of Calendar, Gmail and Slack and
  walks the user to Customize > Connectors for any that are off. If one cannot be turned on (the
  common case: work has not approved Slack), setup drops it, says so in one sentence, and
  finishes. `claudePull.sources` (default `["calendar", "gmail", "slack"]`) records which are on.
  Nobody hits a dead end because one of three is missing.
- **Extra sources are config, not code.** `extraSources` is a list of
  `{ "name": "Monday.com", "instructions": "Items assigned to me that are overdue or due this week" }`.
  For each one the headless pull prompt gets a generated step: use whatever connector tools you
  have for `<name>`, follow the instructions, and POST each item as a task with `source` set to a
  slug of the name, `external_id` set to the item's stable id in that tool, and `source_url` if
  there is one. If no tools for `<name>` are visible, say so in the summary and move on. Dedup,
  tiers, corrections and waiting-days then work unchanged, because they key on `source` and
  `external_id`.
- **Setup offers them, once.** After the five questions, the runbook has Claude look at which
  connectors it can see in the session and ask a single question: "I can also see X and Y
  connected. Want your list to pull from those too?" For each yes it writes an `extraSources`
  entry with a sensible default instruction ("things assigned to me or waiting on me"). The user
  can change it later by telling Claude what they want from that tool.
- **The UI must not assume a fixed set of sources.** Any source badge, filter or Warp Log grouping
  renders an unknown source by its name.
- **GuideCX and Fathom are legacy.** They are direct-API sources from Joe's previous job. They
  stay in the code, off by default, power-user section only. New sources go through connectors.
- **Depends on unknown 2 below** exactly as the core three do: if headless `claude -p` cannot see
  connectors, neither path works and the refresh trigger changes for both.

## 4. Fallback path: folder mode (Cowork only, no server)

For viewers whose organization blocks Claude Code, or if unknown 2 fails outright. Spec'd here
so the guide can point at it; built as phase 3.

- The viewer attaches an empty folder in Cowork and pastes the folder-mode prompt.
- Cowork writes `FLIGHTDECK.md` (who you are, projects, triage rules) and `state/items.json`.
- An **hourly local Cowork scheduled task** (desktop app open) reads Slack/Gmail/Calendar through
  the connectors, merges into `items.json` (dedup by Slack `channel:ts` and Gmail thread id),
  and regenerates **`flightdeck.html`**: three tiers, red for items older than N days, today's
  meetings in a side column, each item linking to its source. That file is "the one tab".
- Corrections: the viewer edits a tier in `corrections.md` or tells Cowork; the task reads it
  every run and rewrites the rules in `FLIGHTDECK.md` after ten corrections.
- Episode 2 button: each item carries `claude://cowork/new?q=<prompt>&folder=<path>`.
- What it gives up: no server, no MCP tools, no Warp Log, no drag/drop. Acceptable for the
  fallback.

## 5. The guide page (`joebenscoter.com/guides/flightdeck`)

Built with [production/joeb-guide-pages.md](../../../production/joeb-guide-pages.md). Sections,
in this order:

1. **What you're about to get**, one paragraph, one screenshot of the morning list.
2. **Before you start** (two minutes): Claude desktop app installed; Slack, Gmail and Google
   Calendar connectors turned on (Customize → Connectors); a Mac. Windows is a known gap: say so.
3. **The prompt**: the exact text to paste into the Code tab. Contains the repo link. The viewer
   never has to open GitHub.
4. **What happens in the next half hour**: the questions Claude will ask and why; the one
   password prompt (Homebrew/Node) and that it's the Mac asking, not Claude.
5. **Tomorrow morning**: open the tab; drag things between tiers for the first few days; that's
   how it learns.
6. **If something's in the way** (the fallbacks, each a heading): no Code tab / "Claude Code is
   disabled for your account" → folder mode; Slack connector not approved at work → email-only
   mode (set `claudePull` sources); Node install asks for a password; port already in use; the
   list is empty after refresh (how to read `claude-pull.log`); how to stop and uninstall.
7. **What leaves your computer** (the IT question, answered honestly): message content is read
   through Claude's connectors exactly as in any Claude chat your company already allows; the
   list, notes and database stay in `~/.flight-deck` on your machine; nothing is hosted.
8. **Power users**: GuideCX, Fathom, MCP tools for Claude Code, Warp Log, the button.

## 6. Script lines this spec depends on

- "Connect Slack and email to your Claude, paste this link in, go get coffee" → change 7.
- "This is the one time you'll need Claude Code" (Joe's riff, line not yet written) → section 2.
- "The nerds call it localhost. A tiny little server that lives on your laptop, and the list
  never leaves it" → stays true in server mode. False in folder mode; the guide says so.
- "Comment FLIGHTDECK and I'll send you the link. Paste it into Claude and it builds the whole
  thing for you" → the guide's section 3 prompt.

## 7. Out of scope for the pilot

Windows support, the per-task button in the reel, Warp Log, GuideCX/Fathom onboarding, any
hosted component, email sending on the user's behalf.
