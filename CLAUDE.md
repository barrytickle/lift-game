# Going Up! (Claude Code Game Studios, minimal mode)

Mobile-first portrait lift-management game. **Phaser 3.90 + TypeScript + Vite.** No external assets:
everything is drawn with Phaser Graphics and tweens, and sound is synthesised with WebAudio.

This project uses a trimmed copy of the Game Studios framework (from `C:\Users\Barry\my-game`):
- Workflow tier: **minimal**. The only design doc is `design/game-brief.md`, and its build order is the plan.
- Agents kept: game-designer, gameplay-programmer, prototyper, ui-programmer, technical-artist, qa-tester.
- No Phaser specialist exists in the framework. Engine-specific workflows assume Godot, Unity or Unreal, so
  skip those and treat gameplay-programmer as the engine owner.
- Hooks, statusline and the 49-agent roster were deliberately left out.

## Layout
- `src/config.ts`: every gameplay tuning value. Upgrades later = a modified copy passed to `World`.
- `src/sim/`: pure simulation (`World`, `Lift`, `Emitter`, `perks`, `autopilot`). **No Phaser imports.** It emits events
  (`spawn`, `board`, `deliver`, `walkout`, `arrive`, `depart`, `draft`, `perk`, `gameOver`).
  A `draft` pauses the sim until `World.choosePerk()`. Input: `requestFloor`, or `hold(dir)`/`release()`
  (release settles on the floor nearest where the cab would stop; a quick tap moves one floor). `Autopilot` drives the menu demo and the bot.
- `src/meta/`: shop catalog and the saved `Profile` (localStorage). `runConfig(profile)` builds each
  shift's config copy from the permanent upgrades; perks then mutate that copy during the shift.
- `src/view/`: Phaser-only presentation that reads sim state every frame and reacts to events.
- `src/view/rooms.ts`: procedurally drawn floor themes. `view/ControlPanel.ts`: brass hold-to-move ▲/▼ panel.
- `src/view/CallsView.ts`: "someone's waiting" signals: hall-call lamps per floor and off-screen chips
  (from `World.calls()`). The panel buttons ring when calls are above/below; the cab glows green near a
  `World.usefulFloors()` floor.
- `src/scenes/GameScene.ts`: wires sim to views, handles input, overlays, perk cards and view lifecycle.
  `MenuScene.ts`: the main menu as two layers around GameScene (`menu-back` below: skyline, logo, card;
  `menu-front` above: window frame, mute). GameScene runs the autopilot demo in a camera viewport between
  them and grows it to full screen on Start Shift, then `World.startShift()` turns the demo into the live shift.
  `ShopScene.ts`: spend banked coins (Upgrades / Rooms / Style tabs).
- `tests/`: Vitest on the sim. `tools/balance.ts`: headless bot that plays many shifts.

## Commands
- `npm run dev`: dev server (`--host` so a phone on the same Wi-Fi can open it)
- `npm test` / `npm run typecheck` / `npm run build`
- `npm run balance` (fresh profile) / `npm run balance -- maxed` (all upgrades): bot survival and coins

## Rules of thumb
- Gameplay values go in `config.ts`, never inline in `src/sim`.
- The sim uses delta time and stays deterministic given an RNG (tests inject one).
- Views never mutate sim state; input goes through `World.requestFloor`.
- Design space is 480 wide and height follows device aspect (`view/Layout.ts`); camera zoom = DPR for crisp text.
- Camera origin is (0,0) and follows the cab when the tower is taller than the screen (floors never go below
  `MIN_FLOOR_H`). Screen-fixed UI must go through `pin()` in `view/ui.ts`. Try tall towers with `?floors=10`.
- Audio plans live in `design/asset-list.md`; every sound has a synth placeholder in `view/Sfx.ts`.
