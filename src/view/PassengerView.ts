import Phaser from 'phaser';
import type { Passenger } from '../sim/World';
import { DPR, FONT, floorLabel } from './Layout';
import { BODY_COLORS, COLORS, FLOOR_COLORS, lerpColor } from './Palette';

const WALK_SPEED = 300; // px/s
type Mood = 0 | 1 | 2 | 3; // happy, fine, worried, furious

/**
 * A little capsule person built entirely from Graphics. The container sits at
 * the passenger's feet; `inner` carries the hop/squash so the shadow stays put.
 */
export class PassengerView extends Phaser.GameObjects.Container {
  private inner: Phaser.GameObjects.Container;
  private bodyG: Phaser.GameObjects.Graphics;
  private faceG: Phaser.GameObjects.Graphics;
  private badge: Phaser.GameObjects.Container;
  private ring: Phaser.GameObjects.Graphics;
  private shadow: Phaser.GameObjects.Ellipse;

  private readonly bw: number;
  private readonly bh: number;
  private readonly baseColor: number;
  private mood: Mood = 0;
  private blink = 0;
  private blinkTimer: number;
  private phase = 0;
  private t = Math.random() * 10;
  private facing = -1;
  /** set once the sim is done with this passenger; view plays its exit */
  leaving = false;

  private readonly accessory: string;

  constructor(scene: Phaser.Scene, x: number, y: number, readonly p: Passenger, accessories: string[] = ['none']) {
    super(scene, x, y);
    const look = p.look;
    this.accessory = accessories[Math.floor(look * 1000) % accessories.length];
    this.bw = 34 + Math.floor((look * 97) % 1 * 10);
    this.bh = 46 + Math.floor((look * 53) % 1 * 16);
    this.baseColor = BODY_COLORS[Math.floor(look * BODY_COLORS.length)];
    this.blinkTimer = 1 + Math.random() * 3;

    this.shadow = scene.add.ellipse(0, 0, this.bw * 1.1, 8, 0x000000, 0.12);
    this.inner = scene.add.container(0, 0);
    this.bodyG = scene.add.graphics();
    this.faceG = scene.add.graphics();
    this.inner.add([this.bodyG, this.faceG]);
    this.drawBody(this.baseColor);
    this.drawFace();

    // Destination badge: floor-coloured disc, floor label, patience ring.
    this.badge = scene.add.container(0, -this.bh - 22);
    const disc = scene.add.graphics();
    disc.fillStyle(0x000000, 0.12).fillCircle(0, 2, 15);
    disc.fillStyle(FLOOR_COLORS[p.dest], 1).fillCircle(0, 0, 14);
    const label = scene.add
      .text(0, 0, floorLabel(p.dest), { fontFamily: FONT, fontSize: '17px', fontStyle: 'bold', color: '#ffffff' })
      .setOrigin(0.5, 0.52)
      .setResolution(DPR * 2);
    this.ring = scene.add.graphics();
    this.badge.add([disc, this.ring, label]);
    this.inner.add(this.badge);

    this.add([this.shadow, this.inner]);
    scene.add.existing(this);

    // Pop in.
    this.inner.setScale(0.2);
    scene.tweens.add({ targets: this.inner, scale: 1, duration: 320, ease: 'Back.Out' });
  }

  private drawBody(color: number): void {
    const w = this.bw, h = this.bh;
    const g = this.bodyG;
    g.clear();
    g.fillStyle(lerpColor(color, 0x000000, 0.18), 1).fillRoundedRect(-w / 2, -h, w, h, w * 0.45);
    g.fillStyle(color, 1).fillRoundedRect(-w / 2, -h, w, h - 3, w * 0.45);
    drawAccessory(g, this.accessory, w, h, color);
  }

  private drawFace(): void {
    const g = this.faceG;
    const h = this.bh;
    const ey = -h * 0.62;
    const ex = 6 + this.facing * 2;
    g.clear();
    // eyes
    const eyeH = Math.max(1, 6 * (1 - this.blink));
    g.fillStyle(COLORS.ink, 1);
    if (this.mood === 3) {
      // angry brows
      g.lineStyle(2.5, COLORS.ink, 1);
      g.beginPath().moveTo(-ex - 5 + this.facing * 2, ey - 8).lineTo(-ex + 3 + this.facing * 2, ey - 5).strokePath();
      g.beginPath().moveTo(ex + 5 + this.facing * 2, ey - 8).lineTo(ex - 3 + this.facing * 2, ey - 5).strokePath();
    } else if (this.mood === 2) {
      g.lineStyle(2, COLORS.ink, 1);
      g.beginPath().moveTo(-ex - 4 + this.facing * 2, ey - 6).lineTo(-ex + 3 + this.facing * 2, ey - 8).strokePath();
      g.beginPath().moveTo(ex + 4 + this.facing * 2, ey - 6).lineTo(ex - 3 + this.facing * 2, ey - 8).strokePath();
    }
    g.fillEllipse(-ex + this.facing * 2, ey, 5, eyeH);
    g.fillEllipse(ex + this.facing * 2, ey, 5, eyeH);
    // cheeks
    if (this.mood <= 1) {
      g.fillStyle(0xff6b8b, 0.35).fillCircle(-ex - 3 + this.facing * 2, ey + 7, 3.5).fillCircle(ex + 3 + this.facing * 2, ey + 7, 3.5);
    }
    // mouth
    const mx = this.facing * 2;
    const my = ey + 9;
    g.lineStyle(2.2, COLORS.ink, 1);
    if (this.mood === 0) {
      g.beginPath().arc(mx, my - 3, 5, 0.15 * Math.PI, 0.85 * Math.PI).strokePath();
    } else if (this.mood === 1) {
      g.beginPath().moveTo(mx - 4, my).lineTo(mx + 4, my).strokePath();
    } else if (this.mood === 2) {
      g.beginPath().arc(mx, my + 4, 5, 1.2 * Math.PI, 1.8 * Math.PI).strokePath();
    } else {
      g.fillStyle(COLORS.ink, 1).fillEllipse(mx, my + 1, 7, 6);
    }
  }

  private moodFor(frac: number): Mood {
    if (frac > 0.6) return 0;
    if (frac > 0.35) return 1;
    if (frac > 0.15) return 2;
    return 3;
  }

  /** Celebrate on delivery. */
  cheer(): void {
    this.mood = 0;
    this.drawFace();
    this.badge.setVisible(false);
    this.scene.tweens.add({ targets: this.inner, y: -26, duration: 160, yoyo: true, ease: 'Quad.Out' });
  }

  /** Storm off with a puff of steam. */
  fume(): void {
    this.mood = 3;
    this.drawBody(lerpColor(this.baseColor, COLORS.angry, 0.55));
    this.drawFace();
    this.badge.setVisible(false);
    for (let i = 0; i < 6; i++) {
      const puff = this.scene.add.circle(this.x + (Math.random() - 0.5) * 20, this.y - this.bh - 6, 5 + Math.random() * 5, 0xffffff, 0.8);
      puff.setDepth(30);
      this.scene.tweens.add({
        targets: puff,
        x: puff.x + (Math.random() - 0.5) * 50,
        y: puff.y - 30 - Math.random() * 30,
        scale: 1.8,
        alpha: 0,
        duration: 600 + Math.random() * 300,
        onComplete: () => puff.destroy(),
      });
    }
  }

  /**
   * Called every frame. (tx, ty) is where the sim says this passenger belongs.
   * `snapY` keeps riders glued to the moving cab once they're inside it.
   * `hurry` means the cab has left while they were still boarding: they leap in.
   */
  step(dt: number, tx: number, ty: number, snapY: boolean, scale: number, hurry = false): void {
    this.t += dt;
    const p = this.p;

    // Mood follows patience while they're still in play.
    if (!this.leaving) {
      const mood = this.moodFor(p.patience / p.maxPatience);
      if (mood !== this.mood) {
        this.mood = mood;
        this.drawBody(mood === 3 ? lerpColor(this.baseColor, COLORS.angry, 0.35) : this.baseColor);
        this.drawFace();
      }
    }

    // Blink every few seconds.
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      this.blink = 1;
      this.blinkTimer = 2 + Math.random() * 3.5;
    }
    if (this.blink > 0) {
      this.blink = Math.max(0, this.blink - dt * 8);
      this.drawFace();
    }

    // Walk toward the target slot.
    const dx = tx - this.x;
    const moving = Math.abs(dx) > 1;
    if (moving) {
      const speed = hurry ? WALK_SPEED * 5 : WALK_SPEED;
      const stepX = Math.sign(dx) * Math.min(Math.abs(dx), speed * dt);
      this.x += stepX;
      const face = Math.sign(dx);
      if (face !== this.facing) {
        this.facing = face;
        this.drawFace();
      }
      this.phase += dt * 16;
    } else {
      this.x = tx;
      this.phase = 0;
    }
    // Only glue to the cab once actually inside; until then swoop toward it.
    if (snapY && !moving) this.y = ty;
    else this.y += (ty - this.y) * Math.min(1, dt * (hurry ? 30 : 14));

    this.setScale(this.scale + (scale - this.scale) * Math.min(1, dt * 10));

    // Hop while walking, gentle breathing while idle, trembling when furious.
    // A late boarder's leap is higher the further out they are, landing as they arrive.
    const hop = !moving ? 0 : hurry ? -Math.min(Math.abs(dx), 70) * 0.4 : -Math.abs(Math.sin(this.phase)) * 6;
    const breathe = 1 + Math.sin(this.t * 3.2 + p.look * 10) * 0.025;
    const shake = this.mood === 3 && !this.leaving ? (Math.random() - 0.5) * 2.4 : 0;
    if (!this.scene.tweens.isTweening(this.inner)) {
      this.inner.y = hop;
      this.inner.x = shake;
      this.inner.scaleY = breathe;
      this.inner.scaleX = 2 - breathe;
    }

    this.drawRing();
  }

  private drawRing(): void {
    const g = this.ring;
    g.clear();
    if (this.leaving) return;
    const frac = this.p.patience / this.p.maxPatience;
    const color = frac > 0.5 ? COLORS.happy : frac > 0.25 ? COLORS.worried : COLORS.angry;
    g.lineStyle(3.5, 0x000000, 0.12).strokeCircle(0, 0, 18);
    g.lineStyle(3.5, color, 1);
    g.beginPath().arc(0, 0, 18, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac, false).strokePath();
  }
}

/** Hats and the like, drawn on top of a body w wide and h tall (feet at y=0). */
export function drawAccessory(g: Phaser.GameObjects.Graphics, name: string, w: number, h: number, color: number): void {
  const ink = COLORS.ink;
  switch (name) {
    case 'hat':
      g.fillStyle(ink, 1).fillRoundedRect(-w * 0.32, -h - 6, w * 0.64, 8, 3);
      g.fillRect(-w * 0.45, -h + 1, w * 0.9, 3);
      break;
    case 'bow':
      g.fillStyle(0xef476f, 1).fillTriangle(0, -h + 3, -9, -h - 4, -9, -h + 9).fillTriangle(0, -h + 3, 9, -h - 4, 9, -h + 9);
      g.fillCircle(0, -h + 3, 3);
      break;
    case 'tuft':
      g.lineStyle(3, lerpColor(color, 0x000000, 0.3), 1);
      g.beginPath().moveTo(0, -h + 2).lineTo(-2, -h - 7).strokePath();
      g.beginPath().moveTo(3, -h + 2).lineTo(6, -h - 5).strokePath();
      break;
    case 'party':
      g.fillStyle(0x5aa9e6, 1).fillTriangle(-9, -h + 3, 9, -h + 3, 2, -h - 20);
      g.fillStyle(0xfde047, 1).fillTriangle(-5, -h - 4, 6, -h - 4, 3, -h - 11);
      g.fillStyle(0xef476f, 1).fillCircle(2, -h - 21, 4);
      break;
    case 'flower':
      g.fillStyle(0xffffff, 1);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        g.fillCircle(w * 0.3 + Math.cos(a) * 5, -h + 6 + Math.sin(a) * 5, 4);
      }
      g.fillStyle(0xf6c445, 1).fillCircle(w * 0.3, -h + 6, 3.5);
      break;
    case 'headphones':
      g.lineStyle(4, ink, 1).beginPath().arc(0, -h * 0.62, w * 0.55, Math.PI * 1.08, Math.PI * 1.92).strokePath();
      g.fillStyle(0xef476f, 1).fillRoundedRect(-w / 2 - 4, -h * 0.72, 9, 15, 4).fillRoundedRect(w / 2 - 5, -h * 0.72, 9, 15, 4);
      break;
    case 'tophat':
      g.fillStyle(ink, 1).fillRect(-w * 0.28, -h - 20, w * 0.56, 22).fillRoundedRect(-w * 0.45, -h + 0, w * 0.9, 4, 2);
      g.fillStyle(0xef476f, 1).fillRect(-w * 0.28, -h - 4, w * 0.56, 4);
      break;
    case 'crown':
      g.fillStyle(0xffc94a, 1).fillRect(-11, -h - 4, 22, 7);
      g.fillTriangle(-11, -h - 3, -6, -h - 3, -11, -h - 13).fillTriangle(-3, -h - 3, 3, -h - 3, 0, -h - 15).fillTriangle(6, -h - 3, 11, -h - 3, 11, -h - 13);
      g.fillStyle(0xef476f, 1).fillCircle(0, -h, 2);
      break;
    case 'monocle':
      g.lineStyle(2, 0xb08d2e, 1).strokeCircle(-8, -h * 0.62, 6);
      g.beginPath().moveTo(-8, -h * 0.62 + 6).lineTo(-4, -h * 0.3).strokePath();
      break;
  }
}
