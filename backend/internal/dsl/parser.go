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
type HasCheck struct {
	// Try .where() first (most specific - requires "where" keyword)
	WithWhere *OpWithWhere `  @@`
	// Or direct comparison (requires comparison operator)
	WithComp  *OpWithComp  `| @@`
	// Or just operation name (fallback)
	JustName  []string     `| @Ident ( "." @Ident )*`
}

// OpWithWhere is operation_name.where(complex_condition)
// For now, operation name before .where() must be a single ident (no dots)
type OpWithWhere struct {
	OpName string       `@Ident`
	Dot    string       `@"."`
	Keyword string      `@"where"`
	Where  *WhereFilter `"(" @@ ")"`
}

// OpWithComp is operation.path.attribute > value
type OpWithComp struct {
	Path       []string    `@Ident ( "." @Ident )*`
	Comparison *Comparison `@@`
}

// Comparison is a direct comparison (e.g., > 1000)
type Comparison struct {
	Operator string `@( "==" | "!=" | "<=" | ">=" | "<" | ">" | "in" | "matches" )`
	Value    *Value `@@`
}

// CountCheck represents count(op) > N
type CountCheck struct {
	OpName   []string `@Ident ( "." @Ident )* ")"`
	Operator string   `@( ">" | ">=" | "<" | "<=" | "==" | "!=" )`
	Value    int      `@Int`
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

// WhereAtomicTerm is a single comparison or grouped condition
type WhereAtomicTerm struct {
	Not        bool              `@"not"?`
	Grouped    *WhereCondition   `(  "(" @@ ")"`
	Comparison *WhereComparison  `| @@ )`
}

// WhereComparison is a single attribute comparison
type WhereComparison struct {
	Attribute []string `@Ident ( "." @Ident )*`
	Operator  string   `@( "==" | "!=" | "<=" | ">=" | "<" | ">" | "in" | "matches" )`
	Value     *Value   `@@`
}

// Value represents literal values
type Value struct {
	String *string  `  @String`
	Number *float64 `| @Float`
	Int    *int     `| @Int`
	Bool   *bool    `| ( @"true" | @"false" )`
	List   []string `| "[" ( @String | @Ident ) ( "," ( @String | @Ident ) )* "]"`
}

var dslLexer = lexer.MustSimple([]lexer.SimpleRule{
	{Name: "Whitespace", Pattern: `[ \t\n\r]+`},
	{Name: "Comment", Pattern: `//[^\n]*`},
	{Name: "Keyword", Pattern: `\b(where|count|and|or|not|in|matches|true|false|when|always|never)\b`},
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
	participle.UseLookahead(50), // High lookahead to handle dotted paths + where/comparisons
)

// Parse parses a BeTrace DSL rule
func Parse(input string) (*Rule, error) {
	return Parser.ParseString("", input)
}
