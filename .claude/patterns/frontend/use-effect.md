### useEffect Best Practices: You Might Not Need an Effect

**Critical principle: Effects are for synchronizing with external systems. Most component logic does NOT need Effects.**

#### When NOT to Use useEffect

##### 1. Transforming Data for Rendering

NEVER use Effects to calculate derived state. Calculate during render instead.

```typescript
// WRONG: Causes unnecessary render cycles and stale state
const [fullName, setFullName] = useState('')
useEffect(() => {
  setFullName(firstName + ' ' + lastName)
}, [firstName, lastName])

// CORRECT: Calculate directly during render
const fullName = firstName + ' ' + lastName
```

```typescript
// WRONG: Syncing state that's derived from props
const [items, setItems] = useState([])
useEffect(() => {
  setItems(rawItems.filter(item => item.active))
}, [rawItems])

// CORRECT: Compute during render
const items = rawItems.filter(item => item.active)
```

**Why this matters:** Effects run AFTER render, causing extra re-renders and potential stale state bugs.

##### 2. Handling User Events

Event-specific logic belongs in event handlers, NOT Effects. Effects don't know what triggered them.

```typescript
// WRONG: Using Effect for user interaction
const [count, setCount] = useState(0)
useEffect(() => {
  if (count > 0) {
    toast.success('Item added!')
  }
}, [count])

function handleAddClick() {
  setCount(c => c + 1)
}

// CORRECT: Handle in event handler
function handleAddClick() {
  const newCount = count + 1
  setCount(newCount)
  toast.success('Item added!')
}
```

**Why this matters:** Event handlers have context about what happened. Effects lose that context.

##### 3. Chaining State Updates

Don't use multiple Effects to chain state updates. Handle in a single event handler or function.

```typescript
// WRONG: Chaining Effects (causes multiple renders)
useEffect(() => {
  setB(computeB(a))
}, [a])

useEffect(() => {
  setC(computeC(b))
}, [b])

// CORRECT: Single event handler or derived values
function handleUpdate(newA) {
  setA(newA)
  const newB = computeB(newA)
  setB(newB)
  setC(computeC(newB))
}

// OR BETTER: Derive what you can
const b = computeB(a)
const c = computeC(b)
```

#### What to Use Instead

##### Use useMemo for Expensive Calculations

```typescript
// Cache expensive computations
const visibleTodos = useMemo(
  () => filterTodos(todos, filter),
  [todos, filter]
)

// NOT this
const [visibleTodos, setVisibleTodos] = useState([])
useEffect(() => {
  setVisibleTodos(filterTodos(todos, filter))
}, [todos, filter])
```

##### Use key Prop to Reset Component State

```typescript
// CORRECT: Automatic state reset when userId changes
<ProfileEditor userId={userId} key={userId} />

// NOT this
function ProfileEditor({ userId }) {
  useEffect(() => {
    setFormData(initialData)
  }, [userId])
}
```

React treats different `key` values as completely different components.

##### Adjust State During Rendering (Rare)

For the rare case where you need to adjust state based on prop changes:

```typescript
// Acceptable pattern (but key prop is usually better)
function List({ items }) {
  const [selection, setSelection] = useState(null)

  // Adjust state during render if selection is invalid
  const validSelection = items.find(item => item.id === selection?.id) ?? null
  if (selection !== validSelection) {
    setSelection(validSelection)
  }

  return <div>{/* render */}</div>
}
```

**Warning:** This pattern is rarely needed. Prefer calculating derived values or using the `key` prop.

#### When Effects ARE Appropriate

Effects should ONLY be used for synchronizing with external systems:

##### Legitimate Effect Use Cases:

1. **Data fetching** (though TanStack Query is better)
2. **Setting up subscriptions** (WebSocket, event listeners)
3. **Manually manipulating DOM** (focus management, scroll position)
4. **Analytics tracking**
5. **Integration with non-React libraries**

##### Proper Data Fetching Pattern with Race Condition Handling

```typescript
// CORRECT: Handle race conditions with cleanup
function SearchResults({ query }) {
  const [results, setResults] = useState([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    let ignore = false
    setIsLoading(true)

    fetchResults(query).then(data => {
      if (!ignore) {
        setResults(data)
        setIsLoading(false)
      }
    })

    return () => {
      ignore = true
    }
  }, [query])

  return <ResultsList results={results} loading={isLoading} />
}
```

**Better:** Use TanStack Query which handles this automatically:

```typescript
// BEST: Let TanStack Query handle caching, race conditions, loading states
function SearchResults({ query }) {
  const { data: results, isLoading } = useQuery({
    queryKey: ['search', query],
    queryFn: () => fetchResults(query),
  })

  return <ResultsList results={results} loading={isLoading} />
}
```

##### One-Time Initialization

```typescript
// For app-level initialization that should run once
let didInit = false

function App() {
  useEffect(() => {
    if (!didInit) {
      didInit = true
      loadDataFromLocalStorage()
      initializeAnalytics()
    }
  }, [])
}

// Or at module level (outside component)
if (typeof window !== 'undefined') {
  checkAuthToken()
  setupGlobalErrorHandler()
}
```
