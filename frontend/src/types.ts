export interface Category {
  id: string
  name: string
  description: string
  /** Mongo _id of the insight result row backing this category. */
  resultId: string
  updatedAt: number
  updatedBy: string
}

export interface CategorySummary extends Category {
  testCount: number | null
  fileName: string | null
  /** Latest of category edit and test master upload. */
  lastUpdated: number
}

/** One sheet row, stored exactly as the five test-master columns contain it. */
export interface TestItem {
  /** 1-based row number in the source sheet, for traceability back to Excel. */
  row: number
  partName: string
  testName: string
  specification: string
  criteria: string
  sampleQuantity: number | string | null
  extra?: Record<string, string>
}

export interface ParsedTestMaster {
  fileName: string
  sheetName: string
  columns: string[]
  items: TestItem[]
  warnings: string[]
}

export interface TestMaster extends ParsedTestMaster {
  categoryId: string
  uploadId: string
  uploadedAt: number
  uploadedBy: string
}
