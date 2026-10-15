// @specstamp {"spec":"fd2438b01c79","code":"da4f3dceb437","spec_path":"specs/daily-activity.spec.md","date":"2026-10-15"}
export interface ActivityDay {
 date: string;
 total: number;
 new: number | null;
 updated: number | null;
}
export const ranges: Record<string, number | null> = { '7': 7, '30': 30, '90': 90, '1y': 365, '2y': 730, all: null };

export async function loadActivity(db: D1Database, range: string, now = new Date()): Promise<{ days: ActivityDay[]; lastSync: string | null }> {
 const results = await db.batch([
  db.prepare('SELECT date(first_seen_at) AS day, COUNT(*) AS count FROM snaps GROUP BY date(first_seen_at) ORDER BY day'),
  db.prepare(`SELECT date(h.recorded_at) AS day, h.change_type AS type, COUNT(DISTINCT h.snap_id) AS count
   FROM snap_history h JOIN sync_runs r ON r.id = h.sync_run_id
   WHERE r.status = 'completed' AND (h.change_type = 'updated' OR
    (h.change_type = 'new' AND r.id != (SELECT MIN(id) FROM sync_runs)))
   GROUP BY date(h.recorded_at), h.change_type`),
  db.prepare("SELECT date(started_at) AS day, MAX(completed_at) AS completed FROM sync_runs WHERE status = 'completed' GROUP BY date(started_at) ORDER BY day"),
 ]);
 const firstSeen = results[0].results as unknown as {day: string; count: number}[];
 const changes = results[1].results as unknown as {day: string; type: string; count: number}[];
 const coverage = results[2].results as unknown as {day: string; completed: string}[];
 const lastSync = coverage.reduce<string | null>((last, r) => !last || r.completed > last ? r.completed : last, null);
 if (!firstSeen.length || !coverage.length) return { days: [], lastSync };
 const end = now.toISOString().slice(0, 10);
 const limit = Object.hasOwn(ranges, range) ? ranges[range] : 30;
 const start = new Date(`${firstSeen[0].day}T00:00:00Z`);
 if (limit !== null) start.setTime(Math.max(start.getTime(), Date.parse(`${end}T00:00:00Z`) - (limit - 1) * 86400000));
 const counts = new Map(firstSeen.map(r => [r.day, r.count]));
 const activity = new Map(changes.map(r => [`${r.day}:${r.type}`, r.count]));
 const covered = new Set(coverage.map(r => r.day));
 let total = firstSeen.filter(r => r.day < start.toISOString().slice(0, 10)).reduce((sum, r) => sum + r.count, 0);
 const days: ActivityDay[] = [];
 for (let date = start; date.toISOString().slice(0, 10) <= end; date = new Date(date.getTime() + 86400000)) {
  const day = date.toISOString().slice(0, 10);
  total += counts.get(day) || 0;
  days.push({ date: day, total, new: covered.has(day) ? activity.get(`${day}:new`) || 0 : null, updated: covered.has(day) ? activity.get(`${day}:updated`) || 0 : null });
 }
 return { days, lastSync };
}

export function renderActivity(days: ActivityDay[], mode: 'all' | 'new' | 'updated', url: URL): string {
 const requestedRange = url.searchParams.get('range') || '30';
 const range = Object.hasOwn(ranges, requestedRange) ? requestedRange : '30';
 const series = mode === 'all' ? ['new', 'updated'] as const : [mode];
 const colours = { new: '#c7162b', updated: '#24598f' };
 const controls = Object.keys(ranges).map(key => {
  const link = new URL(url); link.searchParams.set('range', key); link.searchParams.delete('page');
  const label = ({ '7': '7 days', '30': '30 days', '90': '90 days', '1y': '1 year', '2y': '2 years', all: 'All time' } as Record<string, string>)[key];
  return `<a class="p-button${range === key ? '--positive' : ''}" href="${link.pathname}${link.search.replace(/&/g, '&amp;')}" ${range === key ? 'aria-current="true"' : ''}>${label}</a>`;
 }).join(' ');
 let chart = '<p>No completed sync history available yet.</p>';
 if (days.length) {
  const totalMax = Math.max(1, ...days.map(d => d.total));
  const activityMax = Math.max(1, ...days.flatMap(d => series.map(s => d[s] || 0)));
  const step = 880 / days.length;
  const x = (i: number) => 70 + (i + .5) * step;
  const ty = (value: number) => 280 - value / totalMax * 230;
  const ay = (value: number) => 280 - value / activityMax * 230;
  const bars = days.map((d, i) => series.map((s, j) => d[s] === null ? '' : `<rect x="${x(i) - step * .4 + j * step * .8 / series.length}" y="${ay(d[s]!)}" width="${step * .8 / series.length}" height="${280 - ay(d[s]!)}" fill="${colours[s]}"/>`).join('')).join('');
  const points = days.map((d, i) => `${x(i)},${ty(d.total)}`).join(' ');
  const hits = days.map((d, i) => {
   const label = `${d.date}: Total ${d.total}; ${series.map(s => `${s} ${d[s] === null ? 'no completed sync' : d[s]}`).join('; ')}`;
   const boxX = Math.max(70, Math.min(x(i) - 110, 720));
   return `<g class="activity-day" tabindex="0" role="img" aria-label="${label}"><title>${label}</title><rect x="${70 + i * step}" y="45" width="${step}" height="240" fill="transparent"/><g class="activity-tooltip" pointer-events="none"><rect x="${boxX}" y="55" width="230" height="${50 + series.length * 22}" fill="white" stroke="#666"/><text x="${boxX + 10}" y="76">${d.date}</text><text x="${boxX + 10}" y="98">Total: ${d.total.toLocaleString('en-GB')}</text>${series.map((s,j) => `<text x="${boxX + 10}" y="${120 + j * 22}">${s === 'new' ? 'New' : 'Updated'}: ${d[s] === null ? 'No completed sync' : d[s]!.toLocaleString('en-GB')}</text>`).join('')}</g></g>`;
  }).join('');
  chart = `<p><span style="color:#0e8420">━━ Total tracked</span> ${series.map(s => `<span style="color:${colours[s]}">■ ${s === 'new' ? 'New' : 'Updated'}</span>`).join(' &nbsp; ')}</p>
  <div style="overflow-x:auto"><svg class="activity-chart" viewBox="0 0 1020 330" style="width:100%;min-width:600px" role="group" aria-label="Daily snap activity. Total on left axis; daily activity on right axis.">
  <text x="70" y="22">Total tracked</text><text x="950" y="22" text-anchor="end">Daily activity</text>
  ${[0,.25,.5,.75,1].map(f => `<path d="M70 ${280-f*230} H950" stroke="#ddd"/><text x="62" y="${285-f*230}" text-anchor="end">${Math.round(totalMax*f)}</text><text x="958" y="${285-f*230}">${Math.round(activityMax*f)}</text>`).join('')}
  ${bars}<polyline points="${points}" fill="none" stroke="#0e8420" stroke-width="3"/>${days.length === 1 ? `<circle cx="${x(0)}" cy="${ty(days[0].total)}" r="4" fill="#0e8420"/>` : ''}
  <text x="70" y="315">${days[0].date}</text><text x="950" y="315" text-anchor="end">${days[days.length-1].date}</text>${hits}</svg></div>
  `;
 }
 return `<section class="p-strip is-shallow activity-section"><div class="row"><div class="col-12"><h2 class="p-muted-heading">Catalogue activity</h2><nav aria-label="Chart time range">${controls}</nav>${chart}</div></div></section>`;
}

// Keep the selected chart window when sorting or paging the list below it.
export function preserveActivityRange(content: string, url: URL): string {
 const range = url.searchParams.get('range');
 if (!range || !Object.hasOwn(ranges, range)) return content;
 return content.replace(/href="(\/(?:new|updated)?(?:\?[^"#]*)?)"/g, (_match, href: string) => {
  const link = new URL(href.replace(/&amp;/g, '&'), url);
  if (!link.searchParams.has('range')) link.searchParams.set('range', range);
  return `href="${link.pathname}${link.search.replace(/&/g, '&amp;')}"`;
 });
}
