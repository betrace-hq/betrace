package dsl

import "fmt"

// Node is the base interface for all AST nodes
type Node interface {
	String() string
}

// Rule represents the top-level rule
type Rule interface {
	Node
	ruleNode()
}

// ========================================
// Rule Types
// ========================================

// SimpleRule represents a simple condition rule (backward compatible)
type SimpleRule struct {
	Condition Condition
}

func (r *SimpleRule) ruleNode()      {}
func (r *SimpleRule) String() string { return r.Condition.String() }

// ConditionalInvariant represents a when-always-never rule
type ConditionalInvariant struct {
	When   Condition
	Always *Condition // optional
	Never  *Condition // optional
}

func (r *ConditionalInvariant) ruleNode() {}
func (r *ConditionalInvariant) String() string {
	result := fmt.Sprintf("when { %s }", r.When.String())
	if r.Always != nil {
		result += fmt.Sprintf("\nalways { %s }", (*r.Always).String())
	}
	if r.Never != nil {
		result += fmt.Sprintf("\nnever { %s }", (*r.Never).String())
	}
	return result
}

// ========================================
// Conditions
// ========================================

// Condition represents a boolean expression
type Condition interface {
	Node
	conditionNode()
}

// BinaryCondition represents a binary operation (and, or)
type BinaryCondition struct {
	Left     Condition
	Operator string // "and", "or"
	Right    Condition
}

func (c *BinaryCondition) conditionNode() {}
func (c *BinaryCondition) String() string {
	return fmt.Sprintf("%s %s %s", c.Left.String(), c.Operator, c.Right.String())
}

// NotCondition represents a negation
type NotCondition struct {
	Condition Condition
}

func (c *NotCondition) conditionNode() {}
func (c *NotCondition) String() string {
	return fmt.Sprintf("not %s", c.Condition.String())
}

// SpanCheck represents trace.has() or trace.count()
type SpanCheck interface {
	Condition
	spanCheckNode()
}

// ========================================
// Span Checks
// ========================================

// HasCheck represents trace.has(operation_name).where(...)
type HasCheck struct {
	OperationName string
	WhereFilters  []*WhereFilter
}

func (h *HasCheck) conditionNode() {}
func (h *HasCheck) spanCheckNode()  {}
func (h *HasCheck) String() string {
	result := fmt.Sprintf("trace.has(%s)", h.OperationName)
	for _, filter := range h.WhereFilters {
		result += filter.String()
	}
	return result
}

// CountCheck represents trace.count(operation_name) comparison value
type CountCheck struct {
	OperationName string
	Operator      string // ==, !=, >, >=, <, <=
	Value         Value
}

func (c *CountCheck) conditionNode() {}
func (c *CountCheck) spanCheckNode()  {}
func (c *CountCheck) String() string {
	return fmt.Sprintf("trace.count(%s) %s %s", c.OperationName, c.Operator, c.Value.String())
}

// ========================================
// Where Filters
// ========================================

// WhereFilter represents .where(attribute comparison value)
type WhereFilter struct {
	Attribute string
	Operator  string // ==, !=, >, >=, <, <=, in, matches
	Value     Value
}

func (w *WhereFilter) String() string {
	return fmt.Sprintf(".where(%s %s %s)", w.Attribute, w.Operator, w.Value.String())
}

// ========================================
// Values
// ========================================

// Value represents a literal value
type Value interface {
	Node
	valueNode()
}

// IdentValue represents an identifier (unquoted)
type IdentValue struct {
	Value string
}

func (v *IdentValue) valueNode()      {}
func (v *IdentValue) String() string  { return v.Value }

// NumberValue represents a numeric literal
type NumberValue struct {
	Value string
}

func (v *NumberValue) valueNode()     {}
func (v *NumberValue) String() string { return v.Value }

// StringValue represents a string literal (quoted)
type StringValue struct {
	Value string
}

func (v *StringValue) valueNode()     {}
func (v *StringValue) String() string { return fmt.Sprintf(`"%s"`, v.Value) }

// BoolValue represents a boolean literal
type BoolValue struct {
	Value bool
}

func (v *BoolValue) valueNode() {}
func (v *BoolValue) String() string {
	if v.Value {
		return "true"
	}
	return "false"
}

// ListValue represents a list literal [a, b, c]
type ListValue struct {
	Values []string
}

func (v *ListValue) valueNode() {}
func (v *ListValue) String() string {
	result := "["
	for i, val := range v.Values {
		if i > 0 {
			result += ", "
		}
		result += val
	}
	result += "]"
	return result
}
