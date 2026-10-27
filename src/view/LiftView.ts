import Phaser from 'phaser';
import type { Lift } from '../sim/Lift';
import { Layout } from './Layout';
import { COLORS, type CabSkin } from './Palette';

// Depths: cab back (3) < riders (4) < glass doors (5)
export const DEPTH_CAB = 3;
export const DEPTH_RIDERS = 4;
export const DEPTH_DOORS = 5;

/** The cab, its cable, glass doors that slide open at stops, and the target marker. */
export class LiftView {
  private cab: Phaser.GameObjects.Container;
  private doors: Phaser.GameObjects.Graphics;
  private cable: Phaser.GameObjects.Graphics;
  private marker: Phaser.GameObjects.Triangle;
  private glow: Phaser.GameObjects.Graphics;
  private glowAmt = 0;
  private t = 0;
  private open = 0; // 0 closed .. 1 open
  private lastVel = 0;

  constructor(private scene: Phaser.Scene, private layout: Layout, skin: CabSkin) {
    const { cabW, cabH } = layout;
    this.cable = scene.add.graphics().setDepth(2);
    this.glow = scene.add.graphics().setDepth(2.5);

    this.cab = scene.add.container(layout.shaftX, layout.floorY(0)).setDepth(DEPTH_CAB);
    const g = scene.add.graphics();
    g.fillStyle(0x000000, 0.18).fillRoundedRect(-cabW / 2 - 4, -cabH - 2, cabW + 8, cabH + 6, 12);
    g.fillStyle(skin.frame, 1).fillRoundedRect(-cabW / 2 - 4, -cabH - 4, cabW + 8, cabH + 4, 12);
    g.fillStyle(skin.inner, 1).fillRoundedRect(-cabW / 2 + 3, -cabH + 6, cabW - 6, cabH - 10, 6);
    g.fillStyle(skin.trim, 1).fillRect(-cabW / 2 + 3, -cabH * 0.45, cabW - 6, 3); // handrail
    g.fillStyle(skin.trim, 1).fillRect(-cabW / 2 - 4, -cabH - 4, cabW + 8, 4); // top trim
    g.fillStyle(0xffe08a, 1).fillRoundedRect(-14, -cabH + 9, 28, 5, 2); // light
    this.cab.add(g);

    this.doors = scene.add.graphics().setDepth(DEPTH_DOORS);

    this.marker = scene.add
      .triangle(0, 0, 0, 0, 14, 0, 7, 10, COLORS.coin)
      .setDepth(2)
      .setAlpha(0);
  }

  get cabY(): number {
    return this.cab.y;
  }

  /** `useful`: floors where stopping does something; the cab glows green as it lines up with one. */
  update(dt: number, lift: Lift, useful: Set<number>): void {
    const { layout } = this;
    const y = layout.floorY(lift.position);
    this.cab.y = y;
    this.t += dt;
    this.drawGlow(dt, lift.position, useful, y);

    // Squash a touch on hard stops for weight.
    if (this.lastVel !== 0 && lift.velocity === 0) {
      this.scene.tweens.add({ targets: this.cab, scaleY: 0.94, scaleX: 1.04, duration: 70, yoyo: true, ease: 'Quad.Out' });
    }
    this.lastVel = lift.velocity;

    const wantOpen = lift.stoppedAt !== null ? 1 : 0;
    this.open += (wantOpen - this.open) * Math.min(1, dt * (wantOpen ? 10 : 22));
    this.drawDoors(y);

    // Cable from the top of the shaft
    const top = layout.floorY(layout.floors) - 4;
    this.cable.clear();
    this.cable.lineStyle(3, 0x22243a, 1);
    this.cable.beginPath().moveTo(layout.shaftX, top).lineTo(layout.shaftX, y - layout.cabH - 4).strokePath();

    // Target chevron while travelling
    if (lift.stoppedAt === null) {
      this.marker.setPosition(layout.shaftX - 7, layout.floorY(lift.target) - layout.cabH - 18);
      this.marker.alpha = Math.min(1, this.marker.alpha + dt * 6);
    } else {
      this.marker.alpha = Math.max(0, this.marker.alpha - dt * 6);
    }
  }

  private drawGlow(dt: number, pos: number, useful: Set<number>, y: number): void {
    let d = Infinity;
    for (const f of useful) d = Math.min(d, Math.abs(pos - f));
    // Full glow on the floor, fading out by a third of a floor away: release ▲/▼ as it lights up.
    const want = Phaser.Math.Clamp(1 - d / 0.35, 0, 1);
    this.glowAmt += (want - this.glowAmt) * Math.min(1, dt * 14);
    const g = this.glow;
    g.clear();
    if (this.glowAmt < 0.02) return;
    const { cabW, cabH, shaftX } = this.layout;
    const a = this.glowAmt * (0.85 + 0.15 * Math.sin(this.t * 6));
    for (const [pad, alpha] of [[18, 0.25], [11, 0.4], [5, 0.6]]) {
      g.fillStyle(COLORS.happy, alpha * a).fillRoundedRect(shaftX - cabW / 2 - 4 - pad, y - cabH - 4 - pad, cabW + 8 + pad * 2, cabH + 6 + pad * 2, 12 + pad);
    }
    g.lineStyle(4, 0x8ff0a8, a).strokeRoundedRect(shaftX - cabW / 2 - 7, y - cabH - 7, cabW + 14, cabH + 12, 14);
  }

  private drawDoors(y: number): void {
    const { cabW, cabH } = this.layout;
    const x0 = this.layout.shaftX;
    const half = (cabW - 6) / 2;
    const w = half * (1 - this.open * 0.92);
    const top = y - cabH + 6;
    const h = cabH - 10;
    const g = this.doors;
    g.clear();
    g.fillStyle(COLORS.glass, 0.38);
    g.lineStyle(2, 0xb9c8d6, 0.9);
    g.fillRect(x0 - half, top, w, h).strokeRect(x0 - half, top, w, h);
    g.fillRect(x0 + half - w, top, w, h).strokeRect(x0 + half - w, top, w, h);
  }
}
