# Flight Deck

Every morning you open one tab and everything you owe people is already there. Flight Deck reads your email, Slack and calendar through the Claude connections you already have, sorts what it finds into Must Do, Should Do and Could Do, and puts today's meetings beside it. It runs from a folder on your own Mac, refreshes itself every hour, and the list never leaves your computer.

You do not need to know how to code to set it up. Claude does it for you.

## Set it up

You need a Mac and the Claude desktop app, with the Gmail, Google Calendar and Slack connectors turned on (in Claude: Customize, then Connectors). Any one of the three is enough to start.

Open the **Code** tab in the Claude desktop app and paste this:

```
Read https://raw.githubusercontent.com/joebenscoter86/flight-deck/main/CLAUDE.md and follow it step by step. Ask me only the questions it tells you to ask.
```

Claude installs what is missing, asks you three or four questions (your name, your email, the projects you work on), starts Flight Deck and opens your list. It takes about ten minutes. If your Mac asks for your password along the way, that is the Mac installing a standard tool, not Claude.

Windows is not supported yet.

## Using it

- **Open the tab each morning.** It refreshes itself every hour from 7am to 8pm. There is a Refresh button if you want it sooner.
- **Red means waiting.** Anything that has been waiting three days or more shows how long, in red, at the top of Must Do.
- **Drag things where they belong.** When Flight Deck puts something in the wrong column, drag it. After about ten of those it writes its own rules for how you sort things, and uses them from then on.
- **Check things off, add notes, add your own tasks.** Refreshing never undoes your edits and never brings back something you finished.
- **Open in Claude.** Each item has a button that opens Claude with that item ready to work on.

## What leaves your computer

- Your list, notes and settings are stored in a folder on your Mac (`~/.flight-deck`). Nothing is hosted anywhere, and the page only answers on your own computer.
- To build the list, Flight Deck asks Claude to read your email, Slack and calendar through the same connectors you use in any Claude chat. That content goes to Claude exactly as it does when you ask Claude about your inbox yourself, under your company's existing Claude arrangement.
- The hourly read is read-only. It cannot send, reply, delete, change anything in your accounts, or run programs on your Mac. It can only look, and hand back a list.

## It also reads your other tools

If you have other work tools connected in Claude (Monday.com, Asana, Linear, Notion, Jira and so on), setup offers to pull from those too. No API keys. To add one later, open the Code tab in Claude, choose the `flight-deck` folder, and say: "Add Asana to my Flight Deck."

## If something is in the way

For any of these, open the Code tab in Claude, choose the `flight-deck` folder, and say what is wrong in your own words. Claude knows how to fix it. The common ones:

- **"Claude is signed out":** say "Flight Deck says Claude is signed out."
- **A source could not be read, or was skipped:** reconnect it in Claude under Customize, then Connectors.
- **The list is empty:** that may be true. Say "What did Flight Deck find last time?"
- **Stop or remove it:** say "Uninstall Flight Deck."

---

## Advanced

Everything below is for people who want to look inside.

### How it works

Flight Deck is one Node.js process: a web page and REST API, an MCP server on the same port, and a refresh pipeline on a timer. State is a SQLite file in `~/.flight-deck`. It listens on `127.0.0.1` only.

```
   Browser tab ──HTTP──┐
                       ├─►  Node process  ──►  SQLite (~/.flight-deck/todo.db)
   Claude (MCP) ──MCP──┘        │
                                └─ every hour:
                                   claude mcp list   which connectors are connected
                                   claude -p         read-only session, prints JSON
                                   ingest            validate, dedup, write
```

The hourly session runs with no shell and no file tools, and may only call read-style tools (`get_*`, `list_*`, `search_*`, `read_*` and similar) on the connectors in use. Its output is treated as untrusted and validated before anything is stored. The transcript of each run is in `~/.flight-deck/claude-pull.log`.

### Configuration

Settings are read from the first of: `$FLIGHT_DECK_CONFIG`, `~/.flight-deck/config.json`, `<repo>/config.json`. Start from `config.example.json`.

| Field | What it's for |
|-------|---------------|
| `productName` | Label shown in the UI. |
| `userName` | Your name, used in prompts Claude sees. |
| `userEmail` | Your email. Used to identify tasks assigned to you (Fathom, GuideCX) and to scope the Fathom query. |
| `userSlackId` | Your Slack member ID (looks like `U0XXXXXXXXX`). Used to find DMs and @mentions. |
| `orgDomain` | Your email domain (e.g. `acme.com`). Used to tag Fathom action items as "teammate" vs "external". |
| `timezone` | IANA timezone (e.g. `America/New_York`). Determines which calendar day "today" is. |
| `workHoursPerDay` | Used to compute available hours (workday minus meetings minus a 30-min buffer). |
| `port` | Preferred port. If busy, the server walks up until it finds a free one and records the real port in `~/.flight-deck/state.json`. |
| `activeProjects` | Names of the projects you care about. Used to match GuideCX projects, tag tasks, and generate meeting prep. |
| `excludeKeywords` | Task names matching any of these (case-insensitive) are never surfaced. Leave `[]` for none. |
| `claudePull.enabled` | Turn the headless Slack/Gmail/Calendar pull on or off. |
| `claudePull.model` | Model the hourly pull uses. Default `sonnet`, to go easy on your plan's usage limits. |
| `claudePull.sources` | Which of `calendar`, `gmail`, `slack` to read. Default all three. One that is not connected in Claude is skipped. |
| `extraSources` | Other connectors you already have in Claude, as `[{ "name": "Monday.com", "instructions": "Items assigned to me that are overdue or due this week" }]`. No API key needed. |
| `refresh.everyMinutes` | How often the server refreshes itself. Default 60. |
| `refresh.quietHours` | `[start, end]` hours (24-hour, your timezone) when it does not refresh. Default `[20, 7]`. |
| `ageRedDays` | Items waiting this many days or more show their age in red. Default 3. |
| `claudeBin` | Path to the `claude` binary. Defaults to `claude` on your `PATH`. |
| `slack.workspaceUrl` | Your Slack workspace URL (e.g. `https://acme.slack.com`), used to build clickable links. |
| `guidecx.enabled` | Turn the GuideCX source on. Also requires a token. |
| `guidecx.apiBase` | GuideCX API base. Default `https://api.guidecx.com/api/v2`. |
| `guidecx.webBaseUrl` | Your GuideCX tenant URL (e.g. `https://acme.guidecx.com`), for clickable task links. |
| `guidecx.token` | GuideCX API token (or set env `GUIDECX_TOKEN`). |
| `fathom.enabled` | Turn the Fathom source on. Also requires a key. |
| `fathom.apiBase` | Fathom API base. Default `https://api.fathom.ai/external/v1`. |
| `fathom.apiKey` | Fathom API key (or set env `FATHOM_API_KEY`). |

GuideCX and Fathom are optional direct API sources, off by default. Put the token in the file or in `GUIDECX_TOKEN` / `FATHOM_API_KEY`; environment variables win. Triage rules the app has learned are in `~/.flight-deck/triage.md` and can be edited by hand.

### MCP tools

Setup registers the MCP server with Claude Code (`claude mcp add --transport http --scope user flight-deck http://localhost:3847/mcp`).

| Tool | Does |
|------|------|
| `todo_list_tasks` | List tasks for a date (filter: open / done / blocked / dismissed / all). |
| `todo_add_task` | Add a task. |
| `todo_update_task` | Update fields, append a note, change priority, defer, etc. |
| `todo_mark_done` | Mark a task done. |
| `todo_dismiss_task` | Dismiss ("not today"). It won't carry over, but its source can re-surface it. |
| `todo_get_summary` | Counts and time estimates by priority tier. |
| `todo_refresh` | Run the refresh pipeline (same as the UI button). |

There is deliberately no delete tool. Claude can complete or dismiss tasks; only you can delete them from the page.

### Running it by hand

```bash
npm install
npm start                    # foreground
npm run dev                  # auto-reload
npm test                     # node --test
npm run install:agent        # start at login (macOS launchd)
npm run uninstall:agent
tail -f ~/.flight-deck/server.log
```

If port 3847 is busy the app takes the next free one and records it in `~/.flight-deck/state.json`. The **Warp Log** page shows where your time went by project and by source.

Changing the code? Read [docs/BUILD.md](docs/BUILD.md) first.

## License

MIT. See [LICENSE](LICENSE).
