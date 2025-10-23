package com.fluo.models.compliance;

import java.util.List;

/**
 * PRD-004 Phase 2: Control Detail Response
 *
 * Detailed view of a single control with evidence spans.
 */
public class ControlDetail {

    private ControlStatus control;
    private List<EvidenceSpan> spans;
    private int totalSpans;
    private int page;
    private int pageSize;
    private boolean hasMore;

    public ControlDetail() {
    }

    public ControlDetail(ControlStatus control, List<EvidenceSpan> spans, int totalSpans,
                        int page, int pageSize, boolean hasMore) {
        this.control = control;
        this.spans = spans;
        this.totalSpans = totalSpans;
        this.page = page;
        this.pageSize = pageSize;
        this.hasMore = hasMore;
    }

    public ControlStatus getControl() {
        return control;
    }

    public void setControl(ControlStatus control) {
        this.control = control;
    }

    public List<EvidenceSpan> getSpans() {
        return spans;
    }

    public void setSpans(List<EvidenceSpan> spans) {
        this.spans = spans;
    }

    public int getTotalSpans() {
        return totalSpans;
    }

    public void setTotalSpans(int totalSpans) {
        this.totalSpans = totalSpans;
    }

    public int getPage() {
        return page;
    }

    public void setPage(int page) {
        this.page = page;
    }

    public int getPageSize() {
        return pageSize;
    }

    public void setPageSize(int pageSize) {
        this.pageSize = pageSize;
    }

    public boolean isHasMore() {
        return hasMore;
    }

    public void setHasMore(boolean hasMore) {
        this.hasMore = hasMore;
    }
}
