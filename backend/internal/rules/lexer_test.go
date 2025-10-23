package rules

import (
	"testing"
)

func TestLexer_BasicTokens(t *testing.T) {
	input := "trace.has(payment.charge)"
	lexer := NewLexer(input)

	tokens, err := lexer.Tokenize()
	if err != nil {
		t.Fatalf("Tokenize() error = %v", err)
	}

	// Lexer treats "trace.has" as single identifier (parser will handle method call semantics)
	// "payment.charge" is also single identifier (operation name)
	expected := []TokenType{
		TokenIdentifier, // trace.has
		TokenLParen,
		TokenIdentifier, // payment.charge
		TokenRParen,
		TokenEOF,
	}

	if len(tokens) != len(expected) {
		t.Logf("Expected %d tokens, got %d:", len(expected), len(tokens))
		for i, tok := range tokens {
			t.Logf("  Token %d: %s (%s)", i, tok.Type, tok.Lexeme)
		}
		t.Fatalf("Token count mismatch")
	}

	expectedLexemes := []string{"trace.has", "(", "payment.charge", ")", ""}
	for i, tok := range tokens {
		if tok.Type != expected[i] {
			t.Errorf("Token %d: expected %s, got %s (%s)", i, expected[i], tok.Type, tok.Lexeme)
		}
		if i < len(expectedLexemes) && tok.Lexeme != expectedLexemes[i] {
			t.Errorf("Token %d lexeme: expected '%s', got '%s'", i, expectedLexemes[i], tok.Lexeme)
		}
	}
}

func TestLexer_Keywords(t *testing.T) {
	tests := []struct {
		input    string
		expected []TokenType
	}{
		{
			input:    "and or not",
			expected: []TokenType{TokenAnd, TokenOr, TokenNot, TokenEOF},
		},
		{
			input:    "in matches",
			expected: []TokenType{TokenIn, TokenMatches, TokenEOF},
		},
		{
			input:    "true false",
			expected: []TokenType{TokenTrue, TokenFalse, TokenEOF},
		},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			lexer := NewLexer(tt.input)
			tokens, err := lexer.Tokenize()
			if err != nil {
				t.Fatalf("Tokenize() error = %v", err)
			}

			if len(tokens) != len(tt.expected) {
				t.Fatalf("Expected %d tokens, got %d", len(tt.expected), len(tokens))
			}

			for i, tok := range tokens {
				if tok.Type != tt.expected[i] {
					t.Errorf("Token %d: expected %s, got %s", i, tt.expected[i], tok.Type)
				}
			}
		})
	}
}

func TestLexer_ComparisonOperators(t *testing.T) {
	tests := []struct {
		input    string
		expected TokenType
	}{
		{"==", TokenEqual},
		{"!=", TokenNotEqual},
		{">", TokenGreater},
		{">=", TokenGreaterEqual},
		{"<", TokenLess},
		{"<=", TokenLessEqual},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			lexer := NewLexer(tt.input)
			tokens, err := lexer.Tokenize()
			if err != nil {
				t.Fatalf("Tokenize() error = %v", err)
			}

			if len(tokens) < 1 {
				t.Fatal("Expected at least 1 token")
			}

			if tokens[0].Type != tt.expected {
				t.Errorf("Expected %s, got %s", tt.expected, tokens[0].Type)
			}
		})
	}
}

func TestLexer_Numbers(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"123", "123"},
		{"456.789", "456.789"},
		{"0", "0"},
		{"1000", "1000"},
		{"3.14159", "3.14159"},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			lexer := NewLexer(tt.input)
			tokens, err := lexer.Tokenize()
			if err != nil {
				t.Fatalf("Tokenize() error = %v", err)
			}

			if len(tokens) < 1 {
				t.Fatal("Expected at least 1 token")
			}

			tok := tokens[0]
			if tok.Type != TokenNumber {
				t.Errorf("Expected NUMBER token, got %s", tok.Type)
			}
			if tok.Lexeme != tt.expected {
				t.Errorf("Expected lexeme '%s', got '%s'", tt.expected, tok.Lexeme)
			}
		})
	}
}

func TestLexer_Strings(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{`"hello"`, "hello"},
		{`"/api/v1/admin/.*"`, "/api/v1/admin/.*"},
		{`"escaped \" quote"`, `escaped " quote`},
		{`""`, ""},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			lexer := NewLexer(tt.input)
			tokens, err := lexer.Tokenize()
			if err != nil {
				t.Fatalf("Tokenize() error = %v", err)
			}

			if len(tokens) < 1 {
				t.Fatal("Expected at least 1 token")
			}

			tok := tokens[0]
			if tok.Type != TokenString {
				t.Errorf("Expected STRING token, got %s", tok.Type)
			}
			if tok.Lexeme != tt.expected {
				t.Errorf("Expected lexeme '%s', got '%s'", tt.expected, tok.Lexeme)
			}
		})
	}
}

func TestLexer_ComplexExpression(t *testing.T) {
	input := `trace.has(payment.charge_card).where(amount > 1000)
	           and trace.has(payment.fraud_check)`

	lexer := NewLexer(input)
	tokens, err := lexer.Tokenize()
	if err != nil {
		t.Fatalf("Tokenize() error = %v", err)
	}

	// Lexer keeps dotted identifiers intact: trace.has, payment.charge_card, etc.
	expected := []TokenType{
		TokenIdentifier, // trace.has
		TokenLParen,
		TokenIdentifier, // payment.charge_card
		TokenRParen,
		TokenDot,        // .where (separate dot before where)
		TokenIdentifier, // where
		TokenLParen,
		TokenIdentifier, // amount
		TokenGreater,
		TokenNumber, // 1000
		TokenRParen,
		TokenAnd,
		TokenIdentifier, // trace.has
		TokenLParen,
		TokenIdentifier, // payment.fraud_check
		TokenRParen,
		TokenEOF,
	}

	if len(tokens) != len(expected) {
		t.Logf("Expected %d tokens, got %d:", len(expected), len(tokens))
		for i, tok := range tokens {
			t.Logf("  Token %d: %s (%s)", i, tok.Type, tok.Lexeme)
		}
		t.Fatalf("Token count mismatch")
	}

	for i, tok := range tokens {
		if tok.Type != expected[i] {
			t.Errorf("Token %d: expected %s, got %s (%s)", i, expected[i], tok.Type, tok.Lexeme)
		}
	}
}

func TestLexer_ListSyntax(t *testing.T) {
	input := "[stripe, square, paypal]"
	lexer := NewLexer(input)

	tokens, err := lexer.Tokenize()
	if err != nil {
		t.Fatalf("Tokenize() error = %v", err)
	}

	expected := []TokenType{
		TokenLBracket,
		TokenIdentifier, // stripe
		TokenComma,
		TokenIdentifier, // square
		TokenComma,
		TokenIdentifier, // paypal
		TokenRBracket,
		TokenEOF,
	}

	if len(tokens) != len(expected) {
		t.Fatalf("Expected %d tokens, got %d", len(expected), len(tokens))
	}

	for i, tok := range tokens {
		if tok.Type != expected[i] {
			t.Errorf("Token %d: expected %s, got %s", i, expected[i], tok.Type)
		}
	}
}

func TestLexer_DottedIdentifiers(t *testing.T) {
	input := "payment.charge_card"
	lexer := NewLexer(input)

	tokens, err := lexer.Tokenize()
	if err != nil {
		t.Fatalf("Tokenize() error = %v", err)
	}

	if len(tokens) != 2 { // identifier + EOF
		t.Fatalf("Expected 2 tokens, got %d", len(tokens))
	}

	tok := tokens[0]
	if tok.Type != TokenIdentifier {
		t.Errorf("Expected IDENTIFIER, got %s", tok.Type)
	}
	if tok.Lexeme != "payment.charge_card" {
		t.Errorf("Expected 'payment.charge_card', got '%s'", tok.Lexeme)
	}
}

func TestLexer_LineAndColumnTracking(t *testing.T) {
	input := "trace.has(payment)\nand trace.count(retry)"

	lexer := NewLexer(input)
	tokens, err := lexer.Tokenize()
	if err != nil {
		t.Fatalf("Tokenize() error = %v", err)
	}

	// Find the "and" token (should be on line 2)
	var andToken *Token
	for i := range tokens {
		if tokens[i].Type == TokenAnd {
			andToken = &tokens[i]
			break
		}
	}

	if andToken == nil {
		t.Fatal("Did not find AND token")
	}

	if andToken.Line != 2 {
		t.Errorf("Expected AND token on line 2, got line %d", andToken.Line)
	}
}

func TestLexer_UnterminatedString(t *testing.T) {
	input := `"unterminated string`
	lexer := NewLexer(input)

	_, err := lexer.Tokenize()
	if err == nil {
		t.Error("Expected error for unterminated string, got nil")
	}
}

func TestLexer_UnexpectedCharacter(t *testing.T) {
	input := "trace.has(payment) & other"
	lexer := NewLexer(input)

	_, err := lexer.Tokenize()
	if err == nil {
		t.Error("Expected error for unexpected character '&', got nil")
	}
}

func TestLexer_EmptyInput(t *testing.T) {
	input := ""
	lexer := NewLexer(input)

	tokens, err := lexer.Tokenize()
	if err != nil {
		t.Fatalf("Tokenize() error = %v", err)
	}

	if len(tokens) != 1 || tokens[0].Type != TokenEOF {
		t.Errorf("Expected single EOF token, got %d tokens", len(tokens))
	}
}

func TestLexer_WhitespaceHandling(t *testing.T) {
	input := "   trace.has(  payment  )   "
	lexer := NewLexer(input)

	tokens, err := lexer.Tokenize()
	if err != nil {
		t.Fatalf("Tokenize() error = %v", err)
	}

	// Should ignore whitespace, producing: trace.has ( payment ) EOF
	// (trace.has kept as single identifier per lexer rules)
	expected := []TokenType{
		TokenIdentifier, // trace.has
		TokenLParen,
		TokenIdentifier, // payment
		TokenRParen,
		TokenEOF,
	}

	if len(tokens) != len(expected) {
		t.Logf("Expected %d tokens, got %d:", len(expected), len(tokens))
		for i, tok := range tokens {
			t.Logf("  Token %d: %s (%s)", i, tok.Type, tok.Lexeme)
		}
		t.Fatalf("Token count mismatch")
	}

	for i, tok := range tokens {
		if tok.Type != expected[i] {
			t.Errorf("Token %d: expected %s, got %s", i, expected[i], tok.Type)
		}
	}
}

func TestTokenType_String(t *testing.T) {
	tests := []struct {
		tokenType TokenType
		expected  string
	}{
		{TokenEOF, "EOF"},
		{TokenIdentifier, "IDENTIFIER"},
		{TokenNumber, "NUMBER"},
		{TokenString, "STRING"},
		{TokenAnd, "AND"},
		{TokenOr, "OR"},
		{TokenNot, "NOT"},
		{TokenEqual, "EQUAL"},
		{TokenNotEqual, "NOT_EQUAL"},
	}

	for _, tt := range tests {
		t.Run(tt.expected, func(t *testing.T) {
			result := tt.tokenType.String()
			if result != tt.expected {
				t.Errorf("Expected %s, got %s", tt.expected, result)
			}
		})
	}
}
