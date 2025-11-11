#!/usr/bin/env python3
"""
Convert old trace.has() DSL syntax to new when-always-never syntax
"""

import re
import sys
import yaml

def convert_condition(old_condition):
    """Convert old DSL syntax to new when-always-never syntax"""
    # Remove leading/trailing whitespace and newlines
    condition = old_condition.strip()

    # Pattern 1: trace.has(A).where(...) and not trace.has(B)
    # → when { A.where(...) } never { B }
    match = re.match(r'trace\.has\(([^)]+)\)(\.where\([^)]+\))?\s+and\s+not\s+trace\.has\(([^)]+)\)', condition, re.DOTALL)
    if match:
        span_a = match.group(1)
        where_clause = match.group(2) or ""
        span_b = match.group(3)
        return f"when {{ {span_a}{where_clause} }} never {{ {span_b} }}"

    # Pattern 2: trace.has(A) and trace.has(B) and trace.has(C).where(...)
    # → when { A and B } always { C.where(...) }
    match = re.match(
        r'trace\.has\(([^)]+)\)\s+and\s+trace\.has\(([^)]+)\)\s+and\s+trace\.has\(([^)]+)\)(\.where\([^)]+\))',
        condition, re.DOTALL
    )
    if match:
        span_a = match.group(1)
        span_b = match.group(2)
        span_c = match.group(3)
        where_clause = match.group(4)
        return f"when {{ {span_a} and {span_b} }} always {{ {span_c}{where_clause} }}"

    # Pattern 3: trace.has(A).where(...) and trace.has(B).where(...)
    # → when { A.where(...) } always { B.where(...) }
    match = re.match(
        r'trace\.has\(([^)]+)\)(\.where\([^)]+\))\s+and\s+trace\.has\(([^)]+)\)(\.where\([^)]+\))',
        condition, re.DOTALL
    )
    if match:
        span_a = match.group(1)
        where_a = match.group(2)
        span_b = match.group(3)
        where_b = match.group(4)
        return f"when {{ {span_a}{where_a} }} always {{ {span_b}{where_b} }}"

    # Pattern 4a: trace.has(A).where(...) and trace.has(B)
    # → when { A.where(...) } always { B }
    match = re.match(
        r'trace\.has\(([^)]+)\)(\.where\([^)]+\))\s+and\s+trace\.has\(([^)]+)\)(?!\.where)',
        condition, re.DOTALL
    )
    if match:
        span_a = match.group(1)
        where_clause = match.group(2)
        span_b = match.group(3)
        return f"when {{ {span_a}{where_clause} }} always {{ {span_b} }}"

    # Pattern 4b: trace.has(A) and trace.has(B).where(...)
    # → when { A } always { B.where(...) }
    match = re.match(
        r'trace\.has\(([^)]+)\)\s+and\s+trace\.has\(([^)]+)\)(\.where\([^)]+\))',
        condition, re.DOTALL
    )
    if match:
        span_a = match.group(1)
        span_b = match.group(2)
        where_clause = match.group(3)
        return f"when {{ {span_a} }} always {{ {span_b}{where_clause} }}"

    # Pattern 5: trace.has(A) and trace.has(B)
    # → when { A } always { B }
    match = re.match(r'trace\.has\(([^)]+)\)\s+and\s+trace\.has\(([^)]+)\)', condition, re.DOTALL)
    if match:
        span_a = match.group(1)
        span_b = match.group(2)
        return f"when {{ {span_a} }} always {{ {span_b} }}"

    # Pattern 6: trace.count(X) != trace.count(Y)
    # → when { count(X) != count(Y) }
    match = re.match(r'trace\.count\(([^)]+)\)\s*([!<>=]+)\s*trace\.count\(([^)]+)\)', condition)
    if match:
        span_a = match.group(1)
        op = match.group(2)
        span_b = match.group(3)
        # Note: This pattern doesn't have explicit always/never, marking as TODO
        return f"# TODO: Add always/never clause\nwhen {{ count({span_a}) {op} count({span_b}) }}"

    # Pattern 7: trace.count(X) > N
    # → when { count(X) > N }
    match = re.match(r'trace\.count\(([^)]+)\)\s*([><=!]+)\s*(\d+)', condition)
    if match:
        span = match.group(1)
        op = match.group(2)
        value = match.group(3)
        # Note: This pattern doesn't have explicit always/never, marking as TODO
        return f"# TODO: Add always/never clause (e.g., always {{ alert }})\nwhen {{ count({span}) {op} {value} }}"

    # Pattern 8: trace.has(X).where(...)
    # → Single condition, needs manual review
    match = re.match(r'trace\.has\(([^)]+)\)(\.where\([^)]+\))', condition)
    if match:
        span = match.group(1)
        where_clause = match.group(2)
        return f"# TODO: Add always/never clause\nwhen {{ {span}{where_clause} }}"

    # Pattern 9: trace.has(X)
    # → Single condition, needs manual review
    match = re.match(r'trace\.has\(([^)]+)\)', condition)
    if match:
        span = match.group(1)
        return f"# TODO: Add always/never clause\nwhen {{ {span} }}"

    # Couldn't parse - return as comment for manual review
    return f"# TODO: Manual conversion required\n# Original: {condition}"


def convert_yaml_file(input_path, output_path):
    """Convert YAML file with old DSL to new DSL"""
    with open(input_path, 'r') as f:
        data = yaml.safe_load(f)

    converted_count = 0
    needs_review_count = 0

    for rule in data.get('rules', []):
        if 'condition' in rule:
            old_condition = rule['condition']
            new_condition = convert_condition(old_condition)

            # Check if needs manual review
            if 'TODO' in new_condition or '#' in new_condition:
                needs_review_count += 1

            # Handle "not in [...]" syntax (not supported by DSL)
            if ' not in [' in new_condition or ' in [' in new_condition:
                new_condition = "# TODO: DSL doesn't support 'in' operator - convert to multiple != checks\n" + new_condition
                needs_review_count += 1

            rule['condition'] = new_condition
            converted_count += 1

    # Write converted YAML
    with open(output_path, 'w') as f:
        f.write(f"# Converted from old trace.has() syntax to new when-always-never syntax\n")
        f.write(f"# Converted rules: {converted_count}\n")
        f.write(f"# Rules needing manual review: {needs_review_count}\n")
        f.write(f"#\n")
        yaml.dump(data, f, default_flow_style=False, sort_keys=False, width=120)

    return converted_count, needs_review_count


if __name__ == '__main__':
    if len(sys.argv) != 3:
        print("Usage: convert-yaml-dsl.py <input.yaml> <output.yaml>")
        sys.exit(1)

    input_file = sys.argv[1]
    output_file = sys.argv[2]

    converted, needs_review = convert_yaml_file(input_file, output_file)
    print(f"✅ Converted {converted} rules")
    print(f"⚠️  {needs_review} rules need manual review (marked with TODO comments)")
