# FLUO Documentation

This directory contains all project-wide documentation for the FLUO Behavioral Assurance System.

## 📁 Documentation Structure

### Core Documentation
- **[compliance-status.md](compliance-status.md)** - Current compliance status, security gaps, and realistic timeline
- **[compliance.md](compliance.md)** - SOC2/HIPAA compliance evidence system integration guide

### Architecture Decision Records
- **[adrs/](adrs/)** - All architecture decisions and their rationale
  - Primary: [ADR-011: Pure Application Framework](adrs/011-pure-application-framework.md)
  - See [adrs/README.md](adrs/README.md) for complete index

### Technical Documentation
- **[technical/trace-rules-dsl.md](technical/trace-rules-dsl.md)** - FLUO DSL syntax and grammar reference
- **[technical/error-messages.md](technical/error-messages.md)** - DSL parser error handling and testing
- **[technical/storybook.md](technical/storybook.md)** - Frontend style guide and component documentation

## 🔍 Quick Navigation

### For New Developers
1. Start with root [CLAUDE.md](../CLAUDE.md) for project overview
2. Read [ADR-011](adrs/011-pure-application-framework.md) to understand architecture
3. Review [ADR-015](adrs/015-development-workflow-and-quality-standards.md) for development standards

### For SREs/Operators
1. Review [technical/trace-rules-dsl.md](technical/trace-rules-dsl.md) for rule syntax
2. Check [compliance-status.md](compliance-status.md) for security considerations

### For Compliance Teams
1. Read [compliance.md](compliance.md) for evidence generation
2. Review [compliance-status.md](compliance-status.md) for current status and gaps

## 📝 Documentation Standards

**When adding documentation:**
1. Use clear, concise language focused on essential information
2. Prefer technical accuracy over marketing language
3. Reference other docs using `@docs/path/to/file.md` syntax
4. Keep docs current - delete outdated content immediately
5. Avoid aspirational content - document reality, not plans

**Documentation locations:**
- Project-wide docs → `/docs/`
- Backend-specific → `/backend/CLAUDE.md` (reference only)
- Frontend-specific → `/bff/CLAUDE.md` (reference only)
- Architecture decisions → `/docs/adrs/`

## 🎯 Documentation Philosophy

FLUO documentation follows these principles:
1. **Honesty** - Document what exists, not what we wish existed
2. **Brevity** - Reduce context bloat, maximize signal-to-noise
3. **Relevance** - Every doc must add to project understanding
4. **Maintainability** - One source of truth per topic
