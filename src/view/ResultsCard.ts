import Phaser from 'phaser';
import type { RunStats } from '../sim/World';
import { DPR, FONT, H, W } from './Layout';
import { COLORS, hex } from './Palette';
import { sfx } from './Sfx';
import { coinIcon, label, pillButton, pin } from './ui';

const CREAM = 0xfff6ea;
const CORAL = 0xec6a50;
const CORAL_DARK = 0xb84a35;
const NAVY = 0x3d4166;
const NAVY_DARK = 0x262840;

export interface ResultsOpts {
  stats: RunStats;
  /** which stats beat the saved personal best */
  beat: { coins: boolean; delivered: boolean; bestDelivery: boolean; time: boolean };
  wallet: number;
  onAgain: () => void;
  onMenu: () => void;
}

export function formatTime(seconds: number): string {
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * End-of-run results: a cream card slides up, the four stats count in one by
 * one (with a "NEW BEST" ribbon where earned), then Play Again / Main Menu.
 */
export function showResults(scene: Phaser.Scene, o: ResultsOpts): Phaser.GameObjects.Container {
  const root = scene.add.container(0, 0).setDepth(100);
  const dim = scene.add.rectangle(0, 0, W, H, COLORS.night, 0).setOrigin(0).setInteractive(); // swallows taps
  root.add(dim);
  scene.tweens.add({ targets: dim, fillAlpha: 0.72, duration: 350 });

  const cardW = W - 48;
  const cardH = Math.min(H - 60, 600);
  const top = (H - cardH) / 2;
  const card = scene.add.container(0, 0);
  root.add(card);

  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.3).fillRoundedRect(24, top + 9, cardW, cardH, 32);
  g.fillStyle(CREAM, 1).fillRoundedRect(24, top, cardW, cardH, 32);
  g.lineStyle(2, 0xf0dcc2, 1).strokeRoundedRect(25, top + 1, cardW - 2, cardH - 2, 31);
  card.add(g);

  const titleStyle = (fill: number, stroke: number) => ({
    fontFamily: FONT,
    fontSize: '46px',
    fontStyle: '900',
    color: hex(fill),
    stroke: hex(stroke),
    strokeThickness: 12,
  });
  card.add(scene.add.text(W / 2, top + 50, 'Shift over!', titleStyle(0x9c3f2e, 0x9c3f2e)).setOrigin(0.5).setResolution(DPR));
  card.add(scene.add.text(W / 2, top + 44, 'Shift over!', titleStyle(CORAL, 0xffffff)).setOrigin(0.5).setResolution(DPR));
  card.add(label(scene, W / 2, top + 84, 'Out of hearts. Time to clock off!', 17, 0x6b6e8a).setOrigin(0.5, 0));

  // 2 x 2 stat tiles.
  const gap = 14;
  const tileW = (cardW - 32 - gap) / 2;
  const tileH = Math.min(122, (cardH - 330) / 2);
  const gridTop = top + 122;
  const tiles: { value: number; fmt: (n: number) => string; beat: boolean; text: Phaser.GameObjects.Text; ribbon: Phaser.GameObjects.Container }[] = [];
  const specs: { label: string; value: number; fmt: (n: number) => string; beat: boolean; icon: (x: number, y: number) => Phaser.GameObjects.GameObject }[] = [
    { label: 'Passengers delivered', value: o.stats.delivered, fmt: (n) => String(Math.round(n)), beat: o.beat.delivered, icon: (x, y) => personIcon(scene, x, y) },
    { label: 'Coins earned', value: o.stats.score, fmt: (n) => Math.round(n).toLocaleString(), beat: o.beat.coins, icon: (x, y) => coinIcon(scene, x, y, 13) },
    { label: 'Best delivery', value: o.stats.bestDelivery, fmt: (n) => `+${Math.round(n)}`, beat: o.beat.bestDelivery, icon: (x, y) => starIcon(scene, x, y) },
    { label: 'Shift time', value: o.stats.time, fmt: formatTime, beat: o.beat.time, icon: (x, y) => clockIcon(scene, x, y) },
  ];
  specs.forEach((s, i) => {
    const x = 40 + (i % 2) * (tileW + gap);
    const y = gridTop + Math.floor(i / 2) * (tileH + gap);
    const tg = scene.add.graphics();
    tg.fillStyle(0xe8d5bb, 1).fillRoundedRect(x, y + 4, tileW, tileH, 20);
    tg.fillStyle(0xffffff, 1).fillRoundedRect(x, y, tileW, tileH, 20);
    card.add(tg);
    card.add(s.icon(x + 26, y + 26));
    const text = label(scene, x + tileW / 2, y + tileH * 0.52, s.fmt(0), 34, COLORS.ink, true).setOrigin(0.5);
    card.add(text);
    card.add(label(scene, x + tileW / 2, y + tileH - 14, s.label, 14, 0x8a8ca8, true).setOrigin(0.5, 1));
    const ribbon = scene.add.container(x + tileW - 10, y + 6).setVisible(false);
    const rb = scene.add.graphics();
    rb.fillStyle(CORAL, 1).fillRoundedRect(-78, -2, 80, 24, 12);
    ribbon.add([rb, label(scene, -38, 10, 'NEW BEST', 12, 0xffffff, true).setOrigin(0.5)]);
    card.add(ribbon);
    tiles.push({ value: s.value, fmt: s.fmt, beat: s.beat, text, ribbon });
  });

  const afterGrid = gridTop + 2 * tileH + gap;
  const wallet = label(scene, W / 2 + 12, afterGrid + 26, `+${o.stats.score.toLocaleString()} banked  ·  wallet ${o.wallet.toLocaleString()}`, 16, 0x6b6e8a, true).setOrigin(0.5);
  card.add([coinIcon(scene, wallet.x - wallet.width / 2 - 16, wallet.y, 9), wallet]);

  // Buttons: Play Again is the big one.
  const again = pillButton(scene, W / 2, top + cardH - 112, cardW - 60, 66, CORAL, CORAL_DARK, o.onAgain);
  again.add(label(scene, 0, 0, 'Play Again', 30, 0xffffff, true).setOrigin(0.5));
  const menu = pillButton(scene, W / 2, top + cardH - 40, 220, 50, NAVY, NAVY_DARK, o.onMenu);
  menu.add(label(scene, 0, 0, 'Main Menu', 21, 0xffffff, true).setOrigin(0.5));
  card.add([again, menu]);
  // Brief lockout so a frantic tap doesn't skip the results.
  for (const b of [again, menu]) b.disableInteractive();

  pin(root);
  card.y = H;
  scene.tweens.add({ targets: card, y: 0, duration: 520, ease: 'Back.Out' });

  // Count each stat in, one after another.
  tiles.forEach((t, i) => {
    const n = { v: 0 };
    scene.tweens.add({
      targets: n,
      v: t.value,
      delay: 600 + i * 380,
      duration: 420,
      ease: 'Quad.Out',
      onUpdate: () => t.text.setText(t.fmt(n.v)),
      onComplete: () => {
        t.text.setText(t.fmt(t.value));
        sfx.stat(t.beat);
        scene.tweens.add({ targets: t.text, scale: 1.15, duration: 110, yoyo: true });
        if (t.beat) {
          t.ribbon.setVisible(true).setScale(0.3);
          scene.tweens.add({ targets: t.ribbon, scale: 1, duration: 300, ease: 'Back.Out' });
        }
      },
    });
  });
  scene.time.delayedCall(700, () => {
    for (const b of [again, menu]) b.setInteractive({ useHandCursor: true });
  });
  scene.tweens.add({ targets: again, scale: 1.03, duration: 700, delay: 2200, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  return root;
}

function personIcon(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics({ x, y });
  g.fillStyle(0x5cc97b, 1).fillCircle(0, 0, 15);
  g.fillStyle(0xffffff, 1).fillRoundedRect(-6, -8, 12, 16, 6);
  g.fillStyle(COLORS.ink, 1).fillCircle(-2.5, -3, 1.4).fillCircle(2.5, -3, 1.4);
  return g;
}

function starIcon(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics({ x, y });
  g.fillStyle(0xa78bfa, 1).fillCircle(0, 0, 15);
  const pts: Phaser.Math.Vector2[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 4 : 9;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(new Phaser.Math.Vector2(Math.cos(a) * r, Math.sin(a) * r + 0.5));
  }
  g.fillStyle(0xffffff, 1).fillPoints(pts, true);
  return g;
}

function clockIcon(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics({ x, y });
  g.fillStyle(0x5aa9e6, 1).fillCircle(0, 0, 15);
  g.fillStyle(0xffffff, 1).fillCircle(0, 0, 9);
  g.lineStyle(2.5, COLORS.ink, 1).lineBetween(0, 0, 0, -6).lineBetween(0, 0, 4, 2);
  return g;
}
