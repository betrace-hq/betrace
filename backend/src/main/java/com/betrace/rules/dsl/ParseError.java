package com.betrace.rules.dsl;

/**
 * Rich error information for DSL parsing errors
 */
public class ParseError extends RuntimeException {
    private final String input;
    private final int position;
    private final int line;
    private final int column;
    private final ErrorType errorType;
    private final String suggestion;

    public enum ErrorType {
        UNEXPECTED_TOKEN,
        MISSING_TOKEN,
        INVALID_OPERATOR,
        INVALID_IDENTIFIER,
        INVALID_VALUE,
        UNEXPECTED_END
    }

    public ParseError(String message, String input, int position, ErrorType errorType) {
        this(message, input, position, errorType, null);
    }

    public ParseError(String message, String input, int position, ErrorType errorType, String suggestion) {
        super(formatMessage(message, input, position, suggestion));
        this.input = input;
        this.position = position;
        this.errorType = errorType;
        this.suggestion = suggestion;

        // Calculate line and column
        int[] lineCol = calculateLineColumn(input, position);
        this.line = lineCol[0];
        this.column = lineCol[1];
    }

    private static String formatMessage(String message, String input, int position, String suggestion) {
        int[] lineCol = calculateLineColumn(input, position);
        int line = lineCol[0];
        int column = lineCol[1];

        StringBuilder sb = new StringBuilder();
        sb.append("Parse error at line ").append(line).append(", column ").append(column).append(":\n");
        sb.append("  ").append(message).append("\n\n");

        // Show the problematic line with a pointer
        String[] lines = input.split("\n");
        if (line <= lines.length) {
            String errorLine = lines[line - 1];
            sb.append("  ").append(errorLine).append("\n");
            sb.append("  ").append(" ".repeat(Math.max(0, column - 1))).append("^\n");
        }

        if (suggestion != null) {
            sb.append("\n  Suggestion: ").append(suggestion);
        }

        return sb.toString();
    }

    private static int[] calculateLineColumn(String input, int position) {
        int line = 1;
        int column = 1;
        for (int i = 0; i < Math.min(position, input.length()); i++) {
            if (input.charAt(i) == '\n') {
                line++;
                column = 1;
            } else {
                column++;
            }
        }
        return new int[]{line, column};
    }

    public String getInput() { return input; }
    public int getPosition() { return position; }
    public int getLine() { return line; }
    public int getColumn() { return column; }
    public ErrorType getErrorType() { return errorType; }
    public String getSuggestion() { return suggestion; }

    /**
     * Create error with helpful suggestion
     */
    public static ParseError unexpectedToken(String input, int position, String expected, String actual) {
        String message = String.format("Expected %s but found '%s'", expected, actual);
        String suggestion = String.format("Try using %s instead", expected);
        return new ParseError(message, input, position, ErrorType.UNEXPECTED_TOKEN, suggestion);
    }

    public static ParseError missingToken(String input, int position, String expected) {
        String message = String.format("Missing %s", expected);
        String suggestion = String.format("Add %s here", expected);
        return new ParseError(message, input, position, ErrorType.MISSING_TOKEN, suggestion);
    }

    public static ParseError invalidOperator(String input, int position, String operator) {
        String message = String.format("Invalid operator '%s'", operator);
        String suggestion = "Valid operators: ==, !=, >, >=, <, <=, in, matches";
        return new ParseError(message, input, position, ErrorType.INVALID_OPERATOR, suggestion);
    }

    public static ParseError unexpectedEnd(String input) {
        String message = "Unexpected end of expression";
        String suggestion = "Complete the expression or remove trailing operators";
        return new ParseError(message, input, input.length(), ErrorType.UNEXPECTED_END, suggestion);
    }
}
