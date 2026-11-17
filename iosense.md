# I/O Sense API Tracking — Test Plan Masters (LG on-prem)

## Environment

| Setting | Value | Where |
|---|---|---|
| API root | `http://10.102.120.46:3002/api` (LG on-prem: plain http on port 3002; cloud equivalent `https://connector.iosense.io/api`) | `VITE_IOSENSE_API_ROOT` in `.env`, or `apiRoot` in `public/config.js` at runtime |
| Insight | `INS_85cbe7954686` | `VITE_IOSENSE_INSIGHT_ID`, or `insightId` in `public/config.js` |
| Auth | SSO token from I/O Sense launch URL (`?token=`) → Bearer, kept in `sessionStorage` | `src/auth/` |

Routes are identical on cloud and on-prem; only the domain changes.

## API calls

| Function ID (fsv-mcp) | Route | Method | Code | Purpose |
|---|---|---|---|---|
| `retrieve-sso-token` (auth-session) | `/retrieve-sso-token/{ssoToken}` | GET | `src/auth/sso.ts` → `exchangeSsoToken` | Exchange SSO token for Bearer token, organisation and userId |
| `bruce_insight_result_create` | `/account/bruce/insightResult/add` | POST | `src/services/insightResults.ts` → `createInsightResult` | Write a category row or a test master chunk |
| `bruce_insight_result_list_paginated` | `/account/bruce/insightResult/fetch/paginated/{insightID}` | PUT | `src/services/insightResults.ts` → `listInsightResults` | Read rows by tag (all pages); dotted projections for card summaries |
| `bruce_insight_result_delete` | `/account/bruce/insightResult/delete/{insightID}/{resultId}` | DELETE | `src/services/insightResults.ts` → `deleteInsightResult` | Remove superseded or deleted rows |

The header status chip and the post-save check reuse the paginated list route; they add no new
function IDs. `probeInsight` in `src/services/testMasterStore.ts` lists rows tagged `lg-test-master`
with the items projected away, so the check stays cheap.

Not used: `bruce_insight_result_update`. Its documented contract doesn't say how the target row is identified, so edits are done as create-then-delete.

All requests send `Authorization: Bearer …`, `organisation` (from the SSO response) and `ngsw-bypass: true`. The CORS preflight on the cloud connector was checked and allows these headers.

## Confirming a deployment from the app

The on-prem connector is not reachable from a developer machine, so the app reports its own
connection state instead:

- **Header chip** — grey while checking, green once a real read of the insight succeeds, red with
  the connector's own error text when it fails. Clicking it opens **Insight status**, which shows
  the API root, insight ID, organisation, row counts, and every row's Mongo `_id` with its save
  time and author. It re-reads each time it is opened, so it never shows a stale picture.
- **After each upload** the master is read back out of the insight and the confirmation quotes what
  came back (`Saved 94 tests … — verified in INS_…`). A mismatch between what was sent and what the
  insight returns is reported as an error instead.

If the chip is red on-prem, the message distinguishes the usual causes: a TLS or network failure
reads `Could not reach I/O Sense at …`, an unknown insight reads `Insight … not found.`, and an
expired token sends the user back to sign-in.

## Behaviour verified against the live connector (2026-11-17)

- `filter.tags` must be an **array** (a string returns `success:false, "Invalid tags"`), and multiple tags are **AND**-combined.
- `projection` accepts dotted paths (`{"result.itemCount": 1}`); `_id` and populated `metadata.userID` always come back.
- Rows come back newest first. Pagination is nested: `{ pagination: { page, count } }` → `{ data, totalCount, pagination: { totalPages } }`.
- Failures can be HTTP 200 with `success:false`, so the client checks both status and flag.

## Data model in `INS_85cbe7954686`

All rows carry the tag `lg-test-master`.

| Row | Tags | `result` |
|---|---|---|
| Category | `lgtm-category`, `lgtm-category/<categoryId>` | `{ schema: "lgtm.category.v1", categoryId, name, description, createdAt }` |
| Test master chunk | `lgtm-testmaster`, `lgtm-testmaster/<categoryId>`, `lgtm-upload/<uploadId>` | `{ schema: "lgtm.testmaster.v1", categoryId, uploadId, part, parts, itemCount, fileName, sheetName, columns, warnings, uploadedAt, items[] }` |

Each test item is one sheet row, stored as the five columns contain it:

`{ row, partName, testName, specification, criteria, sampleQuantity, extra? }`

Nothing is derived from inside a cell. A `Test Name` of `A-01 – Structure exterior check` is stored whole, under `testName` — the `A-01` prefix is not split out into a code or a group, because other masters need not carry one. `row` is the 1-based sheet row, kept for traceability back to the Excel. Columns outside the five are preserved per item under `extra`, keyed by their header text.

- **Chunking:** items are split so that each chunk's items stay under about 48 KB, which keeps every request below common 100 KB gateway body limits. The WM master (94 items, about 37 KB) fits in one row.
- **Replace / edit:** the new rows are written first and the older rows are deleted after. Readers pick the newest *complete* upload (all `parts` present), so a failed cleanup never shows stale data. A partially written upload is rolled back.
- **Delete category:** deletes the test master rows first, then the category rows.
