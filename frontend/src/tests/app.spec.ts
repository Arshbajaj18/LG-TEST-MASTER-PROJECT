import { expect, test, type Page } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import * as XLSX from 'xlsx'
import { BEARER, FakeIosense, INSIGHT_ID, ON_PREM_HOST, VALID_SSO } from './fixtures/fakeIosense.ts'

const WM_EXCEL = fileURLToPath(new URL('../../../WM Test master (1).xlsx', import.meta.url))
const SHOTS = fileURLToPath(new URL('../../test-results/screenshots/', import.meta.url))

function collectConsoleErrors(page: Page) {
  const errors: string[] = []
  page.on('console', (msg) => msg.type() === 'error' && errors.push(msg.text()))
  page.on('pageerror', (err) => errors.push(err.message))
  return errors
}

function workbookFile(name: string, rows: unknown[][]) {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Sheet1')
  const data = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  return { name, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from(data) }
}

async function createCategory(page: Page, name: string, description: string) {
  await page.getByRole('button', { name: 'New category' }).last().click()
  const dialog = page.getByRole('dialog', { name: 'New category' })
  await dialog.getByLabel('Name').fill(name)
  await dialog.getByLabel(/Description/).fill(description)
  await dialog.getByRole('button', { name: 'Create category' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('link', { name, exact: true })).toBeVisible()
}

test('SSO login → categories → upload WM test master → browse → replace → edit → delete', async ({ page }) => {
  const errors = collectConsoleErrors(page)
  const fake = new FakeIosense(page)
  await fake.install()

  // --- SSO bootstrap: token from I/O Sense launch URL is exchanged and stripped from the address bar
  await page.goto(`/?token=${VALID_SSO}`)
  await expect(page.getByRole('heading', { name: 'No categories yet' })).toBeVisible()
  expect(page.url()).not.toContain(VALID_SSO)
  const ssoCall = fake.requests.find((r) => r.url.includes('/api/retrieve-sso-token/'))
  expect(ssoCall?.url).toBe(`https://${ON_PREM_HOST}/api/retrieve-sso-token/${VALID_SSO}`)
  await page.screenshot({ path: `${SHOTS}01-categories-empty.png` })

  // --- Categories (cards like the I/O Sense Test Plan Monitoring page)
  await createCategory(page, 'W/M - Washing Machine', 'W/M - Washing Machine')
  await createCategory(page, 'REF - Refrigerator', 'REF - Refrigerator')
  await createCategory(page, 'AC - Air Conditioner', 'AC - Air Conditioner')
  await expect(page.getByTestId('category-card')).toHaveCount(3)
  await expect(page.getByTestId('category-card').first()).toContainText('No master')
  expect(fake.rowsTagged('lgtm-category')).toHaveLength(3)

  // Every write goes to the on-prem domain, the configured insight, with the SSO bearer
  const adds = fake.requests.filter((r) => r.url.endsWith('/insightResult/add'))
  expect(adds.length).toBe(3)
  for (const add of adds) {
    expect(add.url).toBe(`https://${ON_PREM_HOST}/api/account/bruce/insightResult/add`)
    expect(add.headers['authorization']).toBe(BEARER)
    expect((add.body as { insightID: string }).insightID).toBe(INSIGHT_ID)
  }

  // Search filters cards
  await page.getByRole('searchbox', { name: 'Search categories' }).fill('refri')
  await expect(page.getByTestId('category-card')).toHaveCount(1)
  await page.getByRole('searchbox', { name: 'Search categories' }).fill('')

  // --- Category detail: empty state
  await page.getByRole('link', { name: 'W/M - Washing Machine', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'No test master for W/M - Washing Machine yet' })).toBeVisible()
  await page.screenshot({ path: `${SHOTS}02-category-empty.png` })

  // --- Upload real LG test master and review parsed preview
  await page.getByTestId('file-input').setInputFiles(WM_EXCEL)
  const preview = page.getByRole('dialog', { name: 'Review test master' })
  await expect(preview).toBeVisible()
  await expect(preview.getByTestId('preview-count')).toHaveText('94')
  await expect(preview).toContainText('WM Test Master')
  await expect(preview.getByTestId('preview-warnings')).toHaveCount(0)
  await page.screenshot({ path: `${SHOTS}03-upload-preview.png` })

  await preview.getByRole('button', { name: 'Save 94 tests' }).click()
  await expect(preview).toBeHidden()
  await expect(page.getByTestId('summary-tests')).toHaveText('94')
  await expect(page.getByTestId('test-row')).toHaveCount(94)
  // The confirmation reports what the insight returned, not what the browser sent
  await expect(page.getByText(`verified in ${INSIGHT_ID}`)).toBeVisible()
  await page.screenshot({ path: `${SHOTS}04-test-master-table.png` })

  // Saved JSON landed in the insight, tagged to this category, with every parsed item
  const category = fake.rowsTagged('lgtm-category').find((r) => r.result.name === 'W/M - Washing Machine')!
  const categoryId = category.result.categoryId as string
  const masterRows = fake.rowsTagged(`lgtm-testmaster/${categoryId}`)
  expect(masterRows).toHaveLength(1)
  const saved = masterRows[0].result as { items: Array<Record<string, unknown>>; itemCount: number; fileName: string }
  expect(saved.itemCount).toBe(94)
  expect(saved.items).toHaveLength(94)
  expect(saved.fileName).toBe('WM Test master (1).xlsx')
  // Cells are stored exactly as the sheet holds them: no code or group is derived from the text.
  expect(saved.items[0]).toMatchObject({
    partName: 'Applicable component / material as specified in the standard',
    testName: 'A-01 – Structure exterior check',
    sampleQuantity: 3,
    row: 2,
  })
  expect(Object.keys(saved.items[0]).sort()).toEqual(
    ['criteria', 'partName', 'row', 'sampleQuantity', 'specification', 'testName'].sort(),
  )

  // --- Browse: search spans every stored column
  const search = page.getByRole('searchbox', { name: 'Search tests' })
  await search.fill('hose')
  await expect(page.getByTestId('result-count')).toContainText('of 94 tests')
  const hoseCount = await page.getByTestId('test-row').count()
  expect(hoseCount).toBeGreaterThan(0)
  expect(hoseCount).toBeLessThan(94)
  // Part Name is searchable too, not just the test name
  await search.fill('Plating thickness')
  await expect(page.getByTestId('test-row')).toHaveCount(1)
  await page.screenshot({ path: `${SHOTS}05-search-filter.png` })
  await search.fill('')
  await expect(page.getByTestId('test-row')).toHaveCount(94)

  // --- Detail drawer with keyboard navigation
  await page.getByTestId('test-row').nth(1).click()
  const drawer = page.getByRole('dialog', { name: /A-13/ })
  await expect(drawer).toBeVisible()
  await expect(drawer).toContainText('Plating thickness management')
  await expect(drawer).toContainText('Cr:0.1㎛')
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('dialog', { name: /A-14/ })).toBeVisible()
  await page.screenshot({ path: `${SHOTS}06-test-drawer.png` })
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)

  // --- Reload: session persists and data comes back from I/O Sense
  await page.reload()
  await expect(page.getByTestId('test-row')).toHaveCount(94)

  // --- Replace with a newer file: old rows are removed, new upload wins
  await page.getByTestId('file-input').setInputFiles(
    workbookFile('WM Test master v2.xlsx', [
      ['Part Name', 'Test Name', 'Spcification', 'Condition/Judgement creteria', 'Sample quantity'],
      ['Door', 'A-01 – Structure exterior check', 'Visual check', 'No defects', 5],
      ['Hose', 'B-23 – Hose High Pressure Resistance', 'Water pressure tester', 'No leak', 3],
    ]),
  )
  const replace = page.getByRole('dialog', { name: 'Review test master' })
  await expect(replace).toContainText('This replaces the current master (94 tests from WM Test master (1).xlsx)')
  await replace.getByRole('button', { name: 'Save 2 tests' }).click()
  await expect(page.getByTestId('summary-tests')).toHaveText('2')
  await expect(page.getByTestId('test-row')).toHaveCount(2)
  expect(fake.rowsTagged(`lgtm-testmaster/${categoryId}`)).toHaveLength(1)

  // --- Back to cards: count and last-updated reflect the upload
  await page.getByRole('link', { name: 'Back to categories' }).click()
  const wmCard = page.getByTestId('category-card').filter({ hasText: 'W/M - Washing Machine' })
  await expect(wmCard).toContainText('2 tests')
  await expect(wmCard).toContainText('Last Updated : 17 Nov 2026')
  await page.screenshot({ path: `${SHOTS}07-categories-with-master.png` })

  // --- Edit via kebab menu: still one row per category
  await page.getByRole('button', { name: 'Actions for AC - Air Conditioner' }).click()
  await page.getByRole('menuitem', { name: 'Edit' }).click()
  const edit = page.getByRole('dialog', { name: 'Edit category' })
  await edit.getByLabel('Name').fill('AC - Room Air Conditioner')
  await edit.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByRole('link', { name: 'AC - Room Air Conditioner', exact: true })).toBeVisible()
  expect(fake.rowsTagged('lgtm-category')).toHaveLength(3)

  // Duplicate names are rejected
  await page.getByRole('button', { name: 'New category' }).last().click()
  await page.getByRole('dialog', { name: 'New category' }).getByLabel('Name').fill('ref - refrigerator')
  await page.getByRole('button', { name: 'Create category' }).click()
  await expect(page.getByText('A category with this name already exists.')).toBeVisible()
  await page.keyboard.press('Escape')

  // --- Delete removes the category and its test master rows
  await page.getByRole('button', { name: 'Actions for W/M - Washing Machine' }).click()
  await page.getByRole('menuitem', { name: 'Delete' }).click()
  await page.getByRole('dialog', { name: 'Delete category?' }).getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByTestId('category-card')).toHaveCount(2)
  expect(fake.rowsTagged(`lgtm-category/${categoryId}`)).toHaveLength(0)
  expect(fake.rowsTagged(`lgtm-testmaster/${categoryId}`)).toHaveLength(0)

  expect(errors).toEqual([])
})

test('large test masters are chunked across rows and reassembled in order', async ({ page }) => {
  const errors = collectConsoleErrors(page)
  const fake = new FakeIosense(page)
  await fake.install()
  await page.goto(`/?token=${VALID_SSO}`)
  await createCategory(page, 'Big Category', '')
  await page.getByRole('link', { name: 'Big Category', exact: true }).click()

  const longText = 'Test condition: Room temperature (20±3℃). '.repeat(14)
  const rows: unknown[][] = [['Part Name', 'Test Name', 'Specification', 'Judgement criteria', 'Sample quantity']]
  for (let i = 1; i <= 400; i++) rows.push([`Part ${i}`, `B-${String(i).padStart(3, '0')} – Test ${i}`, longText, longText, 3])
  await page.getByTestId('file-input').setInputFiles(workbookFile('big.xlsx', rows))
  await page.getByRole('dialog', { name: 'Review test master' }).getByRole('button', { name: 'Save 400 tests' }).click()
  await expect(page.getByTestId('summary-tests')).toHaveText('400')

  const parts = fake.rowsTagged('lgtm-testmaster')
  expect(parts.length).toBeGreaterThan(1)
  for (const part of parts) expect(Buffer.byteLength(JSON.stringify(part.result))).toBeLessThan(60_000)

  await page.reload()
  await expect(page.getByTestId('test-row')).toHaveCount(400)
  await expect(page.getByTestId('test-row').first()).toContainText('B-001')
  await expect(page.getByTestId('test-row').last()).toContainText('B-400')
  expect(errors).toEqual([])
})

test('phone-width layout has no horizontal scroll', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const fake = new FakeIosense(page)
  await fake.install()
  await page.goto(`/?token=${VALID_SSO}`)
  await createCategory(page, 'MWO - Microwave', 'MWO - Microwave')
  await page.screenshot({ path: `${SHOTS}10-mobile-categories.png` })
  await page.getByRole('link', { name: 'MWO - Microwave', exact: true }).click()
  await page.getByTestId('file-input').setInputFiles(WM_EXCEL)
  await page.getByRole('dialog', { name: 'Review test master' }).getByRole('button', { name: 'Save 94 tests' }).click()
  await expect(page.getByTestId('test-row')).toHaveCount(94)
  await page.screenshot({ path: `${SHOTS}11-mobile-table.png` })
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(0)
})

test('rejects files that are not test masters', async ({ page }) => {
  const fake = new FakeIosense(page)
  await fake.install()
  await page.goto(`/?token=${VALID_SSO}`)
  await createCategory(page, 'Others', 'Others')
  await page.getByRole('link', { name: 'Others', exact: true }).click()

  await page.getByTestId('file-input').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') })
  await expect(page.getByRole('alert')).toContainText("isn't an Excel file")

  await page.getByTestId('file-input').setInputFiles(workbookFile('wrong.xlsx', [['Name', 'Value'], ['a', 1]]))
  await expect(page.getByRole('alert')).toContainText('No test items found')
  await page.screenshot({ path: `${SHOTS}08-parse-error.png` })
  expect(fake.rowsTagged('lgtm-testmaster')).toHaveLength(0)
})

test('invalid SSO token shows a sign-in error', async ({ page }) => {
  const fake = new FakeIosense(page)
  await fake.install()
  await page.goto('/?token=expired-token')
  await expect(page.getByRole('heading', { name: "We couldn't sign you in" })).toBeVisible()
  await expect(page.getByRole('alert')).toContainText('Invalid or expired token.')
  await page.screenshot({ path: `${SHOTS}09-sso-error.png` })

  // Recover by pasting a valid token
  await page.getByLabel('SSO token').fill(VALID_SSO)
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByRole('heading', { name: 'No categories yet' })).toBeVisible()
})

test('expired session sends the user back to sign in', async ({ page }) => {
  const fake = new FakeIosense(page)
  await fake.install()
  await page.goto(`/?token=${VALID_SSO}`)
  await expect(page.getByRole('heading', { name: 'No categories yet' })).toBeVisible()
  fake.expireToken = true
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Session expired' })).toBeVisible()
})

test('@live real I/O Sense SSO endpoint is reachable from the browser and rejects a bad token', async ({ page }) => {
  // The LG on-prem host is not reachable from here, so point the runtime config at the public connector.
  await page.route('**/config.js', (route) =>
    route.fulfill({ contentType: 'text/javascript', body: 'window.APP_CONFIG = { apiRoot: "https://connector.iosense.io/api" }' }),
  )
  await page.goto('/?token=not-a-real-sso-token')
  await expect(page.getByRole('heading', { name: "We couldn't sign you in" })).toBeVisible({ timeout: 20_000 })
  await expect(page.getByRole('alert')).toContainText('Invalid or expired token.')
  await expect(page.getByText('Server: connector.iosense.io')).toBeVisible()
})

test('insight status reports what is stored, and surfaces a connector failure', async ({ page }) => {
  const errors = collectConsoleErrors(page)
  const fake = new FakeIosense(page)
  await fake.install()
  await page.goto(`/?token=${VALID_SSO}`)
  await createCategory(page, 'W/M - Washing Machine', 'W/M - Washing Machine')
  await page.getByRole('link', { name: 'W/M - Washing Machine', exact: true }).click()
  await page.getByTestId('file-input').setInputFiles(
    workbookFile('WM.xlsx', [
      ['Part Name', 'Test Name', 'Spcification', 'Condition/Judgement creteria', 'Sample quantity'],
      ['Door', 'Structure exterior check', 'Visual check', 'No defects', 5],
      ['Hose', 'Hose pressure resistance', 'Pressure tester', 'No leak', 3],
    ]),
  )
  await page.getByRole('dialog', { name: 'Review test master' }).getByRole('button', { name: 'Save 2 tests' }).click()
  await expect(page.getByTestId('summary-tests')).toHaveText('2')

  // --- The header chip is the deployment check: green only after a real read of the insight
  const chip = page.getByTestId('insight-status')
  await expect(chip).toHaveClass(/app-env-ok/)
  await chip.click()
  const status = page.getByRole('dialog', { name: 'Insight status' })
  await expect(status.getByTestId('insight-banner')).toContainText(`Connected — read ${INSIGHT_ID} successfully.`)
  await expect(status.getByTestId('insight-id')).toHaveText(INSIGHT_ID)
  await expect(status.getByTestId('insight-counts')).toContainText('2')

  // Every row it lists is a real row in the insight, shown by its Mongo _id
  await expect(status.getByTestId('insight-row')).toHaveCount(fake.rows.length)
  for (const row of fake.rows) await expect(status).toContainText(row._id)
  await page.screenshot({ path: `${SHOTS}12-insight-status.png` })

  // --- A connector that cannot be read says so, in the dialog and on the chip
  fake.breakReads = true
  await status.getByRole('button', { name: 'Re-check' }).click()
  await expect(status.getByTestId('insight-banner')).toContainText(`Insight ${INSIGHT_ID} not found.`)
  await expect(chip).toHaveClass(/app-env-failed/)
  await page.screenshot({ path: `${SHOTS}13-insight-status-error.png` })

  expect(errors).toEqual([])
})
