package storage

import "os"

// FileSystem is an abstraction over OS filesystem operations
// This allows mocking for tests without actual disk I/O
type FileSystem interface {
	ReadFile(path string) ([]byte, error)
	WriteFile(path string, data []byte, perm os.FileMode) error
	Rename(oldpath, newpath string) error
	MkdirAll(path string, perm os.FileMode) error
	Remove(path string) error
	Stat(path string) (os.FileInfo, error)
}

// RealFileSystem implements FileSystem using actual OS calls
type RealFileSystem struct{}

func (fs *RealFileSystem) ReadFile(path string) ([]byte, error) {
	return os.ReadFile(path)
}

func (fs *RealFileSystem) WriteFile(path string, data []byte, perm os.FileMode) error {
	return os.WriteFile(path, data, perm)
}

func (fs *RealFileSystem) Rename(oldpath, newpath string) error {
	return os.Rename(oldpath, newpath)
}

func (fs *RealFileSystem) MkdirAll(path string, perm os.FileMode) error {
	return os.MkdirAll(path, perm)
}

func (fs *RealFileSystem) Remove(path string) error {
	return os.Remove(path)
}

func (fs *RealFileSystem) Stat(path string) (os.FileInfo, error) {
	return os.Stat(path)
}
