#!/usr/bin/env node

/**
 * Delta import: merge a source SQLite DB into the local D1 SQLite file.
 * Usage: node scripts/import-delta.js <source-db-path>
 */

import Database from 'better-sqlite3';
import { readdirSync } from 'fs';
import { join } from 'path';

const SOURCE_PATH = process.argv[2];
if (!SOURCE_PATH) {
	console.error('Usage: node scripts/import-delta.js <source-db-path>');
	process.exit(1);
}

// Find the local D1 SQLite file
const d1Dir = join(import.meta.dirname, '..', '.wrangler', 'state', 'v3', 'd1', 'miniflare-D1DatabaseObject');
const d1Files = readdirSync(d1Dir).filter(f => f.endsWith('.sqlite'));
if (d1Files.length === 0) {
	console.error('No local D1 database found. Run `npm run dev` first to initialise it.');
	process.exit(1);
}
const D1_PATH = join(d1Dir, d1Files[0]);

function log(msg) {
	console.log(`[${new Date().toISOString()}] ${msg}`);
}

log(`Source: ${SOURCE_PATH}`);
log(`Target: ${D1_PATH}`);

const src = new Database(SOURCE_PATH, { readonly: true });
const dst = new Database(D1_PATH);

// Check if source has 'origin' column
const srcCols = src.pragma('table_info(snaps)').map(c => c.name);
const hasOrigin = srcCols.includes('origin');

// --- sync_runs ---
log('Importing sync_runs...');
const srcRuns = src.prepare('SELECT * FROM sync_runs WHERE status = ?').all('completed');
const insertRun = dst.prepare(`INSERT OR IGNORE INTO sync_runs (id, started_at, completed_at, total_snaps, new_snaps, updated_snaps, status) VALUES (?, ?, ?, ?, ?, ?, ?)`);
const runTx = dst.transaction((runs) => {
	for (const r of runs) {
		insertRun.run(r.id, r.started_at, r.completed_at, r.total_snaps, r.new_snaps, r.updated_snaps, r.status);
	}
});
runTx(srcRuns);
log(`  ${srcRuns.length} sync_runs processed`);

// --- snaps (upsert) ---
log('Importing snaps...');
const srcSnaps = src.prepare('SELECT * FROM snaps').all();
const upsertSnap = dst.prepare(`INSERT INTO snaps (
	snap_id, package_name, title, summary, description, publisher,
	developer_id, origin, developer_validation, icon_url, version, revision,
	confinement, license, base, date_published, last_updated,
	first_seen_at, last_seen_at, last_changed_at, raw_json
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(snap_id) DO UPDATE SET
	title=excluded.title, summary=excluded.summary, description=excluded.description,
	publisher=excluded.publisher, origin=excluded.origin, icon_url=excluded.icon_url,
	version=excluded.version, revision=excluded.revision,
	last_updated=excluded.last_updated, last_seen_at=excluded.last_seen_at,
	last_changed_at=excluded.last_changed_at, raw_json=excluded.raw_json`);

const snapTx = dst.transaction((snaps) => {
	for (const s of snaps) {
		let origin = hasOrigin ? s.origin : null;
		if (!origin && s.raw_json) {
			try { origin = JSON.parse(s.raw_json).origin || null; } catch { /* ignore */ }
		}
		upsertSnap.run(
			s.snap_id, s.package_name, s.title, s.summary, s.description, s.publisher,
			s.developer_id, origin, s.developer_validation, s.icon_url, s.version, s.revision,
			s.confinement, s.license, s.base, s.date_published, s.last_updated,
			s.first_seen_at, s.last_seen_at, s.last_changed_at, s.raw_json
		);
	}
});
snapTx(srcSnaps);
log(`  ${srcSnaps.length} snaps upserted`);

// --- snap_history ---
log('Importing snap_history...');
const srcHistory = src.prepare('SELECT * FROM snap_history ORDER BY id').all();
const insertHistory = dst.prepare(`INSERT OR IGNORE INTO snap_history (
	snap_id, sync_run_id, change_type, old_version, new_version,
	old_revision, new_revision, old_last_updated, new_last_updated,
	changed_fields, old_values, new_values, recorded_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

const BATCH = 5000;
for (let i = 0; i < srcHistory.length; i += BATCH) {
	const batch = srcHistory.slice(i, i + BATCH);
	const histTx = dst.transaction((rows) => {
		for (const h of rows) {
			insertHistory.run(
				h.snap_id, h.sync_run_id, h.change_type, h.old_version, h.new_version,
				h.old_revision, h.new_revision, h.old_last_updated, h.new_last_updated,
				h.changed_fields, h.old_values, h.new_values, h.recorded_at
			);
		}
	});
	histTx(batch);
	log(`  ${Math.min(i + BATCH, srcHistory.length)}/${srcHistory.length} history rows`);
}

// --- verify ---
const snapCount = dst.prepare('SELECT COUNT(*) as c FROM snaps').get();
const histCount = dst.prepare('SELECT COUNT(*) as c FROM snap_history').get();
log(`Done! D1 now has ${snapCount.c} snaps, ${histCount.c} history entries`);

src.close();
dst.close();
