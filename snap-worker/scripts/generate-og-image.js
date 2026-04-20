#!/usr/bin/env node

// Generate the default OpenGraph image for Snap Store Updates.
// Creates a 1200x630 image with a grid of desaturated snap icons
// and "Snap Store Updates" text overlay.
// Usage: node scripts/generate-og-image.js <path-to-local-d1-sqlite>

import Database from 'better-sqlite3';
import sharp from 'sharp';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const WIDTH = 1200;
const HEIGHT = 630;
const ICON_SIZE = 64;
const GAP = 8;
const COLS = Math.floor((WIDTH + GAP) / (ICON_SIZE + GAP));
const ROWS = Math.floor((HEIGHT + GAP) / (ICON_SIZE + GAP));
const ICON_COUNT = COLS * ROWS;

async function fetchIcon(url, size) {
	try {
		const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
		if (!res.ok) return null;
		const buf = Buffer.from(await res.arrayBuffer());
		return await sharp(buf).resize(size, size, { fit: 'cover' }).grayscale().png().toBuffer();
	} catch {
		return null;
	}
}

async function main() {
	const dbPath = process.argv[2];
	if (!dbPath) {
		console.error('Usage: node scripts/generate-og-image.js <path-to-local-d1-sqlite>');
		process.exit(1);
	}

	const db = new Database(dbPath, { readonly: true });

	// Get icon URLs from popular snaps (those with icons, ordered by snap count per publisher then recency)
	const rows = db.prepare(`
		SELECT icon_url FROM snaps
		WHERE icon_url IS NOT NULL AND icon_url != ''
		ORDER BY COALESCE(last_updated, date_published) DESC
		LIMIT ?
	`).all(ICON_COUNT * 2); // fetch extra in case some fail to download

	db.close();

	const iconUrls = rows.map(r => r.icon_url);
	console.log(`Fetching up to ${ICON_COUNT} icons from ${iconUrls.length} candidates...`);

	// Download icons in parallel batches
	const icons = [];
	const BATCH = 20;
	for (let i = 0; i < iconUrls.length && icons.length < ICON_COUNT; i += BATCH) {
		const batch = iconUrls.slice(i, i + BATCH);
		const results = await Promise.all(batch.map(u => fetchIcon(u, ICON_SIZE)));
		for (const buf of results) {
			if (buf && icons.length < ICON_COUNT) icons.push(buf);
		}
		console.log(`  ${icons.length}/${ICON_COUNT} icons downloaded...`);
	}

	console.log(`Got ${icons.length} icons, compositing...`);

	// Build composite list — tile icons in a grid
	const composites = icons.map((buf, i) => {
		const col = i % COLS;
		const row = Math.floor(i / COLS);
		return {
			input: buf,
			left: col * (ICON_SIZE + GAP) + Math.floor((WIDTH - COLS * (ICON_SIZE + GAP) + GAP) / 2),
			top: row * (ICON_SIZE + GAP) + Math.floor((HEIGHT - ROWS * (ICON_SIZE + GAP) + GAP) / 2),
		};
	});

	// Create base image with dark background
	let image = sharp({
		create: { width: WIDTH, height: HEIGHT, channels: 4, background: { r: 51, g: 51, b: 51, alpha: 255 } }
	}).png();

	// Composite icons
	if (composites.length > 0) {
		image = image.composite(composites);
	}

	// Render to buffer, then apply the icon layer at reduced opacity + text overlay
	const iconLayer = await image.toBuffer();

	// Create the icon layer at reduced opacity
	const fadedIcons = await sharp(iconLayer)
		.ensureAlpha()
		.modulate({ brightness: 0.4 })
		.toBuffer();

	// Create text overlay band (semi-transparent dark band in lower portion)
	const bandHeight = 180;
	const bandY = HEIGHT - bandHeight;
	const bandSvg = `<svg width="${WIDTH}" height="${HEIGHT}">
		<rect x="0" y="${bandY}" width="${WIDTH}" height="${bandHeight}" fill="rgba(0,0,0,0.7)"/>
	</svg>`;

	// Create text SVG
	const textSvg = `<svg width="${WIDTH}" height="${HEIGHT}">
		<style>
			@import url('https://fonts.googleapis.com/css2?family=Ubuntu:wght@700');
			.title { font-family: 'Ubuntu', sans-serif; font-weight: 700; fill: white; }
			.subtitle { font-family: 'Ubuntu', sans-serif; font-weight: 400; fill: rgba(255,255,255,0.8); }
		</style>
		<text x="${WIDTH / 2}" y="${bandY + 80}" text-anchor="middle" class="title" font-size="52">Snap Store Updates</text>
		<text x="${WIDTH / 2}" y="${bandY + 130}" text-anchor="middle" class="subtitle" font-size="26">Tracking changes in the Canonical Snap Store</text>
	</svg>`;

	// Final composite: faded icons + band + text
	const final = await sharp(fadedIcons)
		.composite([
			{ input: Buffer.from(bandSvg), top: 0, left: 0 },
			{ input: Buffer.from(textSvg), top: 0, left: 0 },
		])
		.png()
		.toBuffer();

	const outPath = resolve(__dirname, '..', 'public', 'og-default.png');
	await sharp(final).toFile(outPath);
	console.log(`Written to ${outPath} (${(final.length / 1024).toFixed(1)} KB)`);
}

main().catch(err => {
	console.error(err);
	process.exit(1);
});
