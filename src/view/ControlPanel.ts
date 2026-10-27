import Phaser from 'phaser';
import type { Lift } from '../sim/Lift';
import { DPR, FONT, GROUND_Y, H, Layout, floorLabel } from './Layout';
import { sfx } from './Sfx';

const BRASS = 0xd9a441;
const BRASS_DARK = 0xa8782a;
const LED = 0xff7a3d;

/**
 * Brass lift panel at the foot of the shaft: an LED floor readout plus ▲/▼
 * buttons that step the lift's destination. It sits below the building, so when
 * taller towers scroll it can stay pinned while the floors move.
 */
export class ControlPanel {
  private display: Phaser.GameObjects.Text;
  private arrow: Phaser.GameObjects.Text;
  private lights: Phaser.GameObjects.Arc[] = [];

  constructor(scene: Phaser.Scene, layout: Layout, onStep: (dir: 1 | -1) => void) {
    const pw = layout.shaftW + 32;
    const top = GROUND_Y + 14;
    const ph = H - top - 8;
    const c = scene.add.container(layout.shaftX, top).setDepth(60);

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
    ([
      [-1, -31],
      [1, 31],
    ] as const).forEach(([dir, x]) => c.add(this.makeButton(scene, x, by, dir === 1 ? '▲' : '▼', () => onStep(dir))));
  }

  private makeButton(scene: Phaser.Scene, x: number, y: number, glyph: string, onPress: () => void): Phaser.GameObjects.Container {
    const r = 25;
    const b = scene.add.container(x, y);
    const ring = scene.add.circle(0, 2, r + 3, BRASS_DARK);
    const face = scene.add.circle(0, 0, r, 0xfff6e0).setStrokeStyle(3, BRASS_DARK);
    const light = scene.add.circle(0, 0, r - 4, LED, 0);
    const t = scene.add
      .text(0, 0, glyph, { fontFamily: FONT, fontSize: '22px', fontStyle: 'bold', color: '#2b2d42' })
      .setOrigin(0.5)
      .setResolution(DPR * 2);
    b.add([ring, face, light, t]);
    this.lights.push(light);
    // Generous hit area: the whole half of the panel, not just the disc.
    b.setSize(64, 64).setInteractive({ useHandCursor: true });
    b.on('pointerdown', () => {
      sfx.unlock();
      b.setScale(0.9);
      light.fillAlpha = 0.85;
      scene.tweens.add({ targets: light, fillAlpha: 0, duration: 450, delay: 120 });
      onPress();
    });
    b.on('pointerup', () => b.setScale(1));
    b.on('pointerout', () => b.setScale(1));
    return b;
  }

  update(lift: Lift): void {
    this.display.setText(floorLabel(Math.round(lift.position)));
    this.arrow.setText(lift.velocity > 0.05 ? '▲' : lift.velocity < -0.05 ? '▼' : '');
  }
}
