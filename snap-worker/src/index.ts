export interface Env {
	DB: D1Database;
	API_BASE_URL: string;
	SYNC_SECRET: string;
}

interface Snap {
	snap_id: string;
	package_name: string;
	title: string | null;
	summary: string | null;
	description: string | null;
	publisher: string | null;
	origin: string | null;
	developer_id: string | null;
	developer_validation: string | null;
	icon_url: string | null;
	version: string | null;
	revision: number | null;
	confinement: string | null;
	license: string | null;
	base: string | null;
	date_published: string | null;
	last_updated: string | null;
	first_seen_at: string;
	last_seen_at: string;
	last_changed_at: string | null;
	raw_json: string | null;
}

interface SnapHistory {
	id: number;
	snap_id: string;
	package_name: string;
	title: string | null;
	summary: string | null;
	publisher: string | null;
	origin: string | null;
	developer_validation: string | null;
	icon_url: string | null;
	change_type: string;
	old_version: string | null;
	new_version: string | null;
	old_revision: number | null;
	new_revision: number | null;
	changed_fields: string | null;
	recorded_at: string;
	date_published: string | null;
	new_last_updated: string | null;
	old_last_updated: string | null;
}

interface ApiSnap {
	snap_id: string;
	package_name: string;
	title?: string;
	summary?: string;
	description?: string;
	publisher?: string;
	origin?: string;
	developer_id: string;
	developer_validation?: string;
	icon_url?: string;
	version?: string;
	revision?: number;
	confinement?: string;
	license?: string;
	base?: string;
	date_published?: string;
	last_updated?: string;
}

interface ApiResponse {
	_embedded?: {
		'clickindex:package': ApiSnap[];
	};
}

// ============================================================================
// Utilities
// ============================================================================

function escapeHtml(text: string | null | undefined): string {
	if (!text) return '';
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
}

function safeHref(url: string | undefined): string | undefined {
	return url && /^https?:\/\//i.test(url) ? url : undefined;
}

function renderMarkdown(text: string | null | undefined): string {
	if (!text) return '';
	const escaped = escapeHtml(text);
	const withLists = escaped
		.replace(/^   (.*)$/gm, '<pre><code>$1</code></pre>')
		.replace(/`([^`]+)`/g, '<code>$1</code>')
		.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
		.replace(/_([^_]+)_/g, '<em>$1</em>')
		.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>')
		.replace(/^\* (.*)$/gm, '<li>$1</li>');
	const listGroups = withLists.match(/((?:<li>.*?<\/li>\n?)+)/g) || [];
	let result = withLists;
	for (const group of listGroups) {
		result = result.replace(group, `<ul>${group.replace(/\n$/, '')}</ul>`);
	}
	return result
		.replace(/\n\n+/g, '<br><br>')
		.replace(/\n(?!\s*(<ul|<\/ul>|<li|<pre|<code|<a|$))/g, '<br>');
}

function formatDate(dateStr: string | null | undefined): string {
	if (!dateStr) return 'Unknown';
	try {
		const date = new Date(dateStr);
		return date.toLocaleDateString('en-GB', {
			day: 'numeric',
			month: 'short',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
			timeZone: 'UTC',
		}) + ' UTC';
	} catch {
		return dateStr;
	}
}

function timeAgo(dateStr: string | null | undefined): string {
	if (!dateStr) return '';
	try {
		const date = new Date(dateStr);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
		const weeks = Math.floor(diffDays / 7);
		const months = Math.floor(diffDays / 30);
		const years = Math.floor(diffDays / 365);

		if (diffDays === 0) {
			const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
			const diffMins = Math.floor(diffMs / (1000 * 60));
			if (diffMins < 1) return 'Just now';
			if (diffMins < 60) return `${diffMins} min${diffMins === 1 ? '' : 's'} ago`;
			return `${diffHrs} hr${diffHrs === 1 ? '' : 's'} ago`;
		}
		if (diffDays === 1) return 'Yesterday';
		if (diffDays < 7) return `${diffDays} days ago`;
		if (diffDays < 30) return `${weeks} wk${weeks === 1 ? '' : 's'} ago`;
		if (diffDays < 365) return `${months} mo${months === 1 ? '' : 's'} ago`;
		return `${years} yr${years === 1 ? '' : 's'} ago`;
	} catch {
		return dateStr;
	}
}

function snapIcon(url: string | null | undefined, size: 'small' | 'large' | 'hero' = 'small'): string {
	const cls = size === 'hero' ? 'snap-icon snap-icon--hero' : size === 'large' ? 'snap-icon snap-icon--large' : 'snap-icon';
	if (url) {
		return `<img src="${escapeHtml(url)}" alt="" class="${cls}" loading="lazy">`;
	}
	const d = size === 'hero' ? 96 : size === 'large' ? 48 : 32;
	const r = Math.round(d / 8);
	return `<svg class="${cls}" viewBox="0 0 ${d} ${d}" xmlns="http://www.w3.org/2000/svg"><rect width="${d}" height="${d}" rx="${r}" fill="#e5e5e5"/><text x="50%" y="56%" dominant-baseline="middle" text-anchor="middle" fill="#999" font-size="${Math.round(d * 0.35)}">&#128230;</text></svg>`;
}

function publisherBadge(validation: string | null | undefined, size: 'small' | 'large' = 'small'): string {
	const d = size === 'large' ? 24 : 14;
	if (validation === 'starred') {
		return ` <img src="https://assets.ubuntu.com/v1/d810dee9-Orange+Star.svg" alt="Star developer" width="${d}" height="${d}" style="vertical-align:-1px">`;
	}
	if (validation === 'verified') {
		return ` <img src="https://assets.ubuntu.com/v1/ba8a4b7b-Verified.svg" alt="Verified account" width="${d}" height="${d}" style="vertical-align:-1px">`;
	}
	return '';
}

// ============================================================================
// Shared Layout (Vanilla Framework)
// ============================================================================

const VANILLA_CSS = '/vanilla.min.css';

function renderLayout(title: string, content: string, activePage: string = '', rssHref: string = '/rss', rssTitle: string = 'Snap Store Updates RSS', meta: { description?: string; image?: string; url?: string; twitterCard?: string; baseUrl?: string } = {}): string {
	const ogDescription = meta.description || 'Tracking changes in the Canonical Snap Store';
	const ogImage = meta.image || '/og-default.png';
	const ogType = 'website';
	const twitterCard = meta.twitterCard || 'summary_large_image';
	const navItems = [
		{ id: 'recent', label: 'Recent', href: '/' },
		{ id: 'new', label: 'New Snaps', href: '/new' },
		{ id: 'updated', label: 'Updated', href: '/updated' },
		{ id: 'search', label: 'Search', href: '/search' },
		{ id: 'publishers', label: 'Publishers', href: '/publishers' },
		{ id: 'categories', label: 'Categories', href: '/categories' },
	];

	return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(ogDescription)}">
  <meta property="og:image" content="${escapeHtml(ogImage)}">
  ${meta.url ? `<meta property="og:url" content="${escapeHtml(meta.url)}">` : ''}
  <meta property="og:type" content="${ogType}">
  <meta property="og:site_name" content="Snap Store Updates">
  <meta property="og:logo" content="${meta.baseUrl || ''}/logo.png">
  <meta name="twitter:card" content="${twitterCard}">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(ogDescription)}">
  <meta name="twitter:image" content="${escapeHtml(ogImage)}">
  <meta name="description" content="${escapeHtml(ogDescription)}">
  <link rel="stylesheet" href="${VANILLA_CSS}" />
  <link rel="alternate" type="application/rss+xml" title="${escapeHtml(rssTitle)}" href="${rssHref}">
  <style>
    .snap-icon { width: 2rem; height: 2rem; border-radius: .25rem; vertical-align: middle; margin-right: .5rem; }
    .snap-icon--large { width: 3rem; height: 3rem; border-radius: .375rem; }
    .snap-icon--hero { width: 6rem; height: 6rem; border-radius: .5rem; }
    .snap-badge { display: inline-block; padding: 2px 10px; border-radius: 14px; font-size: .875rem; }
    .snap-badge--new { background: #0e8420; color: #fff; }
    .snap-badge--updated { background: #24598f; color: #fff; }
    .snap-header { display: flex; gap: 1.5rem; align-items: flex-start; }
    .snap-card-inner { display: flex; gap: .75rem; align-items: flex-start; }
    .snap-links a { display: inline-block; padding: .375rem .75rem; background: #f7f7f7; border-radius: .25rem; font-size: .875rem; text-decoration: none; margin: .25rem .25rem .25rem 0; }
    .snap-links a:hover { background: #e5e5e5; }
    .stat-bar { display: flex; gap: 1.5rem; flex-wrap: wrap; padding: .5rem 0; font-size: .875rem; color: #666; }
    .stat-bar strong { color: #111; font-weight: 400; }
    .stat-bar .stat-positive { color: #0e8420; }
    .history-entry { padding: .5rem 0; border-bottom: 1px solid #e5e5e5; }
    .history-entry:last-child { border-bottom: none; }
    .history-entry .history-version { word-break: break-word; }
    .history-entry .history-date { font-size: .875rem; color: #666; }
    .meta-label { display: block; font-size: .75rem; text-transform: uppercase; letter-spacing: .04em; color: #666; margin-bottom: .25rem; }
    @media (max-width: 772px) {
      .p-navigation__nav { display: flex !important; flex-direction: column; }
      .snap-header { flex-direction: column; }
      .snap-icon--hero { width: 4rem; height: 4rem; }
    }
  </style>
</head>
<body>
  <header id="navigation" class="p-navigation is-dark">
    <div class="p-navigation__row--25-75">
      <div class="p-navigation__banner">
        <div class="p-navigation__tagged-logo">
          <a class="p-navigation__link" href="/">
            <span class="p-navigation__logo-title">Snap Store Updates</span>
          </a>
        </div>
        <ul class="p-navigation__items">
          <li class="p-navigation__item">
            <button class="p-navigation__toggle--open js-menu-button">Menu</button>
            <button class="p-navigation__toggle--close js-menu-button">Close</button>
          </li>
        </ul>
      </div>
      <nav class="p-navigation__nav" aria-label="Main">
        <ul class="p-navigation__items">
          ${navItems.map(item => `<li class="p-navigation__item${activePage === item.id ? ' is-selected' : ''}"><a class="p-navigation__link" href="${item.href}">${item.label}</a></li>`).join('\n          ')}
        </ul>
        <ul class="p-navigation__items">
          <li class="p-navigation__item"><a class="p-navigation__link" href="${rssHref}">RSS</a></li>
        </ul>
      </nav>
    </div>
  </header>

  <main>${content}</main>

  <footer class="p-strip is-shallow">
    <div class="row">
      <div class="col-12 u-align-text--center">
        <p style="color:#666">
          Not affiliated with Canonical or Snapcraft.io. Data sourced from the public
          <a href="https://snapcraft.io">Snap Store</a> API.
          <a href="/about">About</a>
        </p>
      </div>
    </div>
  </footer>
  <script>document.querySelectorAll('.js-menu-button').forEach(function(b){b.addEventListener('click',function(){document.getElementById('navigation').classList.toggle('has-menu-open')})})</script>
</body>
</html>`;
}

// ============================================================================
// Pagination Helper
// ============================================================================

function renderPagination(page: number, totalPages: number, baseUrl: string): string {
	if (totalPages <= 1) return '';
	const getUrl = (p: number) => {
		if (p === 1) return baseUrl.includes('?') ? baseUrl : baseUrl;
		const sep = baseUrl.includes('?') ? '&' : '?';
		return `${baseUrl}${sep}page=${p}`;
	};

	const items: string[] = [];
	if (page > 1) {
		items.push(`<li class="p-pagination__item"><a class="p-pagination__link--previous" href="${getUrl(page - 1)}"><i class="p-icon--chevron-down">Previous page</i></a></li>`);
	}
	const start = Math.max(1, page - 2);
	const end = Math.min(totalPages, page + 2);
	if (start > 1) {
		items.push(`<li class="p-pagination__item"><a class="p-pagination__link" href="${getUrl(1)}" aria-label="Page 1">1</a></li>`);
		if (start > 2) items.push(`<li class="p-pagination__item">&hellip;</li>`);
	}
	for (let i = start; i <= end; i++) {
		if (i === page) {
			items.push(`<li class="p-pagination__item"><a class="p-pagination__link is-active" href="${getUrl(i)}" aria-current="page" aria-label="Page ${i}">${i}</a></li>`);
		} else {
			items.push(`<li class="p-pagination__item"><a class="p-pagination__link" href="${getUrl(i)}" aria-label="Page ${i}">${i}</a></li>`);
		}
	}
	if (end < totalPages) {
		if (end < totalPages - 1) items.push(`<li class="p-pagination__item">&hellip;</li>`);
		items.push(`<li class="p-pagination__item"><a class="p-pagination__link" href="${getUrl(totalPages)}" aria-label="Page ${totalPages}">${totalPages}</a></li>`);
	}
	if (page < totalPages) {
		items.push(`<li class="p-pagination__item"><a class="p-pagination__link--next" href="${getUrl(page + 1)}"><i class="p-icon--chevron-down">Next page</i></a></li>`);
	}

	return `<div class="row"><div class="col-12 u-align-text--center"><nav class="p-pagination" style="justify-content:center" aria-label="Pagination"><ol class="p-pagination__items">${items.join('\n')}</ol></nav></div></div>`;
}

// ============================================================================
// Sync Logic
// ============================================================================

async function syncSnaps(env: Env): Promise<{ new: number; updated: number; total: number }> {
	const API_BASE = env.API_BASE_URL || 'https://api.snapcraft.io/api/v1/snaps/search';
	const PAGE_SIZE = 250;
	const DB_BATCH_SIZE = 80;
	const RETRY_DELAYS = [1000, 2000, 4000, 8000];

	let newSnaps = 0;
	let updatedSnaps = 0;
	const now = new Date().toISOString();

	// Mark any stale "running" entries as timed out (Worker was likely killed)
	await env.DB
		.prepare("UPDATE sync_runs SET status = 'timed_out', completed_at = started_at WHERE status = 'running' AND started_at < datetime('now', '-15 minutes')")
		.run();

	const syncRunResult = await env.DB
		.prepare('INSERT INTO sync_runs (started_at, status) VALUES (?, ?)')
		.bind(now, 'running')
		.run();
	const syncRunId: number = Number(syncRunResult.meta.last_row_id) || 1;

	try {
	// Bulk-read all existing snaps into a Map (one query instead of ~7300 individual SELECTs)
	const existingRows = await env.DB
		.prepare('SELECT snap_id, version, revision, last_updated, last_changed_at FROM snaps')
		.all();
	const existingSnaps = new Map<string, Record<string, unknown>>();
	for (const row of existingRows.results) {
		existingSnaps.set(row.snap_id as string, row as Record<string, unknown>);
	}

	// Preload last history entry per snap to detect flip-flops (API returning alternating arch results)
	const lastHistoryRows = await env.DB
		.prepare(`SELECT snap_id, old_version, old_revision FROM snap_history
			WHERE id IN (SELECT MAX(id) FROM snap_history WHERE change_type = 'updated' GROUP BY snap_id)`)
		.all();
	const lastHistory = new Map<string, { old_version: string | null; old_revision: number | null }>();
	for (const row of lastHistoryRows.results) {
		lastHistory.set(row.snap_id as string, {
			old_version: row.old_version as string | null,
			old_revision: row.old_revision as number | null,
		});
	}

	const seenSnapIds = new Set<string>();
	const headers: Record<string, string> = { 'Snap-Device-Series': '16' };
	let page = 0;
	let nextUrl: string | null = `${API_BASE}?scope=wide&confinement=strict,classic&page=${page}&size=${PAGE_SIZE}`;

	while (nextUrl) {
		let response: Response;
		let retries = 0;

		while (retries < RETRY_DELAYS.length) {
			response = await fetch(nextUrl, { headers });

			if (response.status === 429) {
				console.log(`Rate limited, waiting ${RETRY_DELAYS[retries]}ms...`);
				await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[retries]));
				retries++;
				continue;
			}

			if (!response.ok) {
				throw new Error(`API request failed: ${response.status}`);
			}
			break;
		}

		if (retries >= RETRY_DELAYS.length) {
			throw new Error(`Rate limited after ${retries} retries`);
		}

		const data: ApiResponse & { _links?: { next?: { href?: string } } } = await response!.json();
		const snaps: ApiSnap[] = data._embedded?.['clickindex:package'] || [];
		nextUrl = data._links?.next?.href || null;

		if (snaps.length === 0) {
			break;
		}

		const batch: D1PreparedStatement[] = [];

		for (const snap of snaps) {
			if (seenSnapIds.has(snap.snap_id)) {
				continue;
			}
			seenSnapIds.add(snap.snap_id);

			const snapData = {
				snap_id: snap.snap_id ?? null,
				package_name: snap.package_name ?? null,
				title: snap.title ?? null,
				summary: snap.summary ?? null,
				description: snap.description ?? null,
				publisher: typeof snap.publisher === 'string' ? snap.publisher : null,
				developer_id: snap.developer_id ?? null,
				origin: snap.origin ?? null,
				developer_validation: snap.developer_validation ?? null,
				icon_url: snap.icon_url ?? null,
				version: snap.version ?? null,
				revision: typeof snap.revision === 'number' ? snap.revision : null,
				confinement: snap.confinement ?? null,
				license: snap.license ?? null,
				base: snap.base ?? null,
				date_published: snap.date_published ?? null,
				last_updated: snap.last_updated ?? null,
			};

			const existing = existingSnaps.get(snap.snap_id);

			if (!existing) {
				batch.push(
					env.DB
						.prepare(
							`INSERT INTO snaps (${Object.keys(snapData).join(', ')}, first_seen_at, last_seen_at, last_changed_at, raw_json)
							 VALUES (${Object.keys(snapData).map(() => '?').join(', ')}, ?, ?, ?, ?)`
						)
						.bind(...Object.values(snapData), now, now, now, JSON.stringify(snap))
				);

				batch.push(
					env.DB
						.prepare(
							`INSERT INTO snap_history (snap_id, sync_run_id, change_type, new_version, new_revision, new_last_updated, recorded_at)
							 VALUES (?, ?, 'new', ?, ?, ?, ?)`
						)
						.bind(snap.snap_id, syncRunId, snap.version ?? null, snap.revision ?? null, snap.last_updated ?? null, now)
				);

				newSnaps++;
			} else {
				const trackedFields = ['version', 'revision', 'last_updated'];
				const changedFields: string[] = [];
				const oldValues: Record<string, unknown> = {};
				const newValues: Record<string, unknown> = {};

				for (const field of trackedFields) {
					const oldVal = existing[field];
					const newVal = (snapData as Record<string, unknown>)[field];
					if (String(oldVal || '') !== String(newVal || '')) {
						changedFields.push(field);
						oldValues[field] = oldVal;
						newValues[field] = newVal;
					}
				}

				if (changedFields.length > 0) {
					// Skip flip-flops: if the "new" state matches the previous history entry's "old" state,
					// this is just the API alternating between architectures, not a real change
					const prev = lastHistory.get(snap.snap_id);
					const isFlipFlop = prev &&
						String(snap.version ?? '') === String(prev.old_version ?? '') &&
						String(snap.revision ?? '') === String(prev.old_revision ?? '');

					if (isFlipFlop) {
						batch.push(
							env.DB
								.prepare('UPDATE snaps SET last_seen_at = ? WHERE snap_id = ?')
								.bind(now, snap.snap_id)
						);
					} else {
					batch.push(
						env.DB
							.prepare(
								`UPDATE snaps SET
									version = ?, revision = ?, last_updated = ?,
									title = ?, summary = ?, publisher = ?,
									origin = ?, icon_url = ?, description = ?,
									last_seen_at = ?, last_changed_at = ?, raw_json = ?
								WHERE snap_id = ?`
							)
							.bind(
								snap.version ?? null,
								snap.revision ?? null,
								snap.last_updated ?? null,
								snap.title ?? null,
								snap.summary ?? null,
								typeof snap.publisher === 'string' ? snap.publisher : null,
								snap.origin ?? null,
								snap.icon_url ?? null,
								snap.description ?? null,
								now,
								now,
								JSON.stringify(snap),
								snap.snap_id
							)
					);

					batch.push(
						env.DB
							.prepare(
								`INSERT INTO snap_history (snap_id, sync_run_id, change_type, old_version, new_version, old_revision, new_revision, old_last_updated, new_last_updated, changed_fields, old_values, new_values, recorded_at)
								 VALUES (?, ?, 'updated', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
							)
							.bind(
								snap.snap_id,
								syncRunId,
								existing.version ?? null,
								snap.version ?? null,
								existing.revision ?? null,
								snap.revision ?? null,
								existing.last_updated ?? null,
								snap.last_updated ?? null,
								JSON.stringify(changedFields),
								JSON.stringify(oldValues),
								JSON.stringify(newValues),
								now
							)
					);

					updatedSnaps++;
					}
				} else {
					batch.push(
						env.DB
							.prepare('UPDATE snaps SET last_seen_at = ? WHERE snap_id = ?')
							.bind(now, snap.snap_id)
					);
				}
			}
		}

		// Execute DB operations in chunked batches to stay within D1 limits
		for (let i = 0; i < batch.length; i += DB_BATCH_SIZE) {
			await env.DB.batch(batch.slice(i, i + DB_BATCH_SIZE));
		}

		console.log(`Page ${page} done, ${snaps.length} snaps, ${batch.length} DB ops batched, ${seenSnapIds.size} unique total`);
		page++;

		if (nextUrl) {
			await new Promise(resolve => setTimeout(resolve, 200));
		}
	}

	const totalSnaps = seenSnapIds.size;
	const completedAt = new Date().toISOString();

	await env.DB
		.prepare('UPDATE sync_runs SET completed_at = ?, total_snaps = ?, new_snaps = ?, updated_snaps = ?, status = ? WHERE id = ?')
		.bind(completedAt, totalSnaps, newSnaps, updatedSnaps, 'completed', syncRunId)
		.run();

	return { new: newSnaps, updated: updatedSnaps, total: totalSnaps };
	} catch (error) {
		await env.DB
			.prepare('UPDATE sync_runs SET completed_at = ?, status = ? WHERE id = ?')
			.bind(new Date().toISOString(), 'failed', syncRunId)
			.run().catch(() => {});
		throw error;
	}
}

// ============================================================================
// Section Names
// ============================================================================

const SECTION_NAMES: Record<string, string> = {
	'art-and-design': 'Art and Design',
	'books-and-reference': 'Books and Reference',
	'development': 'Development',
	'devices-and-iot': 'Devices and IoT',
	'education': 'Education',
	'entertainment': 'Entertainment',
	'featured': 'Featured',
	'finance': 'Finance',
	'games': 'Games',
	'health-and-fitness': 'Health and Fitness',
	'music-and-audio': 'Music and Audio',
	'news-and-weather': 'News and Weather',
	'personalisation': 'Personalisation',
	'photo-and-video': 'Photo and Video',
	'productivity': 'Productivity',
	'science': 'Science',
	'security': 'Security',
	'server-and-cloud': 'Server and Cloud',
	'social': 'Social',
	'utilities': 'Utilities',
};

function sectionDisplayName(slug: string): string {
	return SECTION_NAMES[slug] || slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ============================================================================
// Section Sync
// ============================================================================

async function syncSections(env: Env): Promise<{ sections: number; mappings: number }> {
	const DB_BATCH_SIZE = 80;
	const RETRY_DELAYS = [1000, 2000, 4000, 8000];
	const headers: Record<string, string> = { 'Snap-Device-Series': '16' };
	const now = new Date().toISOString();

	// Fetch section list from the API
	const sectionsRes = await fetch('https://api.snapcraft.io/api/v1/snaps/sections', { headers });
	if (!sectionsRes.ok) throw new Error(`Sections API failed: ${sectionsRes.status}`);
	const sectionsData = await sectionsRes.json() as { _embedded?: { 'clickindex:sections'?: { name: string }[] } };
	const sections = sectionsData._embedded?.['clickindex:sections']?.map(s => s.name) || [];

	if (sections.length === 0) throw new Error('No sections returned from API');

	let totalMappings = 0;

	for (const section of sections) {
		let nextUrl: string | null = `https://api.snapcraft.io/api/v1/snaps/search?section=${encodeURIComponent(section)}&fields=snap_id&page=0&size=250`;
		const batch: D1PreparedStatement[] = [];

		while (nextUrl) {
			let response: Response;
			let retries = 0;

			while (retries < RETRY_DELAYS.length) {
				response = await fetch(nextUrl, { headers });
				if (response.status === 429) {
					console.log(`Rate limited on section ${section}, waiting ${RETRY_DELAYS[retries]}ms...`);
					await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[retries]));
					retries++;
					continue;
				}
				if (!response.ok) throw new Error(`Section search failed for ${section}: ${response.status}`);
				break;
			}

			if (retries >= RETRY_DELAYS.length) {
				throw new Error(`Rate limited after ${retries} retries on section ${section}`);
			}

			const data = await response!.json() as ApiResponse & { _links?: { next?: { href?: string } } };
			const snaps: ApiSnap[] = data._embedded?.['clickindex:package'] || [];
			nextUrl = data._links?.next?.href || null;

			if (snaps.length === 0) break;

			for (const snap of snaps) {
				batch.push(
					env.DB
						.prepare(
							`INSERT OR REPLACE INTO snap_sections (snap_id, section, synced_at)
							 SELECT ?, ?, ? WHERE EXISTS (SELECT 1 FROM snaps WHERE snap_id = ?)`
						)
						.bind(snap.snap_id, section, now, snap.snap_id)
				);
			}

			if (nextUrl) {
				await new Promise(resolve => setTimeout(resolve, 200));
			}
		}

		// Execute DB operations in chunked batches
		for (let i = 0; i < batch.length; i += DB_BATCH_SIZE) {
			await env.DB.batch(batch.slice(i, i + DB_BATCH_SIZE));
		}

		totalMappings += batch.length;
		console.log(`Section "${section}" done: ${batch.length} snaps`);
	}

	// Remove stale mappings (snaps removed from a section since last sync)
	await env.DB
		.prepare('DELETE FROM snap_sections WHERE synced_at < ?')
		.bind(now)
		.run();

	return { sections: sections.length, mappings: totalMappings };
}

// ============================================================================
// Version + Revision Display
// ============================================================================

function formatVersionChange(oldV: string | null, newV: string | null, oldRev: number | null, newRev: number | null): string {
	if (oldV && newV) {
		if (oldV === newV) {
			// Same version — highlight the revision change
			if (oldRev != null && newRev != null) {
				return `<code>${escapeHtml(newV)}</code> <span class="u-text--muted">${oldRev} &rarr; ${newRev}</span>`;
			}
			return `<code>${escapeHtml(newV)}</code>`;
		}
		// Different versions — show both, with revision if available
		const oldStr = oldRev != null ? `${escapeHtml(oldV)} (${oldRev})` : escapeHtml(oldV);
		const newStr = newRev != null ? `${escapeHtml(newV)} (${newRev})` : escapeHtml(newV);
		return `<code>${oldStr}</code> &rarr; <code>${newStr}</code>`;
	}
	if (newV) {
		return newRev != null ? `<code>${escapeHtml(newV)} (${newRev})</code>` : `<code>${escapeHtml(newV)}</code>`;
	}
	return '';
}

function formatSingleVersion(version: string | null, revision: number | null): string {
	if (!version) return '';
	if (revision != null) return `${escapeHtml(version)} (${revision})`;
	return escapeHtml(version);
}

// ============================================================================
// RSS Feed
// ============================================================================

function generateRSS(changes: SnapHistory[], requestUrl: URL, feedTitle = 'Snap Store Updates', feedDescription = 'Recent changes in the Snap Store', selfPath = '/rss'): string {
	const baseUrl = `${requestUrl.protocol}//${requestUrl.host}`;

	return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
    <channel>
        <title>${escapeHtml(feedTitle)}</title>
        <link>${baseUrl}</link>
        <description>${escapeHtml(feedDescription)}</description>
        <language>en-gb</language>
        <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
        <atom:link href="${baseUrl}${selfPath}" rel="self" type="application/rss+xml"/>
        ${changes
			.map(
				(change) => {
					const isNew = change.change_type === 'new';
					const changeLabel = isNew ? 'New Snap' : 'Updated';
					const versionChanged = change.old_version && change.new_version && change.old_version !== change.new_version;
					const revisionChanged = change.old_revision != null && change.new_revision != null && change.old_revision !== change.new_revision;
					const descParts = [
						`&lt;p&gt;${escapeHtml(change.publisher || 'Unknown')} ${isNew ? 'published a new snap' : 'published a snap update'}&lt;/p&gt;`,
						change.new_version ? `&lt;p&gt;Version: ${escapeHtml(change.new_version)}${change.new_revision != null ? ` (${change.new_revision})` : ''}&lt;/p&gt;` : '',
						versionChanged ? `&lt;p&gt;Updated from ${escapeHtml(change.old_version!)} to ${escapeHtml(change.new_version!)}&lt;/p&gt;` :
						revisionChanged ? `&lt;p&gt;Revision updated from ${change.old_revision} to ${change.new_revision}&lt;/p&gt;` : '',
					].filter(Boolean).join('\n                ');
					return `
        <item>
            <title>${escapeHtml(change.title || change.package_name)} - ${changeLabel}</title>
            <link>${baseUrl}/snap/${escapeHtml(change.package_name)}</link>
            <guid isPermaLink="false">${baseUrl}/snap/${escapeHtml(change.package_name)}#change-${change.id}</guid>
            <description>
                ${descParts}
            </description>
            <pubDate>${new Date(change.recorded_at).toUTCString()}</pubDate>
        </item>`}
			)
			.join('')}
    </channel>
</rss>`;
}

// ============================================================================
// Page Content Generators
// ============================================================================

function generateIndexContent(
	stats: { totalSnaps: number; newToday: number; updatedToday: number; lastSync: string | null },
	recentChanges: SnapHistory[],
	page: number,
	totalPages: number,
	sort: 'snap' | 'when' = 'when',
	sortDesc: boolean = true
): string {
	// Clicking the active column toggles direction; clicking the other column uses its default (snap=asc, when=desc)
	const snapHref = sort === 'snap' ? (sortDesc ? '/?sort=snap' : '/?sort=-snap') : '/?sort=snap';
	const whenHref = sort === 'when' ? (sortDesc ? '/?sort=when' : '/?sort=-when') : '/';
	const snapArrow = sort === 'snap' ? (sortDesc ? ' &#9660;' : ' &#9650;') : '';
	const whenArrow = sort === 'when' ? (sortDesc ? ' &#9660;' : ' &#9650;') : '';
	const sortParam = sort === 'when' && sortDesc ? '' : `${sortDesc ? '-' : ''}${sort}`;
	const paginationBase = sortParam ? `/?sort=${sortParam}` : '/';
	const rows = recentChanges.map(change => {
		const snapDate = change.new_last_updated || change.recorded_at;
		const oneDayAgo = new Date();
		oneDayAgo.setHours(oneDayAgo.getHours() - 24);
		const publishedDate = change.date_published ? new Date(change.date_published) : null;
		const isNewToStore = publishedDate && publishedDate > oneDayAgo;
		const badgeType = isNewToStore ? 'new' : 'updated';
		return `<tr>
              <td data-heading="Snap">${snapIcon(change.icon_url)}<a href="/snap/${escapeHtml(change.package_name)}">${escapeHtml(change.title || change.package_name)}</a><br><small><a href="/publisher/${escapeHtml(change.origin || '')}" style="color:#666">${escapeHtml(change.publisher || 'Unknown')}</a>${publisherBadge(change.developer_validation)}</small></td>
              <td data-heading="Change"><span class="snap-badge snap-badge--${badgeType}">${badgeType}</span></td>
              <td data-heading="Version"><code>${formatSingleVersion(change.new_version || change.old_version, change.new_revision)}</code></td>
              <td data-heading="When">${timeAgo(snapDate)}<br><small>${formatDate(snapDate)}</small></td>
            </tr>`;
	}).join('\n');

	return `
    <section class="p-strip--light is-shallow" style="padding:.5rem 0">
      <div class="row">
        <div class="col-12">
          <div class="stat-bar">
            <span><strong>${stats.totalSnaps.toLocaleString()}</strong> snaps tracked</span>
            <span><strong class="${stats.newToday > 0 ? 'stat-positive' : ''}">${stats.newToday}</strong> new today</span>
            <span><strong>${stats.updatedToday}</strong> updated today</span>
            <span>Synced <strong>${timeAgo(stats.lastSync)}</strong></span>
          </div>
        </div>
      </div>
    </section>

    <section class="p-strip">
      <div class="row">
        <div class="col-8">
          <h2 class="p-muted-heading">Recent Changes</h2>
        </div>
        <div class="col-4">
          <form class="p-search-box" action="/search" method="GET">
            <label class="u-off-screen" for="search">Search</label>
            <input type="search" id="search" class="p-search-box__input" name="q" placeholder="Search all snaps...">
            <button type="reset" class="p-search-box__reset"><i class="p-icon--close">Close</i></button>
            <button type="submit" class="p-search-box__button"><i class="p-icon--search">Search</i></button>
          </form>
        </div>
      </div>
      <div class="row">
        <div class="col-12">
          <table class="p-table--mobile-card" role="grid">
            <thead>
              <tr>
                <th><a href="${snapHref}" style="text-decoration:none;color:inherit">Snap${snapArrow}</a></th>
                <th>Change</th>
                <th>Version</th>
                <th><a href="${whenHref}" style="text-decoration:none;color:inherit">When${whenArrow}</a></th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          ${renderPagination(page, totalPages, paginationBase)}
        </div>
      </div>
    </section>`;
}

function generateSnapCardGrid(snaps: Snap[], heading: string, page = 1, totalPages = 1, baseUrl = '', headingSuffix = '', filterQuery = '', filterAction = ''): string {
	const filterBox = filterAction ? `
      <div class="row">
        <div class="col-8">
          <h2>${escapeHtml(heading)}${headingSuffix}</h2>
        </div>
        <div class="col-4">
          <form class="p-search-box" action="${escapeHtml(filterAction)}" method="GET">
            <input type="search" class="p-search-box__input" name="q" placeholder="Filter ${escapeHtml(heading).toLowerCase()}..." value="${escapeHtml(filterQuery)}" aria-label="Filter">
            ${filterQuery ? '<button type="reset" class="p-search-box__reset" onclick="this.form.q.value=\'\';this.form.submit()"><i class="p-icon--close">Clear</i></button>' : ''}
            <button type="submit" class="p-search-box__button"><i class="p-icon--search">Filter</i></button>
          </form>
        </div>
      </div>` : `
      <div class="row">
        <div class="col-12">
          <h2>${escapeHtml(heading)}${headingSuffix}</h2>
        </div>
      </div>`;

	if (snaps.length === 0) {
		return `
    <section class="p-strip">
      ${filterBox}
      <div class="row">
        <div class="col-12 u-align-text--center">
          <p style="padding:3rem 0;color:#666">${filterQuery ? `No snaps matching "${escapeHtml(filterQuery)}" in this category.` : 'No snaps found.'}</p>
        </div>
      </div>
    </section>`;
	}

	return `
    <section class="p-strip">
      ${filterBox}
      <div class="row">
        ${snaps.map(snap => `
        <div class="col-3 col-medium-3 col-small-4">
          <div class="p-card">
            <div class="snap-card-inner">
              ${snapIcon(snap.icon_url, 'large')}
              <div>
                <h3 class="p-heading--5 u-no-margin--bottom"><a href="/snap/${escapeHtml(snap.package_name)}">${escapeHtml(snap.title || snap.package_name)}</a></h3>
                <small><a href="/publisher/${escapeHtml(snap.origin || '')}" style="color:#666">${escapeHtml(snap.publisher || 'Unknown')}</a>${publisherBadge(snap.developer_validation)}</small>
              </div>
            </div>
            <p class="u-no-margin--bottom"><small>${escapeHtml(snap.summary || '')}</small></p>
            <p class="u-no-margin--bottom"><small><code>${escapeHtml(snap.version || '')}</code></small></p>
          </div>
        </div>`).join('')}
      </div>
      ${renderPagination(page, totalPages, baseUrl)}
    </section>`;
}

function generateUpdatedContent(changes: SnapHistory[], page = 1, totalPages = 1): string {
	if (changes.length === 0) {
		return `
    <section class="p-strip">
      <div class="row">
        <div class="col-12 u-align-text--center">
          <p style="padding:3rem 0;color:#666">No updated snaps found in the last 30 days.</p>
        </div>
      </div>
    </section>`;
	}

	return `
    <section class="p-strip">
      <div class="row">
        <div class="col-12">
          <h2>Updated snaps in the last 30 days</h2>
        </div>
      </div>
      <div class="row">
        ${changes.map(change => `
        <div class="col-3 col-medium-3 col-small-4">
          <div class="p-card">
            <div class="snap-card-inner">
              ${snapIcon(change.icon_url, 'large')}
              <div>
                <h3 class="p-heading--5 u-no-margin--bottom"><a href="/snap/${escapeHtml(change.package_name)}">${escapeHtml(change.title || change.package_name)}</a></h3>
                <small><a href="/publisher/${escapeHtml(change.origin || '')}" style="color:#666">${escapeHtml(change.publisher || 'Unknown')}</a>${publisherBadge(change.developer_validation)}</small>
              </div>
            </div>
            <p class="u-no-margin--bottom"><small>${formatVersionChange(change.old_version, change.new_version, change.old_revision, change.new_revision)}</small></p>
            <p class="u-no-margin--bottom"><small style="color:#666">${timeAgo(change.new_last_updated)}</small></p>
          </div>
        </div>`).join('')}
      </div>
      ${renderPagination(page, totalPages, '/updated')}
    </section>`;
}

function generateSearchContent(query: string, results: Snap[]): string {
	return `
    <section class="p-strip">
      <div class="row">
        <div class="col-12">
          <h2>Search Snaps</h2>
        </div>
      </div>
      <div class="row">
        <div class="col-6 col-medium-4">
          <form class="p-search-box" action="/search" method="GET">
            <label class="u-off-screen" for="search">Search</label>
            <input type="search" id="search" class="p-search-box__input" name="q" value="${escapeHtml(query)}" placeholder="Search by name, publisher, or description..." autofocus>
            <button type="reset" class="p-search-box__reset"><i class="p-icon--close">Close</i></button>
            <button type="submit" class="p-search-box__button"><i class="p-icon--search">Search</i></button>
          </form>
        </div>
      </div>
      ${results.length > 0 ? `
      <div class="row">
        <div class="col-12">
          <p style="color:#666">${results.length} result${results.length === 1 ? '' : 's'} for &ldquo;${escapeHtml(query)}&rdquo;</p>
        </div>
      </div>
      <div class="row">
        ${results.map(snap => `
        <div class="col-6 col-medium-3 col-small-4">
          <div class="p-card">
            <div class="snap-card-inner">
              ${snapIcon(snap.icon_url, 'large')}
              <div>
                <h3 class="p-heading--5 u-no-margin--bottom"><a href="/snap/${escapeHtml(snap.package_name)}">${escapeHtml(snap.title || snap.package_name)}</a></h3>
                <p class="u-no-margin--bottom"><small>${escapeHtml(snap.summary || '')}</small></p>
                <p class="u-no-margin--bottom"><small><a href="/publisher/${escapeHtml(snap.origin || '')}" style="color:#666">${escapeHtml(snap.publisher || 'Unknown')}</a> &middot; <code>${escapeHtml(snap.version || '')}</code></small></p>
              </div>
            </div>
          </div>
        </div>`).join('')}
      </div>` : query ? `
      <div class="row">
        <div class="col-12 u-align-text--center">
          <p style="padding:3rem 0;color:#666">No snaps found for &ldquo;${escapeHtml(query)}&rdquo;</p>
        </div>
      </div>` : ''}
    </section>`;
}

function publisherSnapIcon(snap: { package_name: string; title: string | null; icon_url: string | null }): string {
	const label = escapeHtml(snap.title || snap.package_name);
	if (snap.icon_url) {
		return `<img src="${escapeHtml(snap.icon_url)}" alt="${label}" title="${label}" width="24" height="24" style="border-radius:4px" loading="lazy">`;
	}
	return `<svg title="${label}" width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>${label}</title><rect width="24" height="24" rx="3" fill="#e5e5e5"/><text x="50%" y="56%" dominant-baseline="middle" text-anchor="middle" fill="#999" font-size="9">&#128230;</text></svg>`;
}

function generatePublishersContent(
	publishers: { origin: string; publisher: string; developer_validation: string | null; count: number }[],
	iconsByOrigin: Map<string, { package_name: string; title: string | null; icon_url: string | null }[]>
): string {
	return `
    <section class="p-strip">
      <div class="row">
        <div class="col-12">
          <h2>Top Publishers</h2>
        </div>
      </div>
      <div class="row">
        ${publishers.map(p => {
			const icons = iconsByOrigin.get(p.origin) || [];
			return `
        <div class="col-3 col-medium-2 col-small-2">
          <a href="/publisher/${escapeHtml(p.origin)}" class="p-card" style="display:block;text-decoration:none;color:inherit;">
            <h3 class="p-heading--5 u-no-margin--bottom">${escapeHtml(p.publisher)}${publisherBadge(p.developer_validation)}</h3>
            <p class="u-no-margin--bottom"><small style="color:#666">${p.count} snap${p.count === 1 ? '' : 's'}</small></p>
            ${icons.length > 0 ? `<div style="display:flex;gap:4px;margin-top:0.5rem">${icons.map(s => publisherSnapIcon(s)).join('')}</div>` : ''}
          </a>
        </div>`}).join('')}
      </div>
    </section>`;
}

function generateCategoriesContent(
	categories: { section: string; count: number }[],
	iconsBySection: Map<string, { package_name: string; title: string | null; icon_url: string | null }[]>
): string {
	if (categories.length === 0) {
		return `
    <section class="p-strip">
      <div class="row">
        <div class="col-12 u-align-text--center">
          <p style="padding:3rem 0;color:#666">No categories available yet. Section sync has not run.</p>
        </div>
      </div>
    </section>`;
	}
	return `
    <section class="p-strip">
      <div class="row">
        <div class="col-12">
          <h2>Categories</h2>
        </div>
      </div>
      <div class="row">
        ${categories.map(c => {
			const icons = iconsBySection.get(c.section) || [];
			return `
        <div class="col-3 col-medium-2 col-small-2">
          <a href="/categories/${escapeHtml(c.section)}" class="p-card" style="display:block;text-decoration:none;color:inherit;">
            <h3 class="p-heading--5 u-no-margin--bottom">${escapeHtml(sectionDisplayName(c.section))}</h3>
            <p class="u-no-margin--bottom"><small style="color:#666">${c.count} snap${c.count === 1 ? '' : 's'}</small></p>
            ${icons.length > 0 ? `<div style="display:flex;gap:4px;margin-top:0.5rem">${icons.map(s => publisherSnapIcon(s)).join('')}</div>` : ''}
          </a>
        </div>`}).join('')}
      </div>
    </section>`;
}

function generateSnapDetailContent(
	snap: Snap,
	history: Array<{ change_type: string; old_version: unknown; new_version: unknown; old_revision: unknown; new_revision: unknown; recorded_at: string }>,
	links: { contact?: string; website?: string; source?: string; issues?: string; donations?: string },
	fileSize: string | null,
	screenshots: string[] = [],
	categories: string[] = []
): string {
	const hasLinks = links.contact || links.website || links.source || links.issues || links.donations;

	return `
    <section class="p-strip--light is-shallow">
      <div class="row">
        <div class="col-12">
          <div class="snap-header">
            ${snapIcon(snap.icon_url, 'hero')}
            <div>
              <h1 class="p-heading--2 u-no-margin--bottom">${escapeHtml(snap.title || snap.package_name)}</h1>
              <p style="color:#666">By <a href="/publisher/${escapeHtml(snap.origin || '')}">${escapeHtml(snap.publisher || 'Unknown')}</a>${publisherBadge(snap.developer_validation)}</p>
              <a href="https://snapcraft.io/${escapeHtml(snap.package_name)}" class="p-button--positive" target="_blank" rel="noopener">View on Snapcraft.io</a>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="p-strip is-shallow">
      <div class="row">
        <div class="col-2 col-medium-1"><span class="meta-label">Version</span><code>${escapeHtml(snap.version || 'Unknown')}</code></div>
        <div class="col-2 col-medium-1"><span class="meta-label">Revision</span><code>${snap.revision || 'Unknown'}</code></div>
        ${fileSize ? `<div class="col-2 col-medium-1"><span class="meta-label">Size</span>${fileSize}</div>` : ''}
        <div class="col-2 col-medium-1"><span class="meta-label">License</span>${escapeHtml(snap.license || 'Unknown')}</div>
        <div class="col-2 col-medium-1"><span class="meta-label">Confinement</span>${escapeHtml(snap.confinement || 'Unknown')}</div>
        <div class="col-2 col-medium-1"><span class="meta-label">Base</span>${escapeHtml(snap.base || 'Unknown')}</div>
      </div>
      ${categories.length > 0 ? `<div class="row" style="margin-top:0.5rem">
        <div class="col-12"><span class="meta-label">Categories</span>${categories.map(c => `<a href="/categories/${escapeHtml(c)}">${escapeHtml(sectionDisplayName(c))}</a>`).join(', ')}</div>
      </div>` : ''}
    </section>

    <section class="p-strip">
      <div class="row">
        <div class="col-8">
          ${snap.summary ? `<p class="p-heading--4">${escapeHtml(snap.summary)}</p>` : ''}
          ${hasLinks ? `<div class="snap-links">
            ${safeHref(links.website) ? `<a href="${escapeHtml(safeHref(links.website))}" target="_blank" rel="noopener">Website</a>` : ''}
            ${safeHref(links.source) ? `<a href="${escapeHtml(safeHref(links.source))}" target="_blank" rel="noopener">Source Code</a>` : ''}
            ${safeHref(links.issues) ? `<a href="${escapeHtml(safeHref(links.issues))}" target="_blank" rel="noopener">Report Bug</a>` : ''}
            ${safeHref(links.contact) ? `<a href="${escapeHtml(safeHref(links.contact))}" target="_blank" rel="noopener">Contact</a>` : ''}
            ${safeHref(links.donations) ? `<a href="${escapeHtml(safeHref(links.donations))}" target="_blank" rel="noopener">Donate</a>` : ''}
          </div>` : ''}
          ${screenshots.length > 0 ? `
          <div style="overflow-x:auto;margin-top:1rem">
            <div style="display:flex;gap:0.75rem;padding:0.5rem 0;width:max-content">
              ${screenshots.map(u => `<a href="${escapeHtml(u)}" target="_blank" rel="noopener"><img src="${escapeHtml(u)}" alt="Screenshot" loading="lazy" style="height:280px;border-radius:0.5rem;border:1px solid #e5e5e5"></a>`).join('')}
            </div>
          </div>` : ''}
          ${snap.description ? `<hr><div>${renderMarkdown(snap.description)}</div>` : ''}
        </div>
        <div class="col-4">
          ${history.length > 0 ? `
          <h3 class="p-muted-heading">Update History</h3>
          ${history.map(h => {
                const oldV = typeof h.old_version === 'string' ? h.old_version : null;
                const newV = typeof h.new_version === 'string' ? h.new_version : null;
                const oldRev = typeof h.old_revision === 'number' ? h.old_revision : null;
                const newRev = typeof h.new_revision === 'number' ? h.new_revision : null;
                return `<div class="history-entry">
                  <div class="history-version">${formatVersionChange(oldV, newV, oldRev, newRev)}</div>
                  <div class="history-date">${formatDate(h.recorded_at)}</div>
                </div>`;
              }).join('')}` : ''}
          <p style="margin-top:1rem"><span class="meta-label">Published</span>${formatDate(snap.date_published)}</p>
          <p><span class="meta-label">Last updated</span>${formatDate(snap.last_updated)}</p>
          <p><span class="meta-label">First seen</span>${formatDate(snap.first_seen_at)}</p>
        </div>
      </div>
    </section>`;
}

// ============================================================================
// Request Router
// ============================================================================

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);
		const path = url.pathname;
		const baseUrl = `${url.protocol}//${url.host}`;

		// --- API routes (no HTML) ---

		if (path === '/api/sync' && request.method === 'POST') {
			const authHeader = request.headers.get('Authorization');
			if (!env.SYNC_SECRET || authHeader !== `Bearer ${env.SYNC_SECRET}`) {
				return Response.json({ error: 'Unauthorized' }, { status: 401 });
			}
			try {
				const result = await syncSnaps(env);
				return Response.json({ success: true, ...result });
			} catch (error) {
				return Response.json({ success: false, error: String(error) }, { status: 500 });
			}
		}

		if (path === '/api/sync-sections' && request.method === 'POST') {
			const authHeader = request.headers.get('Authorization');
			if (!env.SYNC_SECRET || authHeader !== `Bearer ${env.SYNC_SECRET}`) {
				return Response.json({ error: 'Unauthorized' }, { status: 401 });
			}
			try {
				const result = await syncSections(env);
				return Response.json({ success: true, ...result });
			} catch (error) {
				return Response.json({ success: false, error: String(error) }, { status: 500 });
			}
		}

		if (path === '/api/stats') {
			const statsResult = await env.DB
				.prepare('SELECT COUNT(*) as total FROM snaps')
				.first<{ total: number }>();
			const newResult = await env.DB
				.prepare("SELECT COUNT(*) as count FROM snaps WHERE date_published >= datetime('now', '-24 hours')")
				.first<{ count: number }>();
			const updatedResult = await env.DB
				.prepare("SELECT COUNT(*) as count FROM snap_history WHERE change_type = 'updated' AND new_last_updated >= datetime('now', '-24 hours')")
				.first<{ count: number }>();
			const lastSync = await env.DB
				.prepare('SELECT completed_at FROM sync_runs WHERE status = ? ORDER BY id DESC LIMIT 1')
				.bind('completed')
				.first<{ completed_at: string }>();

			return Response.json({
				totalSnaps: statsResult?.total || 0,
				newToday: newResult?.count || 0,
				updatedToday: updatedResult?.count || 0,
				lastSync: lastSync?.completed_at || null,
			});
		}

		if (path === '/api/recent' || path === '/api/changes') {
			const limit = Math.min(Math.max(1, parseInt(url.searchParams.get('limit') || '50') || 50), 200);
			const result = await env.DB
				.prepare(
					`SELECT h.*, s.package_name, s.title, s.publisher, s.origin, s.developer_validation, s.icon_url, s.date_published
           FROM snap_history h
           JOIN snaps s ON h.snap_id = s.snap_id
           WHERE s.date_published >= datetime('now', '-30 days')
              OR h.new_last_updated >= datetime('now', '-30 days')
           ORDER BY COALESCE(s.date_published, h.new_last_updated, h.recorded_at) DESC
           LIMIT ?`
				)
				.bind(limit)
				.all<SnapHistory>();

			return Response.json(result.results || []);
		}

		if (path === '/api/snaps' || path === '/api/search') {
			const query = url.searchParams.get('q') || '';
			const limit = Math.min(Math.max(1, parseInt(url.searchParams.get('limit') || '20') || 20), 200);

			let result;
			if (query) {
				result = await env.DB
					.prepare(
						`SELECT * FROM snaps WHERE package_name LIKE ? OR title LIKE ? OR publisher LIKE ? ORDER BY last_changed_at DESC LIMIT ?`
					)
					.bind(`%${query}%`, `%${query}%`, `%${query}%`, limit)
					.all<Snap>();
			} else {
				result = await env.DB
					.prepare('SELECT * FROM snaps ORDER BY last_changed_at DESC LIMIT ?')
					.bind(limit)
					.all<Snap>();
			}

			return Response.json(result.results || []);
		}

		// --- Sitemap ---

		if (path === '/sitemap.xml') {
			const [snaps, publishers, sections] = await Promise.all([
				env.DB.prepare('SELECT package_name, last_changed_at FROM snaps ORDER BY package_name').all<{ package_name: string; last_changed_at: string | null }>(),
				env.DB.prepare('SELECT DISTINCT developer_id FROM snaps WHERE developer_id IS NOT NULL ORDER BY developer_id').all<{ developer_id: string }>(),
				env.DB.prepare('SELECT DISTINCT section FROM snap_sections ORDER BY section').all<{ section: string }>(),
			]);

			const staticPages = [
				{ loc: '/', priority: '1.0', changefreq: 'hourly' },
				{ loc: '/new', priority: '0.8', changefreq: 'hourly' },
				{ loc: '/updated', priority: '0.8', changefreq: 'hourly' },
				{ loc: '/categories', priority: '0.7', changefreq: 'daily' },
				{ loc: '/about', priority: '0.3', changefreq: 'monthly' },
			];

			let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
			xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

			for (const page of staticPages) {
				xml += `  <url>\n    <loc>${baseUrl}${page.loc}</loc>\n    <changefreq>${page.changefreq}</changefreq>\n    <priority>${page.priority}</priority>\n  </url>\n`;
			}

			for (const section of (sections.results || [])) {
				xml += `  <url>\n    <loc>${baseUrl}/categories/${encodeURIComponent(section.section)}</loc>\n    <changefreq>daily</changefreq>\n    <priority>0.6</priority>\n  </url>\n`;
			}

			for (const pub of (publishers.results || [])) {
				xml += `  <url>\n    <loc>${baseUrl}/publisher/${encodeURIComponent(pub.developer_id)}</loc>\n    <changefreq>daily</changefreq>\n    <priority>0.5</priority>\n  </url>\n`;
			}

			for (const snap of (snaps.results || [])) {
				xml += `  <url>\n    <loc>${baseUrl}/snap/${encodeURIComponent(snap.package_name)}</loc>\n`;
				if (snap.last_changed_at) {
					xml += `    <lastmod>${snap.last_changed_at.split(' ')[0]}</lastmod>\n`;
				}
				xml += `    <changefreq>weekly</changefreq>\n    <priority>0.5</priority>\n  </url>\n`;
			}

			xml += '</urlset>';

			return new Response(xml, {
				headers: {
					'Content-Type': 'application/xml; charset=utf-8',
					'Cache-Control': 'public, max-age=3600',
				},
			});
		}

		// --- RSS ---

		if (path === '/rss' || path === '/rss.xml' || path === '/feed.xml') {
			const limit = Math.min(Math.max(1, parseInt(url.searchParams.get('limit') || '50') || 50), 200);
			const result = await env.DB
				.prepare(
					`SELECT h.*, s.package_name, s.title, s.publisher, s.origin, s.developer_validation, s.icon_url, s.date_published
           FROM snap_history h
           JOIN snaps s ON h.snap_id = s.snap_id
           ORDER BY h.recorded_at DESC
           LIMIT ?`
				)
				.bind(limit)
				.all<SnapHistory>();

			const rss = generateRSS(result.results || [], url);
			return new Response(rss, {
				headers: {
					'Content-Type': 'application/rss+xml; charset=utf-8',
					'Cache-Control': 'public, max-age=3600',
				},
			});
		}

		if (path === '/new/rss') {
			const limit = Math.min(Math.max(1, parseInt(url.searchParams.get('limit') || '50') || 50), 200);
			const result = await env.DB
				.prepare(
					`SELECT h.*, s.package_name, s.title, s.publisher, s.origin, s.developer_validation, s.icon_url, s.date_published
           FROM snap_history h
           JOIN snaps s ON h.snap_id = s.snap_id
           WHERE h.change_type = 'new'
           ORDER BY h.recorded_at DESC
           LIMIT ?`
				)
				.bind(limit)
				.all<SnapHistory>();

			const rss = generateRSS(result.results || [], url, 'Snap Store Updates - New Snaps', 'New snaps published to the Snap Store', '/new/rss');
			return new Response(rss, {
				headers: {
					'Content-Type': 'application/rss+xml; charset=utf-8',
					'Cache-Control': 'public, max-age=3600',
				},
			});
		}

		if (path === '/updated/rss') {
			const limit = Math.min(Math.max(1, parseInt(url.searchParams.get('limit') || '50') || 50), 200);
			const result = await env.DB
				.prepare(
					`SELECT h.*, s.package_name, s.title, s.publisher, s.origin, s.developer_validation, s.icon_url, s.date_published
           FROM snap_history h
           JOIN snaps s ON h.snap_id = s.snap_id
           WHERE h.change_type = 'updated'
           ORDER BY h.recorded_at DESC
           LIMIT ?`
				)
				.bind(limit)
				.all<SnapHistory>();

			const rss = generateRSS(result.results || [], url, 'Snap Store Updates - Updated Snaps', 'Recently updated snaps in the Snap Store', '/updated/rss');
			return new Response(rss, {
				headers: {
					'Content-Type': 'application/rss+xml; charset=utf-8',
					'Cache-Control': 'public, max-age=3600',
				},
			});
		}

		// --- HTML pages ---

		if (path === '/' || path === '/index.html') {
			const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
			const sortParam = url.searchParams.get('sort') || '-when';
			const sort = sortParam.replace(/^-/, '') === 'snap' ? 'snap' : 'when';
			const sortDesc = sortParam.startsWith('-');
			const perPage = 50;
			const offset = (page - 1) * perPage;

			const statsResult = await env.DB
				.prepare('SELECT COUNT(*) as total FROM snaps')
				.first<{ total: number }>();
			const newResult = await env.DB
				.prepare("SELECT COUNT(*) as count FROM snaps WHERE date_published >= datetime('now', '-24 hours')")
				.first<{ count: number }>();
			const updatedResult = await env.DB
				.prepare("SELECT COUNT(*) as count FROM snap_history WHERE change_type = 'updated' AND new_last_updated >= datetime('now', '-24 hours')")
				.first<{ count: number }>();
			const lastSync = await env.DB
				.prepare('SELECT completed_at FROM sync_runs WHERE status = ? ORDER BY id DESC LIMIT 1')
				.bind('completed')
				.first<{ completed_at: string }>();
			const countResult = await env.DB
				.prepare(
					`SELECT COUNT(*) as count FROM (
						SELECT s.snap_id FROM snaps s
						LEFT JOIN snap_history h ON s.snap_id = h.snap_id
						WHERE s.date_published >= datetime('now', '-30 days')
						   OR h.new_last_updated >= datetime('now', '-30 days')
						GROUP BY s.snap_id
					)`
				)
				.first<{ count: number }>();
			const totalPages = Math.ceil((countResult?.count || 0) / perPage);
			const recentChanges = await env.DB
				.prepare(
					`SELECT h.*, s.package_name, s.title, s.summary, s.publisher, s.origin, s.developer_validation, s.icon_url, s.date_published,
					 ROW_NUMBER() OVER (PARTITION BY s.snap_id ORDER BY COALESCE(h.new_last_updated, h.recorded_at) DESC) as rn
           FROM snap_history h
           JOIN snaps s ON h.snap_id = s.snap_id
           WHERE s.date_published >= datetime('now', '-30 days')
              OR h.new_last_updated >= datetime('now', '-30 days')`
				)
				.all<SnapHistory & { rn: number }>();
			const filtered = (recentChanges.results || []).filter(r => r.rn === 1);
			const changeDate = (c: SnapHistory) => c.new_last_updated || c.recorded_at;
			if (sort === 'snap') {
				filtered.sort((a, b) => {
					const cmp = (a.title || a.package_name).localeCompare(b.title || b.package_name);
					return sortDesc ? -cmp : cmp;
				});
			} else {
				filtered.sort((a, b) => {
					const cmp = changeDate(a).localeCompare(changeDate(b));
					return sortDesc ? -cmp : cmp;
				});
			}
			const paged = filtered.slice(offset, offset + perPage);

			const content = generateIndexContent(
				{
					totalSnaps: statsResult?.total || 0,
					newToday: newResult?.count || 0,
					updatedToday: updatedResult?.count || 0,
					lastSync: lastSync?.completed_at || null,
				},
				paged,
				page,
				totalPages,
				sort,
				sortDesc
			);

			return new Response(renderLayout('Snap Store Updates - Recent Changes in the Snap Store', content, 'recent', '/rss', 'Snap Store Updates RSS', { description: 'Track new and updated snaps in the Canonical Snap Store. See what publishers are shipping, which apps got updates, and discover new snaps as they land.', image: `${baseUrl}/og-default.png`, url: baseUrl, baseUrl }), {
				headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
			});
		}

		if (path === '/new') {
			const page = Math.max(1, parseInt(url.searchParams.get('page') || '1') || 1);
			const limit = 50;
			const offset = (page - 1) * limit;

			const countResult = await env.DB
				.prepare("SELECT COUNT(*) as c FROM snaps WHERE date_published >= datetime('now', '-30 days')")
				.first<{ c: number }>();
			const totalPages = Math.ceil((countResult?.c || 0) / limit);

			const result = await env.DB
				.prepare(
					`SELECT s.package_name, s.title, s.publisher, s.origin, s.developer_validation, s.icon_url, s.summary, s.date_published, s.version
           FROM snaps s
           WHERE s.date_published >= datetime('now', '-30 days')
           ORDER BY s.date_published DESC
           LIMIT ? OFFSET ?`
				)
				.bind(limit, offset)
				.all<Snap>();

			const content = generateSnapCardGrid(result.results || [], 'New snaps in the last 30 days', page, totalPages, '/new');
			return new Response(renderLayout('New Snaps - Snap Store Updates', content, 'new', '/new/rss', 'New Snaps RSS', { description: 'New snaps recently published to the Canonical Snap Store. Discover fresh apps, tools and services as they arrive from publishers worldwide.', image: `${baseUrl}/og-default.png`, url: `${baseUrl}/new`, baseUrl }), {
				headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
			});
		}

		if (path === '/updated') {
			const page = Math.max(1, parseInt(url.searchParams.get('page') || '1') || 1);
			const limit = 50;
			const offset = (page - 1) * limit;

			const result = await env.DB
				.prepare(
					`SELECT h.snap_id, h.change_type, h.old_version, h.new_version, h.old_revision, h.new_revision, h.new_last_updated, h.recorded_at,
					        s.package_name, s.title, s.publisher, s.origin, s.developer_validation, s.icon_url, s.summary, s.date_published,
					        ROW_NUMBER() OVER (PARTITION BY s.snap_id, date(h.new_last_updated) ORDER BY h.new_last_updated DESC) as rn
					 FROM snap_history h
					 JOIN snaps s ON h.snap_id = s.snap_id
					 WHERE h.change_type = 'updated'
					   AND h.new_last_updated >= datetime('now', '-30 days')`
				)
				.all<SnapHistory & { rn: number }>();
			const deduped = (result.results || []).filter(r => r.rn === 1);
			deduped.sort((a, b) => (b.new_last_updated || '').localeCompare(a.new_last_updated || ''));
			const totalPages = Math.ceil(deduped.length / limit);
			const paged = deduped.slice(offset, offset + limit);

			const content = generateUpdatedContent(paged, page, totalPages);
			return new Response(renderLayout('Updated Snaps - Snap Store Updates', content, 'updated', '/updated/rss', 'Updated Snaps RSS', { description: 'Recently updated snaps in the Canonical Snap Store. See version changes, track which apps are actively maintained, and follow your favourite snaps.', image: `${baseUrl}/og-default.png`, url: `${baseUrl}/updated`, baseUrl }), {
				headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
			});
		}

		if (path === '/search') {
			const query = url.searchParams.get('q') || '';
			let results: Snap[] = [];
			if (query) {
				const result = await env.DB
					.prepare(
						`SELECT * FROM snaps WHERE package_name LIKE ? OR title LIKE ? OR summary LIKE ? OR publisher LIKE ? ORDER BY last_changed_at DESC LIMIT 50`
					)
					.bind(`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`)
					.all<Snap>();
				results = result.results || [];
			}

			const content = generateSearchContent(query, results);
			return new Response(renderLayout('Search - Snap Store Updates', content, 'search', '/rss', 'Snap Store Updates RSS', { description: 'Search the Canonical Snap Store catalogue. Find apps, tools, and services by name, publisher, or description across thousands of snaps.', image: `${baseUrl}/og-default.png`, url: `${baseUrl}/search`, baseUrl }), {
				headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
			});
		}

		if (path === '/publishers') {
			const result = await env.DB
				.prepare('SELECT origin, publisher, MAX(developer_validation) as developer_validation, COUNT(*) as count FROM snaps WHERE origin IS NOT NULL GROUP BY origin, publisher ORDER BY count DESC LIMIT 100')
				.all<{ origin: string; publisher: string; developer_validation: string | null; count: number }>();

			const publishers = result.results || [];
			const origins = publishers.map(p => p.origin);

			// Fetch up to 5 recent snap icons per publisher in one query
			const iconResult = origins.length > 0
				? await env.DB
					.prepare(
						`SELECT origin, package_name, title, icon_url FROM (
							SELECT origin, package_name, title, icon_url,
								ROW_NUMBER() OVER (PARTITION BY origin ORDER BY COALESCE(last_updated, date_published) DESC) as rn
							FROM snaps WHERE origin IN (${origins.map(() => '?').join(',')})
						) WHERE rn <= 5`
					)
					.bind(...origins)
					.all<{ origin: string; package_name: string; title: string | null; icon_url: string | null }>()
				: { results: [] as { origin: string; package_name: string; title: string | null; icon_url: string | null }[] };

			const iconsByOrigin = new Map<string, { package_name: string; title: string | null; icon_url: string | null }[]>();
			for (const row of iconResult.results || []) {
				const list = iconsByOrigin.get(row.origin) || [];
				list.push({ package_name: row.package_name, title: row.title, icon_url: row.icon_url });
				iconsByOrigin.set(row.origin, list);
			}

			const content = generatePublishersContent(publishers, iconsByOrigin);
			return new Response(renderLayout('Publishers - Snap Store Updates', content, 'publishers', '/rss', 'Snap Store Updates RSS', { description: 'Top publishers in the Canonical Snap Store. See who is shipping the most snaps, from Canonical to independent developers and open source projects.', image: `${baseUrl}/og-default.png`, url: `${baseUrl}/publishers`, baseUrl }), {
				headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
			});
		}

		if (path === '/about') {
			const content = `
    <section class="p-strip">
      <div class="row">
        <div class="col-8">
          <h1>About Snap Store Updates</h1>
          <p>Snap Store Updates tracks changes in the <a href="https://snapcraft.io">Canonical Snap Store</a>. It syncs the full snap catalogue every 15 minutes and records what's new and what's changed.</p>

          <h2>Features</h2>
          <ul>
            <li><strong><a href="/new">New snaps</a></strong> &mdash; see what's just landed in the store</li>
            <li><strong><a href="/updated">Updated snaps</a></strong> &mdash; track version bumps and other changes</li>
            <li><strong><a href="/categories">Browse by category</a></strong> &mdash; games, productivity, server, and more</li>
            <li><strong><a href="/publishers">Publisher pages</a></strong> &mdash; see everything a particular publisher has shipped or updated</li>
            <li><strong>RSS feeds</strong> &mdash; available for <a href="/rss">all changes</a>, <a href="/new/rss">new only</a>, <a href="/updated/rss">updated only</a>, plus per-snap, per-publisher, and per-category feeds</li>
            <li><strong>Snap detail pages</strong> &mdash; screenshots, version history, and metadata</li>
          </ul>

          <h2>How it works</h2>
          <p>The site syncs the full catalogue from the public Snap Store API every 15 minutes and currently tracks over 10,000 snaps. Category mappings are synced daily. There's no account or login required &mdash; it's a read-only view of what's happening in the store.</p>

          <h2>Feedback</h2>
          <p>Suggestions, bug reports, and feature requests are all welcome. If there are views or filters that would be useful, information that's missing, or things that look broken &mdash; I'd love to hear about it. You can find me at <a href="https://popey.me">popey.me</a>.</p>
        </div>
      </div>
    </section>`;

			return new Response(renderLayout('About - Snap Store Updates', content, 'about', '/rss', 'Snap Store Updates RSS', { description: 'About Snap Store Updates — tracking new and updated snaps in the Canonical Snap Store every 15 minutes.', image: `${baseUrl}/og-default.png`, url: `${baseUrl}/about`, baseUrl }), {
				headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
			});
		}

		if (path === '/categories') {
			const result = await env.DB
				.prepare('SELECT section, COUNT(*) as count FROM snap_sections GROUP BY section ORDER BY count DESC')
				.all<{ section: string; count: number }>();

			const categories = result.results || [];
			const sectionSlugs = categories.map(c => c.section);

			// Fetch up to 5 recent snap icons per category in one query
			const iconResult = sectionSlugs.length > 0
				? await env.DB
					.prepare(
						`SELECT ss.section, s.package_name, s.title, s.icon_url FROM (
							SELECT section, snap_id,
								ROW_NUMBER() OVER (PARTITION BY section ORDER BY synced_at DESC) as rn
							FROM snap_sections WHERE section IN (${sectionSlugs.map(() => '?').join(',')})
						) ss
						JOIN snaps s ON ss.snap_id = s.snap_id
						WHERE ss.rn <= 5
						ORDER BY COALESCE(s.last_updated, s.date_published) DESC`
					)
					.bind(...sectionSlugs)
					.all<{ section: string; package_name: string; title: string | null; icon_url: string | null }>()
				: { results: [] as { section: string; package_name: string; title: string | null; icon_url: string | null }[] };

			const iconsBySection = new Map<string, { package_name: string; title: string | null; icon_url: string | null }[]>();
			for (const row of iconResult.results || []) {
				const list = iconsBySection.get(row.section) || [];
				list.push({ package_name: row.package_name, title: row.title, icon_url: row.icon_url });
				iconsBySection.set(row.section, list);
			}

			const content = generateCategoriesContent(categories, iconsBySection);
			return new Response(renderLayout('Categories - Snap Store Updates', content, 'categories', '/rss', 'Snap Store Updates RSS', { description: 'Browse snaps by category in the Canonical Snap Store. Discover apps across games, development, utilities, server, and more.', image: `${baseUrl}/og-default.png`, url: `${baseUrl}/categories`, baseUrl }), {
				headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
			});
		}

		if (path.startsWith('/categories/') && path.endsWith('/rss')) {
			const section = path.slice(12, -4);
			const displayName = sectionDisplayName(section);

			const countResult = await env.DB
				.prepare('SELECT COUNT(*) as c FROM snap_sections WHERE section = ?')
				.bind(section)
				.first<{ c: number }>();
			if (!countResult || countResult.c === 0) {
				return new Response('Category not found', { status: 404 });
			}

			const limit = Math.min(Math.max(1, parseInt(url.searchParams.get('limit') || '50') || 50), 200);
			const result = await env.DB
				.prepare(
					`SELECT h.*, s.package_name, s.title, s.publisher, s.origin, s.developer_validation, s.icon_url, s.date_published
		       FROM snap_history h
		       JOIN snaps s ON h.snap_id = s.snap_id
		       JOIN snap_sections ss ON ss.snap_id = s.snap_id AND ss.section = ?
		       ORDER BY h.recorded_at DESC
		       LIMIT ?`
				)
				.bind(section, limit)
				.all<SnapHistory>();

			const rss = generateRSS(result.results || [], url, `${displayName} - Snap Store Updates`, `Snap updates in ${displayName}`, `/categories/${encodeURIComponent(section)}/rss`);
			return new Response(rss, {
				headers: {
					'Content-Type': 'application/rss+xml; charset=utf-8',
					'Cache-Control': 'public, max-age=3600',
				},
			});
		}

		if (path.startsWith('/categories/')) {
			const section = path.slice(12);
			const displayName = sectionDisplayName(section);
			const filterQuery = url.searchParams.get('q') || '';

			const page = Math.max(1, parseInt(url.searchParams.get('page') || '1') || 1);
			const limit = 50;
			const offset = (page - 1) * limit;

			const filterClause = filterQuery ? ' AND (s.package_name LIKE ? OR s.title LIKE ? OR s.summary LIKE ? OR s.publisher LIKE ?)' : '';
			const filterBinds = filterQuery ? [`%${filterQuery}%`, `%${filterQuery}%`, `%${filterQuery}%`, `%${filterQuery}%`] : [];

			const countResult = await env.DB
				.prepare(`SELECT COUNT(*) as c FROM snap_sections ss JOIN snaps s ON ss.snap_id = s.snap_id WHERE ss.section = ?${filterClause}`)
				.bind(section, ...filterBinds)
				.first<{ c: number }>();

			if (!countResult || (countResult.c === 0 && !filterQuery)) {
				return new Response('Category not found', { status: 404 });
			}

			const totalPages = Math.ceil((countResult?.c || 0) / limit);

			const result = await env.DB
				.prepare(
					`SELECT s.package_name, s.title, s.publisher, s.origin, s.developer_validation, s.icon_url, s.summary, s.date_published, s.version
		       FROM snaps s
		       JOIN snap_sections ss ON ss.snap_id = s.snap_id AND ss.section = ?
		       ${filterClause}
		       ORDER BY COALESCE(s.last_updated, s.date_published) DESC
		       LIMIT ? OFFSET ?`
				)
				.bind(section, ...filterBinds, limit, offset)
				.all<Snap>();

			const rssHref = `/categories/${encodeURIComponent(section)}/rss`;
			const categoryBase = `/categories/${encodeURIComponent(section)}`;
			const paginationBase = filterQuery ? `${categoryBase}?q=${encodeURIComponent(filterQuery)}` : categoryBase;
			const content = generateSnapCardGrid(result.results || [], displayName, page, totalPages, paginationBase, '', filterQuery, categoryBase);
			return new Response(renderLayout(`${displayName} - Snap Store Updates`, content, 'categories', rssHref, `${displayName} RSS`, { description: `Browse ${displayName} snaps in the Canonical Snap Store.`, image: `${baseUrl}/og-default.png`, url: `${baseUrl}/categories/${encodeURIComponent(section)}`, baseUrl }), {
				headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
			});
		}

		if (path.startsWith('/publisher/') && path.endsWith('/rss')) {
			const origin = path.slice(11, -4);
			const publisherInfo = await env.DB
				.prepare('SELECT DISTINCT publisher FROM snaps WHERE origin = ? LIMIT 1')
				.bind(origin)
				.first<{ publisher: string }>();
			if (!publisherInfo) {
				return new Response('Publisher not found', { status: 404 });
			}
			const limit = Math.min(Math.max(1, parseInt(url.searchParams.get('limit') || '50') || 50), 200);
			const result = await env.DB
				.prepare(
					`SELECT h.*, s.package_name, s.title, s.publisher, s.origin, s.developer_validation, s.icon_url, s.date_published
           FROM snap_history h
           JOIN snaps s ON h.snap_id = s.snap_id
           WHERE s.origin = ?
           ORDER BY h.recorded_at DESC
           LIMIT ?`
				)
				.bind(origin, limit)
				.all<SnapHistory>();

			const rss = generateRSS(result.results || [], url, `${publisherInfo.publisher} - Snap Store Updates`, `Snap updates from ${publisherInfo.publisher}`, `/publisher/${encodeURIComponent(origin)}/rss`);
			return new Response(rss, {
				headers: {
					'Content-Type': 'application/rss+xml; charset=utf-8',
					'Cache-Control': 'public, max-age=3600',
				},
			});
		}

		if (path.startsWith('/publisher/')) {
			const origin = path.slice(11);
			const publisherInfo = await env.DB
				.prepare('SELECT DISTINCT publisher, developer_validation FROM snaps WHERE origin = ? LIMIT 1')
				.bind(origin)
				.first<{ publisher: string; developer_validation: string | null }>();
			const publisher = publisherInfo?.publisher || origin;
			const validation = publisherInfo?.developer_validation || null;
			const snapsResult = await env.DB
				.prepare('SELECT * FROM snaps WHERE origin = ? ORDER BY COALESCE(last_updated, date_published) DESC')
				.bind(origin)
				.all<Snap>();

			const rssHref = `/publisher/${encodeURIComponent(origin)}/rss`;
			const content = generateSnapCardGrid(snapsResult.results || [], `Snaps by ${escapeHtml(publisher)}`, 1, 1, '', publisherBadge(validation, 'large'));
			return new Response(renderLayout(`${publisher} - Snap Store Updates`, content, 'publishers', rssHref, `${publisher} - Snap Store Updates RSS`, { description: `Snaps by ${publisher}`, image: `${baseUrl}/og-default.png`, url: `${baseUrl}/publisher/${encodeURIComponent(origin)}`, baseUrl }), {
				headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
			});
		}

		if (path.startsWith('/snap/') && path.endsWith('/rss')) {
			const packageName = path.slice(6, -4);
			const snapResult = await env.DB
				.prepare('SELECT snap_id, package_name, title FROM snaps WHERE package_name = ?')
				.bind(packageName)
				.first<{ snap_id: string; package_name: string; title: string | null }>();
			if (!snapResult) {
				return new Response('Snap not found', { status: 404 });
			}
			const limit = Math.min(Math.max(1, parseInt(url.searchParams.get('limit') || '50') || 50), 200);
			const result = await env.DB
				.prepare(
					`SELECT h.*, s.package_name, s.title, s.publisher, s.origin, s.developer_validation, s.icon_url, s.date_published
           FROM snap_history h
           JOIN snaps s ON h.snap_id = s.snap_id
           WHERE h.snap_id = ?
           ORDER BY h.recorded_at DESC
           LIMIT ?`
				)
				.bind(snapResult.snap_id, limit)
				.all<SnapHistory>();

			const snapTitle = snapResult.title || snapResult.package_name;
			const rss = generateRSS(result.results || [], url, `${snapTitle} - Snap Store Updates`, `Updates for ${snapTitle}`, `/snap/${encodeURIComponent(packageName)}/rss`);
			return new Response(rss, {
				headers: {
					'Content-Type': 'application/rss+xml; charset=utf-8',
					'Cache-Control': 'public, max-age=3600',
				},
			});
		}

		if (path.startsWith('/snap/')) {
			const packageName = path.slice(6);
			const snapResult = await env.DB
				.prepare('SELECT * FROM snaps WHERE package_name = ?')
				.bind(packageName)
				.first<Snap>();

			if (!snapResult) {
				return new Response('Snap not found', { status: 404 });
			}

			const historyResult = await env.DB
				.prepare('SELECT * FROM snap_history WHERE snap_id = ? ORDER BY recorded_at DESC LIMIT 20')
				.bind(snapResult.snap_id)
				.all();

			const snap = snapResult;
			// Deduplicate history: remove exact duplicates and collapse flip-flops
			const rawHistory = (historyResult.results || []) as Array<{ change_type: string; old_version: unknown; new_version: unknown; old_revision: unknown; new_revision: unknown; recorded_at: string }>;
			// Step 1: remove exact duplicates (same version+revision+timestamp)
			const deduped = rawHistory.filter((h, i) => {
				if (i > 0) {
					const prev = rawHistory[i - 1];
					if (h.old_version === prev.old_version && h.new_version === prev.new_version &&
						h.old_revision === prev.old_revision && h.new_revision === prev.new_revision &&
						h.recorded_at === prev.recorded_at) return false;
				}
				return true;
			});
			// Step 2: collapse flip-flops — if consecutive entries reverse each other, both are API noise
			const history: typeof deduped = [];
			for (const h of deduped) {
				const prev = history[history.length - 1];
				if (prev &&
					String(h.new_version ?? '') === String(prev.old_version ?? '') &&
					String(h.old_version ?? '') === String(prev.new_version ?? '') &&
					h.new_revision === prev.old_revision &&
					h.old_revision === prev.new_revision) {
					history.pop(); // remove prev — together they're a no-op
				} else {
					history.push(h);
				}
			}

			const snapDetails = await fetch(`https://api.snapcraft.io/api/v1/snaps/details/${snap.package_name}`, {
				headers: { 'Snap-Device-Series': '16', 'X-Ubuntu-Series': '16' }
			}).then(r => r.json()).catch(() => null) as Record<string, unknown> | null;

			const detailLinks = snapDetails?.links as Record<string, string[]> | undefined;
			const contactLink = detailLinks?.contact?.[0];
			const websiteLink = detailLinks?.website?.[0];
			const sourceLink = detailLinks?.source?.[0];
			const issuesLink = detailLinks?.issues?.[0];
			const donationsLink = detailLinks?.donations?.[0];
			const binarySize = snapDetails?.binary_filesize as number | undefined;
			const fileSize = binarySize ? `${(binarySize / (1024 * 1024)).toFixed(1)} MB` : null;

			// Screenshots: prefer live API, fall back to stored raw_json
			let screenshots = (snapDetails?.screenshot_urls as string[] | undefined) || [];
			if (screenshots.length === 0 && snap.raw_json) {
				try {
					const stored = JSON.parse(snap.raw_json);
					screenshots = stored.screenshot_urls || [];
				} catch {}
			}
			// Filter out banner images (typically named "banner" or "banner-icon")
			screenshots = screenshots.filter((u: string) => !/(^|\/)banner[^/]*\.(png|jpg|jpeg|gif|webp)$/i.test(u) && /^https?:\/\//i.test(u));

			// Fetch categories for this snap
			const sectionsResult = await env.DB
				.prepare('SELECT section FROM snap_sections WHERE snap_id = ? ORDER BY section')
				.bind(snap.snap_id)
				.all<{ section: string }>();
			const snapCategories = (sectionsResult.results || []).map(r => r.section);

			const content = generateSnapDetailContent(
				snap,
				history,
				{ contact: contactLink, website: websiteLink, source: sourceLink, issues: issuesLink, donations: donationsLink },
				fileSize,
				screenshots,
				snapCategories
			);
			const snapRssHref = `/snap/${encodeURIComponent(snap.package_name)}/rss`;
			const snapOgDescription = snap.summary || (snap.description ? snap.description.substring(0, 160) : `A snap by ${snap.publisher || 'Unknown'}`);
			const snapOgImage = snap.icon_url || `${baseUrl}/og-default.png`;
			return new Response(renderLayout(`${snap.title || snap.package_name} - Snap Store Updates`, content, '', snapRssHref, `${snap.title || snap.package_name} - Snap Store Updates RSS`, { description: snapOgDescription, image: snapOgImage, url: `${baseUrl}/snap/${encodeURIComponent(snap.package_name)}`, twitterCard: snap.icon_url ? 'summary' : 'summary_large_image', baseUrl }), {
				headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
			});
		}

		return new Response('Not Found', { status: 404 });
	},

	async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
		if (event.cron === '0 3 * * *') {
			// Daily section sync at 3am UTC
			console.log('Running scheduled section sync...');
			try {
				const result = await syncSections(env);
				console.log(`Section sync complete: ${result.sections} sections, ${result.mappings} mappings`);
			} catch (error) {
				console.error('Section sync failed:', error);
			}
		} else {
			// Default: 15-minute catalogue sync
			console.log('Running scheduled sync...');
			try {
				const result = await syncSnaps(env);
				console.log(`Sync complete: ${result.new} new, ${result.updated} updated, ${result.total} total`);
			} catch (error) {
				console.error('Sync failed:', error);
			}
		}
	},
};
