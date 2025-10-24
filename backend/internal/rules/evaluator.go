package rules

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/betracehq/betrace/backend/pkg/models"
)

// Evaluator evaluates AST expressions against spans
type Evaluator struct{}

// NewEvaluator creates a new evaluator
func NewEvaluator() *Evaluator {
	return &Evaluator{}
}

// Evaluate evaluates an expression against a span
func (e *Evaluator) Evaluate(expr Expr, span *models.Span) (bool, error) {
	result, err := e.eval(expr, span)
	if err != nil {
		return false, err
	}

	// Convert result to boolean
	return toBool(result), nil
}

// eval recursively evaluates an expression node
func (e *Evaluator) eval(expr Expr, span *models.Span) (interface{}, error) {
	switch node := expr.(type) {
	case *Literal:
		return node.Value, nil

	case *FieldAccess:
		return e.evalFieldAccess(node, span)

	case *IndexAccess:
		return e.evalIndexAccess(node, span)

	case *BinaryExpr:
		return e.evalBinaryExpr(node, span)

	case *UnaryExpr:
		return e.evalUnaryExpr(node, span)

	default:
		return nil, fmt.Errorf("unsupported expression type: %T", expr)
	}
}

// evalFieldAccess evaluates field access like span.status or span.attributes.key
func (e *Evaluator) evalFieldAccess(node *FieldAccess, span *models.Span) (interface{}, error) {
	// Start with the object (should be "span")
	if node.Object != "span" {
		return nil, fmt.Errorf("unknown object: %s (only 'span' is supported)", node.Object)
	}

	// No fields means just the identifier (for expressions like "span")
	if len(node.Fields) == 0 {
		return span, nil
	}

	// First field determines the span property
	field := node.Fields[0]
	switch field {
	case "status":
		if len(node.Fields) > 1 {
			return nil, fmt.Errorf("status has no sub-fields")
		}
		return span.Status, nil

	case "name", "operation_name":
		if len(node.Fields) > 1 {
			return nil, fmt.Errorf("%s has no sub-fields", field)
		}
		return span.OperationName, nil

	case "service_name":
		if len(node.Fields) > 1 {
			return nil, fmt.Errorf("service_name has no sub-fields")
		}
		return span.ServiceName, nil

	case "duration":
		if len(node.Fields) > 1 {
			return nil, fmt.Errorf("duration has no sub-fields")
		}
		return float64(span.Duration), nil

	case "trace_id":
		if len(node.Fields) > 1 {
			return nil, fmt.Errorf("trace_id has no sub-fields")
		}
		return span.TraceID, nil

	case "span_id":
		if len(node.Fields) > 1 {
			return nil, fmt.Errorf("span_id has no sub-fields")
		}
		return span.SpanID, nil

	case "attributes":
		// attributes requires index access (handled separately)
		if len(node.Fields) == 1 {
			return span.Attributes, nil
		}
		// Nested field like span.attributes.key (deprecated, use span.attributes["key"])
		if len(node.Fields) == 2 {
			key := node.Fields[1]
			if val, ok := span.Attributes[key]; ok {
				return val, nil
			}
			return nil, nil
		}
		return nil, fmt.Errorf("attributes access requires bracket notation: span.attributes[\"key\"]")

	default:
		return nil, fmt.Errorf("unknown field: %s", field)
	}
}

// evalIndexAccess evaluates bracket access like span.attributes["http.method"]
func (e *Evaluator) evalIndexAccess(node *IndexAccess, span *models.Span) (interface{}, error) {
	// Evaluate the object (should be FieldAccess to span.attributes)
	obj, err := e.eval(node.Object, span)
	if err != nil {
		return nil, err
	}

	// Object must be a map (attributes)
	attrs, ok := obj.(map[string]string)
	if !ok {
		return nil, fmt.Errorf("index access requires map, got %T", obj)
	}

	// Evaluate the index
	idx, err := e.eval(node.Index, span)
	if err != nil {
		return nil, err
	}

	// Convert index to string key
	var key string
	switch v := idx.(type) {
	case string:
		key = v
	case float64:
		key = strconv.FormatFloat(v, 'f', -1, 64)
	default:
		return nil, fmt.Errorf("index must be string or number, got %T", idx)
	}

	// Lookup in attributes
	if val, ok := attrs[key]; ok {
		return val, nil
	}
	return nil, nil
}

// evalBinaryExpr evaluates binary operations
func (e *Evaluator) evalBinaryExpr(node *BinaryExpr, span *models.Span) (interface{}, error) {
	left, err := e.eval(node.Left, span)
	if err != nil {
		return nil, err
	}

	right, err := e.eval(node.Right, span)
	if err != nil {
		return nil, err
	}

	switch node.Op {
	case TokenEqual:
		return equals(left, right), nil
	case TokenNotEqual:
		return !equals(left, right), nil
	case TokenGreater:
		return compare(left, right) > 0, nil
	case TokenGreaterEqual:
		return compare(left, right) >= 0, nil
	case TokenLess:
		return compare(left, right) < 0, nil
	case TokenLessEqual:
		return compare(left, right) <= 0, nil
	case TokenAnd:
		return toBool(left) && toBool(right), nil
	case TokenOr:
		return toBool(left) || toBool(right), nil
	case TokenIn:
		return contains(right, left), nil
	case TokenMatches:
		return matches(left, right)
	default:
		return nil, fmt.Errorf("unsupported binary operator: %s", node.Op)
	}
}

// evalUnaryExpr evaluates unary operations
func (e *Evaluator) evalUnaryExpr(node *UnaryExpr, span *models.Span) (interface{}, error) {
	val, err := e.eval(node.Expr, span)
	if err != nil {
		return nil, err
	}

	switch node.Op {
	case TokenNot:
		return !toBool(val), nil
	default:
		return nil, fmt.Errorf("unsupported unary operator: %s", node.Op)
	}
}

// Helper functions

// equals compares two values for equality
func equals(a, b interface{}) bool {
	// Handle nil
	if a == nil && b == nil {
		return true
	}
	if a == nil || b == nil {
		return false
	}

	// Compare based on type
	switch av := a.(type) {
	case string:
		bv, ok := b.(string)
		return ok && av == bv
	case float64:
		bv, ok := b.(float64)
		return ok && av == bv
	case bool:
		bv, ok := b.(bool)
		return ok && av == bv
	default:
		return false
	}
}

// compare compares two values for ordering (returns -1, 0, 1)
func compare(a, b interface{}) int {
	// Convert to float64 for numeric comparison
	aNum, aOk := toFloat64(a)
	bNum, bOk := toFloat64(b)

	if aOk && bOk {
		if aNum < bNum {
			return -1
		}
		if aNum > bNum {
			return 1
		}
		return 0
	}

	// String comparison
	aStr := toString(a)
	bStr := toString(b)
	return strings.Compare(aStr, bStr)
}

// toBool converts a value to boolean
func toBool(v interface{}) bool {
	if v == nil {
		return false
	}

	switch val := v.(type) {
	case bool:
		return val
	case string:
		return val != ""
	case float64:
		return val != 0
	default:
		return false
	}
}

// toFloat64 converts a value to float64
func toFloat64(v interface{}) (float64, bool) {
	switch val := v.(type) {
	case float64:
		return val, true
	case string:
		f, err := strconv.ParseFloat(val, 64)
		return f, err == nil
	default:
		return 0, false
	}
}

// toString converts a value to string
func toString(v interface{}) string {
	if v == nil {
		return ""
	}

	switch val := v.(type) {
	case string:
		return val
	case float64:
		return strconv.FormatFloat(val, 'f', -1, 64)
	case bool:
		return strconv.FormatBool(val)
	default:
		return fmt.Sprintf("%v", v)
	}
}

// contains checks if a collection contains a value
func contains(collection, value interface{}) bool {
	switch coll := collection.(type) {
	case string:
		return strings.Contains(coll, toString(value))
	case map[string]string:
		_, ok := coll[toString(value)]
		return ok
	default:
		return false
	}
}

// matches checks if a string matches a pattern (simple substring for now)
func matches(value, pattern interface{}) (bool, error) {
	vStr := toString(value)
	pStr := toString(pattern)

	// Simple substring match for now
	// TODO: Add regex support if needed
	return strings.Contains(vStr, pStr), nil
}
