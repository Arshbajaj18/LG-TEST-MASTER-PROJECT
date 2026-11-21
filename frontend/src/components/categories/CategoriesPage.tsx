import { useMemo, useState } from 'react'
import type { CategorySummary } from '../../types'
import { createCategory, deleteCategory, listCategorySummaries, updateCategory } from '../../services/testMasterStore'
import { useAsync } from '../../hooks/useAsync'
import { errorMessage, plural } from '../../utils/format'
import { AppShell } from '../layout/AppShell'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { AlertTriangleIcon, ClipboardListIcon, PlusIcon, RefreshIcon, SearchIcon } from '../ui/Icons'
import { useToast } from '../ui/toastContext'
import { CategoryCard, CategoryCardSkeleton } from './CategoryCard'
import { CategoryFormDialog } from './CategoryFormDialog'
import './CategoriesPage.css'

type Editing = { mode: 'create' } | { mode: 'edit'; category: CategorySummary } | null

export function CategoriesPage() {
  const toast = useToast()
  const { state, retry, refresh } = useAsync(listCategorySummaries)
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Editing>(null)
  const [deleting, setDeleting] = useState<CategorySummary | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)

  const categories = state.status === 'ready' ? state.data : null
  const loadError = state.status === 'error' ? state.error : null

  const refreshQuietly = () => refresh().catch((err) => toast.show(`Couldn't refresh: ${errorMessage(err)}`, 'error'))

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!categories || !q) return categories
    return categories.filter((c) => `${c.name} ${c.description}`.toLowerCase().includes(q))
  }, [categories, query])

  const handleSubmit = async (values: { name: string; description: string }) => {
    if (editing?.mode === 'edit') {
      await updateCategory(editing.category.id, values.name, values.description)
      toast.show(`Updated "${values.name}"`)
    } else {
      await createCategory(values.name, values.description)
      toast.show(`Created "${values.name}"`)
    }
    await refreshQuietly()
    setEditing(null)
  }

  const handleDelete = async () => {
    if (!deleting) return
    setDeleteBusy(true)
    try {
      await deleteCategory(deleting.id)
      toast.show(`Deleted "${deleting.name}"`)
      await refreshQuietly()
      setDeleting(null)
    } catch (err) {
      toast.show(errorMessage(err), 'error')
    } finally {
      setDeleteBusy(false)
    }
  }

  return (
    <AppShell>
      <div className="search-input categories-search">
        <SearchIcon size={18} />
        <input
          className="input"
          type="search"
          placeholder="Search..."
          aria-label="Search categories"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {loadError ? (
        <div className="page-state" role="alert">
          <span className="page-state-icon page-state-icon-error">
            <AlertTriangleIcon size={22} />
          </span>
          <h2>Couldn't load categories</h2>
          <p>{loadError}</p>
          <button type="button" className="btn btn-secondary" onClick={retry}>
            <RefreshIcon size={16} />
            Try again
          </button>
        </div>
      ) : filtered === null ? (
        <div className="category-grid" aria-busy="true" aria-label="Loading categories">
          {Array.from({ length: 5 }, (_, i) => (
            <CategoryCardSkeleton key={i} />
          ))}
        </div>
      ) : categories?.length === 0 ? (
        <div className="page-state">
          <span className="page-state-icon">
            <ClipboardListIcon size={22} />
          </span>
          <h2>No categories yet</h2>
          <p>Create a category for each product line, then upload its test master Excel.</p>
          <button type="button" className="btn btn-primary" onClick={() => setEditing({ mode: 'create' })}>
            <PlusIcon size={16} />
            New category
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="page-state">
          <h2>No matches</h2>
          <p>No categories match “{query.trim()}”.</p>
        </div>
      ) : (
        <>
          <p className="sr-only" aria-live="polite">
            {plural(filtered.length, 'category', 'categories')}
          </p>
          <div className="category-grid">
            {filtered.map((category) => (
              <CategoryCard
                key={category.id}
                category={category}
                onEdit={() => setEditing({ mode: 'edit', category })}
                onDelete={() => setDeleting(category)}
              />
            ))}
          </div>
        </>
      )}

      <button
        type="button"
        className="fab"
        aria-label="New category"
        title="New category"
        onClick={() => setEditing({ mode: 'create' })}
      >
        <PlusIcon size={24} strokeWidth={2.2} />
      </button>

      {editing && (
        <CategoryFormDialog
          mode={editing.mode}
          initial={editing.mode === 'edit' ? editing.category : undefined}
          nameLocked={editing.mode === 'edit' && editing.category.isDefault}
          existingNames={(categories ?? []).map((c) => c.name)}
          onSubmit={handleSubmit}
          onClose={() => setEditing(null)}
        />
      )}

      <ConfirmDialog
        open={deleting !== null}
        title="Delete category?"
        message={
          <>
            <strong>{deleting?.name}</strong> and its test master
            {deleting?.testCount ? ` (${plural(deleting.testCount, 'test')})` : ''} will be permanently removed from the
            database. This can't be undone.
          </>
        }
        confirmLabel="Delete"
        busy={deleteBusy}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleting(null)}
      />
    </AppShell>
  )
}
