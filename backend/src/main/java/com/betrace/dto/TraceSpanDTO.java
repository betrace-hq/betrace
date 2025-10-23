package com.betrace.dto;

import com.betrace.validation.ValidSpanId;
import com.betrace.validation.ValidTraceId;
import jakarta.validation.constraints.NotBlank;

/**
 * DTO for OpenTelemetry trace and span identifiers.
 * Custom validators added per PRD-007b.
 */
public record TraceSpanDTO(
    @NotBlank(message = "Trace ID is required")
    @ValidTraceId
    String traceId,

    @NotBlank(message = "Span ID is required")
    @ValidSpanId
    String spanId
) {}
