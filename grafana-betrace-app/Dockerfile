# BeTrace Grafana Plugin Dockerfile
# Build and package the Grafana plugin

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /build

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the plugin
RUN npm run build

# Stage 2: Package
FROM alpine:latest

WORKDIR /plugin

# Copy built plugin
COPY --from=builder /build/dist /plugin

# Create metadata
RUN echo "BeTrace Grafana Plugin v1.0.0" > /plugin/VERSION

# The plugin directory can be mounted as a volume to Grafana
# Usage: docker run -v ./betrace-plugin:/var/lib/grafana/plugins/betrace grafana/grafana

CMD ["sh", "-c", "echo 'BeTrace Grafana Plugin ready. Mount this directory to Grafana plugins.'"]
