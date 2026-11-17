import { useState, type FormEvent } from 'react'
import { Dialog } from '../ui/Dialog'
import { errorMessage } from '../../utils/format'

interface CategoryFormDialogProps {
  mode: 'create' | 'edit'
  initial?: { name: string; description: string }
  existingNames: string[]
  onSubmit: (values: { name: string; description: string }) => Promise<void>
  onClose: () => void
}

const NAME_MAX = 80
const DESC_MAX = 160

export function CategoryFormDialog({ mode, initial, existingNames, onSubmit, onClose }: CategoryFormDialogProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [touched, setTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const trimmed = name.trim()
  const duplicate =
    trimmed.length > 0 &&
    trimmed.toLowerCase() !== initial?.name.trim().toLowerCase() &&
    existingNames.some((n) => n.trim().toLowerCase() === trimmed.toLowerCase())
  const nameError = !trimmed ? 'Enter a category name.' : duplicate ? 'A category with this name already exists.' : null

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (nameError) return
    setSaving(true)
    setError(null)
    try {
      await onSubmit({ name: trimmed, description: description.trim() })
    } catch (err) {
      setError(errorMessage(err))
      setSaving(false)
    }
  }

  return (
    <Dialog
      open
      title={mode === 'create' ? 'New category' : 'Edit category'}
      subtitle={mode === 'create' ? 'Group test masters by product line, e.g. "W/M - Washing Machine".' : undefined}
      onClose={onClose}
      busy={saving}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" form="category-form" className="btn btn-primary" disabled={saving}>
            {saving && <span className="spinner" />}
            {mode === 'create' ? 'Create category' : 'Save changes'}
          </button>
        </>
      }
    >
      <form id="category-form" onSubmit={submit} noValidate style={{ display: 'contents' }}>
        <label className="field">
          <span className="field-label">Name</span>
          <input
            className="input"
            value={name}
            maxLength={NAME_MAX}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => setTouched(true)}
            aria-invalid={touched && !!nameError}
            placeholder="e.g. REF - Refrigerator"
          />
          {touched && nameError && <span className="field-error">{nameError}</span>}
        </label>
        <label className="field">
          <span className="field-label">
            Description <span className="muted">(optional)</span>
          </span>
          <textarea
            className="input"
            value={description}
            maxLength={DESC_MAX}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Shown under the name on the category card"
            rows={3}
          />
          <span className="field-hint">
            {description.length}/{DESC_MAX}
          </span>
        </label>
        {error && (
          <div className="alert alert-error" role="alert">
            {error}
          </div>
        )}
      </form>
    </Dialog>
  )
}
