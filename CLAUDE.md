# Flight Deck: setup runbook (for Claude, with the user watching)

You are setting up Flight Deck for someone who does not code. They pasted one link to get here and may never have opened a terminal. Do every step yourself. Ask them only the questions marked ASK. Never ask them to type a command. Confirm each step in one plain sentence, then move on. No jargon in what you say to them: say "the app" and "your list", not "server", "repo" or "config".

Before anything that makes the Mac ask for their password, tell them: "Your Mac is about to ask for your password. That's the Mac asking, not me."

If you are here to change the code rather than install it, stop and read `docs/BUILD.md` instead.

## Step 0: Say what is about to happen (once)

"Flight Deck is a page on your computer that lists what you owe people, pulled from your email, Slack and calendar every hour. It runs from a folder on this Mac and the list stays here. This takes about ten minutes and I'll ask you three or four questions."

This runbook is for a Mac. If `uname` is not `Darwin`, tell them Windows is not supported yet and stop.

## Step 1: Check what is installed

- Run `node --version`. You need 20 or newer. If it is missing or older:
  - Run `xcode-select -p`. If that fails, run `xcode-select --install` and tell the user: "A window just opened. Click Install and tell me when it finishes."
  - Run `command -v brew`. If missing, install Homebrew with the one-line command from https://brew.sh (password prompt: warn them first).
  - Run `brew install node`.
- Run `command -v claude || ls ~/.local/bin/claude`. Flight Deck uses this program to read their connectors every hour. Note the full path. If neither finds it, tell the user: "Flight Deck needs one more piece of Claude that isn't on this Mac yet. Send Joe a note and he'll help." and stop.
- Run `claude mcp list` (use the full path if `claude` is not on the PATH). If it says anything about signing in or authentication instead of listing connectors, run `claude auth login` and tell the user: "A browser tab just opened. Sign in to Claude there, then come back and tell me." Then run `claude mcp list` again.

## Step 2: Check the connectors

Read the output of `claude mcp list`. Find the lines for Gmail, Google Calendar and Slack.

- "Connected": good.
- "Needs authentication", or the line is missing: tell the user which ones, and say: "In the Claude app, open Customize, then Connectors, and connect it. Tell me when you're done, or tell me to skip it if your work doesn't allow it." Then run `claude mcp list` again.
- Flight Deck works with any of the three. If they skip one, carry on without it and say so in one sentence. If none of the three is connected, explain that there is nothing to read yet and wait.

Remember which of the three are connected, and which other lines starting with `claude.ai` say Connected (for Step 4).

## Step 3: Get the app

```bash
git clone https://github.com/joebenscoter86/flight-deck.git ~/flight-deck && cd ~/flight-deck && npm install
```

If `~/flight-deck` already exists, run `git -C ~/flight-deck pull && cd ~/flight-deck && npm install` instead.

## Step 4: Settings (ASK only these)

Create `~/.flight-deck/` and copy `config.example.json` to `~/.flight-deck/config.json`. Fill it in:

- ASK: "What name should I use for you?" -> `userName`
- ASK: "What's the email address you use for work?" -> `userEmail`
- `timezone`: do not ask. Run `readlink /etc/localtime` and use the part after `zoneinfo/` (for example `America/New_York`).
- ASK: "What two or three projects, clients or teams take most of your time? Just the names." -> `activeProjects`
- `claudePull.sources`: the connected ones from Step 2, out of `"calendar"`, `"gmail"`, `"slack"`.
- If Slack is connected, ASK: "What's your Slack address? It looks like yourcompany.slack.com." -> `slack.workspaceUrl` (with `https://`). Leave `userSlackId` as an empty string; it is found automatically.
- If Step 1 found `claude` somewhere other than the PATH, set `claudeBin` to the full path.
- If Step 2 found other connected tools that hold work (project trackers, ticketing, CRM, docs: for example Monday.com, Asana, Linear, Notion, Jira, HubSpot), ASK once: "I can also see [names] connected. Want your list to pull from any of those too?" For each yes, add to `extraSources`: `{ "name": "<name>", "instructions": "Things assigned to me or waiting on me that are still open." }`. Ignore connectors that are not about work to be done (design tools, music, maps).

Leave everything else in the file as it is. Never ask about GuideCX or Fathom.

## Step 5: Start it and keep it running

```bash
cd ~/flight-deck && npm run install:agent
```

This starts the app and makes it start by itself whenever the Mac starts. Check it with `curl -s http://localhost:3847/health`. If that fails, the real port is in `~/.flight-deck/state.json`; use that port in every command below.

Then let Claude update the list when the user works on something from it:

```bash
claude mcp add --transport http --scope user flight-deck http://localhost:3847/mcp
```

## Step 6: First refresh

Tell the user: "I'm reading your email and calendar now. The first time takes a few minutes because it looks back two weeks."

```bash
curl -s -m 600 -X POST http://localhost:3847/api/refresh -H 'Content-Type: application/json' -d '{}'
```

Read the reply. If `errors` is not empty, see "If something goes wrong". If `pull.missing` lists something, tell the user in one sentence. Then run `open http://localhost:3847`.

Say: "That's your list. Anything that has been waiting three days or more is in red at the top. If something is in the wrong column, drag it where it belongs. It learns from that."

## Step 7: What happens tomorrow (say this, then stop)

"It refreshes itself every hour from 7am to 8pm, so you never have to press anything. Bookmark this page and open it each morning. For the first few days, drag things between Must Do, Should Do and Could Do when it gets them wrong. After about ten of those it writes its own rules for how you sort things."

## After setup: things the user may come back and ask

They will open this folder in Claude and ask in their own words. Do it for them, same rules as above.

- **"Add [tool] to my Flight Deck":** run `claude mcp list`. If the tool is Connected, add it to `extraSources` in `~/.flight-deck/config.json`, asking one question: "What do you want from it? For example: things assigned to me that are overdue." If it is not connected, send them to Customize, then Connectors first. Then restart the app (`launchctl kickstart -k gui/$(id -u)/com.flightdeck.server`) and refresh.
- **"Stop pulling from [source]":** remove it from `claudePull.sources` or `extraSources`, restart, confirm.
- **"What did it find last time?":** read the end of `~/.flight-deck/claude-pull.log` and summarize in plain words.
- **"Change how it sorts things":** show them `~/.flight-deck/triage.md` in plain words and edit it as they ask.
- **"Update Flight Deck":** `git -C ~/flight-deck pull && cd ~/flight-deck && npm install`, then restart the app.

## If something goes wrong

- **The refresh reply says Claude is signed out:** run `claude auth login`, have the user sign in in the browser tab, then refresh again.
- **A source "could not be read":** its sign-in has expired. Send the user to Customize, then Connectors in the Claude app to reconnect it, then refresh again.
- **The list is empty after a refresh with no errors:** that can be true (nothing is waiting on them). To check what was read, run `tail -40 ~/.flight-deck/claude-pull.log` and tell them in plain words what it found and skipped.
- **Port in use:** the app picks the next free one by itself. The real port is in `~/.flight-deck/state.json`.
- **To stop it:** `cd ~/flight-deck && npm run uninstall:agent`. To remove everything, also delete `~/.flight-deck` and `~/flight-deck`, but ask the user first: that deletes their list.

## Guardrails

- The hourly read is read-only by design: no shell, no sending, no deleting. Do not change `src/pipeline/claude-pull.js` to give it more.
- The app listens on `127.0.0.1` only. Do not make it reachable from the network.
- Settings live in `~/.flight-deck/config.json`, outside the folder you cloned. Never commit a `config.json`.
