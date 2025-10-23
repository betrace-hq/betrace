package rules

import (
	"testing"
)

// TestLexer_TraceQLCompatibility tests that FLUO accepts the same span names as TraceQL
func TestLexer_TraceQLCompatibility(t *testing.T) {
	tests := []struct {
		name           string
		input          string
		expectedTokens int
		wantIdentifier string
	}{
		// Hyphens (Kubernetes labels, DNS names)
		{
			name:           "Hyphen in identifier",
			input:          "trace.has(payment-service)",
			expectedTokens: 5,
			wantIdentifier: "payment-service",
		},
		{
			name:           "Multiple hyphens",
			input:          "trace.has(my-payment-service-v2)",
			expectedTokens: 5,
			wantIdentifier: "my-payment-service-v2",
		},

		// Slashes (URIs, paths)
		{
			name:           "Slash in identifier",
			input:          "trace.has(api/v1/users)",
			expectedTokens: 5,
			wantIdentifier: "api/v1/users",
		},
		{
			name:           "HTTP URL",
			input:          "trace.has(http://api.example.com/v1)",
			expectedTokens: 5,
			wantIdentifier: "http://api.example.com/v1",
		},

		// Colons (namespaces, URIs)
		{
			name:           "Colon in identifier",
			input:          "trace.has(db:postgres)",
			expectedTokens: 5,
			wantIdentifier: "db:postgres",
		},
		{
			name:           "Port in URL",
			input:          "trace.has(localhost:8080)",
			expectedTokens: 5,
			wantIdentifier: "localhost:8080",
		},

		// At signs (versions, emails)
		{
			name:           "At sign in version",
			input:          "trace.has(service@v1.2.3)",
			expectedTokens: 5,
			wantIdentifier: "service@v1.2.3",
		},
		{
			name:           "Email address",
			input:          "trace.has(user@example.com)",
			expectedTokens: 5,
			wantIdentifier: "user@example.com",
		},

		// Hash signs (build numbers, tags)
		{
			name:           "Hash in build number",
			input:          "trace.has(build#12345)",
			expectedTokens: 5,
			wantIdentifier: "build#12345",
		},
		{
			name:           "Git commit hash",
			input:          "trace.has(commit#abc123def)",
			expectedTokens: 5,
			wantIdentifier: "commit#abc123def",
		},

		// Dollar signs (variables)
		{
			name:           "Dollar in variable",
			input:          "trace.has($payment_total)",
			expectedTokens: 5,
			wantIdentifier: "$payment_total",
		},

		// Percent signs (URI encoding)
		{
			name:           "Percent encoding",
			input:          "trace.has(path%20with%20spaces)",
			expectedTokens: 5,
			wantIdentifier: "path%20with%20spaces",
		},

		// Asterisks (wildcards)
		{
			name:           "Asterisk in wildcard",
			input:          "trace.has(feature*enabled)",
			expectedTokens: 5,
			wantIdentifier: "feature*enabled",
		},

		// Complex real-world examples
		{
			name:           "Kubernetes pod name",
			input:          "trace.has(k8s.pod.name/app-v1@prod)",
			expectedTokens: 5,
			wantIdentifier: "k8s.pod.name/app-v1@prod",
		},
		{
			name:           "Full HTTP URL with query",
			input:          "trace.has(http://api.example.com:8080/v1/users?id=123)",
			expectedTokens: 5,
			wantIdentifier: "http://api.example.com:8080/v1/users?id=123",
		},
		{
			name:           "Docker image tag",
			input:          "trace.has(docker.io/myapp:v1.2.3@sha256:abc123)",
			expectedTokens: 5,
			wantIdentifier: "docker.io/myapp:v1.2.3@sha256:abc123",
		},

		// Mixed with emoji
		{
			name:           "Hyphen with emoji",
			input:          "trace.has(payment-service💰)",
			expectedTokens: 5,
			wantIdentifier: "payment-service💰",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			lexer := NewLexer(tt.input)
			tokens, err := lexer.Tokenize()

			if err != nil {
				t.Fatalf("Tokenize() error = %v", err)
			}

			if len(tokens) != tt.expectedTokens {
				t.Errorf("Expected %d tokens, got %d", tt.expectedTokens, len(tokens))
				for i, tok := range tokens {
					t.Logf("  Token %d: %s (%q)", i, tok.Type, tok.Lexeme)
				}
			}

			// Find the identifier token that should contain our special characters
			found := false
			for _, tok := range tokens {
				if tok.Type == TokenIdentifier && tok.Lexeme == tt.wantIdentifier {
					found = true
					t.Logf("✅ Identifier accepted: %q", tok.Lexeme)
					break
				}
			}

			if !found {
				t.Errorf("Expected to find identifier %q in tokens", tt.wantIdentifier)
			}
		})
	}
}

// TestLexer_OperatorsStillWork verifies that operators are still recognized correctly
func TestLexer_OperatorsStillWork(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		wantOp   TokenType
		wantText string
	}{
		// Comparison operators should NOT be part of identifiers
		{
			name:     "Equals operator",
			input:    "amount == 100",
			wantOp:   TokenEqual,
			wantText: "==",
		},
		{
			name:     "Not equals operator",
			input:    "status != failed",
			wantOp:   TokenNotEqual,
			wantText: "!=",
		},
		{
			name:     "Greater than operator",
			input:    "count > 5",
			wantOp:   TokenGreater,
			wantText: ">",
		},
		{
			name:     "Less than operator",
			input:    "price < 100",
			wantOp:   TokenLess,
			wantText: "<",
		},
		{
			name:     "Greater or equal operator",
			input:    "total >= 1000",
			wantOp:   TokenGreaterEqual,
			wantText: ">=",
		},
		{
			name:     "Less or equal operator",
			input:    "score <= 100",
			wantOp:   TokenLessEqual,
			wantText: "<=",
		},

		// Logical operators (keywords)
		{
			name:     "AND keyword",
			input:    "trace.has(x) and trace.has(y)",
			wantOp:   TokenAnd,
			wantText: "and",
		},
		{
			name:     "OR keyword",
			input:    "trace.has(x) or trace.has(y)",
			wantOp:   TokenOr,
			wantText: "or",
		},
		{
			name:     "NOT keyword",
			input:    "not trace.has(x)",
			wantOp:   TokenNot,
			wantText: "not",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			lexer := NewLexer(tt.input)
			tokens, err := lexer.Tokenize()

			if err != nil {
				t.Fatalf("Tokenize() error = %v", err)
			}

			// Find the operator token
			found := false
			for _, tok := range tokens {
				if tok.Type == tt.wantOp {
					found = true
					if tok.Lexeme != tt.wantText {
						t.Errorf("Expected operator text %q, got %q", tt.wantText, tok.Lexeme)
					}
					t.Logf("✅ Operator recognized: %s (%q)", tok.Type, tok.Lexeme)
					break
				}
			}

			if !found {
				t.Errorf("Expected to find operator %s in tokens", tt.wantOp)
				for i, tok := range tokens {
					t.Logf("  Token %d: %s (%q)", i, tok.Type, tok.Lexeme)
				}
			}
		})
	}
}

// TestLexer_TraceQLRealWorldExamples tests actual OpenTelemetry span names
func TestLexer_TraceQLRealWorldExamples(t *testing.T) {
	tests := []struct {
		name     string
		spanName string
		rule     string
	}{
		{
			name:     "AWS service span",
			spanName: "aws-sdk:dynamodb:query",
			rule:     "trace.has(aws-sdk:dynamodb:query)",
		},
		{
			name:     "Kubernetes pod",
			spanName: "k8s.pod.name/my-app-v1-abc123",
			rule:     "trace.has(k8s.pod.name/my-app-v1-abc123)",
		},
		{
			name:     "HTTP endpoint",
			spanName: "POST:/api/v1/users",
			rule:     "trace.has(POST:/api/v1/users)",
		},
		{
			name:     "Database connection",
			spanName: "postgresql://localhost:5432/mydb",
			rule:     "trace.has(postgresql://localhost:5432/mydb)",
		},
		{
			name:     "gRPC method",
			spanName: "grpc.method:/myservice.v1.MyService/GetUser",
			rule:     "trace.has(grpc.method:/myservice.v1.MyService/GetUser)",
		},
		{
			name:     "Message queue",
			spanName: "rabbitmq:queue#payments",
			rule:     "trace.has(rabbitmq:queue#payments)",
		},
		{
			name:     "Cache key",
			spanName: "redis:get:user:123@prod",
			rule:     "trace.has(redis:get:user:123@prod)",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			lexer := NewLexer(tt.rule)
			tokens, err := lexer.Tokenize()

			if err != nil {
				t.Fatalf("Failed to tokenize real-world span name %q: %v", tt.spanName, err)
			}

			// Verify the span name is captured as an identifier
			found := false
			for _, tok := range tokens {
				if tok.Type == TokenIdentifier && tok.Lexeme == tt.spanName {
					found = true
					t.Logf("✅ Real-world span name accepted: %q", tt.spanName)
					break
				}
			}

			if !found {
				t.Errorf("Expected to find span name %q in tokens", tt.spanName)
				for i, tok := range tokens {
					t.Logf("  Token %d: %s (%q)", i, tok.Type, tok.Lexeme)
				}
			}
		})
	}
}

// TestLexer_EdgeCases tests ambiguous cases to ensure correct tokenization
func TestLexer_EdgeCases(t *testing.T) {
	tests := []struct {
		name   string
		input  string
		expect []TokenType
	}{
		{
			name:  "Hyphen vs minus operator",
			input: "payment-service",
			expect: []TokenType{TokenIdentifier, TokenEOF}, // Single identifier, NOT subtraction
		},
		{
			name:  "Equals in identifier vs operator",
			input: "amount == 100",
			expect: []TokenType{TokenIdentifier, TokenEqual, TokenNumber, TokenEOF},
		},
		{
			name:  "Slash in identifier vs division",
			input: "api/v1/users",
			expect: []TokenType{TokenIdentifier, TokenEOF}, // Single identifier, NOT division
		},
		{
			name:  "Colon in identifier",
			input: "db:postgres",
			expect: []TokenType{TokenIdentifier, TokenEOF},
		},
		{
			name:  "Mixed special chars",
			input: "trace.has(http://api.example.com:8080/v1@prod#tag)",
			expect: []TokenType{
				TokenIdentifier, // trace.has
				TokenLParen,
				TokenIdentifier, // http://api.example.com:8080/v1@prod#tag
				TokenRParen,
				TokenEOF,
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			lexer := NewLexer(tt.input)
			tokens, err := lexer.Tokenize()

			if err != nil {
				t.Fatalf("Tokenize() error = %v", err)
			}

			if len(tokens) != len(tt.expect) {
				t.Errorf("Expected %d tokens, got %d", len(tt.expect), len(tokens))
				for i, tok := range tokens {
					t.Logf("  Token %d: %s (%q)", i, tok.Type, tok.Lexeme)
				}
				return
			}

			for i, tok := range tokens {
				if tok.Type != tt.expect[i] {
					t.Errorf("Token %d: expected %s, got %s (%q)", i, tt.expect[i], tok.Type, tok.Lexeme)
				}
			}
		})
	}
}
