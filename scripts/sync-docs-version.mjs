import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const packageJsonPath = join(rootDir, "package.json");
const docsFiles = [
  join(rootDir, "docs", "index.html"),
  join(rootDir, "docs", "documentation.html"),
];

const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
const versionLabel = `v${packageJson.version}`;

for (const docsFile of docsFiles) {
  const html = await readFile(docsFile, "utf8");
  const nextHtml = html
    .replace(
      /<span class="version-pill">v[^<]+<\/span>/g,
      `<span class="version-pill">${versionLabel}</span>`,
    )
    .replace(/PgDesk v[0-9]+\.[0-9]+\.[0-9]+/g, `PgDesk ${versionLabel}`);

  if (nextHtml !== html) {
    await writeFile(docsFile, nextHtml);
  }
}
