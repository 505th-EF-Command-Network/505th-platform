import { resolve } from "node:path";
import { defineConfig } from "electron-vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  // Main process (Node): window, sign-in, 505th Net.
  main: {},
  // Preload: the only bridge between the window and Node.
  preload: {},
  // Renderer: the React screens.
  renderer: {
    resolve: { alias: { "@": resolve("src/renderer/src") } },
    plugins: [react(), tailwindcss()],
  },
});
