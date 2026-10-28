import { useState } from 'react'
export default function Counter() {
  const [count, setCount] = useState(0)
  return <section data-testid="remote"><p>Federated remote rendered</p>
    <button data-testid="counter" onClick={() => setCount(count + 1)}>Remote count: {count}</button>
  </section>
}
