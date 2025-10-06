package main

import (
	"fmt"
	"log"
	"os"

	"github.com/spf13/cobra"
)

var (
	basePath     string
	chromaHost   string
	chromaPort   int
	collection   string
	forceUpdate  bool
	testQuery    string
)

var rootCmd = &cobra.Command{
	Use:   "rag-ingest",
	Short: "FLUO RAG Documentation Ingestion Tool",
	Long: `A Go-based tool to ingest FLUO documentation into Chroma vector database.

Scans for ADRs, SOPs, CLAUDE.md files and other documentation,
processes them into semantic chunks, and stores them in Chroma
for retrieval-augmented generation (RAG) queries.`,
	Run: func(cmd *cobra.Command, args []string) {
		if err := runIngestion(); err != nil {
			log.Fatalf("❌ Ingestion failed: %v", err)
		}
	},
}

func init() {
	rootCmd.Flags().StringVar(&basePath, "base-path", ".", "Base path to search for documents")
	rootCmd.Flags().StringVar(&chromaHost, "chroma-host", "localhost", "Chroma server host")
	rootCmd.Flags().IntVar(&chromaPort, "chroma-port", 8000, "Chroma server port")
	rootCmd.Flags().StringVar(&collection, "collection", "fluo_docs", "Chroma collection name")
	rootCmd.Flags().BoolVar(&forceUpdate, "force-update", false, "Clear existing collection and re-ingest")
	rootCmd.Flags().StringVar(&testQuery, "test-query", "", "Test query after ingestion")
}

func runIngestion() error {
	fmt.Println("🤖 FLUO RAG Documentation Ingestion")
	fmt.Println("===================================")
	fmt.Println()

	// Initialize Chroma client
	client := NewChromaClient(chromaHost, chromaPort)

	// Test connection
	if err := client.TestConnection(); err != nil {
		return fmt.Errorf("failed to connect to Chroma: %w", err)
	}
	fmt.Printf("✅ Connected to Chroma at %s:%d\n", chromaHost, chromaPort)

	// Create or get collection
	collectionID, err := client.EnsureCollection(collection, forceUpdate)
	if err != nil {
		return fmt.Errorf("failed to ensure collection: %w", err)
	}
	fmt.Printf("✅ Using collection: %s (%s)\n", collection, collectionID)

	// Discover documents
	scanner := NewDocumentScanner(basePath)
	documents, err := scanner.FindDocuments()
	if err != nil {
		return fmt.Errorf("failed to find documents: %w", err)
	}
	fmt.Printf("📁 Found %d documentation files\n", len(documents))

	// Process and ingest documents
	totalChunks := 0
	failedFiles := 0

	for _, docPath := range documents {
		fmt.Printf("📄 Processing %s...\n", docPath)

		doc, err := scanner.ProcessDocument(docPath)
		if err != nil {
			fmt.Printf("❌ Failed to process %s: %v\n", docPath, err)
			failedFiles++
			continue
		}

		chunker := NewChunker()
		chunks := chunker.ChunkDocument(doc)

		if len(chunks) == 0 {
			fmt.Printf("⚠️ No chunks created for %s\n", docPath)
			failedFiles++
			continue
		}

		if err := client.IngestChunks(collectionID, chunks); err != nil {
			fmt.Printf("❌ Failed to ingest %s: %v\n", docPath, err)
			failedFiles++
			continue
		}

		fmt.Printf("✅ Ingested %d chunks from %s\n", len(chunks), docPath)
		totalChunks += len(chunks)
	}

	fmt.Printf("\n📊 Ingestion complete: %d chunks from %d files\n", totalChunks, len(documents))
	if failedFiles > 0 {
		fmt.Printf("⚠️ %d files failed to ingest\n", failedFiles)
	}

	// Test query if provided
	if testQuery != "" {
		fmt.Printf("\n🔍 Testing query: '%s'\n", testQuery)
		results, err := client.QueryCollection(collectionID, testQuery, 3)
		if err != nil {
			return fmt.Errorf("test query failed: %w", err)
		}

		if len(results) > 0 {
			fmt.Printf("\n📋 Top %d results:\n", len(results))
			for i, result := range results {
				fmt.Printf("\n%d. %s: %s\n", i+1, result.Metadata["doc_type"], result.Metadata["file_name"])
				fmt.Printf("   Header: %s\n", result.Metadata["header"])
				fmt.Printf("   Content: %.200s...\n", result.Content)
			}
		} else {
			fmt.Println("❌ No results found")
		}
	}

	fmt.Printf("\n🎉 RAG system filled successfully!\n")
	fmt.Printf("📚 %d chunks available for semantic search\n", totalChunks)

	return nil
}

func main() {
	if err := rootCmd.Execute(); err != nil {
		os.Exit(1)
	}
}