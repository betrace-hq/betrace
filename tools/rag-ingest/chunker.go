package main

import (
	"crypto/md5"
	"fmt"
	"regexp"
	"strings"
)

// Chunk represents a semantic chunk of a document
type Chunk struct {
	ID       string            `json:"id"`
	Content  string            `json:"content"`
	Header   string            `json:"header"`
	Index    int               `json:"chunk_index"`
	Metadata map[string]string `json:"metadata"`
}

// Chunker handles splitting documents into semantic chunks
type Chunker struct {
	maxChunkSize int
	minChunkSize int
}

// NewChunker creates a new document chunker
func NewChunker() *Chunker {
	return &Chunker{
		maxChunkSize: 1500, // Maximum characters per chunk
		minChunkSize: 50,   // Minimum characters per chunk
	}
}

// ChunkDocument splits a document into semantic chunks
func (c *Chunker) ChunkDocument(doc *Document) []*Chunk {
	var chunks []*Chunk

	// Split by headers first
	sections := c.splitByHeaders(doc.Content)

	currentChunk := ""
	currentHeader := doc.Title
	if currentHeader == "" {
		currentHeader = "Introduction"
	}

	for _, section := range sections {
		// Check if this section is a header
		if c.isHeader(section.content) {
			// Save previous chunk if substantial
			if strings.TrimSpace(currentChunk) != "" && len(strings.TrimSpace(currentChunk)) > c.minChunkSize {
				chunk := c.createChunk(doc, currentChunk, currentHeader, len(chunks))
				chunks = append(chunks, chunk)
			}

			// Start new chunk
			currentHeader = strings.TrimSpace(section.content)
			currentChunk = section.content + "\n"
		} else {
			currentChunk += section.content

			// If chunk gets too long, split it
			if len(currentChunk) > c.maxChunkSize {
				splitChunks := c.splitLongChunk(doc, currentChunk, currentHeader, len(chunks))
				chunks = append(chunks, splitChunks...)

				// Keep remainder for next chunk
				if len(splitChunks) > 0 {
					// Start with header and any remaining content
					currentChunk = currentHeader + "\n"
				}
			}
		}
	}

	// Add final chunk
	if strings.TrimSpace(currentChunk) != "" && len(strings.TrimSpace(currentChunk)) > c.minChunkSize {
		chunk := c.createChunk(doc, currentChunk, currentHeader, len(chunks))
		chunks = append(chunks, chunk)
	}

	// If no chunks were created, create one from the whole content
	if len(chunks) == 0 && strings.TrimSpace(doc.Content) != "" {
		content := doc.Content
		if len(content) > 2000 {
			content = content[:2000] // Limit to reasonable size
		}
		chunk := c.createChunk(doc, content, doc.Title, 0)
		chunks = append(chunks, chunk)
	}

	return chunks
}

// section represents a content section
type section struct {
	content string
	isHeader bool
}

// splitByHeaders splits content by markdown headers
func (c *Chunker) splitByHeaders(content string) []section {
	// Regex to match markdown headers (# ## ### etc.)
	headerRegex := regexp.MustCompile(`\n(#{1,6}\s+.+)\n`)

	// Split content while preserving headers
	parts := headerRegex.Split(content, -1)
	headers := headerRegex.FindAllString(content, -1)

	var sections []section

	for i, part := range parts {
		if part != "" {
			sections = append(sections, section{
				content: part,
				isHeader: false,
			})
		}

		// Add corresponding header if exists
		if i < len(headers) {
			headerContent := strings.Trim(headers[i], "\n")
			sections = append(sections, section{
				content: headerContent,
				isHeader: true,
			})
		}
	}

	return sections
}

// isHeader checks if content is a markdown header
func (c *Chunker) isHeader(content string) bool {
	trimmed := strings.TrimSpace(content)
	return regexp.MustCompile(`^#{1,6}\s+`).MatchString(trimmed)
}

// splitLongChunk splits a chunk that's too long into smaller chunks
func (c *Chunker) splitLongChunk(doc *Document, content, header string, startIndex int) []*Chunk {
	var chunks []*Chunk

	// Split by paragraphs first
	paragraphs := strings.Split(content, "\n\n")

	currentChunk := header + "\n"
	chunkIndex := startIndex

	for i, paragraph := range paragraphs {
		// Skip the header if it's the first paragraph
		if i == 0 && c.isHeader(paragraph) {
			continue
		}

		testChunk := currentChunk + paragraph + "\n\n"

		// If adding this paragraph would make it too long
		if len(testChunk) > c.maxChunkSize && len(currentChunk) > len(header)+10 {
			// Save current chunk
			chunk := c.createChunk(doc, strings.TrimSpace(currentChunk), header, chunkIndex)
			chunks = append(chunks, chunk)

			// Start new chunk with header
			currentChunk = header + "\n" + paragraph + "\n\n"
			chunkIndex++
		} else {
			currentChunk = testChunk
		}
	}

	// Add final chunk if it has substantial content
	if len(strings.TrimSpace(currentChunk)) > len(header)+c.minChunkSize {
		chunk := c.createChunk(doc, strings.TrimSpace(currentChunk), header, chunkIndex)
		chunks = append(chunks, chunk)
	}

	return chunks
}

// createChunk creates a new chunk with metadata
func (c *Chunker) createChunk(doc *Document, content, header string, index int) *Chunk {
	// Generate unique ID
	contentHash := fmt.Sprintf("%x", md5.Sum([]byte(content)))[:8]
	id := fmt.Sprintf("%s_%d_%s", doc.FileName, index, contentHash)

	// Create metadata map
	metadata := map[string]string{
		"file_path":    doc.FilePath,
		"file_name":    doc.FileName,
		"directory":    doc.Directory,
		"doc_type":     doc.DocType,
		"category":     doc.Category,
		"header":       header,
		"chunk_index":  fmt.Sprintf("%d", index),
		"size":         fmt.Sprintf("%d", doc.Size),
		"file_hash":    doc.FileHash,
		"mod_time":     doc.ModTime.Format("2006-01-02T15:04:05Z"),
	}

	// Add optional fields
	if doc.Title != "" {
		metadata["title"] = doc.Title
	}
	if doc.Status != "" {
		metadata["status"] = doc.Status
	}
	if doc.Date != "" {
		metadata["date"] = doc.Date
	}

	return &Chunk{
		ID:       id,
		Content:  strings.TrimSpace(content),
		Header:   header,
		Index:    index,
		Metadata: metadata,
	}
}