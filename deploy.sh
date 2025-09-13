#!/bin/bash

echo "🚀 Starting deployment process..."

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf node_modules package-lock.json yarn.lock dist

# Install dependencies with npm (platform independent)
echo "📦 Installing dependencies..."
npm install

# Build the project
echo "🔨 Building project..."
npm run build

echo "✅ Build completed successfully!"
echo "📁 Build files are in the 'dist' directory"

# Optional: Preview the build locally
echo "🔍 To preview build locally, run: npm run preview"