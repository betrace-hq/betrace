/**
 * FLUO DSL Parser
 *
 * Implements a lexer and parser for FLUO Domain-Specific Language.
 * Provides real-time syntax validation with detailed error messages.
 *
 * Grammar:
 * expression := term (("and" | "or") term)*
 * term := "not"? span_check
 * span_check := "trace.has(" identifier ")" where_clause*
 *             | "trace.count(" identifier ")" comparison value
 * where_clause := ".where(" condition ")"
 * condition := identifier comparison value
 * comparison := "==" | "!=" | ">" | ">=" | "<" | "<=" | "in" | "matches"
 * value := string | number | boolean
 */

import { sanitizeErrorMessage, sanitizeTokenValue, OutputContext } from './sanitize';
import { redactSensitiveData } from './sensitive-data-redaction';

// ============================================================================
// Token Types
// ============================================================================

export type TokenType =
  | 'TRACE' | 'HAS' | 'WHERE' | 'COUNT' | 'AND' | 'OR' | 'NOT'
  | 'TRUE' | 'FALSE'
  | 'EQ' | 'NEQ' | 'GT' | 'GTE' | 'LT' | 'LTE' | 'IN' | 'MATCHES'
  | 'LPAREN' | 'RPAREN' | 'LBRACKET' | 'RBRACKET' | 'DOT' | 'COMMA'
  | 'STRING' | 'NUMBER' | 'IDENTIFIER'
  | 'EOF';

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
}

// ============================================================================
// AST Node Types
// ============================================================================

export type RuleExpression =
  | BinaryExpression
  | NotExpression
  | HasExpression
  | CountExpression;

export interface BinaryExpression {
  type: 'binary';
  operator: 'and' | 'or';
  left: RuleExpression;
  right: RuleExpression;
}

export interface NotExpression {
  type: 'not';
  expression: RuleExpression;
}

export interface HasExpression {
  type: 'has';
  spanName: string;
  whereClauses: WhereClause[];
}

export interface CountExpression {
  type: 'count';
  spanName: string;
  operator: string;
  value: number;
}

export interface WhereClause {
  attribute: string;
  operator: string;
  value: string | number | boolean;
}

// ============================================================================
// Validation Types
// ============================================================================

export interface ValidationError {
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
  suggestion?: string;
}

export interface ParseResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  ast?: RuleExpression;
}

// ============================================================================
// Security Constants (PRD-010c)
// ============================================================================

const MAX_TOTAL_DSL_LENGTH = 65536; // 64KB total DSL
const MAX_STRING_LENGTH = 10000; // 10KB strings
const MAX_IDENTIFIER_LENGTH = 100; // Reasonable identifier limit
const MAX_RECURSION_DEPTH = 100; // Prevent stack overflow from deeply nested expressions
const MAX_PARSE_TIME_MS = 100; // P0-1: ReDoS prevention - max parsing time

// ============================================================================
// Security Helper Functions (PRD-010d)
// ============================================================================

/**
 * Creates a safe error message by sanitizing and redacting sensitive data.
 *
 * Used for all error messages displayed to users or announced by screen readers.
 *
 * @param message - Raw error message
 * @param context - Output context (HTML for ARIA, Markdown for Monaco hover)
 * @returns Sanitized and redacted message safe for display
 */
export function createSafeErrorMessage(message: string, context: OutputContext = OutputContext.HTML): string {
  // Step 1: Sanitize for output context (XSS prevention)
  const sanitized = sanitizeErrorMessage(message, context);

  // Step 2: Redact sensitive data (information disclosure prevention)
  const redacted = redactSensitiveData(sanitized);

  return redacted;
}

// ============================================================================
// Lexer (Tokenizer)
// ============================================================================

class Lexer {
  private input: string;
  private position = 0;
  private line = 1;
  private column = 1;
  public errors: ValidationError[] = [];
  private startTime: number; // P0-1: Track parse start time

  constructor(input: string, startTime: number) {
    this.input = input;
    this.startTime = startTime;
  }

  // P0-1: Check if parsing has exceeded timeout
  private checkTimeout(): void {
    if (performance.now() - this.startTime > MAX_PARSE_TIME_MS) {
      throw new Error(
        `DSL parsing timeout exceeded (>${MAX_PARSE_TIME_MS}ms). ` +
        `Expression may contain ReDoS patterns.`
      );
    }
  }

  tokenize(): Token[] {
    const tokens: Token[] = [];

    while (!this.isAtEnd()) {
      // P0-1: Check timeout on each iteration
      this.checkTimeout();

      this.skipWhitespace();
      if (this.isAtEnd()) break;

      try {
        const token = this.nextToken();
        if (token) tokens.push(token);
      } catch (error: any) {
        // Collect lexer errors
        this.errors.push({
          line: this.line,
          column: this.column,
          endLine: this.line,
          endColumn: this.column + 1,
          message: error.message || 'Lexer error',
          severity: 'error',
        });
        // Continue tokenizing to find more errors
        this.advance();
      }
    }

    tokens.push({
      type: 'EOF',
      value: '',
      line: this.line,
      column: this.column,
    });

    return tokens;
  }

  private nextToken(): Token | null {
    const start = { line: this.line, column: this.column };
    const char = this.peek();

    // Skip comments
    if (char === '/' && this.peekNext() === '/') {
      this.skipLineComment();
      return null;
    }

    // Keywords (check before identifiers)
    if (this.isAlpha(char)) {
      return this.readKeywordOrIdentifier(start);
    }

    // Two-character operators
    if (char === '=' && this.peekNext() === '=') {
      this.advance();
      this.advance();
      return { type: 'EQ', value: '==', ...start };
    }
    if (char === '!' && this.peekNext() === '=') {
      this.advance();
      this.advance();
      return { type: 'NEQ', value: '!=', ...start };
    }
    if (char === '>' && this.peekNext() === '=') {
      this.advance();
      this.advance();
      return { type: 'GTE', value: '>=', ...start };
    }
    if (char === '<' && this.peekNext() === '=') {
      this.advance();
      this.advance();
      return { type: 'LTE', value: '<=', ...start };
    }

    // Single-character operators
    if (char === '>') {
      this.advance();
      return { type: 'GT', value: '>', ...start };
    }
    if (char === '<') {
      this.advance();
      return { type: 'LT', value: '<', ...start };
    }

    // Delimiters
    if (char === '(') {
      this.advance();
      return { type: 'LPAREN', value: '(', ...start };
    }
    if (char === ')') {
      this.advance();
      return { type: 'RPAREN', value: ')', ...start };
    }
    if (char === '[') {
      this.advance();
      return { type: 'LBRACKET', value: '[', ...start };
    }
    if (char === ']') {
      this.advance();
      return { type: 'RBRACKET', value: ']', ...start };
    }
    if (char === '.') {
      this.advance();
      return { type: 'DOT', value: '.', ...start };
    }
    if (char === ',') {
      this.advance();
      return { type: 'COMMA', value: ',', ...start };
    }

    // Strings
    if (char === '"') {
      return this.readString(start);
    }

    // Numbers
    if (this.isDigit(char)) {
      return this.readNumber(start);
    }

    // PRD-010c: Sanitize user input in error messages
    const sanitizedChar = sanitizeTokenValue(char, OutputContext.HTML);
    throw new Error(`Unexpected character '${sanitizedChar}' at ${this.line}:${this.column}`);
  }

  private readKeywordOrIdentifier(start: { line: number; column: number }): Token {
    const startPos = this.position;

    while (!this.isAtEnd() && (this.isAlphaNumeric(this.peek()) || this.peek() === '_')) {
      // PRD-010c: Check identifier length limit BEFORE advancing
      if (this.position - startPos >= MAX_IDENTIFIER_LENGTH) {
        throw new Error(
          `Identifier exceeds maximum length of ${MAX_IDENTIFIER_LENGTH} characters at ${start.line}:${start.column}`
        );
      }
      this.advance();
    }

    const value = this.input.substring(startPos, this.position);

    // Check for keywords
    const keywords: Record<string, TokenType> = {
      'trace': 'TRACE',
      'has': 'HAS',
      'where': 'WHERE',
      'count': 'COUNT',
      'and': 'AND',
      'or': 'OR',
      'not': 'NOT',
      'true': 'TRUE',
      'false': 'FALSE',
      'in': 'IN',
      'matches': 'MATCHES',
    };

    const type = keywords[value] || 'IDENTIFIER';
    return { type, value, ...start };
  }

  private readString(start: { line: number; column: number }): Token {
    this.advance(); // Skip opening quote
    const startPos = this.position;
    let charCount = 0;

    while (!this.isAtEnd() && this.peek() !== '"') {
      // PRD-010c: Check string length limit BEFORE incrementing
      if (charCount > MAX_STRING_LENGTH) {
        throw new Error(
          `String literal exceeds maximum length of ${MAX_STRING_LENGTH} characters at ${start.line}:${start.column}`
        );
      }
      charCount++;

      if (this.peek() === '\\' && this.peekNext() === '"') {
        this.advance(); // Skip escape
        this.advance(); // Skip quote
      } else {
        this.advance();
      }
    }

    if (this.isAtEnd()) {
      throw new Error(`Unterminated string at ${start.line}:${start.column}`);
    }

    const value = this.input.substring(startPos, this.position);
    this.advance(); // Skip closing quote

    return { type: 'STRING', value, ...start };
  }

  private readNumber(start: { line: number; column: number }): Token {
    const startPos = this.position;

    while (!this.isAtEnd() && this.isDigit(this.peek())) {
      this.advance();
    }

    // Check for decimal
    if (this.peek() === '.' && this.isDigit(this.peekNext())) {
      this.advance(); // Skip dot
      while (!this.isAtEnd() && this.isDigit(this.peek())) {
        this.advance();
      }
    }

    const value = this.input.substring(startPos, this.position);
    return { type: 'NUMBER', value, ...start };
  }

  private skipWhitespace(): void {
    while (!this.isAtEnd()) {
      const char = this.peek();
      if (char === ' ' || char === '\t' || char === '\r') {
        this.advance();
      } else if (char === '\n') {
        this.line++;
        this.column = 1;
        this.position++;
      } else {
        break;
      }
    }
  }

  private skipLineComment(): void {
    while (!this.isAtEnd() && this.peek() !== '\n') {
      this.advance();
    }
  }

  private peek(): string {
    return this.input.charAt(this.position);
  }

  private peekNext(): string {
    return this.input.charAt(this.position + 1);
  }

  private advance(): string {
    const char = this.input.charAt(this.position);
    this.position++;
    this.column++;
    return char;
  }

  private isAtEnd(): boolean {
    return this.position >= this.input.length;
  }

  private isDigit(char: string): boolean {
    return char >= '0' && char <= '9';
  }

  private isAlpha(char: string): boolean {
    return (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z') || char === '_';
  }

  private isAlphaNumeric(char: string): boolean {
    return this.isAlpha(char) || this.isDigit(char);
  }
}

// ============================================================================
// Parser
// ============================================================================

class Parser {
  private tokens: Token[];
  private current = 0;
  private errors: ValidationError[] = [];
  private warnings: ValidationError[] = [];
  private recursionDepth = 0; // PRD-010c: Global recursion tracking
  private startTime: number; // P0-1: Track parse start time

  constructor(tokens: Token[], startTime: number) {
    this.tokens = tokens;
    this.startTime = startTime;
  }

  // P0-1: Check if parsing has exceeded timeout
  private checkTimeout(): void {
    if (performance.now() - this.startTime > MAX_PARSE_TIME_MS) {
      throw new Error(
        `DSL parsing timeout exceeded (>${MAX_PARSE_TIME_MS}ms). ` +
        `Expression may contain ReDoS patterns.`
      );
    }
  }

  parse(): ParseResult {
    try {
      const ast = this.parseExpression();

      // Check for trailing tokens
      if (!this.isAtEnd()) {
        const token = this.peek();
        // PRD-010c: Sanitize token value in error message
        const sanitizedValue = sanitizeTokenValue(token.value, OutputContext.HTML);
        this.addError(
          `Unexpected token '${sanitizedValue}' after expression`,
          token,
          'Remove extra tokens after the expression'
        );
      }

      return {
        valid: this.errors.length === 0,
        errors: this.errors,
        warnings: this.warnings,
        ast,  // Return AST even if there are validation errors
      };
    } catch (error: any) {
      return {
        valid: false,
        errors: this.errors,
        warnings: this.warnings,
      };
    }
  }

  private parseExpression(): RuleExpression {
    // P0-1: Check timeout
    this.checkTimeout();
    // PRD-010c: Check recursion depth
    this.enterRecursion('parseExpression');
    try {
      let left = this.parseTerm();

      while (this.match('AND', 'OR')) {
        const operator = this.previous();
        const right = this.parseTerm();
        left = {
          type: 'binary',
          operator: operator.type === 'AND' ? 'and' : 'or',
          left,
          right,
        };
      }

      return left;
    } finally {
      this.exitRecursion();
    }
  }

  private parseTerm(): RuleExpression {
    // P0-1: Check timeout
    this.checkTimeout();
    // PRD-010c: Check recursion depth
    this.enterRecursion('parseTerm');
    try {
      if (this.match('NOT')) {
        const expression = this.parseSpanCheck();
        return {
          type: 'not',
          expression,
        };
      }
      return this.parseSpanCheck();
    } finally {
      this.exitRecursion();
    }
  }

  private parseSpanCheck(): RuleExpression {
    // P0-1: Check timeout
    this.checkTimeout();
    // PRD-010c: Check recursion depth
    this.enterRecursion('parseSpanCheck');
    try {
      this.consume('TRACE', 'Expected "trace" at start of span check');
      this.consume('DOT', 'Expected "." after "trace"');

      if (this.match('HAS')) {
        return this.parseHasExpression();
      } else if (this.match('COUNT')) {
        return this.parseCountExpression();
      } else {
        const token = this.peek();
        throw this.error(
          `Expected "has" or "count" after "trace."`,
          token,
          'Use either trace.has() or trace.count()'
        );
      }
    } finally {
      this.exitRecursion();
    }
  }

  private parseHasExpression(): HasExpression {
    this.consume('LPAREN', 'Expected "(" after "has"');

    // Read dotted identifier (e.g., payment.charge.card)
    const spanName = this.readSpanName();

    this.consume('RPAREN', 'Expected ")" after span name');

    const whereClauses: WhereClause[] = [];

    while (this.check('DOT') && this.tokens[this.current + 1]?.type === 'WHERE') {
      this.advance(); // Skip DOT
      this.advance(); // Skip WHERE
      whereClauses.push(this.parseWhereClause());
    }

    return {
      type: 'has',
      spanName,
      whereClauses,
    };
  }

  private parseCountExpression(): CountExpression {
    this.consume('LPAREN', 'Expected "(" after "count"');

    // Read dotted identifier (e.g., payment.charge.card)
    const spanName = this.readSpanName();

    this.consume('RPAREN', 'Expected ")" after span name');

    const operatorToken = this.consumeAny(
      ['GT', 'GTE', 'LT', 'LTE', 'EQ', 'NEQ'],
      'Expected comparison operator (>, >=, <, <=, ==, !=)'
    );
    const operator = operatorToken.value;

    const valueToken = this.consume('NUMBER', 'Expected numeric value after comparison operator');
    const value = parseFloat(valueToken.value);

    return {
      type: 'count',
      spanName,
      operator,
      value,
    };
  }

  private parseWhereClause(): WhereClause {
    this.consume('LPAREN', 'Expected "(" after "where"');

    // Read dotted attribute name (e.g., user.email)
    const attribute = this.readSpanName();

    const operatorToken = this.consumeAny(
      ['EQ', 'NEQ', 'GT', 'GTE', 'LT', 'LTE', 'IN', 'MATCHES'],
      'Expected comparison operator'
    );
    const operator = operatorToken.value;

    let value: string | number | boolean;
    if (this.check('STRING')) {
      value = this.advance().value;
    } else if (this.check('NUMBER')) {
      value = parseFloat(this.advance().value);
    } else if (this.match('TRUE', 'FALSE')) {
      value = this.previous().value === 'true';
    } else {
      throw this.error(
        'Expected value (string, number, or boolean)',
        this.peek(),
        'Provide a value to compare against'
      );
    }

    this.consume('RPAREN', 'Expected ")" after where clause');

    return { attribute, operator, value };
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private readSpanName(): string {
    // Read dotted identifier (e.g., payment.charge.card)
    const parts: string[] = [];

    const firstToken = this.consume('IDENTIFIER', 'Expected span operation name');
    parts.push(firstToken.value);

    // Continue reading .identifier patterns
    while (this.check('DOT') && this.tokens[this.current + 1]?.type === 'IDENTIFIER') {
      this.advance(); // consume DOT
      const token = this.advance(); // consume IDENTIFIER
      parts.push(token.value);
    }

    return parts.join('.');
  }

  private match(...types: TokenType[]): boolean {
    for (const type of types) {
      if (this.check(type)) {
        this.advance();
        return true;
      }
    }
    return false;
  }

  private check(type: TokenType): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }

  private isAtEnd(): boolean {
    return this.peek().type === 'EOF';
  }

  private peek(): Token {
    return this.tokens[this.current];
  }

  private previous(): Token {
    return this.tokens[this.current - 1];
  }

  private consume(type: TokenType, message: string): Token {
    if (this.check(type)) return this.advance();

    const token = this.peek();
    throw this.error(message, token);
  }

  private consumeAny(types: TokenType[], message: string): Token {
    for (const type of types) {
      if (this.check(type)) return this.advance();
    }

    const token = this.peek();
    throw this.error(message, token);
  }

  private error(message: string, token: Token, suggestion?: string): Error {
    this.addError(message, token, suggestion);
    return new Error(message);
  }

  private addError(message: string, token: Token, suggestion?: string): void {
    this.errors.push({
      line: token.line,
      column: token.column,
      endLine: token.line,
      endColumn: token.column + token.value.length,
      message,
      severity: 'error',
      suggestion,
    });
  }

  // PRD-010c: Global recursion depth tracking
  private enterRecursion(methodName: string): void {
    this.recursionDepth++;
    if (this.recursionDepth > MAX_RECURSION_DEPTH) {
      throw new Error(
        `Maximum recursion depth of ${MAX_RECURSION_DEPTH} exceeded in ${methodName}. ` +
        `Expression is too deeply nested.`
      );
    }
  }

  private exitRecursion(): void {
    this.recursionDepth--;
  }
}

// ============================================================================
// Public API
// ============================================================================

export function validateDslExpression(expression: string): ParseResult {
  if (!expression || !expression.trim()) {
    return {
      valid: false,
      errors: [{
        line: 1,
        column: 1,
        endLine: 1,
        endColumn: 1,
        message: 'Expression cannot be empty',
        severity: 'error',
        suggestion: 'Start with "trace.has()" or "trace.count()"',
      }],
      warnings: [],
    };
  }

  // PRD-010c: Check total DSL size before parsing
  if (expression.length > MAX_TOTAL_DSL_LENGTH) {
    // PRD-010c: Sanitize numeric values in error message (defense in depth)
    const sanitizedLength = sanitizeErrorMessage(String(expression.length), OutputContext.HTML);
    return {
      valid: false,
      errors: [{
        line: 1,
        column: 1,
        endLine: 1,
        endColumn: 1,
        message: `DSL expression exceeds maximum size of ${MAX_TOTAL_DSL_LENGTH} bytes (${sanitizedLength} bytes)`,
        severity: 'error',
        suggestion: 'Break your rule into smaller, more focused rules',
      }],
      warnings: [],
    };
  }

  // P0-1: Start timing for timeout enforcement
  const startTime = performance.now();

  try {
    const lexer = new Lexer(expression, startTime);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens, startTime);
    const result = parser.parse();

    // Merge lexer errors with parser errors
    if (lexer.errors.length > 0) {
      return {
        valid: false,
        errors: [...lexer.errors, ...result.errors],
        warnings: result.warnings,
        ast: result.ast,
      };
    }

    return result;
  } catch (error: any) {
    return {
      valid: false,
      errors: [{
        line: 1,
        column: 1,
        endLine: 1,
        endColumn: 1,
        message: error.message || 'Validation failed',
        severity: 'error',
      }],
      warnings: [],
    };
  }
}
