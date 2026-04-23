import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = parseArgs(process.argv.slice(2));
const scriptId = args["script-id"] || process.env.CITEPILOT_SCRIPT_ID;
const apiBaseUrl = args["api-url"] || process.env.CITEPILOT_API_BASE_URL;

if (!scriptId || !apiBaseUrl) {
  console.error([
    "Missing required config.",
    "",
    "Usage:",
    "npm run addon:configure -- --script-id YOUR_SCRIPT_ID --api-url https://your-api-url",
    "",
    "You can get SCRIPT_ID from Apps Script: Project Settings -> Script ID."
  ].join("\n"));
  process.exit(1);
}

if (!apiBaseUrl.startsWith("https://")) {
  console.error("The API URL must be HTTPS because Google Apps Script calls it from Google servers.");
  process.exit(1);
}

await writeJson(resolve(root, ".citepilot-addon.json"), {
  apiBaseUrl
});

await writeJson(resolve(root, "apps/docs-addon/.clasp.json"), {
  scriptId,
  rootDir: "./build"
});

console.log("CitePilot add-on configured.");
console.log(`Script ID: ${scriptId}`);
console.log(`API URL: ${apiBaseUrl}`);
console.log("");
console.log("Next command:");
console.log("npm run addon:deploy");

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith("--")) continue;
    parsed[item.slice(2)] = argv[index + 1];
    index += 1;
  }
  return parsed;
}
