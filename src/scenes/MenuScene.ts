import Phaser from 'phaser';
import type { Profile } from '../meta/profile';
import { DPR, FONT, H, W } from '../view/Layout';
import { COLORS, hex } from '../view/Palette';
import { sfx } from '../view/Sfx';
import { coinIcon, label, pillButton } from '../view/ui';

// The main menu is two thin scenes around GameScene, which keeps running the
// autopilot tower in a window between them:
//   menu-back  (below the game): skyline, logo, bottom card, plants
//   menu-front (above the game): the window frame and the sound toggle
// GameScene owns the window rect and grows it to full screen on "Start Shift".

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface MenuData {
  profile: Profile;
  onStart: () => void;
  onShop: () => void;
}

const CARD_H = 296;
const CREAM = 0xfff6ea;
const CORAL = 0xec6a50;
const CORAL_DARK = 0xb84a35;
const NAVY = 0x3d4166;
const NAVY_DARK = 0x262840;
const LOGO_FONT = `"Arial Rounded MT Bold", Nunito, ${FONT}`;

/** Screen regions of the menu, in design units. */
export function menuLayout(): { logoH: number; win: Rect; card: Rect } {
  const logoH = Phaser.Math.Clamp(Math.round(H * 0.165), 118, 172);
  const card = { x: 22, w: W - 44, h: CARD_H, y: H - 16 - CARD_H };
  const win = { x: 30, y: logoH, w: W - 60, h: card.y - 18 - logoH };
  return { logoH, win, card };
}

function setupCamera(scene: Phaser.Scene): void {
  scene.cameras.main.setOrigin(0, 0).setZoom(DPR).setScroll(0, 0);
}

// ---------- menu-back ----------

export class MenuBackScene extends Phaser.Scene {
  private data_!: MenuData;
  private logo!: Phaser.GameObjects.Container;
  private card!: Phaser.GameObjects.Container;
  private plants: Phaser.GameObjects.Container[] = [];
  private backdrop: Phaser.GameObjects.GameObject[] = [];
  private busy = false;

  constructor() {
    super('menu-back');
  }

  init(data: MenuData): void {
    this.data_ = data;
    this.plants = [];
    this.backdrop = [];
    this.busy = false;
  }

  create(): void {
    setupCamera(this);
    this.cameras.main.setBackgroundColor(COLORS.night);
    const { logoH, card } = menuLayout();
    this.drawSkyline(logoH);
    this.logo = this.makeLogo(logoH);
    this.card = this.makeCard(card);
    this.plants.push(this.makePlant(18, H + 6, 1), this.makePlant(W - 18, H + 6, -1));
  }

  /** Slide everything away while GameScene grows the window to full screen. */
  leave(): void {
    this.busy = true;
    if (!this.logo) return; // not created yet
    this.tweens.add({ targets: this.logo, y: this.logo.y - 260, duration: 520, ease: 'Back.In' });
    this.tweens.add({ targets: this.card, y: this.card.y + CARD_H + 80, duration: 520, ease: 'Back.In' });
    this.plants.forEach((p, i) =>
      this.tweens.add({ targets: p, x: p.x + (i === 0 ? -160 : 160), duration: 480, ease: 'Quad.In' }),
    );
    this.tweens.add({ targets: this.backdrop, alpha: 0, duration: 600 });
  }

  private drawSkyline(logoH: number): void {
    const rnd = new Phaser.Math.RandomDataGenerator(['going-up']);
    const g = this.add.graphics();
    g.fillGradientStyle(0x22243a, 0x22243a, 0x33365a, 0x33365a, 1).fillRect(0, 0, W, H);

    // Clouds drifting across the top.
    const cloud = (x: number, y: number, s: number) => {
      g.fillStyle(0x3a3e62, 1);
      g.fillCircle(x, y, 18 * s).fillCircle(x + 20 * s, y - 8 * s, 22 * s).fillCircle(x + 42 * s, y, 16 * s);
      g.fillRoundedRect(x - 18 * s, y, 76 * s, 16 * s, 8 * s);
    };
    cloud(-20, 60, 1.3);
    cloud(W - 70, 40, 1.1);
    cloud(W - 30, H * 0.42, 1.2);
    cloud(-30, H * 0.5, 1);

    // Tower silhouettes down both sides and along the logo band, with lit windows.
    const windows: Phaser.GameObjects.Rectangle[] = [];
    const tower = (x: number, top: number, w: number, color: number) => {
      g.fillStyle(color, 1).fillRect(x, top, w, H - top);
      for (let wy = top + 14; wy < H - 140; wy += 26) {
        for (let wx = x + 8; wx < x + w - 10; wx += 16) {
          if (rnd.frac() < 0.55) continue;
          windows.push(this.add.rectangle(wx, wy, 6, 11, COLORS.coin, rnd.frac() < 0.8 ? 0.85 : 0.25).setOrigin(0));
        }
      }
    };
    tower(-8, logoH * 0.55, 46, 0x2c2f4b);
    tower(W - 40, logoH * 0.4, 52, 0x2c2f4b);
    tower(30, logoH * 0.75, 60, 0x303352);
    tower(W - 110, logoH * 0.8, 70, 0x303352);
    tower(-6, H * 0.45, 40, 0x363a5c);
    tower(W - 34, H * 0.55, 40, 0x363a5c);

    // A few windows flick on and off, like someone's working late.
    this.time.addEvent({
      delay: 700,
      loop: true,
      callback: () => {
        const w = rnd.pick(windows);
        if (w) w.fillAlpha = w.fillAlpha > 0.5 ? 0.25 : 0.85;
      },
    });

    // Warm floor along the bottom, behind the card and plants.
    g.fillStyle(0xd38d68, 1).fillRect(0, H - 120, W, 120);
    g.fillStyle(0xe7a985, 1).fillRect(0, H - 120, W, 8);

    // Sparkles in the sky.
    for (const [x, y, s] of [
      [44, logoH * 0.62, 1],
      [W - 56, logoH * 0.7, 1.2],
      [W * 0.62, 18, 0.7],
      [16, H * 0.36, 0.8],
    ]) {
      const star = this.add.graphics({ x, y });
      star.fillStyle(0xffe9c7, 1).fillPoints(
        [0, -9, 2.5, -2.5, 9, 0, 2.5, 2.5, 0, 9, -2.5, 2.5, -9, 0, -2.5, -2.5].reduce<Phaser.Math.Vector2[]>(
          (pts, v, i, a) => (i % 2 ? pts : [...pts, new Phaser.Math.Vector2(v * s, a[i + 1] * s)]),
          [],
        ),
        true,
      );
      this.tweens.add({ targets: star, scale: 0.5, alpha: 0.5, duration: 900 + rnd.between(0, 600), yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      this.backdrop.push(star);
    }
    this.backdrop.push(g, ...windows);
  }

  private makeLogo(logoH: number): Phaser.GameObjects.Container {
    const c = this.add.container(W / 2, logoH * 0.56);
    const style = (fill: number, stroke: number, thick: number) => ({
      fontFamily: LOGO_FONT,
      fontSize: '76px',
      fontStyle: '900',
      color: hex(fill),
      stroke: hex(stroke),
      strokeThickness: thick,
    });
    const words = ['Going', 'Up!'];
    const gap = 12;
    const shadows = words.map((s) => this.add.text(0, 7, s, style(0x9c3f2e, 0x9c3f2e, 16)).setOrigin(0, 0.5).setResolution(DPR));
    const fronts = words.map((s) => this.add.text(0, 0, s, style(CORAL, 0xfff3e2, 14)).setOrigin(0, 0.5).setResolution(DPR));
    const total = fronts[0].width + gap + fronts[1].width;
    let x = -total / 2;
    fronts.forEach((t, i) => {
      t.x = shadows[i].x = x;
      x += t.width + gap;
    });

    // A little up-arrow roof over the "U".
    const u = this.add.text(0, 0, 'U', style(CORAL, 0xfff3e2, 14)).setVisible(false);
    const ax = fronts[1].x + u.width / 2;
    u.destroy();
    const ay = -fronts[1].height / 2 + 20;
    const arrow = this.add.graphics({ x: ax, y: ay });
    arrow.fillStyle(0x9c3f2e, 1).fillTriangle(-26, 6, 26, 6, 0, -22);
    arrow.fillStyle(0xfff3e2, 1).fillTriangle(-25, 1, 25, 1, 0, -28);
    arrow.fillStyle(CORAL, 1).fillTriangle(-16, -3, 16, -3, 0, -21);

    // Cheery rays either side.
    const rays = this.add.graphics();
    rays.fillStyle(COLORS.coin, 1);
    for (const side of [-1, 1]) {
      const rx = side * (total / 2 + 8);
      for (const [dx, dy, a] of [
        [0, -34, 0.5],
        [side * 14, -12, 1.1],
        [side * -10, -54, 0.1],
      ]) {
        const p = new Phaser.Math.Vector2(0, -9).rotate(side * a);
        const q = new Phaser.Math.Vector2(0, 9).rotate(side * a);
        rays.lineStyle(6, COLORS.coin, 1).lineBetween(rx + dx + p.x, dy + p.y, rx + dx + q.x, dy + q.y);
        rays.fillCircle(rx + dx + p.x, dy + p.y, 3).fillCircle(rx + dx + q.x, dy + q.y, 3);
      }
    }

    c.add([rays, ...shadows, arrow, ...fronts]);
    c.setScale(Math.min(1, (W - 70) / total, (logoH - 24) / 96));
    this.tweens.add({ targets: c, y: c.y - 5, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    this.tweens.add({ targets: rays, alpha: 0.4, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    return c;
  }

  private makeCard(r: Rect): Phaser.GameObjects.Container {
    const { profile, onStart, onShop } = this.data_;
    const c = this.add.container(0, r.y);
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.28).fillRoundedRect(r.x, 8, r.w, r.h, 30);
    g.fillStyle(CREAM, 1).fillRoundedRect(r.x, 0, r.w, r.h, 30);
    g.lineStyle(2, 0xf0dcc2, 1).strokeRoundedRect(r.x + 1, 1, r.w - 2, r.h - 2, 29);
    c.add(g);

    // Wallet | best score.
    const row = 42;
    const coins = label(this, 0, row, profile.coins.toLocaleString(), 32, COLORS.ink, true).setOrigin(0, 0.5);
    const coinW = 34 + 10 + coins.width;
    const cx0 = W / 2 - 92 - coinW / 2;
    c.add(coinIcon(this, cx0 + 17, row, 17));
    coins.x = cx0 + 44;
    c.add(coins);
    g.fillStyle(0xe6d3b8, 1).fillRect(W / 2 - 1, row - 16, 2, 32);

    const bestLbl = label(this, 0, row, 'Best:', 22, 0x8a8ca8, true).setOrigin(0, 0.5);
    const best = label(this, 0, row, profile.best.toLocaleString(), 32, COLORS.ink, true).setOrigin(0, 0.5);
    const bestW = 34 + 10 + bestLbl.width + 10 + best.width;
    const bx0 = W / 2 + 92 - bestW / 2;
    c.add(crown(this, bx0 + 17, row));
    bestLbl.x = bx0 + 44;
    best.x = bestLbl.x + bestLbl.width + 10;
    c.add([bestLbl, best]);

    c.add(label(this, W / 2, 70, 'Run the lift, deliver passengers,\nand keep everyone happy.', 19, 0x6b6e8a).setOrigin(0.5, 0));

    const start = pillButton(this, W / 2, 166, W - 120, 72, CORAL, CORAL_DARK, () => this.fire(onStart));
    const st = label(this, -18, 0, 'Start Shift', 34, 0xffffff, true).setOrigin(0.5);
    const tri = this.add.graphics({ x: st.width / 2 + 14, y: 0 });
    tri.fillStyle(0xffffff, 1).fillTriangle(-15, 11, 15, 11, 0, -13);
    start.add([st, tri]);
    this.tweens.add({ targets: start, scale: 1.03, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

    const shop = pillButton(this, W / 2, 246, 230, 56, NAVY, NAVY_DARK, () => this.fire(onShop));
    const sh = label(this, -16, 0, 'Shop', 26, 0xffffff, true).setOrigin(0.5);
    shop.add([sh, cart(this, sh.width / 2 + 16, 0)]);
    c.add([start, shop]);
    return c;
  }

  private fire(fn: () => void): void {
    if (this.busy) return;
    fn();
  }

  /** Leafy pot plant peeking in from a bottom corner; `dir` 1 = left side. */
  private makePlant(x: number, baseY: number, dir: 1 | -1): Phaser.GameObjects.Container {
    const c = this.add.container(x, baseY);
    const g = this.add.graphics();
    const leaves: [number, number, number, number][] = [
      // angle (deg from up, toward the screen centre), length, width, shade
      [-50, 92, 34, 0],
      [-20, 120, 38, 1],
      [8, 110, 36, 0],
      [34, 104, 34, 1],
      [60, 84, 30, 0],
      [-5, 78, 28, 1],
    ];
    for (const [deg, len, wid, shade] of leaves) leaf(g, 0, -86, Phaser.Math.DegToRad(deg * dir), len, wid, shade ? 0x5cb46f : 0x3f8f5a);
    // pot
    g.fillStyle(dir > 0 ? 0xf3e6d6 : 0xd9734e, 1).fillPoints(
      [new Phaser.Math.Vector2(-46, -84), new Phaser.Math.Vector2(46, -84), new Phaser.Math.Vector2(36, 0), new Phaser.Math.Vector2(-36, 0)],
      true,
    );
    g.fillStyle(dir > 0 ? 0xe2cdb6 : 0xbf5c3a, 1).fillRoundedRect(-52, -96, 104, 20, 8);
    c.add(g);
    c.setAngle(-2 * dir);
    this.tweens.add({ targets: c, angle: 2 * dir, duration: 2300, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    return c;
  }
}

/** One lens-shaped leaf with a midrib, from (x, y) at `angle` (0 = straight up). */
function leaf(g: Phaser.GameObjects.Graphics, x: number, y: number, angle: number, len: number, wid: number, color: number): void {
  const pts: Phaser.Math.Vector2[] = [];
  const steps = 12;
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i <= steps; i++) {
      const t = side < 0 ? i / steps : 1 - i / steps;
      const half = Math.sin(t * Math.PI) * (wid / 2) * (1 - t * 0.25);
      pts.push(new Phaser.Math.Vector2(side * half, -t * len).rotate(angle).add({ x, y }));
    }
  }
  g.fillStyle(color, 1).fillPoints(pts, true);
  const tip = new Phaser.Math.Vector2(0, -len * 0.85).rotate(angle).add({ x, y });
  g.lineStyle(2, 0xffffff, 0.18).lineBetween(x, y, tip.x, tip.y);
}

function crown(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics({ x, y });
  const pts = [
    [-15, 10], [-15, -6], [-7, 1], [0, -11], [7, 1], [15, -6], [15, 10],
  ].map(([px, py]) => new Phaser.Math.Vector2(px, py));
  g.fillStyle(COLORS.coinDark, 1).fillPoints(pts.map((p) => p.clone().add({ x: 0, y: 2 })), true);
  g.fillStyle(0xf6b938, 1).fillPoints(pts, true);
  g.fillCircle(-15, -7, 3).fillCircle(0, -12, 3).fillCircle(15, -7, 3);
  return g;
}

function cart(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics({ x, y });
  g.lineStyle(3, 0xffffff, 1);
  g.beginPath();
  g.moveTo(-13, -10);
  g.lineTo(-8, -10);
  g.lineTo(-4, 5);
  g.lineTo(10, 5);
  g.lineTo(13, -5);
  g.lineTo(-6, -5);
  g.strokePath();
  g.fillStyle(0xffffff, 1).fillCircle(-2, 10, 2.5).fillCircle(8, 10, 2.5);
  return g;
}

// ---------- menu-front ----------

export class MenuFrontScene extends Phaser.Scene {
  private frame!: Phaser.GameObjects.Graphics;
  private muteBtn!: Phaser.GameObjects.Container;
  private soundIcon!: Phaser.GameObjects.Graphics;

  constructor() {
    super('menu-front');
  }

  create(): void {
    setupCamera(this);
    this.frame = this.add.graphics();
    this.soundIcon = this.add.graphics();
    this.muteBtn = pillButton(this, 0, 0, 52, 48, CREAM, 0xe2cdb6, () => {
      sfx.setMuted(!sfx.muted);
      this.drawSoundIcon();
    });
    this.muteBtn.add(this.soundIcon);
    this.drawSoundIcon();
    this.setFrame(menuLayout().win, 0);
  }

  /** Draw the cream window frame around `r`; `t` is how far the window has grown (1 = full screen). */
  setFrame(r: Rect, t: number): void {
    const g = this.frame;
    if (!g) return; // not created yet
    const R = 30;
    g.clear();
    g.setAlpha(1 - Phaser.Math.Clamp((t - 0.55) / 0.45, 0, 1));
    g.lineStyle(10, 0x000000, 0.22).strokeRoundedRect(r.x - 6, r.y - 2, r.w + 12, r.h + 14, R + 6);
    g.lineStyle(14, CREAM, 1).strokeRoundedRect(r.x - 3, r.y - 3, r.w + 6, r.h + 6, R + 3);
    // Round the inside corners: the game's camera viewport underneath is square.
    g.fillStyle(CREAM, 1);
    for (const [cx, cy, dx, dy] of [
      [r.x, r.y, 1, 1],
      [r.x + r.w, r.y, -1, 1],
      [r.x, r.y + r.h, 1, -1],
      [r.x + r.w, r.y + r.h, -1, -1],
    ]) {
      const pts = [new Phaser.Math.Vector2(cx, cy)];
      for (let i = 0; i <= 8; i++) {
        const a = (i / 8) * (Math.PI / 2);
        pts.push(new Phaser.Math.Vector2(cx + dx * R - dx * R * Math.sin(a), cy + dy * R - dy * R * Math.cos(a)));
      }
      g.fillPoints(pts, true);
    }
    g.lineStyle(2, 0xe8d5bb, 1).strokeRoundedRect(r.x + 3, r.y + 3, r.w - 6, r.h - 6, R - 4);

    this.muteBtn.setPosition(r.x + r.w - 42, r.y + 40);
    this.muteBtn.setAlpha(1 - Phaser.Math.Clamp(t * 4, 0, 1));
    if (t > 0) this.muteBtn.disableInteractive();
  }

  private drawSoundIcon(): void {
    const g = this.soundIcon;
    g.clear();
    g.fillStyle(COLORS.ink, 1).fillRect(-12, -5, 7, 10);
    g.fillTriangle(-6, -5, 4, -13, 4, 13);
    g.fillTriangle(-6, -5, -6, 5, 4, 13);
    g.lineStyle(3, COLORS.ink, 1);
    if (sfx.muted) {
      g.lineBetween(8, -6, 16, 6).lineBetween(16, -6, 8, 6);
      return;
    }
    g.beginPath();
    g.arc(4, 0, 7, -0.9, 0.9);
    g.strokePath();
    g.beginPath();
    g.arc(4, 0, 13, -0.9, 0.9);
    g.strokePath();
  }
}
