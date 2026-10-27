# Going Up! Asset List

Everything visual is drawn in code on purpose, so this list is almost entirely **audio**.
Every sound below already has a **synth placeholder** in `src/view/Sfx.ts` (or is marked *new*),
so a real file can replace one method at a time without touching gameplay.

**Overall direction:** cosy, warm and a little silly. Think a hotel lobby in a picture book.
Soft mallets, felt piano, brushed drums, upright bass, a cheeky woodwind. Nothing harsh: the
game is fast, so sounds must stay short and stack well when ten fire at once.

**Delivery format:** `.ogg` plus `.m4a` (iOS Safari needs AAC), 44.1 kHz. SFX mono at about −18 LUFS,
music stereo at about −16 LUFS. Trim silence at the start of every SFX so taps feel instant.

Priority: **P1** = needed for a first public build, **P2** = big polish win, **P3** = nice to have.

---

## Music

**In the game now:** `public/sfx/music.mp3` (Barry's "Going Up" seamless loop, 115 s) plays at low volume
from the first tap across the menu, shifts and shop. The tracks below are still ideas for later variety.

| ID | Where it plays | Length / loop | Feel | Pri |
|---|---|---|---|---|
| `mus_menu` | Main menu (autopilot demo) | 60–90 s seamless loop | Laid-back bossa nova lift music: vibraphone, nylon guitar, brushed kit. The "lift music" joke, played straight and lovely | P1 |
| `mus_shift` | During a shift | 90–120 s loop, built from **3 stems** | Same key and tempo family as the menu but bouncier. Stems: (1) bass + light percussion, (2) melody, (3) busy counter-melody and shaker | P1 |
| `mus_shift_overtime` | Layered in after 3 min ("overtime") | Stem that syncs to `mus_shift` | Adds urgency: faster hi-hats, staccato strings. Faded in by the game, not a separate track | P2 |
| `mus_shop` | Shop screen | 45–60 s loop | Calm, shopkeeper-ish. Plucked strings, music-box sparkle | P2 |
| `mus_draft_sting` | Perk draft opens (game pauses) | 1.5 s one-shot, then a soft held pad that loops | A "ta-daa" with a pause-y hold underneath. Music ducks behind it | P2 |
| `mus_gameover` | Shift over | 3–4 s one-shot | Gentle descending phrase, more "end of the working day" than "you lose" | P1 |
| `mus_newbest` | Shift over with a new best | 3–4 s one-shot | Triumphant version of the game-over phrase | P2 |

**Stems note:** if `mus_shift` comes as stems, the game can add layers as patience drops or
overtime starts. That's cheap to code and makes the chaos feel musical.

---

## Sound effects

### Lift
| ID | Trigger | Notes | Placeholder | Pri |
|---|---|---|---|---|
| `sfx_lift_ding` | Passenger dropped off | **Done:** `public/sfx/ding.wav` (Barry's recording, rebuilt so the strike comes first). Pitch steps up for group drop-offs | `dropOff()` | P1 |
| `sfx_lift_motor_loop` | While the cab moves | **Done:** `public/sfx/move.wav`, a seamless 3.5 s loop; volume and pitch follow speed | `motorLevel()` | P2 |
| `sfx_lift_start` / `sfx_lift_stop` | Pull away / brake | Tiny mechanical clunk and cable creak; the stop one sells the squash animation | *new* | P2 |
| `sfx_doors_open` / `sfx_doors_close` | Glass doors slide | Short airy "fsst", 0.2 s | *new* | P2 |
| `sfx_panel_press` | ▲/▼ pressed | Chunky brass button click, satisfying | `tap()` | P1 |
| `sfx_panel_release` | ▲/▼ released | Softer click-up | *new* | P3 |
| `sfx_floor_tap` | Floor tapped | Light wooden tick | `tap()` | P1 |

### Passengers
| ID | Trigger | Notes | Placeholder | Pri |
|---|---|---|---|---|
| `sfx_pax_arrive` | Passenger walks in | Tiny "pop" or footstep patter. 3 variations | `spawn()` | P1 |
| `sfx_pax_board` | Steps into the cab | Little hop "boing". 3 variations, pitch-shifted per passenger | `board()` | P1 |
| `sfx_pax_leap` | Late boarder dives into a moving cab | Exaggerated "hup!" boing | *new* | P3 |
| `sfx_pax_cheer` | Delivered | Short happy gibberish voice ("yay!", "wheee", "ta!"), Animal Crossing-style babble. 6–8 variations | *new* | P2 |
| `sfx_pax_grumble` | Patience drops to "worried" | Short impatient "hmm" or foot tap. Rate-limited so it doesn't spam | *new* | P2 |
| `sfx_pax_walkout` | Storms off | "Hmph!" voice plus a stompy exit | `walkout()` | P1 |

### Coins and score
| ID | Trigger | Notes | Placeholder | Pri |
|---|---|---|---|---|
| `sfx_coin` | Each delivery | Bright coin chime. Ideally a **5-note set** (rising scale) so group drop-offs climb in pitch | `coin(step)` | P1 |
| `sfx_group_bonus` | "Group x2/x3!" pop | Sparkly flourish on top of the coin | *new* | P2 |
| `sfx_coin_tally` | Score counter rolling | Very soft tick loop | *new* | P3 |

### Hearts and shift flow
| ID | Trigger | Notes | Placeholder | Pri |
|---|---|---|---|---|
| `sfx_heart_lost` | Life lost | Soft "thunk" and a cracking glass-heart tinkle | `walkout()` | P1 |
| `sfx_heart_gained` | Plaster perk | Warm rising chime | `perk()` | P2 |
| `sfx_shift_start` | Shift begins | Shop-door bell, "we're open!" | *new* | P2 |
| `sfx_overtime` | Overtime begins (3 min) | Wall-clock bell and a whoosh | *new* | P2 |

### Perk drafts and shop
| ID | Trigger | Notes | Placeholder | Pri |
|---|---|---|---|---|
| `sfx_card_deal` | Each card slides in | Paper flick, 3 variations | *new* | P2 |
| `sfx_card_pick` | Perk chosen | Satisfying stamp and sparkle | `perk()` | P1 |
| `sfx_card_rare` | A rare card is dealt | Extra shimmer layer | *new* | P3 |
| `sfx_buy` | Purchase | Cash-register "ka-ching", cosy not casino | `buy()` | P1 |
| `sfx_cant_afford` | Tapping an unaffordable price | Soft wooden "nope" knock | `nope()` | P1 |
| `sfx_equip` | Choosing a cab skin | Light "snap" | *new* | P3 |
| `sfx_ui_button` | General buttons | Same family as the panel press, but lighter | `tap()` | P1 |

### Room ambience (P3, subtle, only near the cab's floor)
Short loops (10–20 s) at very low volume, faded in for whichever floor the cab is on.
They'd make each room feel alive:

| ID | Room |
|---|---|
| `amb_lobby` | Distant chatter, revolving door |
| `amb_apartment` | Muffled TV, kettle |
| `amb_office` | Keyboard clatter, printer |
| `amb_coffee` | Espresso hiss, cups |
| `amb_gym` | Treadmill thump, clank |
| `amb_laundry` | Washing machine churn |
| `amb_plants` | Birdsong, mister spray |
| `amb_restaurant` | Cutlery, soft jazz bleeding through |
| `amb_arcade` | 8-bit bleeps, coin drops |
| `amb_cinema` | Projector whirr, muffled film |
| `amb_gamedev` | Keyboard, someone sighing "it works on my machine" |

---

## Non-audio assets

Visuals stay procedural (no sprites), but a release still needs:

| Asset | Notes | Pri |
|---|---|---|
| App icon | 1024×1024 master, then 512/192/180 PNGs. The cab with one passenger and a floor badge | P1 |
| Favicon / PWA manifest icons | From the app icon | P1 |
| Font | Currently the system UI font. A rounded, friendly typeface (e.g. Nunito or Fredoka, OFL licence) would lift the whole look. Self-host it | P2 |
| Store / itch.io screenshots | 5 portrait shots captured from the game itself | P2 |
| Trailer | 20–30 s capture: menu demo → hold-to-move → group drop-off → perk draft → overtime chaos | P3 |
| Haptics map | Not a file, but spec it alongside audio: walkout = 60 ms, group bonus = 2×15 ms, perk pick = 30 ms | P3 |

---

## Implementation notes

- Swap placeholders in `Sfx.ts` one at a time: preload with Phaser's loader, keep the same method
  names, and fall back to the synth if a file fails to load.
- Add **random pitch (±5%)** and **round-robin variations** for anything that fires often
  (board, coin, ding) so it never sounds machine-gunned.
- Give the music and SFX volumes separate sliders, plus a mute toggle that's saved in the profile.
- Duck music by about 6 dB during the perk draft and game-over stings.
