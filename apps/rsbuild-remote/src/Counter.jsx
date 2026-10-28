import { useState } from 'react'
export default function Counter() {
  const [count, setCount] = useState(0)
  return <section><p>Rsbuild federated remote</p>
    <button data-testid="rsbuild-counter" onClick={() => setCount(count + 1)}>Remote count: {count}</button>
  </section>
}
