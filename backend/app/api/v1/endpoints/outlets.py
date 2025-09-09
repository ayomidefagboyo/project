"""
Outlet management endpoints
"""

from fastapi import APIRouter, Depends
from app.core.security import require_auth
from typing import Dict, Any

router = APIRouter()


@router.get("/")
async def get_outlets(current_user: Dict[str, Any] = Depends(require_auth())):
    """Get outlets - TODO: Implement"""
    return {"message": "Outlets endpoint - Coming soon"}


@router.get("/{outlet_id}")
async def get_outlet(outlet_id: str, current_user: Dict[str, Any] = Depends(require_auth())):
    """Get specific outlet - TODO: Implement"""
    return {"message": f"Outlet {outlet_id} - Coming soon"}


@router.put("/{outlet_id}")
async def update_outlet(outlet_id: str, current_user: Dict[str, Any] = Depends(require_auth())):
    """Update outlet - TODO: Implement"""
    return {"message": f"Update outlet {outlet_id} - Coming soon"}

