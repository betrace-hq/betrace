package rules

import (
	"context"
	"runtime"
	"time"

	"github.com/betracehq/betrace/backend/internal/observability"
	"github.com/betracehq/betrace/backend/pkg/models"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

// EvaluateAllWithObservability evaluates all rules with full observability
func (e *RuleEngine) EvaluateAllWithObservability(ctx context.Context, span *models.Span) ([]string, error) {
	// Start parent span for batch evaluation
	ctx, parentSpan := observability.Tracer.Start(ctx, "rule_engine.evaluate_all",
		trace.WithAttributes(
			attribute.String("span.id", span.SpanID),
			attribute.String("span.service", span.ServiceName),
			attribute.String("span.operation", span.OperationName),
			attribute.Int("span.attributes_count", len(span.Attributes)),
		),
	)
	defer parentSpan.End()

	// Record span metrics (OTel)
	observability.RecordSpanProcessed(ctx)
	observability.RecordSpanAttributes(ctx, int64(len(span.Attributes)))
	observability.RecordSpanSize(ctx, int64(estimateSpanSize(span)))

	// Get snapshot of rules (read lock only)
	e.mu.RLock()
	rules := make([]*CompiledRule, 0, len(e.rules))
	activeRuleCount := 0
	for _, r := range e.rules {
		if r.Rule.Enabled {
			rules = append(rules, r)
			activeRuleCount++
		}
	}
	e.mu.RUnlock()

	// Update active rules gauge (OTel) - just track current count
	// Note: OTel UpDownCounter requires delta, not absolute value
	// We'll update this properly when rules are added/removed

	// DSL v2.0 is trace-level by design - convert single span to trace
	spans := []*models.Span{span}

	// Evaluate each rule with tracing
	matches := make([]string, 0, 10)
	for _, compiled := range rules {
		// Start span for individual rule evaluation
		ruleCtx, ruleSpan := observability.StartRuleEvaluationSpan(ctx, compiled.Rule.ID, span.SpanID)

		startTime := time.Now()

		// Note: DSL v2.0 doesn't use lazy evaluation - evaluates entire trace
		// Track that we're using DSL v2.0
		observability.RecordLazyFieldsLoaded(ctx, compiled.Rule.ID, int64(len(span.Attributes)))

		// Evaluate using DSL v2.0
		result, err := e.evaluator.EvaluateRule(compiled.AST, spans)

		duration := time.Since(startTime)

		if err != nil {
			// Record error (OTel)
			ruleSpan.SetAttributes(attribute.String("error", err.Error()))
			observability.RecordRuleEvaluation(ruleCtx, compiled.Rule.ID, "error", duration.Seconds())
			ruleSpan.End()
			continue
		}

		// Record result (OTel)
		resultStr := "no_match"
		if result {
			resultStr = "match"
		}
		observability.RecordRuleEvaluation(ruleCtx, compiled.Rule.ID, resultStr, duration.Seconds())
		ruleSpan.SetAttributes(attribute.Bool("match", result))

		if result {
			matches = append(matches, compiled.Rule.ID)

			// Emit compliance evidence for matched rules
			if isComplianceRule(compiled.Rule) {
				emitComplianceEvidenceForRule(ctx, compiled.Rule, span)
			}
		}

		ruleSpan.End()
	}

	// Record memory usage
	recordMemoryMetrics()

	parentSpan.SetAttributes(
		attribute.Int("rules.evaluated", len(rules)),
		attribute.Int("rules.matched", len(matches)),
	)

	return matches, nil
}

// LoadRuleWithObservability loads a rule with full observability using DSL v2.0
func (e *RuleEngine) LoadRuleWithObservability(ctx context.Context, rule models.Rule) error {
	ctx, span := observability.StartRuleLoadSpan(ctx, rule.ID)
	defer span.End()

	startTime := time.Now()

	// Parse the rule expression using DSL v2.0
	ast, err := e.parseRuleDSL(rule.Expression)

	duration := time.Since(startTime)

	if err != nil {
		observability.RecordRuleLoadResult(ctx, span, rule.ID, err, duration)
		e.mu.Lock()
		e.parseErrors[rule.ID] = err
		e.mu.Unlock()
		return err
	}

	// DSL v2.0 doesn't use field filters - full trace evaluation
	var fieldFilter *FieldFilter

	// Cache the compiled rule
	e.mu.Lock()
	e.rules[rule.ID] = &CompiledRule{
		Rule:        rule,
		AST:         ast,
		FieldFilter: fieldFilter,
	}
	delete(e.parseErrors, rule.ID)
	activeCount := len(e.rules)
	e.mu.Unlock()

	// Update metrics
	observability.RecordRuleLoadResult(ctx, span, rule.ID, nil, duration)
	observability.RulesActive.Set(float64(activeCount))

	span.SetAttributes(
		attribute.String("dsl.version", "2.0"),
		attribute.Bool("dsl.trace_level", true),
	)

	return nil
}

// isComplianceRule checks if a rule is tagged for compliance monitoring
func isComplianceRule(rule models.Rule) bool {
	// Check if rule has compliance tags/metadata
	// This would be populated from rule configuration
	return false // TODO: Implement based on rule metadata
}

// emitComplianceEvidenceForRule emits compliance evidence for a matched rule
func emitComplianceEvidenceForRule(ctx context.Context, rule models.Rule, span *models.Span) {
	// Example: Emit SOC2 CC7.1 evidence for monitoring
	details := map[string]interface{}{
		"rule_id":      rule.ID,
		"span_id":      span.SpanID,
		"service_name": span.ServiceName,
		"operation":    span.OperationName,
		"matched":      true,
	}

	observability.EmitComplianceEvidence(ctx, observability.SOC2_CC7_1, "monitored", details)
}

// countFieldsLoaded estimates how many fields were actually loaded during lazy evaluation
func countFieldsLoaded(ctx *SpanContext) int {
	count := 0

	// Count loaded scalar fields
	if ctx.cachedStatus != nil {
		count++
	}
	if ctx.cachedDuration != nil {
		count++
	}
	if ctx.cachedServiceName != nil {
		count++
	}
	if ctx.cachedOperationName != nil {
		count++
	}
	if ctx.cachedTraceID != nil {
		count++
	}
	if ctx.cachedSpanID != nil {
		count++
	}

	// Count loaded attributes
	for _, cached := range ctx.cachedAttributes {
		if cached != nil {
			count++
		}
	}

	return count
}

// estimateSpanSize estimates the size of a span in bytes
func estimateSpanSize(span *models.Span) int {
	size := 200 // Base span overhead

	// Strings
	size += len(span.SpanID)
	size += len(span.TraceID)
	size += len(span.ParentSpanID)
	size += len(span.OperationName)
	size += len(span.ServiceName)
	size += len(span.Status)

	// Times
	size += 16 // StartTime + EndTime

	// Duration
	size += 8

	// Attributes
	for key, value := range span.Attributes {
		size += len(key) + len(value) + 16 // Key + Value + overhead
	}

	return size
}

// recordMemoryMetrics records memory usage metrics
func recordMemoryMetrics() {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)

	observability.MemoryUsageBytes.WithLabelValues("rule_engine").Set(float64(m.Alloc))
	observability.GoroutinesActive.Set(float64(runtime.NumGoroutine()))

	if m.PauseNs[(m.NumGC+255)%256] > 0 {
		pauseNs := m.PauseNs[(m.NumGC+255)%256]
		observability.GCPauseDuration.Observe(float64(pauseNs) / 1e9)
	}
}
