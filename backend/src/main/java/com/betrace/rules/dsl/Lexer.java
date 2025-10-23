package com.fluo.rules.dsl;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Lexical analyzer for FLUO DSL with position tracking for error reporting
 */
public class Lexer {
    private final String input;
    private final List<Token> tokens = new ArrayList<>();
    private int position = 0;

    private static final Pattern TOKEN_PATTERN = Pattern.compile(
        "\\s*(" +
        "and|or|not|true|false|" +  // keywords
        "trace|has|count|where|" +   // functions
        "==|!=|>=|<=|>|<|in|matches|" + // operators
        "[a-zA-Z_][a-zA-Z0-9_.]*|" + // identifiers
        "\\d+\\.?\\d*|" +            // numbers
        "\"[^\"]*\"|" +              // strings
        "[()\\[\\],.]" +             // punctuation
        ")"
    );

    public Lexer(String input) {
        this.input = input;
        tokenize(input);
    }

    private void tokenize(String input) {
        Matcher matcher = TOKEN_PATTERN.matcher(input);
        while (matcher.find()) {
            String value = matcher.group(1);
            if (value != null && !value.isEmpty()) {
                int pos = matcher.start(1);
                tokens.add(classifyToken(value, pos));
            }
        }
    }

    private Token classifyToken(String value, int pos) {
        return switch (value) {
            case "and" -> new Token(TokenType.AND, value, pos);
            case "or" -> new Token(TokenType.OR, value, pos);
            case "not" -> new Token(TokenType.NOT, value, pos);
            case "trace" -> new Token(TokenType.TRACE, value, pos);
            case "true", "false" -> new Token(TokenType.BOOLEAN, value, pos);
            case "==" -> new Token(TokenType.EQ, value, pos);
            case "!=" -> new Token(TokenType.NE, value, pos);
            case ">" -> new Token(TokenType.GT, value, pos);
            case ">=" -> new Token(TokenType.GTE, value, pos);
            case "<" -> new Token(TokenType.LT, value, pos);
            case "<=" -> new Token(TokenType.LTE, value, pos);
            case "in" -> new Token(TokenType.IN, value, pos);
            case "matches" -> new Token(TokenType.MATCHES, value, pos);
            case "(" -> new Token(TokenType.LPAREN, value, pos);
            case ")" -> new Token(TokenType.RPAREN, value, pos);
            case "[" -> new Token(TokenType.LBRACKET, value, pos);
            case "]" -> new Token(TokenType.RBRACKET, value, pos);
            case "," -> new Token(TokenType.COMMA, value, pos);
            case "." -> new Token(TokenType.DOT, value, pos);
            default -> {
                if (value.matches("\\d+\\.?\\d*")) {
                    yield new Token(TokenType.NUMBER, value, pos);
                } else if (value.startsWith("\"") && value.endsWith("\"")) {
                    yield new Token(TokenType.STRING, value.substring(1, value.length() - 1), pos);
                } else {
                    yield new Token(TokenType.IDENTIFIER, value, pos);
                }
            }
        };
    }

    public boolean hasNext() {
        return position < tokens.size();
    }

    public Token next() {
        if (!hasNext()) {
            throw ParseError.unexpectedEnd(input);
        }
        return tokens.get(position++);
    }

    public Token peek() {
        if (!hasNext()) {
            return null;
        }
        return tokens.get(position);
    }

    public Token peekAhead(int offset) {
        int pos = position + offset;
        if (pos < tokens.size()) {
            return tokens.get(pos);
        }
        return null;
    }

    public String getInput() {
        return input;
    }

    public int getCurrentPosition() {
        if (position < tokens.size()) {
            return tokens.get(position).position();
        }
        return input.length();
    }
}
