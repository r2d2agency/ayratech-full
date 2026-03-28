# Stage 1: Build
FROM node:20-alpine3.20 AS builder
ARG GIT_SHA

# Set working directory
WORKDIR /app

# Install build dependencies just in case
RUN apk add --no-cache \
    --repository=https://dl-cdn.alpinelinux.org/alpine/v3.20/main \
    --repository=https://dl-cdn.alpinelinux.org/alpine/v3.20/community \
    python3 make g++

# Copy package files
COPY package*.json ./

# Install dependencies with verbose logging and ignoring scripts to avoid permission issues
RUN npm install --verbose --ignore-scripts --legacy-peer-deps

# Install NestJS CLI globally to ensure 'nest' command is available
RUN npm install -g @nestjs/cli

# Copy source code
COPY . .

# Build the application
RUN echo "GIT_SHA=$GIT_SHA" && npm run build

# Stage 2: Production Run
FROM node:20-alpine3.20
ARG GIT_SHA
LABEL org.opencontainers.image.revision=$GIT_SHA

# Set working directory
WORKDIR /app

# Copy built assets and dependencies from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

# Create uploads directory
RUN mkdir -p /app/uploads
VOLUME ["/app/uploads"]

# Expose the application port
EXPOSE 3000

# Start the application
CMD ["npm", "run", "start:prod"]
