import type { CategorySummary } from '../../types'
import { categoryHref } from '../../hooks/useHashRoute'
import { formatDateTime } from '../../utils/format'
import { KebabMenu } from '../ui/Menu'
import { ClipboardListIcon, PencilIcon, TrashIcon } from '../ui/Icons'

interface CategoryCardProps {
  category: CategorySummary
  onEdit: () => void
  onDelete: () => void
}

export function CategoryCard({ category, onEdit, onDelete }: CategoryCardProps) {
  return (
    <article className="category-card" data-testid="category-card">
      <div className="category-card-top">
        <span className="category-card-icon">
          <ClipboardListIcon size={20} />
        </span>
        <div className="category-card-actions">
          {category.testCount === null ? (
            <span className="chip chip-gray">No master</span>
          ) : (
            <span className="chip chip-blue">
              <strong className="chip-num">{category.testCount}</strong> {category.testCount === 1 ? 'test' : 'tests'}
            </span>
          )}
          <KebabMenu
            label={`Actions for ${category.name}`}
            items={[
              { label: 'Edit', icon: <PencilIcon size={16} />, onSelect: onEdit },
              // Default categories must always exist, so they offer no Delete.
              ...(category.isDefault
                ? []
                : [{ label: 'Delete', icon: <TrashIcon size={16} />, danger: true, onSelect: onDelete }]),
            ]}
          />
        </div>
      </div>
      <h3 className="category-card-title">
        {/* Stretched link: the whole card is clickable while the menu stays a separate control. */}
        <a href={categoryHref(category.id)} className="category-card-link">
          {category.name}
        </a>
      </h3>
      <p className="category-card-desc" title={category.description || undefined}>
        {category.description || <span className="muted">No description</span>}
      </p>
      <div className="category-card-footer">
        <span className="category-card-updated">Last Updated : {formatDateTime(category.lastUpdated)}</span>
      </div>
    </article>
  )
}

export function CategoryCardSkeleton() {
  return (
    <div className="category-card category-card-skeleton" aria-hidden="true">
      <div className="skeleton" style={{ width: 36, height: 36, borderRadius: 8 }} />
      <div className="skeleton" style={{ width: '62%', height: 16, marginTop: 14 }} />
      <div className="skeleton" style={{ width: '44%', height: 12, marginTop: 8 }} />
      <div className="skeleton" style={{ width: '70%', height: 10, marginTop: 22 }} />
    </div>
  )
}
