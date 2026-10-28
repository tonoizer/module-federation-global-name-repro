import { createFileRoute } from '@tanstack/react-router'
import { lazy, Suspense, useEffect, useState } from 'react'

const RemoteCounter = lazy(() => import('remote/Counter'))
export const Route = createFileRoute('/')({ component: Home })
function Home() {
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => setHydrated(true), [])
  return <main><h1>TanStack Start Federation name lab</h1>
    <p data-testid="hydration">{hydrated ? 'hydrated' : 'server-rendered'}</p>
    <Suspense fallback={<p>Loading remote…</p>}><RemoteCounter /></Suspense>
  </main>
}
