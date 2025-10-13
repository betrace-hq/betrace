/**
 * DuckDB-backed vector store for RAG embeddings
 * Uses DuckDB's native ARRAY type for efficient vector storage
 */

import duckdb from 'duckdb';
import { join } from 'path';
import type { EmbeddedChunk } from './embeddings.js';
import { generateEmbedding, searchSimilarChunks } from './embeddings.js';
import { loadDocuments } from './chunker.js';

const DB_PATH = join(process.cwd(), '.rag-store.duckdb');

export class VectorStore {
  private db: duckdb.Database | null = null;
  private conn: duckdb.Connection | null = null;

  /**
   * Initialize DuckDB connection and schema
   */
  private async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db = new duckdb.Database(DB_PATH, (err) => {
        if (err) return reject(err);

        this.conn = this.db!.connect();
        this.conn.run(`
          CREATE TABLE IF NOT EXISTS embeddings (
            id VARCHAR PRIMARY KEY,
            file_path VARCHAR NOT NULL,
            content TEXT NOT NULL,
            section VARCHAR,
            line_start INTEGER,
            line_end INTEGER,
            embedding DOUBLE[768] NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `, (err) => {
          if (err) return reject(err);
          resolve();
        });
      });
    });
  }

  /**
   * Check if embeddings already exist in database
   */
  private async hasEmbeddings(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.conn!.all('SELECT COUNT(*) as count FROM embeddings', (err, rows: any[]) => {
        if (err) return reject(err);
        resolve(rows[0].count > 0);
      });
    });
  }

  /**
   * Insert embedded chunk into DuckDB
   */
  private async insertChunk(chunk: EmbeddedChunk): Promise<void> {
    return new Promise((resolve, reject) => {
      const stmt = this.conn!.prepare(`
        INSERT INTO embeddings (id, file_path, content, section, line_start, line_end, embedding)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        chunk.id,
        chunk.filePath,
        chunk.content,
        chunk.metadata.section || null,
        chunk.metadata.lineStart,
        chunk.metadata.lineEnd,
        chunk.embedding,
        (err) => {
          if (err) return reject(err);
          resolve();
        }
      );
    });
  }

  /**
   * Load all embeddings from DuckDB
   */
  private async loadAllChunks(): Promise<EmbeddedChunk[]> {
    return new Promise((resolve, reject) => {
      this.conn!.all('SELECT * FROM embeddings', (err, rows: any[]) => {
        if (err) return reject(err);

        const chunks: EmbeddedChunk[] = rows.map(row => ({
          id: row.id,
          filePath: row.file_path,
          content: row.content,
          metadata: {
            section: row.section,
            lineStart: row.line_start,
            lineEnd: row.line_end,
          },
          embedding: row.embedding,
        }));

        resolve(chunks);
      });
    });
  }

  /**
   * Load embeddings from DuckDB or generate new ones
   */
  async initialize(rootDir: string, includePaths: string[]): Promise<void> {
    console.log('[RAG] Initializing DuckDB vector store...');

    await this.connect();

    // Check if we already have embeddings
    const hasData = await this.hasEmbeddings();

    if (hasData) {
      console.log('[RAG] Loading embeddings from DuckDB...');
      const count = await this.size();
      console.log(`[RAG] Loaded ${count} embeddings from database`);
      return;
    }

    // Generate new embeddings
    console.log('[RAG] No embeddings found, generating new ones...');
    const documents = loadDocuments(rootDir, includePaths);

    console.log(`[RAG] Generating embeddings for ${documents.length} chunks...`);
    let processed = 0;

    for (const doc of documents) {
      const embedding = await generateEmbedding(doc.content);
      await this.insertChunk({
        ...doc,
        embedding,
      });

      processed++;
      if (processed % 10 === 0) {
        console.log(`[RAG]   Progress: ${processed}/${documents.length}`);
      }
    }

    console.log(`[RAG] Generated and stored ${documents.length} embeddings in DuckDB`);
  }

  /**
   * Search for relevant chunks using cosine similarity
   */
  async search(
    query: string,
    topK: number = 5
  ): Promise<Array<EmbeddedChunk & { similarity: number }>> {
    if (!this.conn) {
      throw new Error('Vector store not initialized');
    }

    // Load all chunks from DuckDB
    const chunks = await this.loadAllChunks();

    // Use existing search logic from embeddings.ts
    return searchSimilarChunks(query, chunks, topK);
  }

  /**
   * Get total number of chunks in database
   */
  async size(): Promise<number> {
    return new Promise((resolve, reject) => {
      this.conn!.all('SELECT COUNT(*) as count FROM embeddings', (err, rows: any[]) => {
        if (err) return reject(err);
        resolve(rows[0].count);
      });
    });
  }

  /**
   * Clear all embeddings from database
   */
  static clearCache(): void {
    const fs = require('fs');
    if (fs.existsSync(DB_PATH)) {
      fs.unlinkSync(DB_PATH);
      console.log('[RAG] DuckDB database cleared');
    }
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    return new Promise((resolve) => {
      if (this.db) {
        this.db.close(() => {
          console.log('[RAG] DuckDB connection closed');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}
