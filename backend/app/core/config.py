"""
Configuration settings for the FastAPI application
"""

from pydantic_settings import BaseSettings
from typing import Optional
import os


class Settings(BaseSettings):
    """Application settings"""
    
    # API Settings
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "Compazz Financial Management"
    VERSION: str = "1.0.0"
    
    # CORS Settings - Add your production frontend URL
    BACKEND_CORS_ORIGINS: str = os.getenv("BACKEND_CORS_ORIGINS", "http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:5176,http://localhost:5177,http://127.0.0.1:5173,http://127.0.0.1:5174,http://127.0.0.1:5175,http://127.0.0.1:5176,http://127.0.0.1:5177,http://localhost:3000,https://compazz.app")
    
    # Supabase Settings - Required for database connection
    SUPABASE_URL: str
    SUPABASE_KEY: str  # This will be the anon key for frontend
    SUPABASE_ANON_KEY: str = ""  # Optional, defaults to SUPABASE_KEY
    SUPABASE_SERVICE_ROLE_KEY: str
    
    # JWT Settings
    SECRET_KEY: str = os.getenv("SECRET_KEY", "your-secret-key-here-change-in-production")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 365  # 1 year (no practical expiration)
    
    # Environment
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    DEBUG: bool = os.getenv("DEBUG", "true").lower() == "true"
    
    # Email Settings (optional)
    SMTP_TLS: bool = True
    SMTP_PORT: Optional[int] = 587
    SMTP_HOST: Optional[str] = None
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    
    # File Upload Settings
    MAX_FILE_SIZE: int = 10 * 1024 * 1024  # 10MB
    ALLOWED_FILE_TYPES: list = [".pdf", ".jpg", ".jpeg", ".png", ".gif"]
    
    # Stripe Settings
    STRIPE_SECRET_KEY: Optional[str] = os.getenv("STRIPE_SECRET_KEY", "")
    VITE_STRIPE_PUBLISHABLE_KEY: Optional[str] = os.getenv("VITE_STRIPE_PUBLISHABLE_KEY", "")

    # Resend Email Settings
    RESEND_API_KEY: Optional[str] = os.getenv("RESEND_API_KEY", "")
    FROM_EMAIL: str = os.getenv("FROM_EMAIL", "onboarding@compazz.app")

    
    model_config = {
        "env_file": ".env",
        "case_sensitive": True,
        "extra": "ignore"
    }


# Create settings instance
settings = Settings()
