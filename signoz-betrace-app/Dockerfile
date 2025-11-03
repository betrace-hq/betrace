# BeTrace SigNoz App Dockerfile
# Multi-stage build for minimal production image

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /build

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the app
RUN npm run build

# Stage 2: Runtime (Nginx)
FROM nginx:alpine

WORKDIR /usr/share/nginx/html

# Remove default nginx static files
RUN rm -rf /usr/share/nginx/html/*

# Copy built app from builder
COPY --from=builder /build/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001/ || exit 1

# Run nginx
CMD ["nginx", "-g", "daemon off;"]
