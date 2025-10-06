# ADR-010: RAG Documentation System

**Status:** Accepted
**Date:** 2025-09-22
**Deciders:** Architecture Team

## Context

FLUO has grown to include numerous Architecture Decision Records (ADRs), Standard Operating Procedures (SOPs), and contextual documentation (CLAUDE.md files). As the system scales, developers and AI assistants need instant semantic access to architectural decisions, operational procedures, and contextual information to maintain consistency and compliance.

### Problem Statement

1. **Knowledge Fragmentation**: Critical information is scattered across 37+ markdown files
2. **Search Limitations**: Traditional text search cannot understand semantic relationships
3. **Context Loss**: Developers may miss relevant ADRs when making similar decisions
4. **AI Assistant Context**: Claude Code needs instant access to project-specific knowledge
5. **Onboarding Complexity**: New team members struggle to find relevant architectural context

### Current Documentation Inventory

- **9 ADRs**: Service-owned deployments, Nix flakes, Kubernetes architecture, etc.
- **5 SOPs**: Development workflow, deployment process, security protocols, monitoring, infrastructure changes
- **3 CLAUDE.md files**: Component-specific context for BFF, backend, and infrastructure
- **~9,523 total lines** of documentation across the FLUO monorepo

## Decision

We will implement a **Retrieval-Augmented Generation (RAG) system** using Chroma vector database to provide instant semantic access to FLUO's documentation ecosystem.

### Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Documentation │    │   RAG Pipeline  │    │  Query Interface│
│                 │    │                 │    │                 │
│ • ADRs/*.md     │───▶│ 1. Text Chunking│───▶│ • CLI Tool      │
│ • SOPs/*.md     │    │ 2. Embedding    │    │ • Python API    │
│ • CLAUDE.md     │    │ 3. Vector Store │    │ • Context Gen   │
│ • README.md     │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │              ┌─────────────────┐             │
         │              │ Chroma Database │             │
         │              │                 │             │
         └──────────────│ • Embeddings    │◀────────────┘
                        │ • Metadata      │
                        │ • Kubernetes    │
                        └─────────────────┘
```

### Technical Components

#### 1. Vector Database (Chroma)
- **Container**: Nix-built Docker image following ADR-002
- **Deployment**: Kubernetes-native following ADR-004
- **Persistence**: 10GB persistent volume for vector storage
- **Security**: Basic auth, network policies, non-root user
- **Model**: sentence-transformers/all-MiniLM-L6-v2 for embeddings

#### 2. Document Ingestion Pipeline (`scripts/ingest-docs.py`)
- **Discovery**: Automated scanning of ADRs, SOPs, CLAUDE.md files
- **Chunking**: Semantic text splitting preserving document structure
- **Metadata**: File path, type, modification time, content hash
- **Embeddings**: Vector generation using consistent model
- **Storage**: Chroma collection with searchable metadata

#### 3. Query Interface (`tools/rag-query.py`)
- **CLI Tool**: Interactive and batch query modes
- **Type Filtering**: Search specific document types (ADR, SOP, CLAUDE)
- **Context Generation**: Formatted output for prompt injection
- **Relevance Scoring**: Distance-based result ranking

#### 4. Kubernetes Integration
- **Service-Owned**: BFF component can include RAG queries
- **Component Pattern**: Following ADR-005 infrastructure modularity
- **Monitoring**: Health checks and resource management
- **Networking**: Internal cluster communication only

## Implementation Details

### Embedding Strategy
```python
# Document chunking preserves semantic boundaries
chunks = split_by_headers(document)
for chunk in chunks:
    if len(chunk) > 1500:
        sub_chunks = split_by_paragraphs(chunk)

# Consistent embedding model
embeddings = SentenceTransformer('all-MiniLM-L6-v2').encode(chunks)
```

### Metadata Schema
```json
{
    "file_path": "ADRs/001-service-owned-deployment-modules.md",
    "file_name": "001-service-owned-deployment-modules.md",
    "doc_type": "ADR",
    "category": "architecture",
    "header": "Service-Owned Deployment Modules",
    "status": "Accepted",
    "date": "2025-09-21",
    "chunk_index": 0,
    "file_hash": "abc123..."
}
```

### Query Examples
```bash
# Search all documentation
./tools/rag-query.py "service deployment patterns"

# Filter by document type
./tools/rag-query.py "security protocols" --type SOP

# Generate context for AI prompts
./tools/rag-query.py "kubernetes architecture" --context

# Interactive mode
./tools/rag-query.py --interactive
```

## Benefits

### Immediate
1. **Semantic Discovery**: Find relevant ADRs by concept, not keywords
2. **Contextual Queries**: "How should I deploy a new service?" returns ADR-001
3. **Cross-Reference**: Discover related decisions across document types
4. **AI Enhancement**: Claude Code gets instant access to project knowledge

### Long-term
1. **Knowledge Evolution**: Track how architectural decisions change over time
2. **Compliance Checking**: Ensure new work follows established ADRs and SOPs
3. **Onboarding Acceleration**: New developers quickly understand context
4. **Decision Support**: Historical context for new architectural decisions

### Operational
1. **Zero Overhead**: RAG queries don't interrupt development workflow
2. **Always Fresh**: Git hooks can trigger re-ingestion on documentation changes
3. **Nix Integration**: All components built reproducibly with locked dependencies
4. **Kubernetes Native**: Scales with FLUO infrastructure

## Implementation Phases

### Phase 1: Core Infrastructure ✅ COMPLETED
- [x] Chroma component flake with Kubernetes manifests
- [x] Integration with FLUO infrastructure deployment
- [x] Document ingestion pipeline with semantic chunking
- [x] Query interface with CLI and library modes

### Phase 2: Integration & Automation (Next)
- [ ] Git hooks for automatic re-ingestion
- [ ] Nix apps for simplified usage (`nix run .#rag-query`)
- [ ] CLAUDE.md enhancement with RAG context examples
- [ ] CI/CD integration for documentation validation

### Phase 3: Advanced Features (Future)
- [ ] Relationship mapping between ADRs
- [ ] Change impact analysis
- [ ] Knowledge gap identification
- [ ] Integration with external documentation

## Risks and Mitigations

### Risk: Stale Documentation
**Mitigation**: Git hooks trigger re-ingestion on markdown file changes. File hash tracking detects modifications.

### Risk: Embedding Model Drift
**Mitigation**: Pin exact model version in requirements. Include model validation in ingestion pipeline.

### Risk: Storage Growth
**Mitigation**: 10GB initial allocation with monitoring. Implement cleanup for old document versions.

### Risk: Query Performance
**Mitigation**: Chroma optimized for fast similarity search. Index configuration tuned for FLUO dataset size.

## Consequences

### Positive
1. **Enhanced Developer Experience**: Instant access to relevant architectural context
2. **Improved Consistency**: Developers more likely to follow established patterns
3. **Better AI Assistance**: Claude Code can provide context-aware guidance
4. **Knowledge Preservation**: Institutional knowledge becomes searchable and discoverable
5. **Onboarding Efficiency**: New team members can quickly understand decisions

### Negative
1. **Additional Infrastructure**: Requires Chroma database deployment and maintenance
2. **Storage Requirements**: Vector embeddings require ~10GB storage initially
3. **Dependency Complexity**: Python requirements for RAG tools outside core Nix environment
4. **Sync Overhead**: Documentation changes need re-ingestion (automated via Git hooks)

### Neutral
1. **Query Learning Curve**: Team needs to learn semantic search vs keyword search
2. **Content Quality Dependency**: RAG effectiveness depends on documentation quality
3. **Model Updates**: Periodic updates to embedding models may require re-ingestion

## Compliance with Existing ADRs

- **ADR-001**: RAG system follows service-owned deployment pattern
- **ADR-002**: All components built with Nix flakes and locked dependencies
- **ADR-003**: Integrated into monorepo structure with component composition
- **ADR-004**: Kubernetes-native deployment with proper resource management
- **ADR-005**: Component-based infrastructure with reusable modules

## Usage Examples

### For Developers
```bash
# Find deployment guidance
./tools/rag-query.py "how to deploy new service" --type ADR

# Check security procedures
./tools/rag-query.py "security incident response" --type SOP

# Get project context for new component
./tools/rag-query.py "tanstack frontend architecture" --context
```

### For Claude Code
```python
from tools.rag_query import RAGQueryInterface

rag = RAGQueryInterface()
context = rag.get_relevant_context("kubernetes deployment patterns")
# Returns formatted context for prompt injection
```

### For CI/CD
```bash
# Validate new ADR doesn't conflict
./tools/rag-query.py "service deployment" --type ADR
# Manual review of related decisions before approval
```

## Monitoring and Maintenance

### Health Checks
- Chroma database connectivity and responsiveness
- Vector collection integrity and document count
- Query performance metrics and error rates

### Maintenance Tasks
- Monthly review of ingestion logs for failed documents
- Quarterly evaluation of query patterns and effectiveness
- Annual assessment of embedding model updates

### Success Metrics
- Developer usage frequency of RAG queries
- Reduction in architectural inconsistencies
- Faster onboarding time for new team members
- Claude Code context accuracy improvements

## References

- [Chroma Vector Database Documentation](https://docs.trychroma.com/)
- [Sentence Transformers Models](https://huggingface.co/sentence-transformers)
- [RAG Architecture Best Practices](https://platform.openai.com/docs/guides/retrieval-augmented-generation)
- [ADR-002: Nix Flakes as Build System Foundation](002-nix-flakes-build-system.md)
- [ADR-004: Kubernetes-Native Infrastructure Architecture](004-kubernetes-native-infrastructure.md)