# Build stage
FROM node:20-alpine AS build

RUN apk add --no-cache python3 make g++ pkgconfig

WORKDIR /app

# Copy package manifests (root + workspaces needed for build)
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY ayratech-supermarket-manager/apps/web-admin/package*.json ./ayratech-supermarket-manager/apps/web-admin/

# Install dependencies including workspace devDependencies used at build time
RUN npm install --legacy-peer-deps --include=dev

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Build the supermarket manager web-admin under /manager/
ARG VITE_SUPERMARKET_API_URL
RUN VITE_API_URL=$VITE_SUPERMARKET_API_URL VITE_BASE_PATH=/manager/ npm run build -w @ayratech/supermarket-web-admin

# Production stage
FROM nginx:alpine

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from build stage
COPY --from=build /app/dist /usr/share/nginx/html
COPY --from=build /app/ayratech-supermarket-manager/apps/web-admin/dist /usr/share/nginx/html/manager

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
