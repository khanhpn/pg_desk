# Main Branch Release and Pages Deployment Design

## Goal

Make every push to `main` deploy the static documentation to GitHub Pages and, when `package.json` contains a version that has not yet been released, build and publish a new desktop release automatically.

The `version` field in `package.json` is the single source of truth. Version `0.1.38` maps to tag and release name `v0.1.38`.

## Workflow Trigger and Concurrency

The release workflow runs on every push to `main`. A workflow-level concurrency group serializes main-branch deployments so two nearby pushes cannot publish the same version or overwrite a Pages deployment concurrently.

The workflow grants only the permissions required to publish repository releases and GitHub Pages:

- `contents: write`
- `pages: write`
- `id-token: write`

## Version Discovery

An initial job checks out the pushed commit and reads `package.json.version` with Node.js. It exposes:

- The package version, such as `0.1.38`.
- The release tag, such as `v0.1.38`.
- Whether that tag already exists in the remote repository.

If the tag already exists, release build and publishing jobs are skipped. The Pages deployment still runs.

## Desktop Release

When the version tag does not exist, macOS and Windows jobs build the same artifacts currently produced by `release:mac` and `release:win`.

Build artifacts are transferred between jobs with GitHub Actions artifacts configured with `retention-days: 1`. These are temporary transport files, not permanent release downloads.

After both platform builds succeed, the publishing job:

1. Downloads all build artifacts.
2. Creates `v<package-version>` at the exact commit that triggered the workflow.
3. Creates a GitHub Release with generated release notes.
4. Uploads the macOS and Windows installers, blockmaps, and updater metadata.
5. Confirms that the new release contains uploaded assets.
6. Removes every asset from every older GitHub Release while preserving the older releases, tags, titles, and release notes.

Cleanup runs only after the new release and all of its assets have been published successfully. The current release is always excluded from cleanup. A build or publishing failure therefore leaves the previous downloadable release intact.

## GitHub Pages

A Pages build job uploads the repository's `docs/` directory with the official GitHub Pages artifact action. A dependent deployment job publishes that artifact to the `github-pages` environment.

Pages deployment is independent of whether the package version is new. Documentation changes on `main` are therefore deployed even when no desktop release is created.

## Failure and Retry Behavior

- If a platform build fails, no new tag or release is created and old release assets remain untouched.
- If release publishing fails before asset verification, cleanup does not run.
- If cleanup of one old release asset fails, the publishing job fails visibly instead of silently reporting complete cleanup.
- If the same package version is pushed again, desktop publishing is skipped because its tag already exists; Pages still deploys.
- Retrying a failed run after the release has already been created does not rebuild that version automatically. A partially published release must be repaired manually or the version must be incremented. The workflow minimizes this case by creating the release only after all builds succeed.

## Verification

The workflow configuration will be checked locally for valid YAML structure and reviewed for correct job dependencies, conditions, permissions, version outputs, release cleanup exclusions, and one-day artifact retention.

The final end-to-end verification occurs on the next push to `main`, because GitHub-hosted macOS/Windows builds, Pages environments, and repository release permissions are unavailable locally.
