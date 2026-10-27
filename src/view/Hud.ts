import Phaser from 'phaser';
import { DPR, FONT, HUD_H, W } from './Layout';
import { COLORS, hex } from './Palette';
import { label, pin } from './ui';

export class Hud {
  private scoreText: Phaser.GameObjects.Text;
  private subText: Phaser.GameObjects.Text;
  private coinIcon: Phaser.GameObjects.Container;
  private hearts: Phaser.GameObjects.Graphics[] = [];
  private lives: number;
  private root: Phaser.GameObjects.Container;
  private shown = 0;
  private target = 0;

  constructor(private scene: Phaser.Scene, lives: number) {
    const cy = HUD_H / 2 - 8;
    this.root = scene.add.container(0, 0).setDepth(50);
    this.root.add(scene.add.rectangle(0, 0, W, HUD_H - 4, COLORS.night).setOrigin(0));
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
    pin(this.root);
    this.lives = lives;
    this.setLives(lives, lives);
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
    if (this.shown === this.target) return;
    this.shown = Math.min(this.target, this.shown + Math.max(1, (this.target - this.shown) * dt * 10));
    this.scoreText.setText(String(Math.floor(this.shown)));
  }
}
