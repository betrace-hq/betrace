import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

export interface KnowledgeBaseEntry {
  filename: string;
  content: string;
  relevanceScore: number;
}

/**
 * Search knowledge base for relevant documentation
 * Returns documents ranked by keyword relevance
 */
export async function searchKnowledgeBase(
  query: string
): Promise<KnowledgeBaseEntry[]> {
  const knowledgeBasePath = join(__dirname, '../../knowledge-base');

  console.log(`[KnowledgeBase] Searching for: "${query}"`);

  // Read all markdown files in knowledge-base/
  const files = readdirSync(knowledgeBasePath).filter((f) =>
    f.endsWith('.md')
  );

  const entries: KnowledgeBaseEntry[] = files.map((filename) => {
    const filepath = join(knowledgeBasePath, filename);
    const content = readFileSync(filepath, 'utf-8');

    // Simple relevance scoring based on keyword matches
    const relevanceScore = calculateRelevance(query, content);

    return {
      filename,
      content,
      relevanceScore,
    };
  });

  // Sort by relevance score (highest first)
  const sortedEntries = entries.sort(
    (a, b) => b.relevanceScore - a.relevanceScore
  );

  console.log(`[KnowledgeBase] Found ${sortedEntries.length} documents:`);
  sortedEntries.forEach((entry) => {
    console.log(
      `  - ${entry.filename}: relevance ${entry.relevanceScore.toFixed(2)}`
    );
  });

  return sortedEntries;
}

/**
 * Calculate relevance score based on keyword matches
 * Simple TF-IDF-like scoring
 */
function calculateRelevance(query: string, content: string): number {
  const queryLower = query.toLowerCase();
  const contentLower = content.toLowerCase();

  // Extract keywords from query (simple tokenization)
  const keywords = queryLower.split(/\s+/).filter((word) => word.length > 3);

  let score = 0;

  for (const keyword of keywords) {
    // Count occurrences of each keyword
    const regex = new RegExp(keyword, 'gi');
    const matches = contentLower.match(regex);
    if (matches) {
      score += matches.length;
    }
  }

  return score;
}

/**
 * Get top N most relevant documents
 */
export async function getRelevantDocs(
  query: string,
  topN: number = 2
): Promise<string> {
  const results = await searchKnowledgeBase(query);
  const topDocs = results.slice(0, topN);

  // Combine top documents into a single context string
  const context = topDocs
    .map(
      (doc) =>
        `--- ${doc.filename} (relevance: ${doc.relevanceScore.toFixed(2)}) ---\n${doc.content}`
    )
    .join('\n\n');

  return context;
}
