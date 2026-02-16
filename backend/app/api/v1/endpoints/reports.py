"""
Financial reports endpoints
Daily, weekly, monthly summaries with sales, expenses, and profit breakdowns.
"""

from fastapi import APIRouter, HTTPException, Depends, status, Query
from typing import Optional, Dict, Any, List
from datetime import datetime, date, timedelta
import logging
import json
import re

from app.core.database import get_supabase_admin, Tables
from app.core.security import CurrentUser

router = APIRouter()
logger = logging.getLogger(__name__)


def _safe_json_object(value: Any) -> Dict[str, Any]:
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            if isinstance(parsed, dict):
                return parsed
        except Exception:
            return {}
    return {}


def _normalize_split_payments(raw_split_payments: Any) -> List[Dict[str, float]]:
    if not isinstance(raw_split_payments, list):
        return []

    normalized: List[Dict[str, float]] = []
    for item in raw_split_payments:
        candidate = item
        if hasattr(item, "dict"):
            try:
                candidate = item.dict()
            except Exception:
                candidate = item

        if not isinstance(candidate, dict):
            continue

        method = str(candidate.get("method") or "").strip().lower()
        if not method:
            continue

        try:
            amount = float(candidate.get("amount") or 0)
        except Exception:
            continue

        if amount <= 0:
            continue

        normalized.append({"method": method, "amount": amount})

    return normalized


def _is_missing_table_error(exc: Exception, table_name: str) -> bool:
    message = str(exc).lower()
    return (
        table_name.lower() in message
        and (
            "does not exist" in message
            or "could not find the table" in message
            or "42p01" in message
            or "pgrst205" in message
        )
    )


def _extract_stocktake_reason_and_notes(raw_notes: Any) -> Dict[str, Optional[str]]:
    payload = _safe_json_object(raw_notes)
    if payload:
        reason = str(payload.get("reason") or "").strip() or None
        notes = str(payload.get("notes") or "").strip() or None
        return {"reason": reason, "notes": notes}

    text = str(raw_notes or "").strip()
    if not text:
        return {"reason": None, "notes": None}

    # Backward compatibility with legacy "[Reason] free text notes" format.
    match = re.match(r"^\[(?P<reason>[^\]]+)\]\s*(?P<notes>.*)$", text)
    if match:
        reason = str(match.group("reason") or "").strip() or None
        notes = str(match.group("notes") or "").strip() or None
        return {"reason": reason, "notes": notes}

    return {"reason": None, "notes": text}


def _extract_split_payments(transaction: Dict[str, Any]) -> List[Dict[str, float]]:
    direct = _normalize_split_payments(transaction.get("split_payments"))
    if direct:
        return direct

    notes_data = _safe_json_object(transaction.get("notes"))
    return _normalize_split_payments(notes_data.get("split_payments"))


def _allocate_transaction_amount_by_method(transaction: Dict[str, Any]) -> Dict[str, float]:
    total_amount = float(transaction.get("total_amount", 0) or 0)
    split_payments = _extract_split_payments(transaction)

    if len(split_payments) > 1:
        allocations: Dict[str, float] = {}
        allocated_total = 0.0
        for split in split_payments:
            method = split["method"]
            amount = float(split["amount"])
            allocations[method] = allocations.get(method, 0.0) + amount
            allocated_total += amount

        if not allocations:
            method = str(transaction.get("payment_method") or "cash").strip().lower() or "cash"
            return {method: total_amount}

        remainder = total_amount - allocated_total
        if abs(remainder) <= 0.01 and remainder != 0:
            fallback_method = split_payments[0].get("method") or str(transaction.get("payment_method") or "cash").strip().lower() or "cash"
            allocations[fallback_method] = allocations.get(fallback_method, 0.0) + remainder

        return allocations

    method = str(transaction.get("payment_method") or "cash").strip().lower() or "cash"
    return {method: total_amount}


# ===============================================
# DAILY REPORT
# ===============================================

@router.get("/daily")
async def get_daily_report(
    outlet_id: str,
    report_date: Optional[str] = Query(None, description="Date in YYYY-MM-DD format, defaults to today"),
    current_user: Dict[str, Any] = Depends(CurrentUser())
):
    """Get a comprehensive daily report: sales, expenses, profit, payment breakdown"""
    try:
        supabase = get_supabase_admin()
        target_date = report_date or date.today().isoformat()

        # ---- SALES ----
        sales_result = supabase.table('pos_transactions')\
            .select('*')\
            .eq('outlet_id', outlet_id)\
            .gte('transaction_date', f"{target_date}T00:00:00")\
            .lte('transaction_date', f"{target_date}T23:59:59")\
            .neq('status', 'voided')\
            .execute()

        transactions = sales_result.data or []

        total_sales = sum(float(t.get('total_amount', 0)) for t in transactions)
        total_tax = sum(float(t.get('tax_amount', 0)) for t in transactions)
        total_discount = sum(float(t.get('discount_amount', 0)) for t in transactions)
        transaction_count = len(transactions)

        # Sales by payment method (split-aware)
        sales_by_payment: Dict[str, float] = {}
        for t in transactions:
            allocations = _allocate_transaction_amount_by_method(t)
            for method, amount in allocations.items():
                sales_by_payment[method] = sales_by_payment.get(method, 0.0) + amount

        # Sales by hour
        sales_by_hour = {}
        for t in transactions:
            try:
                hour = datetime.fromisoformat(t['transaction_date'].replace('Z', '+00:00')).hour
                key = f"{hour:02d}:00"
                sales_by_hour[key] = sales_by_hour.get(key, 0) + float(t.get('total_amount', 0))
            except (ValueError, KeyError):
                pass

        # ---- EXPENSES ----
        expenses_result = supabase.table(Tables.EXPENSES)\
            .select('*')\
            .eq('outlet_id', outlet_id)\
            .eq('date', target_date)\
            .execute()

        expenses = expenses_result.data or []
        total_expenses = sum(float(e.get('amount', 0)) for e in expenses)

        expenses_by_category = {}
        for e in expenses:
            cat = e.get('category', 'miscellaneous')
            expenses_by_category[cat] = expenses_by_category.get(cat, 0) + float(e.get('amount', 0))

        # ---- CASH DRAWER ----
        drawer_result = supabase.table(Tables.CASH_DRAWER_SESSIONS)\
            .select('*')\
            .eq('outlet_id', outlet_id)\
            .gte('opened_at', f"{target_date}T00:00:00")\
            .lte('opened_at', f"{target_date}T23:59:59")\
            .execute()

        drawer_sessions = drawer_result.data or []
        opening_balance = float(drawer_sessions[0].get('opening_balance', 0)) if drawer_sessions else 0
        closing_balance = float(drawer_sessions[-1].get('closing_balance', 0)) if drawer_sessions and drawer_sessions[-1].get('closing_balance') else None

        # ---- VOIDED TRANSACTIONS ----
        voided_result = supabase.table('pos_transactions')\
            .select('id, total_amount')\
            .eq('outlet_id', outlet_id)\
            .gte('transaction_date', f"{target_date}T00:00:00")\
            .lte('transaction_date', f"{target_date}T23:59:59")\
            .eq('status', 'voided')\
            .execute()

        voided = voided_result.data or []
        voided_count = len(voided)
        voided_amount = sum(float(v.get('total_amount', 0)) for v in voided)

        # ---- GROSS PROFIT (estimate using cost prices) ----
        # Get transaction items to calculate cost
        items_result = supabase.table('pos_transaction_items')\
            .select('product_id, quantity, unit_price, line_total')\
            .in_('transaction_id', [t['id'] for t in transactions])\
            .execute() if transactions else type('obj', (object,), {'data': []})()

        total_cost = 0
        if items_result.data:
            product_ids = list(set(i['product_id'] for i in items_result.data if i.get('product_id')))
            if product_ids:
                products_result = supabase.table(Tables.POS_PRODUCTS)\
                    .select('id, cost_price')\
                    .in_('id', product_ids)\
                    .execute()

                cost_map = {p['id']: float(p.get('cost_price', 0)) for p in (products_result.data or [])}

                for item in items_result.data:
                    cost = cost_map.get(item.get('product_id'), 0)
                    total_cost += cost * float(item.get('quantity', 0))

        gross_profit = total_sales - total_cost
        net_profit = gross_profit - total_expenses

        return {
            "date": target_date,
            "outlet_id": outlet_id,
            "sales": {
                "total": total_sales,
                "transaction_count": transaction_count,
                "average_transaction": total_sales / transaction_count if transaction_count > 0 else 0,
                "tax_collected": total_tax,
                "discounts_given": total_discount,
                "by_payment_method": sales_by_payment,
                "by_hour": dict(sorted(sales_by_hour.items()))
            },
            "expenses": {
                "total": total_expenses,
                "count": len(expenses),
                "by_category": expenses_by_category
            },
            "voided": {
                "count": voided_count,
                "amount": voided_amount
            },
            "profit": {
                "gross_profit": gross_profit,
                "total_cost_of_goods": total_cost,
                "net_profit": net_profit,
                "gross_margin": (gross_profit / total_sales * 100) if total_sales > 0 else 0
            },
            "cash_drawer": {
                "opening_balance": opening_balance,
                "closing_balance": closing_balance,
                "sessions_count": len(drawer_sessions)
            }
        }

    except Exception as e:
        logger.error(f"Error generating daily report: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate daily report: {str(e)}"
        )


# ===============================================
# WEEKLY REPORT
# ===============================================

@router.get("/weekly")
async def get_weekly_report(
    outlet_id: str,
    week_start: Optional[str] = Query(None, description="Start of week (YYYY-MM-DD), defaults to current week"),
    current_user: Dict[str, Any] = Depends(CurrentUser())
):
    """Get a weekly summary with daily breakdown"""
    try:
        supabase = get_supabase_admin()

        if week_start:
            start = datetime.strptime(week_start, '%Y-%m-%d').date()
        else:
            today = date.today()
            start = today - timedelta(days=today.weekday())  # Monday

        end = start + timedelta(days=6)  # Sunday

        # ---- SALES ----
        sales_result = supabase.table('pos_transactions')\
            .select('transaction_date, total_amount, tax_amount, discount_amount, payment_method, split_payments, notes, status')\
            .eq('outlet_id', outlet_id)\
            .gte('transaction_date', f"{start.isoformat()}T00:00:00")\
            .lte('transaction_date', f"{end.isoformat()}T23:59:59")\
            .neq('status', 'voided')\
            .execute()

        transactions = sales_result.data or []

        # Daily breakdown
        daily_sales = {}
        for d in range(7):
            day = (start + timedelta(days=d)).isoformat()
            daily_sales[day] = {"sales": 0, "transactions": 0, "expenses": 0}

        for t in transactions:
            try:
                day = datetime.fromisoformat(t['transaction_date'].replace('Z', '+00:00')).date().isoformat()
                if day in daily_sales:
                    daily_sales[day]['sales'] += float(t.get('total_amount', 0))
                    daily_sales[day]['transactions'] += 1
            except (ValueError, KeyError):
                pass

        # ---- EXPENSES ----
        expenses_result = supabase.table(Tables.EXPENSES)\
            .select('date, amount, category')\
            .eq('outlet_id', outlet_id)\
            .gte('date', start.isoformat())\
            .lte('date', end.isoformat())\
            .execute()

        for e in (expenses_result.data or []):
            day = e.get('date')
            if day in daily_sales:
                daily_sales[day]['expenses'] += float(e.get('amount', 0))

        total_sales = sum(d['sales'] for d in daily_sales.values())
        total_expenses = sum(d['expenses'] for d in daily_sales.values())
        total_transactions = sum(d['transactions'] for d in daily_sales.values())

        # Payment method breakdown (split-aware)
        by_payment: Dict[str, float] = {}
        for t in transactions:
            allocations = _allocate_transaction_amount_by_method(t)
            for method, amount in allocations.items():
                by_payment[method] = by_payment.get(method, 0.0) + amount

        return {
            "week_start": start.isoformat(),
            "week_end": end.isoformat(),
            "outlet_id": outlet_id,
            "summary": {
                "total_sales": total_sales,
                "total_expenses": total_expenses,
                "net_revenue": total_sales - total_expenses,
                "total_transactions": total_transactions,
                "average_daily_sales": total_sales / 7,
                "average_transaction": total_sales / total_transactions if total_transactions > 0 else 0
            },
            "by_payment_method": by_payment,
            "daily_breakdown": daily_sales
        }

    except Exception as e:
        logger.error(f"Error generating weekly report: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate weekly report: {str(e)}"
        )


# ===============================================
# MONTHLY REPORT
# ===============================================

@router.get("/monthly")
async def get_monthly_report(
    outlet_id: str,
    year: Optional[int] = Query(None),
    month: Optional[int] = Query(None, ge=1, le=12),
    current_user: Dict[str, Any] = Depends(CurrentUser())
):
    """Get a monthly summary with weekly breakdown"""
    try:
        supabase = get_supabase_admin()

        today = date.today()
        target_year = year or today.year
        target_month = month or today.month

        # Calculate month boundaries
        month_start = date(target_year, target_month, 1)
        if target_month == 12:
            month_end = date(target_year + 1, 1, 1) - timedelta(days=1)
        else:
            month_end = date(target_year, target_month + 1, 1) - timedelta(days=1)

        # ---- SALES ----
        sales_result = supabase.table('pos_transactions')\
            .select('transaction_date, total_amount, tax_amount, discount_amount, payment_method, split_payments, notes')\
            .eq('outlet_id', outlet_id)\
            .gte('transaction_date', f"{month_start.isoformat()}T00:00:00")\
            .lte('transaction_date', f"{month_end.isoformat()}T23:59:59")\
            .neq('status', 'voided')\
            .execute()

        transactions = sales_result.data or []

        total_sales = sum(float(t.get('total_amount', 0)) for t in transactions)
        total_tax = sum(float(t.get('tax_amount', 0)) for t in transactions)
        total_discount = sum(float(t.get('discount_amount', 0)) for t in transactions)

        # Weekly breakdown
        weekly_data = {}
        for t in transactions:
            try:
                tx_date = datetime.fromisoformat(t['transaction_date'].replace('Z', '+00:00')).date()
                week_num = (tx_date - month_start).days // 7 + 1
                key = f"Week {week_num}"
                if key not in weekly_data:
                    weekly_data[key] = {"sales": 0, "transactions": 0}
                weekly_data[key]['sales'] += float(t.get('total_amount', 0))
                weekly_data[key]['transactions'] += 1
            except (ValueError, KeyError):
                pass

        # Payment breakdown (split-aware)
        by_payment: Dict[str, float] = {}
        for t in transactions:
            allocations = _allocate_transaction_amount_by_method(t)
            for method, amount in allocations.items():
                by_payment[method] = by_payment.get(method, 0.0) + amount

        # ---- EXPENSES ----
        expenses_result = supabase.table(Tables.EXPENSES)\
            .select('amount, category')\
            .eq('outlet_id', outlet_id)\
            .gte('date', month_start.isoformat())\
            .lte('date', month_end.isoformat())\
            .execute()

        expenses = expenses_result.data or []
        total_expenses = sum(float(e.get('amount', 0)) for e in expenses)

        by_category = {}
        for e in expenses:
            cat = e.get('category', 'miscellaneous')
            by_category[cat] = by_category.get(cat, 0) + float(e.get('amount', 0))

        # ---- INVOICES ----
        invoices_result = supabase.table(Tables.INVOICES)\
            .select('total, status, vendor_id')\
            .eq('outlet_id', outlet_id)\
            .gte('issue_date', month_start.isoformat())\
            .lte('issue_date', month_end.isoformat())\
            .execute()

        invoices = invoices_result.data or []
        vendor_invoices = [i for i in invoices if i.get('vendor_id')]
        total_purchases = sum(float(i.get('total', 0)) for i in vendor_invoices)

        # ---- TOP PRODUCTS ----
        items_result = supabase.table('pos_transaction_items')\
            .select('product_name, quantity, line_total, transaction_id')\
            .execute()

        # Filter to this month's transactions
        tx_ids = set(t['id'] for t in transactions)
        month_items = [i for i in (items_result.data or []) if i.get('transaction_id') in tx_ids]

        product_totals = {}
        for item in month_items:
            name = item.get('product_name', 'Unknown')
            if name not in product_totals:
                product_totals[name] = {'quantity': 0, 'revenue': 0}
            product_totals[name]['quantity'] += float(item.get('quantity', 0))
            product_totals[name]['revenue'] += float(item.get('line_total', 0))

        top_products = sorted(product_totals.items(), key=lambda x: x[1]['revenue'], reverse=True)[:10]

        return {
            "year": target_year,
            "month": target_month,
            "month_name": month_start.strftime('%B'),
            "outlet_id": outlet_id,
            "summary": {
                "total_sales": total_sales,
                "total_expenses": total_expenses,
                "total_purchases": total_purchases,
                "net_revenue": total_sales - total_expenses,
                "transaction_count": len(transactions),
                "average_daily_sales": total_sales / month_end.day,
                "tax_collected": total_tax,
                "discounts_given": total_discount
            },
            "by_payment_method": by_payment,
            "expenses_by_category": by_category,
            "weekly_breakdown": weekly_data,
            "top_products": [{"name": name, **data} for name, data in top_products]
        }

    except Exception as e:
        logger.error(f"Error generating monthly report: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate monthly report: {str(e)}"
        )


# ===============================================
# OVERVIEW / DASHBOARD
# ===============================================

@router.get("/")
async def get_reports_overview(
    outlet_id: str,
    current_user: Dict[str, Any] = Depends(CurrentUser())
):
    """Get a quick overview of key metrics"""
    try:
        supabase = get_supabase_admin()
        today = date.today()

        # Today's sales
        today_result = supabase.table('pos_transactions')\
            .select('total_amount')\
            .eq('outlet_id', outlet_id)\
            .gte('transaction_date', f"{today.isoformat()}T00:00:00")\
            .lte('transaction_date', f"{today.isoformat()}T23:59:59")\
            .neq('status', 'voided')\
            .execute()

        today_sales = sum(float(t.get('total_amount', 0)) for t in (today_result.data or []))
        today_count = len(today_result.data or [])

        # This week
        week_start = today - timedelta(days=today.weekday())
        week_result = supabase.table('pos_transactions')\
            .select('total_amount')\
            .eq('outlet_id', outlet_id)\
            .gte('transaction_date', f"{week_start.isoformat()}T00:00:00")\
            .neq('status', 'voided')\
            .execute()

        week_sales = sum(float(t.get('total_amount', 0)) for t in (week_result.data or []))

        # This month
        month_start = today.replace(day=1)
        month_result = supabase.table('pos_transactions')\
            .select('total_amount')\
            .eq('outlet_id', outlet_id)\
            .gte('transaction_date', f"{month_start.isoformat()}T00:00:00")\
            .neq('status', 'voided')\
            .execute()

        month_sales = sum(float(t.get('total_amount', 0)) for t in (month_result.data or []))

        # Low stock count
        low_stock = supabase.table(Tables.POS_PRODUCTS)\
            .select('id', count='exact')\
            .eq('outlet_id', outlet_id)\
            .eq('is_active', True)\
            .execute()

        # We can't do quantity < min_stock_level in one query easily, so we fetch and filter
        all_products = supabase.table(Tables.POS_PRODUCTS)\
            .select('quantity, min_stock_level')\
            .eq('outlet_id', outlet_id)\
            .eq('is_active', True)\
            .execute()

        low_stock_count = sum(
            1 for p in (all_products.data or [])
            if float(p.get('quantity', 0)) <= float(p.get('min_stock_level', 5))
        )

        return {
            "today": {
                "sales": today_sales,
                "transactions": today_count
            },
            "this_week": {
                "sales": week_sales
            },
            "this_month": {
                "sales": month_sales
            },
            "alerts": {
                "low_stock_products": low_stock_count
            }
        }

    except Exception as e:
        logger.error(f"Error generating reports overview: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate reports overview: {str(e)}"
        )


# ===============================================
# STOCKTAKE REPORTS
# ===============================================

@router.get("/stocktakes")
async def list_stocktake_reports(
    outlet_id: str,
    page: int = Query(1, ge=1, description="Page number"),
    size: int = Query(50, ge=1, le=200, description="Page size"),
    date_from: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    current_user: Dict[str, Any] = Depends(CurrentUser())
):
    """List stocktake sessions with summary metrics for an outlet."""
    try:
        supabase = get_supabase_admin()
        offset = (page - 1) * size
        used_session_table = True

        session_rows: List[Dict[str, Any]] = []
        total = 0

        try:
            session_query = supabase.table('pos_stocktake_sessions').select('*', count='exact').eq('outlet_id', outlet_id)
            if date_from:
                session_query = session_query.gte('completed_at', f"{date_from}T00:00:00")
            if date_to:
                session_query = session_query.lte('completed_at', f"{date_to}T23:59:59")

            session_result = session_query.order('completed_at', desc=True).range(offset, offset + size - 1).execute()
            session_rows = session_result.data or []
            total = int(getattr(session_result, 'count', 0) or len(session_rows))
        except Exception as exc:
            if _is_missing_table_error(exc, 'pos_stocktake_sessions'):
                used_session_table = False
                logger.warning("pos_stocktake_sessions table missing; using movement fallback for stocktake reports")
            else:
                raise

        if not used_session_table:
            movements_query = supabase.table('pos_stock_movements')\
                .select('*')\
                .eq('outlet_id', outlet_id)\
                .eq('reference_type', 'stocktake_session')
            if date_from:
                movements_query = movements_query.gte('movement_date', f"{date_from}T00:00:00")
            if date_to:
                movements_query = movements_query.lte('movement_date', f"{date_to}T23:59:59")

            movement_rows = movements_query.order('movement_date', desc=True).limit(20000).execute().data or []
            grouped: Dict[str, Dict[str, Any]] = {}

            for row in movement_rows:
                session_id = row.get('reference_id')
                if not session_id:
                    continue
                bucket = grouped.get(session_id)
                if not bucket:
                    bucket = {
                        "id": session_id,
                        "outlet_id": outlet_id,
                        "terminal_id": None,
                        "performed_by": row.get('performed_by'),
                        "performed_by_name": None,
                        "started_at": row.get('movement_date'),
                        "completed_at": row.get('movement_date'),
                        "status": "completed",
                        "total_items": 0,
                        "adjusted_items": 0,
                        "unchanged_items": 0,
                        "positive_variance_items": 0,
                        "negative_variance_items": 0,
                        "net_quantity_variance": 0,
                        "total_variance_value": 0.0
                    }
                    grouped[session_id] = bucket

                bucket["total_items"] += 1
                bucket["adjusted_items"] += 1
                quantity_change = int(row.get('quantity_change') or 0)
                bucket["net_quantity_variance"] += quantity_change
                if quantity_change > 0:
                    bucket["positive_variance_items"] += 1
                elif quantity_change < 0:
                    bucket["negative_variance_items"] += 1

                unit_cost = row.get('unit_cost')
                if unit_cost is not None:
                    try:
                        bucket["total_variance_value"] += abs(quantity_change) * float(unit_cost)
                    except Exception:
                        pass

                movement_date = row.get('movement_date')
                if movement_date and (bucket.get("started_at") is None or movement_date < bucket["started_at"]):
                    bucket["started_at"] = movement_date
                if movement_date and (bucket.get("completed_at") is None or movement_date > bucket["completed_at"]):
                    bucket["completed_at"] = movement_date

            fallback_rows = sorted(
                grouped.values(),
                key=lambda item: item.get("completed_at") or "",
                reverse=True
            )
            total = len(fallback_rows)
            session_rows = fallback_rows[offset:offset + size]

        items = [{
            "id": row.get("id"),
            "outlet_id": row.get("outlet_id"),
            "terminal_id": row.get("terminal_id"),
            "performed_by": row.get("performed_by"),
            "performed_by_name": row.get("performed_by_name"),
            "started_at": row.get("started_at"),
            "completed_at": row.get("completed_at"),
            "status": row.get("status") or "completed",
            "total_items": int(row.get("total_items") or 0),
            "adjusted_items": int(row.get("adjusted_items") or 0),
            "unchanged_items": int(row.get("unchanged_items") or 0),
            "positive_variance_items": int(row.get("positive_variance_items") or 0),
            "negative_variance_items": int(row.get("negative_variance_items") or 0),
            "net_quantity_variance": int(row.get("net_quantity_variance") or 0),
            "total_variance_value": float(row.get("total_variance_value") or 0),
            "source": "session_table" if used_session_table else "movement_fallback"
        } for row in session_rows]

        return {
            "items": items,
            "total": total,
            "page": page,
            "size": size
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error listing stocktake reports: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list stocktake reports: {str(e)}"
        )


@router.get("/stocktakes/{session_id}")
async def get_stocktake_report_detail(
    session_id: str,
    outlet_id: str = Query(..., description="Outlet ID"),
    current_user: Dict[str, Any] = Depends(CurrentUser())
):
    """Get stocktake session details including product-level variances."""
    try:
        supabase = get_supabase_admin()
        session_row: Optional[Dict[str, Any]] = None

        try:
            session_result = supabase.table('pos_stocktake_sessions')\
                .select('*')\
                .eq('id', session_id)\
                .eq('outlet_id', outlet_id)\
                .limit(1)\
                .execute()
            session_row = session_result.data[0] if session_result.data else None
        except Exception as exc:
            if not _is_missing_table_error(exc, 'pos_stocktake_sessions'):
                raise

        movement_result = supabase.table('pos_stock_movements')\
            .select('*')\
            .eq('outlet_id', outlet_id)\
            .eq('reference_id', session_id)\
            .eq('reference_type', 'stocktake_session')\
            .order('movement_date', desc=False)\
            .execute()
        movement_rows = movement_result.data or []

        if not session_row and not movement_rows:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Stocktake session not found"
            )

        product_ids = list({row.get('product_id') for row in movement_rows if row.get('product_id')})
        product_map: Dict[str, Dict[str, Any]] = {}
        if product_ids:
            products_result = supabase.table('pos_products')\
                .select('id,name,sku,barcode')\
                .in_('id', product_ids)\
                .execute()
            product_map = {
                str(product.get('id')): product
                for product in (products_result.data or [])
                if product.get('id')
            }

        detail_items: List[Dict[str, Any]] = []
        positive_variance_items = 0
        negative_variance_items = 0
        net_quantity_variance = 0
        total_variance_value = 0.0

        for row in movement_rows:
            product_id = row.get('product_id')
            product = product_map.get(str(product_id), {})
            quantity_before = int(row.get('quantity_before') or 0)
            quantity_after = int(
                row.get('quantity_after')
                or (quantity_before + int(row.get('quantity_change') or 0))
            )
            quantity_change = int(row.get('quantity_change') or (quantity_after - quantity_before))

            if quantity_change > 0:
                positive_variance_items += 1
            elif quantity_change < 0:
                negative_variance_items += 1
            net_quantity_variance += quantity_change

            unit_cost = row.get('unit_cost')
            variance_value = None
            if unit_cost is not None:
                try:
                    variance_value = abs(quantity_change) * float(unit_cost)
                    total_variance_value += variance_value
                except Exception:
                    variance_value = None

            parsed_notes = _extract_stocktake_reason_and_notes(row.get('notes'))
            detail_items.append({
                "movement_id": row.get('id'),
                "product_id": product_id,
                "product_name": product.get('name') or 'Unknown product',
                "sku": product.get('sku'),
                "barcode": product.get('barcode'),
                "system_quantity": quantity_before,
                "counted_quantity": quantity_after,
                "quantity_change": quantity_change,
                "reason": parsed_notes.get("reason"),
                "notes": parsed_notes.get("notes"),
                "unit_cost": float(unit_cost) if unit_cost is not None else None,
                "variance_value": variance_value,
                "movement_date": row.get('movement_date')
            })

        if session_row:
            session = {
                "id": session_row.get("id"),
                "outlet_id": session_row.get("outlet_id"),
                "terminal_id": session_row.get("terminal_id"),
                "performed_by": session_row.get("performed_by"),
                "performed_by_name": session_row.get("performed_by_name"),
                "started_at": session_row.get("started_at"),
                "completed_at": session_row.get("completed_at"),
                "status": session_row.get("status") or "completed",
                "total_items": int(session_row.get("total_items") or len(detail_items)),
                "adjusted_items": int(session_row.get("adjusted_items") or len(detail_items)),
                "unchanged_items": int(session_row.get("unchanged_items") or 0),
                "positive_variance_items": int(session_row.get("positive_variance_items") or positive_variance_items),
                "negative_variance_items": int(session_row.get("negative_variance_items") or negative_variance_items),
                "net_quantity_variance": int(session_row.get("net_quantity_variance") or net_quantity_variance),
                "total_variance_value": float(session_row.get("total_variance_value") or total_variance_value),
                "notes": session_row.get("notes")
            }
        else:
            started_at = detail_items[0]["movement_date"] if detail_items else None
            completed_at = detail_items[-1]["movement_date"] if detail_items else None
            performed_by = movement_rows[0].get("performed_by") if movement_rows else None
            session = {
                "id": session_id,
                "outlet_id": outlet_id,
                "terminal_id": None,
                "performed_by": performed_by,
                "performed_by_name": None,
                "started_at": started_at,
                "completed_at": completed_at,
                "status": "completed",
                "total_items": len(detail_items),
                "adjusted_items": len(detail_items),
                "unchanged_items": 0,
                "positive_variance_items": positive_variance_items,
                "negative_variance_items": negative_variance_items,
                "net_quantity_variance": net_quantity_variance,
                "total_variance_value": total_variance_value,
                "notes": None
            }

        return {
            "session": session,
            "items": detail_items
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error loading stocktake report detail for {session_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load stocktake report detail: {str(e)}"
        )
