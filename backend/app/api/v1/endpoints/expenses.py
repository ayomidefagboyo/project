"""
Expense management endpoints
Track business expenses: rent, utilities, supplies, wages, etc.
"""

from fastapi import APIRouter, HTTPException, Depends, status, Query
from typing import List, Optional, Dict, Any
from datetime import datetime, date
import uuid
import logging

from app.core.database import get_supabase_admin, Tables
from app.core.security import CurrentUser
from pydantic import BaseModel, Field

router = APIRouter()
logger = logging.getLogger(__name__)


def _is_audit_user_fk_error(exc: Exception) -> bool:
    """Detect audit_entries.user_id foreign-key failures."""
    message = str(exc or "")
    lowered = message.lower()
    return (
        "audit_entries_user_id_fkey" in lowered
        or ("key (user_id)=" in lowered and "is not present in table \"users\"" in lowered)
    )


# ===============================================
# SCHEMAS
# ===============================================

EXPENSE_CATEGORIES = [
    "rent", "utilities", "salaries", "supplies", "inventory",
    "marketing", "transport", "maintenance", "insurance",
    "taxes", "bank_charges", "miscellaneous", "food_beverage",
    "equipment", "professional_services", "communication"
]


class ExpenseCreate(BaseModel):
    outlet_id: str
    date: str
    amount: float
    category: str
    subcategory: Optional[str] = None
    description: str
    vendor_id: Optional[str] = None
    payment_method: str = "cash"
    receipt_url: Optional[str] = None
    is_recurring: bool = False
    recurrence_period: Optional[str] = None  # daily, weekly, monthly


class ExpenseUpdate(BaseModel):
    amount: Optional[float] = None
    category: Optional[str] = None
    subcategory: Optional[str] = None
    description: Optional[str] = None
    vendor_id: Optional[str] = None
    payment_method: Optional[str] = None
    receipt_url: Optional[str] = None
    status: Optional[str] = None  # pending, approved, rejected
    date: Optional[str] = None


# ===============================================
# CRUD ENDPOINTS
# ===============================================

@router.get("/")
async def get_expenses(
    outlet_id: str,
    category: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    vendor_id: Optional[str] = Query(None),
    payment_method: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    current_user: Dict[str, Any] = Depends(CurrentUser())
):
    """Get expenses with filtering and pagination"""
    try:
        supabase = get_supabase_admin()

        query = supabase.table(Tables.EXPENSES)\
            .select('*')\
            .eq('outlet_id', outlet_id)\
            .order('date', desc=True)

        if category:
            query = query.eq('category', category)

        if status_filter:
            query = query.eq('status', status_filter)

        if date_from:
            query = query.gte('date', date_from)

        if date_to:
            query = query.lte('date', date_to)

        if vendor_id:
            query = query.eq('vendor_id', vendor_id)

        if payment_method:
            query = query.eq('payment_method', payment_method)

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
        logger.error(f"Error fetching expenses: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch expenses: {str(e)}"
        )


@router.post("/")
async def create_expense(
    expense: ExpenseCreate,
    current_user: Dict[str, Any] = Depends(CurrentUser())
):
    """Create a new expense"""
    try:
        supabase = get_supabase_admin()

        expense_id = str(uuid.uuid4())
        expense_data = {
            'id': expense_id,
            'outlet_id': expense.outlet_id,
            'date': expense.date,
            'amount': expense.amount,
            'category': expense.category,
            'subcategory': expense.subcategory,
            'description': expense.description,
            'vendor_id': expense.vendor_id,
            'payment_method': expense.payment_method,
            'receipt_url': expense.receipt_url,
            'status': 'pending',
            'created_by': current_user['id'],
            'created_at': datetime.utcnow().isoformat(),
            'updated_at': datetime.utcnow().isoformat()
        }

        result = supabase.table(Tables.EXPENSES).insert(expense_data).execute()

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to create expense"
            )

        # Log audit
        _log_audit(supabase, expense.outlet_id, current_user, 'create', 'expense', expense_id,
                   f"Created expense: {expense.category} - {expense.description} ({expense.amount:.2f})")

        return result.data[0]

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating expense: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create expense: {str(e)}"
        )


@router.get("/{expense_id}")
async def get_expense(
    expense_id: str,
    current_user: Dict[str, Any] = Depends(CurrentUser())
):
    """Get a specific expense"""
    try:
        supabase = get_supabase_admin()

        result = supabase.table(Tables.EXPENSES)\
            .select('*')\
            .eq('id', expense_id)\
            .single()\
            .execute()

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Expense not found"
            )

        return result.data

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching expense: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch expense: {str(e)}"
        )


@router.put("/{expense_id}")
async def update_expense(
    expense_id: str,
    update: ExpenseUpdate,
    current_user: Dict[str, Any] = Depends(CurrentUser())
):
    """Update an expense"""
    try:
        supabase = get_supabase_admin()

        update_data = {k: v for k, v in update.dict().items() if v is not None}
        if not update_data:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")

        update_data['updated_at'] = datetime.utcnow().isoformat()

        result = supabase.table(Tables.EXPENSES)\
            .update(update_data)\
            .eq('id', expense_id)\
            .select()\
            .execute()

        if not result.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Expense not found")

        expense = result.data[0]

        _log_audit(supabase, expense['outlet_id'], current_user, 'update', 'expense', expense_id,
                   f"Updated expense: {update_data}")

        return expense

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating expense: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update expense: {str(e)}"
        )


@router.delete("/{expense_id}")
async def delete_expense(
    expense_id: str,
    current_user: Dict[str, Any] = Depends(CurrentUser())
):
    """Delete an expense"""
    try:
        supabase = get_supabase_admin()

        # Get expense info for audit
        check = supabase.table(Tables.EXPENSES)\
            .select('id, outlet_id, description, amount')\
            .eq('id', expense_id)\
            .single()\
            .execute()

        if not check.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Expense not found")

        supabase.table(Tables.EXPENSES).delete().eq('id', expense_id).execute()

        _log_audit(supabase, check.data['outlet_id'], current_user, 'delete', 'expense', expense_id,
                   f"Deleted expense: {check.data['description']} ({check.data['amount']})")

        return {"message": "Expense deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting expense: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete expense: {str(e)}"
        )


# ===============================================
# APPROVAL
# ===============================================

@router.post("/{expense_id}/approve")
async def approve_expense(
    expense_id: str,
    current_user: Dict[str, Any] = Depends(CurrentUser())
):
    """Approve an expense"""
    try:
        supabase = get_supabase_admin()

        result = supabase.table(Tables.EXPENSES)\
            .update({
                'status': 'approved',
                'approved_by': current_user['id'],
                'updated_at': datetime.utcnow().isoformat()
            })\
            .eq('id', expense_id)\
            .select()\
            .execute()

        if not result.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Expense not found")

        approved = result.data[0]
        _log_audit(
            supabase,
            approved.get('outlet_id'),
            current_user,
            'approve',
            'expense',
            expense_id,
            f"Approved expense: {approved.get('description')} ({approved.get('amount')})"
        )

        return approved

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error approving expense: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to approve expense: {str(e)}"
        )


@router.post("/{expense_id}/reject")
async def reject_expense(
    expense_id: str,
    current_user: Dict[str, Any] = Depends(CurrentUser())
):
    """Reject an expense"""
    try:
        supabase = get_supabase_admin()

        result = supabase.table(Tables.EXPENSES)\
            .update({
                'status': 'rejected',
                'approved_by': current_user['id'],
                'updated_at': datetime.utcnow().isoformat()
            })\
            .eq('id', expense_id)\
            .select()\
            .execute()

        if not result.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Expense not found")

        rejected = result.data[0]
        _log_audit(
            supabase,
            rejected.get('outlet_id'),
            current_user,
            'reject',
            'expense',
            expense_id,
            f"Rejected expense: {rejected.get('description')} ({rejected.get('amount')})"
        )

        return rejected

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error rejecting expense: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to reject expense: {str(e)}"
        )


# ===============================================
# STATS
# ===============================================

@router.get("/stats/summary")
async def get_expense_stats(
    outlet_id: str,
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    current_user: Dict[str, Any] = Depends(CurrentUser())
):
    """Get expense statistics and breakdown by category"""
    try:
        supabase = get_supabase_admin()

        query = supabase.table(Tables.EXPENSES)\
            .select('*')\
            .eq('outlet_id', outlet_id)

        if date_from:
            query = query.gte('date', date_from)
        if date_to:
            query = query.lte('date', date_to)

        result = query.execute()
        expenses = result.data or []

        total_amount = sum(float(e.get('amount', 0)) for e in expenses)
        approved = [e for e in expenses if e['status'] == 'approved']
        pending = [e for e in expenses if e['status'] == 'pending']

        # Breakdown by category
        by_category = {}
        for e in expenses:
            cat = e.get('category', 'miscellaneous')
            by_category[cat] = by_category.get(cat, 0) + float(e.get('amount', 0))

        # Breakdown by payment method
        by_payment = {}
        for e in expenses:
            method = e.get('payment_method', 'cash')
            by_payment[method] = by_payment.get(method, 0) + float(e.get('amount', 0))

        return {
            "total_expenses": total_amount,
            "total_count": len(expenses),
            "approved_amount": sum(float(e.get('amount', 0)) for e in approved),
            "pending_amount": sum(float(e.get('amount', 0)) for e in pending),
            "pending_count": len(pending),
            "by_category": by_category,
            "by_payment_method": by_payment,
            "categories": EXPENSE_CATEGORIES
        }

    except Exception as e:
        logger.error(f"Error fetching expense stats: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch expense stats: {str(e)}"
        )


# ===============================================
# HELPERS
# ===============================================

def _log_audit(supabase, outlet_id: str, user: Dict, action: str, entity_type: str, entity_id: str, details: str):
    """Log an audit entry"""
    try:
        payload = {
            'id': str(uuid.uuid4()),
            'outlet_id': outlet_id,
            'user_id': str(user.get('id') or '').strip() or None,
            'user_name': user.get('name', 'Unknown'),
            'action': action,
            'entity_type': entity_type,
            'entity_id': entity_id,
            'details': details,
            'timestamp': datetime.utcnow().isoformat()
        }
        try:
            supabase.table(Tables.AUDIT_ENTRIES).insert(payload).execute()
        except Exception as audit_error:
            if payload.get('user_id') and _is_audit_user_fk_error(audit_error):
                logger.warning(
                    "Expense audit user %s is missing from users; retrying audit entry without user_id",
                    payload['user_id']
                )
                payload['user_id'] = None
                supabase.table(Tables.AUDIT_ENTRIES).insert(payload).execute()
                return
            raise
    except Exception as e:
        logger.warning(f"Failed to log audit entry: {e}")
