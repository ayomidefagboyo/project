"""
Email Expense Integration API endpoints
"""

from fastapi import APIRouter, HTTPException, status, Depends, BackgroundTasks
from pydantic import BaseModel, EmailStr
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
import logging

from app.core.security import require_auth
from app.services.email_expense_parser import EmailConnector, ParsedExpense
from app.core.database import supabase

logger = logging.getLogger(__name__)

router = APIRouter()


class EmailAccountSetup(BaseModel):
    """Email account setup request"""
    email_address: EmailStr
    imap_server: str
    app_password: str  # App-specific password for security
    provider: str = "gmail"  # gmail, outlook, yahoo, etc.


class EmailSyncRequest(BaseModel):
    """Manual email sync request"""
    days_back: int = 7


class EmailAccountResponse(BaseModel):
    """Email account response"""
    id: str
    email_address: str
    provider: str
    last_sync: Optional[datetime]
    is_active: bool
    expenses_count: int


class ParsedExpenseResponse(BaseModel):
    """Parsed expense response"""
    id: str
    amount: float
    merchant: str
    transaction_date: datetime
    account_number: str
    transaction_type: str
    category: str
    confidence_score: float
    bank_name: Optional[str]
    is_approved: bool = False


@router.post("/setup", status_code=status.HTTP_201_CREATED)
async def setup_email_account(
    account_setup: EmailAccountSetup,
    current_user: Dict[str, Any] = Depends(require_auth())
):
    """
    Setup email account for expense parsing
    """
    try:
        # Test email connection first
        connector = EmailConnector()

        # Map provider to IMAP server if not provided
        if not account_setup.imap_server:
            imap_servers = {
                "gmail": "imap.gmail.com",
                "outlook": "outlook.office365.com",
                "yahoo": "imap.mail.yahoo.com"
            }
            account_setup.imap_server = imap_servers.get(account_setup.provider, "")

        # Test connection
        is_connected = await connector.connect_imap(
            account_setup.email_address,
            account_setup.app_password,
            account_setup.imap_server
        )

        if not is_connected:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to connect to email account. Please check credentials."
            )

        # Store encrypted email credentials
        email_account_data = {
            "user_id": current_user["id"],
            "outlet_id": current_user["outlet_id"],
            "email_address": account_setup.email_address,
            "imap_server": account_setup.imap_server,
            "provider": account_setup.provider,
            # Note: In production, encrypt the app_password before storing
            "app_password": account_setup.app_password,  # TODO: Encrypt this
            "is_active": True,
            "created_at": datetime.utcnow().isoformat(),
            "last_sync": None
        }

        result = supabase.table("email_accounts").insert(email_account_data).execute()

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to save email account"
            )

        account_id = result.data[0]["id"]

        return {
            "success": True,
            "message": "Email account connected successfully",
            "account_id": account_id
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Email account setup error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to setup email account"
        )


@router.get("/accounts", response_model=List[EmailAccountResponse])
async def get_email_accounts(
    current_user: Dict[str, Any] = Depends(require_auth())
):
    """
    Get user's connected email accounts
    """
    try:
        result = supabase.table("email_accounts").select(
            "id, email_address, provider, last_sync, is_active"
        ).eq("user_id", current_user["id"]).eq("is_active", True).execute()

        accounts = []
        for account in result.data:
            # Count expenses for this account
            expense_count = supabase.table("parsed_expenses").select(
                "id"
            ).eq("email_account_id", account["id"]).execute()

            accounts.append(EmailAccountResponse(
                **account,
                expenses_count=len(expense_count.data)
            ))

        return accounts

    except Exception as e:
        logger.error(f"Error fetching email accounts: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch email accounts"
        )


@router.post("/sync/{account_id}")
async def sync_email_expenses(
    account_id: str,
    sync_request: EmailSyncRequest,
    background_tasks: BackgroundTasks,
    current_user: Dict[str, Any] = Depends(require_auth())
):
    """
    Manually sync expenses from email account
    """
    try:
        # Get email account
        account_result = supabase.table("email_accounts").select(
            "*"
        ).eq("id", account_id).eq("user_id", current_user["id"]).execute()

        if not account_result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Email account not found"
            )

        account = account_result.data[0]

        # Add background task to sync emails
        background_tasks.add_task(
            sync_email_expenses_background,
            account,
            sync_request.days_back,
            current_user
        )

        return {
            "success": True,
            "message": "Email sync started. Check back in a few minutes."
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Email sync error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to start email sync"
        )


@router.get("/expenses/{account_id}", response_model=List[ParsedExpenseResponse])
async def get_parsed_expenses(
    account_id: str,
    current_user: Dict[str, Any] = Depends(require_auth())
):
    """
    Get parsed expenses from email account
    """
    try:
        result = supabase.table("parsed_expenses").select(
            "*"
        ).eq("email_account_id", account_id).eq(
            "user_id", current_user["id"]
        ).order("transaction_date", desc=True).execute()

        return [ParsedExpenseResponse(**expense) for expense in result.data]

    except Exception as e:
        logger.error(f"Error fetching parsed expenses: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch parsed expenses"
        )


@router.post("/expenses/{expense_id}/approve")
async def approve_parsed_expense(
    expense_id: str,
    current_user: Dict[str, Any] = Depends(require_auth())
):
    """
    Approve and convert parsed expense to actual expense
    """
    try:
        # Get parsed expense
        result = supabase.table("parsed_expenses").select(
            "*"
        ).eq("id", expense_id).eq("user_id", current_user["id"]).execute()

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Parsed expense not found"
            )

        parsed_expense = result.data[0]

        # Create actual expense record
        expense_data = {
            "outlet_id": current_user["outlet_id"],
            "vendor_name": parsed_expense["merchant"],
            "amount": parsed_expense["amount"],
            "description": f"Auto-imported: {parsed_expense['merchant']}",
            "category": parsed_expense["category"],
            "transaction_date": parsed_expense["transaction_date"],
            "created_by": current_user["id"],
            "source": "email_import",
            "metadata": {
                "email_account_id": parsed_expense["email_account_id"],
                "parsed_expense_id": expense_id,
                "confidence_score": parsed_expense["confidence_score"],
                "account_number": parsed_expense["account_number"]
            }
        }

        expense_result = supabase.table("expenses").insert(expense_data).execute()

        if not expense_result.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create expense"
            )

        # Mark parsed expense as approved
        supabase.table("parsed_expenses").update({
            "is_approved": True,
            "approved_at": datetime.utcnow().isoformat(),
            "approved_by": current_user["id"]
        }).eq("id", expense_id).execute()

        return {
            "success": True,
            "message": "Expense approved and added to records",
            "expense_id": expense_result.data[0]["id"]
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error approving expense: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to approve expense"
        )


async def sync_email_expenses_background(
    account: Dict[str, Any],
    days_back: int,
    user: Dict[str, Any]
):
    """
    Background task to sync email expenses
    """
    try:
        connector = EmailConnector()

        # Fetch expenses from email
        expenses = await connector.fetch_debit_alerts(
            account["email_address"],
            account["app_password"],  # TODO: Decrypt this
            account["imap_server"],
            days_back
        )

        # Save parsed expenses to database
        for expense in expenses:
            expense_data = {
                "user_id": user["id"],
                "outlet_id": user["outlet_id"],
                "email_account_id": account["id"],
                "amount": expense.amount,
                "merchant": expense.merchant,
                "transaction_date": expense.transaction_date.isoformat(),
                "account_number": expense.account_number,
                "transaction_type": expense.transaction_type,
                "category": expense.category or "other",
                "confidence_score": expense.confidence_score,
                "bank_name": expense.bank_name,
                "raw_text": expense.raw_text,
                "is_approved": False,
                "created_at": datetime.utcnow().isoformat()
            }

            # Check for duplicates
            existing = supabase.table("parsed_expenses").select("id").eq(
                "email_account_id", account["id"]
            ).eq("amount", expense.amount).eq(
                "merchant", expense.merchant
            ).eq("transaction_date", expense.transaction_date.isoformat()).execute()

            if not existing.data:
                supabase.table("parsed_expenses").insert(expense_data).execute()

        # Update last sync time
        supabase.table("email_accounts").update({
            "last_sync": datetime.utcnow().isoformat()
        }).eq("id", account["id"]).execute()

        logger.info(f"Synced {len(expenses)} expenses for account {account['id']}")

    except Exception as e:
        logger.error(f"Background sync error: {e}")


@router.delete("/accounts/{account_id}")
async def delete_email_account(
    account_id: str,
    current_user: Dict[str, Any] = Depends(require_auth())
):
    """
    Delete email account connection
    """
    try:
        result = supabase.table("email_accounts").update({
            "is_active": False
        }).eq("id", account_id).eq("user_id", current_user["id"]).execute()

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Email account not found"
            )

        return {
            "success": True,
            "message": "Email account disconnected"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting email account: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to disconnect email account"
        )