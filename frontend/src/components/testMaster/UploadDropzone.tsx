import { useState, type DragEvent } from 'react'
import { AlertTriangleIcon, FileSpreadsheetIcon, UploadIcon } from '../ui/Icons'

interface UploadDropzoneProps {
  categoryName: string
  parsingFile: string | null
  error: string | null
  onPick: () => void
  onFile: (file: File) => void
}

export function UploadDropzone({ categoryName, parsingFile, error, onPick, onFile }: UploadDropzoneProps) {
  const [dragging, setDragging] = useState(false)

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) onFile(file)
  }

  return (
    <section
      className={`dropzone${dragging ? ' dropzone-active' : ''}`}
      data-testid="dropzone"
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false)
      }}
      onDrop={onDrop}
    >
      {parsingFile ? (
        <>
          <span className="spinner spinner-lg" />
          <h2 className="dropzone-title">Reading {parsingFile}…</h2>
        </>
      ) : (
        <>
          <span className="dropzone-icon">
            <FileSpreadsheetIcon size={26} />
          </span>
          <h2 className="dropzone-title">No test master for {categoryName} yet</h2>
          <p className="dropzone-text">
            Drop the test master Excel here, or choose a file. You'll review the parsed test items before anything is
            saved.
          </p>
          <button type="button" className="btn btn-primary" onClick={onPick}>
            <UploadIcon size={16} />
            Upload Excel
          </button>
          <p className="dropzone-hint">
            .xlsx or .xls · columns: Part Name, Test Name, Specification, Condition/Judgement criteria, Sample quantity
          </p>
        </>
      )}
      {error && (
        <div className="alert alert-error dropzone-error" role="alert">
          <AlertTriangleIcon size={16} />
          <span>{error}</span>
        </div>
      )}
    </section>
  )
}
