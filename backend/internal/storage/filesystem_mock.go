package storage

import (
	"os"
	"sync"
	"time"
)

// MockFileSystem implements FileSystem for testing without disk I/O
type MockFileSystem struct {
	mu    sync.RWMutex
	files map[string][]byte
	dirs  map[string]bool

	// Track operations for assertions
	WriteCalls  int
	ReadCalls   int
	RenameCalls int

	// Inject errors for failure testing
	WriteError  error
	ReadError   error
	RenameError error
}

// NewMockFileSystem creates an in-memory filesystem for testing
func NewMockFileSystem() *MockFileSystem {
	return &MockFileSystem{
		files: make(map[string][]byte),
		dirs:  make(map[string]bool),
	}
}

func (fs *MockFileSystem) ReadFile(path string) ([]byte, error) {
	fs.mu.RLock()
	defer fs.mu.RUnlock()

	fs.ReadCalls++

	if fs.ReadError != nil {
		return nil, fs.ReadError
	}

	data, exists := fs.files[path]
	if !exists {
		return nil, os.ErrNotExist
	}

	// Return copy to prevent mutation
	result := make([]byte, len(data))
	copy(result, data)
	return result, nil
}

func (fs *MockFileSystem) WriteFile(path string, data []byte, perm os.FileMode) error {
	fs.mu.Lock()
	defer fs.mu.Unlock()

	fs.WriteCalls++

	if fs.WriteError != nil {
		return fs.WriteError
	}

	// Store copy to prevent mutation
	stored := make([]byte, len(data))
	copy(stored, data)
	fs.files[path] = stored

	return nil
}

func (fs *MockFileSystem) Rename(oldpath, newpath string) error {
	fs.mu.Lock()
	defer fs.mu.Unlock()

	fs.RenameCalls++

	if fs.RenameError != nil {
		return fs.RenameError
	}

	data, exists := fs.files[oldpath]
	if !exists {
		return os.ErrNotExist
	}

	fs.files[newpath] = data
	delete(fs.files, oldpath)

	return nil
}

func (fs *MockFileSystem) MkdirAll(path string, perm os.FileMode) error {
	fs.mu.Lock()
	defer fs.mu.Unlock()

	fs.dirs[path] = true
	return nil
}

func (fs *MockFileSystem) Remove(path string) error {
	fs.mu.Lock()
	defer fs.mu.Unlock()

	delete(fs.files, path)
	return nil
}

func (fs *MockFileSystem) Stat(path string) (os.FileInfo, error) {
	fs.mu.RLock()
	defer fs.mu.RUnlock()

	if _, exists := fs.files[path]; exists {
		return &mockFileInfo{name: path, size: int64(len(fs.files[path]))}, nil
	}

	if _, exists := fs.dirs[path]; exists {
		return &mockFileInfo{name: path, isDir: true}, nil
	}

	return nil, os.ErrNotExist
}

// GetFile returns the contents of a file (for test assertions)
func (fs *MockFileSystem) GetFile(path string) ([]byte, bool) {
	fs.mu.RLock()
	defer fs.mu.RUnlock()

	data, exists := fs.files[path]
	if !exists {
		return nil, false
	}

	result := make([]byte, len(data))
	copy(result, data)
	return result, true
}

// FileExists checks if a file exists (for test assertions)
func (fs *MockFileSystem) FileExists(path string) bool {
	fs.mu.RLock()
	defer fs.mu.RUnlock()

	_, exists := fs.files[path]
	return exists
}

// mockFileInfo implements os.FileInfo for testing
type mockFileInfo struct {
	name  string
	size  int64
	isDir bool
}

func (fi *mockFileInfo) Name() string       { return fi.name }
func (fi *mockFileInfo) Size() int64        { return fi.size }
func (fi *mockFileInfo) Mode() os.FileMode  { return 0644 }
func (fi *mockFileInfo) ModTime() time.Time { return time.Now() }
func (fi *mockFileInfo) IsDir() bool        { return fi.isDir }
func (fi *mockFileInfo) Sys() interface{}   { return nil }
