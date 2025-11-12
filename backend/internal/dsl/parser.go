package dsl

import (
	"github.com/alecthomas/participle/v2"
	"github.com/alecthomas/participle/v2/lexer"
)

// DSL Grammar using participle

// Rule represents a complete when-always-never rule
type Rule struct {
	When   *Condition `"when" "{" @@ "}"`
	Always *Condition `( "always" "{" @@ "}" )?`
	Never  *Condition `( "never" "{" @@ "}" )?`
}

// Condition is a boolean expression with OR at top level
type Condition struct {
	Or []*OrTerm `@@ ( "or" @@ )*`
}

// OrTerm handles AND (higher precedence than OR)
type OrTerm struct {
	And []*AndTerm `@@ ( "and" @@ )*`
}

// AndTerm handles NOT and parentheses
type AndTerm struct {
	Not  bool  `@"not"?`
	Term *Term `@@`
}

// Term is either grouped or a span check
type Term struct {
	Grouped   *Condition `  "(" @@ ")"`
	SpanCheck *SpanCheck `| @@`
}

// SpanCheck is operation_name.where() or count(operation_name) > N
type SpanCheck struct {
	Count *CountCheck `  ( "count" "(" @@ )`
	Has   *HasCheck   `| @@`
}

// HasCheck represents operation_name with optional attribute comparison or .where()
// Always captures the operation name first, then checks what follows
type HasCheck struct {
	OpName        []string       `@Ident ( "." @Ident )*`  // Capture operation name (with dots)
	// Then one of these options:
	Where         *WhereChain    `( @@`                     // .where() chain
	Comparison    *Comparison    `| @@ )?`                  // OR direct comparison
}

// WhereChain represents .where() with optional chaining
// Supports: .where(amount > 1000).where(currency == "USD")
type WhereChain struct {
	First         *WhereFilter   `"." "where" "(" @@ ")"`   // First .where()
	ChainedWhere  []*WhereFilter `( "." "where" "(" @@ ")" )*`  // Optional additional .where() calls
}

// Comparison is a direct comparison between left expression and right expression
type Comparison struct {
	Operator string      `@( "==" | "!=" | "<=" | ">=" | "<" | ">" | "in" | "matches" | "contains" )`
	Right    *Expression `@@`
}

// Expression represents a value-producing expression (literal, count, or attribute path)
type Expression struct {
	Value *Value       `  @@`
	Count *CountExpr   `| @@`
	Path  []string     `| @Ident ( "." @Ident )*`  // For future: attribute references
}

// CountExpr represents count(operation_name) as an expression
type CountExpr struct {
	OpName []string `"count" "(" @Ident ( "." @Ident )* ")"`
}

// CountCheck represents count(op) comparison (now uses Expression on right)
type CountCheck struct {
	OpName   []string    `@Ident ( "." @Ident )* ")"`
	Operator string      `@( ">" | ">=" | "<" | "<=" | "==" | "!=" )`
	Right    *Expression `@@`
}

// WhereFilter is attribute comparisons or complex boolean expressions
type WhereFilter struct {
	Condition *WhereCondition `@@`
}

// WhereCondition is a boolean expression for .where() clauses
type WhereCondition struct {
	Or []*WhereAndTerm `@@ ( "or" @@ )*`
}

// WhereAndTerm handles AND in where clauses
type WhereAndTerm struct {
	And []*WhereAtomicTerm `@@ ( "and" @@ )*`
}

// WhereAtomicTerm is a single comparison, span reference, or grouped condition
type WhereAtomicTerm struct {
	Not        bool              `@"not"?`
	Grouped    *WhereCondition   `(  "(" @@ ")"`
	Comparison *WhereComparison  `| @@`
	SpanRef    *WhereSpanRef     `| @@`
	BoolIdent  *string           `| @Ident )`  // Bare boolean identifier (e.g., verified, active)
}

// WhereComparison is a single attribute comparison (scoped to parent span)
type WhereComparison struct {
	Attribute string      `( @Ident | @String )`  // Either single identifier or quoted string (for dotted names)
	Operator  string      `@( "==" | "!=" | "<=" | ">=" | "<" | ">" | "in" | "matches" | "contains" )`
	Right     *Expression `@@`
}

// WhereSpanRef is a reference to another span (global scope)
type WhereSpanRef struct {
	SpanName []string `@Ident ( "." @Ident )+`
}

// Value represents literal values
type Value struct {
	String *string  `  @String`
	Number *float64 `| @Float`
	Int    *int     `| @Int`
	Bool   *bool    `| ( @"true" | @"false" )`
	Ident  *string  `| @Ident`  // For enum-like values (e.g., USD, gold, premium)
	List   []string `| "[" ( @String | @Ident ) ( "," ( @String | @Ident ) )* "]"`
}

var dslLexer = lexer.MustSimple([]lexer.SimpleRule{
	{Name: "Whitespace", Pattern: `[ \t\n\r]+`},
	{Name: "Comment", Pattern: `//[^\n]*`},
	{Name: "Keyword", Pattern: `\b(where|count|and|or|not|in|matches|contains|true|false|when|always|never)\b`},
	{Name: "Float", Pattern: `\d+\.\d+`},
	{Name: "Int", Pattern: `\d+`},
	{Name: "String", Pattern: `"[^"]*"`},
	{Name: "Ident", Pattern: `[a-zA-Z_][a-zA-Z0-9_]*`},
	{Name: "Operator", Pattern: `==|!=|<=|>=|<|>`},
	{Name: "Punct", Pattern: `[{}()\[\],.]`},
})

// Parser is the DSL parser
var Parser = participle.MustBuild[Rule](
	participle.Lexer(dslLexer),
	participle.Elide("Whitespace", "Comment"),
	participle.UseLookahead(2), // Minimal lookahead - use scope boundaries instead
)

// Parse parses a BeTrace DSL rule
func Parse(input string) (*Rule, error) {
	return Parser.ParseString("", input)
}
