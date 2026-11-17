import { useCallback, useEffect, useState } from 'react'
import { errorMessage } from '../utils/format'

export type AsyncState<T> = { status: 'loading' } | { status: 'error'; error: string } | { status: 'ready'; data: T }

/** Runs `fetcher` on mount (and whenever it changes); `fetcher` must be stable (module function or useCallback). */
export function useAsync<T>(fetcher: () => Promise<T>) {
  const [state, setState] = useState<AsyncState<T>>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    fetcher().then(
      (data) => active && setState({ status: 'ready', data }),
      (err) => active && setState({ status: 'error', error: errorMessage(err) }),
    )
    return () => {
      active = false
    }
  }, [fetcher, attempt])

  /** Shows the loading state and fetches again, e.g. for "Try again". */
  const retry = useCallback(() => {
    setState({ status: 'loading' })
    setAttempt((n) => n + 1)
  }, [])

  /** Re-fetches while keeping current data on screen, returning what the server sent. Rejects if the fetch fails. */
  const refresh = useCallback(async () => {
    const data = await fetcher()
    setState({ status: 'ready', data })
    return data
  }, [fetcher])

  return { state, retry, refresh }
}
