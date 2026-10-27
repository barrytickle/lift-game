import Phaser from 'phaser';
import { DPR, FONT, GROUND_Y, HUD_H, Layout, W, floorLabel } from './Layout';
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

    this.drawSky(top - 14);

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

  /**
   * Night sky above the roof. Floors stop growing at MAX_FLOOR_H, so on tall phones a
   * short tower leaves open space under the HUD: fill it with the menu's skyline,
   * a moon and stars, plus an antenna and water tank on our roof. Room to grow.
   */
  private drawSky(roof: number): void {
    const scene = this.scene;
    const rnd = new Phaser.Math.RandomDataGenerator(['going-up-sky']);
    const skyTop = Math.min(0, roof - 300);
    const open = roof - HUD_H; // visible sky between HUD and roof when the camera is at rest
    const g = scene.add.graphics().setDepth(-1);
    // Flat night behind the HUD panel, so the gradient starts exactly where the panel ends.
    const fade = Math.min(HUD_H, roof - 40);
    g.fillStyle(COLORS.night, 1).fillRect(0, skyTop, W, fade - skyTop);
    g.fillGradientStyle(COLORS.night, COLORS.night, 0x33365a, 0x33365a, 1).fillRect(0, fade, W, roof - fade);

    if (open > 60) {
      // Moon with a soft halo, tucked into the top right.
      const my = HUD_H + Math.min(70, open * 0.3);
      g.fillStyle(0xffe9c7, 0.08).fillCircle(W - 86, my, 44);
      g.fillStyle(0xffe9c7, 0.12).fillCircle(W - 86, my, 32);
      g.fillStyle(0xffe9c7, 1).fillCircle(W - 86, my, 21);
      g.fillStyle(0xf3d9b1, 1).fillCircle(W - 92, my - 5, 4).fillCircle(W - 80, my + 7, 3);

      // Clouds, as on the menu.
      const cloud = (x: number, y: number, s: number) => {
        g.fillStyle(0x3a3e62, 1);
        g.fillCircle(x, y, 18 * s).fillCircle(x + 20 * s, y - 8 * s, 22 * s).fillCircle(x + 42 * s, y, 16 * s);
        g.fillRoundedRect(x - 18 * s, y, 76 * s, 16 * s, 8 * s);
      };
      cloud(40, HUD_H + open * 0.28, 1);
      if (open > 160) cloud(W * 0.45, HUD_H + open * 0.55, 0.8);

      // Stars, a few of them twinkling.
      for (let i = 0; i < Math.min(18, Math.floor(open / 14)); i++) {
        const sx = rnd.between(12, W - 12);
        const sy = rnd.between(HUD_H + 6, roof - 70);
        const star = scene.add.circle(sx, sy, rnd.frac() < 0.3 ? 2 : 1.3, 0xffe9c7, 0.4 + rnd.frac() * 0.5).setDepth(-1);
        if (i % 3 === 0)
          scene.tweens.add({ targets: star, alpha: 0.15, duration: 800 + rnd.between(0, 900), yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      }
    }

    // Distant towers peeking up behind ours, with a scatter of lit windows.
    const back = scene.add.graphics().setDepth(-1);
    const tower = (x: number, h: number, w: number, color: number) => {
      const t = roof - h;
      back.fillStyle(color, 1).fillRect(x, t, w, h);
      for (let wy = t + 12; wy < roof - 8; wy += 24)
        for (let wx = x + 7; wx < x + w - 9; wx += 15)
          if (rnd.frac() < 0.4) back.fillStyle(COLORS.coin, rnd.frac() < 0.8 ? 0.8 : 0.25).fillRect(wx, wy, 6, 10);
    };
    const reach = Math.max(30, Math.min(150, open * 0.45));
    tower(-6, reach * 0.9, 58, 0x2c2f4b);
    tower(70, reach * 0.55, 74, 0x303352);
    tower(W * 0.42, reach * 0.75, 64, 0x2c2f4b);
    tower(W - 150, reach * 0.45, 80, 0x303352);
    tower(W - 62, reach, 70, 0x2c2f4b);

    // Our rooftop: a water tank on the left and an antenna with a blinking light on the right.
    const r = scene.add.graphics().setDepth(-1);
    r.fillStyle(0x4a4d6c, 1).fillRect(186, roof - 14, 4, 14).fillRect(214, roof - 14, 4, 14);
    r.fillStyle(0x5b5f86, 1).fillRoundedRect(180, roof - 44, 44, 32, 6);
    r.fillStyle(0x6a6e96, 1).fillRect(180, roof - 34, 44, 3).fillRect(180, roof - 24, 44, 3);
    r.fillStyle(0x4a4d6c, 1).fillTriangle(176, roof - 42, 228, roof - 42, 202, roof - 58);
    r.fillStyle(0x4a4d6c, 1).fillRect(W - 70, roof - 64, 3, 64).fillRect(W - 78, roof - 44, 19, 3);
    const blink = scene.add.circle(W - 68.5, roof - 66, 3.5, 0xff5a5a, 1).setDepth(-1);
    scene.tweens.add({ targets: blink, alpha: 0.15, duration: 700, yoyo: true, repeat: -1, hold: 500 });
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
