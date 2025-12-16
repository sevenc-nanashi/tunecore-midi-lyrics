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
        downloadURL:
          "https://raw.githubusercontent.com/sevenc-nanashi/tunecore-midi-lyrics/built/tunecore-midi-lyrics.user.js",
        updateURL:
          "https://raw.githubusercontent.com/sevenc-nanashi/tunecore-midi-lyrics/built/tunecore-midi-lyrics.user.js",
      },
    }),
    {
      name: "enable-minifier",
      apply: "build",
      config() {
        return {
          build: {
            minify: true,
          },
        };
      },
    },
  ],
});
