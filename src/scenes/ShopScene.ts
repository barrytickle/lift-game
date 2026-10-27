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

  constructor() {
    super('shop');
  }

  create(): void {
    this.cameras.main.setZoom(DPR).centerOn(W / 2, H / 2);
    this.cameras.main.setBackgroundColor(COLORS.night);
    this.profile = loadProfile();

    this.add.rectangle(0, HUD_H - 4, W, H, COLORS.wallA).setOrigin(0);
    this.add.rectangle(0, HUD_H - 4, W, 8, COLORS.cabFrame).setOrigin(0);

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
          this.refresh();
        },
      });
      c.add(b);
    });
  }

  private drawList(): void {
    this.list?.destroy();
    const items = TABS.find((t) => t.id === this.tab)!.items;
    const top = HUD_H + 72;
    const bottom = H - 92;
    const gap = 10;
    const rowH = Math.min(100, (bottom - top - gap * (items.length - 1)) / items.length);
    const c = (this.list = this.add.container(0, 0));
    items.forEach((item, i) => c.add(this.row(item, 24, top + i * (rowH + gap), W - 48, rowH)));
  }

  private row(item: ShopItem, x: number, y: number, w: number, h: number): Phaser.GameObjects.Container {
    const p = this.profile;
    const c = this.add.container(x, y);
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.08).fillRoundedRect(0, 4, w, h, 16);
    g.fillStyle(0xffffff, 1).fillRoundedRect(0, 0, w, h, 16);
    c.add(g);

    const thumb = Math.min(h - 16, 74);
    // Rooms keep their wide proportions; everything else is square.
    const thumbW = item.kind === 'room' ? thumb * 1.8 : thumb;
    c.add(this.preview(item, 12 + thumbW / 2, h / 2, thumb));

    const tx = 24 + thumbW;
    const level = itemLevel(p, item);
    const cost = nextCost(p, item);
    c.add(label(this, tx, h / 2 - 2, item.name, 19, COLORS.ink, true).setOrigin(0, 1).setAlign('left'));
    c.add(label(this, tx, h / 2 + 2, item.desc, 14, 0x6b6e8a, false, w - tx - 118).setOrigin(0, 0).setAlign('left'));

    // Level pips for multi-level upgrades
    if (item.costs.length > 1) {
      const pg = this.add.graphics();
      for (let i = 0; i < item.costs.length; i++)
        pg.fillStyle(i < level ? COLORS.happy : 0xe0dbe8, 1).fillRoundedRect(tx + i * 18, 10, 14, 6, 3);
      c.add(pg);
    }

    // Right-hand action
    const bx = w - 58;
    const isSkin = item.kind === 'skin';
    if (cost !== null) {
      const afford = cost <= p.coins;
      const b = button(this, bx, h / 2, 100, 44, '', {
        color: afford ? COLORS.happy : 0xc9c4d4,
        onClick: () => this.tryBuy(item, b),
      });
      b.add(coinIcon(this, -30, 0, 9));
      b.add(label(this, 8, 0, cost.toLocaleString(), 17, 0xffffff, true).setOrigin(0.5));
      c.add(b);
    } else if (isSkin && p.cabSkin !== item.id) {
      c.add(
        button(this, bx, h / 2, 100, 44, 'Use', {
          color: COLORS.shaft,
          fontSize: 18,
          onClick: () => {
            p.cabSkin = item.id;
            saveProfile(p);
            this.refresh();
          },
        }),
      );
    } else {
      const text = isSkin ? 'In use' : item.kind === 'upgrade' ? 'Maxed' : 'Owned';
      c.add(label(this, bx, h / 2, `✓ ${text}`, 16, COLORS.happy, true).setOrigin(0.5));
    }
    return c;
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
