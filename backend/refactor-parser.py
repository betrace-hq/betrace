#!/usr/bin/env python3
"""
Refactor FluoDslParser to use ParseError instead of ParseException.

This script performs a comprehensive refactor of the DSL parser to use
rich ParseError exceptions with line/column information instead of simple
ParseException messages.
"""

import re

PARSER_FILE = '/Users/sscoble/Projects/fluo/backend/src/main/java/com/fluo/rules/dsl/FluoDslParser.java'

# Read the original file
with open(PARSER_FILE, 'r') as f:
    content = f.read()

print("Starting ParseError refactor...")

# Step 1: Remove unused imports
content = content.replace('import java.util.regex.Matcher;\n', '')
content = content.replace('import java.util.regex.Pattern;\n', '')
print("✓ Removed unused imports")

# Step 2: Add lexer field after class declaration
content = content.replace(
    '@ApplicationScoped\npublic class FluoDslParser {',
    '@ApplicationScoped\npublic class FluoDslParser {\n\n    private Lexer lexer; // Store lexer for error reporting'
)
print("✓ Added lexer field")

# Step 3: Fix parse() method
content = content.replace(
    '            throw new ParseException("Empty DSL expression");',
    '            throw ParseError.unexpectedEnd(dsl == null ? "" : dsl);'
)
content = content.replace(
    '        Lexer lexer = new Lexer(dsl.trim());',
    '        this.lexer = new Lexer(dsl.trim());'
)
print("✓ Updated parse() method")

# Step 4: Remove the nested ParseException class
content = re.sub(
    r'    /\*\*\n     \* Exception thrown during parsing\n     \*/\n    public static class ParseException extends RuntimeException \{\n        public ParseException\(String message\) \{\n            super\(message\);\n        \}\n    \}\n',
    '',
    content
)
print("✓ Removed ParseException class")

# Step 5: Replace all ParseException throws with ParseError calls

# Line 61: Expected 'trace' but got: X
content = content.replace(
    '            throw new ParseException("Expected \'trace\' but got: " + token.value());',
    '''            throw ParseError.unexpectedToken(
                lexer.getInput(),
                token.position(),
                "'trace'",
                token.value()
            );'''
)

# Line 67: Expected '.' after 'trace'
content = content.replace(
    '            throw new ParseException("Expected \'.\' after \'trace\'");',
    '''            throw ParseError.missingToken(
                lexer.getInput(),
                token.position(),
                "'.' after 'trace'"
            );'''
)

# Line 72: Expected function name (has/count)
content = content.replace(
    '            throw new ParseException("Expected function name (has/count)");',
    '''            throw ParseError.unexpectedToken(
                lexer.getInput(),
                token.position(),
                "function name (has/count)",
                token.value()
            );'''
)

# Line 82: Unknown function: X
content = content.replace(
    '            throw new ParseException("Unknown function: " + function);',
    '''            throw new ParseError(
                "Unknown function: " + function,
                lexer.getInput(),
                token.position(),
                ParseError.ErrorType.INVALID_IDENTIFIER,
                "Valid functions are: has, count"
            );'''
)

# Line 90: Expected '(' after 'has'
content = content.replace(
    '            throw new ParseException("Expected \'(\' after \'has\'");',
    '''            throw ParseError.missingToken(
                lexer.getInput(),
                token.position(),
                "'(' after 'has'"
            );'''
)

# Line 95: Expected operation name
content = content.replace(
    '            throw new ParseException("Expected operation name");',
    '''            throw ParseError.unexpectedToken(
                lexer.getInput(),
                token.position(),
                "operation name",
                token.value()
            );'''
)

# Line 101: Expected ')' after operation name
content = content.replace(
    '            throw new ParseException("Expected \')\' after operation name");',
    '''            throw ParseError.missingToken(
                lexer.getInput(),
                token.position(),
                "')' after operation name"
            );'''
)

# Line 126: Expected '(' after 'where'
content = content.replace(
    '            throw new ParseException("Expected \'(\' after \'where\'");',
    '''            throw ParseError.missingToken(
                lexer.getInput(),
                token.position(),
                "'(' after 'where'"
            );'''
)

# Line 132: Expected attribute name
content = content.replace(
    '            throw new ParseException("Expected attribute name");',
    '''            throw ParseError.unexpectedToken(
                lexer.getInput(),
                token.position(),
                "attribute name",
                token.value()
            );'''
)

# Line 139: Expected comparison operator
content = content.replace(
    '            throw new ParseException("Expected comparison operator");',
    '''            throw ParseError.invalidOperator(
                lexer.getInput(),
                token.position(),
                token.value()
            );'''
)

# Line 149: Expected ')' after where clause
content = content.replace(
    '            throw new ParseException("Expected \')\' after where clause");',
    '''            throw ParseError.missingToken(
                lexer.getInput(),
                token.position(),
                "')' after where clause"
            );'''
)

# Line 162: Unexpected value type
content = content.replace(
    '            default -> throw new ParseException("Unexpected value type: " + token.type());',
    '''            default -> {
                throw new ParseError(
                    "Unexpected value type: " + token.type(),
                    lexer.getInput(),
                    token.position(),
                    ParseError.ErrorType.INVALID_VALUE,
                    "Expected number, string, boolean, or list"
                );
            }'''
)

# Line 175: Expected '(' after 'count'
content = content.replace(
    '            throw new ParseException("Expected \'(\' after \'count\'");',
    '''            throw ParseError.missingToken(
                lexer.getInput(),
                token.position(),
                "'(' after 'count'"
            );'''
)

# Line 180: Expected pattern
content = content.replace(
    '            throw new ParseException("Expected pattern");',
    '''            throw ParseError.unexpectedToken(
                lexer.getInput(),
                token.position(),
                "pattern",
                token.value()
            );'''
)

# Line 186: Expected ')' after pattern
content = content.replace(
    '            throw new ParseException("Expected \')\' after pattern");',
    '''            throw ParseError.missingToken(
                lexer.getInput(),
                token.position(),
                "')' after pattern"
            );'''
)

# Line 192: Expected comparison operator (in count - second occurrence)
# We already replaced the first one in parseWhereClause, this is in parseCountExpression
old_text = '''        // operator
        token = lexer.next();
        if (!isComparisonOperator(token.type())) {
            throw new ParseException("Expected comparison operator");
        }'''

new_text = '''        // operator
        token = lexer.next();
        if (!isComparisonOperator(token.type())) {
            throw ParseError.invalidOperator(
                lexer.getInput(),
                token.position(),
                token.value()
            );
        }'''

content = content.replace(old_text, new_text)

# Line 199: Expected number
content = content.replace(
    '            throw new ParseException("Expected number");',
    '''            throw ParseError.unexpectedToken(
                lexer.getInput(),
                token.position(),
                "number",
                token.value()
            );'''
)

print("✓ Replaced all 18 ParseException throws with ParseError calls")

# Write the refactored content
with open(PARSER_FILE, 'w') as f:
    f.write(content)

print("✅ Refactoring complete!")
print(f"✅ File written: {PARSER_FILE}")

# Verify no ParseException remains
with open(PARSER_FILE, 'r') as f:
    verify_content = f.read()

remaining = verify_content.count('ParseException')
if remaining == 0:
    print("✅ Verification passed: No ParseException remaining")
else:
    print(f"⚠️  Warning: Found {remaining} occurrences of 'ParseException' still in file")
