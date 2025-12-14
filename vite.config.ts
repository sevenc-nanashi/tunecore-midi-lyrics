import { defineConfig } from "vite";
import monkey from "vite-plugin-monkey";

export default defineConfig({
  plugins: [
    monkey({
      entry: "./src/index.ts",
      build: {
        autoGrant: false,
      },
      userscript: {
        match: "https://www.tunecore.co.jp/member/release/*",
      },
    }),
  ],
  build: {
    minify: true,
  },
});
