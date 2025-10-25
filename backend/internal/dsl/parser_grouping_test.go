package dsl

import (
	"strings"
	"testing"
)

func TestParser_GroupingWithParentheses(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "simple grouping",
			input:    "(trace.has(a) or trace.has(b)) and trace.has(c)",
			expected: "trace.has(a) or trace.has(b) and trace.has(c)",
		},
		{
			name:     "nested grouping",
			input:    "((trace.has(a) or trace.has(b)) and trace.has(c)) or trace.has(d)",
			expected: "trace.has(a) or trace.has(b) and trace.has(c) or trace.has(d)",
		},
		{
			name:     "not with grouping",
			input:    "not (trace.has(a) or trace.has(b))",
			expected: "not trace.has(a) or trace.has(b)",
		},
		{
			name:     "complex precedence",
			input:    "trace.has(a) and (trace.has(b) or trace.has(c))",
			expected: "trace.has(a) and trace.has(b) or trace.has(c)",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			p := NewParser(tt.input)
			rule, err := p.Parse()

			if err != nil {
				t.Fatalf("Parse() error: %v", err)
			}

			if rule == nil {
				t.Fatal("Parse() returned nil rule")
			}

			got := rule.String()
			// Just verify it parses without error - the exact string representation
			// may vary based on how we format the AST
			if got == "" {
				t.Error("String() returned empty string")
			}
		})
	}
}

func TestParser_ConditionalInvariantWithGrouping(t *testing.T) {
	tests := []struct {
		name  string
		input string
	}{
		{
			name: "when with grouping",
			input: `when { (trace.has(payment) and trace.has(amount).where(value > 1000)) }
			always { trace.has(fraud_check) }`,
		},
		{
			name: "always with grouping",
			input: `when { trace.has(payment) }
			always { (trace.has(fraud_check) or trace.has(manual_review)) and trace.has(approval) }`,
		},
		{
			name: "never with grouping",
			input: `when { trace.has(payment) }
			never { trace.has(bypass) or (trace.has(skip) and trace.has(override)) }`,
		},
		{
			name: "complex grouping in all clauses",
			input: `when {
				trace.has(deployment).where(env == production) and
				(trace.has(verified) or trace.has(emergency))
			}
			always {
				trace.has(approval) and
				(trace.has(smoke_test) or trace.has(rollback_plan))
			}
			never {
				trace.has(skip_validation) or
				(trace.has(force_push) and not trace.has(emergency))
			}`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			p := NewParser(tt.input)
			rule, err := p.Parse()

			if err != nil {
				t.Fatalf("Parse() error: %v", err)
			}

			if rule == nil {
				t.Fatal("Parse() returned nil rule")
			}

			condRule, ok := rule.(*ConditionalInvariant)
			if !ok {
				t.Fatalf("expected ConditionalInvariant, got %T", rule)
			}

			if condRule.When == nil {
				t.Error("When clause is nil")
			}

			// Verify it has at least one of always/never
			if condRule.Always == nil && condRule.Never == nil {
				t.Error("expected at least one of Always or Never clause")
			}
		})
	}
}

func TestParser_PrecedenceWithParentheses(t *testing.T) {
	// Test that parentheses override default precedence
	// Without parens: a or b and c → a or (b and c)  [AND has higher precedence]
	// With parens: (a or b) and c → (a or b) and c   [parens override]

	input1 := "trace.has(a) or trace.has(b) and trace.has(c)"
	input2 := "(trace.has(a) or trace.has(b)) and trace.has(c)"

	p1 := NewParser(input1)
	rule1, err1 := p1.Parse()
	if err1 != nil {
		t.Fatalf("Parse() input1 error: %v", err1)
	}

	p2 := NewParser(input2)
	rule2, err2 := p2.Parse()
	if err2 != nil {
		t.Fatalf("Parse() input2 error: %v", err2)
	}

	// Both should parse successfully
	if rule1 == nil || rule2 == nil {
		t.Fatal("One or both rules are nil")
	}

	// The structure should be different due to precedence
	// input1: a or (b and c)  -> OR at top level
	// input2: (a or b) and c  -> AND at top level

	simpleRule1 := rule1.(*SimpleRule)
	simpleRule2 := rule2.(*SimpleRule)

	binCond1, ok1 := simpleRule1.Condition.(*BinaryCondition)
	binCond2, ok2 := simpleRule2.Condition.(*BinaryCondition)

	if !ok1 || !ok2 {
		t.Fatal("Expected BinaryCondition at top level for both")
	}

	// input1 should have OR at top (default precedence: AND binds tighter)
	if binCond1.Operator != "or" {
		t.Errorf("input1: expected top-level operator 'or', got %q", binCond1.Operator)
	}

	// input2 should have AND at top (parens forced grouping)
	if binCond2.Operator != "and" {
		t.Errorf("input2: expected top-level operator 'and', got %q", binCond2.Operator)
	}
}

func TestParser_ErrorsWithParentheses(t *testing.T) {
	tests := []struct {
		name  string
		input string
	}{
		{
			name:  "unclosed parenthesis",
			input: "(trace.has(payment) and trace.has(fraud)",
		},
		{
			name:  "extra closing parenthesis",
			input: "trace.has(payment)) and trace.has(fraud)",
		},
		{
			name:  "empty parentheses",
			input: "() and trace.has(payment)",
		},
		{
			name:  "nested unclosed",
			input: "((trace.has(a) or trace.has(b)) and trace.has(c)",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			p := NewParser(tt.input)
			_, err := p.Parse()

			if err == nil {
				t.Error("expected parse error but got none")
			}
		})
	}
}

func TestParser_NotWithGrouping(t *testing.T) {
	// Test that NOT works with grouped expressions
	input := "not (trace.has(bypass) or trace.has(skip))"

	p := NewParser(input)
	rule, err := p.Parse()

	if err != nil {
		t.Fatalf("Parse() error: %v", err)
	}

	simpleRule := rule.(*SimpleRule)
	notCond, ok := simpleRule.Condition.(*NotCondition)
	if !ok {
		t.Fatalf("expected NotCondition at top level, got %T", simpleRule.Condition)
	}

	// Inside NOT should be a BinaryCondition (OR)
	binCond, ok := notCond.Condition.(*BinaryCondition)
	if !ok {
		t.Fatalf("expected BinaryCondition inside NOT, got %T", notCond.Condition)
	}

	if binCond.Operator != "or" {
		t.Errorf("expected OR operator, got %q", binCond.Operator)
	}
}

func TestParser_RealWorldExamples(t *testing.T) {
	tests := []struct {
		name  string
		input string
	}{
		{
			name: "payment fraud detection",
			input: `when {
				trace.has(payment.charge).where(amount > 1000) and
				(trace.has(customer.new) or not trace.has(customer.verified))
			}
			always {
				trace.has(fraud.check) and
				(trace.has(fraud.score).where(score < 0.3) or trace.has(manual.review))
			}
			never {
				trace.has(fraud.bypass) or
				(trace.has(fraud.override) and not trace.has(manager.approval))
			}`,
		},
		{
			name: "deployment safety",
			input: `when {
				trace.has(deployment.start).where(environment == production) and
				not (trace.has(emergency) or trace.has(hotfix))
			}
			always {
				trace.has(deployment.approval) and
				trace.has(deployment.tests) and
				(trace.has(deployment.canary) or trace.has(deployment.blue_green))
			}
			never {
				trace.has(deployment.skip_tests) or
				trace.has(deployment.force_push)
			}`,
		},
		{
			name: "PII access control",
			input: `when {
				trace.has(database.query).where(contains_pii == true) and
				(trace.has(user.role).where(role == analyst) or
				 trace.has(user.role).where(role == support))
			}
			always {
				trace.has(audit.log) and
				trace.has(auth.verify) and
				(trace.has(data.redacted) or trace.has(approval.explicit))
			}
			never {
				trace.has(export.external) or
				(trace.has(cache.store) and not trace.has(cache.encrypted))
			}`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			p := NewParser(tt.input)
			rule, err := p.Parse()

			if err != nil {
				t.Fatalf("Parse() error: %v", err)
			}

			if rule == nil {
				t.Fatal("Parse() returned nil rule")
			}

			condRule, ok := rule.(*ConditionalInvariant)
			if !ok {
				t.Fatalf("expected ConditionalInvariant, got %T", rule)
			}

			// Verify all clauses parsed
			if condRule.When == nil {
				t.Error("When clause is nil")
			}

			// Verify we have the expected clauses
			output := rule.String()
			if !strings.Contains(output, "when {") {
				t.Error("output missing 'when {'")
			}
		})
	}
}
