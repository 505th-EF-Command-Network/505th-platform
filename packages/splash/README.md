# @505th/splash

Opera-style start-up splash for Electron apps. Borderless, transparent window showing only the logo:
fade + zoom in → hold → fade + zoom out (≈1.8 s), then your main window is shown. No sound.

```ts
import { app, BrowserWindow } from "electron";
import { playSplash } from "@505th/splash";

app.whenReady().then(async () => {
  const main = new BrowserWindow({ show: false, width: 1400, height: 900 });
  void main.loadURL("https://example.com");          // loads behind the splash
  await playSplash({ logoPath: "assets/logo.png", mainWindow: main, durationMs: 1800 });
});
```

Options: `logoPath`, `mainWindow`, `durationMs` (default 1800), `size` (logo px, default 180), `glow` (CSS colour), `gapAfterMs` (pause after the fade-out before the main window, default 0), `skip`.

- Skipped automatically when the OS "reduce motion" setting is on.
- Never longer than `durationMs`; the main window is shown even if it is still loading (it shows its own loading state).
- Does not take focus or appear in the taskbar; clicks pass through it.
