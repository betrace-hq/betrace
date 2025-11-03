# BeTrace Backend Dockerfile
# Multi-stage build for minimal production image

# Stage 1: Build
FROM golang:1.23-alpine AS builder

WORKDIR /build

# Install build dependencies
RUN apk add --no-cache git ca-certificates tzdata

# Copy go mod files
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build the binary
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -ldflags="-w -s -X main.version=1.0.0 -X main.commit=$(git rev-parse --short HEAD 2>/dev/null || echo 'docker')" \
    -o betrace-backend \
    ./cmd/betrace-backend

# Stage 2: Runtime
FROM alpine:latest

WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache ca-certificates tzdata

# Create non-root user
RUN addgroup -g 1000 betrace && \
    adduser -D -u 1000 -G betrace betrace

# Copy binary from builder
COPY --from=builder /build/betrace-backend /app/betrace-backend

# Create data directory
RUN mkdir -p /app/data && chown -R betrace:betrace /app

# Switch to non-root user
USER betrace

# Expose ports
EXPOSE 12011 12012

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD ["/app/betrace-backend", "--health-check"] || exit 1

# Environment variables
ENV BETRACE_PORT_GRPC=12012 \
    BETRACE_PORT_BACKEND=12011 \
    BETRACE_DATA_DIR=/app/data

# Run the binary
ENTRYPOINT ["/app/betrace-backend"]
