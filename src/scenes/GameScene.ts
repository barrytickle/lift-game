import Phaser from 'phaser';
import type { GameConfig } from '../config';
import { clearAppHooks, minimizeApp, setAppHooks, type AppHooks } from '../platform';
import { accessories, bankShift, loadProfile, recordRun, runConfig, saveProfile, type Profile } from '../meta/profile';
import { Autopilot } from '../sim/autopilot';
import { perkById, type Perk } from '../sim/perks';
import { World } from '../sim/World';
import { BuildingView } from '../view/BuildingView';
import { CallsView } from '../view/CallsView';
import { ControlPanel } from '../view/ControlPanel';
import { Hud } from '../view/Hud';
import { DPR, FONT, GROUND_Y, H, HUD_H, Layout, W } from '../view/Layout';
import { DEPTH_RIDERS, LiftView } from '../view/LiftView';
import { CAB_SKINS, COLORS, hex } from '../view/Palette';
import { PassengerView } from '../view/PassengerView';
import { FREE_ROOMS, LOBBY, roomById, type RoomTheme } from '../view/rooms';
import { sfx } from '../view/Sfx';
import { showResults } from '../view/ResultsCard';
import { label, PERK_ICONS, pillButton, pin } from '../view/ui';
import { WalkoutBanner } from '../view/WalkoutBanner';
import { menuLayout, type MenuBackScene, type MenuFrontScene, type Rect } from './MenuScene';

// title (autopilot demo) -> play <-> draft, play <-> walkout (breather), play/walkout -> over (results).
// play/walkout <-> paused (app in the background, or Android back). These mirror World.state;
// the menu and results can leave for the shop or restart the scene.
type Phase = 'title' | 'play' | 'draft' | 'walkout' | 'paused' | 'over';

const DEPTH_WAITING = 6;
const DEPTH_FX = 40;
const DEPTH_OVERLAY = 100;

/**
 * Wires the pure World simulation to its views. The scene owns input and the
 * passenger-view lifecycle; everything else reads from World each frame.
 */
export class GameScene extends Phaser.Scene {
  private world!: World;
  private profile!: Profile;
  private accessories: string[] = [];
  private layout!: Layout;
  private building!: BuildingView;
  private liftView!: LiftView;
  private hud!: Hud;
  private panel!: ControlPanel;
  private banner!: WalkoutBanner;
  private calls!: CallsView;
  private views = new Map<number, PassengerView>();
  /** passengers walking off to the right; `wait` staggers a walkout so it reads as a crowd */
  private leaving: { view: PassengerView; floor: number; wait: number }[] = [];
  private phase: Phase = 'title';
  private overlay?: Phaser.GameObjects.Container;
  private pauseCard?: Phaser.GameObjects.Container;
  private groupLabel?: Phaser.GameObjects.Text;
  private time_ = 0;
  /** drives the lift on the main menu */
  private pilot?: Autopilot;
  /** live values the menu demo overrides, restored when the shift starts */
  private live?: { spawn: GameConfig['spawn']; draftFirst: number };
  /** 0 = game framed in the menu window, 1 = full screen */
  private menuT = 1;
  private starting = false;
  private leavingScene = false;
  /** what to return to from the pause card */
  private pausedFrom: Phase = 'play';

  constructor() {
    super('game');
  }

  init(data: { skipTitle?: boolean }): void {
    this.phase = data.skipTitle ? 'play' : 'title';
    this.pilot = undefined;
    this.views = new Map();
    this.leaving = [];
    this.overlay = undefined;
    this.groupLabel = undefined;
    this.live = undefined;
    this.starting = false;
    this.leavingScene = false;
    this.pauseCard = undefined;
  }

  create(): void {
    // Origin 0,0 so zoom scales from the top-left: world (0,0) is the screen's
    // top-left at scroll 0, and pinned UI (scroll factor 0) lines up with it.
    const cam = this.cameras.main;
    cam.setOrigin(0, 0).setZoom(DPR).setScroll(0, 0);
    cam.setBackgroundColor(COLORS.night);
    cam.fadeIn(260, 0x2b, 0x2d, 0x42); // pairs with restartTo()'s fade out

    this.profile = loadProfile();
    this.accessories = accessories(this.profile);
    const cfg = runConfig(this.profile);
    // Dev aid: ?floors=10 to try taller towers before they're a real feature.
    const debugFloors = Number(new URLSearchParams(location.search).get('floors'));
    if (debugFloors >= 2 && debugFloors <= 12) cfg.floors = debugFloors;

    const attract = this.phase === 'title';
    if (attract) {
      this.live = { spawn: { ...cfg.spawn }, draftFirst: cfg.draft.first };
      // Main-menu demo: a calm, steady trickle that never ramps up, no drafts, no game over.
      cfg.spawn.rampTime = Infinity;
      cfg.spawn.startInterval = 2.2;
      cfg.draft.first = Infinity;
    }
    this.world = new World(cfg);
    if (attract) {
      this.world.lives = Infinity;
      this.pilot = new Autopilot(0.35);
    }

    this.layout = new Layout(cfg.floors);
    const rooms = this.dealRooms(cfg.floors);
    this.building = new BuildingView(this, this.layout, rooms);
    this.liftView = new LiftView(this, this.layout, CAB_SKINS[this.profile.cabSkin] ?? CAB_SKINS['skin-classic']);
    this.panel = new ControlPanel(this, this.layout, {
      hold: (dir) => this.holdLift(dir),
      release: () => this.world.release(),
    });
    this.calls = new CallsView(this, this.layout, (f) => this.phase === 'play' && this.sendTo(f));
    this.calls.chipsEnabled = !attract;
    this.hud = new Hud(this, cfg.lives, { panel: this.layout.scrolls, onPerks: () => this.showPerks() });
    this.banner = new WalkoutBanner(this);
    this.hud.setDelivered(0);
    this.hud.setVisible(!attract);
    this.panel.setVisible(!attract);

    this.bindWorldEvents();
    this.events.once('shutdown', () => sfx.motorLevel(0)); // leaving for the shop or restarting
    const hooks: AppHooks = {
      background: () => {
        this.panel.letGo(); // a finger can't still be holding ▲/▼ once the app is away
        if (this.phase === 'play' || this.phase === 'walkout') this.pause();
      },
      back: () => this.onBack(),
    };
    setAppHooks(hooks);
    this.events.once('shutdown', () => clearAppHooks(hooks));

    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (over.length === 0) this.onTap(ptr); // a chip or button took it
    });
    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => this.onKey(e));
    this.input.keyboard?.on('keyup', (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') this.panel.letGo();
    });

    this.menuT = attract ? 0 : 1;
    if (attract) this.openMenu();
    cam.scrollY = this.cameraTarget();
  }

  /**
   * Keep the cab in the middle of the visible floors. In play that's the band
   * between HUD and panel (0 = no scroll when the tower fits); in the menu window
   * it's the whole window, kept between the roof and the street.
   */
  private cameraTarget(): number {
    const { layout, menuT: t } = this;
    const cam = this.cameras.main;
    const viewH = cam.height / cam.zoom;
    const cabMid = this.liftView.cabY - layout.cabH / 2;
    const bandMid = Phaser.Math.Linear(viewH / 2, HUD_H + (GROUND_Y - HUD_H) / 2, t);
    const street = GROUND_Y + 34 - viewH;
    const lo = Phaser.Math.Linear(Math.min(layout.floorY(layout.floors) - 16, street), layout.minScrollY, t);
    const hi = Phaser.Math.Linear(street, 0, t);
    return Phaser.Math.Clamp(cabMid - bandMid, lo, hi);
  }

  /** Point the camera at a screen rect (design units), scaled so the full width of the tower fits. */
  private setView(r: Rect): void {
    const cam = this.cameras.main;
    cam.setViewport(Math.round(r.x * DPR), Math.round(r.y * DPR), Math.round(r.w * DPR), Math.round(r.h * DPR));
    cam.setZoom((DPR * r.w) / W);
  }

  /** Main menu: the demo tower plays in a window between the menu's back and front layers. */
  private openMenu(): void {
    this.setView(menuLayout().win);
    const data = {
      profile: this.profile,
      onStart: () => this.startPlay(),
      onShop: () => this.scene.start('shop'),
    };
    this.scene.launch('menu-back', data);
    this.scene.launch('menu-front', data);
    this.scene.sendToBack('menu-back');
    this.scene.bringToTop('menu-front');
    this.events.once('shutdown', () => {
      this.scene.stop('menu-back');
      this.scene.stop('menu-front');
    });
  }

  /** The main menu's demo runs silently underneath the title. */
  private get quiet(): boolean {
    return this.phase === 'title';
  }

  /** Lobby on G, then the player's owned rooms shuffled onto the upper floors. */
  private dealRooms(floors: number): RoomTheme[] {
    const owned = [...FREE_ROOMS, ...this.profile.owned].map(roomById).filter((r): r is RoomTheme => !!r);
    const out: RoomTheme[] = [LOBBY];
    let deck: RoomTheme[] = [];
    while (out.length < floors) {
      if (deck.length === 0) deck = Phaser.Utils.Array.Shuffle([...owned]);
      out.push(deck.pop()!);
    }
    return out;
  }

  private bindWorldEvents(): void {
    const ev = this.world.events;
    const { layout } = this;

    ev.on('spawn', ({ p }) => {
      const v = new PassengerView(this, W + 30, layout.floorY(p.origin), p, this.accessories);
      v.setDepth(DEPTH_WAITING);
      this.views.set(p.id, v);
      if (!this.quiet) sfx.spawn();
    });

    ev.on('board', ({ p }) => {
      this.views.get(p.id)?.setDepth(DEPTH_RIDERS);
      if (!this.quiet) sfx.board();
    });

    ev.on('deliver', ({ p, floor, coins, groupIndex }) => {
      const v = this.views.get(p.id);
      if (v) {
        this.views.delete(p.id);
        v.leaving = true;
        v.setDepth(DEPTH_WAITING);
        v.cheer();
        this.leaving.push({ view: v, floor, wait: 0 });
        // Everyone exits from the cab, so stack the pops to keep each one readable.
        const fy = layout.floorY(floor);
        this.popText(layout.queueX + 6, fy - 60 - groupIndex * 30, `+${coins}`, COLORS.coin, 26);
        if (groupIndex >= 1) {
          if (this.groupLabel) {
            this.tweens.killTweensOf(this.groupLabel);
            this.groupLabel.destroy();
          }
          this.groupLabel = this.popText(layout.queueX + 130, fy - layout.floorH + 40, `Group x${groupIndex + 1}!`, 0xffffff, 22);
        }
        if (!this.quiet) this.flyCoin(v.x, v.y - 30);
      }
      if (!this.quiet) sfx.dropOff(groupIndex);
      this.hud.setScore(this.world.score);
      this.hud.setDelivered(this.world.delivered);
      this.hud.setDraftProgress(this.world.draftProgress.done, this.world.draftProgress.need);
    });

    ev.on('walkout', ({ p, livesLeft, leavers }) => {
      // Everyone gives up together: the one who ran out storms off, the rest
      // sulk and trail out after them. Riders hop out at the nearest floor.
      const nearest = Phaser.Math.Clamp(Math.round(this.world.lift.position), 0, layout.floors - 1);
      let n = 0;
      for (const l of leavers) {
        const v = this.views.get(l.p.id);
        if (!v) continue;
        this.views.delete(l.p.id);
        v.leaving = true;
        v.setDepth(DEPTH_WAITING);
        const culprit = l.p.id === p.id;
        if (culprit) {
          v.fume();
          this.popText(v.x, v.y - 80, 'Hmph!', COLORS.angry, 24);
        } else v.sulk();
        this.leaving.push({ view: v, floor: l.floor ?? nearest, wait: culprit ? 0.55 : 0.3 + 0.1 * n++ });
      }
      if (this.quiet) return;
      this.panel.letGo();
      this.panel.setDim(true);
      this.hud.loseLife(livesLeft);
      this.cameras.main.shake(160, 0.005);
      sfx.lifeLost();
      navigator.vibrate?.(60);
      if (livesLeft > 0) {
        this.phase = 'walkout';
        this.banner.show('Walkout!', null, this.world.cfg.walkout.breather);
      }
    });

    ev.on('recovered', () => {
      if (this.quiet) return;
      this.phase = 'play';
      this.panel.setDim(false);
      this.banner.backToWork();
      sfx.resume();
    });

    ev.on('draft', ({ offer }) => {
      this.phase = 'draft';
      // Let the last delivery's pop land before the cards slide in.
      this.time.delayedCall(350, () => this.showDraft(offer));
    });

    ev.on('perk', ({ perk, level }) => {
      sfx.perk();
      this.hud.setPerkCount(Object.keys(this.world.perks).length);
      this.hud.setDraftProgress(this.world.draftProgress.done, this.world.draftProgress.need);
      this.hud.setLives(this.world.lives, this.world.maxLives);
      this.hud.setScore(this.world.score);
      const lv = level > 1 ? ` ${level}` : '';
      this.popText(W / 2, this.cameras.main.scrollY + HUD_H + 40, `${perk.name}${lv}!`, PERK_ICONS[perk.id]?.color ?? COLORS.coin, 26);
    });

    ev.on('gameOver', (stats) => {
      this.phase = 'over';
      if (this.quiet) return;
      const coins = bankShift(this.profile, stats.score);
      const beat = { coins, ...recordRun(this.profile, stats) };
      saveProfile(this.profile);
      this.banner.show('Out of hearts!', "That's the end of the shift.", 0);
      this.time.delayedCall(450, () => sfx.gameOver());
      // Let the last walkout play out, then the results slide up.
      this.time.delayedCall(2000, () => {
        this.banner.hide();
        this.overlay = showResults(this, {
          stats,
          beat,
          wallet: this.profile.coins,
          onAgain: () => this.restartTo({ skipTitle: true }),
          onMenu: () => this.restartTo({}),
        });
      });
    });
  }

  private onTap(ptr: Phaser.Input.Pointer): void {
    sfx.unlock();
    if (this.phase !== 'play') return; // overlays handle their own buttons
    const screenY = ptr.y / DPR;
    if (screenY < HUD_H || screenY > GROUND_Y + 10) return; // HUD and control panel
    const f = this.layout.floorAt(ptr.worldY);
    if (f === null) return;
    this.sendTo(f);
  }

  private onKey(e: KeyboardEvent): void {
    if (this.phase === 'title' && e.key === 'Enter') return this.startPlay();
    if (this.phase !== 'play' || e.repeat) return;
    const k = e.key.toLowerCase();
    if (k === 'g' || k === '0') this.sendTo(0);
    else if (/^[1-9]$/.test(k)) this.sendTo(Math.min(Number(k), this.world.cfg.floors - 1));
    else if (k === 'arrowup') this.panel.press(1);
    else if (k === 'arrowdown') this.panel.press(-1);
  }

  /** Held ▲/▼ on the panel (or arrow keys): drive until released. */
  private holdLift(dir: 1 | -1): void {
    if (this.phase !== 'play') return;
    sfx.tap();
    this.world.hold(dir);
  }

  private sendTo(f: number): void {
    this.building.flash(f);
    sfx.tap();
    this.world.requestFloor(f);
  }

  update(_t: number, deltaMs: number): void {
    const dt = Math.min(deltaMs / 1000, 0.05);
    this.time_ += dt;
    if (this.phase === 'play' || this.phase === 'title' || this.phase === 'walkout') this.world.update(dt);
    if (this.phase === 'title') this.pilot?.update(this.world, dt);

    const { world, layout } = this;
    this.liftView.update(dt, world.lift, world.usefulFloors());
    const moving = this.phase === 'play' || this.phase === 'walkout';
    sfx.motorLevel(moving ? Math.abs(world.lift.velocity) / world.cfg.lift.maxSpeed : 0);
    const calls = world.calls();
    this.panel.update(dt, world.lift, calls);
    const cam = this.cameras.main;
    const target = this.cameraTarget();
    cam.scrollY = this.starting && this.phase === 'title' ? target : cam.scrollY + (target - cam.scrollY) * Math.min(1, dt * 6);
    this.building.updateRequested(world.requestedFloors(), this.time_);
    this.hud.update(dt);
    this.calls.update(dt, calls, cam.scrollY);

    // Place every live passenger where the sim says they belong.
    for (const [id, v] of this.views) {
      const p = world.passengers.get(id);
      if (!p) continue;
      if (p.state === 'riding') {
        const i = world.lift.riders.indexOf(id);
        const hurry = world.lift.stoppedAt === null;
        v.step(dt, layout.riderSlotX(i, world.lift.riders.length, world.lift.capacity), this.liftView.cabY - 2, true, 0.72, hurry);
      } else {
        const i = world.queues[p.origin].indexOf(id);
        v.step(dt, layout.queueSlotX(i), layout.floorY(p.origin), false, 1);
      }
    }

    // Departing passengers walk off to the right, then vanish.
    this.leaving = this.leaving.filter((l) => {
      const { view, floor } = l;
      l.wait -= dt;
      view.step(dt, l.wait > 0 ? view.x : W + 50, layout.floorY(floor), false, 1);
      if (view.x >= W + 40) {
        view.destroy();
        return false;
      }
      return true;
    });
  }

  // ---------- effects ----------

  private popText(x: number, y: number, str: string, color: number, size: number, delay = 0): Phaser.GameObjects.Text {
    const t = this.add
      .text(x, y, str, {
        fontFamily: FONT,
        fontSize: `${size}px`,
        fontStyle: 'bold',
        color: hex(color),
        stroke: hex(COLORS.ink),
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setResolution(DPR)
      .setDepth(DEPTH_FX)
      .setScale(0.4)
      .setAlpha(0);
    this.tweens.add({ targets: t, scale: 1, alpha: 1, duration: 180, delay, ease: 'Back.Out' });
    this.tweens.add({
      targets: t,
      y: y - 40,
      alpha: 0,
      duration: 500,
      delay: delay + 450,
      ease: 'Quad.In',
      onComplete: () => t.destroy(),
    });
    return t;
  }

  private flyCoin(x: number, y: number): void {
    const c = this.add.circle(x, y, 8, COLORS.coin).setStrokeStyle(2, COLORS.coinDark).setDepth(DEPTH_FX);
    this.tweens.add({
      targets: c,
      x: 42,
      y: this.cameras.main.scrollY + HUD_H / 2 - 8,
      scale: 0.6,
      duration: 520,
      ease: 'Cubic.In',
      onComplete: () => c.destroy(),
    });
  }

  // ---------- overlays ----------

  private closeOverlay(): void {
    const o = this.overlay;
    this.overlay = undefined;
    if (!o) return;
    o.each((child: Phaser.GameObjects.GameObject) => child.disableInteractive());
    this.tweens.add({ targets: o, alpha: 0, duration: 200, onComplete: () => o.destroy() });
  }

  /** "Start Shift": the menu slides away and the demo window grows into the live game. */
  private startPlay(): void {
    if (this.starting || this.phase !== 'title') return;
    this.starting = true;
    sfx.unlock();
    const back = this.scene.get('menu-back') as unknown as MenuBackScene;
    const front = this.scene.get('menu-front') as unknown as MenuFrontScene;
    back.leave();
    const from = menuLayout().win;
    const full = { x: 0, y: 0, w: W, h: H };
    this.tweens.add({
      targets: this,
      menuT: 1,
      duration: 800,
      delay: 120,
      ease: 'Cubic.InOut',
      onUpdate: () => {
        const t = this.menuT;
        const r = {
          x: Phaser.Math.Linear(from.x, full.x, t),
          y: Phaser.Math.Linear(from.y, full.y, t),
          w: Phaser.Math.Linear(from.w, full.w, t),
          h: Phaser.Math.Linear(from.h, full.h, t),
        };
        this.setView(r);
        front.setFrame(r, t);
      },
      onComplete: () => {
        this.scene.stop('menu-back');
        this.scene.stop('menu-front');
        this.goLive();
      },
    });
  }

  /** The demo becomes the shift: same tower, same people, real rules from here on. */
  private goLive(): void {
    const { world, live } = this;
    this.phase = 'play';
    this.pilot = undefined;
    if (live) {
      Object.assign(world.cfg.spawn, live.spawn);
      world.cfg.draft.first = live.draftFirst;
    }
    world.startShift();
    this.hud.setLives(world.lives, world.maxLives);
    this.hud.setScore(0);
    this.hud.setDelivered(0);
    this.hud.setPerkCount(Object.keys(world.perks).length);
    this.hud.setDraftProgress(world.draftProgress.done, world.draftProgress.need);
    this.hud.fadeIn();
    this.panel.fadeIn();
    this.calls.chipsEnabled = true;
    sfx.ding();
    if (this.profile.shifts === 0) {
      const tip = label(this, W / 2, GROUND_Y - 40, 'Hold ▲ ▼ or tap a floor', 22, 0xffffff, true)
        .setOrigin(0.5)
        .setStroke(hex(COLORS.ink), 6)
        .setDepth(DEPTH_FX);
      pin(tip);
      this.tweens.add({ targets: tip, alpha: 0, delay: 3200, duration: 600, onComplete: () => tip.destroy() });
    }
  }

  private showDraft(offer: Perk[]): void {
    this.overlay?.destroy();
    const c = this.add.container(0, 0).setDepth(DEPTH_OVERLAY);
    c.add(this.add.rectangle(0, 0, W, H, COLORS.night, 0.72).setOrigin(0).setInteractive());
    const cardH = Math.min(116, (H - 300) / offer.length - 14);
    const totalH = offer.length * (cardH + 14) - 14;
    const top = H / 2 - totalH / 2 + 30;
    c.add(label(this, W / 2, top - 92, 'Pick a perk!', 40, 0xffffff, true).setOrigin(0.5, 0));
    c.add(label(this, W / 2, top - 42, 'The shift is paused', 17, 0xa9acc9).setOrigin(0.5, 0));

    let picked = false;
    offer.forEach((perk, i) => {
      const y = top + i * (cardH + 14) + cardH / 2;
      const card = this.add.container(W / 2, y);
      const cw = W - 56;
      const icon = PERK_ICONS[perk.id] ?? { glyph: '?', color: COLORS.coin };
      const rare = perk.rarity === 'rare';
      const g = this.add.graphics();
      g.fillStyle(0x000000, 0.25).fillRoundedRect(-cw / 2, -cardH / 2 + 5, cw, cardH, 18);
      g.fillStyle(rare ? 0xfff4d6 : 0xffffff, 1).fillRoundedRect(-cw / 2, -cardH / 2, cw, cardH, 18);
      if (rare) g.lineStyle(3, COLORS.coin, 1).strokeRoundedRect(-cw / 2, -cardH / 2, cw, cardH, 18);
      g.fillStyle(icon.color, 1).fillCircle(-cw / 2 + 50, 0, 30);
      g.fillStyle(0xffffff, 0.25).fillCircle(-cw / 2 + 42, -10, 12);
      const glyph = label(this, -cw / 2 + 50, 0, icon.glyph, 26, 0xffffff, true).setOrigin(0.5);
      const have = this.world.perks[perk.id] ?? 0;
      const nameStr = perk.name + (have ? `  Lv ${have + 1}` : '');
      const name = label(this, -cw / 2 + 96, -4, nameStr, 22, COLORS.ink, true).setOrigin(0, 1).setAlign('left');
      const desc = label(this, -cw / 2 + 96, 2, perk.desc, 16, 0x5c5f7a, false, cw - 120).setOrigin(0, 0).setAlign('left');
      card.add([g, glyph, name, desc]);
      if (rare) card.add(label(this, cw / 2 - 16, -cardH / 2 + 10, 'RARE', 13, COLORS.coinDark, true).setOrigin(1, 0));
      card.setSize(cw, cardH).setInteractive({ useHandCursor: true });
      card.on('pointerdown', () => card.setScale(0.96));
      card.on('pointerout', () => card.setScale(1));
      card.on('pointerup', () => {
        if (picked) return;
        picked = true;
        this.tweens.add({ targets: card, scale: 1.08, duration: 120, yoyo: true });
        this.time.delayedCall(260, () => {
          this.closeOverlay();
          this.phase = 'play';
          this.world.choosePerk(perk.id);
        });
      });
      // Deal the cards in.
      card.x = W + cw;
      this.tweens.add({ targets: card, x: W / 2, duration: 320, delay: 80 * i, ease: 'Back.Out' });
      c.add(card);
    });
    pin(c);
    this.overlay = c;
  }

  /** Android back button. */
  private onBack(): void {
    if (this.phase === 'play' || this.phase === 'walkout') this.pause();
    else if (this.phase === 'paused') this.unpause();
    else if (this.phase === 'title') minimizeApp();
    else if (this.phase === 'over') this.restartTo({});
    // draft: pick a card first
  }

  /** Freeze the shift (sim, tweens, timers); the caller puts a card on top. Returns the overlay. */
  private freeze(): Phaser.GameObjects.Container {
    this.pausedFrom = this.phase;
    this.phase = 'paused';
    this.panel.letGo();
    this.tweens.pauseAll();
    this.time.paused = true;
    const c = this.add.container(0, 0).setDepth(110);
    c.add(this.add.rectangle(0, 0, W, H, COLORS.night, 0.6).setOrigin(0).setInteractive()); // swallows taps
    this.pauseCard = c;
    return c;
  }

  /** The HUD's star button: the perks picked so far this shift, with the shift paused. */
  private showPerks(): void {
    if (this.phase !== 'play') return;
    const c = this.freeze();
    (c.first as Phaser.GameObjects.Rectangle).on('pointerup', () => this.unpause()); // tap outside closes

    const taken = Object.entries(this.world.perks)
      .map(([id, level]) => ({ perk: perkById(id), level }))
      .filter((t): t is { perk: Perk; level: number } => !!t.perk);
    const cw = W - 40;
    const rowH = taken.length ? Math.min(84, (H - 330) / taken.length) : 0;
    const ch = taken.length ? 112 + taken.length * (rowH + 10) + 16 : 200;
    const card = this.add.container(W / 2, H / 2);
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.28).fillRoundedRect(-cw / 2, -ch / 2 + 8, cw, ch, 26);
    g.fillStyle(COLORS.coin, 1).fillRoundedRect(-cw / 2, -ch / 2, cw, ch, 26);
    g.fillStyle(0xfff6ea, 1).fillRoundedRect(-cw / 2 + 5, -ch / 2 + 5, cw - 10, ch - 10, 22);
    card.add(g);
    card.add(this.add.zone(0, 0, cw, ch).setInteractive()); // taps on the card itself don't close it
    card.add(label(this, 0, -ch / 2 + 46, '★ Active Perks', 32, COLORS.ink, true).setOrigin(0.5));
    card.add(label(this, 0, -ch / 2 + 82, 'Perks you have picked this shift', 16, 0x6b6e8a).setOrigin(0.5));

    if (!taken.length) {
      card.add(label(this, 0, -ch / 2 + 140, "None yet. Keep delivering and\nyou'll get to pick one soon!", 17, COLORS.ink, false).setOrigin(0.5));
    }
    taken.forEach(({ perk, level }, i) => {
      const y = -ch / 2 + 112 + i * (rowH + 10);
      const icon = PERK_ICONS[perk.id] ?? { glyph: '?', color: COLORS.coin };
      const rare = perk.rarity === 'rare';
      const rg = this.add.graphics();
      rg.fillStyle(rare ? 0xfff0c2 : 0xf3ece2, 1).fillRoundedRect(-cw / 2 + 18, y, cw - 36, rowH, 16);
      const ir = Math.min(26, rowH / 2 - 8);
      rg.fillStyle(icon.color, 1).fillCircle(-cw / 2 + 24 + ir + 6, y + rowH / 2, ir);
      rg.fillStyle(0xffffff, 0.25).fillCircle(-cw / 2 + 24 + ir, y + rowH / 2 - ir * 0.35, ir * 0.4);
      card.add(rg);
      card.add(label(this, -cw / 2 + 30 + ir, y + rowH / 2, icon.glyph, Math.round(ir * 0.9), 0xffffff, true).setOrigin(0.5));
      const tx = -cw / 2 + 44 + ir * 2;
      const name = perk.name + (level > 1 ? `  Lv ${level}` : '');
      card.add(label(this, tx, y + rowH / 2 - 2, name, 19, COLORS.ink, true).setOrigin(0, 1).setAlign('left'));
      card.add(label(this, tx, y + rowH / 2 + 2, perk.desc, 14, 0x5c5f7a, false, cw / 2 - tx - 30).setOrigin(0, 0).setAlign('left'));
      if (rare) card.add(label(this, cw / 2 - 30, y + 8, 'RARE', 12, COLORS.coinDark, true).setOrigin(1, 0));
    });

    // Close button, top right.
    const close = pillButton(this, cw / 2 - 34, -ch / 2 + 34, 44, 40, 0xfff6ea, 0xe2cdb6, () => this.unpause());
    close.add(label(this, 0, 0, '✕', 22, COLORS.ink, true).setOrigin(0.5));
    card.add(close);

    c.add(card);
    pin(c);
  }

  /** Freeze the shift behind a "Paused" card. */
  private pause(): void {
    if (this.phase === 'paused') return;
    const c = this.freeze();
    const card = this.add.container(W / 2, H / 2);
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.28).fillRoundedRect(-150, -100 + 8, 300, 200, 28);
    g.fillStyle(0xfff6ea, 1).fillRoundedRect(-150, -100, 300, 200, 28);
    card.add(g);
    card.add(label(this, 0, -62, 'Paused', 40, COLORS.cabFrame, true).setOrigin(0.5).setStroke('#ffffff', 8));
    card.add(label(this, 0, -22, 'The building will wait.', 17, 0x6b6e8a).setOrigin(0.5));
    const resume = pillButton(this, 0, 46, 210, 60, 0xec6a50, 0xb84a35, () => this.unpause());
    resume.add(label(this, 0, 0, 'Resume', 28, 0xffffff, true).setOrigin(0.5));
    card.add(resume);
    c.add(card);
    pin(c);
    this.pauseCard = c;
  }

  private unpause(): void {
    if (this.phase !== 'paused') return;
    this.pauseCard?.destroy();
    this.pauseCard = undefined;
    this.tweens.resumeAll();
    this.time.paused = false;
    this.phase = this.pausedFrom;
  }

  /** Fade out, then restart the scene: a brand-new World, so nothing from this run carries over. */
  private restartTo(data: { skipTitle?: boolean }): void {
    if (this.leavingScene) return;
    this.leavingScene = true;
    this.cameras.main.fadeOut(260, 0x2b, 0x2d, 0x42);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.restart(data));
  }
}
