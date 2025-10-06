package main

import (
	"crypto/md5"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// Document represents a documentation file with metadata
type Document struct {
	FilePath    string            `json:"file_path"`
	FileName    string            `json:"file_name"`
	Directory   string            `json:"directory"`
	Content     string            `json:"content"`
	Size        int               `json:"size"`
	ModTime     time.Time         `json:"mod_time"`
	FileHash    string            `json:"file_hash"`
	DocType     string            `json:"doc_type"`
	Category    string            `json:"category"`
	Title       string            `json:"title,omitempty"`
	Status      string            `json:"status,omitempty"`
	Date        string            `json:"date,omitempty"`
	Metadata    map[string]string `json:"metadata"`
}

// DocumentScanner handles finding and processing documentation files
type DocumentScanner struct {
	basePath string
}

// NewDocumentScanner creates a new document scanner
func NewDocumentScanner(basePath string) *DocumentScanner {
	return &DocumentScanner{
		basePath: basePath,
	}
}

// FindDocuments discovers all relevant documentation files
func (ds *DocumentScanner) FindDocuments() ([]string, error) {
	var documents []string

	// Patterns to match
	patterns := []string{
		"ADRs/*.md",
		"SOPs/*.md",
		"*/CLAUDE.md",
		"README.md",
		"PRD.md",
	}

	for _, pattern := range patterns {
		fullPattern := filepath.Join(ds.basePath, pattern)
		matches, err := filepath.Glob(fullPattern)
		if err != nil {
			continue // Skip patterns that fail
		}

		for _, match := range matches {
			// Check if it's a regular file and not in excluded directories
			if info, err := os.Stat(match); err == nil && info.Mode().IsRegular() {
				if !ds.isExcluded(match) {
					documents = append(documents, match)
				}
			}
		}
	}

	// Also walk the directory tree for any missed files
	err := filepath.WalkDir(ds.basePath, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return nil // Continue on errors
		}

		if d.IsDir() {
			// Skip excluded directories
			if ds.isExcluded(path) {
				return fs.SkipDir
			}
			return nil
		}

		// Check for specific filenames
		name := d.Name()
		if name == "CLAUDE.md" || name == "README.md" || name == "PRD.md" {
			if !ds.contains(documents, path) {
				documents = append(documents, path)
			}
		}

		return nil
	})

	if err != nil {
		return nil, fmt.Errorf("failed to walk directory: %w", err)
	}

	return documents, nil
}

// ProcessDocument reads and processes a single document file
func (ds *DocumentScanner) ProcessDocument(filePath string) (*Document, error) {
	content, err := os.ReadFile(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to read file: %w", err)
	}

	contentStr := string(content)

	info, err := os.Stat(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to stat file: %w", err)
	}

	doc := &Document{
		FilePath:  filePath,
		FileName:  filepath.Base(filePath),
		Directory: filepath.Base(filepath.Dir(filePath)),
		Content:   contentStr,
		Size:      len(contentStr),
		ModTime:   info.ModTime(),
		FileHash:  fmt.Sprintf("%x", md5.Sum(content)),
		Metadata:  make(map[string]string),
	}

	// Extract document type and category
	ds.extractDocumentType(doc)

	// Extract metadata from content
	ds.extractContentMetadata(doc)

	return doc, nil
}

// extractDocumentType determines the document type based on path and filename
func (ds *DocumentScanner) extractDocumentType(doc *Document) {
	path := strings.ToLower(doc.FilePath)
	filename := strings.ToLower(doc.FileName)
	directory := strings.ToLower(doc.Directory)

	switch {
	case strings.Contains(path, "adrs/") || directory == "adrs":
		doc.DocType = "ADR"
		doc.Category = "architecture"
	case strings.Contains(path, "sops/") || directory == "sops":
		doc.DocType = "SOP"
		doc.Category = "operations"
	case filename == "claude.md":
		doc.DocType = "CLAUDE"
		doc.Category = "context"
	case filename == "readme.md":
		doc.DocType = "README"
		doc.Category = "documentation"
	case filename == "prd.md":
		doc.DocType = "PRD"
		doc.Category = "requirements"
	default:
		doc.DocType = "OTHER"
		doc.Category = "documentation"
	}
}

// extractContentMetadata extracts title, status, and other metadata from content
func (ds *DocumentScanner) extractContentMetadata(doc *Document) {
	lines := strings.Split(doc.Content, "\n")

	// Look at first 20 lines for metadata
	for i, line := range lines {
		if i >= 20 {
			break
		}

		line = strings.TrimSpace(line)

		// Extract title from first # header
		if doc.Title == "" && strings.HasPrefix(line, "# ") {
			doc.Title = strings.TrimSpace(strings.TrimPrefix(line, "# "))
		}

		// Extract status
		if strings.Contains(line, "**Status:**") {
			parts := strings.Split(line, "**Status:**")
			if len(parts) > 1 {
				doc.Status = strings.TrimSpace(parts[1])
			}
		}

		// Extract date
		if strings.Contains(line, "**Date:**") {
			parts := strings.Split(line, "**Date:**")
			if len(parts) > 1 {
				doc.Date = strings.TrimSpace(parts[1])
			}
		}
	}

	// If no title found, use filename without extension
	if doc.Title == "" {
		ext := filepath.Ext(doc.FileName)
		doc.Title = strings.TrimSuffix(doc.FileName, ext)
	}
}

// isExcluded checks if a path should be excluded
func (ds *DocumentScanner) isExcluded(path string) bool {
	excludePatterns := []string{
		"node_modules",
		".git",
		"dist",
		"build",
		"target",
		".nix-profile",
		"result",
		"venv",
		"__pycache__",
	}

	pathLower := strings.ToLower(path)
	for _, pattern := range excludePatterns {
		if strings.Contains(pathLower, pattern) {
			return true
		}
	}

	return false
}

// contains checks if a string slice contains a specific string
func (ds *DocumentScanner) contains(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}