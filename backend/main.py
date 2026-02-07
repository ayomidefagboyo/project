"""
Main FastAPI application for Compazz Financial Management Platform
"""

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from contextlib import asynccontextmanager
import logging
import traceback

# Import API routes
from app.api.v1.api import api_router
from app.core.database import init_db
from app.core.config import settings

# Configure logging based on environment
log_level = logging.DEBUG if settings.DEBUG else logging.INFO
logging.basicConfig(
    level=log_level,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    # Startup
    logger.info("🚀 Starting Compazz FastAPI Backend...")
    try:
        await init_db()
        logger.info("✅ Database initialized successfully")
    except Exception as e:
        logger.error(f"❌ Failed to initialize database: {e}")
        # Don't raise here to allow app to start for debugging
    
    yield
    
    # Shutdown
    logger.info("👋 Shutting down Compazz Backend...")


# Create FastAPI application
app = FastAPI(
    title="Compazz Financial Management API",
    description="Comprehensive financial management platform for small to medium businesses",
    version="1.0.0",
    docs_url="/docs" if settings.DEBUG else None,  # Hide docs in production
    redoc_url="/redoc" if settings.DEBUG else None,  # Hide redoc in production
    lifespan=lifespan
)


# Global exception handler for production
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Handle all unhandled exceptions"""
    # Log detailed error for developers
    logger.error(f"Unhandled exception on {request.method} {request.url}")
    logger.error(f"Exception type: {type(exc).__name__}")
    logger.error(f"Exception message: {str(exc)}")
    logger.error(f"Traceback: {traceback.format_exc()}")
    
    # Return generic error to users in production
    if settings.ENVIRONMENT == "production":
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "Internal server error"}
        )
    else:
        # Show detailed error in development
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": str(exc), "type": type(exc).__name__}
        )


# Handle validation errors
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle request validation errors"""
    # Log validation error for developers
    logger.warning(f"Validation error on {request.method} {request.url}: {exc.errors()}")
    
    # Return user-friendly validation error
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": "Invalid request data", "errors": exc.errors()}
    )


# Handle HTTP exceptions
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle HTTP exceptions"""
    # Log HTTP exception for developers
    logger.info(f"HTTP {exc.status_code} on {request.method} {request.url}: {exc.detail}")
    
    # Return the HTTP exception as-is (these are usually intentional)
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail}
    )

# Configure CORS
cors_origins = settings.BACKEND_CORS_ORIGINS.split(",") if settings.BACKEND_CORS_ORIGINS else [
    "http://localhost:5173",
    "http://localhost:5174",  # Add common alternate Vite port
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174"
]

# Debug CORS configuration
logger.info(f"🌐 CORS Origins: {cors_origins}")
logger.info(f"🔧 BACKEND_CORS_ORIGINS env var: {settings.BACKEND_CORS_ORIGINS}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(api_router, prefix="/api/v1")


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Compazz Financial Management API",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs",
        "redoc": "/redoc"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "compazz-api",
        "version": "1.0.0"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8002,
        reload=True,
        log_level="info"
    )
