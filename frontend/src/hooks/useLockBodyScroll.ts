import { useEffect } from 'react'

/** Stops the page behind a modal/drawer from scrolling while it is open. */
export function useLockBodyScroll(active: boolean) {
  useEffect(() => {
    if (!active) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [active])
}
