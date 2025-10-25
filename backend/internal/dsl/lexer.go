package dsl

import (
	"unicode"
	"unicode/utf8"
)

// Lexer performs lexical analysis on DSL input
type Lexer struct {
	input        string
	position     int  // current position in input (points to current char)
	readPosition int  // current reading position in input (after current char)
	ch           rune // current char under examination
	line         int
	column       int
}

// NewLexer creates a new Lexer instance
func NewLexer(input string) *Lexer {
	l := &Lexer{input: input, line: 1, column: 0}
	l.readChar()
	return l
}

// readChar reads the next character and advances position
func (l *Lexer) readChar() {
	if l.readPosition >= len(l.input) {
		l.ch = 0 // ASCII NUL = end of input
	} else {
		r, size := utf8.DecodeRuneInString(l.input[l.readPosition:])
		l.ch = r
		l.position = l.readPosition
		l.readPosition += size
	}

	l.column++
	if l.ch == '\n' {
		l.line++
		l.column = 0
	}
}

// peekChar looks at the next character without advancing
func (l *Lexer) peekChar() rune {
	if l.readPosition >= len(l.input) {
		return 0
	}
	r, _ := utf8.DecodeRuneInString(l.input[l.readPosition:])
	return r
}

// NextToken returns the next token from the input
func (l *Lexer) NextToken() Token {
	var tok Token

	l.skipWhitespace()

	tok.Line = l.line
	tok.Column = l.column

	switch l.ch {
	case '=':
		if l.peekChar() == '=' {
			ch := l.ch
			l.readChar()
			tok = Token{Type: EQ, Literal: string(ch) + string(l.ch), Line: tok.Line, Column: tok.Column}
		} else {
			tok = newToken(ILLEGAL, l.ch, tok.Line, tok.Column)
		}
	case '!':
		if l.peekChar() == '=' {
			ch := l.ch
			l.readChar()
			tok = Token{Type: NEQ, Literal: string(ch) + string(l.ch), Line: tok.Line, Column: tok.Column}
		} else {
			tok = newToken(ILLEGAL, l.ch, tok.Line, tok.Column)
		}
	case '<':
		if l.peekChar() == '=' {
			ch := l.ch
			l.readChar()
			tok = Token{Type: LTE, Literal: string(ch) + string(l.ch), Line: tok.Line, Column: tok.Column}
		} else {
			tok = newToken(LT, l.ch, tok.Line, tok.Column)
		}
	case '>':
		if l.peekChar() == '=' {
			ch := l.ch
			l.readChar()
			tok = Token{Type: GTE, Literal: string(ch) + string(l.ch), Line: tok.Line, Column: tok.Column}
		} else {
			tok = newToken(GT, l.ch, tok.Line, tok.Column)
		}
	case '(':
		tok = newToken(LPAREN, l.ch, tok.Line, tok.Column)
	case ')':
		tok = newToken(RPAREN, l.ch, tok.Line, tok.Column)
	case '[':
		tok = newToken(LBRACKET, l.ch, tok.Line, tok.Column)
	case ']':
		tok = newToken(RBRACKET, l.ch, tok.Line, tok.Column)
	case '{':
		tok = newToken(LBRACE, l.ch, tok.Line, tok.Column)
	case '}':
		tok = newToken(RBRACE, l.ch, tok.Line, tok.Column)
	case ',':
		tok = newToken(COMMA, l.ch, tok.Line, tok.Column)
	case '.':
		tok = newToken(DOT, l.ch, tok.Line, tok.Column)
	case '"':
		tok.Type = STRING
		tok.Literal = l.readString()
		tok.Line = tok.Line
		tok.Column = tok.Column
	case '/':
		if l.peekChar() == '/' {
			l.skipComment()
			return l.NextToken() // Recursively get next non-comment token
		} else {
			tok = newToken(ILLEGAL, l.ch, tok.Line, tok.Column)
		}
	case 0:
		tok.Literal = ""
		tok.Type = EOF
		tok.Line = tok.Line
		tok.Column = tok.Column
	default:
		if isLetter(l.ch) {
			tok.Literal = l.readIdentifier()
			tok.Type = LookupIdent(tok.Literal)
			tok.Line = tok.Line
			tok.Column = tok.Column
			return tok
		} else if isDigit(l.ch) {
			tok.Type = NUMBER
			tok.Literal = l.readNumber()
			tok.Line = tok.Line
			tok.Column = tok.Column
			return tok
		} else {
			tok = newToken(ILLEGAL, l.ch, tok.Line, tok.Column)
		}
	}

	l.readChar()
	return tok
}

// newToken creates a new token from a single character
func newToken(tokenType TokenType, ch rune, line, column int) Token {
	return Token{Type: tokenType, Literal: string(ch), Line: line, Column: column}
}

// readIdentifier reads an identifier (operation names, attribute names)
// Allows dots only within identifiers (e.g., payment.charge_card)
// but stops at dots followed by keywords (e.g., trace.has -> "trace", not "trace.has")
func (l *Lexer) readIdentifier() string {
	position := l.position
	for isLetter(l.ch) || isDigit(l.ch) || l.ch == '_' {
		l.readChar()
		// Allow dots within identifiers, but peek ahead to check if next part is a keyword
		if l.ch == '.' {
			// Peek ahead to see what comes after the dot
			nextPos := l.readPosition
			if nextPos < len(l.input) {
				// Read the next identifier after the dot
				tempPos := nextPos
				for tempPos < len(l.input) {
					r, size := utf8.DecodeRuneInString(l.input[tempPos:])
					if !isLetter(r) && !isDigit(r) && r != '_' {
						break
					}
					tempPos += size
				}
				nextIdent := l.input[nextPos:tempPos]
				// If next identifier is a keyword, stop here (don't include the dot)
				if _, isKeyword := keywords[nextIdent]; isKeyword {
					break
				}
			}
			// Include the dot in the identifier
			l.readChar()
		}
	}
	return l.input[position:l.position]
}

// readNumber reads a number (integer or float)
func (l *Lexer) readNumber() string {
	position := l.position
	for isDigit(l.ch) {
		l.readChar()
	}

	// Check for decimal point
	if l.ch == '.' && isDigit(l.peekChar()) {
		l.readChar() // consume '.'
		for isDigit(l.ch) {
			l.readChar()
		}
	}

	return l.input[position:l.position]
}

// readString reads a string literal (between double quotes)
func (l *Lexer) readString() string {
	position := l.position + 1 // skip opening "
	for {
		l.readChar()
		if l.ch == '"' || l.ch == 0 {
			break
		}
	}
	return l.input[position:l.position]
}

// skipWhitespace skips whitespace characters
func (l *Lexer) skipWhitespace() {
	for l.ch == ' ' || l.ch == '\t' || l.ch == '\n' || l.ch == '\r' {
		l.readChar()
	}
}

// skipComment skips single-line comments
func (l *Lexer) skipComment() {
	for l.ch != '\n' && l.ch != 0 {
		l.readChar()
	}
	l.skipWhitespace()
}

// isLetter checks if a character is a letter
func isLetter(ch rune) bool {
	return unicode.IsLetter(ch) || ch == '_'
}

// isDigit checks if a character is a digit
func isDigit(ch rune) bool {
	return unicode.IsDigit(ch)
}
