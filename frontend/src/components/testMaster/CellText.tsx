import { isUnspecified } from '../../services/testItemText'

/** Renders long spec/criteria text clamped to N lines, with the source's placeholder shown muted. */
export function CellText({ text, lines = 3 }: { text: string; lines?: number }) {
  if (isUnspecified(text)) return <span className="unspecified">Not specified</span>
  return (
    <span className="clamp" style={{ WebkitLineClamp: lines }}>
      {text}
    </span>
  )
}
