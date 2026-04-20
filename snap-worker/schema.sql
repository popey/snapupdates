-- Snap Store Catalogue D1 Schema
-- Based on existing SQLite schema from snap_catalogue.py

-- Sync runs - track when we synced
CREATE TABLE IF NOT EXISTS sync_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at TEXT NOT NULL,
    completed_at TEXT,
    total_snaps INTEGER,
    new_snaps INTEGER,
    updated_snaps INTEGER,
    status TEXT DEFAULT 'running'
);

-- Snaps - current state of each snap
CREATE TABLE IF NOT EXISTS snaps (
    snap_id TEXT PRIMARY KEY,
    package_name TEXT UNIQUE NOT NULL,
    title TEXT,
    summary TEXT,
    description TEXT,
    publisher TEXT,
    developer_id TEXT,
    origin TEXT,
    developer_validation TEXT,
    icon_url TEXT,
    version TEXT,
    revision INTEGER,
    confinement TEXT,
    license TEXT,
    base TEXT,
    date_published TEXT,
    last_updated TEXT,
    first_seen_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    last_changed_at TEXT,
    raw_json TEXT
);

-- Snap history - track changes over time
CREATE TABLE IF NOT EXISTS snap_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    snap_id TEXT NOT NULL,
    sync_run_id INTEGER NOT NULL,
    change_type TEXT NOT NULL,
    old_version TEXT,
    new_version TEXT,
    old_revision INTEGER,
    new_revision INTEGER,
    old_last_updated TEXT,
    new_last_updated TEXT,
    changed_fields TEXT,
    old_values TEXT,
    new_values TEXT,
    recorded_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (snap_id) REFERENCES snaps(snap_id),
    FOREIGN KEY (sync_run_id) REFERENCES sync_runs(id)
);

-- Snap sections - maps snaps to store categories
CREATE TABLE IF NOT EXISTS snap_sections (
    snap_id TEXT NOT NULL,
    section TEXT NOT NULL,
    synced_at TEXT NOT NULL,
    PRIMARY KEY (snap_id, section),
    FOREIGN KEY (snap_id) REFERENCES snaps(snap_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_snaps_name ON snaps(package_name);
CREATE INDEX IF NOT EXISTS idx_snaps_publisher ON snaps(developer_id);
CREATE INDEX IF NOT EXISTS idx_snaps_validation ON snaps(developer_validation);
CREATE INDEX IF NOT EXISTS idx_snaps_first_seen ON snaps(first_seen_at);
CREATE INDEX IF NOT EXISTS idx_snaps_last_changed ON snaps(last_changed_at);
CREATE INDEX IF NOT EXISTS idx_history_snap ON snap_history(snap_id);
CREATE INDEX IF NOT EXISTS idx_history_run ON snap_history(sync_run_id);
CREATE INDEX IF NOT EXISTS idx_history_type ON snap_history(change_type);
CREATE INDEX IF NOT EXISTS idx_history_recorded ON snap_history(recorded_at);
CREATE INDEX IF NOT EXISTS idx_sections_section ON snap_sections(section);
CREATE INDEX IF NOT EXISTS idx_sections_snap ON snap_sections(snap_id);
