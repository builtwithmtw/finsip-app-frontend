# FINSIP — working agreement

## Verification

- **Don't run `npm run build`.** It is slow and the user does not want it in the loop.
- **Don't run linting** (`eslint`, `npm run lint`) as a check on your own work. This repo
  has pre-existing lint errors that are not yours to fix, and reporting them is noise.
- `npx tsc --noEmit` is fine and fast when a change could plausibly break types.

Verify by making the change carefully and reading it back, not by running the toolchain
over it.

## Focus

Execute the feature that was asked for. Don't widen the change into adjacent cleanups,
don't fix unrelated pre-existing problems, and don't report them unless they block the
task. Keep the diff to the thing requested.
