"""
Financial reports endpoints
Daily, weekly, monthly summaries with sales, expenses, and profit breakdowns.
"""

from fastapi import APIRouter, HTTPException, Depends, status, Query
from typing import Optional, Dict, Any, List
from datetime import datetime, date, timedelta
import logging
import json

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
