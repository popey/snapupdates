---
name: Daily catalogue activity charts
description: Historical totals and daily snap activity on the three activity pages.
targets:
  - ../snap-worker/src/index.ts
  - ../snap-worker/src/activity.ts
  - ../snap-worker/test/index.spec.ts
---

# Daily catalogue activity charts

Requirements confirmed by stakeholder; selectable ranges added.

- Place the homepage chart below the stats banner in the main content, above
  the recent changes on `/`, above the new
  snaps on `/new`, and above the updated snaps on `/updated`, using the existing
  Vanilla Framework layout and typography. Use a compact heading and shallow
  chart spacing, keeping the stats, chart, and following list close together.
  Match the activity heading to the Recent Changes heading using Vanilla’s
  `p-muted-heading` style.
- Offer 7, 30, 90 days, 1 year, 2 years, and all-time ranges via links; default to 30 days. Include the partial current
  day. Restrict historical totals to the retained tracking period; do not invent
  totals before tracking began or treat missing sync days as zero activity.
- Draw tracked total as a green line on a labelled total axis and activity as
  red (new) and blue (updated) bars on a separate labelled daily-count axis.
  Show both activity series on `/`, only new on `/new`, and only updated on
  `/updated`. Include a legend and dates.
- Define total as the cumulative number of snaps first seen by the end of each
  day, matching the banner's count of tracked database records. Removed store
  entries remain tracked, as they do today.
- Define new and updated activity by the UTC day the tracker recorded each
  change in completed syncs, counting distinct snaps per day and change type. Exclude the initial
  catalogue import from new activity so it does not appear as thousands of new
  publications. Explain these definitions on About, without explanatory prose
  or a daily data table beneath the chart.
- Hovering or focusing a day displays its date and the applicable series values.
  Keep daily values accessible by focusing chart days without JavaScript. Preserve the server-rendered architecture without an external chart CDN.
- Generate chart data from the database when serving each page so successful
  syncs appear on subsequent page loads, subject to existing page caching.
  Keep the current banner and show when data was last synced.
- Handle empty history, a single day, missing days, and zero activity without
  broken chart geometry or misleading values.

## Validation

Verify daily aggregation, distinct daily counts, initial import handling,
missing coverage, and page-specific series using the existing Worker test suite.
Run TypeScript checking and relevant tests before completion.

[@test](../snap-worker/test/index.spec.ts)
