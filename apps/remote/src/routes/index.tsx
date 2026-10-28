import { createFileRoute } from '@tanstack/react-router'
import Counter from '../Counter'
export const Route = createFileRoute('/')({ component: Home })
function Home() { return <main><h1>TanStack Start remote</h1><Counter /></main> }
