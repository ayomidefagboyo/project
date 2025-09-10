#!/bin/bash
# Render startup script for Compazz Backend

echo "🚀 Starting Compazz Backend on Render..."

# Upgrade pip first
pip install --upgrade pip

# Install dependencies
pip install -r requirements.txt

# Start the application
uvicorn main:app --host 0.0.0.0 --port $PORT --workers 1
