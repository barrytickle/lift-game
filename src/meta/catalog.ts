// Everything the shop sells. Pure data: views look up colours/drawings by id.
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
  { id: 'motor', kind: 'upgrade', name: 'Better Motor', desc: 'Lift is 10% faster per level', costs: [500, 1200, 2500] },
  { id: 'music', kind: 'upgrade', name: 'Calming Music', desc: 'Passengers 10% more patient per level', costs: [700, 1800, 3500] },
  { id: 'capacity', kind: 'upgrade', name: 'Bigger Cab', desc: '+1 seat in the lift per level', costs: [250, 900, 2000] },
  { id: 'heart', kind: 'upgrade', name: 'Spare Heart', desc: '+1 heart per level', costs: [2000, 5000] },
  { id: 'headstart', kind: 'upgrade', name: 'Head Start', desc: 'Free perk pick when the shift begins', costs: [1200] },
  { id: 'lucky', kind: 'upgrade', name: 'Lucky Draw', desc: 'Perk drafts show 4 cards', costs: [3000] },
];

/** Room ids match view/rooms.ts. The free ones are in FREE_ROOMS there. */
export const ROOM_ITEMS: ShopItem[] = [
  { id: 'laundry', kind: 'room', name: 'Laundry Room', desc: 'Spin cycle chic', costs: [300] },
  { id: 'plants', kind: 'room', name: 'Plant Shop', desc: 'Leafy and lovely', costs: [500] },
  { id: 'restaurant', kind: 'room', name: 'Restaurant', desc: 'Candlelit tables', costs: [800] },
  { id: 'arcade', kind: 'room', name: 'Arcade', desc: 'Neon and noise', costs: [1200] },
  { id: 'cinema', kind: 'room', name: 'Cinema Room', desc: 'Now showing: hills', costs: [1800] },
  { id: 'gamedev', kind: 'room', name: 'Game Dev Studio', desc: 'They are making a lift game', costs: [2500] },
];

/** Skin ids match CAB_SKINS in view/Palette.ts; style ids match ACCESSORY_SETS below. */
export const STYLE_ITEMS: ShopItem[] = [
  { id: 'skin-classic', kind: 'skin', name: 'Classic Cab', desc: 'The original terracotta', costs: [] },
  { id: 'skin-mint', kind: 'skin', name: 'Mint Cab', desc: 'Fresh as a breeze', costs: [400] },
  { id: 'skin-wood', kind: 'skin', name: 'Retro Wood Cab', desc: 'Varnished and proud', costs: [900] },
  { id: 'skin-royal', kind: 'skin', name: 'Royal Cab', desc: 'Purple with gold trim', costs: [2000] },
  { id: 'skin-gold', kind: 'skin', name: 'Solid Gold Cab', desc: 'Utterly unnecessary', costs: [6000] },
  { id: 'style-party', kind: 'style', name: 'Party Pack', desc: 'Party hats, flowers, headphones', costs: [800] },
  { id: 'style-fancy', kind: 'style', name: 'Fancy Pack', desc: 'Top hats, crowns, monocles', costs: [2500] },
];

export const DEFAULT_SKIN = 'skin-classic';

/** Accessories passengers can wear, by style pack. 'basics' is always owned. */
export const ACCESSORY_SETS: Record<string, string[]> = {
  basics: ['none', 'none', 'hat', 'bow', 'tuft'],
  'style-party': ['party', 'flower', 'headphones'],
  'style-fancy': ['tophat', 'crown', 'monocle'],
};

export const ALL_ITEMS = [...UPGRADES, ...ROOM_ITEMS, ...STYLE_ITEMS];
