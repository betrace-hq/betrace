package com.betrace.models.query;

import java.util.List;
import java.util.Map;

/**
 * PRD-027: Query Result DTO
 *
 * Response from query execution containing rows and metadata.
 */
public class QueryResult {

    private List<Map<String, Object>> rows;
    private int totalRows;
    private long executionTimeMs;
    private boolean truncated;

    public QueryResult() {
    }

    public QueryResult(List<Map<String, Object>> rows, int totalRows, long executionTimeMs, boolean truncated) {
        this.rows = rows;
        this.totalRows = totalRows;
        this.executionTimeMs = executionTimeMs;
        this.truncated = truncated;
    }

    public List<Map<String, Object>> getRows() {
        return rows;
    }

    public void setRows(List<Map<String, Object>> rows) {
        this.rows = rows;
    }

    public int getTotalRows() {
        return totalRows;
    }

    public void setTotalRows(int totalRows) {
        this.totalRows = totalRows;
    }

    public long getExecutionTimeMs() {
        return executionTimeMs;
    }

    public void setExecutionTimeMs(long executionTimeMs) {
        this.executionTimeMs = executionTimeMs;
    }

    public boolean isTruncated() {
        return truncated;
    }

    public void setTruncated(boolean truncated) {
        this.truncated = truncated;
    }
}
