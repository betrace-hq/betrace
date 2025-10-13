/**
 * RAG System with Ollama Embeddings
 * Uses nomic-embed-text for semantic document search
 */

const OLLAMA_API_URL = process.env.OLLAMA_API_URL || 'http://localhost:11434';
const EMBEDDING_MODEL = 'nomic-embed-text'; // 768-dimensional embeddings

export interface DocumentChunk {
  id: string;
  filePath: string;
  content: string;
  metadata: {
    section?: string;
    lineStart: number;
    lineEnd: number;
  };
}

export interface EmbeddedChunk extends DocumentChunk {
  embedding: number[];
}

/**
 * Generate embedding for text using Ollama
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch(`${OLLAMA_API_URL}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      prompt: text,
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama embeddings API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.embedding;
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Find top-k most similar chunks to a query
 */
export async function searchSimilarChunks(
  query: string,
  chunks: EmbeddedChunk[],
  topK: number = 5
): Promise<Array<EmbeddedChunk & { similarity: number }>> {
  console.log(`[RAG] Generating query embedding for: "${query.substring(0, 50)}..."`);
  const queryEmbedding = await generateEmbedding(query);

  console.log(`[RAG] Searching ${chunks.length} chunks for similar content...`);
  const results = chunks.map((chunk) => ({
    ...chunk,
    similarity: cosineSimilarity(queryEmbedding, chunk.embedding),
  }));

  // Sort by similarity (highest first)
  results.sort((a, b) => b.similarity - a.similarity);

  const topResults = results.slice(0, topK);
  console.log(`[RAG] Top ${topK} results:`);
  topResults.forEach((result, i) => {
    console.log(`  ${i + 1}. ${result.filePath} (similarity: ${result.similarity.toFixed(3)})`);
  });

  return topResults;
}
