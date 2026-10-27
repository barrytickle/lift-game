// Everything the shop sells. Pure data: views look up colours/drawings by id.
// Prices are pitched so a new player saves up over a few shifts (base pay is low too).
// Implements the meta-progression section of design/game-brief.md.

export type ItemKind = 'upgrade' | 'room' | 'skin' | 'style';

export interface ShopItem {
  id: string;
  kind: ItemKind;
  name: string;
  desc: string;
  /** price of each level; length = max level. Empty = free/owned from the start. */
  costs: number[];
}

export const UPGRADES: ShopItem[] = [
  { id: 'floors', kind: 'upgrade', name: 'Taller Tower', desc: '+1 floor per level: more rooms, longer trips, bigger tips', costs: [600, 1400, 2800, 4800, 7600] },
  { id: 'motor', kind: 'upgrade', name: 'Better Motor', desc: 'Lift is 15% faster per level', costs: [600, 1800, 4000] },
  { id: 'music', kind: 'upgrade', name: 'Calming Music', desc: 'Passengers 10% more patient per level', costs: [1400, 3600, 7000] },
  { id: 'capacity', kind: 'upgrade', name: 'Bigger Cab', desc: '+1 seat in the lift per level', costs: [500, 1800, 4000] },
  { id: 'heart', kind: 'upgrade', name: 'Spare Heart', desc: '+1 heart per level', costs: [4000, 10000] },
  { id: 'headstart', kind: 'upgrade', name: 'Head Start', desc: 'Free perk pick when the shift begins', costs: [2400] },
  { id: 'lucky', kind: 'upgrade', name: 'Lucky Draw', desc: 'Perk drafts show 4 cards', costs: [6000] },
];

/** Room ids match view/rooms.ts. The free ones are in FREE_ROOMS there. */
export const ROOM_ITEMS: ShopItem[] = [
  { id: 'laundry', kind: 'room', name: 'Laundry Room', desc: 'Spin cycle chic', costs: [600] },
  { id: 'plants', kind: 'room', name: 'Plant Shop', desc: 'Leafy and lovely', costs: [1000] },
  { id: 'restaurant', kind: 'room', name: 'Restaurant', desc: 'Candlelit tables', costs: [1600] },
  { id: 'arcade', kind: 'room', name: 'Arcade', desc: 'Neon and noise', costs: [2400] },
  { id: 'cinema', kind: 'room', name: 'Cinema Room', desc: 'Now showing: hills', costs: [3600] },
  { id: 'gamedev', kind: 'room', name: 'Game Dev Studio', desc: 'They are making a lift game', costs: [5000] },
];

/** Skin ids match CAB_SKINS in view/Palette.ts; style ids match ACCESSORY_SETS below. */
export const STYLE_ITEMS: ShopItem[] = [
  { id: 'skin-classic', kind: 'skin', name: 'Classic Cab', desc: 'The original terracotta', costs: [] },
  { id: 'skin-mint', kind: 'skin', name: 'Mint Cab', desc: 'Fresh as a breeze', costs: [800] },
  { id: 'skin-wood', kind: 'skin', name: 'Retro Wood Cab', desc: 'Varnished and proud', costs: [1800] },
  { id: 'skin-royal', kind: 'skin', name: 'Royal Cab', desc: 'Purple with gold trim', costs: [4000] },
  { id: 'skin-gold', kind: 'skin', name: 'Solid Gold Cab', desc: 'Utterly unnecessary', costs: [12000] },
  { id: 'style-party', kind: 'style', name: 'Party Pack', desc: 'Party hats, flowers, headphones', costs: [1600] },
  { id: 'style-fancy', kind: 'style', name: 'Fancy Pack', desc: 'Top hats, crowns, monocles', costs: [5000] },
];

export const DEFAULT_SKIN = 'skin-classic';

/** Accessories passengers can wear, by style pack. 'basics' is always owned. */
export const ACCESSORY_SETS: Record<string, string[]> = {
  basics: ['none', 'none', 'hat', 'bow', 'tuft'],
  'style-party': ['party', 'flower', 'headphones'],
  'style-fancy': ['tophat', 'crown', 'monocle'],
};

export const ALL_ITEMS = [...UPGRADES, ...ROOM_ITEMS, ...STYLE_ITEMS];
