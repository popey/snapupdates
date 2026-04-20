#!/usr/bin/env node

import Database from 'better-sqlite3';
import { execSync, spawnSync } from 'child_process';

const OLD_DB_PATH = process.argv[2] || './snap_catalogue.db';
const BATCH_SIZE = 100;

function log(msg) {
	console.log(`[${new Date().toISOString()}] ${msg}`);
}

function runWrangler(sql, params = []) {
	const args = ['d1', 'execute', 'snap-catalogue', '--local', '--command', sql];
	if (params.length > 0) {
		params.forEach(p => args.push('--param', p === null ? 'NULL' : String(p)));
	}
	try {
		const result = spawnSync('npx', args, { 
			encoding: 'utf8',
			stdio: ['pipe', 'pipe', 'pipe']
		});
		if (result.status !== 0) {
			throw new Error(result.stderr || result.stdout);
		}
		return result.stdout;
	} catch (e) {
		throw new Error(`Wrangler failed: ${e.message}`);
	}
}

function migrateToLocalD1(oldDb) {
	log('Starting migration to local D1...');

	log('Migrating sync_runs...');
	const syncRuns = oldDb.prepare('SELECT * FROM sync_runs WHERE status = ?').all('completed');
	log(`Found ${syncRuns.length} sync runs`);

	for (const run of syncRuns) {
		const sql = `INSERT OR IGNORE INTO sync_runs (id, started_at, completed_at, total_snaps, new_snaps, updated_snaps, status) VALUES (?, ?, ?, ?, ?, ?, ?)`;
		const params = [run.id, run.started_at, run.completed_at, run.total_snaps, run.new_snaps, run.updated_snaps, run.status];
		try {
			runWrangler(sql, params);
		} catch (e) {
			if (!e.message.includes('UNIQUE')) {
				console.error(`Error syncing run ${run.id}: ${e.message}`);
			}
		}
	}
	log(`Migrated ${syncRuns.length} sync_runs`);

	log('Migrating snaps...');
	const allSnaps = oldDb.prepare('SELECT * FROM snaps').all();
	log(`Found ${allSnaps.length} snaps`);

	for (const snap of allSnaps) {
		const origin = snap.raw_json ? (() => { try { return JSON.parse(snap.raw_json).origin || null; } catch { return null; } })() : null;
		const sql = `INSERT INTO snaps (
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
			last_changed_at=excluded.last_changed_at, raw_json=excluded.raw_json`;
		const params = [
			snap.snap_id, snap.package_name, snap.title, snap.summary, snap.description, snap.publisher,
			snap.developer_id, origin, snap.developer_validation, snap.icon_url, snap.version, snap.revision,
			snap.confinement, snap.license, snap.base, snap.date_published, snap.last_updated,
			snap.first_seen_at, snap.last_seen_at, snap.last_changed_at, snap.raw_json
		];
		try {
			runWrangler(sql, params);
		} catch (e) {
			console.error(`Error snap ${snap.package_name}: ${e.message}`);
		}
	}
	log(`Migrated ${allSnaps.length} snaps`);

	log('Migrating snap_history...');
	const allHistory = oldDb.prepare('SELECT * FROM snap_history ORDER BY id').all();
	log(`Found ${allHistory.length} history entries`);

	for (let i = 0; i < allHistory.length; i += BATCH_SIZE) {
		const batch = allHistory.slice(i, i + BATCH_SIZE);
		const values = batch.map(h => [
			h.snap_id, h.sync_run_id, h.change_type, h.old_version, h.new_version,
			h.old_revision, h.new_revision, h.old_last_updated, h.new_last_updated,
			h.changed_fields, h.old_values, h.new_values, h.recorded_at
		]);
		
		const placeholders = values.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
		const flatValues = values.flat();
		const sql = `INSERT OR IGNORE INTO snap_history (
			snap_id, sync_run_id, change_type, old_version, new_version,
			old_revision, new_revision, old_last_updated, new_last_updated,
			changed_fields, old_values, new_values, recorded_at
		) VALUES ${placeholders}`;
		
		try {
			runWrangler(sql, flatValues);
		} catch (e) {
			console.error(`Batch error at ${i}: ${e.message}`);
		}

		if ((i + BATCH_SIZE) % 1000 === 0 || i + BATCH_SIZE >= allHistory.length) {
			log(`  Progress: ${Math.min(i + BATCH_SIZE, allHistory.length)}/${allHistory.length}`);
		}
	}

	log('Migration complete!');
}

async function migrateToRemoteD1(accountId, databaseId, authToken, oldDb) {
	const baseUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}`;
	
	const headers = {
		'Authorization': `Bearer ${authToken}`,
		'Content-Type': 'application/json'
	};

	async function runQuery(sql, params = []) {
		const response = await fetch(`${baseUrl}/query`, {
			method: 'POST',
			headers,
			body: JSON.stringify({ sql, params })
		});
		const data = await response.json();
		if (!response.ok) {
			throw new Error(data.errors?.[0]?.message || 'Query failed');
		}
		return data;
	}

	log('Starting migration to remote D1...');

	log('Migrating sync_runs...');
	const syncRuns = oldDb.prepare('SELECT * FROM sync_runs WHERE status = ?').all('completed');
	log(`Found ${syncRuns.length} sync runs`);

	for (const run of syncRuns) {
		try {
			await runQuery(
				`INSERT OR IGNORE INTO sync_runs (id, started_at, completed_at, total_snaps, new_snaps, updated_snaps, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
				[run.id, run.started_at, run.completed_at, run.total_snaps, run.new_snaps, run.updated_snaps, run.status]
			);
		} catch (e) {
			if (!e.message.includes('UNIQUE')) console.error(`Error: ${e.message}`);
		}
	}
	log(`Migrated ${syncRuns.length} sync_runs`);

	log('Migrating snaps...');
	const allSnaps = oldDb.prepare('SELECT * FROM snaps').all();
	log(`Found ${allSnaps.length} snaps`);

	for (const snap of allSnaps) {
		const origin = snap.raw_json ? (() => { try { return JSON.parse(snap.raw_json).origin || null; } catch { return null; } })() : null;
		try {
			await runQuery(
				`INSERT INTO snaps (
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
					last_changed_at=excluded.last_changed_at, raw_json=excluded.raw_json`,
				[snap.snap_id, snap.package_name, snap.title, snap.summary, snap.description, snap.publisher,
					snap.developer_id, origin, snap.developer_validation, snap.icon_url, snap.version, snap.revision,
					snap.confinement, snap.license, snap.base, snap.date_published, snap.last_updated,
					snap.first_seen_at, snap.last_seen_at, snap.last_changed_at, snap.raw_json]
			);
		} catch (e) {
			console.error(`Error: ${e.message}`);
		}
	}
	log(`Migrated ${allSnaps.length} snaps`);

	log('Migrating snap_history (batched)...');
	const allHistory = oldDb.prepare('SELECT * FROM snap_history ORDER BY id').all();
	log(`Found ${allHistory.length} history entries`);

	for (let i = 0; i < allHistory.length; i += BATCH_SIZE) {
		const batch = allHistory.slice(i, i + BATCH_SIZE);
		const values = batch.map(h => [
			h.snap_id, h.sync_run_id, h.change_type, h.old_version, h.new_version,
			h.old_revision, h.new_revision, h.old_last_updated, h.new_last_updated,
			h.changed_fields, h.old_values, h.new_values, h.recorded_at
		]);
		
		const placeholders = values.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
		const flatValues = values.flat();
		
		try {
			await runQuery(
				`INSERT OR IGNORE INTO snap_history (
					snap_id, sync_run_id, change_type, old_version, new_version,
					old_revision, new_revision, old_last_updated, new_last_updated,
					changed_fields, old_values, new_values, recorded_at
				) VALUES ${placeholders}`,
				flatValues
			);
		} catch (e) {
			console.error(`Batch error at ${i}: ${e.message}`);
		}

		if ((i + BATCH_SIZE) % 1000 === 0 || i + BATCH_SIZE >= allHistory.length) {
			log(`  Progress: ${Math.min(i + BATCH_SIZE, allHistory.length)}/${allHistory.length}`);
		}
	}

	log('Migration complete!');
}

const command = process.argv[3] || 'local';

if (command === 'local') {
	log(`Opening old database: ${OLD_DB_PATH}`);
	const oldDb = new Database(OLD_DB_PATH, { readonly: true });
	migrateToLocalD1(oldDb);
	oldDb.close();
} else if (command === 'remote') {
	const accountId = process.env.CF_ACCOUNT_ID;
	const databaseId = process.env.CF_DATABASE_ID;
	const authToken = process.env.CF_API_TOKEN;

	if (!accountId || !databaseId || !authToken) {
		console.error('Missing environment variables: CF_ACCOUNT_ID, CF_DATABASE_ID, CF_API_TOKEN');
		process.exit(1);
	}

	log(`Opening old database: ${OLD_DB_PATH}`);
	const oldDb = new Database(OLD_DB_PATH, { readonly: true });
	migrateToRemoteD1(accountId, databaseId, authToken, oldDb).then(() => {
		oldDb.close();
		process.exit(0);
	}).catch(e => {
		console.error(e);
		oldDb.close();
		process.exit(1);
	});
} else {
	console.error(`Unknown command: ${command}`);
	console.error('Usage: node migrate.js [path-to-old-db] [local|remote]');
	process.exit(1);
}
