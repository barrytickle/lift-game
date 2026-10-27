import Phaser from 'phaser';
import { initPlatform } from './platform';
import { sfx } from './view/Sfx';
import { GameScene } from './scenes/GameScene';
import { MenuBackScene, MenuFrontScene } from './scenes/MenuScene';
import { ShopScene } from './scenes/ShopScene';
import { DPR, H, W } from './view/Layout';
import { COLORS } from './view/Palette';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: COLORS.night,
  antialias: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: W * DPR,
    height: H * DPR,
  },
  input: { activePointers: 2 },
  scene: [GameScene, MenuBackScene, MenuFrontScene, ShopScene],
});

document.addEventListener('contextmenu', (e) => e.preventDefault());
initPlatform();

// Exposed for debugging / automated checks in the browser console.
(window as unknown as { game: Phaser.Game; sfx: typeof sfx }).game = game;
(window as unknown as { sfx: typeof sfx }).sfx = sfx;
