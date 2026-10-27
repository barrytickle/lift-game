import Phaser from 'phaser';
import { accessories, bankShift, loadProfile, runConfig, saveProfile, type Profile } from '../meta/profile';
import { Autopilot } from '../sim/autopilot';
import type { Perk } from '../sim/perks';
import { World } from '../sim/World';
import { BuildingView } from '../view/BuildingView';
import { ControlPanel } from '../view/ControlPanel';
import { Hud } from '../view/Hud';
import { DPR, FONT, GROUND_Y, H, HUD_H, Layout, W } from '../view/Layout';
import { DEPTH_RIDERS, LiftView } from '../view/LiftView';
import { CAB_SKINS, COLORS, hex } from '../view/Palette';
import { PassengerView } from '../view/PassengerView';
import { FREE_ROOMS, LOBBY, roomById, type RoomTheme } from '../view/rooms';
import { sfx } from '../view/Sfx';
import { button, label, PERK_ICONS, pin } from '../view/ui';

// title (autopilot demo) -> play <-> draft -> over. Title and game over can leave for the shop scene.
type Phase = 'title' | 'play' | 'draft' | 'over';

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
  private views = new Map<number, PassengerView>();
  private leaving: { view: PassengerView; floor: number }[] = [];
  private phase: Phase = 'title';
  private overlay?: Phaser.GameObjects.Container;
  private groupLabel?: Phaser.GameObjects.Text;
  private time_ = 0;
  /** drives the lift on the main menu */
  private pilot?: Autopilot;
  /** room ids for this tower, so "Start shift" keeps the tower you were looking at */
  private roomIds: string[] = [];
  private keepRooms?: string[];

  constructor() {
    super('game');
  }

  init(data: { skipTitle?: boolean; rooms?: string[] }): void {
    this.phase = data.skipTitle ? 'play' : 'title';
    this.keepRooms = data.rooms;
    this.pilot = undefined;
    this.views = new Map();
    this.leaving = [];
    this.overlay = undefined;
    this.groupLabel = undefined;
  }

  create(): void {
    // Origin 0,0 so zoom scales from the top-left: world (0,0) is the screen's
    // top-left at scroll 0, and pinned UI (scroll factor 0) lines up with it.
    const cam = this.cameras.main;
    cam.setOrigin(0, 0).setZoom(DPR).setScroll(0, 0);
    cam.setBackgroundColor(COLORS.night);

    this.profile = loadProfile();
    this.accessories = accessories(this.profile);
    const cfg = runConfig(this.profile);
    // Dev aid: ?floors=10 to try taller towers before they're a real feature.
    const debugFloors = Number(new URLSearchParams(location.search).get('floors'));
    if (debugFloors >= 2 && debugFloors <= 12) cfg.floors = debugFloors;

    const attract = this.phase === 'title';
    if (attract) {
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
    this.roomIds = rooms.map((r) => r.id);
    this.building = new BuildingView(this, this.layout, rooms);
    this.liftView = new LiftView(this, this.layout, CAB_SKINS[this.profile.cabSkin] ?? CAB_SKINS['skin-classic']);
    this.panel = new ControlPanel(this, this.layout, {
      hold: (dir) => this.holdLift(dir),
      release: () => this.world.release(),
    });
    this.hud = new Hud(this, cfg.lives);
    this.hud.setDelivered(0);
    this.hud.setVisible(!attract);
    this.panel.setVisible(!attract);

    this.bindWorldEvents();

    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => this.onTap(ptr));
    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => this.onKey(e));
    this.input.keyboard?.on('keyup', (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') this.panel.letGo();
    });

    cam.scrollY = this.cameraTarget();
    if (attract) this.showTitle();
  }

  /** Keep the cab in the middle of the visible floors; 0 (no scroll) when the tower fits. */
  private cameraTarget(): number {
    const { layout } = this;
    const cabMid = this.liftView.cabY - layout.cabH / 2;
    const bandMid = HUD_H + (GROUND_Y - HUD_H) / 2;
    return Phaser.Math.Clamp(cabMid - bandMid, layout.minScrollY, 0);
  }

  /** The main menu's demo runs silently underneath the title. */
  private get quiet(): boolean {
    return this.phase === 'title';
  }

  /** Lobby on G, then the player's owned rooms shuffled onto the upper floors. */
  private dealRooms(floors: number): RoomTheme[] {
    if (this.keepRooms?.length === floors) {
      const kept = this.keepRooms.map((id) => (id === LOBBY.id ? LOBBY : roomById(id)));
      if (kept.every(Boolean)) return kept as RoomTheme[];
    }
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
        this.leaving.push({ view: v, floor });
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
      if (!this.quiet) sfx.coin(groupIndex);
      this.hud.setScore(this.world.score);
      this.hud.setDelivered(this.world.delivered);
    });

    ev.on('walkout', ({ p, floor, livesLeft }) => {
      const v = this.views.get(p.id);
      if (v) {
        this.views.delete(p.id);
        v.leaving = true;
        v.fume();
        this.leaving.push({ view: v, floor });
        this.popText(v.x, v.y - 80, 'Hmph!', COLORS.angry, 22);
      }
      if (this.quiet) return;
      this.hud.loseLife(livesLeft);
      this.cameras.main.shake(140, 0.006);
      sfx.walkout();
      navigator.vibrate?.(60);
    });

    ev.on('arrive', () => {
      if (!this.quiet) sfx.ding();
    });

    ev.on('draft', ({ offer }) => {
      this.phase = 'draft';
      // Let the last delivery's pop land before the cards slide in.
      this.time.delayedCall(350, () => this.showDraft(offer));
    });

    ev.on('perk', ({ perk, level }) => {
      sfx.perk();
      this.hud.setLives(this.world.lives, this.world.maxLives);
      this.hud.setScore(this.world.score);
      const lv = level > 1 ? ` ${level}` : '';
      this.popText(W / 2, this.cameras.main.scrollY + HUD_H + 40, `${perk.name}${lv}!`, PERK_ICONS[perk.id]?.color ?? COLORS.coin, 26);
    });

    ev.on('gameOver', ({ score, delivered }) => {
      this.phase = 'over';
      sfx.gameOver();
      const prevBest = this.profile.best;
      const isBest = bankShift(this.profile, score);
      saveProfile(this.profile);
      this.time.delayedCall(700, () => this.showGameOver(score, delivered, prevBest, isBest));
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
    if (this.phase === 'play' || this.phase === 'title') this.world.update(dt);
    if (this.phase === 'title') this.pilot?.update(this.world, dt);

    const { world, layout } = this;
    this.liftView.update(dt, world.lift);
    this.panel.update(world.lift);
    const cam = this.cameras.main;
    cam.scrollY += (this.cameraTarget() - cam.scrollY) * Math.min(1, dt * 6);
    this.building.updateRequested(world.requestedFloors(), this.time_);
    this.hud.update(dt);

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
    this.leaving = this.leaving.filter(({ view, floor }) => {
      view.step(dt, W + 50, layout.floorY(floor), false, 1);
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

  private makePanel(
    lines: { text: string; size: number; color: number; bold?: boolean }[],
    buttons: { label: string; color?: number; onClick: () => void }[],
    /** `bottom`: anchor the card's bottom edge here instead of centring; `dim: false` keeps the game visible */
    opts: { dim?: boolean; bottom?: number } = {},
  ): void {
    this.overlay?.destroy();
    const c = this.add.container(0, 0).setDepth(DEPTH_OVERLAY);
    if (opts.dim !== false) c.add(this.add.rectangle(0, 0, W, H, COLORS.night, 0.62).setOrigin(0).setInteractive()); // swallows taps
    const g = this.add.graphics();
    c.add(g);

    // Lay the text out first, then size the panel around it.
    const texts = lines.map((l) => {
      const t = label(this, W / 2, 0, l.text, l.size, l.color, l.bold).setOrigin(0.5, 0);
      c.add(t);
      return t;
    });
    const gap = 14;
    const textH = texts.reduce((h, t) => h + t.height + gap, -gap);
    const panelH = 44 + textH + 36 + 58 + 30;
    const py = opts.bottom !== undefined ? opts.bottom - panelH : H / 2 - panelH / 2;
    let y = py + 44;
    for (const t of texts) {
      t.y = y;
      y += t.height + gap;
    }
    g.fillStyle(0x000000, 0.25).fillRoundedRect(36, py + 8, W - 72, panelH, 28);
    g.fillStyle(COLORS.wallA, 1).fillRoundedRect(36, py, W - 72, panelH, 28);
    g.fillStyle(COLORS.cabFrame, 1).fillRoundedRect(36, py, W - 72, 18, { tl: 28, tr: 28, bl: 0, br: 0 });

    const bw = buttons.length > 1 ? 160 : 230;
    const by = py + panelH - 30 - 29;
    buttons.forEach((b, i) => {
      const bx = W / 2 + (i - (buttons.length - 1) / 2) * (bw + 16);
      c.add(button(this, bx, by, bw, 58, b.label, { color: b.color, onClick: b.onClick, pulse: i === buttons.length - 1 }));
    });

    pin(c);
    c.setAlpha(0);
    this.tweens.add({ targets: c, alpha: 1, duration: 250 });
    this.overlay = c;
  }

  private closeOverlay(): void {
    const o = this.overlay;
    this.overlay = undefined;
    if (!o) return;
    o.each((child: Phaser.GameObjects.GameObject) => child.disableInteractive());
    this.tweens.add({ targets: o, alpha: 0, duration: 200, onComplete: () => o.destroy() });
  }

  private walletLine(): string {
    return `Wallet: ${this.profile.coins.toLocaleString()} coins`;
  }

  /** Main menu: logo up top, a small card at the bottom, the demo tower running in between. */
  private showTitle(): void {
    const firstTime = this.profile.shifts === 0;
    const intro = 'Hold ▲ ▼ or tap a floor to move the lift.\nDeliver everyone before they lose patience!';
    this.makePanel(
      firstTime
        ? [{ text: intro, size: 17, color: COLORS.ink }]
        : [
            { text: `Shift ${this.profile.shifts + 1}  ·  Best ${this.profile.best.toLocaleString()}`, size: 19, color: COLORS.ink, bold: true },
            { text: this.walletLine(), size: 16, color: 0x8a8ca8, bold: true },
          ],
      [
        { label: 'Shop', color: COLORS.shaft, onClick: () => this.scene.start('shop') },
        { label: 'Start shift', onClick: () => this.startPlay() },
      ],
      { dim: false, bottom: H - 14 }, // covers the control panel, which the menu doesn't use
    );
    this.overlay!.addAt(pin(this.add.rectangle(0, 0, W, HUD_H - 4, COLORS.night).setOrigin(0)), 0);
    const logo = this.add.container(W / 2, HUD_H / 2 - 4);
    logo.add(label(this, 0, 4, 'Going Up!', 54, COLORS.ink, true).setOrigin(0.5).setAlpha(0.5));
    logo.add(label(this, 0, 0, 'Going Up!', 54, COLORS.cabFrame, true).setOrigin(0.5));
    this.overlay!.add(pin(logo));
    this.tweens.add({ targets: logo, y: logo.y - 4, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  }

  /** Begin a real shift in the same tower the menu was showing. */
  private startPlay(): void {
    this.scene.restart({ skipTitle: true, rooms: this.roomIds });
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

  private showGameOver(score: number, delivered: number, prevBest: number, isBest: boolean): void {
    this.makePanel(
      [
        { text: 'Shift over!', size: 44, color: COLORS.cabFrame, bold: true },
        { text: `+${score.toLocaleString()}`, size: 60, color: COLORS.ink, bold: true },
        { text: 'coins banked', size: 18, color: 0x8a8ca8, bold: true },
        {
          text: isBest ? 'New best!' : `Best: ${prevBest.toLocaleString()}`,
          size: 20,
          color: isBest ? COLORS.happy : 0x8a8ca8,
          bold: true,
        },
        { text: `${delivered} passengers delivered\n${this.walletLine()}`, size: 18, color: COLORS.ink },
      ],
      [
        { label: 'Shop', color: COLORS.shaft, onClick: () => this.scene.start('shop') },
        { label: 'Again!', onClick: () => this.scene.restart({ skipTitle: true }) },
      ],
    );
    // Brief lockout so a frantic tap doesn't skip the results.
    const setEnabled = (on: boolean) =>
      this.overlay?.each((ch: Phaser.GameObjects.GameObject) => {
        if (ch.input) ch.input.enabled = on;
      });
    setEnabled(false);
    this.time.delayedCall(600, () => setEnabled(true));
  }
}
