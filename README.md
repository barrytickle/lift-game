# Going Up!

A small, charming lift-management game for phones. Hold ▲/▼ (or tap a floor) to move the lift;
passengers hop on and off by themselves. Deliver them before their patience runs out.

```
npm install
npm run dev
```

Open the printed URL. To try it on a phone, use the "Network" address while on the same Wi-Fi.

Desktop keys: hold `↑`/`↓` to drive the lift, `G`/`0`–`9` jump to a floor, `Enter` starts a shift.

Scoring: 5 coins per delivery, up to +15 for a quick trip, +6 per floor travelled, and +5 × n for
the n-th extra passenger dropped at the same stop. Three hearts per run: each walkout costs one.

## Android playtest build

The Android app wraps the same web build with [Capacitor](https://capacitorjs.com/); the browser
version is unchanged. Needs Node 22+, JDK 21 (`JAVA_HOME`) and the Android SDK (`ANDROID_HOME`),
for example from Android Studio.

```
npm run android:apk
```

builds `dist/`, syncs it into `android/` and produces a debug APK at
`android/app/build/outputs/apk/debug/app-debug.apk`. With a phone plugged in (USB debugging on)
or an emulator running:

```
npm run android:install
```

Android specifics: portrait only, full screen with the game kept clear of camera cutouts, play
pauses (with audio silenced) when the app goes to the background, and the back button pauses a
shift / leaves the shop / closes the app from the menu. Progress is saved in the WebView's local
storage, which survives restarts and updates (but not "Clear data" or uninstalling).
