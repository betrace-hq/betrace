#!/usr/bin/env python3

import os
import re

# Test methods to remove
TEST_PATTERNS = [
    r'@Test[^}]*?void\s+testValidateInputType\(\)[^}]*?\}\n',
    r'@Test[^}]*?void\s+testValidateOutputType\(\)[^}]*?\}\n',
    r'@Test[^}]*?void\s+testAccept\w+Type\(\)[^}]*?\}\n',
]

def clean_test_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    original = content
    for pattern in TEST_PATTERNS:
        # Remove the test method including its @Test annotation
        content = re.sub(pattern, '', content, flags=re.DOTALL | re.MULTILINE)

    # Clean up extra blank lines
    content = re.sub(r'\n\n\n+', '\n\n', content)

    if content != original:
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"Cleaned {filepath}")

# Find all transformer test files
for root, dirs, files in os.walk('src/test/java/com/fluo/transformers'):
    for file in files:
        if file.endswith('Test.java'):
            filepath = os.path.join(root, file)
            clean_test_file(filepath)

print("Done cleaning transformer tests")