import type Phaser from 'phaser';

// Tiny Tower-style floor themes, each drawn from plain shapes. Props stay clear of
// the top-left corner (floor plaque + name) and mostly sit behind the queue.

export interface RoomBox {
  /** left edge of the visible room (right of the shaft) */
  l: number;
  r: number;
  /** ceiling and floor y */
  t: number;
  b: number;
}

export interface RoomTheme {
  id: string;
  name: string;
  /** dark walls need a light floor label */
  dark?: boolean;
  wall: number;
  draw(g: Phaser.GameObjects.Graphics, box: RoomBox): void;
}

function wallClock(g: Phaser.GameObjects.Graphics, x: number, y: number, face = 0xffffff): void {
  g.fillStyle(0x000000, 0.12).fillCircle(x, y + 2, 15);
  g.fillStyle(face, 1).fillCircle(x, y, 14);
  g.lineStyle(2, 0x2b2d42, 1).strokeCircle(x, y, 14);
  g.beginPath().moveTo(x, y).lineTo(x, y - 9).moveTo(x, y).lineTo(x + 6, y + 2).strokePath();
}

function frame(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, art: number): void {
  g.fillStyle(0x8d6e63, 1).fillRoundedRect(x - 3, y - 3, w + 6, h + 6, 3);
  g.fillStyle(art, 1).fillRect(x, y, w, h);
  g.fillStyle(0xffffff, 0.5).fillCircle(x + w * 0.7, y + h * 0.35, Math.min(w, h) * 0.15);
  g.fillStyle(0x000000, 0.15).fillTriangle(x, y + h, x + w * 0.45, y + h * 0.4, x + w * 0.9, y + h);
}

function pot(g: Phaser.GameObjects.Graphics, x: number, b: number, size: number, leaf = 0x5cc97b, potC = 0xc96f4a): void {
  g.fillStyle(leaf, 1)
    .fillEllipse(x - size * 0.35, b - size * 1.5, size * 0.7, size * 1.3)
    .fillEllipse(x + size * 0.35, b - size * 1.35, size * 0.7, size * 1.1)
    .fillEllipse(x, b - size * 1.8, size * 0.6, size * 1.2);
  g.fillStyle(potC, 1).fillRoundedRect(x - size * 0.5, b - size * 0.9, size, size * 0.9, 4);
}

function pendant(g: Phaser.GameObjects.Graphics, x: number, t: number, len: number, color: number): void {
  g.lineStyle(2, 0x2b2d42, 0.8).beginPath().moveTo(x, t).lineTo(x, t + len).strokePath();
  g.fillStyle(color, 1).slice(x, t + len + 10, 12, Math.PI, 0, false).fillPath();
  g.fillStyle(0xfff3b0, 0.35).fillTriangle(x - 10, t + len + 10, x + 10, t + len + 10, x, t + len + 40);
}

export const LOBBY: RoomTheme = {
  id: 'lobby',
  name: 'Lobby',
  wall: 0xf6efe4,
  draw(g, { r, t, b }) {
    g.fillStyle(0xe9dcc7, 1).fillRect(160, b - 56, r - 160, 56);
    g.lineStyle(2, 0xd8c7ab, 1).beginPath().moveTo(160, b - 56).lineTo(r, b - 56).strokePath();
    wallClock(g, r - 150, t + 44);
    // reception desk
    g.fillStyle(0xb5774a, 1).fillRoundedRect(r - 118, b - 54, 82, 54, 4);
    g.fillStyle(0xd9a06e, 1).fillRoundedRect(r - 124, b - 60, 94, 10, 3);
    g.fillStyle(0xffc94a, 1).fillCircle(r - 52, b - 64, 5);
    pot(g, r - 14, b, 22);
  },
};

export const ROOMS: RoomTheme[] = [
  {
    id: 'apartment',
    name: 'Apartment',
    wall: 0xfde2e4,
    draw(g, { l, r, t, b }) {
      g.fillStyle(0xf9c6cc, 1);
      for (let y = t + 14; y < b - 8; y += 22) for (let x = l + 12 + ((y / 22) % 2) * 11; x < r; x += 22) g.fillCircle(x, y, 2.5);
      // window + curtains
      g.fillStyle(0xd6ecfa, 1).fillRect(r - 96, t + 20, 64, 58);
      g.fillStyle(0xef8fa0, 1).fillRect(r - 104, t + 14, 16, 72).fillRect(r - 40, t + 14, 16, 72);
      frame(g, l + 92, t + 26, 44, 34, 0x9bd5c0);
      // sofa
      const sx = l + 120;
      g.fillStyle(0x5a87c2, 1).fillRoundedRect(sx, b - 58, 130, 34, 10);
      g.fillStyle(0x7aa6d8, 1).fillRoundedRect(sx + 6, b - 34, 118, 26, 6);
      g.fillStyle(0x5a87c2, 1).fillRoundedRect(sx - 8, b - 44, 18, 40, 6).fillRoundedRect(sx + 120, b - 44, 18, 40, 6);
      // lamp
      g.lineStyle(3, 0x2b2d42, 1).beginPath().moveTo(r - 24, b).lineTo(r - 24, b - 76).strokePath();
      g.fillStyle(0xffd166, 1).fillTriangle(r - 40, b - 74, r - 8, b - 74, r - 24, b - 100);
    },
  },
  {
    id: 'office',
    name: 'Office',
    wall: 0xe4edf5,
    draw(g, { l, r, t, b }) {
      g.fillStyle(0xd3dee9, 1).fillRect(l, b - 40, r - l, 40);
      // blinds
      g.fillStyle(0xd6ecfa, 1).fillRect(r - 100, t + 18, 70, 60);
      g.lineStyle(2, 0xb0c4d6, 1);
      for (let y = t + 22; y < t + 78; y += 7) g.beginPath().moveTo(r - 100, y).lineTo(r - 30, y).strokePath();
      wallClock(g, l + 110, t + 40);
      // filing cabinet
      g.fillStyle(0x9aa5b1, 1).fillRoundedRect(l + 60, b - 74, 40, 74, 3);
      g.lineStyle(2, 0x7b8794, 1).strokeRect(l + 64, b - 70, 32, 20).strokeRect(l + 64, b - 46, 32, 20);
      // desk + monitor
      const dx = r - 150;
      g.fillStyle(0x8d6e63, 1).fillRect(dx, b - 48, 110, 8).fillRect(dx + 6, b - 40, 6, 40).fillRect(dx + 98, b - 40, 6, 40);
      g.fillStyle(0x2b2d42, 1).fillRoundedRect(dx + 30, b - 86, 50, 34, 3).fillRect(dx + 52, b - 54, 6, 6);
      g.fillStyle(0x5aa9e6, 1).fillRect(dx + 34, b - 82, 42, 26);
      g.fillStyle(0xffffff, 1).fillRect(dx + 88, b - 58, 10, 10); // mug
    },
  },
  {
    id: 'coffee',
    name: 'Coffee Shop',
    wall: 0xc98263,
    draw(g, { l, r, t, b }) {
      g.lineStyle(1.5, 0xb06a4d, 1);
      for (let y = t + 12, row = 0; y < b; y += 14, row++) {
        g.beginPath().moveTo(l, y).lineTo(r, y).strokePath();
        for (let x = l + (row % 2) * 16; x < r; x += 32) g.beginPath().moveTo(x, y).lineTo(x, y + 14).strokePath();
      }
      // chalkboard menu
      g.fillStyle(0x6d4c41, 1).fillRect(l + 86, t + 22, 84, 56);
      g.fillStyle(0x2f4f3a, 1).fillRect(l + 90, t + 26, 76, 48);
      g.lineStyle(2, 0xffffff, 0.75);
      for (let i = 0; i < 3; i++) g.beginPath().moveTo(l + 98, t + 38 + i * 12).lineTo(l + 138 - i * 6, t + 38 + i * 12).strokePath();
      pendant(g, r - 130, t, 18, 0x2b2d42);
      pendant(g, r - 60, t, 26, 0x2b2d42);
      // counter + machine
      g.fillStyle(0x5d4037, 1).fillRect(r - 150, b - 50, 140, 50);
      g.fillStyle(0x8d6e63, 1).fillRect(r - 156, b - 56, 152, 8);
      g.fillStyle(0xcfd8dc, 1).fillRoundedRect(r - 66, b - 92, 40, 36, 4);
      g.fillStyle(0xef476f, 1).fillCircle(r - 46, b - 82, 3);
      g.fillStyle(0xffffff, 1).fillRect(r - 120, b - 66, 12, 10).fillRect(r - 102, b - 66, 12, 10);
    },
  },
  {
    id: 'gym',
    name: 'Gym',
    wall: 0xdff5ea,
    draw(g, { l, r, t, b }) {
      g.fillStyle(0x4fbf9f, 1).fillRect(l, t + 52, r - l, 10);
      // mirror
      g.fillStyle(0xbfe3f5, 1).fillRect(l + 90, t + 16, 120, 30);
      g.fillStyle(0xffffff, 0.6).fillTriangle(l + 100, t + 46, l + 120, t + 16, l + 132, t + 16);
      // treadmill
      g.fillStyle(0x2b2d42, 1).fillRoundedRect(l + 110, b - 16, 100, 14, 6);
      g.lineStyle(4, 0x2b2d42, 1).beginPath().moveTo(l + 200, b - 14).lineTo(l + 214, b - 66).lineTo(l + 196, b - 66).strokePath();
      // dumbbell rack
      const rx = r - 86;
      g.fillStyle(0x7b8794, 1).fillRect(rx, b - 46, 70, 6).fillRect(rx + 4, b - 40, 5, 40).fillRect(rx + 61, b - 40, 5, 40);
      for (let i = 0; i < 3; i++) {
        const x = rx + 14 + i * 21;
        g.fillStyle(0x2b2d42, 1).fillRect(x - 6, b - 54, 12, 3);
        g.fillStyle(i === 1 ? 0xef476f : 0x5aa9e6, 1).fillCircle(x - 7, b - 53, 5).fillCircle(x + 7, b - 53, 5);
      }
    },
  },
  {
    id: 'laundry',
    name: 'Laundry Room',
    wall: 0xe3f2fd,
    draw(g, { l, r, t, b }) {
      g.lineStyle(1.5, 0xc5e1f5, 1);
      for (let y = t + 18; y < b; y += 18) g.beginPath().moveTo(l, y).lineTo(r, y).strokePath();
      for (let x = l + 18; x < r; x += 18) g.beginPath().moveTo(x, t).lineTo(x, b).strokePath();
      // shelf with bottles
      g.fillStyle(0xb0bec5, 1).fillRect(l + 90, t + 56, 110, 5);
      [0xef476f, 0x5aa9e6, 0xf6c445, 0x4fbf9f].forEach((c, i) => g.fillStyle(c, 1).fillRoundedRect(l + 98 + i * 26, t + 34, 16, 22, 4));
      // machines
      for (let i = 0; i < 3; i++) {
        const x = l + 96 + i * 66;
        g.fillStyle(0xffffff, 1).fillRoundedRect(x, b - 66, 56, 66, 6);
        g.fillStyle(0xcfd8dc, 1).fillRect(x, b - 66, 56, 12);
        g.fillStyle(0x90a4ae, 1).fillCircle(x + 28, b - 28, 18);
        g.fillStyle(i === 1 ? 0xa0d8ef : 0xc8ecfa, 1).fillCircle(x + 28, b - 28, 13);
        g.fillStyle(0xef476f, 1).fillCircle(x + 46, b - 60, 3);
      }
    },
  },
  {
    id: 'plants',
    name: 'Plant Shop',
    wall: 0xeef6e0,
    draw(g, { l, r, t, b }) {
      // shelves of little pots
      for (let s = 0; s < 2; s++) {
        const y = t + 44 + s * 40;
        g.fillStyle(0xa1887f, 1).fillRect(l + 96, y, 150, 5);
        for (let i = 0; i < 5; i++) pot(g, l + 110 + i * 30, y, 12, i % 2 ? 0x8bc34a : 0x4caf50, [0xc96f4a, 0xf6c445, 0x5aa9e6][(i + s) % 3]);
      }
      // hanging plant
      g.lineStyle(2, 0x6d4c41, 1).beginPath().moveTo(r - 40, t).lineTo(r - 40, t + 30).strokePath();
      g.fillStyle(0xc96f4a, 1).fillRoundedRect(r - 52, t + 30, 24, 16, 4);
      g.fillStyle(0x4caf50, 1).fillEllipse(r - 56, t + 56, 8, 28).fillEllipse(r - 26, t + 58, 8, 32).fillEllipse(r - 40, t + 62, 8, 30);
      pot(g, r - 24, b, 30, 0x2e9d5b);
      pot(g, l + 64, b, 24, 0x7cb342);
    },
  },
  {
    id: 'restaurant',
    name: 'Restaurant',
    wall: 0xf3d9b1,
    draw(g, { l, r, t, b }) {
      g.fillStyle(0x8c3b4a, 1).fillRect(l, b - 48, r - l, 48);
      g.fillStyle(0xd4a373, 1).fillRect(l, b - 52, r - l, 5);
      frame(g, l + 92, t + 24, 48, 36, 0xf4a261);
      frame(g, r - 90, t + 20, 40, 48, 0x7aa6d8);
      pendant(g, l + 210, t, 14, 0xb5651d);
      // tables with cloths and candles
      for (const x of [l + 150, r - 70]) {
        g.fillStyle(0xffffff, 1).fillRoundedRect(x - 34, b - 46, 68, 14, 3);
        g.fillTriangle(x - 34, b - 34, x - 24, b - 34, x - 34, b - 20).fillTriangle(x + 34, b - 34, x + 24, b - 34, x + 34, b - 20);
        g.fillStyle(0x6d4c41, 1).fillRect(x - 3, b - 32, 6, 32);
        g.fillStyle(0xfff3b0, 1).fillRect(x - 2, b - 58, 4, 12);
        g.fillStyle(0xf6a623, 1).fillEllipse(x, b - 62, 5, 8);
      }
    },
  },
  {
    id: 'arcade',
    name: 'Arcade',
    wall: 0x2f2350,
    dark: true,
    draw(g, { l, r, t, b }) {
      g.lineStyle(3, 0xff4fd8, 0.9).beginPath().moveTo(l, t + 18).lineTo(r, t + 18).strokePath();
      g.lineStyle(3, 0x22d3ee, 0.9).beginPath().moveTo(l, t + 26).lineTo(r, t + 26).strokePath();
      const screens = [0x22d3ee, 0xfde047, 0x84cc16];
      for (let i = 0; i < 3; i++) {
        const x = l + 96 + i * 72;
        g.fillStyle(0x5b3ea8, 1).fillRoundedRect(x, b - 104, 52, 104, 6);
        g.fillStyle(0xff4fd8, 1).fillRect(x + 4, b - 100, 44, 12);
        g.fillStyle(0x0b0820, 1).fillRect(x + 6, b - 82, 40, 32);
        g.fillStyle(screens[i], 0.85).fillRect(x + 9, b - 79, 34, 26);
        g.fillStyle(0x0b0820, 0.7).fillRect(x + 14, b - 70, 8, 8).fillRect(x + 28, b - 64, 8, 8);
        g.fillStyle(0x3a2a7a, 1).fillRect(x + 2, b - 46, 48, 10);
        g.fillStyle(0xef476f, 1).fillCircle(x + 14, b - 46, 4);
        g.fillStyle(0xfde047, 1).fillCircle(x + 34, b - 44, 3).fillCircle(x + 42, b - 44, 3);
      }
    },
  },
  {
    id: 'cinema',
    name: 'Cinema Room',
    wall: 0x1f1b2e,
    dark: true,
    draw(g, { l, r, t, b }) {
      // curtains + screen
      g.fillStyle(0xb83b5e, 1).fillRect(l + 84, t + 12, 18, 78).fillRect(r - 30, t + 12, 18, 78);
      g.fillStyle(0xfdf6e3, 1).fillRect(l + 102, t + 16, r - l - 132, 66);
      g.fillStyle(0xffd166, 1).fillCircle(r - 80, t + 36, 9);
      g.fillStyle(0x7ec8a9, 1).fillEllipse(l + 170, t + 84, 180, 40);
      g.fillStyle(0x5aa9e6, 1).fillEllipse(r - 90, t + 86, 140, 34);
      g.fillStyle(0xfdf6e3, 1).fillRect(l + 102, t + 82, r - l - 132, 10);
      g.fillStyle(0x1f1b2e, 1).fillRect(l + 84, t + 90, r - l - 96, 8);
      // seats
      for (let i = 0; i < 5; i++) {
        const x = l + 96 + i * 40;
        g.fillStyle(0x8c2a46, 1).fillRoundedRect(x, b - 40, 34, 26, 6);
        g.fillStyle(0xb83b5e, 1).fillRoundedRect(x + 2, b - 18, 30, 14, 4);
      }
    },
  },
  {
    id: 'gamedev',
    name: 'Game Dev Studio',
    wall: 0xece7f6,
    draw(g, { l, r, t, b }) {
      // whiteboard full of plans
      g.fillStyle(0xb0bec5, 1).fillRect(l + 88, t + 18, 100, 60);
      g.fillStyle(0xffffff, 1).fillRect(l + 92, t + 22, 92, 52);
      g.lineStyle(2, 0x5aa9e6, 1).strokeRect(l + 100, t + 30, 22, 14).strokeRect(l + 140, t + 48, 22, 14);
      g.beginPath().moveTo(l + 122, t + 37).lineTo(l + 140, t + 55).strokePath();
      g.lineStyle(2, 0xef476f, 1).strokeCircle(l + 168, t + 34, 7);
      // sticky notes
      [0xfde047, 0xff8fab, 0x9bf6ff].forEach((c, i) => g.fillStyle(c, 1).fillRect(r - 70 + i * 16, t + 24 + (i % 2) * 10, 14, 14));
      // desk with two monitors: code + the game itself
      const dx = r - 176;
      g.fillStyle(0x6d4c41, 1).fillRect(dx, b - 48, 160, 8).fillRect(dx + 6, b - 40, 6, 40).fillRect(dx + 148, b - 40, 6, 40);
      g.fillStyle(0x2b2d42, 1).fillRoundedRect(dx + 16, b - 92, 60, 40, 3).fillRoundedRect(dx + 86, b - 92, 60, 40, 3);
      g.fillStyle(0x1e1e2e, 1).fillRect(dx + 20, b - 88, 52, 32);
      [0xff79c6, 0x8be9fd, 0x50fa7b, 0xf1fa8c].forEach((c, i) => g.fillStyle(c, 1).fillRect(dx + 24 + (i % 2) * 6, b - 84 + i * 7, 18 + ((i * 13) % 20), 3));
      g.fillStyle(0xfff6ea, 1).fillRect(dx + 90, b - 88, 52, 32);
      g.fillStyle(0x46496a, 1).fillRect(dx + 94, b - 88, 12, 32);
      g.fillStyle(0xe07a5f, 1).fillRect(dx + 95, b - 70, 10, 9);
      g.fillStyle(0xffb4a2, 1).fillCircle(dx + 120, b - 62, 3).fillCircle(dx + 130, b - 62, 3);
      // beanbag
      g.fillStyle(0xa78bfa, 1).fillEllipse(l + 76, b - 16, 46, 30);
    },
  },
];

export const FREE_ROOMS = ['apartment', 'office', 'coffee', 'gym'];

export function roomById(id: string): RoomTheme | undefined {
  return ROOMS.find((r) => r.id === id);
}
