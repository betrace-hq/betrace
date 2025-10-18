---
name: Java Quarkus Expert
description: Provides Quarkus framework patterns, CDI best practices, REST API design, and JUnit 5 testing guidance for FLUO backend
---

# Java Quarkus Expert Skill

## Purpose

Provides expertise in Quarkus-based backend development for FLUO.

## When to Use This Skill

Load this skill when:
- Creating REST endpoints
- Implementing service layer
- Writing JUnit 5 tests
- Using CDI/dependency injection
- Configuring Quarkus features
- Integrating with databases

## Quick Patterns

### REST Resource
```java
@Path("/api/v1/traces")
@Produces(MediaType.APPLICATION_JSON)
public class TraceResource {
    @Inject TraceService service;

    @GET
    @Path("/{id}")
    public Response get(@PathParam("id") String id) {
        return Response.ok(service.getTrace(id)).build();
    }
}
```

### Service Layer (CDI)
```java
@ApplicationScoped
public class TraceService {
    @Inject TraceRepository repository;
    @Inject RuleEngine ruleEngine;

    @WithSpan(value = "trace.analyze")
    public AnalysisResult analyze(Trace trace) {
        // Business logic
    }
}
```

### Repository (JPA)
```java
@ApplicationScoped
public class TraceRepository {
    @Inject EntityManager em;

    public Trace findById(String id) {
        return em.find(Trace.class, id);
    }

    @Transactional
    public void save(Trace trace) {
        em.persist(trace);
    }
}
```

### Testing (JUnit 5 + AssertJ)
```java
@QuarkusTest
class TraceServiceTest {
    @Inject TraceService service;

    @Test
    void shouldAnalyzeTrace() {
        Trace trace = createTestTrace();
        AnalysisResult result = service.analyze(trace);
        assertThat(result.hasViolations()).isTrue();
    }
}
```

## Configuration
```properties
# application.properties
quarkus.datasource.db-kind=postgresql
quarkus.datasource.username=fluo
quarkus.datasource.password=${DB_PASSWORD}

quarkus.http.port=8080
quarkus.http.cors=true
```

## Progressive Disclosure

For detailed Quarkus guidance:
1. `rest-api-patterns.md` - Endpoint design best practices
2. `cdi-injection-guide.md` - Dependency injection patterns
3. `testing-patterns.md` - JUnit 5 test organization
4. `configuration-guide.md` - Application configuration

See also: Quarkus docs at https://quarkus.io/guides/
