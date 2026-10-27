import Phaser from 'phaser';
import type { Lift } from '../sim/Lift';
import { DPR, FONT, GROUND_Y, H, Layout, floorLabel } from './Layout';
import { callColor, type Call } from './CallsView';
import { sfx } from './Sfx';
import { pin } from './ui';

const BRASS = 0xd9a441;
const BRASS_DARK = 0xa8782a;
const LED = 0xff7a3d;

export interface PanelHandlers {
  hold(dir: 1 | -1): void;
  release(): void;
}

/**
 * Brass lift panel at the foot of the shaft: an LED floor readout plus ▲/▼
 * buttons. Hold a button to drive the lift; let go and it stops at the next
 * floor. Pinned to the screen so it stays put while tall towers scroll.
 */
export class ControlPanel {
  private display: Phaser.GameObjects.Text;
  private arrow: Phaser.GameObjects.Text;
  private lights: Phaser.GameObjects.Arc[] = [];
  private buttons: Phaser.GameObjects.Container[] = [];
  /** pulsing rings round ▼ / ▲ when someone is waiting below / above */
  private hints: Phaser.GameObjects.Graphics[] = [];
  private t = 0;
  /** pointer id holding a button (-1 = keyboard), so another finger can't cancel it */
  private holder: number | null = null;
  private root: Phaser.GameObjects.Container;

  constructor(private scene: Phaser.Scene, layout: Layout, private handlers: PanelHandlers) {
    const pw = layout.shaftW + 32;
    const top = GROUND_Y + 14;
    const ph = H - top - 8;
    const c = (this.root = scene.add.container(layout.shaftX, top).setDepth(60));

    const g = scene.add.graphics();
    g.fillStyle(0x000000, 0.3).fillRoundedRect(-pw / 2, 4, pw, ph, 12);
    g.fillStyle(BRASS_DARK, 1).fillRoundedRect(-pw / 2, 0, pw, ph, 12);
    g.fillStyle(BRASS, 1).fillRoundedRect(-pw / 2 + 3, 3, pw - 6, ph - 8, 10);
    // screws
    g.fillStyle(BRASS_DARK, 1).fillCircle(-pw / 2 + 10, 10, 2.5).fillCircle(pw / 2 - 10, 10, 2.5);
    // LED window
    g.fillStyle(0x1b1424, 1).fillRoundedRect(-30, 8, 60, 26, 6);
    c.add(g);

    this.arrow = scene.add
      .text(-14, 21, '', { fontFamily: FONT, fontSize: '14px', fontStyle: 'bold', color: '#ff7a3d' })
      .setOrigin(0.5)
      .setResolution(DPR * 2);
    this.display = scene.add
      .text(8, 21, 'G', { fontFamily: 'Courier New, monospace', fontSize: '22px', fontStyle: 'bold', color: '#ff7a3d' })
      .setOrigin(0.5)
      .setResolution(DPR * 2);
    c.add([this.arrow, this.display]);

    const by = ph - 34;
    c.add(this.makeButton(scene, -31, by, -1));
    c.add(this.makeButton(scene, 31, by, 1));
    pin(c);

    // Letting go anywhere (finger slid off the button) still counts as release.
    scene.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (p.id === this.holder) this.letGo();
    });
  }

  private makeButton(scene: Phaser.Scene, x: number, y: number, dir: 1 | -1): Phaser.GameObjects.Container {
    const r = 25;
    const b = scene.add.container(x, y);
    const ring = scene.add.circle(0, 2, r + 3, BRASS_DARK);
    const face = scene.add.circle(0, 0, r, 0xfff6e0).setStrokeStyle(3, BRASS_DARK);
    const light = scene.add.circle(0, 0, r - 4, LED, 0);
    const t = scene.add
      .text(0, 0, dir > 0 ? '▲' : '▼', { fontFamily: FONT, fontSize: '22px', fontStyle: 'bold', color: '#2b2d42' })
      .setOrigin(0.5)
      .setResolution(DPR * 2);
    const hint = scene.add.graphics();
    this.hints.push(hint);
    b.add([hint, ring, face, light, t]);
    this.lights.push(light);
    this.buttons.push(b);
    // Generous hit area, bigger than the drawn disc.
    b.setSize(64, 64).setInteractive({ useHandCursor: true });
    b.on('pointerdown', (p: Phaser.Input.Pointer) => {
      sfx.unlock();
      this.light(dir);
      this.holder = p.id;
      this.handlers.hold(dir);
    });
    return b;
  }

  private light(dir: 1 | -1): void {
    const i = dir > 0 ? 1 : 0;
    this.buttons[i].setScale(0.9);
    this.lights[i].fillAlpha = 0.85;
  }

  /** Keyboard hold: same as pressing the button. */
  press(dir: 1 | -1): void {
    if (this.holder !== null) return;
    this.light(dir);
    this.holder = -1;
    this.handlers.hold(dir);
  }

  /** Release whichever button is held (pointer up, or key up). */
  letGo(): void {
    if (this.holder === null) return;
    this.holder = null;
    this.buttons.forEach((b) => b.setScale(1));
    this.lights.forEach((l) => (l.fillAlpha = 0));
    this.handlers.release();
  }

  setVisible(on: boolean): void {
    this.root.setVisible(on);
  }

  /** Appear when the menu window has grown into the live game. */
  fadeIn(): void {
    this.root.setVisible(true).setAlpha(0);
    this.scene.tweens.add({ targets: this.root, alpha: 1, duration: 350 });
  }

  update(dt: number, lift: Lift, calls: Call[]): void {
    this.t += dt;
    const above = calls.filter((c) => c.floor > lift.position + 0.01);
    const below = calls.filter((c) => c.floor < lift.position - 0.01);
    [below, above].forEach((cs, i) => {
      const g = this.hints[i];
      g.clear();
      if (!cs.length) return;
      const worst = Math.max(...cs.map((c) => c.urgency));
      const p = 0.5 + 0.5 * Math.sin(this.t * (worst >= 0.6 ? 12 : 6));
      g.lineStyle(5, callColor(worst), 0.45 + 0.55 * p).strokeCircle(0, 1, 31 + p * 3);
    });
    this.display.setText(floorLabel(Math.round(lift.position)));
    this.arrow.setText(lift.velocity > 0.05 ? '▲' : lift.velocity < -0.05 ? '▼' : '');
  }
}
