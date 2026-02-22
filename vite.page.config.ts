import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [vue()],
  base: "/tunecore-midi-lyrics",
  build: {
    outDir: "dist-page",
    emptyOutDir: true,
  },
});
