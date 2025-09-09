"""
Main API router that includes all endpoint routers
"""

from fastapi import APIRouter
from app.api.v1.endpoints import auth, vendors, outlets, invoices, expenses, reports, users, audit, payments, ocr, eod, anomalies

# Create main API router
api_router = APIRouter()

# Include all endpoint routers
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(vendors.router, prefix="/vendors", tags=["Vendors"])
api_router.include_router(payments.router, prefix="/payments", tags=["Payments"])
api_router.include_router(ocr.router, prefix="/ocr", tags=["OCR & File Upload"])
api_router.include_router(eod.router, prefix="/eod", tags=["EOD Reports"])
api_router.include_router(anomalies.router, prefix="/anomalies", tags=["Anomaly Detection"])
api_router.include_router(outlets.router, prefix="/outlets", tags=["Outlets"])
api_router.include_router(invoices.router, prefix="/invoices", tags=["Invoices"])
api_router.include_router(expenses.router, prefix="/expenses", tags=["Expenses"])
api_router.include_router(reports.router, prefix="/reports", tags=["Reports"])
api_router.include_router(users.router, prefix="/users", tags=["Users"])
api_router.include_router(audit.router, prefix="/audit", tags=["Audit"])
