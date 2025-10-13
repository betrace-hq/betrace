/**
 * Markdown-aware document chunking
 * Chunks documents by sections (headings) and code blocks
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import type { DocumentChunk } from './embeddings.js';

/**
 * Recursively find all markdown files in a directory
 */
export function findMarkdownFiles(dir: string): string[] {
  const files: string[] = [];

  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...findMarkdownFiles(fullPath));
    } else if (entry.endsWith('.md')) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Chunk a markdown document by sections (headings)
 */
export function chunkMarkdownBySections(
  content: string,
  filePath: string
): DocumentChunk[] {
  const lines = content.split('\n');
  const chunks: DocumentChunk[] = [];

  let currentSection = '';
  let currentContent: string[] = [];
  let sectionStartLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect heading (# ## ### etc)
    if (line.match(/^#{1,6}\s+/)) {
      // Save previous section if it exists
      if (currentContent.length > 0) {
        chunks.push({
          id: `${filePath}:${sectionStartLine}-${i - 1}`,
          filePath,
          content: currentContent.join('\n').trim(),
          metadata: {
            section: currentSection,
            lineStart: sectionStartLine,
            lineEnd: i - 1,
          },
        });
      }

      // Start new section
      currentSection = line.replace(/^#+\s+/, '').trim();
      currentContent = [line];
      sectionStartLine = i;
    } else {
      currentContent.push(line);
    }
  }

  // Save last section
  if (currentContent.length > 0) {
    chunks.push({
      id: `${filePath}:${sectionStartLine}-${lines.length - 1}`,
      filePath,
      content: currentContent.join('\n').trim(),
      metadata: {
        section: currentSection,
        lineStart: sectionStartLine,
        lineEnd: lines.length - 1,
      },
    });
  }

  return chunks;
}

/**
 * Load and chunk all markdown files from specified directories
 */
export function loadDocuments(rootDir: string, includePaths: string[]): DocumentChunk[] {
  console.log(`[RAG] Loading documents from ${rootDir}...`);

  const allChunks: DocumentChunk[] = [];

  for (const includePath of includePaths) {
    const fullPath = join(rootDir, includePath);
    console.log(`[RAG]   Scanning ${includePath}...`);

    try {
      const files = findMarkdownFiles(fullPath);
      console.log(`[RAG]     Found ${files.length} markdown files`);

      for (const file of files) {
        const content = readFileSync(file, 'utf-8');
        const chunks = chunkMarkdownBySections(content, file);
        allChunks.push(...chunks);
      }
    } catch (error) {
      console.error(`[RAG]     Error loading ${includePath}:`, error);
    }
  }

  console.log(`[RAG] Total chunks created: ${allChunks.length}`);
  return allChunks;
}
