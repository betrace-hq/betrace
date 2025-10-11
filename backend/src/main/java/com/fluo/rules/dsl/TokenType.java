package com.fluo.rules.dsl;

/**
 * Token types in FLUO DSL
 */
public enum TokenType {
    // Keywords
    AND, OR, NOT, TRACE,

    // Comparison operators
    EQ,      // ==
    NE,      // !=
    GT,      // >
    GTE,     // >=
    LT,      // <
    LTE,     // <=
    IN,      // in
    MATCHES, // matches

    // Literals
    NUMBER,
    STRING,
    BOOLEAN,
    IDENTIFIER,

    // Punctuation
    LPAREN,    // (
    RPAREN,    // )
    LBRACKET,  // [
    RBRACKET,  // ]
    COMMA,     // ,
    DOT        // .
}
