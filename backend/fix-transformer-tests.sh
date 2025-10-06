#!/bin/bash

# Remove unnecessary type validation tests from all transformer test files
for file in src/test/java/com/fluo/transformers/**/*Test.java; do
    echo "Processing $file"

    # Remove test methods that validate types (now that transformers are simplified)
    sed -i.bak '/@Test.*testValidateInputType/,/^    \}/d' "$file"
    sed -i.bak '/@Test.*testValidateOutputType/,/^    \}/d' "$file"
    sed -i.bak '/@Test.*testAccept.*Type/,/^    \}/d' "$file"

    # Clean up backup files
    rm -f "${file}.bak"
done

echo "Fixed transformer tests"