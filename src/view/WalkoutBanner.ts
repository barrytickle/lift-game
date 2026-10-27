import Phaser from 'phaser';
import { H, W } from './Layout';
import { COLORS } from './Palette';
import { label, pin } from './ui';

const CREAM = 0xfff6ea;
const CORAL = 0xec6a50;
const CARD_W = 320;
const CARD_H = 142;

const BREATHER_LINES = [
  "Everyone's had enough. Deep breaths…",
  "They'll be back after a cuppa.",
  'The tenants have spoken. Breathe…',
  'Quick breather, then back to it!',
];

/**
 * The walkout card: "Walkout!" with a breather bar that fills while the lift
 * heads home, then "Back to work!". Also softly dims the building meanwhile.
 */
export class WalkoutBanner {
  private root: Phaser.GameObjects.Container;
  private dim: Phaser.GameObjects.Rectangle;
  private title: Phaser.GameObjects.Text;
  private sub: Phaser.GameObjects.Text;
  private bar: Phaser.GameObjects.Graphics;
  private fill = { t: 0 };

  constructor(private scene: Phaser.Scene) {
    // Below the HUD (50) and panel (60) so hearts stay readable while it's up.
    this.dim = pin(scene.add.rectangle(0, 0, W, H, COLORS.night, 0).setOrigin(0).setDepth(45));
    const c = (this.root = scene.add.container(W / 2, H * 0.4).setDepth(70));
    const g = scene.add.graphics();
    g.fillStyle(0x000000, 0.25).fillRoundedRect(-CARD_W / 2, -CARD_H / 2 + 7, CARD_W, CARD_H, 26);
    g.fillStyle(CREAM, 1).fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 26);
    g.lineStyle(2, 0xf0dcc2, 1).strokeRoundedRect(-CARD_W / 2 + 1, -CARD_H / 2 + 1, CARD_W - 2, CARD_H - 2, 25);
    this.title = label(scene, 0, -CARD_H / 2 + 18, '', 34, CORAL, true).setOrigin(0.5, 0).setStroke('#ffffff', 6);
    this.sub = label(scene, 0, -CARD_H / 2 + 64, '', 16, 0x6b6e8a, false, CARD_W - 40).setOrigin(0.5, 0);
    this.bar = scene.add.graphics();
    c.add([g, this.title, this.sub, this.bar]);
    pin(c);
    c.setVisible(false);
  }

  /** Pop the card in. `seconds` > 0 shows a breather bar that fills over that time. */
  show(title: string, sub: string | null, seconds: number): void {
    const { scene, root } = this;
    scene.tweens.killTweensOf([root, this.fill, this.dim]);
    this.title.setText(title);
    this.sub.setText(sub ?? Phaser.Utils.Array.GetRandom(BREATHER_LINES)).setVisible(true);
    this.fill.t = 0;
    this.drawBar(seconds > 0);
    root.setVisible(true).setAlpha(1).setScale(0.6).setAngle(-4);
    scene.tweens.add({ targets: root, scale: 1, angle: 0, duration: 380, ease: 'Back.Out' });
    scene.tweens.add({ targets: this.dim, fillAlpha: 0.22, duration: 400 });
    if (seconds > 0) {
      scene.tweens.add({ targets: this.fill, t: 1, duration: seconds * 1000, onUpdate: () => this.drawBar(true) });
    }
  }

  /** Breather over: cheer, then tuck the card away. */
  backToWork(): void {
    const { scene, root } = this;
    scene.tweens.killTweensOf([root, this.fill]);
    this.title.setText('Back to work!').setColor('#4fae6b');
    this.sub.setVisible(false);
    this.bar.clear();
    scene.tweens.add({ targets: root, scale: 1.12, duration: 140, yoyo: true, ease: 'Quad.Out' });
    scene.time.delayedCall(850, () => this.hide());
  }

  hide(): void {
    const { scene, root } = this;
    scene.tweens.add({
      targets: root,
      alpha: 0,
      y: root.y - 24,
      duration: 260,
      onComplete: () => {
        root.setVisible(false).setY(H * 0.4);
        this.title.setColor('#ec6a50');
      },
    });
    scene.tweens.add({ targets: this.dim, fillAlpha: 0, duration: 400 });
  }

  private drawBar(on: boolean): void {
    const g = this.bar;
    g.clear();
    if (!on) return;
    const w = CARD_W - 64;
    const y = CARD_H / 2 - 24;
    g.fillStyle(0xeadbc6, 1).fillRoundedRect(-w / 2, y, w, 10, 5);
    if (this.fill.t > 0.02) g.fillStyle(CORAL, 1).fillRoundedRect(-w / 2, y, w * this.fill.t, 10, 5);
  }
}
