const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const pad = (n: number) => String(n).padStart(2, '0')

/** "29 Jul 2026, 3:44 AM" — matches the I/O Sense card format. */
export function formatDateTime(ms: number | null | undefined): string {
  if (!ms) return '—'
  const d = new Date(ms)
  const hours = d.getHours() % 12 || 12
  return `${pad(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${hours}:${pad(d.getMinutes())} ${d.getHours() < 12 ? 'AM' : 'PM'}`
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return typeof err === 'string' ? err : 'Something went wrong.'
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
