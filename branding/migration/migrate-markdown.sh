#!/bin/bash
# migrate-markdown.sh - Update all markdown files for FLUO → BeTrace rebrand

set -e

echo "🚀 Starting markdown migration: FLUO → BeTrace"
echo ""

# Find all markdown files (excluding node_modules, target, vendor, .git, branding)
MARKDOWN_FILES=$(find . -type f -name "*.md" \
  -not -path "*/node_modules/*" \
  -not -path "*/target/*" \
  -not -path "*/.git/*" \
  -not -path "*/vendor/*" \
  -not -path "*/branding/*")

FILE_COUNT=$(echo "$MARKDOWN_FILES" | wc -l | tr -d ' ')

echo "📊 Found $FILE_COUNT markdown files to process"
echo ""

# Confirm before proceeding
read -p "Continue with migration? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo "❌ Migration cancelled"
    exit 1
fi

echo "📝 Updating markdown files..."

# Brand names
find . -type f -name "*.md" \
  -not -path "*/node_modules/*" \
  -not -path "*/target/*" \
  -not -path "*/.git/*" \
  -not -path "*/vendor/*" \
  -not -path "*/branding/*" \
  -exec sed -i '' 's/FLUO/BeTrace/g' {} +

find . -type f -name "*.md" \
  -not -path "*/node_modules/*" \
  -not -path "*/target/*" \
  -not -path "*/vendor/*" \
  -not -path "*/branding/*" \
  -exec sed -i '' 's/FluoDSL/BeTraceDSL/g' {} +

# Domains
find . -type f -name "*.md" \
  -not -path "*/node_modules/*" \
  -not -path "*/target/*" \
  -not -path "*/vendor/*" \
  -not -path "*/branding/*" \
  -exec sed -i '' 's/fluo\.dev/betrace.dev/g' {} +

find . -type f -name "*.md" \
  -not -path "*/node_modules/*" \
  -not -path "*/target/*" \
  -not -path "*/vendor/*" \
  -not -path "*/branding/*" \
  -exec sed -i '' 's/fluohq/betracehq/g' {} +

# Paths
find . -type f -name "*.md" \
  -not -path "*/node_modules/*" \
  -not -path "*/target/*" \
  -not -path "*/vendor/*" \
  -not -path "*/branding/*" \
  -exec sed -i '' 's|~/Projects/fluo|~/Projects/betrace|g' {} +

find . -type f -name "*.md" \
  -not -path "*/node_modules/*" \
  -not -path "*/target/*" \
  -not -path "*/vendor/*" \
  -not -path "*/branding/*" \
  -exec sed -i '' 's|/path/to/fluo|/path/to/betrace|g' {} +

find . -type f -name "*.md" \
  -not -path "*/node_modules/*" \
  -not -path "*/target/*" \
  -not -path "*/vendor/*" \
  -not -path "*/branding/*" \
  -exec sed -i '' 's|/tmp/fluo-test-results|/tmp/betrace-test-results|g' {} +

# Directories
find . -type f -name "*.md" \
  -not -path "*/node_modules/*" \
  -not -path "*/target/*" \
  -not -path "*/vendor/*" \
  -not -path "*/branding/*" \
  -exec sed -i '' 's|grafana-fluo-app|grafana-betrace-app|g' {} +

find . -type f -name "*.md" \
  -not -path "*/node_modules/*" \
  -not -path "*/target/*" \
  -not -path "*/vendor/*" \
  -not -path "*/branding/*" \
  -exec sed -i '' 's|\.skills/fluo-dsl|.skills/betrace-dsl|g' {} +

# Environment variables
find . -type f -name "*.md" \
  -not -path "*/node_modules/*" \
  -not -path "*/target/*" \
  -not -path "*/vendor/*" \
  -not -path "*/branding/*" \
  -exec sed -i '' 's|FLUO_|BETRACE_|g' {} +

# Nix flake references
find . -type f -name "*.md" \
  -not -path "*/node_modules/*" \
  -not -path "*/target/*" \
  -not -path "*/vendor/*" \
  -not -path "*/branding/*" \
  -exec sed -i '' 's|inputs\.fluo|inputs.betrace|g' {} +

find . -type f -name "*.md" \
  -not -path "*/node_modules/*" \
  -not -path "*/target/*" \
  -not -path "*/vendor/*" \
  -not -path "*/branding/*" \
  -exec sed -i '' 's|fluo\.packages|betrace.packages|g' {} +

# MCP tool names
find . -type f -name "*.md" \
  -not -path "*/node_modules/*" \
  -not -path "*/target/*" \
  -not -path "*/vendor/*" \
  -not -path "*/branding/*" \
  -exec sed -i '' 's|create_fluo_|create_betrace_|g' {} +

find . -type f -name "*.md" \
  -not -path "*/node_modules/*" \
  -not -path "*/target/*" \
  -not -path "*/vendor/*" \
  -not -path "*/branding/*" \
  -exec sed -i '' 's|validate_fluo_|validate_betrace_|g' {} +

find . -type f -name "*.md" \
  -not -path "*/node_modules/*" \
  -not -path "*/target/*" \
  -not -path "*/vendor/*" \
  -not -path "*/branding/*" \
  -exec sed -i '' 's|explain_fluo_|explain_betrace_|g' {} +

find . -type f -name "*.md" \
  -not -path "*/node_modules/*" \
  -not -path "*/target/*" \
  -not -path "*/vendor/*" \
  -not -path "*/branding/*" \
  -exec sed -i '' 's|troubleshoot_fluo|troubleshoot_betrace|g' {} +

find . -type f -name "*.md" \
  -not -path "*/node_modules/*" \
  -not -path "*/target/*" \
  -not -path "*/vendor/*" \
  -not -path "*/branding/*" \
  -exec sed -i '' 's|search_fluo_|search_betrace_|g' {} +

# MCP server key
find . -type f -name "*.md" \
  -not -path "*/node_modules/*" \
  -not -path "*/target/*" \
  -not -path "*/vendor/*" \
  -not -path "*/branding/*" \
  -exec sed -i '' 's|"mcpServers": {\n    "fluo"|"mcpServers": {\n    "betrace"|g' {} +

echo ""
echo "✅ Markdown migration complete!"
echo ""
echo "📊 Summary:"
MODIFIED_COUNT=$(git status --short | grep '\.md$' | wc -l | tr -d ' ')
echo "  - Modified files: $MODIFIED_COUNT"
echo ""
echo "🔍 Review changes with: git diff"
echo "✅ Commit changes with: git add . && git commit -m 'rebrand: FLUO → BeTrace (markdown files)'"
