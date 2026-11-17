# Test Plan Masters

Stores LG test plan masters in I/O Sense. Users pick a product category (Washing Machine, Refrigerator, …), upload its test master Excel, review the parsed test items, and save them to Bruce insight `INS_85cbe7954686`.

API calls and the stored data model are documented in [`../iosense.md`](../iosense.md).

## Run

```bash
npm install
cp .env.example .env   # optional: defaults target the LG on-prem server
npm run dev            # http://localhost:8430
```

Open the app from I/O Sense so it receives `?token=<SSO token>`. When the token is missing or expired, the sign-in screen accepts a pasted SSO token.

## Configure

| Variable | Default | Meaning |
|---|---|---|
| `VITE_IOSENSE_API_ROOT` | `https://10.102.120.46/api` | Connector API root. LG on-prem uses the same routes as cloud on a different domain |
| `VITE_IOSENSE_INSIGHT_ID` | `INS_85cbe7954686` | Insight that stores categories and test masters |
| `VITE_IOSENSE_ORGANISATION` | *(empty)* | Optional `organisation` header for the SSO exchange |

After deploying, these can be changed without a rebuild by editing `config.js` next to `index.html`.

## Build and deploy

```bash
npm run build   # outputs dist/
```

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

The E2E suite intercepts the on-prem host (`10.102.120.46`, not reachable from CI) with an in-memory version of the Bruce insight-result contract. One `@live` test calls the real I/O Sense SSO endpoint. Screenshots are written to `test-results/screenshots/`.
