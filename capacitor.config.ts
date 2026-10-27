import type { CapacitorConfig } from '@capacitor/cli';

// Android playtest build: `npm run android:apk` (see README). The browser build is unaffected.
const config: CapacitorConfig = {
  appId: 'com.barrytickle.goingup',
  appName: 'Going Up!',
  webDir: 'dist',
  backgroundColor: '#2b2d42',
  plugins: {
    SystemBars: {
      // Immersive: hide status and navigation bars (a swipe shows them briefly).
      hidden: true,
      style: 'DARK',
      // Edge-to-edge webview; index.html keeps the canvas inside env(safe-area-inset-*) so cutouts never cover it.
      insetsHandling: 'css',
      initialViewportFitValueHint: 'cover',
    },
  },
};

export default config;
