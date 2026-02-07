#!/usr/bin/env python3
"""
FastAPI Backend Startup Script for Compass Financial Management Platform
"""

import uvicorn
import os
import sys
from pathlib import Path

# Add the backend directory to the Python path
backend_dir = Path(__file__).parent / "backend"
sys.path.insert(0, str(backend_dir))

def main():
    """Start the FastAPI backend server"""
    
    # Change to backend directory
    os.chdir(backend_dir)
    
    print("🚀 Starting Compass FastAPI Backend Server...")
    print("📍 Backend Directory:", backend_dir)
    print("🌐 Server will be available at: http://localhost:8002")
    print("📚 API Documentation: http://localhost:8002/docs")
    print("🔧 Admin Interface: http://localhost:8002/redoc")
    print("\n" + "="*50)
    
    try:
        # Start the server
        uvicorn.run(
            "main:app",  # Assuming main.py exists with app instance
            host="0.0.0.0",
            port=8002,
            reload=True,  # Enable auto-reload for development
            log_level="info"
        )
    except FileNotFoundError:
        print("❌ Error: Could not find main.py in the backend directory")
        print("💡 Make sure you have a main.py file that creates the FastAPI app")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error starting server: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
