import { expect, test, type Page } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import * as XLSX from 'xlsx'
import { categoryDoc, categoryDocs, closeTestDb, DEFAULT_CATEGORIES, resetCollection, testCollection } from './fixtures/testDb.ts'
import { TEST_API_PORT, TEST_COLLECTION, TEST_DATABASE, TEST_MONGO_PORT } from './fixtures/testEnv.ts'

const WM_EXCEL = fileURLToPath(new URL('../../../WM Test master (1).xlsx', import.meta.url))
const SHOTS = fileURLToPath(new URL('../../test-results/screenshots/', import.meta.url))
const API = `http://localhost:${TEST_API_PORT}/api`
const DEFAULT_NAMES = DEFAULT_CATEGORIES.map((c) => c.name)
const WASHING_MACHINE = DEFAULT_CATEGORIES[0]

test.beforeEach(resetCollection)
test.afterAll(closeTestDb)

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

/** Opens the app; there is no sign-in, so it lands straight on the categories. */
async function openApp(page: Page) {
  await page.goto('/')
  await expect(page.getByTestId('category-card')).toHaveCount(DEFAULT_NAMES.length)
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

async function cardNames(page: Page) {
  return page.getByTestId('category-card').locator('.category-card-link').allTextContents()
}

test('no sign-in → default categories → upload WM test master → browse → replace → edit → delete', async ({ page }) => {
  const errors = collectConsoleErrors(page)

  // --- No login: the app opens straight on the categories
  await openApp(page)
  await expect(page.getByRole('heading', { name: /Sign in/ })).toHaveCount(0)

  // --- The seven default categories show, in order, while the database is still empty:
  // listing them writes nothing
  expect(await cardNames(page)).toEqual(DEFAULT_NAMES)
  await expect(page.getByTestId('category-card').first()).toContainText('No master')
  await expect(page.getByTestId('category-card').first()).toContainText('Last Updated : —')
  expect(await categoryDocs()).toHaveLength(0)
  await page.screenshot({ path: `${SHOTS}01-default-categories.png` })

  // Default categories can be edited but not deleted
  await page.getByRole('button', { name: `Actions for ${WASHING_MACHINE.name}` }).click()
  await expect(page.getByRole('menuitem', { name: 'Edit' })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: 'Delete' })).toHaveCount(0)
  await page.keyboard.press('Escape')

  // --- Custom categories are added after the defaults
  await createCategory(page, 'DW - Dishwasher', 'DW - Dishwasher')
  await createCategory(page, 'TV - Television', 'TV - Television')
  expect(await cardNames(page)).toEqual([...DEFAULT_NAMES, 'DW - Dishwasher', 'TV - Television'])
  const dishwasher = await categoryDoc('DW - Dishwasher')
  expect(dishwasher).toMatchObject({ isDefault: false, description: 'DW - Dishwasher', testMaster: null })
  expect(dishwasher?.categoryId).toBe(dishwasher?._id)

  // Search filters cards
  await page.getByRole('searchbox', { name: 'Search categories' }).fill('refri')
  await expect(page.getByTestId('category-card')).toHaveCount(1)
  await page.getByRole('searchbox', { name: 'Search categories' }).fill('')

  // --- Category detail: an unsaved default opens on its empty state
  await page.getByRole('link', { name: WASHING_MACHINE.name, exact: true }).click()
  expect(page.url()).toContain(WASHING_MACHINE.id)
  await expect(page.getByRole('heading', { name: `No test master for ${WASHING_MACHINE.name} yet` })).toBeVisible()
  expect(await testCollection.findOne({ _id: WASHING_MACHINE.id })).toBeNull()
  await page.screenshot({ path: `${SHOTS}02-category-empty.png` })

  // --- Upload real LG test master and review parsed preview
  await page.getByTestId('file-input').setInputFiles(WM_EXCEL)
  const preview = page.getByRole('dialog', { name: 'Review test master' })
  await expect(preview).toBeVisible()
  await expect(preview.getByTestId('preview-count')).toHaveText('94')
  await expect(preview).toContainText('WM Test Master')
  await expect(preview).toContainText('Saves to MongoDB')
  await expect(preview.getByTestId('preview-warnings')).toHaveCount(0)
  await page.screenshot({ path: `${SHOTS}03-upload-preview.png` })

  await preview.getByRole('button', { name: 'Save 94 tests' }).click()
  await expect(preview).toBeHidden()
  await expect(page.getByTestId('summary-tests')).toHaveText('94')
  await expect(page.getByTestId('test-row')).toHaveCount(94)
  // The confirmation reports what the database returned, not what the browser sent
  await expect(page.getByText('verified in MongoDB')).toBeVisible()
  await page.screenshot({ path: `${SHOTS}04-test-master-table.png` })

  // The first upload created the default category's document, with every parsed item
  const wmDoc = await testCollection.findOne({ _id: WASHING_MACHINE.id })
  expect(wmDoc).toMatchObject({ categoryId: WASHING_MACHINE.id, name: WASHING_MACHINE.name, isDefault: true })
  const saved = wmDoc?.testMaster
  // The category id is saved with the test master itself, too
  expect(saved).toMatchObject({ categoryId: WASHING_MACHINE.id, itemCount: 94, fileName: 'WM Test master (1).xlsx' })
  expect(saved?.items).toHaveLength(94)
  // Cells are stored exactly as the sheet holds them: no code or group is derived from the text.
  expect(saved?.items[0]).toMatchObject({
    partName: 'Applicable component / material as specified in the standard',
    testName: 'A-01 – Structure exterior check',
    sampleQuantity: 3,
    row: 2,
  })
  expect(Object.keys(saved?.items[0] ?? {}).sort()).toEqual(
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

  // --- Reload: data comes back from MongoDB
  await page.reload()
  await expect(page.getByTestId('test-row')).toHaveCount(94)

  // --- Replace with a newer file: the document's master is swapped whole
  const firstUpload = saved?.uploadId
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
  // The re-upload updated the same document rather than adding another
  expect(await testCollection.countDocuments({ categoryId: WASHING_MACHINE.id })).toBe(1)
  const replaced = (await testCollection.findOne({ _id: WASHING_MACHINE.id }))?.testMaster
  expect(replaced).toMatchObject({ categoryId: WASHING_MACHINE.id, itemCount: 2 })
  expect(replaced?.uploadId).not.toBe(firstUpload)

  // --- Back to cards: count and last-updated reflect the upload
  await page.getByRole('link', { name: 'Back to categories' }).click()
  const wmCard = page.getByTestId('category-card').filter({ hasText: WASHING_MACHINE.name })
  await expect(wmCard).toContainText('2 tests')
  await expect(wmCard).toContainText('Last Updated :')
  await page.screenshot({ path: `${SHOTS}07-categories-with-master.png` })

  // --- Edit a default: the name is locked, the description can change
  await page.getByRole('button', { name: 'Actions for AC - Air Conditioner' }).click()
  await page.getByRole('menuitem', { name: 'Edit' }).click()
  const editDefault = page.getByRole('dialog', { name: 'Edit category' })
  await expect(editDefault.getByLabel('Name')).not.toBeEditable()
  await expect(editDefault).toContainText('Default categories keep their name.')
  await editDefault.getByLabel(/Description/).fill('Split and window units')
  await page.screenshot({ path: `${SHOTS}08-edit-default.png` })
  await editDefault.getByRole('button', { name: 'Save changes' }).click()
  await expect(editDefault).toBeHidden()
  await expect(page.getByTestId('category-card').filter({ hasText: 'AC - Air Conditioner' })).toContainText(
    'Split and window units',
  )
  // Editing an unsaved default creates its document
  expect(await categoryDoc('AC - Air Conditioner')).toMatchObject({
    categoryId: DEFAULT_CATEGORIES[4].id,
    description: 'Split and window units',
    testMaster: null,
  })

  // --- Edit a custom category's name: still one document
  await page.getByRole('button', { name: 'Actions for TV - Television' }).click()
  await page.getByRole('menuitem', { name: 'Edit' }).click()
  const edit = page.getByRole('dialog', { name: 'Edit category' })
  await edit.getByLabel('Name').fill('TV - Smart Television')
  await edit.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByRole('link', { name: 'TV - Smart Television', exact: true })).toBeVisible()
  // Stored so far: WashingMachine (upload), AC (edit) and the two added categories
  expect((await categoryDocs()).map((d) => d.name).sort()).toEqual(
    ['AC - Air Conditioner', 'DW - Dishwasher', 'TV - Smart Television', WASHING_MACHINE.name].sort(),
  )

  // Duplicate names are rejected, including a default's name
  await page.getByRole('button', { name: 'New category' }).last().click()
  await page.getByRole('dialog', { name: 'New category' }).getByLabel('Name').fill('others')
  await page.getByRole('button', { name: 'Create category' }).click()
  await expect(page.getByText('A category with this name already exists.')).toBeVisible()
  await page.keyboard.press('Escape')

  // --- Delete removes a custom category's document
  await page.getByRole('button', { name: 'Actions for DW - Dishwasher' }).click()
  await page.getByRole('menuitem', { name: 'Delete' }).click()
  await expect(page.getByRole('dialog', { name: 'Delete category?' })).toContainText('permanently removed from the database')
  await page.getByRole('dialog', { name: 'Delete category?' }).getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByTestId('category-card')).toHaveCount(DEFAULT_NAMES.length + 1)
  expect(await testCollection.findOne({ _id: dishwasher!._id })).toBeNull()

  expect(errors).toEqual([])
})

test('default categories always show, whatever is or is not stored for them', async ({ page, request }) => {
  const headers = { 'Content-Type': 'application/json' }
  const upload = (id: string) =>
    request.put(`${API}/testmaster/categories/${id}/master`, {
      headers,
      data: { fileName: 'cf.xlsx', sheetName: 'Sheet1', columns: [], warnings: [], items: [{ row: 2, testName: 'Balance' }] },
    })
  const ceilingFan = DEFAULT_CATEGORIES[2]
  await upload(ceilingFan.id)

  // Someone edits the collection by hand: renames one default's document, adds nothing for the rest
  await testCollection.updateOne({ _id: ceilingFan.id }, { $set: { name: 'Fans' } })
  await openApp(page)
  expect(await cardNames(page)).toEqual(DEFAULT_NAMES)
  await expect(page.getByTestId('category-card').filter({ hasText: ceilingFan.name })).toContainText('1 test')

  // ...or deletes it: the card stays, just without a master
  await testCollection.deleteOne({ _id: ceilingFan.id })
  await page.reload()
  expect(await cardNames(page)).toEqual(DEFAULT_NAMES)
  await expect(page.getByTestId('category-card').filter({ hasText: ceilingFan.name })).toContainText('No master')

  // The API itself refuses to delete or rename a default
  const del = await request.delete(`${API}/testmaster/categories/${WASHING_MACHINE.id}`)
  expect(del.status()).toBe(409)
  expect((await del.json()).errors).toEqual(["Default categories can't be deleted."])
  const rename = await request.put(`${API}/testmaster/categories/${WASHING_MACHINE.id}`, {
    data: { name: 'Washers', description: '' },
  })
  expect(rename.status()).toBe(409)
  // Nor can a new category take a default's name, stored or not
  const clash = await request.post(`${API}/testmaster/categories`, { data: { name: 'washingmachine', description: '' } })
  expect(clash.status()).toBe(409)
})

test('first upload creates the document; a re-upload updates the same one', async ({ request }) => {
  const others = DEFAULT_CATEGORIES[6]
  const upload = (fileName: string, testName: string) =>
    request.put(`${API}/testmaster/categories/${others.id}/master`, {
      data: { fileName, sheetName: 'Sheet1', columns: [], warnings: [], items: [{ row: 2, testName }] },
    })

  // Reading an unsaved default writes nothing
  const before = await request.get(`${API}/testmaster/categories/${others.id}/master`)
  expect((await before.json()).data).toBeNull()
  expect(await testCollection.countDocuments()).toBe(0)

  expect((await upload('v1.xlsx', 'First')).status()).toBe(200)
  const first = await testCollection.findOne({ _id: others.id })
  expect(first).toMatchObject({ categoryId: others.id, name: others.name, isDefault: true })
  expect(first?.testMaster).toMatchObject({ categoryId: others.id, fileName: 'v1.xlsx' })

  expect((await upload('v2.xlsx', 'Second')).status()).toBe(200)
  expect(await testCollection.countDocuments()).toBe(1)
  const second = await testCollection.findOne({ _id: others.id })
  expect(second?.testMaster).toMatchObject({ categoryId: others.id, fileName: 'v2.xlsx' })
  expect(second?.testMaster?.items[0]).toMatchObject({ testName: 'Second' })
})

test('the API needs no credentials and saves the category id on every write', async ({ request }) => {
  const created = await request.post(`${API}/testmaster/categories`, { data: { name: 'DW - Dishwasher', description: '' } })
  expect(created.status()).toBe(201)
  const { id } = (await created.json()).data as { id: string }
  expect(await testCollection.findOne({ _id: id })).toMatchObject({ categoryId: id })

  const master = await request.put(`${API}/testmaster/categories/${id}/master`, {
    data: { fileName: 'dw.xlsx', sheetName: 'Sheet1', columns: [], warnings: [], items: [{ row: 2, testName: 'Spray' }] },
  })
  expect(master.status()).toBe(200)
  expect((await testCollection.findOne({ _id: id }))?.testMaster).toMatchObject({ categoryId: id, itemCount: 1 })

  const read = await request.get(`${API}/testmaster/categories/${id}/master`)
  expect((await read.json()).data).toMatchObject({ categoryId: id, fileName: 'dw.xlsx' })
})

test('large test masters are stored in one document and read back in order', async ({ page }) => {
  const errors = collectConsoleErrors(page)
  await openApp(page)
  await page.getByRole('link', { name: 'Others', exact: true }).click()

  const longText = 'Test condition: Room temperature (20±3℃). '.repeat(14)
  const rows: unknown[][] = [['Part Name', 'Test Name', 'Specification', 'Judgement criteria', 'Sample quantity']]
  for (let i = 1; i <= 400; i++) rows.push([`Part ${i}`, `B-${String(i).padStart(3, '0')} – Test ${i}`, longText, longText, 3])
  await page.getByTestId('file-input').setInputFiles(workbookFile('big.xlsx', rows))
  await page.getByRole('dialog', { name: 'Review test master' }).getByRole('button', { name: 'Save 400 tests' }).click()
  await expect(page.getByTestId('summary-tests')).toHaveText('400')
  expect((await categoryDoc('Others'))?.testMaster?.items).toHaveLength(400)

  await page.reload()
  await expect(page.getByTestId('test-row')).toHaveCount(400)
  await expect(page.getByTestId('test-row').first()).toContainText('B-001')
  await expect(page.getByTestId('test-row').last()).toContainText('B-400')
  expect(errors).toEqual([])
})

test('extra columns survive a round trip, even with "." or "$" in the header', async ({ page }) => {
  await openApp(page)
  await page.getByRole('link', { name: 'Others', exact: true }).click()
  await page.getByTestId('file-input').setInputFiles(
    workbookFile('extras.xlsx', [
      ['No.', 'Part Name', 'Test Name', 'Specification', 'Judgement criteria', 'Sample quantity', '$ Cost'],
      ['1', 'Door', 'Door check', 'Visual', 'No defects', 2, '120'],
    ]),
  )
  await page.getByRole('dialog', { name: 'Review test master' }).getByRole('button', { name: 'Save 1 test' }).click()
  await expect(page.getByTestId('test-row')).toHaveCount(1)

  await page.reload()
  await page.getByTestId('test-row').first().click()
  const drawer = page.getByRole('dialog', { name: /Door check/ })
  await expect(drawer).toContainText('No.')
  await expect(drawer).toContainText('$ Cost')
  await expect(drawer).toContainText('120')
})

test('phone-width layout has no horizontal scroll', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openApp(page)
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
  await openApp(page)
  await page.getByRole('link', { name: 'Others', exact: true }).click()

  await page.getByTestId('file-input').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') })
  await expect(page.getByRole('alert')).toContainText("isn't an Excel file")

  await page.getByTestId('file-input').setInputFiles(workbookFile('wrong.xlsx', [['Name', 'Value'], ['a', 1]]))
  await expect(page.getByRole('alert')).toContainText('No test items found')
  await page.screenshot({ path: `${SHOTS}12-parse-error.png` })
  // A rejected file never reaches the API, so nothing is stored
  expect(await categoryDocs()).toHaveLength(0)
})

test('database status reports what is stored, and surfaces a failure', async ({ page }) => {
  const errors = collectConsoleErrors(page)
  await openApp(page)
  await page.getByRole('link', { name: WASHING_MACHINE.name, exact: true }).click()
  await page.getByTestId('file-input').setInputFiles(
    workbookFile('WM.xlsx', [
      ['Part Name', 'Test Name', 'Spcification', 'Condition/Judgement creteria', 'Sample quantity'],
      ['Door', 'Structure exterior check', 'Visual check', 'No defects', 5],
      ['Hose', 'Hose pressure resistance', 'Pressure tester', 'No leak', 3],
    ]),
  )
  await page.getByRole('dialog', { name: 'Review test master' }).getByRole('button', { name: 'Save 2 tests' }).click()
  await expect(page.getByTestId('summary-tests')).toHaveText('2')

  // --- The header chip is the deployment check: green only after a real read of the collection
  const chip = page.getByTestId('storage-status')
  await expect(chip).toHaveClass(/app-env-ok/)
  await expect(chip).toContainText(`MongoDB · 127.0.0.1:${TEST_MONGO_PORT}`)
  await chip.click()
  const status = page.getByRole('dialog', { name: 'Database status' })
  await expect(status.getByTestId('storage-banner')).toContainText(
    `Connected — read ${TEST_DATABASE}.${TEST_COLLECTION} successfully.`,
  )
  await expect(status.getByTestId('storage-host')).toHaveText(`127.0.0.1:${TEST_MONGO_PORT}`)
  await expect(status.getByTestId('storage-collection')).toHaveText(`${TEST_DATABASE}.${TEST_COLLECTION}`)
  // Only what is actually stored is counted: the one default with an upload
  const counts = status.getByTestId('storage-counts').locator('.stat-value')
  await expect(counts).toHaveText(['1', '1', '2'])

  // Every document it lists is a real document in the collection, shown by its _id
  const docs = await categoryDocs()
  expect(docs.map((d) => d._id)).toEqual([WASHING_MACHINE.id])
  await expect(status.getByTestId('storage-row')).toHaveCount(docs.length)
  for (const doc of docs) await expect(status).toContainText(doc._id)
  await page.screenshot({ path: `${SHOTS}13-database-status.png` })
  // Checked before the simulated outage, whose 503 the browser logs as a console error.
  expect(errors).toEqual([])

  // --- A database that cannot be read says so, in the dialog and on the chip
  await page.route('**/api/testmaster/status', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ success: false, errors: ['MongoDB at 10.102.120.46:27018 is not reachable.'] }),
    }),
  )
  await status.getByRole('button', { name: 'Re-check' }).click()
  await expect(status.getByTestId('storage-banner')).toContainText('MongoDB at 10.102.120.46:27018 is not reachable.')
  await expect(chip).toHaveClass(/app-env-failed/)
  await page.screenshot({ path: `${SHOTS}14-database-status-error.png` })
})
