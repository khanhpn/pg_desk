// @vitest-environment node

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("release configuration", () => {
  it("builds and uploads macOS ZIP artifacts for electron-updater", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
      scripts: Record<string, string>;
    };
    const builderConfig = readFileSync("electron-builder.yml", "utf8");
    const releaseWorkflow = readFileSync(
      ".github/workflows/release.yml",
      "utf8",
    );

    expect(packageJson.scripts["release:mac"]).not.toContain("--mac dmg");
    expect(builderConfig).toMatch(/-\s+zip/);
    expect(builderConfig).not.toContain("arch:");
    expect(releaseWorkflow).toContain("dist-release/*.zip");
    expect(releaseWorkflow).toContain("dist-release/*.zip.blockmap");
  });
});
