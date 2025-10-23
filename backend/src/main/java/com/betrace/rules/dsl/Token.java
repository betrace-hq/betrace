package com.betrace.rules.dsl;

/**
 * Token in the FLUO DSL with position tracking for error reporting
 */
public record Token(TokenType type, String value, int position) {
    @Override
    public String toString() {
        return type + "(" + value + ")@" + position;
    }
}
