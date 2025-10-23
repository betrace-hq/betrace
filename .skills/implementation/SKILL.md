---
name: Implementation Specialist
description: Implements features from PRDs, refactors code within established patterns, builds endpoints/UI components, and follows architectural guidelines
---

# Implementation Specialist Skill

## Purpose

This skill provides expertise in implementing features according to PRDs while adhering to BeTrace's pure application framework architecture.

## When to Use This Skill

Load this skill when:
- Implementing features from PRDs
- Building new API endpoints
- Creating UI components
- Refactoring within established patterns
- Adding business logic
- Integrating external services

## Implementation Checklist

### Before Implementation
- [ ] PRD reviewed and understood
- [ ] Architectural patterns identified (ADR compliance)
- [ ] Test strategy defined (90%/80% coverage targets)
- [ ] API contracts defined (if applicable)
- [ ] Database schema changes planned (if applicable)

### During Implementation
- [ ] Follow pure application framework patterns (no infrastructure)
- [ ] Write tests alongside code (TDD recommended)
- [ ] Use appropriate design patterns
- [ ] Handle errors comprehensively
- [ ] Add compliance annotations where required (`@SOC2`, `@HIPAA`)
- [ ] Redact PII (`@Redact` annotations)
- [ ] Validate input
- [ ] Document complex logic

### After Implementation
- [ ] All tests passing (unit + integration)
- [ ] Coverage thresholds met (≥90%/80%)
- [ ] Code review checklist completed
- [ ] Documentation updated
- [ ] No security vulnerabilities introduced

## Backend Implementation Patterns (Quarkus)

### REST Endpoint
```java
@Path("/api/v1/traces")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class TraceResource {

    @Inject
    TraceService traceService;

    @GET
    @Path("/{traceId}")
    @SOC2(controls = {CC6_1, CC7_2}, notes = "Trace data access with audit")
    public Response getTrace(
        @PathParam("traceId") String traceId,
        @HeaderParam("X-Tenant-ID") String tenantId
    ) {
        // Input validation
        if (tenantId == null || traceId == null) {
            return Response.status(Status.BAD_REQUEST).build();
        }

        // Business logic
        Trace trace = traceService.getTrace(tenantId, traceId);

        // Response
        return Response.ok(trace).build();
    }
}
```

### Service Layer
```java
@ApplicationScoped
public class TraceService {

    @Inject
    TraceRepository repository;

    @Inject
    RuleEngine ruleEngine;

    @WithSpan(value = "trace.analyze")
    public AnalysisResult analyzeTrace(String tenantId, Trace trace) {
        // Validate tenant access
        validateTenantAccess(tenantId, trace);

        // Execute rules
        List<Violation> violations = ruleEngine.evaluate(tenantId, trace);

        return new AnalysisResult(trace, violations);
    }

    private void validateTenantAccess(String tenantId, Trace trace) {
        if (!trace.getTenantId().equals(tenantId)) {
            throw new UnauthorizedException("Tenant mismatch");
        }
    }
}
```

### Repository Pattern
```java
@ApplicationScoped
public class TraceRepository {

    @Inject
    EntityManager em;

    public Trace findByTenantAndId(String tenantId, String traceId) {
        return em.createQuery(
            "SELECT t FROM Trace t WHERE t.tenantId = :tenantId AND t.id = :traceId",
            Trace.class
        )
        .setParameter("tenantId", tenantId)
        .setParameter("traceId", traceId)
        .getSingleResult();
    }

    @Transactional
    public void save(Trace trace) {
        em.persist(trace);
    }
}
```

## Frontend Implementation Patterns (React + Tanstack)

### Component with Data Fetching
```typescript
import { useQuery } from '@tanstack/react-query'
import { traceApi } from '@/api/traces'

export function TraceDetail({ traceId }: { traceId: string }) {
  const { data: trace, isLoading, error } = useQuery({
    queryKey: ['trace', traceId],
    queryFn: () => traceApi.getTrace(traceId),
  })

  if (isLoading) return <LoadingSpinner />
  if (error) return <ErrorMessage error={error} />

  return (
    <div className="trace-detail">
      <h2>Trace {trace.id}</h2>
      <SpanList spans={trace.spans} />
      <ViolationList violations={trace.violations} />
    </div>
  )
}
```

### Form with Validation
```typescript
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const ruleSchema = z.object({
  name: z.string().min(1, 'Name required'),
  pattern: z.string().min(1, 'Pattern required'),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
})

type RuleFormData = z.infer<typeof ruleSchema>

export function RuleForm({ onSubmit }: { onSubmit: (data: RuleFormData) => void }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RuleFormData>({
    resolver: zodResolver(ruleSchema),
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('name')} placeholder="Rule name" />
      {errors.name && <span className="error">{errors.name.message}</span>}

      <textarea {...register('pattern')} placeholder="Pattern (DSL)" />
      {errors.pattern && <span className="error">{errors.pattern.message}</span>}

      <select {...register('severity')}>
        <option value="low">Low</option>
        <option value="medium">Medium</option>
        <option value="high">High</option>
        <option value="critical">Critical</option>
      </select>

      <button type="submit">Create Rule</button>
    </form>
  )
}
```

## Testing During Implementation

### Test-Driven Development (Recommended)
```java
// 1. Write test first
@Test
void shouldCalculateViolationSeverity() {
    Violation violation = createViolation(Severity.HIGH);
    int score = severityCalculator.calculate(violation);
    assertThat(score).isEqualTo(75);
}

// 2. Implement to make test pass
public int calculate(Violation violation) {
    return switch (violation.getSeverity()) {
        case LOW -> 25;
        case MEDIUM -> 50;
        case HIGH -> 75;
        case CRITICAL -> 100;
    };
}

// 3. Refactor if needed (tests prevent regressions)
```

## Common Implementation Patterns

### Error Handling
```java
public class TraceService {
    public Trace getTrace(String tenantId, String traceId) {
        try {
            return repository.findByTenantAndId(tenantId, traceId);
        } catch (NoResultException e) {
            throw new NotFoundException("Trace not found: " + traceId);
        } catch (PersistenceException e) {
            logger.error("Database error retrieving trace", e);
            throw new InternalServerErrorException("Database error");
        }
    }
}
```

### Validation
```java
public void validateRule(Rule rule) {
    if (rule.getName() == null || rule.getName().isBlank()) {
        throw new ValidationException("Rule name required");
    }
    if (rule.getPattern() == null || rule.getPattern().isBlank()) {
        throw new ValidationException("Rule pattern required");
    }
    if (!dslValidator.isValid(rule.getPattern())) {
        throw new ValidationException("Invalid DSL syntax");
    }
}
```

### Pagination
```java
@GET
public Response listTraces(
    @QueryParam("page") @DefaultValue("0") int page,
    @QueryParam("size") @DefaultValue("20") int size,
    @HeaderParam("X-Tenant-ID") String tenantId
) {
    PageRequest pageRequest = PageRequest.of(page, size);
    Page<Trace> traces = traceService.listTraces(tenantId, pageRequest);

    return Response.ok(traces).build();
}
```

## Progressive Disclosure

This SKILL.md provides high-level patterns. For detailed implementation guidance:
1. Review `prd-execution-guide.md` for PRD implementation workflow
2. Check `refactoring-patterns.md` for safe refactoring techniques
3. Consult `api-design-patterns.md` for REST endpoint design
4. See `component-patterns.md` for React component best practices

## Anti-Patterns to Avoid

1. **Infrastructure in Application Code**: No Docker/K8s/cloud provider logic
2. **Skipping Tests**: Coverage thresholds are enforced
3. **Weak Error Handling**: Catch-all `catch (Exception e) {}` blocks
4. **Missing Input Validation**: Validate at API boundaries
5. **PII Leakage**: Always use `@Redact` for sensitive data
6. **Missing Compliance Annotations**: `@SOC2`/`@HIPAA` where applicable
7. **Hardcoded Values**: Use configuration
8. **God Classes**: Single responsibility principle
9. **Premature Optimization**: Make it work, then make it fast
10. **Copy-Paste**: Extract shared logic

## Summary

**Implementation Principles**:
- Follow established architectural patterns (ADR-011, ADR-015)
- Write tests alongside code (TDD)
- Validate input, handle errors gracefully
- Use compliance annotations appropriately
- Redact PII before export
- Keep coverage ≥ 90%/80%
- No infrastructure in application code
