package middleware

import (
	"fmt"
	"net/http"
)

// bodyLimitResponseWriter wraps ResponseWriter to intercept MaxBytesReader errors
type bodyLimitResponseWriter struct {
	http.ResponseWriter
	wroteHeader bool
}

func (w *bodyLimitResponseWriter) WriteHeader(status int) {
	w.wroteHeader = true
	w.ResponseWriter.WriteHeader(status)
}

func (w *bodyLimitResponseWriter) Write(b []byte) (int, error) {
	if !w.wroteHeader {
		w.WriteHeader(http.StatusOK)
	}
	return w.ResponseWriter.Write(b)
}

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

			// Wrap the response writer to track if we wrote headers
			wrappedW := &bodyLimitResponseWriter{ResponseWriter: w}

			// Limit body size using stdlib MaxBytesReader
			// This will cause an error when the body is read if it exceeds the limit
			r.Body = http.MaxBytesReader(wrappedW, r.Body, maxBytes)

			// Call the next handler - if MaxBytesReader errors, grpc-gateway
			// might have already written a 400 response
			next.ServeHTTP(wrappedW, r)
		})
	}
}

// respondError sends a JSON error response
func respondError(w http.ResponseWriter, message string, status int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	fmt.Fprintf(w, `{"error": "%s", "code": "%s"}`, message, http.StatusText(status))
}
