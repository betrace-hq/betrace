package com.fluo.models.query;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * PRD-027: Execute Query Request DTO
 *
 * Request body for executing ad-hoc SQL queries.
 */
public class ExecuteQueryRequest {

    @NotBlank(message = "SQL query is required")
    @Size(min = 10, max = 10000, message = "Query must be 10-10000 characters")
    private String sqlQuery;

    public ExecuteQueryRequest() {
    }

    public ExecuteQueryRequest(String sqlQuery) {
        this.sqlQuery = sqlQuery;
    }

    public String getSqlQuery() {
        return sqlQuery;
    }

    public void setSqlQuery(String sqlQuery) {
        this.sqlQuery = sqlQuery;
    }
}
