import DOMPurify from 'isomorphic-dompurify';
import validator from 'validator';

/**
 * Input validation and sanitization utilities for security
 */

export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  customValidator?: (value: string) => boolean;
  sanitize?: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedValue?: string;
}

export class SecurityValidator {
  /**
   * Validate and sanitize input based on rules
   */
  static validate(value: string, rules: ValidationRule): ValidationResult {
    const errors: string[] = [];
    let sanitizedValue = value;

    // Sanitize first if requested
    if (rules.sanitize) {
      sanitizedValue = this.sanitizeInput(value);
    }

    // Required check
    if (rules.required && (!sanitizedValue || sanitizedValue.trim().length === 0)) {
      errors.push('This field is required');
      return { isValid: false, errors, sanitizedValue };
    }

    // If empty and not required, skip other validations
    if (!sanitizedValue || sanitizedValue.trim().length === 0) {
      return { isValid: true, errors: [], sanitizedValue };
    }

    // Length checks
    if (rules.minLength && sanitizedValue.length < rules.minLength) {
      errors.push(`Minimum length is ${rules.minLength} characters`);
    }

    if (rules.maxLength && sanitizedValue.length > rules.maxLength) {
      errors.push(`Maximum length is ${rules.maxLength} characters`);
    }

    // Pattern check
    if (rules.pattern && !rules.pattern.test(sanitizedValue)) {
      errors.push('Invalid format');
    }

    // Custom validator
    if (rules.customValidator && !rules.customValidator(sanitizedValue)) {
      errors.push('Custom validation failed');
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedValue
    };
  }

  /**
   * Sanitize HTML input to prevent XSS
   */
  static sanitizeHtml(input: string): string {
    return DOMPurify.sanitize(input, {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: [],
      KEEP_CONTENT: true
    });
  }

  /**
   * Sanitize general input
   */
  static sanitizeInput(input: string): string {
    if (!input) return '';

    // Remove control characters and normalize
    let sanitized = input.replace(/[\x00-\x1F\x7F]/g, '');

    // Normalize whitespace
    sanitized = sanitized.trim().replace(/\s+/g, ' ');

    // HTML entity encode
    sanitized = this.htmlEncode(sanitized);

    return sanitized;
  }

  /**
   * HTML encode special characters
   */
  static htmlEncode(input: string): string {
    const div = document.createElement('div');
    div.textContent = input;
    return div.innerHTML;
  }

  /**
   * Validate email address
   */
  static validateEmail(email: string): ValidationResult {
    const sanitized = this.sanitizeInput(email);
    const isValid = validator.isEmail(sanitized);

    return {
      isValid,
      errors: isValid ? [] : ['Invalid email address'],
      sanitizedValue: sanitized
    };
  }

  /**
   * Validate URL
   */
  static validateUrl(url: string): ValidationResult {
    const sanitized = this.sanitizeInput(url);
    const isValid = validator.isURL(sanitized, {
      protocols: ['http', 'https'],
      require_protocol: true
    });

    return {
      isValid,
      errors: isValid ? [] : ['Invalid URL'],
      sanitizedValue: sanitized
    };
  }

  /**
   * Validate OGNL expression for rule engine
   */
  static validateOgnlExpression(expression: string): ValidationResult {
    const sanitized = this.sanitizeInput(expression);
    const errors: string[] = [];

    // Basic OGNL security checks
    const dangerousPatterns = [
      /Runtime\.getRuntime/i,
      /ProcessBuilder/i,
      /System\.exit/i,
      /Class\.forName/i,
      /java\.lang\.reflect/i,
      /eval\s*\(/i,
      /Function\s*\(/i,
      /new\s+Function/i,
      /@java/i,
      /\.class\./i
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(sanitized)) {
        errors.push('Expression contains potentially dangerous constructs');
        break;
      }
    }

    // Must contain context variables
    if (!sanitized.includes('#')) {
      errors.push('OGNL expression must reference context variables (use # syntax)');
    }

    // Length check
    if (sanitized.length > 1000) {
      errors.push('Expression is too long (maximum 1000 characters)');
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedValue: sanitized
    };
  }

  /**
   * Validate JSON input
   */
  static validateJson(jsonString: string): ValidationResult {
    const sanitized = this.sanitizeInput(jsonString);

    try {
      JSON.parse(sanitized);
      return {
        isValid: true,
        errors: [],
        sanitizedValue: sanitized
      };
    } catch (error) {
      return {
        isValid: false,
        errors: ['Invalid JSON format'],
        sanitizedValue: sanitized
      };
    }
  }

  /**
   * Validate tenant/organization name
   */
  static validateTenantName(name: string): ValidationResult {
    return this.validate(name, {
      required: true,
      minLength: 2,
      maxLength: 100,
      pattern: /^[a-zA-Z0-9\s\-_.]+$/,
      sanitize: true
    });
  }

  /**
   * Validate rule name
   */
  static validateRuleName(name: string): ValidationResult {
    return this.validate(name, {
      required: true,
      minLength: 3,
      maxLength: 100,
      pattern: /^[a-zA-Z0-9\s\-_.]+$/,
      sanitize: true
    });
  }

  /**
   * Validate search query to prevent injection
   */
  static validateSearchQuery(query: string): ValidationResult {
    return this.validate(query, {
      maxLength: 200,
      pattern: /^[a-zA-Z0-9\s\-_.@:]+$/,
      sanitize: true
    });
  }
}

/**
 * Common validation rules
 */
export const ValidationRules = {
  required: { required: true, sanitize: true },
  email: { required: true, sanitize: true },
  password: { required: true, minLength: 8, maxLength: 128 },
  tenantName: { required: true, minLength: 2, maxLength: 100, pattern: /^[a-zA-Z0-9\s\-_.]+$/, sanitize: true },
  ruleName: { required: true, minLength: 3, maxLength: 100, pattern: /^[a-zA-Z0-9\s\-_.]+$/, sanitize: true },
  description: { maxLength: 500, sanitize: true },
  ognlExpression: { required: true, maxLength: 1000, sanitize: true },
  searchQuery: { maxLength: 200, pattern: /^[a-zA-Z0-9\s\-_.@:]*$/, sanitize: true }
} as const;