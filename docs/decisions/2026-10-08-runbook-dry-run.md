# Runbook dry run 1: the commands, on Joe's Mac (not yet a cold Mac)

**What this covers:** every command in `CLAUDE.md` Steps 3, 5 and 6, run by hand in a bare environment (`env -i`, PATH of `/usr/bin:/bin:/usr/sbin:/sbin`, so no Homebrew and no system Node). **What it does not cover:** Claude following the runbook from the pasted prompt, and a Mac that has never had the Claude CLI, Xcode tools or Flight Deck. That run is still owed.

## Results

- **Fetch with curl, set up with a private Node: works.** `curl ... | tar` into `~/flight-deck`, then `scripts/flightdeck setup`, took 8 seconds: Node 22.23.3 downloaded and checksum-verified into `~/.flight-deck/node`, 155 packages installed, `better-sqlite3` arrived as a prebuilt binary (nothing compiled). No password, Homebrew, git or Xcode prompt. 24 tests pass on the private Node.
- **Login agent: works after one fix.** The installer gave the server 1.5 seconds to start and reported failure on a cold first start even though the server came up. It now waits up to 20 seconds.
- **`scripts/flightdeck update`: works** (used to pick up that fix).
- **First refresh through the login agent: works.** launchd found `claude` via the PATH the installer writes. 84 seconds, one meeting and one email task, no refused calls. Notional usage $1.55 for the first run.
- **MCP registration: works** (`claude mcp add --scope user`).

## Caveat on "no Xcode tools needed"

This Mac has Xcode tools installed, so `/usr/bin` stubs resolve. The script only calls `curl`, `tar`, `shasum`, `awk`, `sed`, `grep`, `uname`, `mktemp`, which ship with macOS, but that is argued, not observed. Confirm on a Mac without Xcode tools.
