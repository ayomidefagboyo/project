# Use Node.js 18 Alpine for smaller size
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Set environment variables for platform-independent installation
ENV npm_config_target_platform=linux
ENV npm_config_target_arch=x64
ENV npm_config_cache=false
ENV npm_config_optional=false

# Install dependencies with clean cache
RUN npm ci --only=production --no-audit --no-fund

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "3000"]