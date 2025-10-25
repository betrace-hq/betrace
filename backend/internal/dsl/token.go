package dsl

// TokenType represents the type of a lexical token
type TokenType int

const (
	// Special tokens
	ILLEGAL TokenType = iota
	EOF
	WHITESPACE
	COMMENT

	// Literals
	IDENT  // operation_name, attribute_name
	NUMBER // 123, 45.67
	STRING // "regex pattern"

	// Keywords
	TRACE
	HAS
	WHERE
	COUNT
	AND
	OR
	NOT
	IN
	MATCHES
	TRUE
	FALSE
	WHEN
	ALWAYS
	NEVER

	// Delimiters
	LPAREN    // (
	RPAREN    // )
	LBRACKET  // [
	RBRACKET  // ]
	LBRACE    // {
	RBRACE    // }
	COMMA     // ,
	DOT       // .

	// Operators
	EQ       // ==
	NEQ      // !=
	LT       // <
	LTE      // <=
	GT       // >
	GTE      // >=
)

// Token represents a lexical token
type Token struct {
	Type    TokenType
	Literal string
	Line    int
	Column  int
}

var keywords = map[string]TokenType{
	"trace":   TRACE,
	"has":     HAS,
	"where":   WHERE,
	"count":   COUNT,
	"and":     AND,
	"or":      OR,
	"not":     NOT,
	"in":      IN,
	"matches": MATCHES,
	"true":    TRUE,
	"false":   FALSE,
	"when":    WHEN,
	"always":  ALWAYS,
	"never":   NEVER,
}

// LookupIdent checks if an identifier is a keyword
func LookupIdent(ident string) TokenType {
	if tok, ok := keywords[ident]; ok {
		return tok
	}
	return IDENT
}

// String returns the string representation of a token type
func (t TokenType) String() string {
	switch t {
	case ILLEGAL:
		return "ILLEGAL"
	case EOF:
		return "EOF"
	case WHITESPACE:
		return "WHITESPACE"
	case COMMENT:
		return "COMMENT"
	case IDENT:
		return "IDENT"
	case NUMBER:
		return "NUMBER"
	case STRING:
		return "STRING"
	case TRACE:
		return "TRACE"
	case HAS:
		return "HAS"
	case WHERE:
		return "WHERE"
	case COUNT:
		return "COUNT"
	case AND:
		return "AND"
	case OR:
		return "OR"
	case NOT:
		return "NOT"
	case IN:
		return "IN"
	case MATCHES:
		return "MATCHES"
	case TRUE:
		return "TRUE"
	case FALSE:
		return "FALSE"
	case WHEN:
		return "WHEN"
	case ALWAYS:
		return "ALWAYS"
	case NEVER:
		return "NEVER"
	case LPAREN:
		return "LPAREN"
	case RPAREN:
		return "RPAREN"
	case LBRACKET:
		return "LBRACKET"
	case RBRACKET:
		return "RBRACKET"
	case LBRACE:
		return "LBRACE"
	case RBRACE:
		return "RBRACE"
	case COMMA:
		return "COMMA"
	case DOT:
		return "DOT"
	case EQ:
		return "EQ"
	case NEQ:
		return "NEQ"
	case LT:
		return "LT"
	case LTE:
		return "LTE"
	case GT:
		return "GT"
	case GTE:
		return "GTE"
	default:
		return "UNKNOWN"
	}
}
