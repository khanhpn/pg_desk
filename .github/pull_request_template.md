## Summary

<!-- Explain what changed and why. Keep this concise, but specific enough for a reviewer to understand the intent. -->

-

## Scope

<!-- Check every area touched by this PR. -->

- [ ] Electron main/preload or IPC
- [ ] React UI/components
- [ ] Custom hooks/state management
- [ ] PostgreSQL query/metadata/backup logic
- [ ] Styling/CSS
- [ ] Landing page or documentation
- [ ] Tests, CI, or release tooling
- [ ] Other:

## Screenshots or Demo

<!-- Add screenshots, video, or notes for UI/UX changes. Use "N/A" for non-visual changes. -->

N/A

## Validation

<!-- Run the relevant checks locally before requesting review. CI runs the same core checks for PRs into main. -->

- [ ] `pnpm run docs:sync-version`
- [ ] `pnpm run format:check`
- [ ] `pnpm run lint`
- [ ] `pnpm test`
- [ ] `pnpm run build`
- [ ] `pnpm run test:e2e`

## Risk and Rollback

<!-- Describe possible regressions, migration concerns, or data-risk areas. Include rollback notes when useful. -->

- Risk level: Low / Medium / High
- Rollback plan:

## Reviewer Notes

<!-- Call out files, flows, or edge cases where reviewer attention is especially useful. -->

-

## Final Checklist

- [ ] PR targets `main`.
- [ ] The branch is up to date with `main`.
- [ ] User-facing text is clear and professional.
- [ ] New or changed behavior is covered by tests where practical.
- [ ] Documentation and landing page are updated when the feature is user-facing.
- [ ] No local-only files, secrets, generated artifacts, or debug logs are included.
