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

// SpanCheck is trace.has() or trace.count()
type SpanCheck struct {
	Has   *HasCheck   `  ( "trace" "." "has" "(" @@ )`
	Count *CountCheck `| ( "trace" "." "count" "(" @@ ")" )`
}

// HasCheck represents trace.has(op).where(filter)
type HasCheck struct {
	OpName string       `@Ident ")"`
	Where  *WhereFilter `( "." "where" "(" @@ ")" )?`
}

// CountCheck represents trace.count(op) > N
type CountCheck struct {
	OpName   string `@Ident`
	Operator string `")" @( ">" | ">=" | "<" | "<=" | "==" | "!=" )`
	Value    int    `@Int`
}

// WhereFilter is attribute comparisons
type WhereFilter struct {
	Attribute string `@Ident`
	Operator  string `@( "==" | "!=" | "<=" | ">=" | "<" | ">" | "in" | "matches" )`
	Value     *Value `@@`
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
	{Name: "Float", Pattern: `\d+\.\d+`},
	{Name: "Int", Pattern: `\d+`},
	{Name: "String", Pattern: `"[^"]*"`},
	{Name: "Keyword", Pattern: `\b(trace|has|where|count|and|or|not|in|matches|true|false|when|always|never)\b`},
	{Name: "Ident", Pattern: `[a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*`},
	{Name: "Operator", Pattern: `==|!=|<=|>=|<|>`},
	{Name: "Punct", Pattern: `[{}()\[\],.]`},
})

// Parser is the DSL parser
var Parser = participle.MustBuild[Rule](
	participle.Lexer(dslLexer),
	participle.Elide("Whitespace", "Comment"),
	participle.UseLookahead(2),
)

// Parse parses a BeTrace DSL rule
func Parse(input string) (*Rule, error) {
	return Parser.ParseString("", input)
}
