package rules

import (
	"fmt"
	"strings"
	"unicode"
)

// TokenType represents the type of a lexical token
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
	TokenTrue
	TokenFalse
)

// Token represents a lexical token
type Token struct {
	Type   TokenType
	Lexeme string
	Line   int
	Column int
}

// Lexer tokenizes FLUO DSL input
type Lexer struct {
	input   string
	pos     int
	line    int
	column  int
	tokens  []Token
}

// Keywords maps keyword strings to token types
var keywords = map[string]TokenType{
	"and":     TokenAnd,
	"or":      TokenOr,
	"not":     TokenNot,
	"in":      TokenIn,
	"matches": TokenMatches,
	"true":    TokenTrue,
	"false":   TokenFalse,
}

// NewLexer creates a new lexer for the given input
func NewLexer(input string) *Lexer {
	return &Lexer{
		input:  input,
		pos:    0,
		line:   1,
		column: 1,
		tokens: make([]Token, 0),
	}
}

// isSafeIdentifierChar returns true for special characters that are safe in identifiers
// These are commonly used in OpenTelemetry span names but don't conflict with DSL syntax
func isSafeIdentifierChar(ch rune) bool {
	switch ch {
	case '-': // Hyphen: common in Kubernetes labels, DNS names (e.g., "payment-service")
		return true
	case '/': // Slash: common in URIs, paths (e.g., "api/v1/users")
		return true
	case ':': // Colon: common in URIs, namespaces (e.g., "db:postgres", "http://...")
		return true
	case '@': // At sign: common in versions, emails (e.g., "service@v1.2.3")
		return true
	case '#': // Hash: common in build numbers, tags (e.g., "build#12345")
		return true
	case '$': // Dollar: common in variable names (e.g., "$payment_total")
		return true
	case '%': // Percent: common in encoded URIs (e.g., "%20")
		return true
	case '*': // Asterisk: common in wildcards (e.g., "feature*enabled")
		return true
	case '?': // Question mark: common in query strings (e.g., "/api/users?id=123")
		return true
	case '&': // Ampersand: common in query strings (e.g., "?foo=1&bar=2") - safe because not followed by another &
		return true
	case '=': // Equals: common in query strings (e.g., "?id=123") - safe because operator check happens first (==)
		return true
	default:
		return false
	}
}

// Tokenize converts the input string into tokens
func (l *Lexer) Tokenize() ([]Token, error) {
	for l.pos < len(l.input) {
		ch := l.current()

		// Skip whitespace
		if unicode.IsSpace(ch) {
			if ch == '\n' {
				l.line++
				l.column = 1
			} else {
				l.column++
			}
			l.pos++
			continue
		}

		// Single-character tokens
		switch ch {
		case '.':
			l.addToken(TokenDot, ".")
			l.advance()
			continue
		case ',':
			l.addToken(TokenComma, ",")
			l.advance()
			continue
		case '(':
			l.addToken(TokenLParen, "(")
			l.advance()
			continue
		case ')':
			l.addToken(TokenRParen, ")")
			l.advance()
			continue
		case '[':
			l.addToken(TokenLBracket, "[")
			l.advance()
			continue
		case ']':
			l.addToken(TokenRBracket, "]")
			l.advance()
			continue
		}

		// Two-character tokens (comparison operators)
		if l.pos+1 < len(l.input) {
			twoChar := string([]rune{ch, rune(l.input[l.pos+1])})
			switch twoChar {
			case "==":
				l.addToken(TokenEqual, "==")
				l.advance()
				l.advance()
				continue
			case "!=":
				l.addToken(TokenNotEqual, "!=")
				l.advance()
				l.advance()
				continue
			case ">=":
				l.addToken(TokenGreaterEqual, ">=")
				l.advance()
				l.advance()
				continue
			case "<=":
				l.addToken(TokenLessEqual, "<=")
				l.advance()
				l.advance()
				continue
			}
		}

		// Single-character comparison operators
		switch ch {
		case '>':
			l.addToken(TokenGreater, ">")
			l.advance()
			continue
		case '<':
			l.addToken(TokenLess, "<")
			l.advance()
			continue
		}

		// Quoted strings (for regex patterns)
		if ch == '"' {
			if err := l.scanString(); err != nil {
				return nil, err
			}
			continue
		}

		// Numbers
		if unicode.IsDigit(ch) {
			if err := l.scanNumber(); err != nil {
				return nil, err
			}
			continue
		}

		// Identifiers and keywords
		// Accept letters, underscore, non-ASCII characters (emoji, unicode), AND
		// special characters commonly used in span names: -, /, :, @, #, *, $, %
		// This allows matching on real-world OpenTelemetry span names like:
		// - "payment-service" (Kubernetes labels)
		// - "api/v1/users" (URIs)
		// - "db:postgres" (namespaces)
		// - "version@1.2.3" (version tags)
		// - "build#12345" (build numbers)
		if unicode.IsLetter(ch) || ch == '_' || ch > 127 || isSafeIdentifierChar(ch) {
			if err := l.scanIdentifier(); err != nil {
				return nil, err
			}
			continue
		}

		// Unknown character (reserved operators or unsupported chars)
		return nil, fmt.Errorf("unexpected character '%c' at line %d, column %d", ch, l.line, l.column)
	}

	// Add EOF token
	l.addToken(TokenEOF, "")
	return l.tokens, nil
}

// current returns the current character without advancing
func (l *Lexer) current() rune {
	if l.pos >= len(l.input) {
		return 0
	}
	return rune(l.input[l.pos])
}

// peek returns the next character without advancing
func (l *Lexer) peek() rune {
	if l.pos+1 >= len(l.input) {
		return 0
	}
	return rune(l.input[l.pos+1])
}

// advance moves to the next character
func (l *Lexer) advance() {
	if l.pos < len(l.input) {
		l.pos++
		l.column++
	}
}

// addToken adds a token to the token list
func (l *Lexer) addToken(tokenType TokenType, lexeme string) {
	l.tokens = append(l.tokens, Token{
		Type:   tokenType,
		Lexeme: lexeme,
		Line:   l.line,
		Column: l.column,
	})
}

// scanString scans a quoted string literal
func (l *Lexer) scanString() error {
	startCol := l.column

	// Skip opening quote
	l.advance()

	var sb strings.Builder
	for l.pos < len(l.input) {
		ch := l.current()

		if ch == '"' {
			// Found closing quote
			l.advance()
			l.addToken(TokenString, sb.String())
			return nil
		}

		if ch == '\\' && l.peek() == '"' {
			// Escaped quote
			l.advance()
			sb.WriteRune('"')
			l.advance()
			continue
		}

		if ch == '\n' {
			return fmt.Errorf("unterminated string at line %d, column %d", l.line, startCol)
		}

		sb.WriteRune(ch)
		l.advance()
	}

	return fmt.Errorf("unterminated string starting at line %d, column %d (reached EOF)", l.line, startCol)
}

// scanNumber scans a numeric literal (integer or float)
func (l *Lexer) scanNumber() error {
	start := l.pos
	startCol := l.column

	// Scan integer part
	for unicode.IsDigit(l.current()) {
		l.advance()
	}

	// Check for decimal point
	if l.current() == '.' && unicode.IsDigit(l.peek()) {
		// Scan decimal part
		l.advance() // skip '.'
		for unicode.IsDigit(l.current()) {
			l.advance()
		}
	}

	lexeme := l.input[start:l.pos]
	l.tokens = append(l.tokens, Token{
		Type:   TokenNumber,
		Lexeme: lexeme,
		Line:   l.line,
		Column: startCol,
	})

	return nil
}

// scanIdentifier scans an identifier or keyword
func (l *Lexer) scanIdentifier() error {
	start := l.pos
	startCol := l.column

	// First character: letter or underscore
	l.advance()

	// Subsequent characters: letter, digit, underscore, non-ASCII, or safe special chars
	// IMPORTANT: Do NOT include '.' here - it's a separate token for method calls
	// Dots within span names like "payment.charge_card" are part of the identifier only
	// when the identifier appears after has() or count() - handled in parser
	for l.pos < len(l.input) {
		ch := l.current()
		if unicode.IsLetter(ch) || unicode.IsDigit(ch) || ch == '_' || ch > 127 || isSafeIdentifierChar(ch) {
			l.advance()
		} else if ch == '.' {
			// Lookahead: if next char is identifier-valid, include the dot (operation name)
			// Otherwise, stop (it's a method call dot)
			next := l.peek()
			if next != 0 && (unicode.IsLetter(next) || unicode.IsDigit(next) || next == '_' || next > 127 || isSafeIdentifierChar(next)) {
				l.advance() // include '.'
			} else {
				break // stop, '.' is next token
			}
		} else {
			break
		}
	}

	lexeme := l.input[start:l.pos]

	// Check if it's a keyword
	if tokenType, isKeyword := keywords[lexeme]; isKeyword {
		l.tokens = append(l.tokens, Token{
			Type:   tokenType,
			Lexeme: lexeme,
			Line:   l.line,
			Column: startCol,
		})
	} else {
		l.tokens = append(l.tokens, Token{
			Type:   TokenIdentifier,
			Lexeme: lexeme,
			Line:   l.line,
			Column: startCol,
		})
	}

	return nil
}

// TokenTypeString returns a human-readable string for a token type
func (t TokenType) String() string {
	switch t {
	case TokenEOF:
		return "EOF"
	case TokenIdentifier:
		return "IDENTIFIER"
	case TokenNumber:
		return "NUMBER"
	case TokenString:
		return "STRING"
	case TokenDot:
		return "DOT"
	case TokenComma:
		return "COMMA"
	case TokenLParen:
		return "LPAREN"
	case TokenRParen:
		return "RPAREN"
	case TokenLBracket:
		return "LBRACKET"
	case TokenRBracket:
		return "RBRACKET"
	case TokenAnd:
		return "AND"
	case TokenOr:
		return "OR"
	case TokenNot:
		return "NOT"
	case TokenEqual:
		return "EQUAL"
	case TokenNotEqual:
		return "NOT_EQUAL"
	case TokenGreater:
		return "GREATER"
	case TokenGreaterEqual:
		return "GREATER_EQUAL"
	case TokenLess:
		return "LESS"
	case TokenLessEqual:
		return "LESS_EQUAL"
	case TokenIn:
		return "IN"
	case TokenMatches:
		return "MATCHES"
	case TokenTrue:
		return "TRUE"
	case TokenFalse:
		return "FALSE"
	default:
		return "UNKNOWN"
	}
}
