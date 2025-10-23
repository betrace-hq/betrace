# FLUO Rule Engine Design (Go Native)

**Status**: Design Phase
**Target**: Replace Drools Fusion (Java) with Go-native implementation
**Priority**: P0 - Core Feature

## Executive Summary

FLUO's rule engine enables behavioral pattern matching on OpenTelemetry traces using a custom DSL. The existing Java/Drools implementation will be replaced with a lightweight Go-native engine optimized for:

- **Performance**: 100K+ spans/sec throughput
- **Security**: Sandboxed rule execution (no arbitrary code execution)
- **Simplicity**: Pure Go, no JVM, no CGO dependencies

## DSL Overview

### Syntax Examples

```javascript
// Basic existence checks
trace.has(payment.charge_card) and trace.has(payment.fraud_check)

// Attribute filtering
trace.has(payment.charge_card).where(amount > 1000)
  and trace.has(payment.fraud_check)

// Negation (missing patterns)
trace.has(database.query).where(data.contains_pii == true)
  and not trace.has(audit.log)

// Span counting
trace.count(http.retry) > 3
```

### Grammar

```
rule := condition

condition := term (("and" | "or") term)*

term := "not"? span_check

span_check := "trace.has(" identifier ")" where_clause*
            | "trace.count(" identifier ")" comparison_op value

where_clause := ".where(" attribute_name comparison_op value ")"

comparison_op := "==" | "!=" | ">" | ">=" | "<" | "<=" | "in" | "matches"

identifier := [a-zA-Z_][a-zA-Z0-9_.]*

value := identifier | number | boolean | string | list
```

## Architecture

```
┌─────────────────────────────────────┐
│  DSL Input (User-facing)            │
│  trace.has(X).where(Y) and ...      │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  Lexer                              │
│  Tokenize DSL into tokens           │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  Parser                             │
│  Build AST from tokens              │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  Validator                          │
│  Security checks, syntax validation │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  Evaluator                          │
│  Execute AST against trace data     │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  Violation Recorder                 │
│  Create violation if rule fires     │
└─────────────────────────────────────┘
```

## Component Design

### 1. Lexer (`internal/rules/lexer.go`)

**Purpose**: Convert DSL text into tokens

```go
package rules

type TokenType int

const (
	TokenEOF TokenType = iota
	TokenIdentifier
	TokenNumber
	TokenString
	TokenDot
	TokenComma
	TokenLParen
	TokenRParen
	TokenLBracket
	TokenRBracket
	TokenAnd
	TokenOr
	TokenNot
	TokenEqual
	TokenNotEqual
	TokenGreater
	TokenGreaterEqual
	TokenLess
	TokenLessEqual
	TokenIn
	TokenMatches
)

type Token struct {
	Type    TokenType
	Lexeme  string
	Line    int
	Column  int
}

type Lexer struct {
	input   string
	pos     int
	line    int
	column  int
	tokens  []Token
}

func NewLexer(input string) *Lexer
func (l *Lexer) Tokenize() ([]Token, error)
```

**Key Features**:
- Line/column tracking for error messages
- Keyword recognition (`and`, `or`, `not`, `trace`, `has`, `where`, `count`)
- Quoted string handling (for regex patterns)
- Number parsing (integers and floats)

### 2. Parser (`internal/rules/parser.go`)

**Purpose**: Build Abstract Syntax Tree from tokens

```go
package rules

// AST node types
type Node interface {
	Type() NodeType
}

type NodeType int

const (
	NodeCondition NodeType = iota
	NodeTerm
	NodeHasCheck
	NodeCountCheck
	NodeWhereClause
	NodeComparison
)

// Condition: term (and|or term)*
type ConditionNode struct {
	Operator string // "and" or "or"
	Left     Node
	Right    Node
}

// Term: not? span_check
type TermNode struct {
	Negated bool
	Check   Node
}

// Has check: trace.has(operation_name).where(...)
type HasCheckNode struct {
	OperationName string
	WhereClauses  []*WhereClauseNode
}

// Count check: trace.count(operation_pattern) > N
type CountCheckNode struct {
	OperationPattern string
	Comparison       *ComparisonNode
}

// Where clause: .where(attribute op value)
type WhereClauseNode struct {
	Attribute  string
	Comparison *ComparisonNode
}

// Comparison: attr == value
type ComparisonNode struct {
	Operator string // "==", "!=", ">", ">=", "<", "<=", "in", "matches"
	Value    interface{}
}

type Parser struct {
	tokens []Token
	pos    int
}

func NewParser(tokens []Token) *Parser
func (p *Parser) Parse() (Node, error)
```

**Parsing Strategy**:
- Recursive descent parser
- Left-to-right precedence for `and`/`or` (no operator precedence needed)
- Error recovery with line/column reporting

### 3. Validator (`internal/rules/validator.go`)

**Purpose**: Security checks and semantic validation

```go
package rules

type Validator struct {
	maxDepth         int // Prevent deeply nested expressions
	maxWhereClauses  int // Prevent excessive filtering
	forbiddenPatterns []string
}

func NewValidator() *Validator

// Validates AST for security and correctness
func (v *Validator) Validate(ast Node) error

// Security checks:
// - AST depth < 10 (prevent stack overflow)
// - Where clause count < 20 per has()
// - No SQL injection patterns in identifiers
// - No code execution patterns (eval, exec, etc.)
// - Regex patterns are valid and safe
```

**Security Properties**:
- ✅ No reflection/code generation (pure AST evaluation)
- ✅ No arbitrary code execution (sandboxed DSL only)
- ✅ Resource limits enforced at compile time
- ✅ Regex validation (prevent ReDoS attacks)

### 4. Evaluator (`internal/rules/evaluator.go`)

**Purpose**: Execute AST against trace data

```go
package rules

type Trace struct {
	TraceID string
	Spans   []Span
}

type Span struct {
	SpanID        string
	OperationName string
	Attributes    map[string]interface{}
	Duration      int64 // milliseconds
	Status        string
}

type Evaluator struct {
	ast Node
}

func NewEvaluator(ast Node) *Evaluator

// Evaluates rule against trace, returns true if rule fires
func (e *Evaluator) Evaluate(trace *Trace) (bool, error)

// Internal evaluation methods
func (e *Evaluator) evaluateCondition(node *ConditionNode, trace *Trace) bool
func (e *Evaluator) evaluateTerm(node *TermNode, trace *Trace) bool
func (e *Evaluator) evaluateHasCheck(node *HasCheckNode, trace *Trace) bool
func (e *Evaluator) evaluateCountCheck(node *CountCheckNode, trace *Trace) bool
func (e *Evaluator) evaluateWhereClause(node *WhereClauseNode, span *Span) bool
func (e *Evaluator) evaluateComparison(node *ComparisonNode, value interface{}) bool
```

**Evaluation Strategy**:
- Short-circuit evaluation for `and`/`or`
- Lazy filtering (only evaluate where clauses when needed)
- Type coercion for comparisons (string/int/float/bool)
- Regex caching for `matches` operator

### 5. Rule Manager (`internal/rules/manager.go`)

**Purpose**: Rule CRUD operations and compilation

```go
package rules

type Rule struct {
	ID          string
	Name        string
	Description string
	Severity    string // "critical", "high", "medium", "low"
	Condition   string // DSL text
	Enabled     bool
	TenantID    string
	CreatedAt   time.Time
	UpdatedAt   time.Time

	// Compiled AST (cached after first compilation)
	ast       Node
	evaluator *Evaluator
}

type RuleManager struct {
	rules map[string]*Rule // ruleID -> Rule
	mu    sync.RWMutex
}

func NewRuleManager() *RuleManager

// CRUD operations
func (rm *RuleManager) CreateRule(rule *Rule) error
func (rm *RuleManager) GetRule(ruleID string) (*Rule, error)
func (rm *RuleManager) UpdateRule(rule *Rule) error
func (rm *RuleManager) DeleteRule(ruleID string) error
func (rm *RuleManager) ListRules(tenantID string) ([]*Rule, error)

// Compilation
func (rm *RuleManager) CompileRule(rule *Rule) error

// Evaluation
func (rm *RuleManager) EvaluateTrace(trace *Trace, tenantID string) ([]*Violation, error)
```

**Key Features**:
- Thread-safe rule storage (sync.RWMutex)
- Lazy compilation (compile on first use, cache AST)
- Per-tenant rule isolation
- Efficient evaluation (parallel rule execution per trace)

### 6. Rule Storage (`internal/rules/storage.go`)

**Purpose**: Persist rules to DuckDB

```go
package rules

type RuleStorage interface {
	Store(ctx context.Context, rule *Rule) error
	Get(ctx context.Context, ruleID string) (*Rule, error)
	List(ctx context.Context, tenantID string) ([]*Rule, error)
	Delete(ctx context.Context, ruleID string) error
}

type DuckDBRuleStorage struct {
	db *sql.DB
}

func NewDuckDBRuleStorage(db *sql.DB) *DuckDBRuleStorage
```

**Schema**:
```sql
CREATE TABLE rules (
    id VARCHAR PRIMARY KEY,
    tenant_id VARCHAR NOT NULL,
    name VARCHAR NOT NULL,
    description TEXT,
    severity VARCHAR NOT NULL,
    condition TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    INDEX idx_tenant_id (tenant_id)
);
```

## API Design

### Rule Management API

```go
// POST /api/rules
type CreateRuleRequest struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
	Severity    string `json:"severity" binding:"required,oneof=critical high medium low"`
	Condition   string `json:"condition" binding:"required"`
	Enabled     bool   `json:"enabled"`
}

// GET /api/rules/:id
type GetRuleResponse struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Severity    string    `json:"severity"`
	Condition   string    `json:"condition"`
	Enabled     bool      `json:"enabled"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

// PUT /api/rules/:id
type UpdateRuleRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Severity    string `json:"severity,oneof=critical high medium low"`
	Condition   string `json:"condition"`
	Enabled     *bool  `json:"enabled"`
}

// GET /api/rules
type ListRulesResponse struct {
	Rules []GetRuleResponse `json:"rules"`
	Total int               `json:"total"`
}

// POST /api/rules/:id/validate
type ValidateRuleRequest struct {
	Condition string `json:"condition" binding:"required"`
}

type ValidateRuleResponse struct {
	Valid  bool   `json:"valid"`
	Error  string `json:"error,omitempty"`
	AST    string `json:"ast,omitempty"` // JSON representation of AST
}
```

## Testing Strategy

### Unit Tests (Target: 95% coverage)

```
internal/rules/lexer_test.go              (15 tests)
internal/rules/parser_test.go             (20 tests)
internal/rules/validator_test.go          (12 tests)
internal/rules/evaluator_test.go          (25 tests)
internal/rules/manager_test.go            (10 tests)
internal/rules/storage_test.go            (8 tests)
internal/api/rules_test.go                (15 tests)
internal/rules/security_test.go           (10 tests)
```

### Integration Tests

```go
// End-to-end rule evaluation
func TestRuleEngine_E2E_PaymentFraudCheck(t *testing.T) {
	// 1. Create rule via API
	rule := CreateRuleRequest{
		Name:     "Payment Fraud Check Required",
		Severity: "critical",
		Condition: `trace.has(payment.charge_card).where(amount > 1000)
		             and trace.has(payment.fraud_check)`,
		Enabled: true,
	}

	// 2. Send test trace
	trace := Trace{
		TraceID: "test-trace-123",
		Spans: []Span{
			{SpanID: "span-1", OperationName: "payment.charge_card", Attributes: map[string]interface{}{"amount": 1500}},
			// Missing: payment.fraud_check
		},
	}

	// 3. Verify violation created
	violations := evaluateTrace(trace)
	assert.Len(t, violations, 1)
	assert.Equal(t, "Payment Fraud Check Required", violations[0].RuleName)
}
```

### Security Tests (P0)

```go
// Test SQL injection resistance
func TestValidator_SQLInjection(t *testing.T) {
	malicious := `trace.has(payment'; DROP TABLE rules; --)`
	_, err := CompileRule(malicious)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "invalid identifier")
}

// Test ReDoS prevention
func TestValidator_ReDoSPrevention(t *testing.T) {
	malicious := `trace.has(api.request).where(endpoint matches "^(a+)+$")`
	_, err := CompileRule(malicious)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "unsafe regex pattern")
}

// Test resource exhaustion prevention
func TestValidator_ResourceLimits(t *testing.T) {
	// Deeply nested expressions
	deep := "trace.has(a) and " + strings.Repeat("trace.has(b) and ", 100) + "trace.has(c)"
	_, err := CompileRule(deep)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "AST depth exceeds limit")
}
```

## Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Rule compilation | <10ms | 99th percentile |
| Trace evaluation | <1ms | 99th percentile (10 rules) |
| Throughput | 100K spans/sec | Single node, 1000 rules |
| Memory overhead | <100MB | Per 1000 compiled rules |
| Regex cache hit rate | >95% | Production workload |

## Migration from Drools

### Phase 1: Parallel Deployment
- Deploy Go rule engine alongside existing Drools engine
- Run both engines on same traces (A/B testing)
- Compare violation output for consistency

### Phase 2: Gradual Cutover
- Route 10% of traces to Go engine
- Monitor for discrepancies
- Increase to 50%, then 100%

### Phase 3: Drools Removal
- Delete Java backend code
- Remove Drools dependencies
- Archive Java implementation for reference

## Open Questions

1. **Temporal Constraints**: How to handle `.within()` and `.followedBy()`?
   - **Answer**: Requires stateful trace buffering (deferred to Phase 2)

2. **Regex Performance**: Should we use Go's `regexp` or C-based `regexp2`?
   - **Answer**: Start with `regexp`, benchmark and switch if needed

3. **Rule Versioning**: How to handle rule updates without disrupting in-flight traces?
   - **Answer**: Immutable rule versions, copy-on-write semantics

4. **Multi-Tenant Isolation**: Should rules be evaluated per-tenant in parallel?
   - **Answer**: Yes, use goroutine pool with tenant-level concurrency

## References

- `/Users/sscoble/Projects/fluo/docs/technical/trace-rules-dsl.md` - DSL syntax
- `/Users/sscoble/Projects/fluo/docs/adrs/017-capability-based-rule-engine-security.md` - Security model
- `/Users/sscoble/Projects/fluo/marketing/knowledge-base/fluo-dsl-reference.md` - User-facing docs
- `/Users/sscoble/Projects/fluo/backend/docs/TESTING_METHODOLOGY.md` - Testing approach
