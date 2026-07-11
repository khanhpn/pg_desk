# Main Release and Pages Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every push to `main` deploy `docs/` to GitHub Pages and publish a package-versioned desktop release while retaining only the newest release assets.

**Architecture:** Replace the tag-triggered workflow with a main-branch workflow coordinated by a metadata job. Desktop builds run only for a new `v<package.json.version>` tag, while Pages deployment runs for every push; after a successful new release, a guarded cleanup removes assets from older releases but preserves their tags and release records.

**Tech Stack:** GitHub Actions YAML, Node.js 24, pnpm 11.9.0, GitHub CLI, electron-builder, official GitHub Pages actions

## Global Constraints

- `package.json.version` is the only version source; version `0.1.38` maps to `v0.1.38`.
- The workflow triggers only on pushes to `main`.
- GitHub Pages deploys on every workflow run, including when the version tag already exists.
- Desktop builds and release publishing run only when the version tag does not exist.
- Temporary GitHub Actions build artifacts use `retention-days: 1`.
- Old tags, releases, titles, and release notes are retained; only their assets are deleted.
- Old assets are deleted only after the newest release assets are uploaded and verified.
- The current release is always excluded from asset cleanup.
- The workflow uses `contents: write`, `pages: write`, and `id-token: write`.

---

### Task 1: Main-branch metadata and conditional desktop release

**Files:**

- Modify: `.github/workflows/release.yml`

**Interfaces:**

- Consumes: `package.json.version`, `github.sha`, and the remote repository's tags.
- Produces: `prepare.outputs.version`, `prepare.outputs.tag`, and `prepare.outputs.should_release` for all desktop build and publishing jobs.

- [ ] **Step 1: Change the workflow trigger, permissions, and concurrency**

Replace the tag trigger with:

```yaml
on:
  push:
    branches:
      - main

permissions:
  contents: write
  pages: write
  id-token: write

concurrency:
  group: pgdesk-main-release-and-pages
  cancel-in-progress: false
```

- [ ] **Step 2: Add the metadata job**

Add a `prepare` job before the platform build jobs:

```yaml
prepare:
  name: Prepare release metadata
  runs-on: ubuntu-latest
  outputs:
    version: ${{ steps.release.outputs.version }}
    tag: ${{ steps.release.outputs.tag }}
    should_release: ${{ steps.release.outputs.should_release }}
  steps:
    - name: Checkout source
      uses: actions/checkout@v5
      with:
        fetch-depth: 0

    - name: Read package version and check tag
      id: release
      shell: bash
      run: |
        VERSION="$(node -p "require('./package.json').version")"
        TAG="v${VERSION}"
        echo "version=$VERSION" >> "$GITHUB_OUTPUT"
        echo "tag=$TAG" >> "$GITHUB_OUTPUT"
        if git ls-remote --exit-code --tags origin "refs/tags/$TAG" >/dev/null 2>&1; then
          echo "should_release=false" >> "$GITHUB_OUTPUT"
          echo "Release tag $TAG already exists; desktop release will be skipped."
        else
          echo "should_release=true" >> "$GITHUB_OUTPUT"
          echo "Release tag $TAG does not exist; desktop release will be built."
        fi
```

- [ ] **Step 3: Gate both platform build jobs**

Add the same dependency and condition to `build-macos` and `build-windows`:

```yaml
needs: prepare
if: needs.prepare.outputs.should_release == 'true'
```

Keep the existing checkout, Node/pnpm setup, build, architecture verification, and artifact path lists unchanged.

- [ ] **Step 4: Limit temporary artifact retention**

Add this key to both `actions/upload-artifact` steps:

```yaml
retention-days: 1
```

- [ ] **Step 5: Make release publishing use metadata outputs**

Update `create-release` to depend on metadata and both builds, and gate it on a new version:

```yaml
needs:
  - prepare
  - build-macos
  - build-windows
if: needs.prepare.outputs.should_release == 'true'
```

Set its publishing environment to:

```yaml
env:
  GH_TOKEN: ${{ github.token }}
  TAG_NAME: ${{ needs.prepare.outputs.tag }}
  TARGET_SHA: ${{ github.sha }}
  REPO: ${{ github.repository }}
```

Replace the existing create-or-upload branch with a single new-release operation after builds succeed:

```bash
gh release create "$TAG_NAME" \
  release-assets/**/* \
  --repo "$REPO" \
  --target "$TARGET_SHA" \
  --title "pgdesk $TAG_NAME" \
  --generate-notes
```

- [ ] **Step 6: Verify the new release and clean old assets**

Append this logic to the publishing script after `gh release create`:

```bash
ASSET_COUNT="$(gh release view "$TAG_NAME" --repo "$REPO" --json assets --jq '.assets | length')"
if [ "$ASSET_COUNT" -eq 0 ]; then
  echo "Release $TAG_NAME has no uploaded assets; refusing to clean older releases."
  exit 1
fi

gh api --paginate "repos/$REPO/releases?per_page=100" \
  --jq ".[] | select(.tag_name != \"$TAG_NAME\") | .tag_name as \$tag | .assets[] | [.id, .name, \$tag] | @tsv" |
while IFS=$'\t' read -r ASSET_ID ASSET_NAME RELEASE_TAG; do
  [ -n "$ASSET_ID" ] || continue
  echo "Deleting asset $ASSET_NAME from $RELEASE_TAG"
  gh api --method DELETE "repos/$REPO/releases/assets/$ASSET_ID"
done
```

This loop deliberately enumerates releases rather than tags, excludes the current tag, and lets any failed deletion fail the job because the script runs with GitHub Actions' default `bash -e` behavior.

- [ ] **Step 7: Run focused static checks**

Run:

```bash
PATH=/Users/khanh/.nvm/versions/node/v24.15.0/bin:$PATH pnpm exec prettier --check .github/workflows/release.yml
git diff --check
rg -n "branches:|main|retention-days: 1|should_release|gh release create|releases/assets" .github/workflows/release.yml
```

Expected: Prettier reports the workflow is formatted, `git diff --check` prints nothing, and `rg` shows the trigger, release gate, one-day retention on both artifacts, release creation, and asset deletion endpoint.

- [ ] **Step 8: Commit the conditional release workflow**

```bash
git add .github/workflows/release.yml
git commit -m "ci: automate releases from package version"
```

---

### Task 2: Deploy documentation to GitHub Pages on every main push

**Files:**

- Modify: `.github/workflows/release.yml`

**Interfaces:**

- Consumes: the checked-out `docs/` directory from the pushed `main` commit.
- Produces: a Pages artifact named by the official upload action and a deployment URL exposed by `deploy-pages`.

- [ ] **Step 1: Add the Pages artifact job**

Add a job with no dependency on `prepare` or the desktop build jobs:

```yaml
build-pages:
  name: Build GitHub Pages artifact
  runs-on: ubuntu-latest
  steps:
    - name: Checkout source
      uses: actions/checkout@v5

    - name: Configure GitHub Pages
      uses: actions/configure-pages@v5

    - name: Upload documentation
      uses: actions/upload-pages-artifact@v4
      with:
        path: docs
```

- [ ] **Step 2: Add the Pages deployment job**

Add the dependent deployment job:

```yaml
deploy-pages:
  name: Deploy GitHub Pages
  runs-on: ubuntu-latest
  needs: build-pages
  environment:
    name: github-pages
    url: ${{ steps.deployment.outputs.page_url }}
  steps:
    - name: Deploy GitHub Pages
      id: deployment
      uses: actions/deploy-pages@v4
```

- [ ] **Step 3: Verify Pages independence and workflow formatting**

Run:

```bash
PATH=/Users/khanh/.nvm/versions/node/v24.15.0/bin:$PATH pnpm exec prettier --check .github/workflows/release.yml
git diff --check
rg -n "build-pages:|deploy-pages:|path: docs|github-pages|page_url" .github/workflows/release.yml
```

Expected: formatting passes, the diff has no whitespace errors, and both Pages jobs are present. Confirm by inspection that `build-pages` does not contain `needs: prepare` or a `should_release` condition.

- [ ] **Step 4: Run repository-level workflow regression checks**

Run:

```bash
PATH=/Users/khanh/.nvm/versions/node/v24.15.0/bin:$PATH pnpm exec prettier --check .github/workflows/release.yml docs/superpowers/specs/2026-07-11-main-release-and-pages-deployment-design.md
git diff --check
git status --short
```

Expected: Prettier passes, the diff check is silent, and only the intended workflow and plan changes remain uncommitted at this stage.

- [ ] **Step 5: Commit Pages deployment**

```bash
git add .github/workflows/release.yml docs/superpowers/plans/2026-07-11-main-release-and-pages-deployment-plan.md
git commit -m "ci: deploy docs to GitHub Pages"
```

---

### Task 3: Final workflow review

**Files:**

- Verify: `.github/workflows/release.yml`
- Verify: `docs/superpowers/specs/2026-07-11-main-release-and-pages-deployment-design.md`

**Interfaces:**

- Consumes: the complete workflow from Tasks 1 and 2.
- Produces: evidence that all design constraints are represented before the workflow is pushed.

- [ ] **Step 1: Inspect the final workflow and history**

```bash
sed -n '1,360p' .github/workflows/release.yml
git log -3 --oneline --decorate
git status --short
```

Expected: the workflow is triggered by `main`; Pages jobs always run; desktop jobs are gated by `should_release`; cleanup occurs after asset verification; the intended commits are visible; the worktree is clean.

- [ ] **Step 2: Document live verification requirements**

After pushing a commit with a new `package.json.version`, verify in GitHub Actions that:

```text
prepare -> build-macos + build-windows -> create-release
build-pages -> deploy-pages
```

Expected: the new `v<version>` release contains macOS and Windows installers plus updater metadata, older releases remain present with zero assets, Actions build artifacts expire after one day, and the Pages environment reports the deployed URL.
