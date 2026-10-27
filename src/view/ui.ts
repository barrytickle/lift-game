import Phaser from 'phaser';
import { DPR, FONT } from './Layout';
import { COLORS, hex, lerpColor } from './Palette';
import { sfx } from './Sfx';

export interface ButtonOpts {
  color?: number;
  textColor?: number;
  fontSize?: number;
  /** pulse gently to draw the eye */
  pulse?: boolean;
  onClick: () => void;
}

/** Chunky rounded button that squishes when pressed and fires on release. */
export function button(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  opts: ButtonOpts,
): Phaser.GameObjects.Container {
  const color = opts.color ?? COLORS.cabFrame;
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  g.fillStyle(lerpColor(color, 0x000000, 0.25), 1).fillRoundedRect(-w / 2, -h / 2 + 4, w, h, 14);
  g.fillStyle(color, 1).fillRoundedRect(-w / 2, -h / 2, w, h, 14);
  g.fillStyle(0xffffff, 0.18).fillRoundedRect(-w / 2 + 6, -h / 2 + 4, w - 12, h * 0.38, 10);
  const t = scene.add
    .text(0, 0, label, {
      fontFamily: FONT,
      fontSize: `${opts.fontSize ?? 22}px`,
      fontStyle: 'bold',
      color: hex(opts.textColor ?? 0xffffff),
    })
    .setOrigin(0.5)
    .setResolution(DPR);
  c.add([g, t]);
  c.setSize(w, h).setInteractive({ useHandCursor: true });
  c.on('pointerdown', () => {
    sfx.unlock();
    c.setScale(0.93);
  });
  c.on('pointerout', () => c.setScale(1));
  c.on('pointerup', () => {
    c.setScale(1);
    sfx.tap();
    opts.onClick();
  });
  if (opts.pulse) scene.tweens.add({ targets: t, scale: 1.06, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  return c;
}

/** Plain bold/normal text with the game font at DPR resolution. */
export function label(
  scene: Phaser.Scene,
  x: number,
  y: number,
  str: string,
  size: number,
  color: number,
  bold = false,
  wrap?: number,
): Phaser.GameObjects.Text {
  return scene.add
    .text(x, y, str, {
      fontFamily: FONT,
      fontSize: `${size}px`,
      fontStyle: bold ? 'bold' : 'normal',
      color: hex(color),
      align: 'center',
      lineSpacing: 4,
      wordWrap: wrap ? { width: wrap } : undefined,
    })
    .setResolution(DPR);
}

/** Small drawn coin, for prices and wallets. */
export function coinIcon(scene: Phaser.Scene, x: number, y: number, r = 11): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics({ x, y });
  g.fillStyle(COLORS.coinDark, 1).fillCircle(0, 1.5, r);
  g.fillStyle(COLORS.coin, 1).fillCircle(0, 0, r);
  g.lineStyle(2, COLORS.coinDark, 1).strokeCircle(0, 0, r * 0.6);
  return g;
}

export const PERK_ICONS: Record<string, { glyph: string; color: number }> = {
  roomy: { glyph: '+1', color: 0xe07a5f },
  turbo: { glyph: '»', color: 0x5aa9e6 },
  muzak: { glyph: '♪', color: 0xa78bfa },
  tipjar: { glyph: '+4', color: 0xf2b630 },
  doors: { glyph: '||', color: 0x4fbf9f },
  express: { glyph: '%', color: 0x22d3ee },
  party: { glyph: '★', color: 0xf472b6 },
  plaster: { glyph: '♥', color: 0xef476f },
  comfy: { glyph: 'Zz', color: 0x8d6e63 },
  coinbag: { glyph: '50', color: 0xf2b630 },
};
