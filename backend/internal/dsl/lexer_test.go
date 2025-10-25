package dsl

import (
	"testing"
)

func TestLexer_NextToken(t *testing.T) {
	input := `trace.has(payment.charge_card).where(amount > 1000)
	and trace.has(payment.fraud_check)

	// This is a comment
	when { trace.has(test) }
	always { trace.has(required) }
	never { trace.has(forbidden) }

	trace.count(retry) > 3
	matches in [a, b, c]
	== != < <= > >= true false`

	tests := []struct {
		expectedType    TokenType
		expectedLiteral string
	}{
		{TRACE, "trace"},
		{DOT, "."},
		{HAS, "has"},
		{LPAREN, "("},
		{IDENT, "payment.charge_card"},
		{RPAREN, ")"},
		{DOT, "."},
		{WHERE, "where"},
		{LPAREN, "("},
		{IDENT, "amount"},
		{GT, ">"},
		{NUMBER, "1000"},
		{RPAREN, ")"},
		{AND, "and"},
		{TRACE, "trace"},
		{DOT, "."},
		{HAS, "has"},
		{LPAREN, "("},
		{IDENT, "payment.fraud_check"},
		{RPAREN, ")"},

		// when-always-never
		{WHEN, "when"},
		{LBRACE, "{"},
		{TRACE, "trace"},
		{DOT, "."},
		{HAS, "has"},
		{LPAREN, "("},
		{IDENT, "test"},
		{RPAREN, ")"},
		{RBRACE, "}"},
		{ALWAYS, "always"},
		{LBRACE, "{"},
		{TRACE, "trace"},
		{DOT, "."},
		{HAS, "has"},
		{LPAREN, "("},
		{IDENT, "required"},
		{RPAREN, ")"},
		{RBRACE, "}"},
		{NEVER, "never"},
		{LBRACE, "{"},
		{TRACE, "trace"},
		{DOT, "."},
		{HAS, "has"},
		{LPAREN, "("},
		{IDENT, "forbidden"},
		{RPAREN, ")"},
		{RBRACE, "}"},

		// count
		{TRACE, "trace"},
		{DOT, "."},
		{COUNT, "count"},
		{LPAREN, "("},
		{IDENT, "retry"},
		{RPAREN, ")"},
		{GT, ">"},
		{NUMBER, "3"},

		// keywords and operators
		{MATCHES, "matches"},
		{IN, "in"},
		{LBRACKET, "["},
		{IDENT, "a"},
		{COMMA, ","},
		{IDENT, "b"},
		{COMMA, ","},
		{IDENT, "c"},
		{RBRACKET, "]"},
		{EQ, "=="},
		{NEQ, "!="},
		{LT, "<"},
		{LTE, "<="},
		{GT, ">"},
		{GTE, ">="},
		{TRUE, "true"},
		{FALSE, "false"},
		{EOF, ""},
	}

	l := NewLexer(input)

	for i, tt := range tests {
		tok := l.NextToken()

		if tok.Type != tt.expectedType {
			t.Fatalf("tests[%d] - tokentype wrong. expected=%q, got=%q (literal=%q)",
				i, tt.expectedType, tok.Type, tok.Literal)
		}

		if tok.Literal != tt.expectedLiteral {
			t.Fatalf("tests[%d] - literal wrong. expected=%q, got=%q",
				i, tt.expectedLiteral, tok.Literal)
		}
	}
}

func TestLexer_Strings(t *testing.T) {
	input := `matches "/api/v1/admin/.*"`

	tests := []struct {
		expectedType    TokenType
		expectedLiteral string
	}{
		{MATCHES, "matches"},
		{STRING, "/api/v1/admin/.*"},
		{EOF, ""},
	}

	l := NewLexer(input)

	for i, tt := range tests {
		tok := l.NextToken()

		if tok.Type != tt.expectedType {
			t.Fatalf("tests[%d] - tokentype wrong. expected=%q, got=%q",
				i, tt.expectedType, tok.Type)
		}

		if tok.Literal != tt.expectedLiteral {
			t.Fatalf("tests[%d] - literal wrong. expected=%q, got=%q",
				i, tt.expectedLiteral, tok.Literal)
		}
	}
}

func TestLexer_Numbers(t *testing.T) {
	input := `123 45.67 100.5`

	tests := []struct {
		expectedType    TokenType
		expectedLiteral string
	}{
		{NUMBER, "123"},
		{NUMBER, "45.67"},
		{NUMBER, "100.5"},
		{EOF, ""},
	}

	l := NewLexer(input)

	for i, tt := range tests {
		tok := l.NextToken()

		if tok.Type != tt.expectedType {
			t.Fatalf("tests[%d] - tokentype wrong. expected=%q, got=%q",
				i, tt.expectedType, tok.Type)
		}

		if tok.Literal != tt.expectedLiteral {
			t.Fatalf("tests[%d] - literal wrong. expected=%q, got=%q",
				i, tt.expectedLiteral, tok.Literal)
		}
	}
}

func TestLexer_Comments(t *testing.T) {
	input := `trace.has(test) // this is a comment
	and trace.has(other)`

	tests := []struct {
		expectedType    TokenType
		expectedLiteral string
	}{
		{TRACE, "trace"},
		{DOT, "."},
		{HAS, "has"},
		{LPAREN, "("},
		{IDENT, "test"},
		{RPAREN, ")"},
		// Comment should be skipped
		{AND, "and"},
		{TRACE, "trace"},
		{DOT, "."},
		{HAS, "has"},
		{LPAREN, "("},
		{IDENT, "other"},
		{RPAREN, ")"},
		{EOF, ""},
	}

	l := NewLexer(input)

	for i, tt := range tests {
		tok := l.NextToken()

		if tok.Type != tt.expectedType {
			t.Fatalf("tests[%d] - tokentype wrong. expected=%q, got=%q",
				i, tt.expectedType, tok.Type)
		}

		if tok.Literal != tt.expectedLiteral {
			t.Fatalf("tests[%d] - literal wrong. expected=%q, got=%q",
				i, tt.expectedLiteral, tok.Literal)
		}
	}
}
