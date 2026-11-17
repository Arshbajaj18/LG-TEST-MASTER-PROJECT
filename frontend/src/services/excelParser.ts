import * as XLSX from 'xlsx'
import type { ParsedTestMaster, TestItem } from '../types'

type Field = 'testName' | 'sampleQuantity' | 'criteria' | 'specification' | 'partName'

/**
 * Header matchers run against lowercase letters-only header text, in this order.
 * They tolerate the spellings seen in LG masters ("Spcification", "Judgement creteria").
 */
const FIELD_MATCHERS: [Field, RegExp][] = [
  ['testName', /test(name|item|title)|^test$/],
  ['sampleQuantity', /sample|qty|quantity/],
  ['criteria', /crit|creteri|judg|condition/],
  ['specification', /spe?cification|^spec|method|procedure/],
  ['partName', /part|component|material/],
]

export const FIELD_LABELS: Record<Field, string> = {
  partName: 'Part Name',
  testName: 'Test Name',
  specification: 'Specification',
  criteria: 'Condition / Judgement criteria',
  sampleQuantity: 'Sample quantity',
}

const HEADER_SCAN_ROWS = 20

const normalizeHeader = (value: unknown) => String(value ?? '').toLowerCase().replace(/[^a-z]/g, '')

const cleanInline = (value: unknown) => String(value ?? '').replace(/\s+/g, ' ').trim()

const cleanBlock = (value: unknown) =>
  String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t ]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')

function parseQuantity(value: unknown): number | string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const text = cleanInline(value)
  if (!text) return null
  const n = Number(text)
  return Number.isFinite(n) ? n : text
}

interface HeaderMatch {
  rowIndex: number
  columns: Map<number, Field>
  labels: string[]
}

function findHeader(rows: unknown[][]): HeaderMatch | null {
  let best: HeaderMatch | null = null
  for (let i = 0; i < Math.min(rows.length, HEADER_SCAN_ROWS); i++) {
    const row = rows[i] ?? []
    const columns = new Map<number, Field>()
    const used = new Set<Field>()
    row.forEach((cell, col) => {
      const h = normalizeHeader(cell)
      if (!h) return
      const hit = FIELD_MATCHERS.find(([field, re]) => !used.has(field) && re.test(h))
      if (hit) {
        columns.set(col, hit[0])
        used.add(hit[0])
      }
    })
    if (!used.has('testName')) continue
    if (!best || columns.size > best.columns.size) {
      best = { rowIndex: i, columns, labels: row.map((c) => cleanInline(c)) }
    }
  }
  return best
}

function parseSheet(sheet: XLSX.WorkSheet, sheetName: string, fileName: string): ParsedTestMaster | null {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', blankrows: true, raw: true })
  const header = findHeader(rows)
  if (!header) return null

  const firstRow = sheet['!ref'] ? XLSX.utils.decode_range(sheet['!ref']).s.r : 0
  const items: TestItem[] = []
  const warnings: string[] = []
  const missingName: number[] = []

  for (let i = header.rowIndex + 1; i < rows.length; i++) {
    const row = rows[i] ?? []
    const values: Partial<Record<Field, unknown>> = {}
    const extra: Record<string, string> = {}
    row.forEach((cell, col) => {
      const field = header.columns.get(col)
      if (field) values[field] = cell
      else if (header.labels[col] && cleanInline(cell)) extra[header.labels[col]] = cleanBlock(cell)
    })

    const testName = cleanInline(values.testName)
    const partName = cleanInline(values.partName)
    const specification = cleanBlock(values.specification)
    const criteria = cleanBlock(values.criteria)
    if (!testName && !partName && !specification && !criteria) continue

    const rowNumber = firstRow + i + 1
    if (!testName) missingName.push(rowNumber)
    items.push({
      row: rowNumber,
      partName,
      testName,
      specification,
      criteria,
      sampleQuantity: parseQuantity(values.sampleQuantity),
      ...(Object.keys(extra).length ? { extra } : {}),
    })
  }

  const mapped = new Set(header.columns.values())
  for (const [field] of FIELD_MATCHERS) {
    if (!mapped.has(field)) warnings.push(`No "${FIELD_LABELS[field]}" column found — that field will be empty.`)
  }
  if (missingName.length) {
    warnings.push(`${missingName.length} row(s) have no test name (rows ${missingName.slice(0, 8).join(', ')}${missingName.length > 8 ? ', …' : ''}).`)
  }

  const noQty = items.filter((item) => item.sampleQuantity === null).length
  if (noQty) warnings.push(`${noQty} test(s) have no sample quantity.`)

  return {
    fileName,
    sheetName,
    columns: header.labels.filter(Boolean),
    items,
    warnings,
  }
}

export class ExcelParseError extends Error {}

/** Parses every sheet that looks like a test master; sheets with the most items come first. */
export function parseTestMasterWorkbook(data: ArrayBuffer, fileName: string): ParsedTestMaster[] {
  let workbook: XLSX.WorkBook
  try {
    workbook = XLSX.read(data, { type: 'array', dense: true })
  } catch {
    throw new ExcelParseError('This file could not be read as an Excel workbook.')
  }

  const parsed = workbook.SheetNames.map((name) => parseSheet(workbook.Sheets[name], name, fileName)).filter(
    (sheet): sheet is ParsedTestMaster => sheet !== null && sheet.items.length > 0,
  )
  if (parsed.length === 0) {
    throw new ExcelParseError(
      'No test items found. The sheet needs a header row with a "Test Name" column (plus Part Name, Specification, Condition/Judgement criteria and Sample quantity).',
    )
  }
  return parsed.sort((a, b) => b.items.length - a.items.length)
}
