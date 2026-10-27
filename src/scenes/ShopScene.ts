import { clearAppHooks, setAppHooks, type AppHooks } from '../platform';
import Phaser from 'phaser';
import { ROOM_ITEMS, STYLE_ITEMS, UPGRADES, type ShopItem } from '../meta/catalog';
import { buy, itemLevel, loadProfile, nextCost, saveProfile, type Profile } from '../meta/profile';
import { DPR, H, HUD_H, W } from '../view/Layout';
import { ACCESSORY_SETS } from '../meta/catalog';
import { CAB_SKINS, COLORS, lerpColor } from '../view/Palette';
import { drawAccessory } from '../view/PassengerView';
import { roomById } from '../view/rooms';
import { sfx } from '../view/Sfx';
import { button, coinIcon, label } from '../view/ui';

type Tab = 'upgrades' | 'rooms' | 'style';

const TABS: { id: Tab; name: string; items: ShopItem[] }[] = [
  { id: 'upgrades', name: 'Upgrades', items: UPGRADES },
  { id: 'rooms', name: 'Rooms', items: ROOM_ITEMS },
  { id: 'style', name: 'Style', items: STYLE_ITEMS },
];

/** Spend banked coins between shifts. Rebuilds its list on every purchase. */
export class ShopScene extends Phaser.Scene {
  private profile!: Profile;
  private tab: Tab = 'upgrades';
  private list?: Phaser.GameObjects.Container;
  private tabBar?: Phaser.GameObjects.Container;
  private walletText!: Phaser.GameObjects.Text;
  private walletIcon!: Phaser.GameObjects.Graphics;
  /** scrolling list window (design-space y) and current offset */
  private listTop = 0;
  private listBottom = 0;
  private listY = 0;
  private listMin = 0;
  /** the current touch has moved far enough to be a scroll, not a tap */
  private dragged = false;

  constructor() {
    super('shop');
  }

  create(): void {
    // Android back = the shop's Back button.
    const hooks: AppHooks = { background: () => {}, back: () => this.scene.start('game') };
    setAppHooks(hooks);
    this.events.once('shutdown', () => clearAppHooks(hooks));
    this.cameras.main.setZoom(DPR).centerOn(W / 2, H / 2);
    this.cameras.main.setBackgroundColor(COLORS.night);
    this.profile = loadProfile();

    this.add.rectangle(0, HUD_H - 4, W, H, COLORS.wallA).setOrigin(0).setDepth(-2);
    this.add.rectangle(0, HUD_H - 4, W, 8, COLORS.cabFrame).setOrigin(0);
    this.listY = 0;

    // Drag (or mouse wheel) to scroll the list when it's taller than its window.
    let from: { y: number; list: number } | null = null;
    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      this.dragged = false;
      from = ptr.worldY >= this.listTop && ptr.worldY <= this.listBottom ? { y: ptr.worldY, list: this.listY } : null;
    });
    this.input.on('pointermove', (ptr: Phaser.Input.Pointer) => {
      if (!from || !ptr.isDown) return;
      const dy = ptr.worldY - from.y;
      if (Math.abs(dy) > 8) this.dragged = true;
      if (this.dragged) this.scrollList(from.list + dy);
    });
    this.input.on('pointerup', () => (from = null));
    this.input.on('wheel', (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => this.scrollList(this.listY - dy * 0.5));

    button(this, 62, 48, 92, 46, '‹ Back', { color: COLORS.shaft, fontSize: 18, onClick: () => this.scene.start('game') });
    label(this, W / 2, 48, 'Shop', 32, 0xffffff, true).setOrigin(0.5);
    this.walletIcon = coinIcon(this, W - 30, 48, 13);
    this.walletText = label(this, W - 50, 48, '', 24, 0xffffff, true).setOrigin(1, 0.5);

    button(this, W / 2, H - 46, W - 64, 62, 'Start shift', {
      pulse: true,
      onClick: () => this.scene.start('game', { skipTitle: true }),
    });

    this.refresh();
  }

  private refresh(): void {
    this.walletText.setText(this.profile.coins.toLocaleString());
    this.drawTabs();
    this.drawList();
  }

  private drawTabs(): void {
    this.tabBar?.destroy();
    const c = (this.tabBar = this.add.container(0, HUD_H + 34));
    const tw = (W - 48) / TABS.length;
    TABS.forEach((t, i) => {
      const active = t.id === this.tab;
      const x = 24 + tw * i + tw / 2;
      const b = button(this, x, 0, tw - 8, 44, t.name, {
        color: active ? COLORS.cabFrame : 0xe8dccb,
        textColor: active ? 0xffffff : COLORS.ink,
        fontSize: 18,
        onClick: () => {
          this.tab = t.id;
          this.listY = 0; // new tab starts at the top
          this.refresh();
        },
      });
      c.add(b);
    });
  }

  /**
   * Rows size themselves to their content and stack in a window between the tabs
   * and the Start button; if they don't all fit, the list scrolls by dragging.
   */
  private drawList(): void {
    this.list?.destroy();
    const items = TABS.find((t) => t.id === this.tab)!.items;
    const top = (this.listTop = HUD_H + 66);
    const bottom = (this.listBottom = H - 86);
    const gap = 10;
    // Below the header, tabs and Start button (depth 0) so those always get their taps.
    const c = (this.list = this.add.container(0, 0).setDepth(-1));
    let y = top + 6;
    for (const item of items) {
      const r = this.row(item, 24, y, W - 48);
      c.add(r.root);
      y += r.h + gap;
    }
    this.listMin = Math.min(0, bottom - (y - gap + 10));
    this.listY = Phaser.Math.Clamp(this.listY, this.listMin, 0);
    c.y = this.listY;
    const mask = this.make.graphics({}, false).fillStyle(0xffffff).fillRect(0, top, W, bottom - top);
    c.setMask(mask.createGeometryMask());
  }

  /** Taps on list buttons only count if they weren't the end of a drag and landed inside the window. */
  private listTap(fn: () => void): () => void {
    return () => {
      const py = this.input.activePointer.worldY;
      if (this.dragged || py < this.listTop || py > this.listBottom) return;
      fn();
    };
  }

  private scrollList(y: number): void {
    this.listY = Phaser.Math.Clamp(y, this.listMin, 0);
    if (this.list) this.list.y = this.listY;
  }

  private row(item: ShopItem, x: number, y: number, w: number): { root: Phaser.GameObjects.Container; h: number } {
    const p = this.profile;
    const c = this.add.container(x, y);
    const g = this.add.graphics();
    c.add(g);

    const thumb = 68;
    // Rooms keep their wide proportions; everything else is square.
    const thumbW = item.kind === 'room' ? thumb * 1.8 : thumb;
    const tx = 24 + thumbW;
    const level = itemLevel(p, item);
    const cost = nextCost(p, item);
    // Pips, name and description stack as one block with equal padding above and
    // below; the row grows to fit it (never shorter than the thumbnail needs).
    const PAD = 14;
    const pipH = item.costs.length > 1 ? 12 : 0;
    const name = label(this, tx, 0, item.name, 19, COLORS.ink, true).setOrigin(0, 0).setAlign('left');
    const desc = label(this, tx, 0, item.desc, 14, 0x6b6e8a, false, w - tx - 118).setOrigin(0, 0).setAlign('left');
    const blockH = pipH + name.height + desc.height;
    const h = Math.max(thumb + 16, Math.ceil(blockH + 2 * PAD));
    const y0 = Math.round((h - blockH) / 2);
    name.setY(y0 + pipH);
    desc.setY(name.y + name.height);
    c.add([name, desc]);

    g.fillStyle(0x000000, 0.08).fillRoundedRect(0, 4, w, h, 16);
    g.fillStyle(0xffffff, 1).fillRoundedRect(0, 0, w, h, 16);
    c.add(this.preview(item, 12 + thumbW / 2, h / 2, thumb));

    // Level pips for multi-level upgrades
    if (pipH) {
      const pg = this.add.graphics();
      for (let i = 0; i < item.costs.length; i++)
        pg.fillStyle(i < level ? COLORS.happy : 0xe0dbe8, 1).fillRoundedRect(tx + i * 18, y0, 14, 6, 3);
      c.add(pg);
    }

    // Right-hand action
    const bx = w - 58;
    const isSkin = item.kind === 'skin';
    if (cost !== null) {
      const afford = cost <= p.coins;
      const b = button(this, bx, h / 2, 100, 44, '', {
        color: afford ? COLORS.happy : 0xc9c4d4,
        onClick: this.listTap(() => this.tryBuy(item, b)),
      });
      b.add(coinIcon(this, -30, 0, 9));
      b.add(label(this, 8, 0, cost.toLocaleString(), 17, 0xffffff, true).setOrigin(0.5));
      c.add(b);
    } else if (isSkin && p.cabSkin !== item.id) {
      c.add(
        button(this, bx, h / 2, 100, 44, 'Use', {
          color: COLORS.shaft,
          fontSize: 18,
          onClick: this.listTap(() => {
            p.cabSkin = item.id;
            saveProfile(p);
            this.refresh();
          }),
        }),
      );
    } else {
      const text = isSkin ? 'In use' : item.kind === 'upgrade' ? 'Maxed' : 'Owned';
      c.add(label(this, bx, h / 2, `✓ ${text}`, 16, COLORS.happy, true).setOrigin(0.5));
    }
    return { root: c, h };
  }

  private tryBuy(item: ShopItem, b: Phaser.GameObjects.Container): void {
    if (!buy(this.profile, item)) {
      sfx.nope();
      this.tweens.add({ targets: b, x: b.x + 6, duration: 50, yoyo: true, repeat: 2 });
      return;
    }
    saveProfile(this.profile);
    sfx.buy();
    this.walletIcon.setScale(1.4);
    this.tweens.add({ targets: this.walletIcon, scale: 1, duration: 260, ease: 'Back.Out' });
    // Rebuild after the press animation so the button doesn't vanish mid-squish.
    this.time.delayedCall(60, () => this.refresh());
  }

  /** A little drawing of what you're buying. */
  private preview(item: ShopItem, cx: number, cy: number, size: number): Phaser.GameObjects.Container {
    const c = this.add.container(cx, cy);
    const g = this.add.graphics();
    c.add(g);
    const s = size / 2;
    if (item.kind === 'room') {
      const room = roomById(item.id)!;
      // Draw the room at full size into a sub-graphic, then shrink it to fit.
      const rw = 306;
      const rh = 170;
      const rg = this.add.graphics();
      rg.fillStyle(room.wall, 1).fillRect(0, 0, rw, rh);
      room.draw(rg, { l: 0, r: rw, t: 0, b: rh - 4 });
      rg.fillStyle(COLORS.slab, 1).fillRect(0, rh - 4, rw, 4);
      const k = size / rh;
      const half = (rw * k) / 2;
      rg.setScale(k).setPosition(-half, -s);
      c.add(rg);
      g.lineStyle(3, lerpColor(room.wall, 0x000000, 0.25), 1).strokeRect(-half, -s, rw * k, size);
      c.bringToTop(g);
    } else if (item.kind === 'skin') {
      const skin = CAB_SKINS[item.id];
      g.fillStyle(skin.frame, 1).fillRoundedRect(-s * 0.8, -s, s * 1.6, size, 10);
      g.fillStyle(skin.inner, 1).fillRoundedRect(-s * 0.62, -s * 0.8, s * 1.24, size * 0.85, 5);
      g.fillStyle(skin.trim, 1).fillRect(-s * 0.8, -s, s * 1.6, 4).fillRect(-s * 0.62, 0, s * 1.24, 3);
    } else if (item.kind === 'style') {
      const acc = ACCESSORY_SETS[item.id] ?? [];
      const colors = [0xffb4a2, 0xa0c4ff, 0xb5e48c];
      acc.slice(0, 3).forEach((a, i) => {
        const pg = this.add.graphics({ x: (i - 1) * s * 0.62, y: s * 0.85 });
        const bw = 22;
        const bh = 30;
        pg.fillStyle(colors[i], 1).fillRoundedRect(-bw / 2, -bh, bw, bh, 10);
        pg.fillStyle(COLORS.ink, 1).fillCircle(-4, -bh * 0.62, 1.8).fillCircle(4, -bh * 0.62, 1.8);
        drawAccessory(pg, a, bw, bh, colors[i]);
        pg.setScale(size / 60);
        c.add(pg);
      });
    } else {
      // Upgrade: coloured disc with a glyph
      const icons: Record<string, [string, number]> = {
        floors: ['▤', 0x4fbf9f],
        motor: ['»', 0x5aa9e6],
        music: ['♪', 0xa78bfa],
        capacity: ['+1', 0xe07a5f],
        heart: ['♥', 0xef476f],
        headstart: ['★', 0xf2b630],
        lucky: ['4', 0x4fbf9f],
      };
      const [glyph, color] = icons[item.id] ?? ['?', COLORS.coin];
      g.fillStyle(color, 1).fillCircle(0, 0, s * 0.8);
      g.fillStyle(0xffffff, 0.25).fillCircle(-s * 0.2, -s * 0.25, s * 0.3);
      c.add(label(this, 0, 0, glyph, Math.round(s * 0.8), 0xffffff, true).setOrigin(0.5));
    }
    return c;
  }
}
