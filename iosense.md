# I/O Sense API Tracking — Test Plan Masters (LG on-prem)

## Environment

| Setting | Value | Where |
|---|---|---|
| Test Plan Masters API | `api` (relative: the backend serves the app) or e.g. `http://10.102.120.46:8431/api` | `VITE_TESTMASTER_API_ROOT`, or `dataApiRoot` in `public/config.js` |
| MongoDB | `mongodb://10.102.120.46:27018`, database `productionDB`, collection `testmaster` | `MONGODB_URI`, `MONGODB_DATABASE`, `MONGODB_COLLECTION` in `backend/.env` |
| Auth | None. The app opens straight on the categories, and the API takes no credentials | — |

Categories and test masters are stored in MongoDB by `backend/`.

## I/O Sense API calls

None. The app no longer calls I/O Sense.

No longer used:
- `retrieve-sso-token`: sign-in was removed.
- `bruce_insight_result_create`, `bruce_insight_result_list_paginated` and `bruce_insight_result_delete`: data moved to MongoDB. Rows already in `INS_85cbe7954686` were not migrated.

## Test Plan Masters API (`backend/`)

All routes are under the API root and need no credentials. Anyone who can reach the API can read and
change data, so keep it on the LG internal network. Every route answers `{ success, data }` or
`{ success: false, errors: [message] }`.

| Route | Method | Code | Purpose |
|---|---|---|---|
| `/health` | GET | — | Liveness: 200 when MongoDB answers a ping, 503 otherwise |
| `/testmaster/categories` | GET | `listCategorySummaries` | The defaults (from code) merged with what is stored, then added categories; read-only |
| `/testmaster/categories` | POST | `createCategory` | `{ name, description }`; 409 on a duplicate name |
| `/testmaster/categories/{id}` | GET | `getCategory` | One category, without its items |
| `/testmaster/categories/{id}` | PUT | `updateCategory` | `{ name, description }`; 409 when renaming a default |
| `/testmaster/categories/{id}` | DELETE | `deleteCategory` | Removes a category and its test master; 409 for a default |
| `/testmaster/categories/{id}/master` | GET | `getTestMaster` | The current test master, or `null` |
| `/testmaster/categories/{id}/master` | PUT | `saveTestMaster` | `{ fileName, sheetName, columns, warnings, items }`; creates a default's document on first upload, else replaces the master in place |
| `/testmaster/status` | GET | `probeStorage` | Host, database, collection, counts and every stored document (no items) |

Frontend functions are in `frontend/src/services/testMasterStore.ts`; routes in `backend/src/routes.js`.

## Default categories

These come from code and are always listed first, in this order, even when the collection is empty.
Viewing them writes nothing. A default's document is created the first time something is saved for it
(its first test master upload, or a description edit) and updated in place after that, so there is at
most one document per category. Its name always comes from code, even if the stored document is edited
by hand. Defaults can't be deleted or renamed in the app or the API, and no added category can take a
default's name.

| Category name | Category ID |
|---|---|
| WashingMachine | `ae96a52b-2452-4c1d-913b-1c24ca162adf` |
| W/P - Water Purifier | `f451c173-3f02-46c9-ba01-f8e978fcfeb3` |
| C/F - Ceiling Fan | `bedfe577-fa22-4e33-839a-32f48678f6ee` |
| MWO - Microwave | `cd57d1a7-b86a-459f-a184-1138ca75c344` |
| AC - Air Conditioner | `2db5f316-30e8-4fcb-9259-adcdba03cf65` |
| REF - Refrigerator | `d8ac8fae-9afc-40e4-a33a-7674a2df0b61` |
| Others | `cba67dd0-de40-468f-8261-cf6399cc3b5f` |

The list lives in `backend/src/defaultCategories.js`.

## Data model in `productionDB.testmaster`

One document per category, holding its current test master:

```js
{
  _id: "<categoryId>",            // the fixed ids above, or a UUID for categories users add
  categoryId: "<categoryId>",     // same value as _id, written explicitly on every save
  docType: "lgtm.category",       // marks this app's documents
  name, nameKey,                  // nameKey = lowercased name; unique index lgtm_unique_name
  description,
  isDefault, sortOrder,           // defaults: 0–6; added categories: 1000, then by createdAt
  createdAt, updatedAt,           // BSON dates
  testMaster: null | {
    categoryId,                   // the category this master belongs to
    uploadId, fileName, sheetName, columns, warnings,
    itemCount, items: [...],
    uploadedAt
  }
}
```

Each test item is one sheet row, stored as the five columns contain it:

`{ row, partName, testName, specification, criteria, sampleQuantity, extra? }`

Nothing is derived from inside a cell. A `Test Name` of `A-01 – Structure exterior check` is stored whole, under `testName`; the `A-01` prefix is not split out into a code or a group, because other masters need not carry one. `row` is the 1-based sheet row, kept for traceability back to the Excel. Columns outside the five are kept per item under `extra`. In MongoDB, `extra` is stored as `[{ column, value }]`, because header text such as `No.` or `$ Cost` isn't a safe field name. The API returns it as an object keyed by header.

- **Replace:** uploading a master is one `$set` of `testMaster`, so readers never see a partial upload. The request body limit is `BODY_LIMIT` (20 MB by default); a document can hold up to 16 MB.
- **Delete category:** one `deleteOne`, which removes its test master with it.

## Confirming a deployment from the app

The on-prem database is not reachable from a developer machine, so the app reports its own state:

- **Header chip:** grey while checking. Green once a real read of the collection succeeds, showing `MongoDB · <host>`. Red, with the API's own error text, when the read fails. Clicking it opens **Database status**, which shows the API URL, MongoDB host, database and collection, counts, and every document's `_id`. It re-reads each time it is opened.
- **After each upload:** the master is read back from MongoDB and the confirmation quotes what came back (`Saved 94 tests … — verified in MongoDB`). If that doesn't match what was sent, the app reports an error.
