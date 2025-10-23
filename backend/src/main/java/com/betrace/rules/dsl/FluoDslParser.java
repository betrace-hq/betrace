package com.fluo.rules.dsl;

import jakarta.enterprise.context.ApplicationScoped;

import java.util.ArrayList;
import java.util.List;

/**
 * Parser for FLUO's trace-level rule DSL.
 *
 * Parses expressions like:
 *   trace.has(payment.charge_card).where(amount > 1000) and trace.has(payment.fraud_check)
 *
 * Into an AST that can be translated to Drools DRL.
 */
@ApplicationScoped
public class FluoDslParser {

    private Lexer lexer; // Store lexer for error reporting

    /**
     * Parse a FLUO DSL rule expression into an AST
     */
    public RuleExpression parse(String dsl) {
        if (dsl == null || dsl.trim().isEmpty()) {
            throw ParseError.unexpectedEnd(dsl == null ? "" : dsl);
        }

        this.lexer = new Lexer(dsl.trim());
        return parseExpression(lexer);
    }

    private RuleExpression parseExpression(Lexer lexer) {
        RuleExpression left = parseTerm(lexer);

        while (lexer.hasNext()) {
            Token token = lexer.peek();
            if (token.type() == TokenType.AND || token.type() == TokenType.OR) {
                lexer.next(); // consume operator
                RuleExpression right = parseTerm(lexer);
                left = new BinaryExpression(token.type() == TokenType.AND ? "and" : "or", left, right);
            } else {
                break;
            }
        }

        return left;
    }

    private RuleExpression parseTerm(Lexer lexer) {
        Token token = lexer.peek();

        // Handle NOT
        if (token.type() == TokenType.NOT) {
            lexer.next(); // consume NOT
            return new NotExpression(parseTerm(lexer));
        }

        // Must be trace.has() or trace.count()
        if (token.type() != TokenType.TRACE) {
            throw ParseError.unexpectedToken(
                lexer.getInput(),
                token.position(),
                "'trace'",
                token.value()
            );
        }
        lexer.next(); // consume 'trace'

        token = lexer.next(); // should be DOT
        if (token.type() != TokenType.DOT) {
            throw ParseError.missingToken(
                lexer.getInput(),
                token.position(),
                "'.' after 'trace'"
            );
        }

        token = lexer.next(); // should be function name
        if (token.type() != TokenType.IDENTIFIER) {
            throw ParseError.unexpectedToken(
                lexer.getInput(),
                token.position(),
                "function name (has/count)",
                token.value()
            );
        }

        String function = token.value();

        if (function.equals("has")) {
            return parseHasExpression(lexer);
        } else if (function.equals("count")) {
            return parseCountExpression(lexer);
        } else {
            throw new ParseError(
                "Unknown function: " + function,
                lexer.getInput(),
                token.position(),
                ParseError.ErrorType.INVALID_IDENTIFIER,
                "Valid functions are: has, count"
            );
        }
    }

    private HasExpression parseHasExpression(Lexer lexer) {
        // parse (operationName)
        Token token = lexer.next();
        if (token.type() != TokenType.LPAREN) {
            throw ParseError.missingToken(
                lexer.getInput(),
                token.position(),
                "'(' after 'has'"
            );
        }

        token = lexer.next();
        if (token.type() != TokenType.IDENTIFIER) {
            throw ParseError.unexpectedToken(
                lexer.getInput(),
                token.position(),
                "operation name",
                token.value()
            );
        }
        String operationName = token.value();

        token = lexer.next();
        if (token.type() != TokenType.RPAREN) {
            throw ParseError.missingToken(
                lexer.getInput(),
                token.position(),
                "')' after operation name"
            );
        }

        HasExpression hasExpr = new HasExpression(operationName);

        // Parse optional .where() clauses
        while (lexer.hasNext() && lexer.peek().type() == TokenType.DOT) {
            Token peek = lexer.peekAhead(1);
            if (peek != null && peek.value().equals("where")) {
                lexer.next(); // consume DOT
                lexer.next(); // consume 'where'
                WhereClause where = parseWhereClause(lexer);
                hasExpr.addWhereClause(where);
            } else {
                break;
            }
        }

        return hasExpr;
    }

    private WhereClause parseWhereClause(Lexer lexer) {
        // parse (attribute op value)
        Token token = lexer.next();
        if (token.type() != TokenType.LPAREN) {
            throw ParseError.missingToken(
                lexer.getInput(),
                token.position(),
                "'(' after 'where'"
            );
        }

        // attribute name
        token = lexer.next();
        if (token.type() != TokenType.IDENTIFIER) {
            throw ParseError.unexpectedToken(
                lexer.getInput(),
                token.position(),
                "attribute name",
                token.value()
            );
        }
        String attribute = token.value();

        // operator
        token = lexer.next();
        if (token.type() == null || !isComparisonOperator(token.type())) {
            throw ParseError.invalidOperator(
                lexer.getInput(),
                token.position(),
                token.value()
            );
        }
        String operator = token.value();

        // value
        token = lexer.next();
        Object value = parseValue(token);

        token = lexer.next();
        if (token.type() != TokenType.RPAREN) {
            throw ParseError.missingToken(
                lexer.getInput(),
                token.position(),
                "')' after where clause"
            );
        }

        return new WhereClause(attribute, operator, value);
    }

    private Object parseValue(Token token) {
        return switch (token.type()) {
            case NUMBER -> Double.parseDouble(token.value());
            case BOOLEAN -> Boolean.parseBoolean(token.value());
            case STRING -> token.value();
            case IDENTIFIER -> token.value();
            case LBRACKET -> parseList();
            default -> {
                throw new ParseError(
                    "Unexpected value type: " + token.type(),
                    lexer.getInput(),
                    token.position(),
                    ParseError.ErrorType.INVALID_VALUE,
                    "Expected number, string, boolean, or list"
                );
            }
        };
    }

    private List<String> parseList() {
        // TODO: implement list parsing [a, b, c]
        return new ArrayList<>();
    }

    private CountExpression parseCountExpression(Lexer lexer) {
        // parse (pattern) operator value
        Token token = lexer.next();
        if (token.type() != TokenType.LPAREN) {
            throw ParseError.missingToken(
                lexer.getInput(),
                token.position(),
                "'(' after 'count'"
            );
        }

        token = lexer.next();
        if (token.type() != TokenType.IDENTIFIER) {
            throw ParseError.unexpectedToken(
                lexer.getInput(),
                token.position(),
                "pattern",
                token.value()
            );
        }
        String pattern = token.value();

        token = lexer.next();
        if (token.type() != TokenType.RPAREN) {
            throw ParseError.missingToken(
                lexer.getInput(),
                token.position(),
                "')' after pattern"
            );
        }

        // operator
        token = lexer.next();
        if (!isComparisonOperator(token.type())) {
            throw ParseError.invalidOperator(
                lexer.getInput(),
                token.position(),
                token.value()
            );
        }
        String operator = token.value();

        // value
        token = lexer.next();
        if (token.type() != TokenType.NUMBER) {
            throw ParseError.unexpectedToken(
                lexer.getInput(),
                token.position(),
                "number",
                token.value()
            );
        }
        int value = Integer.parseInt(token.value());

        return new CountExpression(pattern, operator, value);
    }

    private boolean isComparisonOperator(TokenType type) {
        return type == TokenType.EQ || type == TokenType.NE ||
               type == TokenType.GT || type == TokenType.GTE ||
               type == TokenType.LT || type == TokenType.LTE ||
               type == TokenType.IN || type == TokenType.MATCHES;
    }

}
