import { build as esbuild } from "esbuild";
import packageJson from "./package.json";

export const build = async () => {
  const bannerMap: Record<string, string> = {
    name: packageJson.displayName,
    description: packageJson.description,
    version: packageJson.version,
    homepage: packageJson.homepage,
    author: packageJson.author,
    match: "https://www.tunecore.co.jp/member/release/*",
    updateURL: `https://raw.githubusercontent.com/sevenc-nanashi/${packageJson.name}/built/index.user.js`,
    downloadURL: `https://raw.githubusercontent.com/sevenc-nanashi/${packageJson.name}/built/index.user.js`,
    sandbox: "MAIN_WORLD",
  };
  const banner = `// ==UserScript==\n${Object.keys(bannerMap)
    .map((key) => `// @${key} ${bannerMap[key]}`)
    .join("\n")}\n// ==/UserScript==\n`;

  await esbuild({
    entryPoints: ["src/index.ts"],
    bundle: true,
    minify: true,
    format: "iife",
    outfile: "dist/index.user.js",
    sourcemap: "inline",
    banner: { js: banner },
    plugins: [],
  });
  console.log("Build complete");
};

if (import.meta.main) {
  build();
}
