export const COLORS = {
  night: 0x2b2d42,
  nightLight: 0x3a3d58,
  wallA: 0xfff6ea,
  wallB: 0xfcecd8,
  slab: 0x9c8573,
  slabTop: 0xc7b29d,
  shaft: 0x46496a,
  shaftDark: 0x34364f,
  cabFrame: 0xe07a5f,
  cabInner: 0xfff1e0,
  glass: 0xdff3ff,
  ink: 0x2b2d42,
  white: 0xffffff,
  coin: 0xffc94a,
  coinDark: 0xe09f1f,
  heart: 0xef476f,
  heartEmpty: 0x55587a,
  happy: 0x5cc97b,
  worried: 0xf6c445,
  angry: 0xef476f,
};

/** One colour per floor; destination badges and floor plaques share it. */
export const FLOOR_COLORS = [0xff8c69, 0xf2b630, 0x4fbf9f, 0x5aa9e6, 0xa78bfa, 0xf472b6, 0x22d3ee, 0x84cc16];

export interface CabSkin {
  frame: number;
  inner: number;
  trim: number;
}

/** Ids match STYLE_ITEMS in meta/catalog.ts (plus the free classic). */
export const CAB_SKINS: Record<string, CabSkin> = {
  'skin-classic': { frame: 0xe07a5f, inner: 0xfff1e0, trim: 0xffe08a },
  'skin-mint': { frame: 0x4fbf9f, inner: 0xeafff7, trim: 0xffffff },
  'skin-wood': { frame: 0x9a6b45, inner: 0xfbefe2, trim: 0xd9a06e },
  'skin-royal': { frame: 0x6d4bc4, inner: 0xf3edff, trim: 0xffc94a },
  'skin-gold': { frame: 0xe0a526, inner: 0xfff6d8, trim: 0xfff3b0 },
};

export const BODY_COLORS = [0xffb4a2, 0xb5e48c, 0xa0c4ff, 0xffd6a5, 0xcdb4db, 0x9bf6ff, 0xfdffb6, 0xffc8dd];

export function hex(c: number): string {
  return '#' + c.toString(16).padStart(6, '0');
}

export function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  const r = Math.round(ar + (br - ar) * t), g = Math.round(ag + (bg - ag) * t), bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}
