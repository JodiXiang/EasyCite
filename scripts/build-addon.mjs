import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = resolve(root, "apps/docs-addon/build");
const configPath = resolve(root, ".citepilot-addon.json");
const config = existsSync(configPath)
  ? JSON.parse(await readFile(configPath, "utf8"))
  : {};
const apiBaseUrl = process.env.CITEPILOT_API_BASE_URL || config.apiBaseUrl;

await mkdir(outDir, { recursive: true });

const compiledCode = await readFile(resolve(root, "apps/docs-addon/dist/Code.js"), "utf8");
await writeFile(
  resolve(outDir, "Code.js"),
  compiledCode
    .replace(
      /const DEFAULT_API_BASE_URL = "http:\/\/localhost:8787";/,
      `const DEFAULT_API_BASE_URL = ${JSON.stringify(apiBaseUrl || "http://localhost:8787")};`
    )
    .replace(/^export\s*\{\};\s*$/gm, "")
    .replaceAll("function onOpen()", "function onOpen()")
    .replace(/^\/\/# sourceMappingURL=.*$/gm, "")
);

await copyFile(resolve(root, "apps/docs-addon/src/Sidebar.html"), resolve(outDir, "Sidebar.html"));
await copyFile(resolve(root, "apps/docs-addon/appsscript.json"), resolve(outDir, "appsscript.json"));

console.log(`Apps Script build written to ${outDir}`);
console.log(`API base URL baked into add-on: ${apiBaseUrl || "http://localhost:8787"}`);
