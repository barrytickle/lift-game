# Game Brief: Going Up!

**One-sentence pitch:** Tap floors to ferry impatient little blob people up and down a tower before they storm off in a huff.

## Core loop
- Passengers appear on floors wearing a badge with the floor they want.
- Tap a floor, or hold ▲/▼ on the lift panel and let go to stop at the next floor; riders hop off, waiting folk hop on (automatic).
- Each delivery pays coins: more for quick trips, a bonus for dropping several at one stop.
- Arrivals speed up over the shift until the single lift can't keep up.
- Delivery milestones pause the shift for a perk draft: pick 1 of 3 random cards (roguelike, resets each shift).
- Coins are banked after the shift and spent in the shop (meta progression), then: one more shift.

## Player goal & fail state: what "working" looks like
- Goal: highest coin total in one shift. Fail: 5 passengers walk out (5 hearts), and the shift ends.
- A session feels complete at roughly 3–5 minutes for an average player.

## MVP: what must exist to be the game
- Bare-minimum start: **3 floors, a slow lift and one seat**, so there's plenty to work towards. Taller Tower (shop, up to 8 floors), Better Motor and Bigger Cab (shop) grow it; Roomy Cab and Turbo Motor (perks) help mid-shift
- Hold ▲/▼ to move; on release the lift settles on the nearest floor (firm brakes, so it can ease back to one it just passed). A quick tap moves one floor
- Coins per delivery include a per-floor bonus for longer trips, so taller towers pay more
- **Lives and walkouts:** 3 hearts per run. When a waiting passenger's patience runs out, the whole building walks out:
  they storm off (angry face for the one who snapped, grumpy faces for the rest), riders hop out, one heart breaks,
  and there's a 4 s breather (no spawns, no patience loss) while the lift returns to G. Spawns then ease back in
  over 15 s. Coins and deliveries so far are kept. Simultaneous failures still cost one heart
- **End of run:** losing the last heart shows a results card (delivered, coins earned, best delivery, shift time) with
  NEW BEST ribbons from saved personal bests, plus Play Again and Main Menu
- Readability: hall-call lamps light ▲/▼ on floors with people waiting (red and pulsing when someone is close to leaving), the panel buttons ring when calls are above/below, off-screen calls show as tappable chips, and the cab glows green when lined up with a floor where stopping helps
- Passenger spawning with destinations and a visible patience ring
- Automatic exit-then-board at stops, one person at a time
- Coins (base + patience bonus + group bonus), hearts, game over, best score
- Expressive procedural passengers: mood faces, blinking, hopping, cheering, fuming
- Perk drafts: ~9 stackable perks, common/rare, offered at growing delivery milestones
- Shop with permanent upgrades, unlockable room themes (Tiny Tower-style floors), cab skins, hat packs
- Main menu shows the tower running on autopilot at a calm, constant pace, framed in a window between the logo and the menu card; Start Shift grows the window into the live game (same tower, same passengers)
- Every floor drawn as a themed room; floors 1+ are dealt randomly from the rooms you own each shift.
  Rooms: Lobby (always G); free: Apartment, Office, Coffee Shop, Gym; shop: Laundry Room, Plant Shop,
  Restaurant, Arcade, Cinema Room, Game Dev Studio

## Out of scope: not building this (yet)
- Building expansion (extra floors), extra lifts, automation
- Rooms with gameplay effects (cosmetic for now), choosing room order
- Passenger types / behaviours (VIPs, groups, slow walkers)
- Cloud saves, accounts, ads, IAP, any external art or audio files

## Build order
1. Pure simulation (World/Lift) with unit tests ✅
2. Portrait layout, building, cab, passengers, tap input ✅
3. Feedback juice: pops, coin fly, shake, synth SFX ✅
4. Balance pass with the headless bot (`npm run balance`) ✅
5. Themed rooms, saved profile and shop, perk drafts, cosmetics
6. Next: rooms with small gameplay perks, extra floors, a second lift

---
**Who it's for / what they feel:** Phone players wanting a 5-minute, slightly frantic "one more go" with a cosy look.

**Art & audio direction:** Soft pastel geometric shapes, all drawn with Phaser Graphics/tweens; tiny WebAudio blips.

**Reference game:** Tiny Tower's lift mini-game, plus the frantic queueing of early mobile arcade games. We keep only the ferrying loop.
