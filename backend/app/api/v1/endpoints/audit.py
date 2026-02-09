"""
Audit trail endpoints
View who did what, when, and to which entity.
All write operations in invoices, expenses, products, etc. auto-log here.
"""

from fastapi import APIRouter, HTTPException, Depends, status, Query
from typing import Optional, Dict, Any
from datetime import datetime, date, timedelta
import logging

from app.core.database import get_supabase_admin, Tables
from app.core.security import CurrentUser

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/")
async def get_audit_trail(
    outlet_id: str,
    entity_type: Optional[str] = Query(None, description="Filter: invoice, expense, product, transaction, staff, vendor"),
    action: Optional[str] = Query(None, description="Filter: create, update, delete, void, receive, approve, reject"),
    user_id: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    search: Optional[str] = Query(None, description="Search in details text"),
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
    current_user: Dict[str, Any] = Depends(CurrentUser())
):
    """Get audit trail entries with filtering"""
    try:
        supabase = get_supabase_admin()

        query = supabase.table(Tables.AUDIT_ENTRIES)\
            .select('*')\
            .eq('outlet_id', outlet_id)\
            .order('timestamp', desc=True)

        if entity_type:
            query = query.eq('entity_type', entity_type)

        if action:
            query = query.eq('action', action)

        if user_id:
            query = query.eq('user_id', user_id)

        if date_from:
            query = query.gte('timestamp', f"{date_from}T00:00:00")

        if date_to:
            query = query.lte('timestamp', f"{date_to}T23:59:59")

        if search:
            query = query.ilike('details', f'%{search}%')

        result = query.execute()
        all_data = result.data or []
        total = len(all_data)

        # Paginate
        start = (page - 1) * size
        paginated = all_data[start:start + size]

        return {
            "items": paginated,
            "total": total,
            "page": page,
            "size": size,
            "pages": (total + size - 1) // size
        }

    except Exception as e:
        logger.error(f"Error fetching audit trail: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch audit trail: {str(e)}"
        )


@router.get("/stats")
async def get_audit_stats(
    outlet_id: str,
    days: int = Query(7, ge=1, le=90, description="Number of days to look back"),
    current_user: Dict[str, Any] = Depends(CurrentUser())
):
    """Get audit trail statistics: activity counts by user, entity type, and action"""
    try:
        supabase = get_supabase_admin()

        since = (date.today() - timedelta(days=days)).isoformat()

        result = supabase.table(Tables.AUDIT_ENTRIES)\
            .select('user_name, action, entity_type, timestamp')\
            .eq('outlet_id', outlet_id)\
            .gte('timestamp', f"{since}T00:00:00")\
            .execute()

        entries = result.data or []

        # By user
        by_user = {}
        for e in entries:
            name = e.get('user_name', 'Unknown')
            by_user[name] = by_user.get(name, 0) + 1

        # By entity type
        by_entity = {}
        for e in entries:
            entity = e.get('entity_type', 'unknown')
            by_entity[entity] = by_entity.get(entity, 0) + 1

        # By action
        by_action = {}
        for e in entries:
            act = e.get('action', 'unknown')
            by_action[act] = by_action.get(act, 0) + 1

        # By day
        by_day = {}
        for e in entries:
            try:
                day = datetime.fromisoformat(e['timestamp'].replace('Z', '+00:00')).date().isoformat()
                by_day[day] = by_day.get(day, 0) + 1
            except (ValueError, KeyError):
                pass

        return {
            "period_days": days,
            "total_entries": len(entries),
            "by_user": by_user,
            "by_entity_type": by_entity,
            "by_action": by_action,
            "by_day": dict(sorted(by_day.items()))
        }

    except Exception as e:
        logger.error(f"Error fetching audit stats: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch audit stats: {str(e)}"
        )


@router.get("/{entity_type}/{entity_id}")
async def get_entity_audit(
    entity_type: str,
    entity_id: str,
    current_user: Dict[str, Any] = Depends(CurrentUser())
):
    """Get full audit history for a specific entity (e.g., a single invoice or product)"""
    try:
        supabase = get_supabase_admin()

        result = supabase.table(Tables.AUDIT_ENTRIES)\
            .select('*')\
            .eq('entity_type', entity_type)\
            .eq('entity_id', entity_id)\
            .order('timestamp', desc=True)\
            .execute()

        return {
            "entity_type": entity_type,
            "entity_id": entity_id,
            "entries": result.data or [],
            "total": len(result.data or [])
        }

    except Exception as e:
        logger.error(f"Error fetching entity audit: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch entity audit: {str(e)}"
        )
