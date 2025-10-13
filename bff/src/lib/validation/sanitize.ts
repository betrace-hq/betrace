/**
 * Context-Aware Sanitization for DSL Error Messages (PRD-010c)
 *
 * Prevents XSS vulnerabilities by escaping user input based on output context.
 * Supports HTML, JavaScript, JSON, and Markdown contexts.
 */

// ============================================================================
// Output Contexts
// ============================================================================

export enum OutputContext {
  HTML = 'html',
  JAVASCRIPT = 'javascript',
  JSON = 'json',
  MARKDOWN = 'markdown',
}

// ============================================================================
// Context-Aware Sanitization
// ============================================================================

/**
 * Sanitizes a message for safe display in the specified output context.
 *
 * @param message - The message to sanitize (may contain user input)
 * @param context - The output context (HTML, JavaScript, JSON, or Markdown)
 * @returns Sanitized message safe for the specified context
 *
 * @example
 * // HTML context (ARIA labels, Alert components)
 * sanitizeErrorMessage('<script>alert("XSS")</script>', OutputContext.HTML)
 * // Returns: '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;'
 *
 * @example
 * // Markdown context (Monaco hover tooltips)
 * sanitizeErrorMessage('[Click](javascript:alert(1))', OutputContext.MARKDOWN)
 * // Returns: '\\[Click\\]\\(javascript:alert(1)\\)'
 */
export function sanitizeErrorMessage(
  message: string,
  context: OutputContext = OutputContext.HTML
): string {
  switch (context) {
    case OutputContext.HTML:
      return sanitizeForHTML(message);

    case OutputContext.JAVASCRIPT:
      return sanitizeForJavaScript(message);

    case OutputContext.JSON:
      return sanitizeForJSON(message);

    case OutputContext.MARKDOWN:
      return sanitizeForMarkdown(message);

    default:
      // Default to HTML (safest)
      return sanitizeForHTML(message);
  }
}

/**
 * Sanitizes a token value for inclusion in error messages.
 * Truncates long tokens and applies context-aware escaping.
 *
 * @param token - The token value to sanitize
 * @param context - The output context
 * @returns Sanitized and truncated token value
 */
export function sanitizeTokenValue(
  token: string,
  context: OutputContext = OutputContext.HTML
): string {
  const MAX_TOKEN_DISPLAY_LENGTH = 50;

  const truncated =
    token.length > MAX_TOKEN_DISPLAY_LENGTH
      ? token.substring(0, MAX_TOKEN_DISPLAY_LENGTH) + '...'
      : token;

  return sanitizeErrorMessage(truncated, context);
}

// ============================================================================
// Context-Specific Sanitization Functions
// ============================================================================

/**
 * Sanitizes for HTML context (ARIA labels, shadcn/ui Alert components).
 * Strips control characters (0x00-0x1F, 0x7F-0x9F) then escapes: & < > " ' /
 */
function sanitizeForHTML(message: string): string {
  return message
    .replace(/[\x00-\x1F\x7F-\x9F]/g, '') // P1-2: Strip control chars including null bytes
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Sanitizes for JavaScript context (console.error, JavaScript strings).
 * Strips dangerous control characters then escapes: \ ' " \n \r \t /
 */
function sanitizeForJavaScript(message: string): string {
  return message
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '') // P1-2: Strip control chars except \t \n \r
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    .replace(/\//g, '\\/'); // Prevent script tag injection
}

/**
 * Sanitizes for JSON context (JSON.stringify equivalence).
 * Strips dangerous control characters (but preserves \t \n \r for JSON escaping).
 */
function sanitizeForJSON(message: string): string {
  // P1-2: Strip control chars except \t(0x09) \n(0x0A) \r(0x0D) which JSON.stringify handles
  const cleaned = message.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');
  // JSON.stringify handles all special characters correctly
  const jsonString = JSON.stringify(cleaned);
  // Remove surrounding quotes (JSON.stringify adds them)
  return jsonString.slice(1, -1);
}

/**
 * Sanitizes for Markdown context (Monaco hover tooltips).
 * Strips control characters then escapes Markdown syntax and HTML tags:
 * - Escapes: [ ] ( ) \ < >
 * - Prevents link injection: [text](javascript:alert())
 */
function sanitizeForMarkdown(message: string): string {
  return message
    .replace(/[\x00-\x1F\x7F-\x9F]/g, '') // P1-2: Strip control chars including null bytes
    .replace(/\\/g, '\\\\') // Backslash first
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
