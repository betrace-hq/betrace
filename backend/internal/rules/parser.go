package rules

import (
	"fmt"
	"strconv"
	"strings"
)

// Parser converts tokens into an Abstract Syntax Tree
type Parser struct {
	tokens  []Token
	current int
}

// NewParser creates a new parser for the given input
func NewParser(input string) *Parser {
	lexer := NewLexer(input)
	tokens, err := lexer.Tokenize()
	if err != nil {
		// Return parser with error token
		return &Parser{
			tokens: []Token{{Type: TokenEOF, Lexeme: err.Error()}},
		}
	}

	return &Parser{
		tokens:  tokens,
		current: 0,
	}
}

// Parse parses the tokens into an expression AST
func (p *Parser) Parse() (Expr, error) {
	// Check for lexer errors
	if len(p.tokens) > 0 && p.tokens[0].Type == TokenEOF && p.tokens[0].Lexeme != "" {
		return nil, fmt.Errorf("%s", p.tokens[0].Lexeme)
	}

	return p.parseExpression()
}

// parseExpression parses a full expression (handles OR with lowest precedence)
func (p *Parser) parseExpression() (Expr, error) {
	return p.parseOr()
}

// parseOr parses OR expressions (a or b or c)
func (p *Parser) parseOr() (Expr, error) {
	expr, err := p.parseAnd()
	if err != nil {
		return nil, err
	}

	for p.match(TokenOr) {
		op := p.previous()
		right, err := p.parseAnd()
		if err != nil {
			return nil, err
		}
		expr = &BinaryExpr{Left: expr, Op: op.Type, Right: right}
	}

	return expr, nil
}

// parseAnd parses AND expressions (a and b and c)
func (p *Parser) parseAnd() (Expr, error) {
	expr, err := p.parseEquality()
	if err != nil {
		return nil, err
	}

	for p.match(TokenAnd) {
		op := p.previous()
		right, err := p.parseEquality()
		if err != nil {
			return nil, err
		}
		expr = &BinaryExpr{Left: expr, Op: op.Type, Right: right}
	}

	return expr, nil
}

// parseEquality parses equality/inequality (==, !=)
func (p *Parser) parseEquality() (Expr, error) {
	expr, err := p.parseComparison()
	if err != nil {
		return nil, err
	}

	for p.match(TokenEqual, TokenNotEqual) {
		op := p.previous()
		right, err := p.parseComparison()
		if err != nil {
			return nil, err
		}
		expr = &BinaryExpr{Left: expr, Op: op.Type, Right: right}
	}

	return expr, nil
}

// parseComparison parses comparison operators (<, <=, >, >=)
func (p *Parser) parseComparison() (Expr, error) {
	expr, err := p.parseUnary()
	if err != nil {
		return nil, err
	}

	for p.match(TokenGreater, TokenGreaterEqual, TokenLess, TokenLessEqual, TokenIn, TokenMatches) {
		op := p.previous()
		right, err := p.parseUnary()
		if err != nil {
			return nil, err
		}
		expr = &BinaryExpr{Left: expr, Op: op.Type, Right: right}
	}

	return expr, nil
}

// parseUnary parses unary expressions (not, -)
func (p *Parser) parseUnary() (Expr, error) {
	if p.match(TokenNot) {
		op := p.previous()
		expr, err := p.parseUnary()
		if err != nil {
			return nil, err
		}
		return &UnaryExpr{Op: op.Type, Expr: expr}, nil
	}

	return p.parsePostfix()
}

// parsePostfix parses postfix expressions (field access, index access)
func (p *Parser) parsePostfix() (Expr, error) {
	expr, err := p.parsePrimary()
	if err != nil {
		return nil, err
	}

	for {
		if p.match(TokenDot) {
			// Field access: obj.field or obj.field.nested
			field := p.advance()
			if field.Type != TokenIdentifier {
				return nil, fmt.Errorf("expected identifier after '.', got %s at line %d", field.Type, field.Line)
			}

			// If expr is FieldAccess, append field
			if fa, ok := expr.(*FieldAccess); ok {
				fa.Fields = append(fa.Fields, field.Lexeme)
			} else {
				return nil, fmt.Errorf("cannot access field on non-identifier at line %d", field.Line)
			}

		} else if p.match(TokenLBracket) {
			// Index access: obj[index]
			index, err := p.parseExpression()
			if err != nil {
				return nil, err
			}

			if !p.match(TokenRBracket) {
				return nil, fmt.Errorf("expected ']' after index at line %d", p.peek().Line)
			}

			expr = &IndexAccess{Object: expr, Index: index}

		} else if p.match(TokenLParen) {
			// Function call: func(args)
			// Convert FieldAccess to function name
			var funcName string
			if fa, ok := expr.(*FieldAccess); ok {
				if len(fa.Fields) > 0 {
					funcName = fa.Object + "." + strings.Join(fa.Fields, ".")
				} else {
					funcName = fa.Object
				}
			} else {
				return nil, fmt.Errorf("cannot call non-identifier at line %d", p.previous().Line)
			}

			// Parse arguments
			args := []Expr{}
			if !p.check(TokenRParen) {
				for {
					arg, err := p.parseExpression()
					if err != nil {
						return nil, err
					}
					args = append(args, arg)

					if !p.match(TokenComma) {
						break
					}
				}
			}

			if !p.match(TokenRParen) {
				return nil, fmt.Errorf("expected ')' after function arguments at line %d", p.peek().Line)
			}

			expr = &CallExpr{Function: funcName, Args: args}

		} else {
			break
		}
	}

	return expr, nil
}

// parsePrimary parses primary expressions (literals, identifiers, grouped expressions)
func (p *Parser) parsePrimary() (Expr, error) {
	// Boolean literals
	if p.match(TokenTrue) {
		return &Literal{Type: TokenTrue, Value: true}, nil
	}
	if p.match(TokenFalse) {
		return &Literal{Type: TokenFalse, Value: false}, nil
	}

	// String literal
	if p.match(TokenString) {
		token := p.previous()
		return &Literal{Type: TokenString, Value: token.Lexeme}, nil
	}

	// Number literal
	if p.match(TokenNumber) {
		token := p.previous()
		num, err := strconv.ParseFloat(token.Lexeme, 64)
		if err != nil {
			return nil, fmt.Errorf("invalid number '%s' at line %d: %w", token.Lexeme, token.Line, err)
		}
		return &Literal{Type: TokenNumber, Value: num}, nil
	}

	// Identifier or field access
	if p.match(TokenIdentifier) {
		token := p.previous()
		// Split on dots since lexer includes dots in identifiers for operation names
		parts := splitOnDots(token.Lexeme)
		if len(parts) == 1 {
			return &FieldAccess{Object: parts[0], Fields: []string{}}, nil
		}
		return &FieldAccess{Object: parts[0], Fields: parts[1:]}, nil
	}

	// Grouped expression
	if p.match(TokenLParen) {
		expr, err := p.parseExpression()
		if err != nil {
			return nil, err
		}

		if !p.match(TokenRParen) {
			return nil, fmt.Errorf("expected ')' after expression at line %d", p.peek().Line)
		}

		return expr, nil
	}

	// Error: unexpected token
	if p.isAtEnd() {
		return nil, fmt.Errorf("unexpected EOF, expected expression")
	}

	token := p.peek()
	return nil, fmt.Errorf("unexpected token '%s' at line %d:%d", token.Lexeme, token.Line, token.Column)
}

// Helper methods

func (p *Parser) match(types ...TokenType) bool {
	for _, t := range types {
		if p.check(t) {
			p.advance()
			return true
		}
	}
	return false
}

func (p *Parser) check(t TokenType) bool {
	if p.isAtEnd() {
		return false
	}
	return p.peek().Type == t
}

func (p *Parser) advance() Token {
	if !p.isAtEnd() {
		p.current++
	}
	return p.previous()
}

func (p *Parser) isAtEnd() bool {
	return p.current >= len(p.tokens) || p.peek().Type == TokenEOF
}

func (p *Parser) peek() Token {
	if p.current >= len(p.tokens) {
		return Token{Type: TokenEOF, Lexeme: "", Line: 0, Column: 0}
	}
	return p.tokens[p.current]
}

func (p *Parser) previous() Token {
	if p.current == 0 {
		return Token{Type: TokenEOF, Lexeme: "", Line: 0, Column: 0}
	}
	return p.tokens[p.current-1]
}

// splitOnDots splits an identifier on dots, handling edge cases
func splitOnDots(s string) []string {
	if s == "" {
		return []string{}
	}
	return strings.Split(s, ".")
}
