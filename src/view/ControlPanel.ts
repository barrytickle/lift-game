import Phaser from 'phaser';
import type { Lift } from '../sim/Lift';
import { DPR, FONT, GROUND_Y, H, Layout, W, floorLabel } from './Layout';
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
 * Brass lift panel across the street strip: ▼ on the left, an LED floor readout
 * in the middle, ▲ on the right. Hold a button to drive the lift; let go and it
 * stops at the nearest floor. Pinned to the screen so it stays put while tall
 * towers scroll.
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
  /** button radius, sized to the panel */
  private r: number;

  constructor(private scene: Phaser.Scene, _layout: Layout, private handlers: PanelHandlers) {
    const pw = W - 32;
    const top = GROUND_Y + 12;
    const ph = H - top - 10;
    // Leave a clear margin above and below the buttons so their bezels never touch the plate's edge.
    this.r = Math.min(26, ph / 2 - 16);
    const c = (this.root = scene.add.container(W / 2, top).setDepth(60));

    const g = scene.add.graphics();
    g.fillStyle(0x000000, 0.3).fillRoundedRect(-pw / 2, 5, pw, ph, 18);
    g.fillStyle(BRASS_DARK, 1).fillRoundedRect(-pw / 2, 0, pw, ph, 18);
    g.fillStyle(BRASS, 1).fillRoundedRect(-pw / 2 + 4, 3, pw - 8, ph - 9, 15);
    g.fillStyle(0xffffff, 0.16).fillRoundedRect(-pw / 2 + 18, 7, pw - 36, 8, 4); // polished edge
    // screws in the corners
    for (const [sx, sy] of [[-1, 0], [1, 0], [-1, 1], [1, 1]]) {
      const x = sx * (pw / 2 - 15);
      const y = sy ? ph - 18 : 15;
      g.fillStyle(BRASS_DARK, 1).fillCircle(x, y, 4.5);
      g.fillStyle(0xf3c96b, 1).fillCircle(x - 1, y - 1, 2.5);
    }
    // LED window in the middle
    const lw = 128;
    const lh = ph - 26;
    const ly = (ph - 4) / 2;
    g.fillStyle(BRASS_DARK, 1).fillRoundedRect(-lw / 2 - 4, ly - lh / 2 - 4, lw + 8, lh + 8, 12);
    g.fillStyle(0x1b1424, 1).fillRoundedRect(-lw / 2, ly - lh / 2, lw, lh, 9);
    c.add(g);

    this.arrow = scene.add
      .text(-30, ly, '', { fontFamily: FONT, fontSize: '20px', fontStyle: 'bold', color: '#ff7a3d' })
      .setOrigin(0.5)
      .setResolution(DPR * 2);
    this.display = scene.add
      .text(12, ly + 1, 'G', { fontFamily: 'Courier New, monospace', fontSize: '38px', fontStyle: 'bold', color: '#ff7a3d' })
      .setOrigin(0.5)
      .setResolution(DPR * 2);
    c.add([this.arrow, this.display]);

    // Each button owns its whole end of the plate, so thumbs don't have to be precise.
    const inner = lw / 2 + 8;
    const outer = pw / 2 - 2;
    // Buttons sit in the middle of their half, closer to the display than to the plate's ends.
    const bx = (inner + outer) / 2 - 6;
    c.add(this.makeButton(scene, -bx, ly, -1, { x0: -outer, x1: -inner, h: ph }));
    c.add(this.makeButton(scene, bx, ly, 1, { x0: inner, x1: outer, h: ph }));
    pin(c);

    // Letting go anywhere (finger slid off the button) still counts as release.
    for (const ev of ['pointerup', 'pointerupoutside']) {
      scene.input.on(ev, (p: Phaser.Input.Pointer) => {
        if (p.id === this.holder) this.letGo();
      });
    }
  }

  private makeButton(
    scene: Phaser.Scene,
    x: number,
    y: number,
    dir: 1 | -1,
    hit: { x0: number; x1: number; h: number },
  ): Phaser.GameObjects.Container {
    const r = this.r;
    const b = scene.add.container(x, y);
    const ring = scene.add.circle(0, 3, r + 5, BRASS_DARK);
    const bezel = scene.add.circle(0, 0, r + 4, 0xe9bb5a);
    const face = scene.add.circle(0, 0, r, 0xfff6e0).setStrokeStyle(3, BRASS_DARK);
    const light = scene.add.circle(0, 0, r - 4, LED, 0);
    const t = scene.add
      .text(0, 0, dir > 0 ? '▲' : '▼', { fontFamily: FONT, fontSize: `${Math.round(r * 0.9)}px`, fontStyle: 'bold', color: '#2b2d42' })
      .setOrigin(0.5)
      .setResolution(DPR * 2);
    const hint = scene.add.graphics();
    this.hints.push(hint);
    b.add([hint, ring, bezel, face, light, t]);
    this.lights.push(light);
    this.buttons.push(b);
    // Hit area covers this whole end of the panel (x0..x1 in panel space), not just the disc.
    const zone = scene.add
      .zone((hit.x0 + hit.x1) / 2 - x, 0, hit.x1 - hit.x0, hit.h)
      .setInteractive({ useHandCursor: true });
    b.add(zone);
    zone.on('pointerdown', (p: Phaser.Input.Pointer) => {
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

  /** Greyed out while the lift heads home during a walkout (input is ignored then anyway). */
  setDim(on: boolean): void {
    this.scene.tweens.add({ targets: this.root, alpha: on ? 0.45 : 1, duration: 250 });
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
      g.lineStyle(5, callColor(worst), 0.45 + 0.55 * p).strokeCircle(0, 1, this.r + 9 + p * 3);
    });
    this.display.setText(floorLabel(Math.round(lift.position)));
    this.arrow.setText(lift.velocity > 0.05 ? '▲' : lift.velocity < -0.05 ? '▼' : '');
  }
}
