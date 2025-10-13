/**
 * In-memory vector store with persistence
 * Saves embeddings to disk to avoid re-processing
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { EmbeddedChunk } from './embeddings.js';
import { generateEmbedding, searchSimilarChunks } from './embeddings.js';
import { loadDocuments } from './chunker.js';

const CACHE_PATH = join(process.cwd(), '.rag-cache.json');

export class VectorStore {
  private chunks: EmbeddedChunk[] = [];

  /**
   * Load embeddings from cache or generate new ones
   */
  async initialize(rootDir: string, includePaths: string[]): Promise<void> {
    console.log('[RAG] Initializing vector store...');

    // Try to load from cache
    if (existsSync(CACHE_PATH)) {
      console.log('[RAG] Loading embeddings from cache...');
      try {
        const cached = JSON.parse(readFileSync(CACHE_PATH, 'utf-8'));
        this.chunks = cached.chunks;
        console.log(`[RAG] Loaded ${this.chunks.length} cached embeddings`);
        return;
      } catch (error) {
        console.log('[RAG] Cache invalid, regenerating...');
      }
    }

    // Generate new embeddings
    console.log('[RAG] No cache found, generating embeddings...');
    const documents = loadDocuments(rootDir, includePaths);

    console.log(`[RAG] Generating embeddings for ${documents.length} chunks...`);
    let processed = 0;

    for (const doc of documents) {
      const embedding = await generateEmbedding(doc.content);
      this.chunks.push({
        ...doc,
        embedding,
      });

      processed++;
      if (processed % 10 === 0) {
        console.log(`[RAG]   Progress: ${processed}/${documents.length}`);
      }
    }

    console.log(`[RAG] Generated ${this.chunks.length} embeddings`);

    // Save to cache
    console.log('[RAG] Saving embeddings to cache...');
    writeFileSync(
      CACHE_PATH,
      JSON.stringify({
        version: 1,
        generatedAt: new Date().toISOString(),
        chunks: this.chunks,
      }, null, 2)
    );
    console.log('[RAG] Cache saved');
  }

  /**
   * Search for relevant chunks
   */
  async search(
    query: string,
    topK: number = 5
  ): Promise<Array<EmbeddedChunk & { similarity: number }>> {
    if (this.chunks.length === 0) {
      throw new Error('Vector store not initialized');
    }

    return searchSimilarChunks(query, this.chunks, topK);
  }

  /**
   * Get total number of chunks
   */
  size(): number {
    return this.chunks.length;
  }

  /**
   * Clear cache
   */
  static clearCache(): void {
    if (existsSync(CACHE_PATH)) {
      writeFileSync(CACHE_PATH, '');
      console.log('[RAG] Cache cleared');
    }
  }
}
