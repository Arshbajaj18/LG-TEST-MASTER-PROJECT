import { useCallback, useEffect, useState } from 'react'

export type Route = { name: 'categories' } | { name: 'category'; categoryId: string }

function parse(hash: string): Route {
  const match = hash.replace(/^#/, '').match(/^\/categories\/([^/?#]+)/)
  return match ? { name: 'category', categoryId: decodeURIComponent(match[1]) } : { name: 'categories' }
}

export const categoryHref = (categoryId: string) => `#/categories/${encodeURIComponent(categoryId)}`

/** Hash routing keeps deep links working wherever the build is hosted on-prem, with no server rewrites. */
export function useHashRoute() {
  const [route, setRoute] = useState<Route>(() => parse(window.location.hash))

  useEffect(() => {
    const onChange = () => {
      setRoute(parse(window.location.hash))
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  const navigate = useCallback((hash: string) => {
    window.location.hash = hash
  }, [])

  return { route, navigate }
}
