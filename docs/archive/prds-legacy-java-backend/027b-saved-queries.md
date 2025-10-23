# PRD-027b: Saved Queries

**Parent PRD:** PRD-027 (Advanced Query Language for Signal Search)
**Unit:** B
**Priority:** P2
**Dependencies:** Unit A (Core Query Infrastructure)

## Scope

Implement saved query functionality to enable users to save, list, retrieve, and execute frequently used SQL queries. This unit builds on the core query infrastructure (Unit A) to provide reusable query management.

## Core Functionality

1. **Save Query**: Store SQL queries with metadata for reuse
2. **List Queries**: Retrieve all saved queries for a tenant
3. **Get Query**: Fetch specific saved query by ID
4. **Execute Saved Query**: Run a saved query by ID
5. **Delete Query**: Remove saved query
6. **Execution Tracking**: Track execution count and last run time

## Implementation

### 1. Saved Query Model

**File:** `backend/src/main/java/com/fluo/model/SavedQuery.java`

```java
package com.fluo.model;

import java.time.Instant;
import java.util.UUID;

/**
 * Saved query model for reusable queries.
 */
public class SavedQuery {
    private String id;
    private String tenantId;
    private String name;
    private String description;
    private String sql;
    private Instant createdAt;
    private Instant updatedAt;
    private String createdBy;
    private int executionCount;

    // Constructors
    public SavedQuery() {}

    public SavedQuery(String tenantId, String name, String sql) {
        this.id = "query-" + UUID.randomUUID().toString();
        this.tenantId = tenantId;
        this.name = name;
        this.sql = sql;
        this.createdAt = Instant.now();
        this.updatedAt = Instant.now();
        this.executionCount = 0;
    }

    // Getters and setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getTenantId() { return tenantId; }
    public void setTenantId(String tenantId) { this.tenantId = tenantId; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getSql() { return sql; }
    public void setSql(String sql) { this.sql = sql; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }

    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }

    public int getExecutionCount() { return executionCount; }
    public void setExecutionCount(int executionCount) {
        this.executionCount = executionCount;
    }

    public SavedQuery incrementExecutionCount() {
        this.executionCount++;
        this.updatedAt = Instant.now();
        return this;
    }
}
```

**File:** `backend/src/main/java/com/fluo/model/SavedQueryRequest.java`

```java
package com.fluo.model;

/**
 * Request model for saving queries.
 */
public class SavedQueryRequest {
    private String name;
    private String description;
    private String sql;

    // Constructors
    public SavedQueryRequest() {}

    public SavedQueryRequest(String name, String sql) {
        this.name = name;
        this.sql = sql;
    }

    // Getters and setters
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getSql() { return sql; }
    public void setSql(String sql) { this.sql = sql; }
}
```

### 2. Saved Query Service

**File:** `backend/src/main/java/com/fluo/services/SavedQueryService.java`

```java
package com.fluo.services;

import com.fluo.model.SavedQuery;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Service for managing saved queries.
 *
 * Note: In-memory implementation for MVP.
 * Future: Store in TigerBeetle or DuckDB.
 */
@ApplicationScoped
public class SavedQueryService {

    // In-memory storage (tenant_id -> query_id -> SavedQuery)
    private final Map<String, Map<String, SavedQuery>> savedQueries = new ConcurrentHashMap<>();

    /**
     * Save a query for a tenant.
     */
    public SavedQuery saveQuery(SavedQuery query) {
        savedQueries
            .computeIfAbsent(query.getTenantId(), k -> new ConcurrentHashMap<>())
            .put(query.getId(), query);
        return query;
    }

    /**
     * Get saved query by ID.
     */
    public Optional<SavedQuery> getQuery(String tenantId, String queryId) {
        return Optional.ofNullable(savedQueries.get(tenantId))
            .map(queries -> queries.get(queryId));
    }

    /**
     * List all saved queries for tenant.
     */
    public List<SavedQuery> listQueries(String tenantId) {
        return Optional.ofNullable(savedQueries.get(tenantId))
            .map(queries -> new ArrayList<>(queries.values()))
            .orElse(Collections.emptyList());
    }

    /**
     * Delete saved query.
     */
    public boolean deleteQuery(String tenantId, String queryId) {
        return Optional.ofNullable(savedQueries.get(tenantId))
            .map(queries -> queries.remove(queryId) != null)
            .orElse(false);
    }

    /**
     * Increment execution count for query.
     */
    public void incrementExecutionCount(String tenantId, String queryId) {
        getQuery(tenantId, queryId).ifPresent(query -> {
            query.incrementExecutionCount();
            saveQuery(query);
        });
    }
}
```

### 3. Camel Routes

**File:** `backend/src/main/java/com/fluo/routes/SignalQueryRoute.java` (additions)

Add to existing route:

```java
// Save query endpoint
.post("/query/save")
    .description("Save SQL query for reuse")
    .type(SavedQueryRequest.class)
    .to("direct:saveSavedQuery")

// List saved queries
.get("/query/saved")
    .description("List saved queries for tenant")
    .to("direct:listSavedQueries")

// Get saved query by ID
.get("/query/saved/{id}")
    .description("Get saved query by ID")
    .to("direct:getSavedQuery")

// Execute saved query
.post("/query/saved/{id}/execute")
    .description("Execute saved query by ID")
    .to("direct:executeSavedQuery")

// Delete saved query
.delete("/query/saved/{id}")
    .description("Delete saved query")
    .to("direct:deleteSavedQuery");

// Save query route
from("direct:saveSavedQuery")
    .routeId("saveSavedQuery")
    .log("Saving query for tenant ${header.tenantId}")
    .process("extractTenantIdProcessor")
    .process("validateSqlQueryProcessor")
    .process("storeSavedQueryProcessor")
    .marshal().json();

// List saved queries route
from("direct:listSavedQueries")
    .routeId("listSavedQueries")
    .log("Listing saved queries for tenant ${header.tenantId}")
    .process("extractTenantIdProcessor")
    .process("loadSavedQueriesProcessor")
    .marshal().json();

// Get saved query route
from("direct:getSavedQuery")
    .routeId("getSavedQuery")
    .log("Getting saved query ${header.id}")
    .process("extractTenantIdProcessor")
    .process("getSavedQueryProcessor")
    .marshal().json();

// Execute saved query route
from("direct:executeSavedQuery")
    .routeId("executeSavedQuery")
    .log("Executing saved query ${header.id}")
    .process("extractTenantIdProcessor")
    .process("loadSavedQueryProcessor")
    .process("validateSqlQueryProcessor")
    .process("injectTenantIsolationProcessor")
    .process("executeHotStorageQueryProcessor")
    .process("formatQueryResultsProcessor")
    .process("updateExecutionCountProcessor")
    .marshal().json();

// Delete saved query route
from("direct:deleteSavedQuery")
    .routeId("deleteSavedQuery")
    .log("Deleting saved query ${header.id}")
    .process("extractTenantIdProcessor")
    .process("deleteSavedQueryProcessor")
    .setBody(constant("{\"deleted\": true}"))
    .marshal().json();
```

### 4. Named Processors

**File:** `backend/src/main/java/com/fluo/processors/query/StoreSavedQueryProcessor.java`

```java
package com.fluo.processors.query;

import com.fluo.model.SavedQuery;
import com.fluo.model.SavedQueryRequest;
import com.fluo.services.SavedQueryService;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.inject.Named;
import org.apache.camel.Exchange;
import org.apache.camel.Processor;

/**
 * Stores a saved query.
 */
@Named("storeSavedQueryProcessor")
@ApplicationScoped
public class StoreSavedQueryProcessor implements Processor {

    @Inject
    SavedQueryService savedQueryService;

    @Override
    public void process(Exchange exchange) throws Exception {
        SavedQueryRequest request = exchange.getIn().getBody(SavedQueryRequest.class);
        String tenantId = exchange.getIn().getHeader("tenantId", String.class);

        if (request.getName() == null || request.getName().trim().isEmpty()) {
            throw new IllegalArgumentException("Query name is required");
        }

        SavedQuery savedQuery = new SavedQuery(tenantId, request.getName(), request.getSql());
        savedQuery.setDescription(request.getDescription());

        SavedQuery saved = savedQueryService.saveQuery(savedQuery);

        exchange.getIn().setBody(saved);
    }
}
```

**File:** `backend/src/main/java/com/fluo/processors/query/LoadSavedQueriesProcessor.java`

```java
package com.fluo.processors.query;

import com.fluo.model.SavedQuery;
import com.fluo.services.SavedQueryService;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.inject.Named;
import org.apache.camel.Exchange;
import org.apache.camel.Processor;
import java.util.List;

/**
 * Loads all saved queries for a tenant.
 */
@Named("loadSavedQueriesProcessor")
@ApplicationScoped
public class LoadSavedQueriesProcessor implements Processor {

    @Inject
    SavedQueryService savedQueryService;

    @Override
    public void process(Exchange exchange) throws Exception {
        String tenantId = exchange.getIn().getHeader("tenantId", String.class);

        List<SavedQuery> queries = savedQueryService.listQueries(tenantId);

        exchange.getIn().setBody(queries);
    }
}
```

**File:** `backend/src/main/java/com/fluo/processors/query/GetSavedQueryProcessor.java`

```java
package com.fluo.processors.query;

import com.fluo.model.SavedQuery;
import com.fluo.services.SavedQueryService;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.inject.Named;
import org.apache.camel.Exchange;
import org.apache.camel.Processor;

/**
 * Gets a specific saved query by ID.
 */
@Named("getSavedQueryProcessor")
@ApplicationScoped
public class GetSavedQueryProcessor implements Processor {

    @Inject
    SavedQueryService savedQueryService;

    @Override
    public void process(Exchange exchange) throws Exception {
        String tenantId = exchange.getIn().getHeader("tenantId", String.class);
        String queryId = exchange.getIn().getHeader("id", String.class);

        SavedQuery query = savedQueryService.getQuery(tenantId, queryId)
            .orElseThrow(() -> new IllegalArgumentException("Saved query not found: " + queryId));

        exchange.getIn().setBody(query);
    }
}
```

**File:** `backend/src/main/java/com/fluo/processors/query/LoadSavedQueryProcessor.java`

```java
package com.fluo.processors.query;

import com.fluo.model.SavedQuery;
import com.fluo.services.SavedQueryService;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.inject.Named;
import org.apache.camel.Exchange;
import org.apache.camel.Processor;

/**
 * Loads a saved query and sets its SQL for execution.
 */
@Named("loadSavedQueryProcessor")
@ApplicationScoped
public class LoadSavedQueryProcessor implements Processor {

    @Inject
    SavedQueryService savedQueryService;

    @Override
    public void process(Exchange exchange) throws Exception {
        String tenantId = exchange.getIn().getHeader("tenantId", String.class);
        String queryId = exchange.getIn().getHeader("id", String.class);

        SavedQuery query = savedQueryService.getQuery(tenantId, queryId)
            .orElseThrow(() -> new IllegalArgumentException("Saved query not found: " + queryId));

        // Set SQL for downstream processors
        exchange.getIn().setHeader("sql", query.getSql());
        exchange.getIn().setHeader("savedQueryId", queryId);
    }
}
```

**File:** `backend/src/main/java/com/fluo/processors/query/UpdateExecutionCountProcessor.java`

```java
package com.fluo.processors.query;

import com.fluo.services.SavedQueryService;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.inject.Named;
import org.apache.camel.Exchange;
import org.apache.camel.Processor;

/**
 * Updates execution count for saved query.
 */
@Named("updateExecutionCountProcessor")
@ApplicationScoped
public class UpdateExecutionCountProcessor implements Processor {

    @Inject
    SavedQueryService savedQueryService;

    @Override
    public void process(Exchange exchange) throws Exception {
        String tenantId = exchange.getIn().getHeader("tenantId", String.class);
        String queryId = exchange.getIn().getHeader("savedQueryId", String.class);

        if (queryId != null) {
            savedQueryService.incrementExecutionCount(tenantId, queryId);
        }
    }
}
```

**File:** `backend/src/main/java/com/fluo/processors/query/DeleteSavedQueryProcessor.java`

```java
package com.fluo.processors.query;

import com.fluo.services.SavedQueryService;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.inject.Named;
import org.apache.camel.Exchange;
import org.apache.camel.Processor;

/**
 * Deletes a saved query.
 */
@Named("deleteSavedQueryProcessor")
@ApplicationScoped
public class DeleteSavedQueryProcessor implements Processor {

    @Inject
    SavedQueryService savedQueryService;

    @Override
    public void process(Exchange exchange) throws Exception {
        String tenantId = exchange.getIn().getHeader("tenantId", String.class);
        String queryId = exchange.getIn().getHeader("id", String.class);

        boolean deleted = savedQueryService.deleteQuery(tenantId, queryId);

        if (!deleted) {
            throw new IllegalArgumentException("Saved query not found: " + queryId);
        }
    }
}
```

## Success Criteria

### Functional
- [ ] Users can save SQL queries with name and description
- [ ] Saved queries are listed for tenant
- [ ] Specific saved query can be retrieved by ID
- [ ] Saved queries can be executed by ID
- [ ] Saved queries can be deleted
- [ ] Execution count incremented on each run
- [ ] SQL validation applied to saved queries

### Security
- [ ] Saved queries isolated per tenant
- [ ] SQL validation enforced when saving
- [ ] Tenant cannot access other tenant's saved queries

## Testing Requirements

### Unit Tests (90% coverage per ADR-014)

**File:** `backend/src/test/java/com/fluo/services/SavedQueryServiceTest.java`

Required test cases:
- [ ] testSaveQuery
- [ ] testGetQueryById
- [ ] testListQueriesForTenant
- [ ] testDeleteQuery
- [ ] testIncrementExecutionCount
- [ ] testQueryNotFoundReturnsEmpty
- [ ] testTenantIsolation

**File:** `backend/src/test/java/com/fluo/processors/query/StoreSavedQueryProcessorTest.java`

Required test cases:
- [ ] testStoreSavedQuery
- [ ] testRejectQueryWithoutName
- [ ] testStoreQueryWithDescription

**File:** `backend/src/test/java/com/fluo/processors/query/LoadSavedQueriesProcessorTest.java`

Required test cases:
- [ ] testLoadSavedQueries
- [ ] testLoadSavedQueriesEmpty

**File:** `backend/src/test/java/com/fluo/processors/query/LoadSavedQueryProcessorTest.java`

Required test cases:
- [ ] testLoadSavedQuery
- [ ] testThrowExceptionIfQueryNotFound

### Integration Tests

**File:** `backend/src/test/java/com/fluo/routes/SavedQueryRouteTest.java`

Required test cases:
- [ ] testSaveQueryViaApi
- [ ] testListSavedQueriesViaApi
- [ ] testGetSavedQueryViaApi
- [ ] testExecuteSavedQueryViaApi
- [ ] testDeleteSavedQueryViaApi
- [ ] testExecutionCountIncrement

## Files to Create

### Backend - Models
- `backend/src/main/java/com/fluo/model/SavedQuery.java`
- `backend/src/main/java/com/fluo/model/SavedQueryRequest.java`

### Backend - Services
- `backend/src/main/java/com/fluo/services/SavedQueryService.java`

### Backend - Processors
- `backend/src/main/java/com/fluo/processors/query/StoreSavedQueryProcessor.java`
- `backend/src/main/java/com/fluo/processors/query/LoadSavedQueriesProcessor.java`
- `backend/src/main/java/com/fluo/processors/query/GetSavedQueryProcessor.java`
- `backend/src/main/java/com/fluo/processors/query/LoadSavedQueryProcessor.java`
- `backend/src/main/java/com/fluo/processors/query/UpdateExecutionCountProcessor.java`
- `backend/src/main/java/com/fluo/processors/query/DeleteSavedQueryProcessor.java`

### Backend - Tests
- `backend/src/test/java/com/fluo/services/SavedQueryServiceTest.java`
- `backend/src/test/java/com/fluo/processors/query/StoreSavedQueryProcessorTest.java`
- `backend/src/test/java/com/fluo/processors/query/LoadSavedQueriesProcessorTest.java`
- `backend/src/test/java/com/fluo/processors/query/LoadSavedQueryProcessorTest.java`
- `backend/src/test/java/com/fluo/routes/SavedQueryRouteTest.java`

## Files to Modify

- `backend/src/main/java/com/fluo/routes/SignalQueryRoute.java` - Add saved query routes

## Architecture Compliance

- **ADR-011 (Pure Application)**: In-memory storage for MVP, no external dependencies
- **ADR-012 (Tenant Isolation)**: Saved queries isolated per tenant
- **ADR-013 (Camel-First)**: All APIs as Camel routes
- **ADR-014 (Named Processors)**: All processors are named beans, 90% test coverage

## Future Enhancements

1. **Persistent Storage**: Move from in-memory to DuckDB or TigerBeetle
2. **Query Sharing**: Public queries (tenant-wide)
3. **Query Permissions**: Admin-only queries
4. **Query Tags**: Categorize queries
5. **Query Comments**: Collaboration features

## Timeline

**Duration:** Week 2 (5 days)

**Day 1:** Implement SavedQuery model and service
**Day 2:** Implement processors and routes
**Day 3:** Write unit tests (90% coverage)
**Day 4:** Integration tests
**Day 5:** Documentation and edge case testing
