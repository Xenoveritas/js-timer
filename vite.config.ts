import { defineConfig } from "vite";
import compileTimers from './src/plugins/vite-plugin-timers.mjs';

export default defineConfig({
  root: "web/",
  build: {
    "outDir": "../build"
  },
  plugins: [
    compileTimers()
  ],
});