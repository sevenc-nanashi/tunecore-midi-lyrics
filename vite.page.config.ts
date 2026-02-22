import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

console.log("Vite config loaded with PORT:", process.env.PORT);
export default defineConfig({
  plugins: [vue()],
  base: "/tunecore-midi-lyrics",
  build: {
    outDir: "dist-page",
    emptyOutDir: true,
  },
  server: {
    port: Number(process.env.PORT) || undefined,
  },
});
