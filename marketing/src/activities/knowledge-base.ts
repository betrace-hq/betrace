/**
 * RAG-based knowledge base using Ollama embeddings
 * Replaces keyword matching with semantic search
 */

import { VectorStore } from '../rag/vector-store.js';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Singleton vector store instance
let vectorStore: VectorStore | null = null;

/**
 * Initialize the vector store (call once on worker startup)
 */
export async function initializeKnowledgeBase(): Promise<void> {
  if (vectorStore) {
    console.log('[KnowledgeBase] Already initialized');
    return;
  }

  console.log('[KnowledgeBase] Initializing RAG system...');

  vectorStore = new VectorStore();

  // Index essential FLUO docs: top-level + ADRs + technical (skip PRDs)
  // From marketing/src/activities, go up to fluo root: ../../../
  const rootDir = join(__dirname, '../../..');
  const includePaths = [
    'docs',           // Top-level: README.md, compliance.md, etc.
    'docs/adrs',      // Architecture Decision Records
    'docs/technical', // Technical docs (especially trace-rules-dsl.md)
  ];

  console.log(`[KnowledgeBase] Indexing FLUO docs from: ${rootDir}`);
  await vectorStore.initialize(rootDir, includePaths);

  const size = await vectorStore.size();
  console.log(`[KnowledgeBase] RAG system ready with ${size} document chunks`);
}

/**
 * Search knowledge base using semantic similarity
 * Returns top-k most relevant document chunks
 */
export async function searchKnowledgeBase(
  query: string,
  topK: number = 5
): Promise<Array<{ filePath: string; content: string; similarity: number }>> {
  if (!vectorStore) {
    throw new Error('Knowledge base not initialized. Call initializeKnowledgeBase() first.');
  }

  console.log(`[KnowledgeBase] Semantic search for: "${query}"`);

  const results = await vectorStore.search(query, topK);

  console.log(`[KnowledgeBase] Found ${results.length} relevant chunks:`);
  results.forEach((result, i) => {
    console.log(`  ${i + 1}. ${result.filePath} (similarity: ${result.similarity.toFixed(3)})`);
  });

  return results.map(r => ({
    filePath: r.filePath,
    content: r.content,
    similarity: r.similarity,
  }));
}

/**
 * Get top N most relevant documents formatted for LLM context
 */
export async function getRelevantDocs(
  query: string,
  topN: number = 5
): Promise<string> {
  const results = await searchKnowledgeBase(query, topN);

  // Format as context for LLM prompt
  const context = results
    .map(
      (doc, i) =>
        `--- Document ${i + 1}: ${doc.filePath} (similarity: ${doc.similarity.toFixed(3)}) ---\n${doc.content}`
    )
    .join('\n\n');

  console.log(`[KnowledgeBase] Generated ${context.length} chars of context`);
  return context;
}

/**
 * Clear cached embeddings (for testing/debugging)
 */
export function clearCache(): void {
  VectorStore.clearCache();
  vectorStore = null;
  console.log('[KnowledgeBase] Cache cleared, vector store reset');
}
