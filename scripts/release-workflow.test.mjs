import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflowPath = new URL(
  "../.github/workflows/release.yml",
  import.meta.url,
);
const workflow = await readFile(workflowPath, "utf8");

test("releases package versions from pushes to main", () => {
  assert.match(workflow, /push:\s*\n\s+branches:\s*\n\s+- main/);
  assert.match(workflow, /VERSION=.*package\.json.*version/);
  assert.match(workflow, /TAG=.*v.*VERSION/);
  assert.match(workflow, /should_release/);
  assert.match(workflow, /gh release create/);
  assert.match(workflow, /--target "\$TARGET_SHA"/);
});

test("keeps temporary build artifacts for one day", () => {
  const retentionSettings = workflow.match(/retention-days:\s*1/g) ?? [];
  assert.equal(retentionSettings.length, 2);
});

test("removes only assets belonging to older releases", () => {
  assert.match(workflow, /select\(\.tag_name != \\"\$TAG_NAME\\"\)/);
  assert.match(workflow, /releases\/assets\/\$ASSET_ID/);
  assert.match(workflow, /ASSET_COUNT/);
});

test("deploys docs to GitHub Pages independently", () => {
  assert.match(workflow, /build-pages:/);
  assert.match(workflow, /actions\/upload-pages-artifact@v4/);
  assert.match(workflow, /path:\s*docs/);
  assert.match(workflow, /deploy-pages:/);
  assert.match(workflow, /actions\/deploy-pages@v4/);
  assert.match(workflow, /name:\s*github-pages/);
});
