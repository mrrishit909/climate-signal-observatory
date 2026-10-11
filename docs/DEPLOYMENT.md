# Deployment

Target: GitHub Pages at https://mrrishit909.github.io/climate-signal-observatory/ (placeholder until the first deploy). The GitHub repo does not exist yet; creating it, pushing and deploying are separate, authorized steps.

## How

`scripts/deploy_site_pages.sh <repo-name>` (copy of the shared `~/data-frontier/shared/deployment/deploy_site_pages.sh`):

```bash
scripts/deploy_site_pages.sh climate-signal-observatory
```

It runs `npm run build` in `site/` (which runs `tsc --noEmit` first), writes `site/dist` to a temporary worktree on the `gh-pages` branch with `.nojekyll`, pushes `gh-pages`, then creates or updates the Pages source to `gh-pages` at `/` through the GitHub API using the git credential helper's token. Run it from a clean checkout with an `origin` remote.

Base path `/climate-signal-observatory/` is set in `site/vite.config.ts`; `npm run preview` serves the same path on port 4321.

## Pre-compressed grids

The grid binaries `site/public/data/*.i8.bin.gz` are gzip files on disk, not files the server compresses. GitHub Pages serves them as-is without a `Content-Encoding` header, so the browser receives gzip bytes and `site/src/data/grid.ts` inflates them. Some servers (vite preview does) add `Content-Encoding: gzip`, in which case the client receives already-inflated bytes; the client therefore checks the `1f 8b` magic and only gunzips when it is present. After either path the result is verified against the sidecar's sha256 of the uncompressed bytes. Do not re-compress or rename these files.

## Pre-deploy checklist (the release gate)

1. `uv run pytest -q`, then in `site/`: `npm run typecheck`, `lint`, `test`, `e2e`.
2. `npm run build && npm run preview`; screenshots at 1440x900, 768x1024, 390x844 and a scroll recording; an independent QA pass reads the images.
3. Lighthouse and axe on the production build.
4. Deploy, then verify: `curl -sI https://mrrishit909.github.io/climate-signal-observatory/` returns 200; `curl -sI .../data/grid_gistemp_2deg.i8.bin.gz` returns 200 and the first two bytes are `1f 8b`; take a real screenshot of the live URL.
5. Add the case study to the projects site (`~/data-frontier/portfolio/03-climate-signal-observatory/project.json` is the draft; schema `contracts/portfolio.schema.json`) and verify every link.

Results of steps 2 to 5: TBD (pending QA / deploy).

## CI

`.github/workflows/ci.yml` runs on push and pull request; it does not deploy. Deployment stays a manual script so a failing gate cannot publish.

## Rollback

Pages serves the `gh-pages` branch; revert by force-pushing a previous `gh-pages` commit or re-running the script from an earlier tag.
