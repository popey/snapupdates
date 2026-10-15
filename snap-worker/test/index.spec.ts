// @specstamp {"spec":"fd2438b01c79","code":"e4b7cb4d569c","spec_path":"specs/daily-activity.spec.md","date":"2026-10-15"}
import {
	env,
	createExecutionContext,
	waitOnExecutionContext,
	SELF,
} from "cloudflare:test";
import { describe, it, expect } from "vitest";
import worker from "../src";

async function fetchWorker(request: Request): Promise<Response> {
	const ctx = createExecutionContext();
	const response = await worker.fetch(request, env, ctx);
	await waitOnExecutionContext(ctx);
	return response;
}

describe("Snap Store Updates worker", () => {
	it("renders the about page through the worker directly", async () => {
		const response = await fetchWorker(new Request("http://example.com/about"));

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toContain("text/html");
		expect(await response.text()).toContain("About Snap Store Updates");
	});

	it("renders the about page through the integration binding", async () => {
		const response = await SELF.fetch("http://example.com/about");

		expect(response.status).toBe(200);
		expect(await response.text()).toContain("About Snap Store Updates");
	});

	it("rejects an unauthenticated catalogue sync", async () => {
		const response = await fetchWorker(
			new Request("http://example.com/api/sync", { method: "POST" })
		);

		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({ error: "Unauthorized" });
	});

	it("returns 404 for an unknown route", async () => {
		const response = await SELF.fetch("http://example.com/does-not-exist");

		expect(response.status).toBe(404);
		expect(await response.text()).toBe("Not Found");
	});
});

import { loadActivity, renderActivity, preserveActivityRange } from '../src/activity';

describe('daily activity charts', () => {
 it('aggregates baseline totals, retains missing days and bounds selected ranges', async () => {
  await env.DB.exec(`CREATE TABLE IF NOT EXISTS snaps (snap_id TEXT PRIMARY KEY, first_seen_at TEXT);
   CREATE TABLE IF NOT EXISTS sync_runs (id INTEGER PRIMARY KEY, started_at TEXT, completed_at TEXT, status TEXT);
   CREATE TABLE IF NOT EXISTS snap_history (snap_id TEXT, sync_run_id INTEGER, change_type TEXT, recorded_at TEXT);`);
  await env.DB.batch([
   env.DB.prepare("INSERT INTO snaps VALUES ('a','2026-01-01T12:00:00Z'), ('b','2026-01-03T12:00:00Z')"),
   env.DB.prepare("INSERT INTO sync_runs VALUES (1,'2026-01-01T12:00:00Z','2026-01-01T12:01:00Z','completed'), (2,'2026-01-03T12:00:00Z','2026-01-03T12:01:00Z','completed'), (3,'2026-01-03T13:00:00Z',NULL,'failed')"),
   env.DB.prepare("INSERT INTO snap_history VALUES ('a',1,'new','2026-01-01T12:00:00Z'), ('b',2,'new','2026-01-03T12:00:00Z'), ('a',2,'updated','2026-01-03T12:00:00Z'), ('a',2,'updated','2026-01-03T12:30:00Z'), ('b',3,'updated','2026-01-03T13:00:00Z')"),
  ]);
  const all = await loadActivity(env.DB, 'all', new Date('2026-01-03T14:00:00Z'));
  expect(all.days).toEqual([
   { date: '2026-01-01', total: 1, new: 0, updated: 0 },
   { date: '2026-01-02', total: 1, new: null, updated: null },
   { date: '2026-01-03', total: 2, new: 1, updated: 1 },
  ]);
  expect(all.lastSync).toBe('2026-01-03T12:01:00Z');
  const week = await loadActivity(env.DB, '7', new Date('2026-01-09T14:00:00Z'));
  expect(week.days).toHaveLength(7);
  expect(week.days[0].total).toBe(2);
  expect(week.days[0].new).toBe(1);
 });
 it('renders range links, applicable series, tooltips without extra chart prose or tables', () => {
  const days = [{ date: '2026-01-01', total: 100, new: 0, updated: 2 }];
  for (const mode of ['all', 'new', 'updated'] as const) {
   const html = renderActivity(days, mode, new URL('https://example.com/?range=all&page=3'));
   expect(html).not.toContain('Daily chart data');
   expect(html).not.toContain('<table');
   expect(html).not.toContain('UTC calendar days');
   expect(html).toContain('<section class="p-strip is-shallow activity-section">');
   expect(html).toContain('tabindex="0"');
   expect(html).toContain('range=2y');
   expect(html).not.toContain('page=3');
   expect(html.includes('■ New')).toBe(mode !== 'updated');
   expect(html.includes('■ Updated')).toBe(mode !== 'new');
   expect(html).not.toMatch(/NaN|Infinity/);
  }
  expect(renderActivity([], 'all', new URL('https://example.com'))).toContain('No completed sync history');
 });
});

it('preserves the range when sorting and paging without overriding chart controls', () => {
 expect(preserveActivityRange('<a href="/?range=7">7 days</a>', new URL('https://example.com/?range=90')))
  .toBe('<a href="/?range=7">7 days</a>');
 expect(preserveActivityRange('<a href="/?sort=snap&page=2">Next</a><a href="/snap/test">Snap</a>', new URL('https://example.com/?range=90')))
  .toBe('<a href="/?sort=snap&amp;page=2&amp;range=90">Next</a><a href="/snap/test">Snap</a>');
});
