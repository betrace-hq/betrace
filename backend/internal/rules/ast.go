package rules

import "fmt"

// Expr represents an expression in the AST
type Expr interface {
	expr()
	String() string
}

// BinaryExpr represents a binary operation (AND, OR, ==, !=, <, >, etc.)
type BinaryExpr struct {
	Left  Expr
	Op    TokenType
	Right Expr
}

func (b *BinaryExpr) expr()          {}
func (b *BinaryExpr) String() string { return fmt.Sprintf("(%s %s %s)", b.Left, b.Op, b.Right) }

// UnaryExpr represents a unary operation (NOT)
type UnaryExpr struct {
	Op   TokenType
	Expr Expr
}

func (u *UnaryExpr) expr()          {}
func (u *UnaryExpr) String() string { return fmt.Sprintf("(%s %s)", u.Op, u.Expr) }

// FieldAccess represents accessing a field (e.g., span.status, span.attributes["http.method"])
type FieldAccess struct {
	Object string   // "span"
	Fields []string // ["status"] or ["attributes", "http.method"]
}

func (f *FieldAccess) expr() {}
func (f *FieldAccess) String() string {
	if len(f.Fields) == 0 {
		return f.Object
	}
	result := f.Object
	for _, field := range f.Fields {
		result += "." + field
	}
	return result
}

// IndexAccess represents bracket access (e.g., span.attributes["key"])
type IndexAccess struct {
	Object Expr
	Index  Expr
}

func (i *IndexAccess) expr()          {}
func (i *IndexAccess) String() string { return fmt.Sprintf("%s[%s]", i.Object, i.Index) }

// Literal represents a constant value (string, number, boolean)
type Literal struct {
	Type  TokenType // TokenString, TokenNumber, TokenTrue, TokenFalse
	Value interface{}
}

func (l *Literal) expr()          {}
func (l *Literal) String() string { return fmt.Sprintf("%v", l.Value) }

// CallExpr represents a function call (e.g., trace.has(...), string.contains(...))
type CallExpr struct {
	Function string
	Args     []Expr
}

func (c *CallExpr) expr() {}
func (c *CallExpr) String() string {
	args := ""
	for i, arg := range c.Args {
		if i > 0 {
			args += ", "
		}
		args += arg.String()
	}
	return fmt.Sprintf("%s(%s)", c.Function, args)
}
