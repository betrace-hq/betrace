package middleware

import (
	"fmt"
	"net/http"
)

// BodyLimitMiddleware limits the size of request bodies
// Uses http.MaxBytesReader which is the stdlib-recommended way
// to prevent clients from sending arbitrarily large requests
func BodyLimitMiddleware(maxBytes int64) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Skip for GET, HEAD, OPTIONS (no body expected)
			if r.Method == http.MethodGet || r.Method == http.MethodHead || r.Method == http.MethodOptions {
				next.ServeHTTP(w, r)
				return
			}

			// Limit body size using stdlib MaxBytesReader
			// This is vendor-provided functionality - we just configure the limit
			r.Body = http.MaxBytesReader(w, r.Body, maxBytes)

			next.ServeHTTP(w, r)
		})
	}
}

// respondError sends a JSON error response
func respondError(w http.ResponseWriter, message string, status int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	fmt.Fprintf(w, `{"error": "%s", "code": "%s"}`, message, http.StatusText(status))
}
