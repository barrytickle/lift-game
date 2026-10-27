import Phaser from 'phaser';
import { DPR, FONT, HUD_H, W } from './Layout';
import { COLORS, hex } from './Palette';
import { sfx } from './Sfx';
import { label, pin } from './ui';

/** Perk XP bar size (design units). */
const XP_W = 150;
const XP_H = 16;

/** Five-pointed star outline, centred on the origin. */
function starPoints(outer: number, inner: number, dy: number): Phaser.Math.Vector2[] {
  const pts: Phaser.Math.Vector2[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? inner : outer;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(new Phaser.Math.Vector2(Math.cos(a) * r, Math.sin(a) * r + dy));
  }
  return pts;
}

export class Hud {
  private scoreText: Phaser.GameObjects.Text;
  private subText: Phaser.GameObjects.Text;
  private coinIcon: Phaser.GameObjects.Container;
  private hearts: Phaser.GameObjects.Graphics[] = [];
  private lives: number;
  private root: Phaser.GameObjects.Container;
  private shown = 0;
  private target = 0;
  private muteBtn: Phaser.GameObjects.Container;
  private muteIcon: Phaser.GameObjects.Graphics;
  private perksBtn: Phaser.GameObjects.Container;
  private badge: Phaser.GameObjects.Container;
  private badgeText: Phaser.GameObjects.Text;
  /** perk "XP" bar under the star button: fills towards the next draft */
  private xpFill: Phaser.GameObjects.Graphics;
  private xpText: Phaser.GameObjects.Text;
  private xpBar: Phaser.GameObjects.Container;
  private xpShown = 0;
  private xpTarget = 0;

  /**
   * @param opts.panel solid backing behind the HUD row: only for towers that scroll,
   *   so rooms don't slide under the counters; short towers show the sky instead
   * @param opts.onPerks the star button: show the perks picked this shift
   */
  constructor(private scene: Phaser.Scene, lives: number, opts: { panel: boolean; onPerks: () => void }) {
    const cy = HUD_H / 2 - 8;
    this.root = scene.add.container(0, 0).setDepth(50);
    if (opts.panel) this.root.add(scene.add.rectangle(0, 0, W, HUD_H - 4, COLORS.night).setOrigin(0));
    this.coinIcon = scene.add.container(42, cy);
    const cg = scene.add.graphics();
    cg.fillStyle(COLORS.coinDark, 1).fillCircle(0, 2, 17);
    cg.fillStyle(COLORS.coin, 1).fillCircle(0, 0, 17);
    cg.lineStyle(3, COLORS.coinDark, 1).strokeCircle(0, 0, 10);
    this.coinIcon.add(cg);

    this.scoreText = scene.add
      .text(68, cy, '0', { fontFamily: FONT, fontSize: '40px', fontStyle: 'bold', color: '#ffffff' })
      .setOrigin(0, 0.5)
      .setResolution(DPR)
      .setDepth(50);
    this.subText = scene.add
      .text(26, cy + 38, '', { fontFamily: FONT, fontSize: '16px', color: hex(0xa9acc9) })
      .setOrigin(0, 0.5)
      .setResolution(DPR)
      .setDepth(50);

    this.root.add([this.coinIcon, this.scoreText, this.subText]);

    // Mute and perks buttons, tucked in just left of the hearts (placed by setLives).
    this.muteIcon = scene.add.graphics();
    this.muteBtn = this.squareButton(this.muteIcon, () => {
      sfx.unlock();
      sfx.setMuted(!sfx.muted);
      this.drawMuteIcon();
    });
    this.drawMuteIcon();

    const star = scene.add.graphics();
    star.fillStyle(COLORS.coinDark, 1).fillPoints(starPoints(13, 6, 1.5), true);
    star.fillStyle(COLORS.coin, 1).fillPoints(starPoints(12, 5.5, 0), true);
    this.perksBtn = this.squareButton(star, opts.onPerks);
    this.badge = scene.add.container(17, -17).setVisible(false);
    this.badgeText = label(scene, 0, 0, '0', 12, 0xffffff, true).setOrigin(0.5);
    this.badge.add([scene.add.circle(0, 0, 10, COLORS.cabFrame).setStrokeStyle(2, 0xffffff), this.badgeText]);
    this.perksBtn.add(this.badge);
    this.root.add([this.muteBtn, this.perksBtn]);

    // Perk XP bar on the second row, right-aligned under the buttons.
    this.xpBar = scene.add.container(W - 16 - XP_W, cy + 40);
    const track = scene.add.graphics();
    track.fillStyle(0x000000, 0.35).fillRoundedRect(0, -XP_H / 2 + 2, XP_W, XP_H, XP_H / 2);
    track.fillStyle(0x1b1d2e, 1).fillRoundedRect(0, -XP_H / 2, XP_W, XP_H, XP_H / 2);
    track.lineStyle(2, 0x5b5f86, 1).strokeRoundedRect(0, -XP_H / 2, XP_W, XP_H, XP_H / 2);
    this.xpFill = scene.add.graphics();
    this.xpText = label(scene, XP_W / 2, 0, '', 11, 0xffffff, true).setOrigin(0.5).setStroke('#1b1d2e', 3);
    this.xpBar.add([track, this.xpFill, this.xpText]);
    this.root.add(this.xpBar);

    pin(this.root);
    this.lives = lives;
    this.setLives(lives, lives);
  }

  /** Dark rounded square with an icon, pressed with a little squash. */
  private squareButton(icon: Phaser.GameObjects.Graphics, onClick: () => void): Phaser.GameObjects.Container {
    const s = 44;
    const c = this.scene.add.container(0, HUD_H / 2 - 8);
    const g = this.scene.add.graphics();
    g.fillStyle(0x000000, 0.25).fillRoundedRect(-s / 2, -s / 2 + 3, s, s, 12);
    g.fillStyle(0x3a3d58, 1).fillRoundedRect(-s / 2, -s / 2, s, s, 12);
    g.lineStyle(2, 0x5b5f86, 1).strokeRoundedRect(-s / 2, -s / 2, s, s, 12);
    c.add([g, icon]);
    c.setSize(s + 8, s + 8).setInteractive({ useHandCursor: true });
    c.on('pointerdown', () => c.setScale(0.9));
    c.on('pointerout', () => c.setScale(1));
    c.on('pointerup', () => {
      if (c.scale === 1) return; // finger slid off
      c.setScale(1);
      onClick();
    });
    return c;
  }

  private drawMuteIcon(): void {
    const g = this.muteIcon.clear();
    g.fillStyle(0xffffff, 1).fillRect(-11, -5, 6, 10).fillTriangle(-6, -5, -6, 5, 3, -11).fillTriangle(-6, 5, 3, 11, 3, -11);
    g.lineStyle(2.5, 0xffffff, 1);
    if (sfx.muted) {
      g.lineBetween(6, -5, 14, 5).lineBetween(14, -5, 6, 5);
    } else {
      g.beginPath().arc(4, 0, 6, -0.9, 0.9).strokePath();
      g.beginPath().arc(4, 0, 11, -0.9, 0.9).strokePath();
    }
  }

  /** Deliveries towards the next perk draft; the bar glides there and pops when it fills. */
  setDraftProgress(done: number, need: number): void {
    const t = need > 0 ? Phaser.Math.Clamp(done / need, 0, 1) : 1;
    this.xpTarget = t;
    if (t < this.xpShown) {
      this.xpShown = 0; // a new level: start the bar again from empty
      this.drawXp();
    }
    this.xpText.setText(`${Math.min(done, need)} / ${need}`);
    if (t >= 1) {
      this.scene.tweens.killTweensOf(this.xpBar);
      this.xpBar.setScale(1);
      this.scene.tweens.add({ targets: this.xpBar, scaleY: 1.4, duration: 140, yoyo: true, repeat: 1 });
    }
  }

  private drawXp(): void {
    const w = Math.max(0, (XP_W - 4) * this.xpShown);
    this.xpFill.clear();
    if (w < 1) return;
    this.xpFill.fillStyle(COLORS.coinDark, 1).fillRoundedRect(2, -XP_H / 2 + 2, Math.max(w, XP_H - 4), XP_H - 4, (XP_H - 4) / 2);
    this.xpFill.fillStyle(COLORS.coin, 1).fillRoundedRect(2, -XP_H / 2 + 2, Math.max(w, XP_H - 4), (XP_H - 4) * 0.6, (XP_H - 4) * 0.3);
  }

  /** Number of different perks picked this shift, shown as a badge on the star. */
  setPerkCount(n: number): void {
    this.badge.setVisible(n > 0);
    this.badgeText.setText(String(n));
    if (n > 0) {
      this.badge.setScale(1.6);
      this.scene.tweens.add({ targets: this.badge, scale: 1, duration: 300, ease: 'Back.Out' });
    }
  }

  setVisible(on: boolean): void {
    this.root.setVisible(on);
  }

  /** Appear when the menu window has grown into the live game. */
  fadeIn(): void {
    this.root.setVisible(true).setAlpha(0);
    this.scene.tweens.add({ targets: this.root, alpha: 1, duration: 350 });
  }

  /** Redraw the heart row; grows when perks add hearts. */
  setLives(lives: number, max: number): void {
    const cy = HUD_H / 2 - 8;
    const gap = max > 6 ? 28 : 34;
    while (this.hearts.length < max) {
      const g = pin(this.scene.add.graphics());
      this.root.add(g);
      this.hearts.push(g);
    }
    this.hearts.forEach((g, i) => {
      g.setPosition(W - 30 - i * gap, cy).setScale(max > 6 ? 0.85 : 1);
      this.drawHeart(g, i < lives ? COLORS.heart : COLORS.heartEmpty);
    });
    // Buttons sit just left of the leftmost heart.
    const heartsLeft = W - 30 - (max - 1) * gap - 14;
    this.perksBtn.x = heartsLeft - 14 - 22;
    this.muteBtn.x = this.perksBtn.x - 44 - 10;
    if (lives > this.lives) {
      const g = this.hearts[lives - 1];
      g.setScale(0.2);
      this.scene.tweens.add({ targets: g, scale: max > 6 ? 0.85 : 1, duration: 400, ease: 'Back.Out' });
    }
    this.lives = lives;
  }

  private drawHeart(g: Phaser.GameObjects.Graphics, color: number): void {
    g.clear();
    g.fillStyle(color, 1);
    g.fillCircle(-6, -3, 7.5).fillCircle(6, -3, 7.5);
    g.fillTriangle(-13, 0, 13, 0, 0, 14);
  }

  setScore(score: number): void {
    this.target = score;
    this.scene.tweens.killTweensOf(this.coinIcon);
    this.coinIcon.setScale(1.3);
    this.scene.tweens.add({ targets: this.coinIcon, scale: 1, duration: 240, ease: 'Back.Out' });
  }

  setDelivered(n: number): void {
    this.subText.setText(`${n} delivered`);
  }

  /** Swell, wobble, then crack in two: the halves tumble away and an empty heart pops in. */
  loseLife(livesLeft: number): void {
    this.lives = livesLeft;
    const g = this.hearts[livesLeft];
    if (!g) return;
    const base = g.scaleX;
    this.scene.tweens.killTweensOf(g);
    this.scene.tweens.chain({
      targets: g,
      tweens: [
        { scale: base * 1.7, duration: 160, ease: 'Back.Out' },
        { angle: 14, duration: 55, yoyo: true, repeat: 2, ease: 'Sine.InOut' },
      ],
      onComplete: () => {
        g.setAngle(0).setScale(base * 0.2);
        this.drawHeart(g, COLORS.heartEmpty);
        this.scene.tweens.add({ targets: g, scale: base, duration: 380, delay: 220, ease: 'Back.Out' });
        this.crack(g.x, g.y, base * 1.4);
      },
    });
    const minus = label(this.scene, g.x, g.y + 26, '-1', 20, COLORS.heart, true).setOrigin(0.5).setStroke('#ffffff', 5);
    this.root.add(pin(minus));
    this.scene.tweens.add({ targets: minus, y: minus.y + 18, alpha: 0, delay: 500, duration: 700, onComplete: () => minus.destroy() });
  }

  /** Two heart halves that split apart and fall. */
  private crack(x: number, y: number, s: number): void {
    for (const side of [-1, 1]) {
      const half = pin(this.scene.add.graphics({ x, y }).setScale(s));
      half.fillStyle(COLORS.heart, 1);
      half.fillCircle(side * 6, -3, 7.5);
      half.fillTriangle(side * 13, 0, 0, 0, 0, 14);
      half.fillTriangle(side * 1, -6, 0, 0, side * 3, 4); // jagged edge
      this.root.add(half);
      this.scene.tweens.add({
        targets: half,
        x: x + side * 22,
        y: y + 46,
        angle: side * 50,
        alpha: 0,
        duration: 650,
        ease: 'Quad.In',
        onComplete: () => half.destroy(),
      });
    }
  }

  /** Coin counter rolls up rather than jumping. */
  update(dt: number): void {
    if (this.xpShown !== this.xpTarget) {
      const step = (this.xpTarget - this.xpShown) * Math.min(1, dt * 8);
      this.xpShown = Math.abs(step) < 0.002 ? this.xpTarget : this.xpShown + step;
      this.drawXp();
    }
    if (this.shown === this.target) return;
    this.shown = Math.min(this.target, this.shown + Math.max(1, (this.target - this.shown) * dt * 10));
    this.scoreText.setText(String(Math.floor(this.shown)));
  }
}
