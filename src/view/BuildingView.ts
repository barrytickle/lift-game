import Phaser from 'phaser';
import { DPR, FONT, GROUND_Y, Layout, W, floorLabel } from './Layout';
import { COLORS, FLOOR_COLORS, hex } from './Palette';
import type { RoomTheme } from './rooms';

/** Static building art (one themed room per floor) plus plaques and tap flashes. */
export class BuildingView {
  private flashes: Phaser.GameObjects.Rectangle[] = [];
  private plaques: Phaser.GameObjects.Container[] = [];
  private plaqueGlows: Phaser.GameObjects.Arc[] = [];

  constructor(private scene: Phaser.Scene, layout: Layout, rooms: RoomTheme[]) {
    const g = scene.add.graphics().setDepth(0);
    const { floors, floorH, shaftX, shaftW } = layout;
    const left = 16;
    const right = W - 16;
    const top = layout.floorY(floors) - 4;

    // Roof
    g.fillStyle(COLORS.cabFrame, 1).fillRoundedRect(left - 6, top - 14, right - left + 12, 18, 6);

    for (let f = 0; f < floors; f++) {
      const y = layout.floorY(f);
      const room = rooms[f];
      g.fillStyle(room.wall, 1).fillRect(left, y - floorH, right - left, floorH);
      room.draw(g, { l: shaftX + shaftW / 2 + 6, r: right, t: y - floorH, b: y - 4 });
      // Skirting + slab
      g.fillStyle(COLORS.slabTop, 1).fillRect(left, y - 4, right - left, 4);
      g.fillStyle(COLORS.slab, 1).fillRect(left, y, right - left, 6);

      // Tap flash overlay
      const flash = scene.add
        .rectangle(left, y - floorH, right - left, floorH, FLOOR_COLORS[f], 0)
        .setOrigin(0, 0)
        .setDepth(1);
      this.flashes.push(flash);

      // Floor plaque beside the shaft
      const px = shaftX + shaftW / 2 + 22;
      const py = y - floorH + 26;
      const glow = scene.add.circle(px, py, 21, FLOOR_COLORS[f], 0).setDepth(1);
      this.plaqueGlows.push(glow);
      const plaque = scene.add.container(px, py).setDepth(2);
      const pg = scene.add.graphics();
      pg.fillStyle(0x000000, 0.12).fillCircle(0, 2, 16);
      pg.fillStyle(FLOOR_COLORS[f], 1).fillCircle(0, 0, 15);
      const t = scene.add
        .text(0, 0, floorLabel(f), { fontFamily: FONT, fontSize: '18px', fontStyle: 'bold', color: '#ffffff' })
        .setOrigin(0.5, 0.52)
        .setResolution(DPR * 2);
      plaque.add([pg, t]);
      this.plaques.push(plaque);

      // Room name on a little sign next to the plaque
      const name = scene.add
        .text(px + 24, py, room.name, {
          fontFamily: FONT,
          fontSize: '13px',
          fontStyle: 'bold',
          color: room.dark ? '#ffffff' : hex(COLORS.ink),
          backgroundColor: room.dark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.7)',
          padding: { x: 7, y: 3 },
        })
        .setOrigin(0, 0.5)
        .setResolution(DPR * 2)
        .setDepth(2);
      name.setAlpha(0.9);
    }

    // Shaft
    g.fillStyle(COLORS.shaftDark, 1).fillRect(shaftX - shaftW / 2 - 6, top, shaftW + 12, GROUND_Y - top + 6);
    g.fillStyle(COLORS.shaft, 1).fillRect(shaftX - shaftW / 2, top, shaftW, GROUND_Y - top);
    g.lineStyle(2, COLORS.shaftDark, 1);
    for (let f = 0; f < floors; f++) {
      const y = layout.floorY(f);
      g.fillStyle(COLORS.shaftDark, 1).fillRect(shaftX - shaftW / 2, y, shaftW, 6);
    }
    // Guide rails
    g.fillStyle(0x5b5f86, 1).fillRect(shaftX - shaftW / 2 + 3, top, 3, GROUND_Y - top);
    g.fillRect(shaftX + shaftW / 2 - 6, top, 3, GROUND_Y - top);

    // Outside ground
    g.fillStyle(COLORS.nightLight, 1).fillRect(0, GROUND_Y + 6, W, 200);
    g.fillStyle(0x4a4d6c, 1).fillRect(0, GROUND_Y + 6, W, 6); // kerb
  }

  flash(f: number): void {
    const r = this.flashes[f];
    this.scene.tweens.killTweensOf(r);
    r.fillAlpha = 0.28;
    this.scene.tweens.add({ targets: r, fillAlpha: 0, duration: 380, ease: 'Quad.Out' });
    const p = this.plaques[f];
    this.scene.tweens.killTweensOf(p);
    p.setScale(1.35);
    this.scene.tweens.add({ targets: p, scale: 1, duration: 260, ease: 'Back.Out' });
  }

  /** Pulse the plaques of floors that riders in the lift want. */
  updateRequested(requested: Set<number>, t: number): void {
    this.plaqueGlows.forEach((glow, f) => {
      glow.fillAlpha = requested.has(f) ? 0.35 + Math.sin(t * 6) * 0.15 : 0;
      glow.setScale(requested.has(f) ? 1.1 + Math.sin(t * 6) * 0.08 : 1);
    });
  }
}
