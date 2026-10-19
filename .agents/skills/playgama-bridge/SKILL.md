---
name: playgama-bridge
description: Integrate the Playgama Bridge SDK into a web game in any engine (plain JS such as Phaser, Three.js, PlayCanvas or Pixi; Unity WebGL; Godot; Construct 3; GDevelop; GameMaker; Defold; Cocos Creator; Scratch) from Playgama's live documentation, including the required steps: initialization, game_ready, saves through Storage, pause and audio, ads. Use it whenever a game needs Bridge before it goes on Playgama, an archive check says the Bridge SDK was not found or is too old, a game moves from Bridge v1 to v2, or the user asks about Playgama ads, saves, leaderboards, payments or analytics inside their game.
license: Apache-2.0
---

# Integrating Playgama Bridge

Playgama Bridge is one SDK for ads, saves, leaderboards, payments and analytics on every platform Playgama publishes
to. Every game on Playgama runs it, the public sandbox included, and the sandbox takes **Bridge 2.2.0 or newer**.
Outside a real platform (on localhost, for instance) Bridge runs a mock platform whose calls return safe defaults
instead of throwing, so the game can be built and tried before it is published.

## Read the live docs, not your memory

The SDK changes between releases, and its API moved a lot from v1 to v2. Read the current pages every time:

- **With the Playgama MCP server connected:** `get_bridge_sdk_docs` without a page answers the index (pages marked
  `required` are the mandatory ones). With `page` and `engine` it answers one page cut to that engine's code, for
  example `page: "setup", engine: "Unity"`. Spell `engine` the way the tool's description does (plain JavaScript is
  `Plain JS`): a name that matches no tab is ignored without an error, and `engineFilter` in the answer shows which
  tabs were kept. `get_game_checklist` lists every requirement in the order to do them.
- **Without it:** `https://wiki.playgama.com/playgama/bridge-sdk.md` is the whole SDK in one file for agents, and
  `https://wiki.playgama.com/playgama/llms.txt` indexes every page. Adding `.md` to any wiki page's URL gives its
  Markdown.

## Steps

1. **Find the engine and what's there already.** Look at the project: `package.json` dependencies (phaser, three,
   pixi.js, playcanvas), `ProjectSettings/` for Unity, `project.godot`, a `.c3p` for Construct, and so on. Search the
   code for `playgama-bridge`, `@playgama/bridge` and `bridge.initialize` to see whether Bridge is in and which version.
   A v1 integration (a `/v1/` CDN path) follows the `migration-v1-to-v2` page.
2. **Install it for that engine** from the `setup` page. For plain JS the CDN is the recommended way:
   `<script src="https://bridge.playgama.com/v2/stable/playgama-bridge.js"></script>` in `index.html`, before the
   game's own script. npm (`@playgama/bridge`, with its Vite plugin) is for builds that must be self-contained.
   Either way, `playgama-bridge-config.json` sits beside `index.html` (page `config`).
3. **Initialize it and wait.** In plain JS, `bridge.initialize()` returns a promise: call no other `bridge.*` method
   before it resolves. Engine packages initialize while the game loads.
4. **Do the required steps** (the `api` page, and items 1 to 15 of the checklist):
   - read `platform.language` once after initialization and use it to pick the game's language; English is the
     default and the fallback;
   - save and load progress through Storage only, all keys in one call, never `localStorage` directly;
   - on start, mute the game if `platform.isAudioEnabled` is false, and listen to `AUDIO_STATE_CHANGED` and
     `PAUSE_STATE_CHANGED` to mute and pause it when the platform asks;
   - send `platform.sendMessage('game_ready')` once the player can actually play, never while a loading screen shows;
   - show interstitials at natural pauses (a level's end, game over), and give a rewarded ad's reward only after Bridge
     confirms the ad finished.
5. **Try it.** Serve the build and open the QA Tool with `get_local_game_qa_tool_link`: it runs the game in the
   Bridge harness, where ads, pause and saves can be tried. After an upload, `get_archive_status` should answer
   `bridgeSdk: FOUND` with `analysis.bridgeVersion` 2.2.0 or newer. If it says NOT_FOUND, `get_archive_qa_tool_link`
   with `mode: certification` shows why Bridge didn't start.

## What trips games up

- **Anything loaded from outside the build.** Only Bridge itself may come from the Playgama CDN (checklist item 16):
  fonts, libraries and pictures ship inside the build.
- **Analytics.** No GA4 or similar; game events go through Bridge's analytics module (`analytics.send`, Bridge 2.3.0
  or newer).
- **Progress kept in localStorage.** It works locally, but the checklist allows only Bridge Storage for progress
  (item 4), so move every save there.
- **`game_ready` too early.** Platforms hide their own loading screen and start their analytics on it, so sent while
  the game is still loading it tells them the player can play when they can't.

Once Bridge is in, the `playgama-publish` skill takes the game to a playable link.
