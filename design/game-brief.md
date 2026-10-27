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
- 5 floors, 1 tap-controlled lift (capacity 4) with smooth accel/brake, retargetable mid-trip
- Passenger spawning with destinations and a visible patience ring
- Automatic exit-then-board at stops, one person at a time
- Coins (base + patience bonus + group bonus), hearts, game over, best score
- Expressive procedural passengers: mood faces, blinking, hopping, cheering, fuming
- Perk drafts: ~9 stackable perks, common/rare, offered at growing delivery milestones
- Shop with permanent upgrades, unlockable room themes (Tiny Tower-style floors), cab skins, hat packs
- Main menu shows the tower running on autopilot at a calm, constant pace
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
