import Phaser from 'phaser';
import { DPR, FONT, GROUND_Y, HUD_H, Layout, W } from './Layout';
import { COLORS, hex } from './Palette';
import { pin } from './ui';

export interface Call {
  floor: number;
  up: boolean;
  down: boolean;
  /** 0 = just arrived, 1 = about to walk out */
  urgency: number;
  count: number;
}

const LAMP_OFF = 0x5a4a32;
const LAMP_ON = 0xffb02e;
const URGENT = 0.6;

/** Amber normally, red and pulsing when someone is close to walking out. */
export function callColor(urgency: number): number {
  return urgency >= URGENT ? COLORS.angry : LAMP_ON;
}

/**
 * "Someone's waiting" signals: a brass hall-call lamp beside the doors on every
 * floor (▲/▼ lit by where waiting people want to go), plus pinned chips at the
 * top and bottom of the screen for calls on floors scrolled out of view.
 */
export class CallsView {
  private lamps: {
    root: Phaser.GameObjects.Container;
    halo: Phaser.GameObjects.Graphics;
    h: number;
    up: Phaser.GameObjects.Triangle | null;
    down: Phaser.GameObjects.Triangle | null;
    lit: boolean;
  }[] = [];
  private chips: Record<'above' | 'below', { root: Phaser.GameObjects.Container; bg: Phaser.GameObjects.Graphics; text: Phaser.GameObjects.Text; floor: number }>;
  private t = 0;
  /** chips only show in play, not on the menu */
  chipsEnabled = false;

  constructor(
    private scene: Phaser.Scene,
    private layout: Layout,
    onChip: (floor: number) => void,
  ) {
    const x = layout.shaftX + layout.shaftW / 2 + 14;
    for (let f = 0; f < layout.floors; f++) {
      const root = scene.add.container(x, layout.floorY(f) - 56).setDepth(1.5);
      const hasUp = f < layout.floors - 1;
      const hasDown = f > 0;
      const h = hasUp && hasDown ? 44 : 28;
      const halo = scene.add.graphics();
      const g = scene.add.graphics();
      g.fillStyle(0x000000, 0.2).fillRoundedRect(-12, -h / 2 + 2, 24, h, 7);
      g.fillStyle(0xd9a441, 1).fillRoundedRect(-12, -h / 2, 24, h, 7);
      g.fillStyle(0x3a2f22, 1).fillRoundedRect(-9, -h / 2 + 3, 18, h - 6, 5);
      root.add([halo, g]);
      const up = hasUp ? scene.add.triangle(0, hasDown ? -9 : 0, 0, 11, 14, 11, 7, 0, LAMP_OFF) : null;
      const down = hasDown ? scene.add.triangle(0, hasUp ? 9 : 0, 0, 0, 14, 0, 7, 11, LAMP_OFF) : null;
      for (const tri of [up, down]) if (tri) root.add(tri);
      this.lamps.push({ root, halo, h, up, down, lit: false });
    }

    const chip = (y: number, dir: 'above' | 'below') => {
      const root = scene.add.container(W / 2, y).setDepth(55);
      const bg = scene.add.graphics();
      const text = scene.add
        .text(0, 0, '', { fontFamily: FONT, fontSize: '18px', fontStyle: 'bold', color: '#ffffff' })
        .setOrigin(0.5)
        .setResolution(DPR);
      root.add([bg, text]);
      root.setSize(170, 40).setInteractive({ useHandCursor: true }).setVisible(false);
      root.on('pointerdown', () => onChip(this.chips[dir].floor));
      pin(root);
      return { root, bg, text, floor: 0 };
    };
    this.chips = { above: chip(HUD_H + 26, 'above'), below: chip(GROUND_Y - 26, 'below') };
  }

  update(dt: number, calls: Call[], scrollY: number): void {
    this.t += dt;
    const pulse = 0.7 + 0.3 * Math.sin(this.t * 10);
    const byFloor = new Map(calls.map((c) => [c.floor, c]));
    this.lamps.forEach((lamp, f) => {
      const c = byFloor.get(f);
      const color = c ? callColor(c.urgency) : LAMP_OFF;
      const alpha = c && c.urgency >= URGENT ? pulse : 1;
      lamp.halo.clear();
      if (c) lamp.halo.fillStyle(color, 0.45 * alpha).fillRoundedRect(-19, -lamp.h / 2 - 7, 38, lamp.h + 14, 14);
      for (const [tri, on] of [
        [lamp.up, c?.up],
        [lamp.down, c?.down],
      ] as const) {
        tri?.setFillStyle(on ? color : LAMP_OFF, on ? alpha : 1);
      }
      // Ping when a floor starts calling.
      if (c && !lamp.lit) {
        lamp.root.setScale(1.5);
        this.scene.tweens.add({ targets: lamp.root, scale: 1, duration: 260, ease: 'Back.Out' });
      }
      lamp.lit = !!c;
    });

    // Calls on floors scrolled out of view.
    const { layout } = this;
    const mid = (f: number) => layout.floorY(f) - layout.floorH / 2;
    const above = calls.filter((c) => mid(c.floor) < scrollY + HUD_H);
    const below = calls.filter((c) => mid(c.floor) > scrollY + GROUND_Y);
    this.showChip('above', this.chipsEnabled ? above : [], pulse);
    this.showChip('below', this.chipsEnabled ? below : [], pulse);
  }

  private showChip(dir: 'above' | 'below', calls: Call[], pulse: number): void {
    const chip = this.chips[dir];
    chip.root.setVisible(calls.length > 0);
    if (!calls.length) return;
    const people = calls.reduce((n, c) => n + c.count, 0);
    const worst = Math.max(...calls.map((c) => c.urgency));
    // Tapping sends the lift to the nearest calling floor in that direction.
    chip.floor = dir === 'above' ? Math.min(...calls.map((c) => c.floor)) : Math.max(...calls.map((c) => c.floor));
    chip.text.setText(`${dir === 'above' ? '▲' : '▼'}  ${people} waiting`);
    const color = callColor(worst);
    const w = chip.text.width + 36;
    chip.bg.clear();
    chip.bg.fillStyle(0x000000, 0.25).fillRoundedRect(-w / 2, -16, w, 36, 18);
    chip.bg.fillStyle(color, worst >= URGENT ? 0.75 + 0.25 * pulse : 1).fillRoundedRect(-w / 2, -18, w, 36, 18);
    chip.text.setColor(hex(worst >= URGENT ? 0xffffff : COLORS.ink));
  }
}
