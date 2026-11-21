# Test Plan Masters

Stores LG test plan masters in MongoDB. There is no sign-in: users open the app, pick a product category (WashingMachine, REF - Refrigerator, …), upload its test master Excel, review the parsed test items, and save them. The API in [`../backend`](../backend) writes them to `productionDB.testmaster`.

API routes, the default categories and the stored data model are documented in [`../iosense.md`](../iosense.md).

## Run

```bash
# API (MongoDB) on :8431
cd ../backend && npm install && cp .env.example .env && npm run dev

# App on :8430; /api is proxied to :8431
cd ../frontend && npm install && npm run dev
```

Set `TESTMASTER_API_PROXY` to proxy `/api` somewhere other than `http://localhost:8431`.

Neither the app nor the API asks for credentials, so anyone who can reach them can change data. Keep both on the LG internal network.

## Configure

| Variable | Default | Meaning |
|---|---|---|
| `VITE_TESTMASTER_API_ROOT` | `api` | Test Plan Masters API. Relative to the page, for when the backend serves the app |

After deploying, this can be changed without a rebuild by editing `dataApiRoot` in `config.js` next to `index.html`.

## Build and deploy

```bash
npm run build                 # outputs dist/
cd ../backend && npm start    # serves dist/ and /api on :8431
```

The backend serves `../frontend/dist` (or `STATIC_DIR`) next to the API, so one process hosts the whole app and the default relative `api` root just works. To host `dist/` elsewhere, set `dataApiRoot` in `config.js` to the backend's absolute URL and list the app's origin in the backend's `CORS_ORIGINS`.

`dist/` uses relative asset paths and hash routing, so it can be served from any sub-path with no rewrite rules. Fonts are bundled, so nothing loads from the internet at runtime.

## Excel format

The parser finds the header row automatically. It matches column names loosely, so `Spcification` and `Condition/Judgement creteria` are recognised:

`Part Name` · `Test Name` · `Specification` · `Condition/Judgement criteria` · `Sample quantity`

Each cell is stored as the sheet holds it — nothing is parsed out of the text. A test name of `A-01 – Structure exterior check` is saved whole, since a master need not number its tests that way. Extra columns are kept per item under `extra`.

## Test

```bash
npx playwright install chromium   # first time only
npm test
```

The E2E suite starts its own `mongod` (from `PATH`, on port 27099), the real backend (8432) and Vite (8433), so it never touches the production database. Set `TEST_MONGODB_URI` to use an existing test MongoDB instead. Nothing is faked: the tests drive the real app, API and database. Screenshots are written to `test-results/screenshots/`.
