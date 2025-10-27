package rules

import (
	"fmt"

	"github.com/betracehq/betrace/backend/pkg/models"
)

// FieldFilter defines which fields a rule accesses
type FieldFilter struct {
	// Scalar fields accessed (status, duration, service_name, etc.)
	ScalarFields map[string]bool

	// Specific attribute keys accessed (e.g., "http.method", "user.id")
	AttributeKeys map[string]bool

	// If true, rule accesses ALL attributes (e.g., iteration over span.attributes)
	AccessesAllAttributes bool
}

// SpanContext provides lazy access to span data with field filtering
// Only loads fields that the rule actually references
type SpanContext struct {
	span   *models.Span
	filter *FieldFilter

	// Cached values (lazy-loaded on first access)
	cachedStatus        *string
	cachedDuration      *float64
	cachedServiceName   *string
	cachedOperationName *string
	cachedTraceID       *string
	cachedSpanID        *string

	// Cached attributes (only keys in filter)
	cachedAttributes map[string]*string
}

// NewSpanContext creates a lazy span context with field filtering
func NewSpanContext(span *models.Span, filter *FieldFilter) *SpanContext {
	return &SpanContext{
		span:             span,
		filter:           filter,
		cachedAttributes: make(map[string]*string),
	}
}

// GetStatus returns the span status (lazy-loaded)
func (ctx *SpanContext) GetStatus() string {
	if !ctx.filter.ScalarFields["status"] {
		return "" // Field not accessed by rule
	}
	if ctx.cachedStatus == nil {
		ctx.cachedStatus = &ctx.span.Status
	}
	return *ctx.cachedStatus
}

// GetDuration returns the span duration in milliseconds (lazy-loaded)
// Converts from nanoseconds (internal storage) to milliseconds (DSL convention)
func (ctx *SpanContext) GetDuration() float64 {
	if !ctx.filter.ScalarFields["duration"] {
		return 0
	}
	if ctx.cachedDuration == nil {
		// Convert nanoseconds to milliseconds for DSL compatibility
		val := float64(ctx.span.Duration) / 1000000.0
		ctx.cachedDuration = &val
	}
	return *ctx.cachedDuration
}

// GetServiceName returns the service name (lazy-loaded)
func (ctx *SpanContext) GetServiceName() string {
	if !ctx.filter.ScalarFields["service_name"] {
		return ""
	}
	if ctx.cachedServiceName == nil {
		ctx.cachedServiceName = &ctx.span.ServiceName
	}
	return *ctx.cachedServiceName
}

// GetOperationName returns the operation name (lazy-loaded)
func (ctx *SpanContext) GetOperationName() string {
	if !ctx.filter.ScalarFields["operation_name"] {
		return ""
	}
	if ctx.cachedOperationName == nil {
		ctx.cachedOperationName = &ctx.span.OperationName
	}
	return *ctx.cachedOperationName
}

// GetTraceID returns the trace ID (lazy-loaded)
func (ctx *SpanContext) GetTraceID() string {
	if !ctx.filter.ScalarFields["trace_id"] {
		return ""
	}
	if ctx.cachedTraceID == nil {
		ctx.cachedTraceID = &ctx.span.TraceID
	}
	return *ctx.cachedTraceID
}

// GetSpanID returns the span ID (lazy-loaded)
func (ctx *SpanContext) GetSpanID() string {
	if !ctx.filter.ScalarFields["span_id"] {
		return ""
	}
	if ctx.cachedSpanID == nil {
		ctx.cachedSpanID = &ctx.span.SpanID
	}
	return *ctx.cachedSpanID
}

// GetAttribute returns a specific attribute value (lazy-loaded)
func (ctx *SpanContext) GetAttribute(key string) (string, bool) {
	// Check if this key is in the filter
	if !ctx.filter.AccessesAllAttributes && !ctx.filter.AttributeKeys[key] {
		return "", false // Key not accessed by rule
	}

	// Check cache
	if cached, ok := ctx.cachedAttributes[key]; ok {
		if cached == nil {
			return "", false
		}
		return *cached, true
	}

	// Load from span
	if val, ok := ctx.span.Attributes[key]; ok {
		ctx.cachedAttributes[key] = &val
		return val, true
	}

	// Mark as non-existent (avoid repeated lookups)
	ctx.cachedAttributes[key] = nil
	return "", false
}

// GetAllAttributes returns all attributes (only if rule accesses them)
func (ctx *SpanContext) GetAllAttributes() map[string]string {
	if !ctx.filter.AccessesAllAttributes {
		return make(map[string]string) // Empty map if not accessed
	}
	return ctx.span.Attributes
}

// BuildFieldFilter analyzes AST to determine which fields are accessed
func BuildFieldFilter(ast Expr) *FieldFilter {
	filter := &FieldFilter{
		ScalarFields:  make(map[string]bool),
		AttributeKeys: make(map[string]bool),
	}
	analyzeFieldAccess(ast, filter)
	return filter
}

// analyzeFieldAccess recursively walks AST to build field filter
func analyzeFieldAccess(expr Expr, filter *FieldFilter) {
	switch node := expr.(type) {
	case *FieldAccess:
		if node.Object == "span" && len(node.Fields) > 0 {
			field := node.Fields[0]
			if field == "attributes" {
				if len(node.Fields) == 1 {
					// Accessing span.attributes directly (all attributes)
					filter.AccessesAllAttributes = true
				} else if len(node.Fields) == 2 {
					// Accessing span.attributes.key
					filter.AttributeKeys[node.Fields[1]] = true
				}
			} else {
				// Scalar field (status, duration, etc.)
				filter.ScalarFields[field] = true
			}
		}

	case *IndexAccess:
		// Handle span.attributes["key"]
		if fieldAccess, ok := node.Object.(*FieldAccess); ok {
			if fieldAccess.Object == "span" && len(fieldAccess.Fields) > 0 && fieldAccess.Fields[0] == "attributes" {
				// Check if index is a literal string
				if literal, ok := node.Index.(*Literal); ok {
					if key, ok := literal.Value.(string); ok {
						filter.AttributeKeys[key] = true
					}
				} else {
					// Dynamic index (e.g., variable) - must load all attributes
					filter.AccessesAllAttributes = true
				}
				// Don't recurse into node.Object - we've already handled it
				analyzeFieldAccess(node.Index, filter)
				return
			}
		}
		// Not span.attributes - recurse normally
		analyzeFieldAccess(node.Object, filter)
		analyzeFieldAccess(node.Index, filter)

	case *BinaryExpr:
		analyzeFieldAccess(node.Left, filter)
		analyzeFieldAccess(node.Right, filter)

	case *UnaryExpr:
		analyzeFieldAccess(node.Expr, filter)

	case *CallExpr:
		for _, arg := range node.Args {
			analyzeFieldAccess(arg, filter)
		}
	}
}

// EvaluateWithContext evaluates an expression against a SpanContext (lazy evaluation)
func (e *Evaluator) EvaluateWithContext(expr Expr, ctx *SpanContext) (bool, error) {
	result, err := e.evalContext(expr, ctx)
	if err != nil {
		return false, err
	}
	return toBool(result), nil
}

// evalContext is like eval but uses SpanContext instead of models.Span
func (e *Evaluator) evalContext(expr Expr, ctx *SpanContext) (interface{}, error) {
	switch node := expr.(type) {
	case *Literal:
		return node.Value, nil

	case *FieldAccess:
		return e.evalFieldAccessContext(node, ctx)

	case *IndexAccess:
		return e.evalIndexAccessContext(node, ctx)

	case *BinaryExpr:
		left, err := e.evalContext(node.Left, ctx)
		if err != nil {
			return nil, err
		}
		right, err := e.evalContext(node.Right, ctx)
		if err != nil {
			return nil, err
		}
		// Binary operations (same logic as evaluator.go)
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

	case *UnaryExpr:
		val, err := e.evalContext(node.Expr, ctx)
		if err != nil {
			return nil, err
		}

		// Unary operations
		switch node.Op {
		case TokenNot:
			return !toBool(val), nil
		default:
			return nil, fmt.Errorf("unsupported unary operator: %s", node.Op)
		}

	case *CallExpr:
		// TODO: Implement function calls if needed
		return nil, fmt.Errorf("function calls not yet supported in lazy evaluation")

	default:
		return nil, fmt.Errorf("unknown expression type: %T", node)
	}
}

// evalFieldAccessContext evaluates field access using SpanContext
func (e *Evaluator) evalFieldAccessContext(node *FieldAccess, ctx *SpanContext) (interface{}, error) {
	if node.Object != "span" {
		return nil, fmt.Errorf("unknown object: %s", node.Object)
	}

	if len(node.Fields) == 0 {
		return nil, fmt.Errorf("span object requires field access")
	}

	field := node.Fields[0]
	switch field {
	case "status":
		return ctx.GetStatus(), nil
	case "operation_name":
		return ctx.GetOperationName(), nil
	case "service_name":
		return ctx.GetServiceName(), nil
	case "duration":
		return ctx.GetDuration(), nil
	case "trace_id":
		return ctx.GetTraceID(), nil
	case "span_id":
		return ctx.GetSpanID(), nil
	case "attributes":
		if len(node.Fields) == 1 {
			return ctx.GetAllAttributes(), nil
		}
		if len(node.Fields) == 2 {
			val, _ := ctx.GetAttribute(node.Fields[1])
			return val, nil
		}
		return nil, fmt.Errorf("attributes access requires bracket notation")
	default:
		return nil, fmt.Errorf("unknown field: %s", field)
	}
}

// evalIndexAccessContext evaluates index access using SpanContext
func (e *Evaluator) evalIndexAccessContext(node *IndexAccess, ctx *SpanContext) (interface{}, error) {
	obj, err := e.evalContext(node.Object, ctx)
	if err != nil {
		return nil, err
	}

	idx, err := e.evalContext(node.Index, ctx)
	if err != nil {
		return nil, err
	}

	switch obj.(type) {
	case map[string]string:
		key, ok := idx.(string)
		if !ok {
			return nil, fmt.Errorf("map index must be string, got %T", idx)
		}
		val, exists := ctx.GetAttribute(key)
		if !exists {
			return nil, nil
		}
		return val, nil
	default:
		return nil, fmt.Errorf("index access on non-indexable type: %T", obj)
	}
}
