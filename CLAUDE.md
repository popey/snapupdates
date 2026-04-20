# Claude Code Instructions

@AGENTS.md

## Project

Snap Store Updates — a Cloudflare Worker that tracks changes in the Canonical Snap Store.
Live at https://snapupdates.popey.com

## Key Commands

- `cd snap-worker && npm run dev` — local dev server (builds CSS + starts wrangler)
- `cd snap-worker && npm run deploy` — deploy to Cloudflare (builds CSS + wrangler deploy)
- `cd snap-worker && npm test` — run tests (scaffolding only, not yet real coverage)
- `cd snap-worker && npx tsc --noEmit` — type-check
- `cd snap-worker && npm run build:css` — compile Vanilla Framework SCSS to public/vanilla.min.css

## Architecture

- Single-file worker: `snap-worker/src/index.ts` (all routes, sync logic, HTML generation)
- Theme: Canonical's Vanilla Framework, compiled from SCSS via `sass`, served as static asset
- Database: Cloudflare D1 (SQLite-compatible), schema in `snap-worker/schema.sql`
- Cron: every 15 minutes, syncs the full catalogue from the Snap Store API in a single pass (~43s)
- Cron: daily at 3am UTC, syncs snap-to-section mappings from the Snap Store sections API
- `/api/sync` and `/api/sync-sections` require `Authorization: Bearer <SYNC_SECRET>` (secret set via `wrangler secret put`)

## Local Development

- `cd snap-worker && npx wrangler d1 execute snap-catalogue --local --file=schema.sql` — apply schema to local D1
- To copy production data locally: `npx wrangler d1 export snap-catalogue --remote --output=snapshot.sql` then `npx wrangler d1 execute snap-catalogue --local --file=snapshot.sql` (delete snapshot.sql after)
- Local and remote D1 are completely separate — local changes cannot affect production

## Data Import

- `node snap-worker/scripts/import-delta.js <db-path>` — fast local D1 import (uses better-sqlite3 directly)
- `node snap-worker/scripts/migrate.js <db-path> remote` — remote D1 import via CF API (needs CF_ACCOUNT_ID, CF_DATABASE_ID, CF_API_TOKEN)

## OG Image Generation

- `node snap-worker/scripts/generate-og-image.js <path-to-local-d1-sqlite>` — generates `public/og-default.png` (1200x630 collage of desaturated snap icons with text overlay). Requires `sharp` and `better-sqlite3` (both dev dependencies). Run locally when you want to refresh the image.

## Pages

- `/` — homepage with sortable Recent Changes table (click Snap/When headers to sort, click again to reverse)
- `/new` — new snaps in the last 30 days
- `/updated` — updated snaps in the last 30 days
- `/categories` — browse by category, `/categories/{section}` for detail (supports `?q=` filter)
- `/publishers` — top publishers, `/publisher/{name}` for detail
- `/snap/{name}` — snap detail with screenshots, version history (with revision numbers, flip-flop collapsing), metadata
- `/search?q=` — full-text search
- `/about` — about page with feature overview and contact link
- `/sitemap.xml` — dynamic sitemap (all snaps, publishers, categories; cached 1 hour)

## RSS Feeds

- `/rss` — all changes (default)
- `/new/rss`, `/updated/rss` — filtered by change type
- `/snap/{name}/rss` — per snap
- `/publisher/{name}/rss` — per publisher
- `/categories/{section}/rss` — per category
- Each HTML page references its relevant feed via `<link rel="alternate">` and the nav RSS link is context-aware

## Conventions

- All changes must be tested locally before deploying (see BACKLOG.md Process section)
- All dates displayed with UTC suffix
- HTML pages use no client-side JavaScript (except nav toggle)
- Deduplication on list pages via ROW_NUMBER() window functions
- Sync detects and suppresses API flip-flops (architecture oscillation) by comparing against previous history entry
- Display-side dedup: exact duplicate history entries filtered out, consecutive flip-flop pairs collapsed
- Version history shows revision numbers alongside versions; same-version revision bumps displayed as `149.0-1 8030 → 8054`
- Sync uses D1 `batch()` for DB writes (chunked to 80 statements), PAGE_SIZE=250
- HTML responses cached 5 minutes (`Cache-Control: public, max-age=300`), RSS cached 1 hour
- OpenGraph + Twitter Card meta tags on all pages; snap pages use snap icon, others use generated collage
