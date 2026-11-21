import { useCallback, useRef, useState, type ChangeEvent } from 'react'
import type { ParsedTestMaster } from '../../types'
import { getCategory, getTestMaster, saveTestMaster } from '../../services/testMasterStore'
import { useAsync } from '../../hooks/useAsync'
import { errorMessage, plural } from '../../utils/format'
import { AppShell } from '../layout/AppShell'
import { AlertTriangleIcon, ArrowLeftIcon, RefreshIcon, UploadIcon } from '../ui/Icons'
import { useToast } from '../ui/toastContext'
import { TestMasterView } from './TestMasterView'
import { UploadDropzone } from './UploadDropzone'
import { UploadPreviewDialog } from './UploadPreviewDialog'
import './TestMaster.css'

const ACCEPTED_EXTENSIONS = ['.xlsx', '.xls', '.xlsm']
const MAX_FILE_BYTES = 10 * 1024 * 1024

export function CategoryDetailPage({ categoryId }: { categoryId: string }) {
  const toast = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [parsingFile, setParsingFile] = useState<string | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [preview, setPreview] = useState<ParsedTestMaster[] | null>(null)

  const fetchPage = useCallback(async () => {
    const [category, master] = await Promise.all([getCategory(categoryId), getTestMaster(categoryId)])
    return { category, master }
  }, [categoryId])
  const { state, retry, refresh } = useAsync(fetchPage)

  const category = state.status === 'ready' ? state.data.category : null
  const master = state.status === 'ready' ? state.data.master : null

  const handleFile = async (file: File) => {
    setParseError(null)
    const reportError = (message: string) => {
      setParseError(message)
      if (master) toast.show(message, 'error')
    }
    if (!ACCEPTED_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext))) {
      reportError(`"${file.name}" isn't an Excel file. Upload a .xlsx or .xls file.`)
      return
    }
    if (file.size > MAX_FILE_BYTES) {
      reportError('That file is larger than 10 MB. Remove unused sheets or images and try again.')
      return
    }
    setParsingFile(file.name)
    try {
      // Loaded on demand: the spreadsheet library is most of the bundle and only needed for uploads.
      const [{ parseTestMasterWorkbook, ExcelParseError }, buffer] = await Promise.all([
        import('../../services/excelParser'),
        file.arrayBuffer(),
      ])
      try {
        setPreview(parseTestMasterWorkbook(buffer, file.name))
      } catch (err) {
        reportError(err instanceof ExcelParseError ? err.message : `Couldn't read "${file.name}": ${errorMessage(err)}`)
      }
    } catch (err) {
      reportError(`Couldn't read "${file.name}": ${errorMessage(err)}`)
    } finally {
      setParsingFile(null)
    }
  }

  const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow picking the same file again
    if (file) void handleFile(file)
  }

  const handleSave = async (parsed: ParsedTestMaster) => {
    if (!category) return
    await saveTestMaster(category, parsed)

    // Read the master back out of the database, so the confirmation reflects what was
    // actually stored rather than what the browser just sent.
    let stored: number | null = null
    try {
      stored = (await refresh()).master?.items.length ?? 0
    } catch (err) {
      toast.show(`Saved, but couldn't read it back: ${errorMessage(err)}`, 'error')
    }
    setPreview(null)

    if (stored === null) return
    if (stored === parsed.items.length) {
      toast.show(`Saved ${plural(stored, 'test')} to ${category.name} — verified in MongoDB`)
    } else {
      toast.show(
        `Saved, but MongoDB returned ${plural(stored, 'test')} of ${parsed.items.length}. Check the database status.`,
        'error',
      )
    }
  }

  const pickFile = () => fileInputRef.current?.click()

  return (
    <AppShell crumb={category?.name}>
      <input
        ref={fileInputRef}
        type="file"
        accept={`${ACCEPTED_EXTENSIONS.join(',')},application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel`}
        hidden
        onChange={onInputChange}
        data-testid="file-input"
      />

      {state.status === 'loading' && (
        <div className="page-state" aria-busy="true">
          <span className="spinner spinner-lg" />
          <p>Loading test master…</p>
        </div>
      )}

      {state.status === 'error' && (
        <div className="page-state" role="alert">
          <span className="page-state-icon page-state-icon-error">
            <AlertTriangleIcon size={22} />
          </span>
          <h2>Couldn't load this category</h2>
          <p>{state.error}</p>
          <button type="button" className="btn btn-secondary" onClick={retry}>
            <RefreshIcon size={16} />
            Try again
          </button>
        </div>
      )}

      {state.status === 'ready' && !category && (
        <div className="page-state">
          <h2>Category not found</h2>
          <p>It may have been deleted.</p>
          <a className="btn btn-secondary" href="#/">
            <ArrowLeftIcon size={16} />
            All categories
          </a>
        </div>
      )}

      {category && (
        <>
          <div className="detail-head">
            <a href="#/" className="icon-btn detail-back" aria-label="Back to categories">
              <ArrowLeftIcon size={20} />
            </a>
            <div className="detail-titles">
              <h1 className="detail-title">{category.name}</h1>
              {category.description && <p className="detail-desc">{category.description}</p>}
            </div>
            {master && (
              <button type="button" className="btn btn-secondary" onClick={pickFile} disabled={!!parsingFile}>
                {parsingFile ? <span className="spinner" /> : <UploadIcon size={16} />}
                {parsingFile ? 'Reading…' : 'Replace Excel'}
              </button>
            )}
          </div>

          {master ? (
            <TestMasterView key={master.uploadId} master={master} />
          ) : (
            <UploadDropzone
              categoryName={category.name}
              parsingFile={parsingFile}
              error={parseError}
              onPick={pickFile}
              onFile={(file) => void handleFile(file)}
            />
          )}

          {preview && (
            <UploadPreviewDialog sheets={preview} existing={master} onSave={handleSave} onClose={() => setPreview(null)} />
          )}
        </>
      )}
    </AppShell>
  )
}
