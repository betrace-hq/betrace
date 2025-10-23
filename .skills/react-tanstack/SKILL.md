---
name: React Tanstack Expert
description: Provides React patterns, Tanstack Router/Query usage, shadcn/ui components, and Vitest testing guidance for BeTrace frontend
---

# React Tanstack Expert Skill

## Purpose

Provides expertise in React + Tanstack ecosystem development for BeTrace's BFF.

## When to Use This Skill

Load this skill when:
- Creating React components
- Implementing data fetching (Tanstack Query)
- Adding routes (Tanstack Router)
- Building forms with validation
- Writing Vitest tests
- Using shadcn/ui components

## Quick Patterns

### Data Fetching (Tanstack Query)
```typescript
import { useQuery } from '@tanstack/react-query'

export function TraceList() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['traces'],
    queryFn: () => fetch('/api/v1/traces').then(r => r.json()),
  })

  if (isLoading) return <Spinner />
  if (error) return <ErrorMessage error={error} />

  return <div>{data.map(trace => <TraceCard key={trace.id} trace={trace} />)}</div>
}
```

### Routing (Tanstack Router)
```typescript
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/traces/$traceId')({
  component: TraceDetail,
  loader: ({ params }) => fetchTrace(params.traceId),
})

function TraceDetail() {
  const { traceId } = Route.useParams()
  const trace = Route.useLoaderData()
  return <div>Trace {traceId}</div>
}
```

### Form Validation (React Hook Form + Zod)
```typescript
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const schema = z.object({
  name: z.string().min(1),
  pattern: z.string().min(1),
})

export function RuleForm() {
  const { register, handleSubmit } = useForm({
    resolver: zodResolver(schema),
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('name')} />
      <textarea {...register('pattern')} />
      <button type="submit">Create</button>
    </form>
  )
}
```

### Testing (Vitest + Testing Library)
```typescript
import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'

test('renders trace list', async () => {
  render(<TraceList />)
  expect(await screen.findByText('Trace 123')).toBeInTheDocument()
})
```

## Progressive Disclosure

For detailed React guidance:
1. `component-patterns.md` - Component design best practices
2. `data-fetching-guide.md` - Tanstack Query patterns
3. `routing-guide.md` - Tanstack Router configuration
4. `testing-patterns.md` - Vitest test organization

See also: [@docs/adrs/006-tanstack-frontend-architecture.md](../../docs/adrs/006-tanstack-frontend-architecture.md)
