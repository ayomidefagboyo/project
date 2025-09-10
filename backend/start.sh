#!/bin/bash
# Render startup script for Compazz Backend

echo "🚀 Starting Compazz Backend on Render..."

# Install dependencies
pip install -r requirements.txt

# Start the application
uvicorn main:app --host 0.0.0.0 --port $PORT --workers 1
