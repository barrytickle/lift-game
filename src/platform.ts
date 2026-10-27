import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { sfx } from './view/Sfx';

// App lifecycle for the browser and the Android (Capacitor) build:
//   - going to the background silences all audio and lets the active scene pause play
//   - coming back restores audio (play stays paused until the player resumes)
//   - Android's back button is handed to the active scene

export const isNative = Capacitor.isNativePlatform();

export interface AppHooks {
  background(): void;
  back(): void;
}

let hooks: AppHooks | null = null;
let away = false;

/** The active scene registers what background / back mean for it. */
export function setAppHooks(h: AppHooks): void {
  hooks = h;
}

/** A scene shutting down drops its hooks (unless the next scene already replaced them). */
export function clearAppHooks(h: AppHooks): void {
  if (hooks === h) hooks = null;
}

function toBackground(): void {
  if (away) return;
  away = true;
  sfx.sleep();
  hooks?.background();
}

function toForeground(): void {
  if (!away) return;
  away = false;
  sfx.wake();
}

export function initPlatform(): void {
  document.addEventListener('visibilitychange', () => (document.hidden ? toBackground() : toForeground()));
  if (!isNative) return;
  void App.addListener('pause', toBackground);
  void App.addListener('resume', toForeground);
  void App.addListener('backButton', () => hooks?.back());
}

/** Back on the main menu: send the app to the background like other games do. */
export function minimizeApp(): void {
  if (isNative) void App.minimizeApp();
}
