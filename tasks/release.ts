import { $ } from "bun";
import { parseArgs } from "node:util";
import consola from "consola";

const { values } = parseArgs({
  args: Bun.argv,
  options: {
    version: {
      type: "string",
      short: "v",
    },
    push: {
      type: "boolean",
      short: "p",
      default: false,
    },
  },
  strict: true,
  allowPositionals: true,
});

if (!values.version) {
  consola.error("Error: --version is required");
  process.exit(1);
}

const version = values.version;
const push = values.push;

const currentHeadSha = (await $`git rev-parse HEAD`.quiet(true)).text();
consola.info(`Current HEAD: ${currentHeadSha}`);
consola.info(`Releasing version: v${version}`);
consola.info(`Push to remote: ${push}`);

consola.info(`Reset: git reset --hard ${currentHeadSha}`);

consola.info(`Updating package.json version to ${version}`);
const tagName = `v${version}`;
const packageJson = JSON.parse(await Bun.file("package.json").text());
packageJson.version = version;
await Bun.write("package.json", JSON.stringify(packageJson, null, 2) + "\n");

consola.info(`Building userscript...`);
await $`bun run build`;
const actualScript = await Bun.file("dist/tunecore-midi-lyrics.user.js").text();

consola.info(`Committing changes and tagging release as ${tagName}...`);
await $`git add .`;
await $`git commit -m "release: v${version}"`;
await $`git tag ${tagName}`;

consola.info(`Updating built branch...`);
await $`git switch built`;
await Bun.write("tunecore-midi-lyrics.user.js", actualScript);
await $`git add tunecore-midi-lyrics.user.js`;
await $`git commit -m "release: v${version}"`;

if (push) {
  consola.info(`Pushing changes to remote...`);
  await $`git push origin main --tags`;
  await $`git push origin built`;
} else {
  consola.info("Skipping push to remote.");
}

consola.info(`Switching back to main branch...`);
await $`git switch main`;

consola.success(`Release v${version} completed successfully!`);
