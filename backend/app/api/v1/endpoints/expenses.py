"""
Expense management endpoints
"""

from fastapi import APIRouter, Depends
from app.core.security import require_auth
from typing import Dict, Any

router = APIRouter()


@router.get("/")
async def get_expenses(current_user: Dict[str, Any] = Depends(require_auth())):
    """Get expenses - TODO: Implement"""
    return {"message": "Expenses endpoint - Coming soon"}


@router.post("/")
async def create_expense(current_user: Dict[str, Any] = Depends(require_auth())):
    """Create expense - TODO: Implement"""
    return {"message": "Create expense - Coming soon"}


@router.get("/{expense_id}")
async def get_expense(expense_id: str, current_user: Dict[str, Any] = Depends(require_auth())):
    """Get specific expense - TODO: Implement"""
    return {"message": f"Expense {expense_id} - Coming soon"}

