import Phaser from 'phaser';
import { DPR, FONT, HUD_H, W } from './Layout';
import { COLORS, hex } from './Palette';

export class Hud {
  private scoreText: Phaser.GameObjects.Text;
  private subText: Phaser.GameObjects.Text;
  private coinIcon: Phaser.GameObjects.Container;
  private hearts: Phaser.GameObjects.Graphics[] = [];
  private lives: number;
  private shown = 0;
  private target = 0;

  constructor(private scene: Phaser.Scene, lives: number) {
    const cy = HUD_H / 2 - 8;
    this.coinIcon = scene.add.container(42, cy).setDepth(50);
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

    this.lives = lives;
    this.setLives(lives, lives);
  }

  /** Redraw the heart row; grows when perks add hearts. */
  setLives(lives: number, max: number): void {
    const cy = HUD_H / 2 - 8;
    const gap = max > 6 ? 28 : 34;
    while (this.hearts.length < max) this.hearts.push(this.scene.add.graphics().setDepth(50));
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

  loseLife(livesLeft: number): void {
    this.lives = livesLeft;
    const g = this.hearts[livesLeft];
    if (!g) return;
    this.scene.tweens.add({
      targets: g,
      scale: 1.6,
      duration: 120,
      yoyo: true,
      onComplete: () => this.drawHeart(g, COLORS.heartEmpty),
    });
  }

  /** Coin counter rolls up rather than jumping. */
  update(dt: number): void {
    if (this.shown === this.target) return;
    this.shown = Math.min(this.target, this.shown + Math.max(1, (this.target - this.shown) * dt * 10));
    this.scoreText.setText(String(Math.floor(this.shown)));
  }
}
