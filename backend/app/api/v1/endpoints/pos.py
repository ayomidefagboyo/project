"""
POS System API Endpoints
Nigerian Supermarket Focus
"""

from fastapi import APIRouter, HTTPException, Depends, status, Query, Header, Body
from typing import List, Optional, Dict, Any, Tuple, Set
from datetime import datetime, date, timedelta
import uuid
import logging
import json
import re
from decimal import Decimal

from app.core.database import get_supabase_admin, Tables
from app.core.security import CurrentUser
from app.services.staff_service import StaffService
from app.schemas.pos import (
    # Products
    POSProductCreate, POSProductUpdate, POSProductResponse,
    ProductListResponse, ProductSearchRequest,
    DepartmentCreate, DepartmentUpdate, DepartmentResponse, DepartmentListResponse,
    ProductBulkImportRequest, ProductBulkImportResponse, ProductBulkImportError,
    # Transactions
    POSTransactionCreate, POSTransactionResponse,
    TransactionListResponse, TransactionSearchRequest,
    # Inventory
    StockMovementCreate, StockMovementResponse,
    StocktakeCommitRequest, StocktakeCommitResponse,
    InventoryTransferCreate, InventoryTransferResponse,
    # Cash Drawer
    CashDrawerSessionCreate, CashDrawerSessionClose, CashDrawerSessionResponse,
    # Statistics
    InventoryStatsResponse, SalesStatsResponse,
    # Held Receipts
    HeldReceiptCreate, HeldReceiptResponse, HeldReceiptListResponse,
    # Staff Profiles
    StaffProfileCreate, StaffProfileUpdate, StaffProfileResponse,
    StaffProfileListResponse, StaffPinAuth, StaffAuthResponse,
    # Pharmacy patients
    PatientProfileCreate, PatientProfileUpdate, PatientProfileResponse, PatientProfileListResponse,
    PatientVitalCreate, PatientVitalResponse, PatientVitalListResponse,
    # Receipt Settings
    ReceiptSettingsUpdate, ReceiptSettingsResponse,
    # Base types
    PaymentMethod, TransactionStatus, MovementType, SyncStatus, ReceiptType, TransferStatus
)

router = APIRouter()
logger = logging.getLogger(__name__)
PAYMENT_METHOD_VALUES = {method.value for method in PaymentMethod}


def _is_missing_cashier_name_error(exc: Exception) -> bool:
    """Detect schema/cache errors for missing pos_transactions.cashier_name."""
    message = str(exc).lower()
    return (
        "cashier_name" in message
        and (
            "does not exist" in message
            or "could not find" in message
            or "schema cache" in message
            or "pgrst204" in message
            or "42703" in message
        )
    )


def _extract_missing_column_name(exc: Exception) -> Optional[str]:
    """Extract missing-column name from PostgREST/Postgres error text."""
    message = str(exc)
    patterns = [
        r"Could not find the '([^']+)' column",
        r'column "([^"]+)" of relation "[^"]+" does not exist',
        r'column "([^"]+)" does not exist',
        r"column '([^']+)' does not exist",
    ]
    for pattern in patterns:
        match = re.search(pattern, message, flags=re.IGNORECASE)
        if match:
            return match.group(1)
    return None


def _is_missing_table_error(exc: Exception, table_name: str) -> bool:
    """Detect missing-table errors from PostgREST/Postgres payloads."""
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


def _insert_pos_transaction_compat(supabase, transaction_data: Dict[str, Any]):
    """
    Insert into pos_transactions with backward compatibility for older schemas.
    If a column is missing in prod schema cache, remove it and retry.
    """
    payload = dict(transaction_data)
    removed_columns = []

    for _ in range(12):
        try:
            return supabase.table('pos_transactions').insert(payload).execute()
        except Exception as exc:
            missing_column = _extract_missing_column_name(exc)

            # Keep explicit legacy check for existing known production failure shape.
            if not missing_column and _is_missing_cashier_name_error(exc):
                missing_column = 'cashier_name'

            if missing_column and missing_column in payload:
                payload.pop(missing_column, None)
                removed_columns.append(missing_column)
                logger.warning(
                    "pos_transactions.%s missing in schema cache; retrying insert without it",
                    missing_column
                )
                continue

            # Not a missing-column issue we can recover from.
            raise

    raise RuntimeError(
        f"Failed to insert pos_transactions after compatibility retries; removed columns={removed_columns}"
    )


def _insert_cash_drawer_session_compat(supabase, session_data: Dict[str, Any]):
    """
    Insert into pos_cash_drawer_sessions with backward compatibility for older schemas.
    If a column is missing in schema cache, remove it and retry.
    """
    payload = dict(session_data)
    removed_columns = []

    for _ in range(12):
        try:
            return supabase.table(Tables.CASH_DRAWER_SESSIONS).insert(payload).execute()
        except Exception as exc:
            missing_column = _extract_missing_column_name(exc)
            if missing_column and missing_column in payload:
                payload.pop(missing_column, None)
                removed_columns.append(missing_column)
                logger.warning(
                    "pos_cash_drawer_sessions.%s missing in schema cache; retrying insert without it",
                    missing_column
                )
                continue
            raise

    raise RuntimeError(
        f"Failed to insert pos_cash_drawer_sessions after compatibility retries; removed columns={removed_columns}"
    )


def _insert_pos_product_compat(supabase, product_data: Dict[str, Any]):
    """
    Insert into pos_products with backward compatibility for older schemas.
    If a column is missing in prod schema cache, remove it and retry.
    """
    payload = dict(product_data)
    removed_columns = []

    for _ in range(12):
        try:
            return supabase.table('pos_products').insert(payload).execute()
        except Exception as exc:
            missing_column = _extract_missing_column_name(exc)

            if missing_column and missing_column in payload:
                payload.pop(missing_column, None)
                removed_columns.append(missing_column)
                logger.warning(
                    "pos_products.%s missing in schema cache; retrying insert without it",
                    missing_column
                )
                continue

            raise

    raise RuntimeError(
        f"Failed to insert pos_products after compatibility retries; removed columns={removed_columns}"
    )


def _upsert_pos_products_compat(supabase, rows: List[Dict[str, Any]]):
    """
    Upsert pos_products rows with backward compatibility for older schemas.
    If a column is missing in prod schema cache, remove it from all rows and retry.
    """
    payload_rows = [dict(row) for row in rows]
    removed_columns: List[str] = []

    for _ in range(12):
        try:
            return supabase.table(Tables.POS_PRODUCTS).upsert(payload_rows).execute()
        except Exception as exc:
            missing_column = _extract_missing_column_name(exc)
            if not missing_column:
                raise

            removed_any = False
            for row in payload_rows:
                if missing_column in row:
                    row.pop(missing_column, None)
                    removed_any = True

            if removed_any:
                removed_columns.append(missing_column)
                logger.warning(
                    "pos_products.%s missing in schema cache; retrying upsert chunk without it",
                    missing_column
                )
                continue

            raise

    raise RuntimeError(
        f"Failed to upsert pos_products after compatibility retries; removed columns={removed_columns}"
    )


def _update_pos_product_compat(supabase, product_id: str, update_data: Dict[str, Any]):
    """
    Update one pos_products row with backward compatibility for older schemas.
    If a column is missing in schema cache, remove it and retry.
    """
    payload = dict(update_data)
    removed_columns: List[str] = []

    for _ in range(12):
        try:
            return supabase.table('pos_products').update(payload).eq('id', product_id).execute()
        except Exception as exc:
            missing_column = _extract_missing_column_name(exc)
            if missing_column and missing_column in payload:
                payload.pop(missing_column, None)
                removed_columns.append(missing_column)
                logger.warning(
                    "pos_products.%s missing in schema cache; retrying update without it",
                    missing_column
                )
                if not payload:
                    break
                continue
            raise

    raise RuntimeError(
        f"Failed to update pos_products after compatibility retries; removed columns={removed_columns}"
    )


def _insert_pos_transaction_items_compat(supabase, rows: List[Dict[str, Any]]):
    """
    Insert pos_transaction_items rows with backward compatibility for older schemas.
    If a column is missing in schema cache, remove it from all rows and retry.
    """
    payload_rows = [dict(row) for row in rows]
    removed_columns: List[str] = []

    for _ in range(12):
        try:
            return supabase.table('pos_transaction_items').insert(payload_rows).execute()
        except Exception as exc:
            missing_column = _extract_missing_column_name(exc)
            if not missing_column:
                raise

            removed_any = False
            for row in payload_rows:
                if missing_column in row:
                    row.pop(missing_column, None)
                    removed_any = True

            if removed_any:
                removed_columns.append(missing_column)
                logger.warning(
                    "pos_transaction_items.%s missing in schema cache; retrying insert without it",
                    missing_column
                )
                continue
            raise

    raise RuntimeError(
        "Failed to insert pos_transaction_items after compatibility retries; "
        f"removed columns={removed_columns}"
    )


def _insert_pos_departments_compat(supabase, rows: List[Dict[str, Any]]) -> Tuple[Any, List[str]]:
    """
    Insert pos_departments rows with backward compatibility for older schemas.
    Returns the supabase result and the list of removed columns.
    """
    payload_rows = [dict(row) for row in rows]
    removed_columns: List[str] = []

    for _ in range(12):
        try:
            result = supabase.table(Tables.POS_DEPARTMENTS).insert(payload_rows).execute()
            return result, removed_columns
        except Exception as exc:
            missing_column = _extract_missing_column_name(exc)
            if not missing_column:
                raise

            removed_any = False
            for row in payload_rows:
                if missing_column in row:
                    row.pop(missing_column, None)
                    removed_any = True

            if removed_any:
                removed_columns.append(missing_column)
                logger.warning(
                    "pos_departments.%s missing in schema cache; retrying insert without it",
                    missing_column
                )
                continue

            raise

    raise RuntimeError(
        f"Failed to insert pos_departments after compatibility retries; removed columns={removed_columns}"
    )


def _update_pos_department_compat(
    supabase,
    department_id: str,
    update_data: Dict[str, Any]
) -> Tuple[Any, List[str]]:
    """
    Update one pos_departments row with backward compatibility for older schemas.
    Returns the supabase result and the list of removed columns.
    """
    payload = dict(update_data)
    removed_columns: List[str] = []

    for _ in range(12):
        try:
            result = supabase.table(Tables.POS_DEPARTMENTS).update(payload).eq('id', department_id).execute()
            return result, removed_columns
        except Exception as exc:
            missing_column = _extract_missing_column_name(exc)
            if missing_column and missing_column in payload:
                payload.pop(missing_column, None)
                removed_columns.append(missing_column)
                logger.warning(
                    "pos_departments.%s missing in schema cache; retrying update without it",
                    missing_column
                )
                if not payload:
                    break
                continue
            raise

    raise RuntimeError(
        f"Failed to update pos_departments after compatibility retries; removed columns={removed_columns}"
    )


def _removed_department_policy_columns(removed_columns: List[str]) -> List[str]:
    """Return removed department policy column names from a compatibility retry pass."""
    policy_columns = {'default_markup_percentage', 'auto_pricing_enabled'}
    return [column for column in removed_columns if column in policy_columns]


def _insert_stocktake_session_compat(supabase, session_data: Dict[str, Any]):
    """
    Insert into pos_stocktake_sessions with backward compatibility.
    Removes missing columns and retries until success or non-recoverable error.
    """
    payload = dict(session_data)
    removed_columns: List[str] = []

    for _ in range(12):
        try:
            return supabase.table('pos_stocktake_sessions').insert(payload).execute()
        except Exception as exc:
            if _is_missing_table_error(exc, 'pos_stocktake_sessions'):
                raise

            missing_column = _extract_missing_column_name(exc)
            if missing_column and missing_column in payload:
                payload.pop(missing_column, None)
                removed_columns.append(missing_column)
                logger.warning(
                    "pos_stocktake_sessions.%s missing in schema cache; retrying insert without it",
                    missing_column
                )
                continue
            raise

    raise RuntimeError(
        f"Failed to insert pos_stocktake_sessions after compatibility retries; removed columns={removed_columns}"
    )


def _rollback_stocktake_changes(
    supabase,
    product_rollbacks: List[Tuple[str, int]],
    movement_ids: List[str]
) -> None:
    """
    Best-effort rollback for stocktake commit failures after partial writes.
    """
    if movement_ids:
        try:
            supabase.table('pos_stock_movements').delete().in_('id', movement_ids).execute()
        except Exception as rollback_error:
            logger.error("Rollback failed while deleting stock movements: %s", rollback_error)

    # Restore product stock levels in reverse application order.
    for product_id, previous_quantity in reversed(product_rollbacks):
        try:
            supabase.table('pos_products').update({
                'quantity_on_hand': previous_quantity,
                'updated_at': datetime.utcnow().isoformat()
            }).eq('id', product_id).execute()
        except Exception as rollback_error:
            logger.error(
                "Rollback failed while restoring product %s quantity to %s: %s",
                product_id,
                previous_quantity,
                rollback_error
            )


def _safe_json_loads(value: Any) -> Dict[str, Any]:
    """Parse JSON notes safely and return an object."""
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


def _normalize_split_payments(raw_split_payments: Any) -> List[Dict[str, Any]]:
    """Normalize split payment payload into a safe serializable list."""
    if not isinstance(raw_split_payments, list):
        return []

    normalized: List[Dict[str, Any]] = []
    for item in raw_split_payments:
        candidate = item
        if hasattr(item, "dict"):
            try:
                candidate = item.dict()
            except Exception:
                candidate = item
        if not isinstance(candidate, dict):
            continue

        method_raw = str(candidate.get("method") or "").strip().lower()
        if method_raw not in PAYMENT_METHOD_VALUES:
            continue

        try:
            amount = Decimal(str(candidate.get("amount") or 0))
        except Exception:
            continue
        if amount <= 0:
            continue

        row: Dict[str, Any] = {
            "method": method_raw,
            "amount": float(amount),
        }
        reference = candidate.get("reference")
        if isinstance(reference, str) and reference.strip():
            row["reference"] = reference.strip()
        normalized.append(row)

    return normalized


def _build_persisted_transaction_notes(
    notes: Optional[str],
    split_payments: List[Dict[str, Any]],
    metadata: Optional[Dict[str, Any]] = None
) -> Optional[str]:
    """Persist free-form note and split metadata in one notes payload."""
    note_text = notes.strip() if isinstance(notes, str) else ""

    payload: Dict[str, Any] = {}
    if split_payments:
        payload["split_payments"] = split_payments

    if isinstance(metadata, dict):
        for key, value in metadata.items():
            if value is None:
                continue
            if isinstance(value, str) and not value.strip():
                continue
            payload[key] = value

    if note_text:
        payload["note"] = note_text

    if payload:
        return json.dumps(payload, separators=(",", ":"))
    return note_text or None


def _extract_split_payments_from_record(record: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Read split payments from a first-class column, fallback to legacy notes payload."""
    direct = _normalize_split_payments(record.get("split_payments"))
    if direct:
        return direct

    notes_data = _safe_json_loads(record.get("notes"))
    return _normalize_split_payments(notes_data.get("split_payments"))


def _extract_display_note_from_record(record: Dict[str, Any]) -> Optional[str]:
    """Return only user-facing note text, never raw structured JSON metadata."""
    notes_value = record.get("notes")
    if not isinstance(notes_value, str):
        return None

    notes_value = notes_value.strip()
    if not notes_value:
        return None

    parsed = _safe_json_loads(notes_value)
    if parsed:
        candidate = parsed.get("note") or parsed.get("notes") or parsed.get("message")
        if isinstance(candidate, str) and candidate.strip():
            return candidate.strip()
        return None

    return notes_value


def _extract_cashier_staff_profile_id_from_record(record: Dict[str, Any]) -> Optional[str]:
    """Resolve cashier staff profile id from first-class column or notes payload metadata."""
    direct_value = str(record.get("cashier_staff_profile_id") or "").strip()
    if direct_value:
        return direct_value

    notes_data = _safe_json_loads(record.get("notes"))
    note_value = str(notes_data.get("cashier_staff_profile_id") or "").strip()
    return note_value or None


def _decorate_transaction_record(record: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize transaction payload for API response contracts."""
    row = dict(record)
    split_payments = _extract_split_payments_from_record(row)
    staff_profile_id = _extract_cashier_staff_profile_id_from_record(row)
    if staff_profile_id:
        # API contract: cashier_id represents POS staff identity.
        row["cashier_id"] = staff_profile_id
    row["split_payments"] = split_payments or None
    row["notes"] = _extract_display_note_from_record(row)
    return row


def _allocate_transaction_amount_by_method(record: Dict[str, Any]) -> Dict[str, Decimal]:
    """Allocate a transaction amount across payment methods (split-aware)."""
    total_amount = Decimal(str(record.get("total_amount") or 0))
    split_payments = _extract_split_payments_from_record(record)

    if len(split_payments) > 1:
        allocations: Dict[str, Decimal] = {}
        allocated_total = Decimal(0)
        for split in split_payments:
            method = str(split.get("method") or "").strip().lower()
            if not method:
                continue
            try:
                amount = Decimal(str(split.get("amount") or 0))
            except Exception:
                continue
            if amount <= 0:
                continue
            allocations[method] = allocations.get(method, Decimal(0)) + amount
            allocated_total += amount

        if not allocations:
            fallback_method = str(record.get("payment_method") or "cash").strip().lower() or "cash"
            return {fallback_method: total_amount}

        remainder = total_amount - allocated_total
        if abs(remainder) <= Decimal("0.01") and remainder != 0:
            fallback_method = (
                str(split_payments[0].get("method") or "").strip().lower()
                or str(record.get("payment_method") or "cash").strip().lower()
                or "cash"
            )
            allocations[fallback_method] = allocations.get(fallback_method, Decimal(0)) + remainder

        return allocations

    method = str(record.get("payment_method") or "cash").strip().lower() or "cash"
    return {method: total_amount}


def _normalize_optional_uuid(value: Optional[str], field_name: str) -> Optional[str]:
    """Return canonical UUID string or None when value is empty/invalid."""
    if value is None:
        return None

    raw = str(value).strip()
    if not raw:
        return None

    try:
        return str(uuid.UUID(raw))
    except Exception:
        logger.warning("Ignoring non-UUID %s value during POS transaction create", field_name)
        return None


def _safe_int(value: Any, default: int = 0) -> int:
    try:
        if value is None:
            return default
        return int(value)
    except Exception:
        return default


def _resolve_stock_quantity_from_transaction_item(item: Dict[str, Any]) -> int:
    """
    Resolve inventory-impact quantity from a transaction item record.
    Prefers base_units_quantity, then quantity * units_per_sale_unit, then quantity.
    """
    base_units = _safe_int(item.get('base_units_quantity'), -1)
    if base_units > 0:
        return base_units

    quantity = _safe_int(item.get('quantity'), 0)
    units_per_sale_unit = max(1, _safe_int(item.get('units_per_sale_unit'), 1))
    computed = quantity * units_per_sale_unit
    return computed if computed > 0 else max(0, quantity)


MANAGER_LEVEL_ROLES = {'manager', 'admin', 'business_owner', 'outlet_admin', 'super_admin'}
PHARMACY_ONLY_ROLES = {'pharmacist', 'accountant'}
INVENTORY_EDITOR_ROLES = MANAGER_LEVEL_ROLES | {'pharmacist', 'accountant', 'inventory_staff'}
STOCKTAKE_EDITOR_ROLES = MANAGER_LEVEL_ROLES | PHARMACY_ONLY_ROLES
DISCOUNT_ALLOWED_ROLES = MANAGER_LEVEL_ROLES | PHARMACY_ONLY_ROLES
DISCOUNT_PERMISSION_KEYS = {'apply_discounts', 'manage_discounts'}
VOID_ALLOWED_ROLES = MANAGER_LEVEL_ROLES | PHARMACY_ONLY_ROLES
VOID_PERMISSION_KEYS = {'void_transactions', 'pos:void_transaction'}
RETURN_ALLOWED_ROLES = VOID_ALLOWED_ROLES
RETURN_PERMISSION_KEYS = {'refund_transactions', 'process_returns', 'void_transactions', 'pos:void_transaction'}


def _normalize_role(role: Any) -> str:
    return str(role or '').strip().lower()


def _normalize_permissions(permissions: Any) -> List[str]:
    if not isinstance(permissions, list):
        return []
    normalized: List[str] = []
    for value in permissions:
        if isinstance(value, str):
            cleaned = value.strip().lower()
            if cleaned:
                normalized.append(cleaned)
    return normalized


def _can_apply_discount(context: Dict[str, Any]) -> bool:
    role = _normalize_role(context.get('role'))
    if role in DISCOUNT_ALLOWED_ROLES:
        return True

    permissions = set(_normalize_permissions(context.get('permissions')))
    return any(key in permissions for key in DISCOUNT_PERMISSION_KEYS)


def _has_any_permission(context: Dict[str, Any], permission_keys: Set[str]) -> bool:
    permissions = set(_normalize_permissions(context.get('permissions')))
    return any(key in permissions for key in permission_keys)


def _can_void_transaction(context: Dict[str, Any]) -> bool:
    role = _normalize_role(context.get('role'))
    if role in VOID_ALLOWED_ROLES:
        return True
    return _has_any_permission(context, VOID_PERMISSION_KEYS)


def _can_process_return(context: Dict[str, Any]) -> bool:
    role = _normalize_role(context.get('role'))
    if role in RETURN_ALLOWED_ROLES:
        return True
    return _has_any_permission(context, RETURN_PERMISSION_KEYS)


def _resolve_staff_context(
    supabase,
    current_user: Dict[str, Any],
    outlet_id: Optional[str],
    staff_session_token: Optional[str]
) -> Dict[str, Any]:
    """
    Resolve effective actor role for POS operations.
    Preference order:
    1) Verified POS staff session header
    2) Current authenticated API user role
    """
    fallback_context = {
        'role': _normalize_role(current_user.get('role')),
        'source': 'api_user',
        'staff_profile_id': None,
        'outlet_id': outlet_id,
        'permissions': _normalize_permissions(current_user.get('permissions'))
    }

    if not staff_session_token:
        return fallback_context

    payload = StaffService.parse_session_token(staff_session_token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired POS staff session"
        )

    staff_profile_id = payload.get('staff_profile_id')
    if not staff_profile_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid POS staff session payload"
        )

    profile_result = supabase.table(Tables.STAFF_PROFILES)\
        .select('id,outlet_id,role,permissions,is_active')\
        .eq('id', staff_profile_id)\
        .execute()
    profile = profile_result.data[0] if profile_result.data else None

    if not profile or not profile.get('is_active'):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Staff session is no longer active"
        )

    profile_outlet_id = profile.get('outlet_id')
    if outlet_id and profile_outlet_id and profile_outlet_id != outlet_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Staff session does not match this outlet"
        )

    return {
        'role': _normalize_role(profile.get('role')),
        'source': 'staff_session',
        'staff_profile_id': profile.get('id'),
        'outlet_id': profile_outlet_id or outlet_id,
        'permissions': _normalize_permissions(profile.get('permissions'))
    }


def _require_manager_role(
    supabase,
    current_user: Dict[str, Any],
    outlet_id: Optional[str],
    staff_session_token: Optional[str]
) -> Dict[str, Any]:
    context = _resolve_staff_context(supabase, current_user, outlet_id, staff_session_token)
    if context['role'] in MANAGER_LEVEL_ROLES:
        return context
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Manager authorization required for this action"
    )


def _require_void_authorization(
    supabase,
    current_user: Dict[str, Any],
    outlet_id: Optional[str],
    staff_session_token: Optional[str]
) -> Dict[str, Any]:
    context = _resolve_staff_context(supabase, current_user, outlet_id, staff_session_token)
    if _can_void_transaction(context):
        return context
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Manager/pharmacist (or authorized cashier) is required to void transactions"
    )


def _require_return_authorization(
    supabase,
    current_user: Dict[str, Any],
    outlet_id: Optional[str],
    staff_session_token: Optional[str]
) -> Dict[str, Any]:
    context = _resolve_staff_context(supabase, current_user, outlet_id, staff_session_token)
    if _can_process_return(context):
        return context
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Manager/pharmacist (or authorized cashier) is required to process returns"
    )


def _require_pharmacist_role(
    supabase,
    current_user: Dict[str, Any],
    outlet_id: Optional[str],
    staff_session_token: Optional[str]
) -> Dict[str, Any]:
    context = _resolve_staff_context(supabase, current_user, outlet_id, staff_session_token)
    if context['role'] in PHARMACY_ONLY_ROLES:
        return context
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Pharmacist authorization required for this action"
    )


def _require_inventory_editor_role(
    supabase,
    current_user: Dict[str, Any],
    outlet_id: Optional[str],
    staff_session_token: Optional[str]
) -> Dict[str, Any]:
    context = _resolve_staff_context(supabase, current_user, outlet_id, staff_session_token)
    if context['role'] in INVENTORY_EDITOR_ROLES:
        return context
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Inventory edit authorization required for this action"
    )


def _require_stocktake_role(
    supabase,
    current_user: Dict[str, Any],
    outlet_id: Optional[str],
    staff_session_token: Optional[str]
) -> Dict[str, Any]:
    context = _resolve_staff_context(supabase, current_user, outlet_id, staff_session_token)
    if context['role'] in STOCKTAKE_EDITOR_ROLES:
        return context
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Stocktaking authorization required (manager or pharmacist)"
    )


def _resolve_actor_user_id(current_user: Dict[str, Any]) -> str:
    """Resolve authenticated user id for DB columns referencing users(id)."""
    actor_user_id = str(current_user.get('id') or '').strip()
    if not actor_user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authenticated user id is required"
        )
    return actor_user_id


def _normalize_department_name(value: Any) -> Optional[str]:
    raw = str(value or '').strip()
    if not raw:
        return None
    normalized = re.sub(r'\s+', ' ', raw)
    return normalized[:100]


def _normalize_department_code(value: Any, fallback_name: str) -> str:
    raw = str(value or '').strip().upper()
    if raw:
        cleaned = re.sub(r'[^A-Z0-9-]+', '', raw).strip('-')
        if cleaned:
            return cleaned[:30]

    fallback = re.sub(r'[^A-Z0-9]+', '-', fallback_name.upper()).strip('-')
    if fallback:
        return fallback[:30]
    return f"DEPT-{uuid.uuid4().hex[:6].upper()}"


def _get_department_table_rows(
    supabase,
    outlet_id: str,
    include_inactive: bool = False
) -> List[Dict[str, Any]]:
    query = supabase.table(Tables.POS_DEPARTMENTS).select('*').eq('outlet_id', outlet_id)
    if not include_inactive:
        query = query.eq('is_active', True)
    result = query.order('sort_order').order('name').execute()
    return result.data or []


def _get_department_category_names_from_products(
    supabase,
    outlet_id: str
) -> List[str]:
    product_result = supabase.table(Tables.POS_PRODUCTS)\
        .select('category')\
        .eq('outlet_id', outlet_id)\
        .execute()

    names_by_key: Dict[str, str] = {}
    for row in product_result.data or []:
        normalized = _normalize_department_name(row.get('category'))
        if not normalized:
            continue
        key = normalized.lower()
        if key not in names_by_key:
            names_by_key[key] = normalized

    return sorted(names_by_key.values(), key=lambda value: value.lower())


def _list_departments_with_product_categories(
    supabase,
    outlet_id: str,
    include_inactive: bool = False
) -> List[Dict[str, Any]]:
    table_rows: List[Dict[str, Any]] = []
    table_missing = False

    try:
        table_rows = _get_department_table_rows(supabase, outlet_id, include_inactive=include_inactive)
    except Exception as exc:
        if _is_missing_table_error(exc, Tables.POS_DEPARTMENTS):
            table_missing = True
            table_rows = []
        else:
            raise

    merged_by_name: Dict[str, Dict[str, Any]] = {}
    for row in table_rows:
        normalized_name = _normalize_department_name(row.get('name'))
        if not normalized_name:
            continue
        key = normalized_name.lower()
        merged = dict(row)
        merged['name'] = normalized_name
        merged['source'] = merged.get('source') or 'master'
        if merged.get('default_markup_percentage') is None:
            merged['default_markup_percentage'] = Decimal('30')
        if merged.get('auto_pricing_enabled') is None:
            merged['auto_pricing_enabled'] = True
        merged_by_name[key] = merged

    category_names = _get_department_category_names_from_products(supabase, outlet_id)
    for index, category_name in enumerate(category_names):
        key = category_name.lower()
        if key in merged_by_name:
            continue
        synthetic_id = f"category-{index + 1}-{re.sub(r'[^a-z0-9]+', '-', key).strip('-') or uuid.uuid4().hex[:8]}"
        merged_by_name[key] = {
            'id': synthetic_id,
            'outlet_id': outlet_id,
            'name': category_name,
            'code': _normalize_department_code('', category_name),
            'description': None,
            'sort_order': 9999,
            'default_markup_percentage': Decimal('30'),
            'auto_pricing_enabled': True,
            'is_active': True,
            'source': 'product_category',
            'created_at': None,
            'updated_at': None
        }

    rows = list(merged_by_name.values())
    if not include_inactive:
        rows = [row for row in rows if row.get('is_active', True)]

    rows.sort(key=lambda row: (row.get('sort_order', 0), str(row.get('name') or '').lower()))

    if table_missing and not rows:
        logger.info("Department table missing and no product categories yet for outlet %s", outlet_id)

    return rows


def _ensure_departments_exist(
    supabase,
    outlet_id: str,
    category_values: List[Optional[str]]
) -> None:
    normalized_names: Dict[str, str] = {}
    for value in category_values:
        normalized = _normalize_department_name(value)
        if not normalized:
            continue
        key = normalized.lower()
        if key not in normalized_names:
            normalized_names[key] = normalized

    if not normalized_names:
        return

    try:
        existing_rows = _get_department_table_rows(supabase, outlet_id, include_inactive=True)
    except Exception as exc:
        if _is_missing_table_error(exc, Tables.POS_DEPARTMENTS):
            return
        logger.warning("Unable to load departments for outlet %s: %s", outlet_id, exc)
        return

    existing_by_key: Dict[str, Dict[str, Any]] = {}
    max_sort_order = 0
    for row in existing_rows:
        name = _normalize_department_name(row.get('name'))
        if name:
            existing_by_key[name.lower()] = row
        sort_order = int(row.get('sort_order') or 0)
        if sort_order > max_sort_order:
            max_sort_order = sort_order

    rows_to_insert: List[Dict[str, Any]] = []
    rows_to_activate: List[str] = []
    now_iso = datetime.utcnow().isoformat()

    for key, name in normalized_names.items():
        existing = existing_by_key.get(key)
        if existing:
            if existing.get('is_active') is False:
                rows_to_activate.append(str(existing.get('id')))
            continue

        max_sort_order += 1
        rows_to_insert.append({
            'id': str(uuid.uuid4()),
            'outlet_id': outlet_id,
            'name': name,
            'code': _normalize_department_code('', name),
            'description': None,
            'sort_order': max_sort_order,
            'default_markup_percentage': Decimal('30'),
            'auto_pricing_enabled': True,
            'is_active': True,
            'created_at': now_iso,
            'updated_at': now_iso
        })

    for department_id in rows_to_activate:
        try:
            supabase.table(Tables.POS_DEPARTMENTS).update({
                'is_active': True,
                'updated_at': now_iso
            }).eq('id', department_id).execute()
        except Exception as exc:
            logger.warning("Failed to reactivate department %s: %s", department_id, exc)

    if not rows_to_insert:
        return

    try:
        _insert_pos_departments_compat(supabase, rows_to_insert)
    except Exception as exc:
        logger.warning(
            "Failed to create department records for outlet %s during product flow: %s",
            outlet_id,
            exc
        )


# ===============================================
# PRODUCT MANAGEMENT ENDPOINTS
# ===============================================

@router.get("/departments", response_model=DepartmentListResponse)
async def get_departments(
    outlet_id: str,
    include_inactive: bool = Query(False, description="Include inactive departments"),
    current_user=Depends(CurrentUser())
):
    """List departments for an outlet, merged with existing product category values."""
    try:
        supabase = get_supabase_admin()
        rows = _list_departments_with_product_categories(
            supabase,
            outlet_id=outlet_id,
            include_inactive=include_inactive
        )
        return DepartmentListResponse(items=rows, total=len(rows))
    except Exception as e:
        logger.error(f"Error fetching departments: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch departments: {str(e)}"
        )


@router.post("/departments", response_model=DepartmentResponse)
async def create_department(
    department: DepartmentCreate,
    x_pos_staff_session: Optional[str] = Header(None, alias="X-POS-Staff-Session"),
    current_user=Depends(CurrentUser())
):
    """Create a department for product categorization."""
    try:
        supabase = get_supabase_admin()
        _require_manager_role(supabase, current_user, department.outlet_id, x_pos_staff_session)

        try:
            existing_rows = _get_department_table_rows(
                supabase,
                outlet_id=department.outlet_id,
                include_inactive=True
            )
        except Exception as exc:
            if _is_missing_table_error(exc, Tables.POS_DEPARTMENTS):
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Department master is not available yet. Run the latest POS migration and retry."
                )
            raise

        department_name = _normalize_department_name(department.name)
        if not department_name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Department name is required"
            )

        name_key = department_name.lower()
        now_iso = datetime.utcnow().isoformat()

        for row in existing_rows:
            existing_name = _normalize_department_name(row.get('name'))
            if not existing_name or existing_name.lower() != name_key:
                continue

            if row.get('is_active') is False:
                reactivate, removed_columns = _update_pos_department_compat(supabase, str(row.get('id')), {
                    'is_active': True,
                    'sort_order': department.sort_order,
                    'description': department.description,
                    'code': _normalize_department_code(department.code, department_name),
                    'default_markup_percentage': float(department.default_markup_percentage),
                    'auto_pricing_enabled': department.auto_pricing_enabled,
                    'updated_at': now_iso
                })
                removed_policy_columns = _removed_department_policy_columns(removed_columns)
                if removed_policy_columns:
                    logger.warning(
                        "Department policy columns missing during reactivation for outlet %s; "
                        "continuing with compatibility mode (columns=%s)",
                        department.outlet_id,
                        ','.join(removed_policy_columns)
                    )
                if reactivate.data:
                    row = reactivate.data[0]

            result_row = dict(row)
            result_row['name'] = existing_name
            if result_row.get('default_markup_percentage') is None:
                result_row['default_markup_percentage'] = float(department.default_markup_percentage)
            if result_row.get('auto_pricing_enabled') is None:
                result_row['auto_pricing_enabled'] = department.auto_pricing_enabled
            result_row['source'] = 'master'
            return DepartmentResponse(**result_row)

        payload = {
            'id': str(uuid.uuid4()),
            'outlet_id': department.outlet_id,
            'name': department_name,
            'code': _normalize_department_code(department.code, department_name),
            'description': department.description,
            'sort_order': department.sort_order,
            'default_markup_percentage': float(department.default_markup_percentage),
            'auto_pricing_enabled': department.auto_pricing_enabled,
            'is_active': True,
            'created_at': now_iso,
            'updated_at': now_iso
        }
        result, removed_columns = _insert_pos_departments_compat(supabase, [payload])
        removed_policy_columns = _removed_department_policy_columns(removed_columns)
        if removed_policy_columns:
            logger.warning(
                "Department policy columns missing during create for outlet %s; "
                "continuing with compatibility mode (columns=%s)",
                department.outlet_id,
                ','.join(removed_policy_columns)
            )
        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to create department"
            )

        created_row = dict(result.data[0])
        created_row['name'] = _normalize_department_name(created_row.get('name')) or department_name
        if created_row.get('default_markup_percentage') is None:
            created_row['default_markup_percentage'] = float(department.default_markup_percentage)
        if created_row.get('auto_pricing_enabled') is None:
            created_row['auto_pricing_enabled'] = department.auto_pricing_enabled
        created_row['source'] = 'master'
        return DepartmentResponse(**created_row)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating department: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create department: {str(e)}"
        )


@router.put("/departments/{department_id}", response_model=DepartmentResponse)
async def update_department(
    department_id: str,
    department: DepartmentUpdate,
    x_pos_staff_session: Optional[str] = Header(None, alias="X-POS-Staff-Session"),
    current_user=Depends(CurrentUser())
):
    """Update a department policy/configuration."""
    try:
        supabase = get_supabase_admin()
        existing = supabase.table(Tables.POS_DEPARTMENTS)\
            .select('id,outlet_id,name')\
            .eq('id', department_id)\
            .limit(1)\
            .execute()

        if not existing.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Department not found"
            )

        outlet_id = existing.data[0].get('outlet_id')
        _require_manager_role(supabase, current_user, outlet_id, x_pos_staff_session)

        update_data = department.model_dump(mode='json', exclude_none=True, exclude_unset=True)
        if not update_data:
            current = supabase.table(Tables.POS_DEPARTMENTS)\
                .select('*')\
                .eq('id', department_id)\
                .limit(1)\
                .execute()
            if not current.data:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Department not found"
                )
            row = dict(current.data[0])
            row['name'] = _normalize_department_name(row.get('name')) or str(existing.data[0].get('name') or '')
            row['source'] = row.get('source') or 'master'
            if row.get('default_markup_percentage') is None:
                row['default_markup_percentage'] = Decimal('30')
            if row.get('auto_pricing_enabled') is None:
                row['auto_pricing_enabled'] = True
            return DepartmentResponse(**row)

        if 'name' in update_data:
            normalized_name = _normalize_department_name(update_data.get('name'))
            if not normalized_name:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Department name cannot be empty"
                )
            update_data['name'] = normalized_name
            if 'code' not in update_data:
                update_data['code'] = _normalize_department_code('', normalized_name)

        if 'code' in update_data:
            normalized_for_code = update_data.get('name') or _normalize_department_name(existing.data[0].get('name')) or ''
            update_data['code'] = _normalize_department_code(update_data.get('code'), normalized_for_code)

        update_data['updated_at'] = datetime.utcnow().isoformat()

        result, removed_columns = _update_pos_department_compat(supabase, department_id, update_data)
        removed_policy_columns = _removed_department_policy_columns(removed_columns)
        if removed_policy_columns:
            logger.warning(
                "Department policy columns missing during update for outlet %s; "
                "continuing with compatibility mode (columns=%s)",
                outlet_id,
                ','.join(removed_policy_columns)
            )

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Department not found"
            )

        row = dict(result.data[0])
        row['name'] = _normalize_department_name(row.get('name')) or str(existing.data[0].get('name') or '')
        if row.get('default_markup_percentage') is None:
            row['default_markup_percentage'] = (
                update_data.get('default_markup_percentage')
                if 'default_markup_percentage' in update_data
                else Decimal('30')
            )
        if row.get('auto_pricing_enabled') is None:
            row['auto_pricing_enabled'] = (
                bool(update_data.get('auto_pricing_enabled'))
                if 'auto_pricing_enabled' in update_data
                else True
            )
        row['source'] = row.get('source') or 'master'
        return DepartmentResponse(**row)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating department {department_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update department: {str(e)}"
        )

@router.get("/products", response_model=ProductListResponse)
async def get_products(
    outlet_id: str,
    page: int = Query(1, ge=1, description="Page number"),
    size: int = Query(20, ge=1, le=100, description="Page size"),
    search: Optional[str] = Query(None, description="Search products"),
    category: Optional[str] = Query(None, description="Filter by category"),
    updated_after: Optional[str] = Query(None, description="Fetch products updated after this ISO timestamp"),
    active_only: bool = Query(True, description="Show only active products"),
    include_total: bool = Query(True, description="Include exact total count (slower on very large catalogs)"),
    current_user=Depends(CurrentUser())
):
    """Get products for POS with pagination and filtering"""
    try:
        supabase = get_supabase_admin()
        offset = (page - 1) * size

        # Build query
        if include_total:
            query = supabase.table(Tables.POS_PRODUCTS).select('*', count='exact').eq('outlet_id', outlet_id)
        else:
            query = supabase.table(Tables.POS_PRODUCTS).select('*').eq('outlet_id', outlet_id)

        if active_only:
            query = query.eq('is_active', True)

        if category:
            query = query.eq('category', category)

        if updated_after:
            query = query.gt('updated_at', updated_after)

        if search:
            # Search in name, sku, or barcode
            query = query.or_(
                f"name.ilike.%{search}%,"
                f"sku.ilike.%{search}%,"
                f"barcode.ilike.%{search}%"
            )

        # Apply pagination + ordering in one query to avoid expensive full-list count fetches.
        query = query.range(offset, offset + size - 1).order('name')

        result = query.execute()
        if include_total:
            total = int(getattr(result, 'count', 0) or len(result.data or []))
        else:
            total = 0

        return ProductListResponse(
            items=result.data or [],
            total=total,
            page=page,
            size=size
        )

    except Exception as e:
        logger.error(f"Error fetching products: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch products: {str(e)}"
        )


@router.post("/products", response_model=POSProductResponse)
async def create_product(
    product: POSProductCreate,
    x_pos_staff_session: Optional[str] = Header(None, alias="X-POS-Staff-Session"),
    current_user=Depends(CurrentUser())
):
    """Create a new product"""
    try:
        supabase = get_supabase_admin()
        _require_inventory_editor_role(supabase, current_user, product.outlet_id, x_pos_staff_session)

        # Generate product ID
        product_id = str(uuid.uuid4())

        # Prepare product data with proper Decimal serialization
        product_data = {
            'id': product_id,
            **product.model_dump(mode='json', exclude_none=True, exclude_unset=True),
            'created_at': datetime.utcnow().isoformat(),
            'updated_at': datetime.utcnow().isoformat()
        }
        product_data['category'] = _normalize_department_name(product_data.get('category'))
        product_data['base_unit_name'] = str(product_data.get('base_unit_name') or 'Unit').strip() or 'Unit'
        if 'pack_name' in product_data:
            product_data['pack_name'] = str(product_data.get('pack_name') or '').strip() or None
        if 'pack_barcode' in product_data:
            product_data['pack_barcode'] = str(product_data.get('pack_barcode') or '').strip() or None
        if product_data.get('pack_enabled') is False:
            product_data['pack_name'] = None
            product_data['units_per_pack'] = None
            product_data['pack_price'] = None
            product_data['pack_barcode'] = None

        _ensure_departments_exist(
            supabase,
            outlet_id=product.outlet_id,
            category_values=[product_data.get('category')]
        )

        # Insert product
        result = _insert_pos_product_compat(supabase, product_data)

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to create product"
            )

        return POSProductResponse(**result.data[0])

    except Exception as e:
        logger.error(f"Error creating product: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create product: {str(e)}"
        )


@router.post("/products/import", response_model=ProductBulkImportResponse)
async def bulk_import_products(
    payload: ProductBulkImportRequest,
    x_pos_staff_session: Optional[str] = Header(None, alias="X-POS-Staff-Session"),
    current_user=Depends(CurrentUser())
):
    """
    Bulk import products with dedupe/upsert behavior.
    - dedupe_by controls how existing rows are matched.
    - update_existing=False skips matched rows.
    - dry_run validates/matches without writing to DB.
    """
    try:
        supabase = get_supabase_admin()
        _require_manager_role(supabase, current_user, payload.outlet_id, x_pos_staff_session)

        rows = payload.products or []
        if len(rows) == 0:
            return ProductBulkImportResponse(
                total_received=0,
                created_count=0,
                updated_count=0,
                skipped_count=0,
                error_count=0,
                errors=[]
            )

        dedupe_by = payload.dedupe_by
        now_iso = datetime.utcnow().isoformat()

        def norm_sku(value: Any) -> str:
            return str(value or '').strip().upper()

        def norm_barcode(value: Any) -> str:
            return str(value or '').strip()

        existing_by_sku: Dict[str, Dict[str, Any]] = {}
        existing_by_barcode: Dict[str, Dict[str, Any]] = {}

        if dedupe_by in ('sku', 'sku_or_barcode'):
            sku_values = sorted({
                norm_sku(product.sku)
                for product in rows
                if norm_sku(product.sku)
            })
            if sku_values:
                existing_skus = supabase.table(Tables.POS_PRODUCTS)\
                    .select('*')\
                    .eq('outlet_id', payload.outlet_id)\
                    .in_('sku', sku_values)\
                    .execute()
                for product in existing_skus.data or []:
                    key = norm_sku(product.get('sku'))
                    if key:
                        existing_by_sku[key] = product

        if dedupe_by in ('barcode', 'sku_or_barcode'):
            barcode_values = sorted({
                norm_barcode(product.barcode)
                for product in rows
                if norm_barcode(product.barcode)
            })
            if barcode_values:
                existing_barcodes = supabase.table(Tables.POS_PRODUCTS)\
                    .select('*')\
                    .eq('outlet_id', payload.outlet_id)\
                    .in_('barcode', barcode_values)\
                    .execute()
                for product in existing_barcodes.data or []:
                    key = norm_barcode(product.get('barcode'))
                    if key:
                        existing_by_barcode[key] = product

        created_count = 0
        updated_count = 0
        skipped_count = 0
        errors: List[ProductBulkImportError] = []
        pending_upserts: List[Dict[str, Any]] = []
        pending_meta: List[Dict[str, Any]] = []
        category_values_to_ensure: List[Optional[str]] = []

        for index, row in enumerate(rows, start=1):
            try:
                row_data = row.model_dump(mode='json', exclude_none=True, exclude_unset=True)
                row_data['outlet_id'] = payload.outlet_id
                row_data['sku'] = norm_sku(row_data.get('sku'))
                if row_data.get('barcode') is not None:
                    row_data['barcode'] = norm_barcode(row_data.get('barcode')) or None
                row_data['category'] = _normalize_department_name(row_data.get('category'))
                row_data['base_unit_name'] = str(row_data.get('base_unit_name') or 'Unit').strip() or 'Unit'
                if row_data.get('pack_name') is not None:
                    row_data['pack_name'] = str(row_data.get('pack_name') or '').strip() or None
                if row_data.get('pack_barcode') is not None:
                    row_data['pack_barcode'] = norm_barcode(row_data.get('pack_barcode')) or None
                if row_data.get('pack_enabled') is False:
                    row_data['pack_name'] = None
                    row_data['units_per_pack'] = None
                    row_data['pack_price'] = None
                    row_data['pack_barcode'] = None
                category_values_to_ensure.append(row_data.get('category'))

                # Validate required commercial constraint at row level so
                # one invalid line does not fail the entire import request.
                try:
                    unit_price = Decimal(str(row_data.get('unit_price') or 0))
                except Exception:
                    unit_price = Decimal(0)

                if unit_price <= 0:
                    errors.append(ProductBulkImportError(
                        row=index,
                        sku=getattr(row, 'sku', None),
                        barcode=getattr(row, 'barcode', None),
                        name=getattr(row, 'name', None),
                        message='Selling price must be greater than 0'
                    ))
                    continue

                sku_key = norm_sku(row_data.get('sku'))
                barcode_key = norm_barcode(row_data.get('barcode'))

                existing: Optional[Dict[str, Any]] = None
                if dedupe_by in ('sku', 'sku_or_barcode') and sku_key:
                    existing = existing_by_sku.get(sku_key)
                if not existing and dedupe_by in ('barcode', 'sku_or_barcode') and barcode_key:
                    existing = existing_by_barcode.get(barcode_key)

                if existing:
                    if not payload.update_existing:
                        skipped_count += 1
                        continue

                    update_data = {
                        'id': existing.get('id') or str(uuid.uuid4()),
                        **row_data,
                        'created_at': existing.get('created_at') or now_iso,
                        'updated_at': now_iso
                    }
                    if payload.dry_run:
                        updated_count += 1
                    else:
                        pending_upserts.append(update_data)
                        pending_meta.append({
                            'row': index,
                            'sku': getattr(row, 'sku', None),
                            'barcode': getattr(row, 'barcode', None),
                            'name': getattr(row, 'name', None),
                            'mode': 'update'
                        })

                    # Keep in-memory map current for duplicates within same import batch.
                    existing_record = update_data
                    if sku_key:
                        existing_by_sku[sku_key] = existing_record
                    if barcode_key:
                        existing_by_barcode[barcode_key] = existing_record
                    continue

                create_data = {
                    'id': str(uuid.uuid4()),
                    **row_data,
                    'created_at': now_iso,
                    'updated_at': now_iso
                }

                if payload.dry_run:
                    created_count += 1
                    existing_record = create_data
                else:
                    pending_upserts.append(create_data)
                    pending_meta.append({
                        'row': index,
                        'sku': getattr(row, 'sku', None),
                        'barcode': getattr(row, 'barcode', None),
                        'name': getattr(row, 'name', None),
                        'mode': 'create'
                    })
                    existing_record = create_data

                if sku_key:
                    existing_by_sku[sku_key] = existing_record
                if barcode_key:
                    existing_by_barcode[barcode_key] = existing_record
            except Exception as row_error:
                errors.append(ProductBulkImportError(
                    row=index,
                    sku=getattr(row, 'sku', None),
                    barcode=getattr(row, 'barcode', None),
                    name=getattr(row, 'name', None),
                    message=str(row_error)
                ))

        if not payload.dry_run and pending_upserts:
            _ensure_departments_exist(
                supabase,
                outlet_id=payload.outlet_id,
                category_values=category_values_to_ensure
            )
            chunk_size = 250

            for start in range(0, len(pending_upserts), chunk_size):
                chunk_rows = pending_upserts[start:start + chunk_size]
                chunk_meta = pending_meta[start:start + chunk_size]

                try:
                    chunk_result = _upsert_pos_products_compat(supabase, chunk_rows)
                    if chunk_result.data is None:
                        raise ValueError("Bulk upsert returned no data")

                    for meta in chunk_meta:
                        if meta['mode'] == 'create':
                            created_count += 1
                        else:
                            updated_count += 1
                except Exception as chunk_error:
                    logger.warning(
                        "Bulk upsert chunk failed, retrying row-by-row for diagnostics: %s",
                        chunk_error
                    )

                    for row_payload, meta in zip(chunk_rows, chunk_meta):
                        try:
                            row_result = _upsert_pos_products_compat(supabase, [row_payload])
                            if not row_result.data:
                                raise ValueError("Failed to write product row")

                            if meta['mode'] == 'create':
                                created_count += 1
                            else:
                                updated_count += 1
                        except Exception as row_error:
                            errors.append(ProductBulkImportError(
                                row=meta['row'],
                                sku=meta.get('sku'),
                                barcode=meta.get('barcode'),
                                name=meta.get('name'),
                                message=str(row_error)
                            ))

        return ProductBulkImportResponse(
            total_received=len(rows),
            created_count=created_count,
            updated_count=updated_count,
            skipped_count=skipped_count,
            error_count=len(errors),
            errors=errors
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error bulk importing products: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to import products: {str(e)}"
        )


@router.get("/products/{product_id}", response_model=POSProductResponse)
async def get_product(
    product_id: str,
    current_user=Depends(CurrentUser())
):
    """Get a specific product by ID"""
    try:
        supabase = get_supabase_admin()

        result = supabase.table('pos_products').select('*').eq('id', product_id).execute()

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Product not found"
            )

        return POSProductResponse(**result.data[0])

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching product {product_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch product: {str(e)}"
        )


@router.put("/products/{product_id}", response_model=POSProductResponse)
async def update_product(
    product_id: str,
    product: POSProductUpdate,
    x_pos_staff_session: Optional[str] = Header(None, alias="X-POS-Staff-Session"),
    current_user=Depends(CurrentUser())
):
    """Update a product"""
    try:
        supabase = get_supabase_admin()
        existing_product = supabase.table('pos_products').select('id,outlet_id').eq('id', product_id).execute()
        if not existing_product.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Product not found"
            )
        _require_inventory_editor_role(
            supabase,
            current_user,
            existing_product.data[0].get('outlet_id'),
            x_pos_staff_session
        )

        # Prepare JSON-safe update data (exclude None/unset values).
        # Using mode='json' avoids Decimal serialization errors.
        update_data = product.model_dump(mode='json', exclude_none=True, exclude_unset=True)
        if 'category' in update_data:
            update_data['category'] = _normalize_department_name(update_data.get('category'))
            _ensure_departments_exist(
                supabase,
                outlet_id=existing_product.data[0].get('outlet_id'),
                category_values=[update_data.get('category')]
            )

        if 'base_unit_name' in update_data:
            update_data['base_unit_name'] = str(update_data.get('base_unit_name') or '').strip() or 'Unit'

        if 'pack_name' in update_data:
            update_data['pack_name'] = (str(update_data.get('pack_name') or '').strip() or None)
        if 'pack_barcode' in update_data:
            update_data['pack_barcode'] = (str(update_data.get('pack_barcode') or '').strip() or None)

        if update_data.get('pack_enabled') is False:
            update_data['pack_name'] = None
            update_data['units_per_pack'] = None
            update_data['pack_price'] = None
            update_data['pack_barcode'] = None

        update_data['updated_at'] = datetime.utcnow().isoformat()

        result = _update_pos_product_compat(supabase, product_id, update_data)

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Product not found"
            )

        return POSProductResponse(**result.data[0])

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating product {product_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update product: {str(e)}"
        )


@router.delete("/products/{product_id}")
async def delete_product(
    product_id: str,
    x_pos_staff_session: Optional[str] = Header(None, alias="X-POS-Staff-Session"),
    current_user=Depends(CurrentUser())
):
    """Delete a product (soft delete by setting inactive)"""
    try:
        supabase = get_supabase_admin()
        existing_product = supabase.table('pos_products').select('id,outlet_id').eq('id', product_id).execute()
        if not existing_product.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Product not found"
            )
        _require_manager_role(
            supabase,
            current_user,
            existing_product.data[0].get('outlet_id'),
            x_pos_staff_session
        )

        result = supabase.table('pos_products').update({
            'is_active': False,
            'updated_at': datetime.utcnow().isoformat()
        }).eq('id', product_id).execute()

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Product not found"
            )

        return {"message": "Product deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting product {product_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete product: {str(e)}"
        )


@router.get("/products/search/barcode/{barcode}", response_model=POSProductResponse)
async def get_product_by_barcode(
    barcode: str,
    outlet_id: str,
    current_user=Depends(CurrentUser())
):
    """Get product by barcode scan"""
    try:
        supabase = get_supabase_admin()

        result = supabase.table('pos_products').select('*').eq('barcode', barcode).eq('outlet_id', outlet_id).eq('is_active', True).limit(1).execute()

        if not result.data:
            try:
                result = supabase.table('pos_products')\
                    .select('*')\
                    .eq('pack_barcode', barcode)\
                    .eq('outlet_id', outlet_id)\
                    .eq('is_active', True)\
                    .limit(1)\
                    .execute()
            except Exception as pack_lookup_error:
                missing_column = _extract_missing_column_name(pack_lookup_error)
                if missing_column == 'pack_barcode':
                    logger.warning(
                        "pos_products.pack_barcode missing in schema cache; skipping pack barcode lookup"
                    )
                else:
                    raise

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Product not found for this barcode"
            )

        return POSProductResponse(**result.data[0])

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching product by barcode {barcode}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch product by barcode: {str(e)}"
        )


# ===============================================
# TRANSACTION PROCESSING ENDPOINTS
# ===============================================

@router.post("/transactions", response_model=POSTransactionResponse)
async def create_transaction(
    transaction: POSTransactionCreate,
    x_pos_staff_session: Optional[str] = Header(None, alias="X-POS-Staff-Session"),
    current_user=Depends(CurrentUser())
):
    """Process a new POS transaction"""
    try:
        supabase = get_supabase_admin()
        actor_context = _resolve_staff_context(
            supabase,
            current_user,
            transaction.outlet_id,
            x_pos_staff_session
        )
        authenticated_user_id = _resolve_actor_user_id(current_user)
        staff_profile_id = str(actor_context.get('staff_profile_id') or '').strip()
        if actor_context.get('source') != 'staff_session' or not staff_profile_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Active POS staff clock-in is required before processing sales"
            )

        has_line_discount = any((item.discount_amount or Decimal(0)) > Decimal(0) for item in transaction.items)
        has_transaction_discount = (transaction.discount_amount or Decimal(0)) > Decimal(0)
        has_any_discount = has_line_discount or has_transaction_discount
        discount_authorizer_staff_profile_id: Optional[str] = None
        discount_authorizer_name: Optional[str] = None
        if has_any_discount and not _can_apply_discount(actor_context):
            authorizer_token = str(transaction.discount_authorizer_session_token or "").strip()
            if not authorizer_token:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Discount approval is required from manager/pharmacist"
                )

            authorizer_payload = StaffService.parse_session_token(authorizer_token)
            if not authorizer_payload:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Discount approval session is invalid or expired"
                )

            authorizer_profile_id = str(authorizer_payload.get('staff_profile_id') or '').strip()
            if not authorizer_profile_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Invalid discount approval payload"
                )

            authorizer_result = supabase.table(Tables.STAFF_PROFILES)\
                .select('id,outlet_id,role,permissions,display_name,is_active')\
                .eq('id', authorizer_profile_id)\
                .execute()
            authorizer_profile = authorizer_result.data[0] if authorizer_result.data else None

            if not authorizer_profile or not authorizer_profile.get('is_active'):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Discount approver is not active"
                )

            profile_outlet_id = authorizer_profile.get('outlet_id')
            if profile_outlet_id and profile_outlet_id != transaction.outlet_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Discount approver does not belong to this outlet"
                )

            authorizer_context = {
                'role': _normalize_role(authorizer_profile.get('role')),
                'permissions': _normalize_permissions(authorizer_profile.get('permissions')),
            }
            if not _can_apply_discount(authorizer_context):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Only manager or pharmacist roles can authorize discounts"
                )

            discount_authorizer_staff_profile_id = str(authorizer_profile.get('id') or '').strip() or None
            discount_authorizer_name = str(authorizer_profile.get('display_name') or '').strip() or None

        # Request cashier_id is the expected staff profile id.
        # Keep DB cashier_id as authenticated user id for FK compatibility.
        requested_cashier_id = str(transaction.cashier_id or '').strip()
        if requested_cashier_id and requested_cashier_id not in {staff_profile_id, authenticated_user_id}:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Transaction cashier does not match active staff session"
            )
        cashier_id = authenticated_user_id
        normalized_offline_id = _normalize_optional_uuid(transaction.offline_id, "offline_id")

        if normalized_offline_id:
            try:
                existing_transaction = supabase.table('pos_transactions')\
                    .select('*, items:pos_transaction_items(*)')\
                    .eq('outlet_id', transaction.outlet_id)\
                    .eq('offline_id', normalized_offline_id)\
                    .order('transaction_date', desc=True)\
                    .limit(1)\
                    .execute()

                if existing_transaction.data and len(existing_transaction.data) > 0:
                    return POSTransactionResponse(**_decorate_transaction_record(existing_transaction.data[0]))
            except Exception as lookup_error:
                missing_column = _extract_missing_column_name(lookup_error)
                if missing_column == 'offline_id':
                    logger.warning(
                        "pos_transactions.offline_id missing in schema cache; skipping idempotency lookup"
                    )
                else:
                    raise
        
        # Split payments are first-class in request; keep legacy notes parsing for backward compatibility.
        split_payments = _normalize_split_payments(getattr(transaction, "split_payments", None))
        if not split_payments and transaction.notes:
            notes_data = _safe_json_loads(transaction.notes)
            split_payments = _normalize_split_payments(notes_data.get("split_payments"))

        # Generate transaction ID and number
        transaction_id = str(uuid.uuid4())
        transaction_number = f"TXN-{datetime.now().strftime('%Y%m%d')}-{transaction_id[:8].upper()}"

        # Calculate totals (treat unit_price as VAT-inclusive final price)
        subtotal = Decimal(0)   # Gross after line discounts
        tax_amount = Decimal(0) # Derived VAT portion (for reporting)
        total_amount = Decimal(0)  # Same as subtotal (for now), after any transaction-level discount

        # Process each item and calculate totals.
        # Stock is always tracked in base units (quantity/base_units_quantity),
        # while sale metadata preserves whether cashier sold unit or pack.
        transaction_items: List[Dict[str, Any]] = []
        for item in transaction.items:
            # Get product details
            product_result = supabase.table('pos_products').select('*').eq('id', item.product_id).execute()
            if not product_result.data:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Product {item.product_id} not found"
                )

            product = product_result.data[0]

            requested_sale_unit = str(getattr(item, 'sale_unit', 'unit') or 'unit').strip().lower()
            if requested_sale_unit not in {'unit', 'pack'}:
                requested_sale_unit = 'unit'

            pack_enabled = bool(product.get('pack_enabled'))
            units_per_pack = max(1, _safe_int(product.get('units_per_pack'), 1))
            pack_price_raw = product.get('pack_price')
            try:
                pack_price = Decimal(str(pack_price_raw)) if pack_price_raw is not None else Decimal(0)
            except Exception:
                pack_price = Decimal(0)
            is_pack_configured = pack_enabled and units_per_pack >= 2 and pack_price > 0

            if requested_sale_unit == 'pack':
                if not is_pack_configured:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Product {item.product_id} is not configured for pack sales"
                    )
                sale_unit = 'pack'
                units_per_sale_unit = units_per_pack
                selected_sale_unit_price = (
                    item.unit_price if item.unit_price is not None else pack_price
                )
            else:
                sale_unit = 'unit'
                units_per_sale_unit = 1
                selected_sale_unit_price = (
                    item.unit_price if item.unit_price is not None else Decimal(str(product['unit_price']))
                )

            sale_quantity = max(1, _safe_int(item.quantity, 1))
            base_units_quantity = sale_quantity * units_per_sale_unit
            if base_units_quantity <= 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid quantity for product {item.product_id}"
                )

            # Persist legacy unit_price as base-unit effective price to keep line math valid
            # even on older schemas that don't have sale_unit/sale_quantity columns.
            effective_base_unit_price = selected_sale_unit_price / Decimal(units_per_sale_unit)

            # Line calculations with VAT-inclusive pricing
            line_gross = selected_sale_unit_price * sale_quantity  # Gross before discount (includes VAT)
            line_discount = item.discount_amount
            line_gross_after_discount = max(Decimal(0), line_gross - line_discount)

            rate = Decimal(str(product.get('tax_rate', 0) or 0))
            if rate > 0:
                # VAT portion from inclusive price: gross - net = gross * (rate / (1 + rate))
                line_tax = line_gross_after_discount * (rate / (Decimal(1) + rate))
            else:
                line_tax = Decimal(0)

            # For totals, we treat line_total as the gross amount the customer pays (includes VAT)
            line_total = line_gross_after_discount

            # Add to transaction totals
            subtotal += line_gross_after_discount
            tax_amount += line_tax
            total_amount += line_total

            # Prepare transaction item
            transaction_items.append({
                'id': str(uuid.uuid4()),
                'transaction_id': transaction_id,
                'product_id': item.product_id,
                'sku': product['sku'],
                'product_name': product['name'],
                # quantity is persisted as base units for inventory-safe reversals
                'quantity': base_units_quantity,
                'unit_price': float(effective_base_unit_price),
                'discount_amount': float(line_discount),
                'tax_amount': float(line_tax),
                'line_total': float(line_total),
                # New sale-unit metadata (optional on older schemas)
                'sale_unit': sale_unit,
                'sale_quantity': sale_quantity,
                'sale_unit_price': float(selected_sale_unit_price),
                'units_per_sale_unit': units_per_sale_unit,
                'base_units_quantity': base_units_quantity,
            })

        # Apply transaction-level discount (if any)
        if transaction.discount_amount:
            total_amount = max(Decimal(0), total_amount - transaction.discount_amount)

        # Handle split payments or single payment
        change_amount = Decimal(0)
        tendered_amount = transaction.tendered_amount
        
        if len(split_payments) > 1:
            # Validate split payments sum to total
            total_split = sum(Decimal(str(p.get('amount', 0))) for p in split_payments)
            if abs(total_split - total_amount) > Decimal('0.01'):  # Allow small rounding differences
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Split payments total ({total_split}) does not match transaction total ({total_amount})"
                )
            # For split payments, tendered is the split sum.
            tendered_amount = total_split
            change_amount = max(Decimal(0), total_split - total_amount)
        elif transaction.payment_method == PaymentMethod.CASH and transaction.tendered_amount:
            change_amount = transaction.tendered_amount - total_amount
            if change_amount < -Decimal('0.01'):  # Allow small rounding differences
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Insufficient payment amount"
                )

        notes_metadata: Dict[str, Any] = {}
        if staff_profile_id:
            notes_metadata["cashier_staff_profile_id"] = staff_profile_id
        if discount_authorizer_staff_profile_id:
            notes_metadata["discount_authorized_by_staff_profile_id"] = discount_authorizer_staff_profile_id
            notes_metadata["discount_authorized_at"] = datetime.utcnow().isoformat()
            if discount_authorizer_name:
                notes_metadata["discount_authorized_by_name"] = discount_authorizer_name

        persisted_notes = _build_persisted_transaction_notes(
            transaction.notes,
            split_payments if len(split_payments) > 1 else [],
            notes_metadata or None
        )

        # Cashier display always comes from staff profile identity for POS transactions.
        cashier_name = 'Unknown'
        try:
            cashier_result = supabase.table('staff_profiles').select('display_name').eq('id', staff_profile_id).execute()
            if cashier_result.data:
                cashier_name = cashier_result.data[0].get('display_name') or cashier_name
        except Exception as cashier_lookup_error:
            logger.warning(f"Cashier name lookup failed for staff profile {staff_profile_id}: {cashier_lookup_error}")

        # Prepare transaction data
        transaction_data = {
            'id': transaction_id,
            'transaction_number': transaction_number,
            'outlet_id': transaction.outlet_id,
            'cashier_id': cashier_id,
            'cashier_staff_profile_id': staff_profile_id,
            'cashier_name': cashier_name,
            'customer_id': transaction.customer_id,
            'customer_name': transaction.customer_name,
            'subtotal': float(subtotal),
            'tax_amount': float(tax_amount),
            'discount_amount': float(transaction.discount_amount),
            'total_amount': float(total_amount),
            'payment_method': transaction.payment_method.value,
            'tendered_amount': float(tendered_amount) if tendered_amount is not None else None,
            'change_amount': float(change_amount),
            'payment_reference': transaction.payment_reference,
            'status': TransactionStatus.COMPLETED.value,
            'receipt_type': transaction.receipt_type.value if hasattr(transaction, 'receipt_type') else 'sale',
            'transaction_date': datetime.utcnow().isoformat(),
            'sync_status': SyncStatus.SYNCED.value,
            'notes': persisted_notes,
            'split_payments': split_payments if len(split_payments) > 1 else None,
            'receipt_printed': False,
            'created_at': datetime.utcnow().isoformat(),
            'updated_at': datetime.utcnow().isoformat()
        }

        if normalized_offline_id:
            transaction_data['offline_id'] = normalized_offline_id

        # Insert transaction
        tx_result = _insert_pos_transaction_compat(supabase, transaction_data)
        if not tx_result.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to create transaction"
            )

        # Insert transaction items
        items_result = _insert_pos_transaction_items_compat(supabase, transaction_items)
        if not items_result.data:
            # Rollback transaction if items failed
            supabase.table('pos_transactions').delete().eq('id', transaction_id).execute()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to create transaction items"
            )

        # Update stock quantities for each product sold
        for item in transaction_items:
            try:
                product_id = item['product_id']
                quantity_to_deduct = _resolve_stock_quantity_from_transaction_item(item)
                if quantity_to_deduct <= 0:
                    continue

                # Get current stock
                product_result = supabase.table('pos_products').select('quantity_on_hand').eq('id', product_id).execute()
                if product_result.data:
                    current_qty = product_result.data[0]['quantity_on_hand']
                    new_qty = max(0, current_qty - quantity_to_deduct)  # Prevent negative stock

                    # Update product quantity
                    supabase.table('pos_products').update({
                        'quantity_on_hand': new_qty,
                        'updated_at': datetime.utcnow().isoformat()
                    }).eq('id', product_id).execute()

                    # Create stock movement record
                    sale_unit = str(item.get('sale_unit') or 'unit')
                    sale_quantity = _safe_int(item.get('sale_quantity'), 0)
                    movement_data = {
                        'id': str(uuid.uuid4()),
                        'product_id': product_id,
                        'outlet_id': transaction.outlet_id,
                        'movement_type': 'sale',
                        'quantity_change': -quantity_to_deduct,
                        'quantity_before': current_qty,
                        'quantity_after': new_qty,
                        'reference_id': transaction_id,
                        'reference_type': 'pos_transaction',
                        'performed_by': cashier_id,
                        'movement_date': datetime.utcnow().isoformat(),
                        'notes': (
                            f"POS sale ({sale_quantity} {sale_unit}, "
                            f"{quantity_to_deduct} base units)"
                            if sale_quantity > 0 else None
                        ),
                    }
                    supabase.table('pos_stock_movements').insert(movement_data).execute()
            except Exception as stock_error:
                logger.warning(f"Failed to update stock for product {item.get('product_id')}: {stock_error}")
                # Don't fail transaction if stock update fails, but log it

        # Return complete transaction with items
        response_data = _decorate_transaction_record(tx_result.data[0])
        response_data['items'] = items_result.data

        return POSTransactionResponse(**response_data)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating transaction: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create transaction: {str(e)}"
        )


@router.get("/transactions", response_model=TransactionListResponse)
async def get_transactions(
    outlet_id: str,
    page: int = Query(1, ge=1, description="Page number"),
    size: int = Query(50, ge=1, description="Page size"),
    date_from: Optional[date] = Query(None, description="Start date (YYYY-MM-DD)"),
    date_to: Optional[date] = Query(None, description="End date (YYYY-MM-DD)"),
    cashier_id: Optional[str] = Query(None, description="Filter by cashier"),
    payment_method: Optional[PaymentMethod] = Query(None, description="Filter by payment method"),
    split_only: bool = Query(False, description="Filter to mixed/split payment transactions"),
    status: Optional[TransactionStatus] = Query(None, description="Filter by transaction status"),
    search: Optional[str] = Query(None, description="Search receipt number, customer, payment method, cashier"),
    current_user=Depends(CurrentUser())
):
    """Get transactions with filtering and pagination"""
    try:
        supabase = get_supabase_admin()
        cashier_filter_value = str(cashier_id or '').strip()

        def apply_filters(query_builder, include_payment_filter: bool = True):
            query_builder = query_builder.eq('outlet_id', outlet_id)

            # Date filters should include the full calendar day.
            if date_from:
                query_builder = query_builder.gte('transaction_date', f"{date_from.isoformat()}T00:00:00")
            if date_to:
                end_exclusive = date_to + timedelta(days=1)
                query_builder = query_builder.lt('transaction_date', f"{end_exclusive.isoformat()}T00:00:00")
            if include_payment_filter and payment_method:
                query_builder = query_builder.eq('payment_method', payment_method.value)
            if status:
                query_builder = query_builder.eq('status', status.value)

            if search and search.strip():
                term = search.strip().replace(',', ' ')
                pattern = f"*{term}*"
                query_builder = query_builder.or_(
                    f"transaction_number.ilike.{pattern},"
                    f"customer_name.ilike.{pattern},"
                    f"payment_method.ilike.{pattern},"
                    f"cashier_name.ilike.{pattern}"
                )

            return query_builder

        def matches_cashier_filter(record: Dict[str, Any]) -> bool:
            if not cashier_filter_value:
                return True

            transaction_cashier_id = str(record.get('cashier_id') or '').strip()
            transaction_staff_profile_id = _extract_cashier_staff_profile_id_from_record(record)
            transaction_cashier_name = str(record.get('cashier_name') or '').strip()

            if transaction_staff_profile_id:
                cashier_group_key = f"staff:{transaction_staff_profile_id}"
            elif transaction_cashier_name:
                cashier_group_key = f"name:{transaction_cashier_name.lower()}"
            else:
                cashier_group_key = f"user:{transaction_cashier_id}"

            return cashier_filter_value in {
                cashier_group_key,
                transaction_cashier_id,
                transaction_staff_profile_id or '',
            }

        offset = (page - 1) * size
        # Payment-specific filters and staff-aware cashier filters require post-filtering.
        if split_only or payment_method is not None or cashier_filter_value:
            query = apply_filters(
                supabase.table('pos_transactions').select('*, items:pos_transaction_items(*)'),
                include_payment_filter=False
            )
            query = query.order('transaction_date', desc=True)
            result = query.execute()

            filtered: List[Dict[str, Any]] = []
            target_method = payment_method.value if payment_method else None

            for row in (result.data or []):
                if not matches_cashier_filter(row):
                    continue

                decorated_row = _decorate_transaction_record(row)
                split_count = len(decorated_row.get('split_payments') or [])
                if split_only:
                    if split_count <= 1:
                        continue
                elif target_method:
                    if split_count > 1 or decorated_row.get('payment_method') != target_method:
                        continue

                filtered.append(decorated_row)

            total = len(filtered)
            items = filtered[offset: offset + size]
            return TransactionListResponse(
                items=items,
                total=total,
                page=page,
                size=size
            )

        # Fast path for non-payment-filtered queries.
        query = apply_filters(
            supabase.table('pos_transactions').select('*, items:pos_transaction_items(*)', count='exact')
        )
        query = query.range(offset, offset + size - 1).order('transaction_date', desc=True)

        result = query.execute()
        total = int(getattr(result, 'count', 0) or len(result.data or []))
        items = [_decorate_transaction_record(row) for row in (result.data or [])]

        return TransactionListResponse(
            items=items,
            total=total,
            page=page,
            size=size
        )

    except Exception as e:
        logger.error(f"Error fetching transactions: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch transactions: {str(e)}"
        )


@router.get("/transactions/{transaction_id}", response_model=POSTransactionResponse)
async def get_transaction(
    transaction_id: str,
    current_user=Depends(CurrentUser())
):
    """Get a specific transaction with items"""
    try:
        supabase = get_supabase_admin()

        # Get transaction with items (alias pos_transaction_items -> items to match schema)
        result = supabase.table('pos_transactions').select('*, items:pos_transaction_items(*)').eq('id', transaction_id).execute()

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Transaction not found"
            )

        return POSTransactionResponse(**_decorate_transaction_record(result.data[0]))

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching transaction {transaction_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch transaction: {str(e)}"
        )


@router.put("/transactions/{transaction_id}/void")
async def void_transaction(
    transaction_id: str,
    void_data: Dict[str, str],
    x_pos_staff_session: Optional[str] = Header(None, alias="X-POS-Staff-Session"),
    current_user=Depends(CurrentUser())
):
    """Void a transaction"""
    try:
        supabase = get_supabase_admin()

        # Get transaction to restore stock
        tx_result = supabase.table('pos_transactions').select('*, pos_transaction_items(*)').eq('id', transaction_id).execute()
        if not tx_result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Transaction not found"
            )

        transaction = tx_result.data[0]
        actor_context = _require_void_authorization(
            supabase,
            current_user,
            transaction.get('outlet_id'),
            x_pos_staff_session
        )
        actor_id = _resolve_actor_user_id(current_user)
        void_reason = void_data.get('void_reason', 'No reason provided') if void_data else 'No reason provided'

        # Restore stock quantities for voided transaction
        if transaction.get('pos_transaction_items'):
            for item in transaction['pos_transaction_items']:
                try:
                    quantity_to_restore = _resolve_stock_quantity_from_transaction_item(item)
                    if quantity_to_restore <= 0:
                        continue

                    # Get current stock
                    product_result = supabase.table('pos_products').select('quantity_on_hand').eq('id', item['product_id']).execute()
                    if product_result.data:
                        current_qty = product_result.data[0]['quantity_on_hand']
                        new_qty = current_qty + quantity_to_restore  # Restore sold base quantity

                        # Update product quantity
                        supabase.table('pos_products').update({
                            'quantity_on_hand': new_qty,
                            'updated_at': datetime.utcnow().isoformat()
                        }).eq('id', item['product_id']).execute()
                        
                        # Create stock movement record for void
                        movement_data = {
                            'id': str(uuid.uuid4()),
                            'product_id': item['product_id'],
                            'outlet_id': transaction['outlet_id'],
                            'movement_type': 'return',
                            'quantity_change': quantity_to_restore,
                            'quantity_before': current_qty,
                            'quantity_after': new_qty,
                            'reference_id': transaction_id,
                            'reference_type': 'voided_transaction',
                            'performed_by': actor_id,
                            'movement_date': datetime.utcnow().isoformat(),
                            'notes': (
                                f"Stock restored from voided transaction: {void_reason} "
                                f"({_safe_int(item.get('sale_quantity'), 0)} {str(item.get('sale_unit') or 'unit')}, "
                                f"{quantity_to_restore} base units)"
                            )
                        }
                        supabase.table('pos_stock_movements').insert(movement_data).execute()
                except Exception as stock_error:
                    logger.warning(f"Failed to restore stock for product {item['product_id']}: {stock_error}")

        # Get voider's name for display
        voider_name = current_user.get('name', 'Unknown')
        if actor_context.get('staff_profile_id'):
            staff_result = supabase.table(Tables.STAFF_PROFILES)\
                .select('display_name')\
                .eq('id', actor_context['staff_profile_id'])\
                .execute()
            if staff_result.data:
                voider_name = staff_result.data[0].get('display_name') or voider_name

        result = supabase.table('pos_transactions').update({
            'is_voided': True,
            'voided_by': actor_id,
            'voided_by_name': voider_name,
            'voided_at': datetime.utcnow().isoformat(),
            'void_reason': void_reason,
            'receipt_type': 'void',
            'status': TransactionStatus.VOIDED.value,
            'updated_at': datetime.utcnow().isoformat()
        }).eq('id', transaction_id).execute()

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Transaction not found"
            )

        return {"message": "Transaction voided successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error voiding transaction {transaction_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to void transaction: {str(e)}"
        )


# ===============================================
# INVENTORY MANAGEMENT ENDPOINTS
# ===============================================

@router.post("/inventory/adjustment", response_model=StockMovementResponse)
async def create_stock_adjustment(
    movement: StockMovementCreate,
    x_pos_staff_session: Optional[str] = Header(None, alias="X-POS-Staff-Session"),
    current_user=Depends(CurrentUser())
):
    """Create manual stock adjustment"""
    try:
        supabase = get_supabase_admin()
        actor_context = _require_manager_role(
            supabase,
            current_user,
            movement.outlet_id,
            x_pos_staff_session
        )
        actor_id = _resolve_actor_user_id(current_user)

        # Get current product stock
        product_result = supabase.table('pos_products').select('quantity_on_hand').eq('id', movement.product_id).execute()
        if not product_result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Product not found"
            )

        current_quantity = product_result.data[0]['quantity_on_hand']
        new_quantity = current_quantity + movement.quantity_change

        if new_quantity < 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Insufficient stock for this adjustment"
            )

        # Persist the stock level change.
        product_update = supabase.table('pos_products').update({
            'quantity_on_hand': new_quantity,
            'updated_at': datetime.utcnow().isoformat()
        }).eq('id', movement.product_id).execute()

        if not product_update.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to update product stock"
            )

        # Create stock movement record
        movement_data = {
            'id': str(uuid.uuid4()),
            'product_id': movement.product_id,
            'outlet_id': movement.outlet_id,
            'movement_type': movement.movement_type.value,
            'quantity_change': movement.quantity_change,
            'quantity_before': current_quantity,
            'quantity_after': new_quantity,
            'reference_id': movement.reference_id,
            'reference_type': movement.reference_type or 'manual_adjustment',
            'unit_cost': float(movement.unit_cost) if movement.unit_cost else None,
            'total_value': float(movement.unit_cost * abs(movement.quantity_change)) if movement.unit_cost else None,
            'notes': movement.notes,
            'performed_by': actor_id,
            'movement_date': datetime.utcnow().isoformat()
        }

        result = supabase.table('pos_stock_movements').insert(movement_data).execute()

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to create stock movement"
            )

        return StockMovementResponse(**result.data[0])

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating stock adjustment: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create stock adjustment: {str(e)}"
        )


@router.post("/inventory/stocktakes/commit", response_model=StocktakeCommitResponse)
async def commit_stocktake(
    stocktake: StocktakeCommitRequest,
    x_pos_staff_session: Optional[str] = Header(None, alias="X-POS-Staff-Session"),
    current_user=Depends(CurrentUser())
):
    """Commit an entire stocktake in one operation with conflict checks and rollback safety."""
    try:
        supabase = get_supabase_admin()
        actor_context = _require_stocktake_role(
            supabase,
            current_user,
            stocktake.outlet_id,
            x_pos_staff_session
        )
        actor_id = _resolve_actor_user_id(current_user)

        if not stocktake.items:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Stocktake payload must include at least one item"
            )

        product_ids = [item.product_id for item in stocktake.items]
        if len(set(product_ids)) != len(product_ids):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Duplicate product rows found in stocktake payload"
            )

        # Resolve actor name for human-readable reporting.
        performed_by_name: Optional[str] = None
        staff_profile_id = actor_context.get('staff_profile_id')
        if staff_profile_id:
            profile_result = supabase.table(Tables.STAFF_PROFILES)\
                .select('display_name,staff_code')\
                .eq('id', staff_profile_id)\
                .limit(1)\
                .execute()
            if profile_result.data:
                profile = profile_result.data[0]
                performed_by_name = str(
                    profile.get('display_name')
                    or profile.get('staff_code')
                    or ''
                ).strip() or None

        if not performed_by_name:
            performed_by_name = str(
                current_user.get('name')
                or current_user.get('email')
                or ''
            ).strip() or None

        # Fetch product rows in chunks to avoid oversized IN clauses.
        product_map: Dict[str, Dict[str, Any]] = {}
        chunk_size = 250
        for index in range(0, len(product_ids), chunk_size):
            chunk = product_ids[index:index + chunk_size]
            products_result = supabase.table('pos_products')\
                .select('id,name,sku,barcode,quantity_on_hand,cost_price,outlet_id')\
                .eq('outlet_id', stocktake.outlet_id)\
                .in_('id', chunk)\
                .execute()
            for product in (products_result.data or []):
                product_id = product.get('id')
                if product_id:
                    product_map[str(product_id)] = product

        missing_products = [product_id for product_id in product_ids if product_id not in product_map]
        if missing_products:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "message": "Some stocktake products were not found in this outlet",
                    "missing_product_ids": missing_products[:50]
                }
            )

        conflicts: List[Dict[str, Any]] = []
        changed_rows: List[Dict[str, Any]] = []
        unchanged_items = 0
        positive_variance_items = 0
        negative_variance_items = 0
        net_quantity_variance = 0
        total_variance_value = Decimal('0')

        for row in stocktake.items:
            product = product_map[row.product_id]
            live_quantity = int(product.get('quantity_on_hand') or 0)
            if live_quantity != int(row.current_quantity):
                conflicts.append({
                    "product_id": row.product_id,
                    "product_name": product.get('name'),
                    "expected_quantity": int(row.current_quantity),
                    "actual_quantity": live_quantity
                })
                continue

            quantity_change = int(row.counted_quantity) - live_quantity
            if quantity_change == 0:
                unchanged_items += 1
                continue

            reason = str(row.reason or '').strip()
            if not reason:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Reason is required for product {product.get('name') or row.product_id}"
                )

            if quantity_change > 0:
                positive_variance_items += 1
            else:
                negative_variance_items += 1

            unit_cost_decimal: Optional[Decimal]
            if row.unit_cost is not None:
                unit_cost_decimal = Decimal(str(row.unit_cost))
            elif product.get('cost_price') is not None:
                unit_cost_decimal = Decimal(str(product.get('cost_price')))
            else:
                unit_cost_decimal = None

            if unit_cost_decimal is not None and unit_cost_decimal >= 0:
                total_variance_value += abs(Decimal(quantity_change) * unit_cost_decimal)

            net_quantity_variance += quantity_change
            changed_rows.append({
                "product_id": row.product_id,
                "product_name": product.get('name'),
                "sku": product.get('sku'),
                "barcode": product.get('barcode'),
                "current_quantity": live_quantity,
                "counted_quantity": int(row.counted_quantity),
                "quantity_change": quantity_change,
                "reason": reason,
                "notes": str(row.notes or '').strip(),
                "unit_cost": unit_cost_decimal
            })

        if conflicts:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "message": "Stock levels changed while counting. Refresh and recount before applying stocktake.",
                    "conflicts": conflicts[:50]
                }
            )

        session_id = str(uuid.uuid4())
        started_at = stocktake.started_at or datetime.utcnow()
        completed_at = datetime.utcnow()
        completed_at_iso = completed_at.isoformat()

        movement_ids: List[str] = []
        product_rollbacks: List[Tuple[str, int]] = []

        try:
            for row in changed_rows:
                product_rollbacks.append((row["product_id"], row["current_quantity"]))

                product_update = supabase.table('pos_products').update({
                    'quantity_on_hand': row["counted_quantity"],
                    'updated_at': completed_at_iso
                }).eq('id', row["product_id"]).execute()

                if not product_update.data:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Failed to update stock for product {row['product_id']}"
                    )

                movement_id = str(uuid.uuid4())
                note_payload = {
                    "reason": row["reason"],
                    "notes": row["notes"]
                }
                unit_cost_value = row["unit_cost"]
                movement_payload = {
                    'id': movement_id,
                    'product_id': row["product_id"],
                    'outlet_id': stocktake.outlet_id,
                    'movement_type': MovementType.ADJUSTMENT.value,
                    'quantity_change': row["quantity_change"],
                    'quantity_before': row["current_quantity"],
                    'quantity_after': row["counted_quantity"],
                    'reference_id': session_id,
                    'reference_type': 'stocktake_session',
                    'unit_cost': float(unit_cost_value) if unit_cost_value is not None else None,
                    'total_value': float(abs(Decimal(row["quantity_change"]) * unit_cost_value)) if unit_cost_value is not None else None,
                    'notes': json.dumps(note_payload),
                    'performed_by': actor_id,
                    'movement_date': completed_at_iso
                }
                movement_result = supabase.table('pos_stock_movements').insert(movement_payload).execute()
                if not movement_result.data:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Failed to record stock movement for product {row['product_id']}"
                    )

                movement_ids.append(movement_id)

        except HTTPException:
            _rollback_stocktake_changes(supabase, product_rollbacks, movement_ids)
            raise
        except Exception as commit_error:
            _rollback_stocktake_changes(supabase, product_rollbacks, movement_ids)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to apply stocktake changes: {str(commit_error)}"
            )

        session_payload = {
            "id": session_id,
            "outlet_id": stocktake.outlet_id,
            "terminal_id": stocktake.terminal_id,
            "performed_by": actor_id,
            "performed_by_staff_profile_id": staff_profile_id,
            "performed_by_name": performed_by_name,
            "started_at": started_at.isoformat(),
            "completed_at": completed_at_iso,
            "status": "completed",
            "total_items": len(stocktake.items),
            "adjusted_items": len(changed_rows),
            "unchanged_items": unchanged_items,
            "positive_variance_items": positive_variance_items,
            "negative_variance_items": negative_variance_items,
            "net_quantity_variance": net_quantity_variance,
            "total_variance_value": float(total_variance_value),
            "notes": stocktake.notes,
            "created_at": completed_at_iso,
            "updated_at": completed_at_iso
        }

        try:
            _insert_stocktake_session_compat(supabase, session_payload)
        except Exception as session_error:
            if _is_missing_table_error(session_error, 'pos_stocktake_sessions'):
                logger.warning(
                    "pos_stocktake_sessions table missing; committed stocktake %s using movement records only",
                    session_id
                )
            else:
                logger.error(
                    "Stocktake %s committed but failed to persist session summary: %s",
                    session_id,
                    session_error
                )

        return StocktakeCommitResponse(
            session_id=session_id,
            outlet_id=stocktake.outlet_id,
            terminal_id=stocktake.terminal_id,
            performed_by=actor_id,
            performed_by_name=performed_by_name,
            started_at=started_at,
            completed_at=completed_at,
            status='completed',
            total_items=len(stocktake.items),
            adjusted_items=len(changed_rows),
            unchanged_items=unchanged_items,
            positive_variance_items=positive_variance_items,
            negative_variance_items=negative_variance_items,
            net_quantity_variance=net_quantity_variance,
            total_variance_value=total_variance_value,
            movement_ids=movement_ids
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error committing stocktake: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to commit stocktake: {str(e)}"
        )


@router.get("/inventory/movements", response_model=List[StockMovementResponse])
async def get_stock_movements(
    outlet_id: str,
    product_id: Optional[str] = Query(None, description="Filter by product"),
    movement_type: Optional[MovementType] = Query(None, description="Filter by movement type"),
    date_from: Optional[date] = Query(None, description="Start date"),
    date_to: Optional[date] = Query(None, description="End date"),
    limit: int = Query(100, ge=1, le=500, description="Maximum results"),
    current_user=Depends(CurrentUser())
):
    """Get stock movements with filtering"""
    try:
        supabase = get_supabase_admin()

        query = supabase.table('pos_stock_movements').select('*').eq('outlet_id', outlet_id)

        if product_id:
            query = query.eq('product_id', product_id)
        if movement_type:
            query = query.eq('movement_type', movement_type.value)
        if date_from:
            query = query.gte('movement_date', date_from.isoformat())
        if date_to:
            # Keep date_to inclusive for the full calendar day by querying
            # movement_date < (date_to + 1 day) at midnight.
            query = query.lt('movement_date', (date_to + timedelta(days=1)).isoformat())

        query = query.limit(limit).order('movement_date', desc=True)

        result = query.execute()

        return [StockMovementResponse(**item) for item in (result.data or [])]

    except Exception as e:
        logger.error(f"Error fetching stock movements: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch stock movements: {str(e)}"
        )


@router.post("/inventory/transfers", response_model=InventoryTransferResponse)
async def create_inventory_transfer(
    transfer: InventoryTransferCreate,
    x_pos_staff_session: Optional[str] = Header(None, alias="X-POS-Staff-Session"),
    current_user=Depends(CurrentUser())
):
    """Transfer inventory between outlets and post transfer movements."""
    try:
        supabase = get_supabase_admin()
        actor_context = _require_manager_role(
            supabase,
            current_user,
            transfer.from_outlet_id,
            x_pos_staff_session
        )

        if transfer.from_outlet_id == transfer.to_outlet_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Source and destination outlets cannot be the same"
            )

        now_iso = datetime.utcnow().isoformat()
        transfer_id = str(uuid.uuid4())
        transfer_number = f"TRF-{datetime.utcnow().strftime('%Y%m%d')}-{transfer_id[:8].upper()}"
        performed_by = _resolve_actor_user_id(current_user)

        outlet_result = supabase.table('outlets').select('id,name').in_(
            'id', [transfer.from_outlet_id, transfer.to_outlet_id]
        ).execute()
        outlet_map = {
            outlet.get('id'): outlet.get('name') or 'Outlet'
            for outlet in (outlet_result.data or [])
            if outlet.get('id')
        }
        from_outlet_name = outlet_map.get(transfer.from_outlet_id, 'Source Outlet')
        to_outlet_name = outlet_map.get(transfer.to_outlet_id, 'Destination Outlet')

        response_items: List[Dict[str, Any]] = []
        total_items = 0
        total_value = Decimal('0')

        for item in transfer.items:
            quantity = int(item.quantity_requested)
            if quantity <= 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Transfer quantity must be greater than zero"
                )

            source_result = supabase.table('pos_products').select('*').eq('id', item.product_id).execute()
            if not source_result.data:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Source product {item.product_id} not found"
                )

            source_product = source_result.data[0]
            if source_product.get('outlet_id') != transfer.from_outlet_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Product {item.product_id} does not belong to source outlet"
                )

            available_qty = int(source_product.get('quantity_on_hand') or 0)
            if available_qty < quantity:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Insufficient stock for {source_product.get('name') or source_product.get('sku') or 'item'}"
                )

            destination_result = supabase.table('pos_products').select('*')\
                .eq('outlet_id', transfer.to_outlet_id)\
                .eq('sku', source_product.get('sku'))\
                .limit(1)\
                .execute()

            destination_product = destination_result.data[0] if destination_result.data else None
            if not destination_product:
                source_unit_price = source_product.get('unit_price')
                safe_unit_price = float(source_unit_price) if source_unit_price is not None else 0.01
                if safe_unit_price <= 0:
                    safe_unit_price = 0.01

                destination_payload = {
                    'id': str(uuid.uuid4()),
                    'outlet_id': transfer.to_outlet_id,
                    'sku': source_product.get('sku'),
                    'barcode': source_product.get('barcode'),
                    'name': source_product.get('name'),
                    'description': source_product.get('description'),
                    'category': source_product.get('category'),
                    'unit_price': safe_unit_price,
                    'cost_price': source_product.get('cost_price') or 0,
                    'tax_rate': source_product.get('tax_rate') or 0,
                    'quantity_on_hand': 0,
                    'reorder_level': source_product.get('reorder_level') or 0,
                    'reorder_quantity': source_product.get('reorder_quantity') or 0,
                    'is_active': True if source_product.get('is_active') is None else source_product.get('is_active'),
                    'vendor_id': source_product.get('vendor_id'),
                    'image_url': source_product.get('image_url'),
                    'display_order': source_product.get('display_order') or 0,
                    'created_at': now_iso,
                    'updated_at': now_iso
                }
                destination_create = supabase.table('pos_products').insert(destination_payload).execute()
                if not destination_create.data:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Failed to create destination product for transfer"
                    )
                destination_product = destination_create.data[0]

            source_before = available_qty
            source_after = source_before - quantity
            destination_before = int(destination_product.get('quantity_on_hand') or 0)
            destination_after = destination_before + quantity

            source_update = supabase.table('pos_products').update({
                'quantity_on_hand': source_after,
                'updated_at': now_iso
            }).eq('id', source_product['id']).execute()
            if not source_update.data:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Failed to update source outlet stock"
                )

            destination_update = supabase.table('pos_products').update({
                'quantity_on_hand': destination_after,
                'updated_at': now_iso
            }).eq('id', destination_product['id']).execute()
            if not destination_update.data:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Failed to update destination outlet stock"
                )

            unit_cost = Decimal(str(source_product.get('cost_price') or 0))
            line_total_value = unit_cost * Decimal(quantity)
            total_value += line_total_value
            total_items += quantity

            transfer_note = json.dumps({
                'transfer_id': transfer_id,
                'transfer_number': transfer_number,
                'from_outlet_id': transfer.from_outlet_id,
                'to_outlet_id': transfer.to_outlet_id,
                'from_outlet_name': from_outlet_name,
                'to_outlet_name': to_outlet_name,
                'transfer_reason': transfer.transfer_reason,
                'transfer_notes': transfer.notes,
                'product_name': source_product.get('name'),
                'product_sku': source_product.get('sku'),
                'status': TransferStatus.RECEIVED.value
            }, default=str)

            out_movement = {
                'id': str(uuid.uuid4()),
                'product_id': source_product['id'],
                'outlet_id': transfer.from_outlet_id,
                'movement_type': MovementType.TRANSFER_OUT.value,
                'quantity_change': -quantity,
                'quantity_before': source_before,
                'quantity_after': source_after,
                'reference_id': transfer_id,
                'reference_type': 'stock_transfer',
                'unit_cost': float(unit_cost) if unit_cost > 0 else None,
                'total_value': float(line_total_value) if unit_cost > 0 else None,
                'notes': transfer_note,
                'performed_by': performed_by,
                'movement_date': now_iso
            }
            in_movement = {
                'id': str(uuid.uuid4()),
                'product_id': destination_product['id'],
                'outlet_id': transfer.to_outlet_id,
                'movement_type': MovementType.TRANSFER_IN.value,
                'quantity_change': quantity,
                'quantity_before': destination_before,
                'quantity_after': destination_after,
                'reference_id': transfer_id,
                'reference_type': 'stock_transfer',
                'unit_cost': float(unit_cost) if unit_cost > 0 else None,
                'total_value': float(line_total_value) if unit_cost > 0 else None,
                'notes': transfer_note,
                'performed_by': performed_by,
                'movement_date': now_iso
            }

            out_result = supabase.table('pos_stock_movements').insert(out_movement).execute()
            in_result = supabase.table('pos_stock_movements').insert(in_movement).execute()
            if not out_result.data or not in_result.data:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Failed to create stock movement records for transfer"
                )

            response_items.append({
                'id': str(uuid.uuid4()),
                'product_id': source_product['id'],
                'product_name': source_product.get('name') or 'Product',
                'sku': source_product.get('sku') or '',
                'quantity_requested': quantity,
                'quantity_sent': quantity,
                'quantity_received': quantity,
                'unit_cost': float(unit_cost) if unit_cost > 0 else None,
                'batch_number': item.batch_number,
                'expiry_date': item.expiry_date,
                'notes': item.notes
            })

        transfer_response = {
            'id': transfer_id,
            'transfer_number': transfer_number,
            'from_outlet_id': transfer.from_outlet_id,
            'to_outlet_id': transfer.to_outlet_id,
            'from_outlet_name': from_outlet_name,
            'to_outlet_name': to_outlet_name,
            'status': TransferStatus.RECEIVED.value,
            'transfer_reason': transfer.transfer_reason,
            'total_items': total_items,
            'total_value': float(total_value),
            'requested_by': performed_by,
            'approved_by': performed_by,
            'received_by': performed_by,
            'notes': transfer.notes,
            'requested_at': now_iso,
            'approved_at': now_iso,
            'received_at': now_iso,
            'items': response_items
        }

        return InventoryTransferResponse(**transfer_response)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating inventory transfer: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create inventory transfer: {str(e)}"
        )


@router.get("/inventory/transfers")
async def list_inventory_transfers(
    outlet_id: Optional[str] = Query(None, description="Filter by outlet"),
    status_filter: Optional[TransferStatus] = Query(None, alias="status", description="Filter by status"),
    date_from: Optional[date] = Query(None, description="Start date"),
    date_to: Optional[date] = Query(None, description="End date"),
    page: int = Query(1, ge=1, description="Page number"),
    size: int = Query(50, ge=1, le=200, description="Page size"),
    current_user=Depends(CurrentUser())
):
    """List inventory transfers derived from stock transfer movements."""
    try:
        supabase = get_supabase_admin()

        if status_filter and status_filter != TransferStatus.RECEIVED:
            return {'items': [], 'total': 0, 'page': page, 'size': size}

        query = supabase.table('pos_stock_movements').select('*').eq('reference_type', 'stock_transfer')
        if outlet_id:
            query = query.eq('outlet_id', outlet_id)
        if date_from:
            query = query.gte('movement_date', f"{date_from.isoformat()}T00:00:00")
        if date_to:
            end_exclusive = date_to + timedelta(days=1)
            query = query.lt('movement_date', f"{end_exclusive.isoformat()}T00:00:00")

        # Pull a bounded set and page after grouping by transfer reference.
        result = query.order('movement_date', desc=True).limit(2000).execute()
        movements = result.data or []
        if not movements:
            return {'items': [], 'total': 0, 'page': page, 'size': size}

        product_ids = {
            movement.get('product_id')
            for movement in movements
            if movement.get('product_id')
        }
        product_map: Dict[str, Dict[str, Any]] = {}
        if product_ids:
            products_result = supabase.table('pos_products').select('id,name,sku').in_(
                'id', list(product_ids)
            ).execute()
            product_map = {
                product.get('id'): product
                for product in (products_result.data or [])
                if product.get('id')
            }

        grouped: Dict[str, Dict[str, Any]] = {}
        for movement in movements:
            reference_id = movement.get('reference_id')
            if not reference_id:
                continue

            metadata = _safe_json_loads(movement.get('notes'))
            transfer = grouped.setdefault(reference_id, {
                'id': reference_id,
                'transfer_number': metadata.get('transfer_number') or f"TRF-{reference_id[:8].upper()}",
                'from_outlet_id': metadata.get('from_outlet_id'),
                'to_outlet_id': metadata.get('to_outlet_id'),
                'from_outlet_name': metadata.get('from_outlet_name') or 'Source Outlet',
                'to_outlet_name': metadata.get('to_outlet_name') or 'Destination Outlet',
                'status': metadata.get('status') or TransferStatus.RECEIVED.value,
                'transfer_reason': metadata.get('transfer_reason'),
                'requested_by': movement.get('performed_by') or 'system',
                'approved_by': movement.get('performed_by') or 'system',
                'received_by': movement.get('performed_by') or 'system',
                'notes': metadata.get('transfer_notes') or '',
                'requested_at': movement.get('movement_date'),
                'approved_at': movement.get('movement_date'),
                'received_at': movement.get('movement_date'),
                '_item_map': {}
            })

            movement_date = movement.get('movement_date')
            if movement_date and transfer['requested_at']:
                transfer['requested_at'] = min(transfer['requested_at'], movement_date)
            if movement_date and transfer['received_at']:
                transfer['received_at'] = max(transfer['received_at'], movement_date)

            movement_type = movement.get('movement_type')
            quantity = abs(int(movement.get('quantity_change') or 0))
            product_id = movement.get('product_id')
            if not product_id:
                continue

            product_meta = product_map.get(product_id, {})
            item_key = metadata.get('product_sku') or product_id
            item_map = transfer['_item_map']
            transfer_item = item_map.setdefault(item_key, {
                'id': str(uuid.uuid4()),
                'product_id': product_id,
                'product_name': metadata.get('product_name') or product_meta.get('name') or 'Product',
                'sku': metadata.get('product_sku') or product_meta.get('sku') or '',
                'quantity_requested': 0,
                'quantity_sent': 0,
                'quantity_received': 0,
                'unit_cost': movement.get('unit_cost'),
                'batch_number': None,
                'expiry_date': None,
                'notes': None
            })

            if movement_type == MovementType.TRANSFER_OUT.value:
                transfer_item['quantity_requested'] += quantity
                transfer_item['quantity_sent'] += quantity
                transfer['from_outlet_id'] = transfer['from_outlet_id'] or movement.get('outlet_id')
            elif movement_type == MovementType.TRANSFER_IN.value:
                transfer_item['quantity_received'] += quantity
                transfer['to_outlet_id'] = transfer['to_outlet_id'] or movement.get('outlet_id')

        transfer_items: List[Dict[str, Any]] = []
        for transfer in grouped.values():
            items = list(transfer.pop('_item_map').values())
            transfer['items'] = items
            transfer['total_items'] = sum(
                item['quantity_requested'] or item['quantity_received']
                for item in items
            )
            transfer['total_value'] = float(sum(
                (item.get('unit_cost') or 0) * (
                    item.get('quantity_sent')
                    or item.get('quantity_requested')
                    or item.get('quantity_received')
                    or 0
                )
                for item in items
            ))
            transfer_items.append(transfer)

        transfer_items.sort(
            key=lambda item: item.get('requested_at') or '',
            reverse=True
        )

        total = len(transfer_items)
        offset = (page - 1) * size
        paginated = transfer_items[offset: offset + size]

        # Validate payload shape against response schema for consistency.
        validated_items = [InventoryTransferResponse(**item).model_dump(mode='json') for item in paginated]

        return {
            'items': validated_items,
            'total': total,
            'page': page,
            'size': size
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error listing inventory transfers: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list inventory transfers: {str(e)}"
        )


# ===============================================
# STATISTICS AND REPORTING ENDPOINTS
# ===============================================

@router.get("/stats/inventory", response_model=InventoryStatsResponse)
async def get_inventory_stats(
    outlet_id: str,
    current_user=Depends(CurrentUser())
):
    """Get inventory statistics"""
    try:
        supabase = get_supabase_admin()

        # Get inventory statistics
        result = supabase.table('pos_products').select('*').eq('outlet_id', outlet_id).execute()

        products = result.data or []

        total_products = len(products)
        active_products = len([p for p in products if p['is_active']])
        low_stock_count = len([p for p in products if p['quantity_on_hand'] <= p['reorder_level']])
        out_of_stock_count = len([p for p in products if p['quantity_on_hand'] == 0])

        # Calculate total inventory value
        total_value = sum(
            Decimal(str(p['quantity_on_hand'])) * Decimal(str(p['cost_price'] or 0))
            for p in products if p['cost_price']
        )

        return InventoryStatsResponse(
            total_products=total_products,
            active_products=active_products,
            low_stock_count=low_stock_count,
            out_of_stock_count=out_of_stock_count,
            total_inventory_value=total_value
        )

    except Exception as e:
        logger.error(f"Error fetching inventory stats: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch inventory stats: {str(e)}"
        )


@router.get("/stats/sales", response_model=SalesStatsResponse)
async def get_sales_stats(
    outlet_id: str,
    date_from: Optional[date] = Query(None, description="Start date"),
    date_to: Optional[date] = Query(None, description="End date"),
    current_user=Depends(CurrentUser())
):
    """Get sales statistics"""
    try:
        supabase = get_supabase_admin()

        # Default to today if no dates provided
        if not date_from:
            date_from = date.today()
        if not date_to:
            date_to = date.today()

        # Get transactions in date range
        query = supabase.table('pos_transactions').select(
            '*, pos_transaction_items(*, pos_products(name))'
        ).eq('outlet_id', outlet_id).eq('status', 'completed')

        query = query.gte('transaction_date', date_from.isoformat())
        query = query.lte('transaction_date', f"{date_to.isoformat()}T23:59:59")

        result = query.execute()
        transactions = result.data or []

        # Calculate statistics
        total_sales = sum(Decimal(str(tx['total_amount'])) for tx in transactions)
        transaction_count = len(transactions)
        avg_transaction_value = total_sales / transaction_count if transaction_count > 0 else Decimal(0)

        # Sales by payment method (split-aware)
        cash_sales = Decimal(0)
        transfer_sales = Decimal(0)
        pos_sales = Decimal(0)
        for tx in transactions:
            allocations = _allocate_transaction_amount_by_method(tx)
            cash_sales += allocations.get('cash', Decimal(0))
            transfer_sales += allocations.get('transfer', Decimal(0))
            pos_sales += allocations.get('pos', Decimal(0))

        # Top products (simplified)
        top_products = []

        return SalesStatsResponse(
            total_sales=total_sales,
            transaction_count=transaction_count,
            avg_transaction_value=avg_transaction_value,
            cash_sales=cash_sales,
            transfer_sales=transfer_sales,
            pos_sales=pos_sales,
            top_products=top_products
        )

    except Exception as e:
        logger.error(f"Error fetching sales stats: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch sales stats: {str(e)}"
        )


# ===============================================
# HELD RECEIPT ENDPOINTS
# ===============================================

@router.post("/held-receipts", response_model=HeldReceiptResponse)
async def create_held_receipt(
    receipt: HeldReceiptCreate,
    current_user=Depends(CurrentUser())
):
    """Create a held receipt (put sale on hold)"""
    try:
        supabase = get_supabase_admin()
        
        # Get cashier name: POS uses staff_profile id, so try staff_profiles.display_name first, then users.name
        cashier_name = "Cashier"
        try:
            staff_result = supabase.table(Tables.STAFF_PROFILES).select('display_name').eq('id', receipt.cashier_id).execute()
            if staff_result.data and len(staff_result.data) > 0:
                cashier_name = staff_result.data[0].get('display_name') or cashier_name
            else:
                user_result = supabase.table('users').select('name').eq('id', receipt.cashier_id).execute()
                if user_result.data and len(user_result.data) > 0:
                    cashier_name = user_result.data[0].get('name') or cashier_name
        except Exception:
            pass
        
        # Prepare held receipt data (ensure JSON-serializable types)
        receipt_id = str(uuid.uuid4())

        # Serialize items with JSON-friendly types (e.g. Decimal -> float)
        try:
            items_json = [item.model_dump(mode="json") for item in receipt.items]
        except AttributeError:
            # Fallback for older Pydantic versions
            items_json = []
            for item in receipt.items:
                item_dict = item.dict()
                # Safely cast known numeric fields if present
                if "unit_price" in item_dict:
                    item_dict["unit_price"] = float(item_dict["unit_price"])
                if "discount" in item_dict:
                    item_dict["discount"] = float(item_dict["discount"])
                items_json.append(item_dict)

        receipt_data = {
            'id': receipt_id,
            'outlet_id': receipt.outlet_id,
            'cashier_id': receipt.cashier_id,
            'cashier_name': cashier_name,
            'items': items_json,
            'total': float(receipt.total),
            'saved_at': datetime.utcnow().isoformat(),
            'created_at': datetime.utcnow().isoformat(),
            'updated_at': datetime.utcnow().isoformat()
        }
        
        # Insert held receipt
        result = supabase.table(Tables.POS_HELD_RECEIPTS).insert(receipt_data).execute()
        
        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to create held receipt"
            )
        
        return HeldReceiptResponse(**result.data[0])
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating held receipt: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create held receipt: {str(e)}"
        )


@router.get("/held-receipts", response_model=HeldReceiptListResponse)
async def get_held_receipts(
    outlet_id: str,
    current_user=Depends(CurrentUser())
):
    """Get all held receipts for an outlet"""
    try:
        supabase = get_supabase_admin()
        
        # Get held receipts for outlet
        result = supabase.table(Tables.POS_HELD_RECEIPTS)\
            .select('*')\
            .eq('outlet_id', outlet_id)\
            .order('saved_at', desc=True)\
            .execute()
        
        receipts = [HeldReceiptResponse(**r) for r in result.data] if result.data else []
        
        return HeldReceiptListResponse(
            receipts=receipts,
            total=len(receipts)
        )
        
    except Exception as e:
        logger.error(f"Error fetching held receipts: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch held receipts: {str(e)}"
        )


@router.get("/held-receipts/{receipt_id}", response_model=HeldReceiptResponse)
async def get_held_receipt(
    receipt_id: str,
    current_user=Depends(CurrentUser())
):
    """Get a specific held receipt"""
    try:
        supabase = get_supabase_admin()
        
        result = supabase.table(Tables.POS_HELD_RECEIPTS)\
            .select('*')\
            .eq('id', receipt_id)\
            .execute()
        
        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Held receipt not found"
            )
        
        return HeldReceiptResponse(**result.data[0])
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching held receipt: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch held receipt: {str(e)}"
        )


@router.delete("/held-receipts/{receipt_id}")
async def delete_held_receipt(
    receipt_id: str,
    current_user=Depends(CurrentUser())
):
    """Delete a held receipt"""
    try:
        supabase = get_supabase_admin()
        
        # Check if receipt exists
        check_result = supabase.table(Tables.POS_HELD_RECEIPTS)\
            .select('id')\
            .eq('id', receipt_id)\
            .execute()
        
        if not check_result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Held receipt not found"
            )
        
        # Delete receipt
        supabase.table(Tables.POS_HELD_RECEIPTS)\
            .delete()\
            .eq('id', receipt_id)\
            .execute()
        
        return {"message": "Held receipt deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting held receipt: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete held receipt: {str(e)}"
        )


@router.put("/transactions/{transaction_id}/return")
async def return_transaction(
    transaction_id: str,
    return_data: Dict[str, Any],
    x_pos_staff_session: Optional[str] = Header(None, alias="X-POS-Staff-Session"),
    current_user=Depends(CurrentUser())
):
    """Process a full or partial transaction return."""
    try:
        supabase = get_supabase_admin()

        return_reason = str(return_data.get('return_reason') or 'Customer return').strip() or 'Customer return'
        raw_return_items = return_data.get('items') if isinstance(return_data, dict) else None
        explicit_return_amount_raw = return_data.get('amount') if isinstance(return_data, dict) else None

        # Get original transaction
        tx_result = supabase.table('pos_transactions').select('*, pos_transaction_items(*)').eq('id', transaction_id).execute()
        if not tx_result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Original transaction not found"
            )

        original_transaction = tx_result.data[0]
        actor_context = _require_return_authorization(
            supabase,
            current_user,
            original_transaction.get('outlet_id'),
            x_pos_staff_session
        )
        actor_id = _resolve_actor_user_id(current_user)

        # Validate transaction can be returned.
        if original_transaction.get('status') != TransactionStatus.COMPLETED.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot return a {original_transaction.get('status')} transaction"
            )

        original_items = original_transaction.get('pos_transaction_items') or []
        if not original_items:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Original transaction has no line items to return"
            )

        # Get processor name for display.
        processor_name = current_user.get('name', 'Unknown')
        if actor_context.get('staff_profile_id'):
            staff_result = supabase.table(Tables.STAFF_PROFILES)\
                .select('display_name')\
                .eq('id', actor_context['staff_profile_id'])\
                .execute()
            if staff_result.data:
                processor_name = staff_result.data[0].get('display_name') or processor_name

        # Build returnable quantity/value map from original sale items.
        line_stats_by_key: Dict[str, Dict[str, Any]] = {}
        for row in original_items:
            product_id = str(row.get('product_id') or '').strip()
            if not product_id:
                continue

            sale_unit = str(row.get('sale_unit') or 'unit').strip().lower()
            sale_unit = 'pack' if sale_unit == 'pack' else 'unit'
            units_per_sale_unit = max(1, _safe_int(row.get('units_per_sale_unit'), 1))

            sale_quantity = _safe_int(row.get('sale_quantity'), 0)
            if sale_quantity <= 0:
                base_units_qty = _safe_int(row.get('base_units_quantity'), 0)
                if base_units_qty <= 0:
                    base_units_qty = _safe_int(row.get('quantity'), 0)
                if base_units_qty > 0:
                    sale_quantity = max(1, int(round(base_units_qty / units_per_sale_unit)))
            if sale_quantity <= 0:
                continue

            sale_unit_price_raw = row.get('sale_unit_price')
            if sale_unit_price_raw is None:
                base_unit_price = Decimal(str(row.get('unit_price') or 0))
                sale_unit_price = base_unit_price * Decimal(units_per_sale_unit)
            else:
                sale_unit_price = Decimal(str(sale_unit_price_raw or 0))

            line_total = Decimal(str(row.get('line_total') or 0))
            line_discount = Decimal(str(row.get('discount_amount') or 0))
            line_tax = Decimal(str(row.get('tax_amount') or 0))
            key = f"{product_id}:{sale_unit}"

            existing = line_stats_by_key.get(key)
            if not existing:
                existing = {
                    'product_id': product_id,
                    'sale_unit': sale_unit,
                    'sku': row.get('sku') or '',
                    'product_name': row.get('product_name') or 'Product',
                    'units_per_sale_unit': units_per_sale_unit,
                    'total_sale_quantity': 0,
                    'total_line_total': Decimal('0'),
                    'total_discount': Decimal('0'),
                    'total_tax': Decimal('0'),
                    'total_sale_unit_price': Decimal('0'),
                }
                line_stats_by_key[key] = existing

            existing['units_per_sale_unit'] = max(
                int(existing.get('units_per_sale_unit') or 1),
                units_per_sale_unit
            )
            existing['total_sale_quantity'] += sale_quantity
            existing['total_line_total'] += line_total
            existing['total_discount'] += line_discount
            existing['total_tax'] += line_tax
            existing['total_sale_unit_price'] += sale_unit_price * Decimal(sale_quantity)

        if not line_stats_by_key:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Original transaction has no returnable items"
            )

        original_total = Decimal(str(original_transaction.get('total_amount') or 0))
        if original_total < 0:
            original_total = abs(original_total)
        if original_total <= Decimal('0'):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Original transaction has no refundable amount"
            )

        # Gather previous return quantities linked to this transaction.
        return_reference_key = f"return_of:{transaction_id}"
        prior_returns_result = supabase.table('pos_transactions')\
            .select('id,total_amount,items:pos_transaction_items(*)')\
            .eq('payment_reference', return_reference_key)\
            .execute()

        prior_returns = prior_returns_result.data or []
        already_returned_total = Decimal('0')
        returned_qty_by_key: Dict[str, int] = {}
        for prior in prior_returns:
            prior_total = Decimal(str(prior.get('total_amount') or 0))
            already_returned_total += abs(prior_total)

            for item in prior.get('items') or []:
                prior_product_id = str(item.get('product_id') or '').strip()
                if not prior_product_id:
                    continue
                prior_sale_unit = str(item.get('sale_unit') or 'unit').strip().lower()
                prior_sale_unit = 'pack' if prior_sale_unit == 'pack' else 'unit'
                prior_units_per_sale_unit = max(1, _safe_int(item.get('units_per_sale_unit'), 1))

                prior_sale_qty = _safe_int(item.get('sale_quantity'), 0)
                if prior_sale_qty <= 0:
                    prior_base_units = _safe_int(item.get('base_units_quantity'), 0)
                    if prior_base_units <= 0:
                        prior_base_units = _safe_int(item.get('quantity'), 0)
                    if prior_base_units > 0:
                        prior_sale_qty = max(1, int(round(prior_base_units / prior_units_per_sale_unit)))
                if prior_sale_qty <= 0:
                    continue

                prior_key = f"{prior_product_id}:{prior_sale_unit}"
                returned_qty_by_key[prior_key] = returned_qty_by_key.get(prior_key, 0) + prior_sale_qty

        for key, stats in line_stats_by_key.items():
            already_qty = max(0, int(returned_qty_by_key.get(key, 0)))
            total_qty = max(0, int(stats.get('total_sale_quantity') or 0))
            stats['already_returned_quantity'] = min(total_qty, already_qty)
            stats['remaining_sale_quantity'] = max(0, total_qty - stats['already_returned_quantity'])

        remaining_refundable_total = max(Decimal('0'), original_total - already_returned_total)
        if remaining_refundable_total <= Decimal('0.01'):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Transaction has already been fully returned"
            )

        # Normalize requested quantities.
        requested_qty_by_key: Dict[str, int] = {}
        if isinstance(raw_return_items, list) and len(raw_return_items) > 0:
            for index, row in enumerate(raw_return_items, start=1):
                if not isinstance(row, dict):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Invalid return item payload at position {index}"
                    )

                product_id = str(row.get('product_id') or '').strip()
                if not product_id:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Return item at position {index} is missing product_id"
                    )

                sale_unit = str(row.get('sale_unit') or 'unit').strip().lower()
                sale_unit = 'pack' if sale_unit == 'pack' else 'unit'
                quantity = _safe_int(row.get('quantity'), 0)
                if quantity <= 0:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Return quantity must be greater than zero at position {index}"
                    )

                key = f"{product_id}:{sale_unit}"
                requested_qty_by_key[key] = requested_qty_by_key.get(key, 0) + quantity
        else:
            # Full return of all currently remaining quantities.
            for key, stats in line_stats_by_key.items():
                remaining_qty = max(0, int(stats.get('remaining_sale_quantity') or 0))
                if remaining_qty > 0:
                    requested_qty_by_key[key] = remaining_qty

        if not requested_qty_by_key:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No return quantities were provided"
            )

        return_transaction_id = str(uuid.uuid4())
        return_transaction_number = f"RTN-{datetime.now().strftime('%Y%m%d')}-{return_transaction_id[:8].upper()}"

        return_items_rows: List[Dict[str, Any]] = []
        returned_item_lines: List[Dict[str, Any]] = []
        subtotal_to_record = Decimal('0')
        tax_to_record = Decimal('0')
        total_to_record = Decimal('0')

        for key, requested_qty in requested_qty_by_key.items():
            stats = line_stats_by_key.get(key)
            if not stats:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Returned item {key} was not sold in the original transaction"
                )

            remaining_qty = max(0, int(stats.get('remaining_sale_quantity') or 0))
            if requested_qty > remaining_qty:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        f"Requested return quantity ({requested_qty}) exceeds remaining quantity "
                        f"({remaining_qty}) for item {stats.get('product_name') or stats.get('product_id')}"
                    )
                )

            total_sale_qty = max(1, int(stats.get('total_sale_quantity') or 1))
            per_unit_line_total = Decimal(str(stats.get('total_line_total') or 0)) / Decimal(total_sale_qty)
            per_unit_discount = Decimal(str(stats.get('total_discount') or 0)) / Decimal(total_sale_qty)
            per_unit_tax = Decimal(str(stats.get('total_tax') or 0)) / Decimal(total_sale_qty)

            weighted_sale_unit_price_total = Decimal(str(stats.get('total_sale_unit_price') or 0))
            if weighted_sale_unit_price_total > 0:
                sale_unit_price = weighted_sale_unit_price_total / Decimal(total_sale_qty)
            else:
                sale_unit_price = per_unit_line_total + per_unit_discount

            line_total = (per_unit_line_total * Decimal(requested_qty)).quantize(Decimal('0.01'))
            line_discount = (per_unit_discount * Decimal(requested_qty)).quantize(Decimal('0.01'))
            line_tax = (per_unit_tax * Decimal(requested_qty)).quantize(Decimal('0.01'))
            sale_unit_price = sale_unit_price.quantize(Decimal('0.01'))

            units_per_sale_unit = max(1, int(stats.get('units_per_sale_unit') or 1))
            base_units_quantity = requested_qty * units_per_sale_unit
            base_unit_price = (sale_unit_price / Decimal(units_per_sale_unit)).quantize(Decimal('0.01'))

            return_items_rows.append({
                'id': str(uuid.uuid4()),
                'transaction_id': return_transaction_id,
                'product_id': stats['product_id'],
                'sku': stats.get('sku') or '',
                'product_name': stats.get('product_name') or 'Product',
                # Keep quantity as base units for inventory-safe reversals.
                'quantity': base_units_quantity,
                'unit_price': float(base_unit_price),
                'discount_amount': float(line_discount),
                'tax_amount': float(line_tax),
                'line_total': float(line_total),
                'sale_unit': stats.get('sale_unit') or 'unit',
                'sale_quantity': requested_qty,
                'sale_unit_price': float(sale_unit_price),
                'units_per_sale_unit': units_per_sale_unit,
                'base_units_quantity': base_units_quantity,
            })

            returned_item_lines.append({
                'product_id': stats['product_id'],
                'product_name': stats.get('product_name') or 'Product',
                'sale_unit': stats.get('sale_unit') or 'unit',
                'quantity': requested_qty,
                'line_total': float(line_total),
            })

            subtotal_to_record += line_total
            tax_to_record += line_tax
            total_to_record += line_total

        if total_to_record <= Decimal('0'):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Return amount must be greater than zero"
            )

        if explicit_return_amount_raw is not None:
            explicit_return_amount = abs(Decimal(str(explicit_return_amount_raw)))
            if abs(explicit_return_amount - total_to_record) > Decimal('0.05'):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Return amount does not match selected item totals"
                )

        remaining_after_this = max(Decimal('0'), remaining_refundable_total - total_to_record)
        is_full_return = remaining_after_this <= Decimal('0.01')

        # Prepare return transaction data.
        return_transaction_data = {
            'id': return_transaction_id,
            'transaction_number': return_transaction_number,
            'outlet_id': original_transaction['outlet_id'],
            'cashier_id': actor_id,
            'cashier_staff_profile_id': actor_context.get('staff_profile_id'),
            'cashier_name': processor_name,
            'customer_id': original_transaction.get('customer_id'),
            'customer_name': original_transaction.get('customer_name'),
            'subtotal': float(subtotal_to_record),
            'tax_amount': float(tax_to_record),
            'discount_amount': 0,
            'total_amount': float(total_to_record),
            'payment_method': original_transaction.get('payment_method') or 'cash',
            'tendered_amount': None,
            'change_amount': 0,
            'payment_reference': return_reference_key,
            'status': TransactionStatus.REFUNDED.value,
            'receipt_type': 'return',
            'transaction_date': datetime.utcnow().isoformat(),
            'sync_status': SyncStatus.SYNCED.value,
            'notes': f"Return for transaction {original_transaction['transaction_number']}: {return_reason}",
            'receipt_printed': False,
            'created_at': datetime.utcnow().isoformat(),
            'updated_at': datetime.utcnow().isoformat()
        }

        # Insert return transaction
        return_result = _insert_pos_transaction_compat(supabase, return_transaction_data)
        if not return_result.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to create return transaction"
            )

        # Persist returned line items.
        items_result = _insert_pos_transaction_items_compat(supabase, return_items_rows)
        if not items_result.data:
            supabase.table('pos_transactions').delete().eq('id', return_transaction_id).execute()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to create return transaction items"
            )

        # Update original transaction status (full return -> refunded, partial return -> completed).
        supabase.table('pos_transactions').update({
            'status': TransactionStatus.REFUNDED.value if is_full_return else TransactionStatus.COMPLETED.value,
            'updated_at': datetime.utcnow().isoformat()
        }).eq('id', transaction_id).execute()

        # Restore stock only for returned quantities.
        for item in return_items_rows:
            try:
                quantity_to_restore = _resolve_stock_quantity_from_transaction_item(item)
                if quantity_to_restore <= 0:
                    continue

                product_result = supabase.table('pos_products').select('quantity_on_hand').eq('id', item['product_id']).execute()
                if not product_result.data:
                    continue

                current_qty = _safe_int(product_result.data[0].get('quantity_on_hand'), 0)
                new_qty = current_qty + quantity_to_restore

                supabase.table('pos_products').update({
                    'quantity_on_hand': new_qty,
                    'updated_at': datetime.utcnow().isoformat()
                }).eq('id', item['product_id']).execute()

                movement_data = {
                    'id': str(uuid.uuid4()),
                    'product_id': item['product_id'],
                    'outlet_id': original_transaction['outlet_id'],
                    'movement_type': 'return',
                    'quantity_change': quantity_to_restore,
                    'quantity_before': current_qty,
                    'quantity_after': new_qty,
                    'reference_id': return_transaction_id,
                    'reference_type': 'return_transaction',
                    'performed_by': actor_id,
                    'movement_date': datetime.utcnow().isoformat(),
                    'notes': (
                        f"Stock restored from return: {return_reason} "
                        f"({_safe_int(item.get('sale_quantity'), 0)} {str(item.get('sale_unit') or 'unit')}, "
                        f"{quantity_to_restore} base units)"
                    )
                }
                supabase.table('pos_stock_movements').insert(movement_data).execute()
            except Exception as stock_error:
                logger.warning(f"Failed to restore stock for product {item.get('product_id')}: {stock_error}")

        return {
            "message": "Transaction returned successfully",
            "original_transaction_id": transaction_id,
            "return_transaction_id": return_transaction_id,
            "return_transaction_number": return_transaction_number,
            "return_amount": float(total_to_record),
            "is_full_return": is_full_return,
            "remaining_refundable_amount": float(remaining_after_this),
            "returned_item_lines": returned_item_lines,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing return for transaction {transaction_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process return: {str(e)}"
        )


# ===============================================
# RECEIPT PRINTING ENDPOINTS
# ===============================================

@router.post("/receipts/{transaction_id}/print")
async def print_receipt(
    transaction_id: str,
    copies: int = Query(1, ge=1, le=3, description="Number of copies"),
    current_user=Depends(CurrentUser())
):
    """Print receipt for a transaction"""
    try:
        supabase = get_supabase_admin()
        
        # Get transaction with items
        tx_result = supabase.table('pos_transactions').select('*, pos_transaction_items(*)').eq('id', transaction_id).execute()
        if not tx_result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Transaction not found"
            )
        
        transaction = tx_result.data[0]
        
        # Get outlet info
        outlet_result = supabase.table('outlets').select('*').eq('id', transaction['outlet_id']).execute()
        outlet = outlet_result.data[0] if outlet_result.data else None

        # Get business settings (logo, tax number, business name)
        biz_settings = None
        if outlet:
            biz_result = supabase.table('business_settings').select('*').eq('outlet_id', outlet['id']).execute()
            biz_settings = biz_result.data[0] if biz_result.data else None

        # Get cashier info (prefer staff profile identity, fallback to users for legacy rows)
        cashier_name = str(transaction.get('cashier_name') or '').strip() or 'Cashier'
        transaction_staff_profile_id = _extract_cashier_staff_profile_id_from_record(transaction)
        if transaction_staff_profile_id:
            staff_result = supabase.table(Tables.STAFF_PROFILES).select('display_name').eq('id', transaction_staff_profile_id).limit(1).execute()
            if staff_result.data:
                cashier_name = str(staff_result.data[0].get('display_name') or '').strip() or cashier_name
        else:
            cashier_result = supabase.table('users').select('name').eq('id', transaction['cashier_id']).limit(1).execute()
            if cashier_result.data:
                cashier_name = str(cashier_result.data[0].get('name') or '').strip() or cashier_name

        # Determine currency symbol
        currency = (biz_settings or {}).get('currency', (outlet or {}).get('currency', 'NGN'))
        currency_symbol = {'NGN': '₦', 'USD': '$', 'GBP': '£', 'EUR': '€', 'GHS': '₵', 'KES': 'KSh'}.get(currency, currency + ' ')

        # Format amounts with currency
        def fmt(amount):
            return f"{currency_symbol}{amount:,.2f}"

        # Generate receipt content (formatted for thermal printer 58mm / 42 chars)
        W = 42
        receipt_lines = []
        receipt_lines.append("=" * W)

        # Business header
        biz_name = (biz_settings or {}).get('business_name') or (outlet or {}).get('name', 'STORE')
        receipt_lines.append(biz_name.center(W))
        if outlet and outlet.get('address'):
            addr = outlet['address']
            # In some environments, JSONB may come through as a string; normalize to dict
            if isinstance(addr, str):
                try:
                    addr = json.loads(addr) if addr else {}
                except Exception:
                    addr = {}
            if not isinstance(addr, dict):
                addr = {}
            street = addr.get('street', '')
            city = addr.get('city', '')
            state = addr.get('state', '')
            if street:
                receipt_lines.append(street.center(W))
            if city or state:
                receipt_lines.append(f"{city}{', ' + state if state else ''}".center(W))
        if outlet and outlet.get('phone'):
            receipt_lines.append(f"Tel: {outlet['phone']}".center(W))
        if outlet and outlet.get('email'):
            receipt_lines.append(outlet['email'].center(W))
        tax_number = (biz_settings or {}).get('tax_number')
        if tax_number:
            receipt_lines.append(f"TIN: {tax_number}".center(W))

        receipt_lines.append("=" * W)
        receipt_lines.append(f"Receipt: {transaction['transaction_number']}")
        try:
            tx_dt = datetime.fromisoformat(transaction['transaction_date'].replace('Z', '+00:00'))
            receipt_lines.append(f"Date: {tx_dt.strftime('%d/%m/%Y  %I:%M %p')}")
        except (ValueError, KeyError):
            receipt_lines.append(f"Date: {transaction.get('transaction_date', 'N/A')}")
        receipt_lines.append(f"Cashier: {cashier_name}")
        if transaction.get('customer_name'):
            receipt_lines.append(f"Customer: {transaction['customer_name']}")
        receipt_lines.append("-" * W)

        # Column header
        receipt_lines.append(f"{'Item':<20} {'Qty':>4} {'Price':>7} {'Total':>8}")
        receipt_lines.append("-" * W)

        # Items
        for item in transaction.get('pos_transaction_items', []):
            item_name = item['product_name'][:20]
            sale_qty = _safe_int(item.get('sale_quantity'), 0)
            sale_unit_price_raw = item.get('sale_unit_price')
            if sale_qty > 0 and sale_unit_price_raw is not None:
                qty = float(sale_qty)
                price = float(sale_unit_price_raw)
            else:
                qty = float(item.get('quantity') or 0)
                price = float(item.get('unit_price') or 0)
            total = float(item['line_total'])
            # If name is long, put it on its own line
            if len(item['product_name']) > 20:
                receipt_lines.append(item['product_name'][:W])
                receipt_lines.append(f"{'':20} {qty:>4g} {price:>7,.2f} {total:>8,.2f}")
            else:
                receipt_lines.append(f"{item_name:<20} {qty:>4g} {price:>7,.2f} {total:>8,.2f}")

        receipt_lines.append("-" * W)
        receipt_lines.append(f"{'Subtotal:':<22} {fmt(transaction['subtotal']):>18}")
        if float(transaction.get('discount_amount', 0)) > 0:
            receipt_lines.append(f"{'Discount:':<22} {'-' + fmt(transaction['discount_amount']):>18}")
        if float(transaction.get('tax_amount', 0)) > 0:
            receipt_lines.append(f"{'Tax:':<22} {fmt(transaction['tax_amount']):>18}")
        receipt_lines.append("=" * W)
        receipt_lines.append(f"{'TOTAL:':<22} {fmt(transaction['total_amount']):>18}")
        receipt_lines.append("=" * W)

        # Payment details
        receipt_lines.append(f"Payment: {transaction['payment_method'].upper()}")
        if transaction.get('tendered_amount') and float(transaction.get('tendered_amount', 0)) > 0:
            receipt_lines.append(f"{'Tendered:':<22} {fmt(transaction['tendered_amount']):>18}")
            receipt_lines.append(f"{'Change:':<22} {fmt(transaction.get('change_amount', 0)):>18}")

        # Split payment info (stored in notes)
        if transaction.get('notes') and 'split' in str(transaction.get('notes', '')).lower():
            receipt_lines.append(f"({transaction['notes'][:W]})")

        receipt_lines.append("=" * W)
        receipt_lines.append("Thank you for your patronage!".center(W))
        receipt_lines.append(f"Powered by Compazz POS".center(W))
        
        # Mark receipt as printed
        supabase.table('pos_transactions').update({
            'receipt_printed': True,
            'updated_at': datetime.utcnow().isoformat()
        }).eq('id', transaction_id).execute()
        
        # Return receipt data (frontend can handle printing via browser print dialog)
        receipt_content = "\n".join(receipt_lines).rstrip()
        
        return {
            "message": "Receipt generated successfully",
            "transaction_id": transaction_id,
            "receipt_content": receipt_content,
            "copies": copies,
            "format": "thermal_58mm"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error printing receipt: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to print receipt: {str(e)}"
        )


@router.get("/receipts/{transaction_id}/preview")
async def preview_receipt(
    transaction_id: str,
    current_user=Depends(CurrentUser())
):
    """Preview receipt for a transaction"""
    try:
        supabase = get_supabase_admin()
        
        # Get transaction with items
        tx_result = supabase.table('pos_transactions').select('*, pos_transaction_items(*)').eq('id', transaction_id).execute()
        if not tx_result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Transaction not found"
            )
        
        transaction = tx_result.data[0]
        
        # Get outlet info
        outlet_result = supabase.table('outlets').select('*').eq('id', transaction['outlet_id']).execute()
        outlet = outlet_result.data[0] if outlet_result.data else None
        
        # Generate HTML preview
        item_rows_html = []
        for item in transaction.get('pos_transaction_items', []):
            sale_qty = _safe_int(item.get('sale_quantity'), 0)
            sale_unit_price = item.get('sale_unit_price')
            display_qty = sale_qty if sale_qty > 0 else _safe_int(item.get('quantity'), 0)
            display_price = float(sale_unit_price) if sale_qty > 0 and sale_unit_price is not None else float(item.get('unit_price') or 0)
            item_rows_html.append(
                f'<p>{item["product_name"]} - {display_qty} x {display_price:,.2f} = {float(item.get("line_total") or 0):,.2f}</p>'
            )

        receipt_html = f"""
        <div style="font-family: monospace; max-width: 300px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 10px;">
                <h2>{outlet['name'] if outlet else 'STORE'}</h2>
                <p>{outlet['address'].get('street', '') if outlet and outlet.get('address') else ''}</p>
                <p>{outlet['phone'] if outlet else 'N/A'}</p>
            </div>
            <div style="margin-bottom: 10px;">
                <p><strong>Receipt:</strong> {transaction['transaction_number']}</p>
                <p><strong>Date:</strong> {datetime.fromisoformat(transaction['transaction_date'].replace('Z', '+00:00')).strftime('%Y-%m-%d %H:%M:%S')}</p>
            </div>
            <div style="border-top: 1px solid #ccc; border-bottom: 1px solid #ccc; padding: 10px 0; margin: 10px 0;">
                {''.join(item_rows_html)}
            </div>
            <div style="text-align: right; margin-top: 10px;">
                <p>Subtotal: {transaction['subtotal']:,.2f}</p>
                {f'<p>Discount: {transaction["discount_amount"]:,.2f}</p>' if transaction['discount_amount'] > 0 else ''}
                <p>Tax: {transaction['tax_amount']:,.2f}</p>
                <p style="font-size: 1.2em; font-weight: bold; border-top: 2px solid #000; padding-top: 5px; margin-top: 5px;">TOTAL: {transaction['total_amount']:,.2f}</p>
            </div>
        </div>
        """
        
        return {
            "receipt_data": receipt_html,
            "format": "html"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error previewing receipt: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to preview receipt: {str(e)}"
        )


# ===============================================
# CASH DRAWER MANAGEMENT ENDPOINTS
# ===============================================

@router.post("/cash-drawer/sessions", response_model=CashDrawerSessionResponse)
async def open_cash_drawer_session(
    session: CashDrawerSessionCreate,
    current_user=Depends(CurrentUser())
):
    """Open a new cash drawer session"""
    try:
        supabase = get_supabase_admin()
        
        # Check if there's an open session for this terminal
        existing_session = supabase.table(Tables.CASH_DRAWER_SESSIONS)\
            .select('*')\
            .eq('outlet_id', session.outlet_id)\
            .eq('terminal_id', session.terminal_id)\
            .eq('status', 'open')\
            .execute()
        
        if existing_session.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="There is already an open session for this terminal"
            )
        
        # Generate session number
        session_id = str(uuid.uuid4())
        session_number = f"SESSION-{datetime.now().strftime('%Y%m%d')}-{session_id[:8].upper()}"
        actor_user_id = _resolve_actor_user_id(current_user)

        if session.cashier_id and session.cashier_id != actor_user_id:
            logger.warning(
                "Ignoring client cash drawer cashier_id %s in favor of authenticated user %s",
                session.cashier_id,
                actor_user_id
            )

        session_data = {
            'id': session_id,
            'outlet_id': session.outlet_id,
            'terminal_id': session.terminal_id,
            'session_number': session_number,
            'cashier_id': actor_user_id,
            'opening_balance': float(session.opening_balance),
            'opening_notes': session.opening_notes,
            'cash_sales_total': 0.0,
            'cash_refunds_total': 0.0,
            'cash_paid_out': 0.0,
            'cash_paid_in': 0.0,
            'status': 'open',
            'opened_at': datetime.utcnow().isoformat(),
            'created_at': datetime.utcnow().isoformat(),
            'updated_at': datetime.utcnow().isoformat()
        }
        
        result = _insert_cash_drawer_session_compat(supabase, session_data)
        
        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to create cash drawer session"
            )
        
        return CashDrawerSessionResponse(**result.data[0])
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error opening cash drawer session: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to open cash drawer session: {str(e)}"
        )


@router.get("/cash-drawer/sessions/active")
async def get_active_session(
    outlet_id: str,
    terminal_id: str,
    current_user=Depends(CurrentUser())
):
    """Get active cash drawer session for a terminal"""
    try:
        supabase = get_supabase_admin()
        
        result = supabase.table(Tables.CASH_DRAWER_SESSIONS)\
            .select('*')\
            .eq('outlet_id', outlet_id)\
            .eq('terminal_id', terminal_id)\
            .eq('status', 'open')\
            .order('opened_at', desc=True)\
            .limit(1)\
            .execute()
        
        if not result.data:
            return None
        
        return CashDrawerSessionResponse(**result.data[0])
        
    except Exception as e:
        logger.error(f"Error fetching active session: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch active session: {str(e)}"
        )


@router.put("/cash-drawer/sessions/{session_id}/close", response_model=CashDrawerSessionResponse)
async def close_cash_drawer_session(
    session_id: str,
    close_data: CashDrawerSessionClose,
    current_user=Depends(CurrentUser())
):
    """Close a cash drawer session"""
    try:
        supabase = get_supabase_admin()
        
        # Get current session
        session_result = supabase.table(Tables.CASH_DRAWER_SESSIONS)\
            .select('*')\
            .eq('id', session_id)\
            .execute()
        
        if not session_result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found"
            )
        
        session = session_result.data[0]
        
        if session['status'] != 'open':
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Session is not open"
            )
        
        # Calculate expected balance
        opening = Decimal(str(session['opening_balance']))
        cash_sales = Decimal(str(session.get('cash_sales_total', 0)))
        cash_refunds = Decimal(str(session.get('cash_refunds_total', 0)))
        paid_out = Decimal(str(session.get('cash_paid_out', 0)))
        paid_in = Decimal(str(session.get('cash_paid_in', 0)))
        
        expected_balance = opening + cash_sales - cash_refunds - paid_out + paid_in
        actual_balance = Decimal(str(close_data.actual_balance))
        variance = actual_balance - expected_balance
        
        # Update session
        update_data = {
            'actual_balance': float(actual_balance),
            'expected_balance': float(expected_balance),
            'variance': float(variance),
            'closing_notes': close_data.closing_notes,
            'status': 'closed',
            'closed_at': datetime.utcnow().isoformat(),
            'closed_by': current_user['id'],
            'updated_at': datetime.utcnow().isoformat()
        }
        
        result = supabase.table(Tables.CASH_DRAWER_SESSIONS)\
            .update(update_data)\
            .eq('id', session_id)\
            .execute()
        
        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to close session"
            )
        
        return CashDrawerSessionResponse(**result.data[0])
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error closing cash drawer session: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to close cash drawer session: {str(e)}"
        )


# ===============================================
# EOD SALES BREAKDOWN ENDPOINTS
# ===============================================

@router.get("/sales-breakdown")
async def get_sales_breakdown(
    outlet_id: str,
    date_from: str = Query(..., description="Date from (YYYY-MM-DD)"),
    date_to: str = Query(..., description="Date to (YYYY-MM-DD)"),
    cashier_id: Optional[str] = Query(None, description="Filter by specific cashier"),
    current_user=Depends(CurrentUser())
):
    """Get detailed sales breakdown by payment method with cashier filtering for EOD reconciliation"""
    try:
        supabase = get_supabase_admin()
        cashier_filter_value = str(cashier_id or "").strip()

        # Build date filter
        date_filter = f"transaction_date.gte.{date_from}T00:00:00"
        date_filter_end = f"transaction_date.lt.{datetime.fromisoformat(date_to).replace(hour=23, minute=59, second=59).isoformat()}"

        # Build query
        query = supabase.table('pos_transactions')\
            .select('*, pos_transaction_items(*)')\
            .eq('outlet_id', outlet_id)\
            .eq('status', 'completed')\
            .neq('is_voided', True)\
            .gte('transaction_date', f"{date_from}T00:00:00")\
            .lte('transaction_date', f"{date_to}T23:59:59")

        result = query.order('transaction_date', desc=False).execute()

        transactions = result.data or []
        staff_profiles_result = supabase.table(Tables.STAFF_PROFILES)\
            .select('id,display_name')\
            .eq('outlet_id', outlet_id)\
            .execute()
        staff_name_by_id = {
            str(row.get('id') or '').strip(): str(row.get('display_name') or '').strip()
            for row in (staff_profiles_result.data or [])
            if str(row.get('id') or '').strip()
        }
        staff_ids_by_name: Dict[str, List[str]] = {}
        for staff_id, display_name in staff_name_by_id.items():
            normalized_name = display_name.lower()
            if not normalized_name:
                continue
            staff_ids_by_name.setdefault(normalized_name, []).append(staff_id)

        # Initialize breakdown structure
        breakdown = {
            'summary': {
                'total_transactions': 0,
                'total_amount': Decimal('0'),
                'cash_total': Decimal('0'),
                'pos_total': Decimal('0'),
                'transfer_total': Decimal('0'),
                'mobile_total': Decimal('0'),
                'total_tax': Decimal('0'),
                'total_discount': Decimal('0'),
            },
            'by_payment_method': {
                'cash': {'count': 0, 'amount': Decimal('0'), 'transactions': []},
                'pos': {'count': 0, 'amount': Decimal('0'), 'transactions': []},
                'transfer': {'count': 0, 'amount': Decimal('0'), 'transactions': []},
                'mobile': {'count': 0, 'amount': Decimal('0'), 'transactions': []},
            },
            'by_cashier': {},
            'by_hour': {},
            'transactions': []
        }

        # Process each transaction
        for tx in transactions:
            transaction_user_id = str(tx.get('cashier_id') or '').strip()
            transaction_staff_profile_id = _extract_cashier_staff_profile_id_from_record(tx)
            transaction_cashier_name = str(tx.get('cashier_name') or '').strip()

            # Legacy fallback rows may have only cashier_name; promote to staff id when unambiguous.
            if not transaction_staff_profile_id and transaction_cashier_name:
                matching_staff_ids = staff_ids_by_name.get(transaction_cashier_name.lower(), [])
                if len(matching_staff_ids) == 1:
                    transaction_staff_profile_id = matching_staff_ids[0]

            if transaction_staff_profile_id:
                cashier_name = staff_name_by_id.get(transaction_staff_profile_id) or transaction_cashier_name or 'Unknown Cashier'
                cashier_group_key = f"staff:{transaction_staff_profile_id}"
            else:
                cashier_name = transaction_cashier_name or 'Unknown Cashier'
                if transaction_cashier_name:
                    cashier_group_key = f"name:{transaction_cashier_name.lower()}"
                else:
                    cashier_group_key = f"user:{transaction_user_id or 'unknown'}"

            if cashier_filter_value:
                cashier_filter_matches = cashier_filter_value in {
                    cashier_group_key,
                    transaction_user_id,
                    transaction_staff_profile_id or '',
                }
                if not cashier_filter_matches:
                    continue

            amount = Decimal(str(tx['total_amount']))
            payment_method = str(tx.get('payment_method') or 'cash').lower()
            tx_date = datetime.fromisoformat(tx['transaction_date'].replace('Z', '+00:00'))
            hour = tx_date.hour
            split_payments = _extract_split_payments_from_record(tx)
            payment_allocations = _allocate_transaction_amount_by_method(tx)

            breakdown['summary']['total_transactions'] += 1

            # Update summary
            breakdown['summary']['total_amount'] += amount
            breakdown['summary']['total_tax'] += Decimal(str(tx.get('tax_amount', 0)))
            breakdown['summary']['total_discount'] += Decimal(str(tx.get('discount_amount', 0)))

            # Process payment methods (split-aware)
            for method, method_amount in payment_allocations.items():
                if method not in breakdown['by_payment_method']:
                    continue

                breakdown['by_payment_method'][method]['amount'] += method_amount
                breakdown['by_payment_method'][method]['count'] += 1

                if method == 'cash':
                    breakdown['summary']['cash_total'] += method_amount
                elif method == 'pos':
                    breakdown['summary']['pos_total'] += method_amount
                elif method == 'transfer':
                    breakdown['summary']['transfer_total'] += method_amount
                elif method == 'mobile':
                    breakdown['summary']['mobile_total'] += method_amount

            # Group by cashier
            if cashier_group_key not in breakdown['by_cashier']:
                breakdown['by_cashier'][cashier_group_key] = {
                    'id': cashier_group_key,
                    'staff_profile_id': transaction_staff_profile_id,
                    'user_id': transaction_user_id,
                    'name': cashier_name,
                    'transaction_count': 0,
                    'total_amount': Decimal('0'),
                    'cash_amount': Decimal('0'),
                    'pos_amount': Decimal('0'),
                    'transfer_amount': Decimal('0'),
                    'mobile_amount': Decimal('0'),
                    'transactions': []
                }

            cashier_data = breakdown['by_cashier'][cashier_group_key]
            cashier_data['transaction_count'] += 1
            cashier_data['total_amount'] += amount

            # Add to cashier's payment method totals (split-aware)
            for method, method_amount in payment_allocations.items():
                if method == 'cash':
                    cashier_data['cash_amount'] += method_amount
                elif method == 'pos':
                    cashier_data['pos_amount'] += method_amount
                elif method == 'transfer':
                    cashier_data['transfer_amount'] += method_amount
                elif method == 'mobile':
                    cashier_data['mobile_amount'] += method_amount

            # Group by hour
            hour_key = f"{hour:02d}:00"
            if hour_key not in breakdown['by_hour']:
                breakdown['by_hour'][hour_key] = {
                    'transaction_count': 0,
                    'total_amount': Decimal('0')
                }
            breakdown['by_hour'][hour_key]['transaction_count'] += 1
            breakdown['by_hour'][hour_key]['total_amount'] += amount

            # Add transaction to appropriate payment method list
            tx_summary = {
                'id': tx['id'],
                'transaction_number': tx['transaction_number'],
                'amount': float(amount),
                'payment_method': payment_method,
                'split_payments': split_payments if len(split_payments) > 1 else None,
                'cashier_id': transaction_staff_profile_id or transaction_user_id or cashier_group_key,
                'cashier_staff_profile_id': transaction_staff_profile_id,
                'cashier_group_key': cashier_group_key,
                'cashier_name': cashier_name,
                'transaction_date': tx['transaction_date'],
                'items_count': len(tx.get('pos_transaction_items', [])),
                'customer_name': tx.get('customer_name')
            }

            # Add transaction to every payment bucket it contributed to
            for method in payment_allocations.keys():
                if method in breakdown['by_payment_method']:
                    breakdown['by_payment_method'][method]['transactions'].append(tx_summary)

            cashier_data['transactions'].append(tx_summary)
            breakdown['transactions'].append(tx_summary)

        # Convert Decimals to floats for JSON serialization
        def convert_decimals(obj):
            if isinstance(obj, dict):
                return {k: convert_decimals(v) for k, v in obj.items()}
            elif isinstance(obj, list):
                return [convert_decimals(item) for item in obj]
            elif isinstance(obj, Decimal):
                return float(obj)
            return obj

        breakdown = convert_decimals(breakdown)

        return {
            'date_from': date_from,
            'date_to': date_to,
            'outlet_id': outlet_id,
            'cashier_id': cashier_id,
            'breakdown': breakdown
        }

    except Exception as e:
        logger.error(f"Error getting sales breakdown: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get sales breakdown: {str(e)}"
        )


# ===============================================
# CUSTOMER MANAGEMENT ENDPOINTS
# ===============================================


def _normalize_customer_row(row: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize customer row shape for API responses."""
    normalized = dict(row or {})
    now_iso = datetime.utcnow().isoformat()

    address_value = normalized.get('address')
    if isinstance(address_value, str):
        trimmed = address_value.strip()
        if trimmed.startswith('{') and trimmed.endswith('}'):
            try:
                parsed = json.loads(trimmed)
                if isinstance(parsed, dict):
                    normalized['address'] = parsed.get('address') or parsed.get('full_address') or trimmed
            except Exception:
                normalized['address'] = address_value
    elif isinstance(address_value, dict):
        normalized['address'] = address_value.get('address') or address_value.get('full_address')

    normalized['loyalty_points'] = int(normalized.get('loyalty_points') or 0)
    normalized['total_spent'] = float(normalized.get('total_spent') or 0)
    normalized['visit_count'] = int(normalized.get('visit_count') or 0)
    normalized['is_active'] = True if normalized.get('is_active') is None else bool(normalized.get('is_active'))
    normalized['created_at'] = normalized.get('created_at') or now_iso
    normalized['updated_at'] = normalized.get('updated_at') or now_iso
    return normalized


@router.get("/customers")
async def get_customers(
    outlet_id: str,
    skip: int = Query(0, ge=0, description="Rows to skip"),
    limit: int = Query(50, ge=1, le=500, description="Maximum rows to return"),
    active_only: bool = Query(True, description="Filter active customers"),
    search: Optional[str] = Query(None, description="Search by name or phone"),
    current_user=Depends(CurrentUser())
):
    """Get paginated customers for an outlet."""
    try:
        supabase = get_supabase_admin()

        def apply_filters(query_builder):
            query_builder = query_builder.eq('outlet_id', outlet_id)
            if active_only:
                query_builder = query_builder.eq('is_active', True)
            if search and search.strip():
                term = search.strip().replace(',', ' ')
                query_builder = query_builder.or_(
                    f"name.ilike.%{term}%,phone.ilike.%{term}%"
                )
            return query_builder

        total_result = apply_filters(supabase.table('customers').select('id')).execute()
        total = len(total_result.data) if total_result.data else 0

        end_index = skip + limit - 1
        rows_result = apply_filters(supabase.table('customers').select('*'))\
            .order('created_at', desc=True)\
            .range(skip, end_index)\
            .execute()

        items = [_normalize_customer_row(row) for row in (rows_result.data or [])]
        page = (skip // limit) + 1
        return {
            'items': items,
            'total': total,
            'page': page,
            'size': limit
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching customers: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch customers: {str(e)}"
        )

@router.get("/customers/search")
async def search_customers(
    outlet_id: str,
    query: str = Query(..., min_length=1, description="Search by name or phone"),
    limit: int = Query(10, ge=1, le=50, description="Maximum results"),
    current_user=Depends(CurrentUser())
):
    """Search customers by name or phone number"""
    try:
        supabase = get_supabase_admin()
        
        # Search in customers table
        result = supabase.table('customers')\
            .select('*')\
            .eq('outlet_id', outlet_id)\
            .or_(f"name.ilike.%{query}%,phone.ilike.%{query}%")\
            .limit(limit)\
            .execute()
        
        return result.data or []
        
    except Exception as e:
        logger.error(f"Error searching customers: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to search customers: {str(e)}"
        )


@router.get("/customers/{customer_id}")
async def get_customer(
    customer_id: str,
    current_user=Depends(CurrentUser())
):
    """Get a customer by ID."""
    try:
        supabase = get_supabase_admin()
        result = supabase.table('customers').select('*').eq('id', customer_id).execute()

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Customer not found"
            )

        return _normalize_customer_row(result.data[0])
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching customer {customer_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch customer: {str(e)}"
        )


@router.post("/customers")
async def create_customer(
    customer: Optional[Dict[str, Any]] = Body(None),
    outlet_id: Optional[str] = Query(None, description="Outlet ID (legacy mode)"),
    name: Optional[str] = Query(None, description="Customer name (legacy mode)"),
    phone: Optional[str] = Query(None, description="Customer phone (legacy mode)"),
    email: Optional[str] = Query(None, description="Customer email (legacy mode)"),
    address: Optional[str] = Query(None, description="Customer address (legacy mode)"),
    current_user=Depends(CurrentUser())
):
    """Create a new customer (JSON body preferred; query params kept for backward compatibility)."""
    try:
        supabase = get_supabase_admin()

        if customer:
            payload = dict(customer)
        else:
            if not outlet_id or not name or not phone:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Provide customer payload in request body or outlet_id/name/phone query params."
                )
            payload = {
                'outlet_id': outlet_id,
                'name': name,
                'phone': phone,
                'email': email,
                'address': address
            }

        payload['outlet_id'] = str(payload.get('outlet_id') or '').strip()
        payload['name'] = str(payload.get('name') or '').strip()
        payload['phone'] = str(payload.get('phone') or '').strip()
        if not payload['outlet_id'] or not payload['name'] or not payload['phone']:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="outlet_id, name and phone are required"
            )

        # Check if customer with phone already exists
        existing = supabase.table('customers')\
            .select('id')\
            .eq('outlet_id', payload['outlet_id'])\
            .eq('phone', payload['phone'])\
            .execute()

        if existing.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Customer with this phone number already exists"
            )

        customer_data = {
            'id': str(uuid.uuid4()),
            'outlet_id': payload['outlet_id'],
            'name': payload['name'],
            'phone': payload['phone'],
            'email': payload.get('email'),
            'address': payload.get('address'),
            'customer_type': 'regular',
            'loyalty_points': 0,
            'total_spent': 0.0,
            'visit_count': 0,
            'is_active': True,
            'created_at': datetime.utcnow().isoformat(),
            'updated_at': datetime.utcnow().isoformat()
        }

        result = supabase.table('customers').insert(customer_data).execute()

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to create customer"
            )

        return _normalize_customer_row(result.data[0])

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating customer: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create customer: {str(e)}"
        )


# ===============================================
# PHARMACY PATIENT RECORDS ENDPOINTS
# ===============================================

def _normalize_patient_row(row: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize patient profile row shape for API responses."""
    normalized = dict(row or {})
    now_iso = datetime.utcnow().isoformat()
    normalized['full_name'] = str(normalized.get('full_name') or '').strip()
    normalized['patient_code'] = str(normalized.get('patient_code') or '').strip() or f"PT-{str(normalized.get('id') or '')[:8].upper()}"
    normalized['gender'] = normalized.get('gender') or 'unspecified'
    normalized['is_active'] = True if normalized.get('is_active') is None else bool(normalized.get('is_active'))
    normalized['created_at'] = normalized.get('created_at') or now_iso
    normalized['updated_at'] = normalized.get('updated_at') or now_iso
    return normalized


def _normalize_patient_vital_row(row: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize patient vital row shape for API responses."""
    normalized = dict(row or {})
    now_iso = datetime.utcnow().isoformat()
    normalized['recorded_at'] = normalized.get('recorded_at') or normalized.get('created_at') or now_iso
    normalized['created_at'] = normalized.get('created_at') or normalized['recorded_at']
    normalized['updated_at'] = normalized.get('updated_at') or normalized['created_at']
    return normalized


@router.get("/patients", response_model=PatientProfileListResponse)
async def get_pharmacy_patients(
    outlet_id: str,
    page: int = Query(1, ge=1, description="Page number"),
    size: int = Query(50, ge=1, le=200, description="Page size"),
    search: Optional[str] = Query(None, description="Search patient name, code, or phone"),
    active_only: bool = Query(True, description="Filter to active patients only"),
    x_pos_staff_session: Optional[str] = Header(None, alias="X-POS-Staff-Session"),
    current_user=Depends(CurrentUser())
):
    """List pharmacy patient profiles for an outlet (pharmacist-only)."""
    try:
        supabase = get_supabase_admin()
        _require_pharmacist_role(supabase, current_user, outlet_id, x_pos_staff_session)

        offset = (page - 1) * size
        query = supabase.table(Tables.POS_PATIENT_PROFILES).select('*', count='exact').eq('outlet_id', outlet_id)
        if active_only:
            query = query.eq('is_active', True)
        if search and search.strip():
            term = search.strip()
            query = query.or_(
                f"full_name.ilike.%{term}%,"
                f"patient_code.ilike.%{term}%,"
                f"phone.ilike.%{term}%"
            )

        result = query.range(offset, offset + size - 1).order('full_name').execute()
        total = int(getattr(result, 'count', 0) or len(result.data or []))
        items = [PatientProfileResponse(**_normalize_patient_row(row)) for row in (result.data or [])]
        return PatientProfileListResponse(items=items, total=total, page=page, size=size)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching pharmacy patients: {e}")
        if _is_missing_table_error(e, Tables.POS_PATIENT_PROFILES):
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Pharmacy patient records are not available yet. Run the latest POS migration and retry."
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch pharmacy patients: {str(e)}"
        )


@router.post("/patients", response_model=PatientProfileResponse)
async def create_pharmacy_patient(
    patient: PatientProfileCreate,
    x_pos_staff_session: Optional[str] = Header(None, alias="X-POS-Staff-Session"),
    current_user=Depends(CurrentUser())
):
    """Create a pharmacy patient profile (pharmacist-only)."""
    try:
        supabase = get_supabase_admin()
        _require_pharmacist_role(supabase, current_user, patient.outlet_id, x_pos_staff_session)
        actor_id = _resolve_actor_user_id(current_user)
        now_iso = datetime.utcnow().isoformat()

        patient_id = str(uuid.uuid4())
        patient_code = f"PT-{patient_id[:8].upper()}"
        payload = {
            'id': patient_id,
            'patient_code': patient_code,
            **patient.model_dump(mode='json', exclude_none=True, exclude_unset=True),
            'full_name': str(patient.full_name).strip(),
            'created_by': actor_id,
            'created_at': now_iso,
            'updated_at': now_iso
        }

        result = supabase.table(Tables.POS_PATIENT_PROFILES).insert(payload).execute()
        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to create patient profile"
            )

        return PatientProfileResponse(**_normalize_patient_row(result.data[0]))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating pharmacy patient: {e}")
        if _is_missing_table_error(e, Tables.POS_PATIENT_PROFILES):
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Pharmacy patient records are not available yet. Run the latest POS migration and retry."
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create pharmacy patient: {str(e)}"
        )


@router.get("/patients/{patient_id}", response_model=PatientProfileResponse)
async def get_pharmacy_patient(
    patient_id: str,
    x_pos_staff_session: Optional[str] = Header(None, alias="X-POS-Staff-Session"),
    current_user=Depends(CurrentUser())
):
    """Get one pharmacy patient profile (pharmacist-only)."""
    try:
        supabase = get_supabase_admin()
        result = supabase.table(Tables.POS_PATIENT_PROFILES).select('*').eq('id', patient_id).limit(1).execute()
        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Patient profile not found"
            )

        row = result.data[0]
        _require_pharmacist_role(supabase, current_user, row.get('outlet_id'), x_pos_staff_session)
        return PatientProfileResponse(**_normalize_patient_row(row))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching pharmacy patient {patient_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch pharmacy patient: {str(e)}"
        )


@router.put("/patients/{patient_id}", response_model=PatientProfileResponse)
async def update_pharmacy_patient(
    patient_id: str,
    patient: PatientProfileUpdate,
    x_pos_staff_session: Optional[str] = Header(None, alias="X-POS-Staff-Session"),
    current_user=Depends(CurrentUser())
):
    """Update a pharmacy patient profile (pharmacist-only)."""
    try:
        supabase = get_supabase_admin()
        existing = supabase.table(Tables.POS_PATIENT_PROFILES).select('id,outlet_id').eq('id', patient_id).limit(1).execute()
        if not existing.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Patient profile not found"
            )

        outlet_id = existing.data[0].get('outlet_id')
        _require_pharmacist_role(supabase, current_user, outlet_id, x_pos_staff_session)

        update_data = patient.model_dump(mode='json', exclude_none=True, exclude_unset=True)
        if 'full_name' in update_data:
            update_data['full_name'] = str(update_data.get('full_name') or '').strip()
        update_data['updated_at'] = datetime.utcnow().isoformat()

        result = supabase.table(Tables.POS_PATIENT_PROFILES).update(update_data).eq('id', patient_id).execute()
        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to update patient profile"
            )

        return PatientProfileResponse(**_normalize_patient_row(result.data[0]))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating pharmacy patient {patient_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update pharmacy patient: {str(e)}"
        )


@router.get("/patients/{patient_id}/vitals", response_model=PatientVitalListResponse)
async def get_patient_vitals(
    patient_id: str,
    page: int = Query(1, ge=1, description="Page number"),
    size: int = Query(50, ge=1, le=200, description="Page size"),
    x_pos_staff_session: Optional[str] = Header(None, alias="X-POS-Staff-Session"),
    current_user=Depends(CurrentUser())
):
    """List vitals history for a patient (pharmacist-only)."""
    try:
        supabase = get_supabase_admin()
        patient_result = supabase.table(Tables.POS_PATIENT_PROFILES).select('id,outlet_id').eq('id', patient_id).limit(1).execute()
        if not patient_result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Patient profile not found"
            )

        outlet_id = patient_result.data[0].get('outlet_id')
        _require_pharmacist_role(supabase, current_user, outlet_id, x_pos_staff_session)

        offset = (page - 1) * size
        result = supabase.table(Tables.POS_PATIENT_VITALS)\
            .select('*', count='exact')\
            .eq('patient_id', patient_id)\
            .eq('outlet_id', outlet_id)\
            .range(offset, offset + size - 1)\
            .order('recorded_at', desc=True)\
            .execute()

        total = int(getattr(result, 'count', 0) or len(result.data or []))
        items = [PatientVitalResponse(**_normalize_patient_vital_row(row)) for row in (result.data or [])]
        return PatientVitalListResponse(items=items, total=total, page=page, size=size)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching patient vitals for {patient_id}: {e}")
        if _is_missing_table_error(e, Tables.POS_PATIENT_VITALS):
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Patient vitals records are not available yet. Run the latest POS migration and retry."
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch patient vitals: {str(e)}"
        )


@router.post("/patients/{patient_id}/vitals", response_model=PatientVitalResponse)
async def create_patient_vital(
    patient_id: str,
    vital: PatientVitalCreate,
    x_pos_staff_session: Optional[str] = Header(None, alias="X-POS-Staff-Session"),
    current_user=Depends(CurrentUser())
):
    """Record patient vitals (pharmacist-only)."""
    try:
        supabase = get_supabase_admin()
        patient_result = supabase.table(Tables.POS_PATIENT_PROFILES).select('id,outlet_id').eq('id', patient_id).limit(1).execute()
        if not patient_result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Patient profile not found"
            )

        outlet_id = patient_result.data[0].get('outlet_id')
        _require_pharmacist_role(supabase, current_user, outlet_id, x_pos_staff_session)
        actor_id = _resolve_actor_user_id(current_user)
        now_iso = datetime.utcnow().isoformat()

        payload = {
            'id': str(uuid.uuid4()),
            'patient_id': patient_id,
            'outlet_id': outlet_id,
            **vital.model_dump(mode='json', exclude_none=True, exclude_unset=True),
            'recorded_by': actor_id,
            'recorded_at': (vital.recorded_at.isoformat() if vital.recorded_at else now_iso),
            'created_at': now_iso,
            'updated_at': now_iso
        }

        result = supabase.table(Tables.POS_PATIENT_VITALS).insert(payload).execute()
        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to record patient vitals"
            )

        supabase.table(Tables.POS_PATIENT_PROFILES).update({
            'last_visit_at': payload['recorded_at'],
            'updated_at': now_iso
        }).eq('id', patient_id).execute()

        return PatientVitalResponse(**_normalize_patient_vital_row(result.data[0]))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error recording patient vitals for {patient_id}: {e}")
        if _is_missing_table_error(e, Tables.POS_PATIENT_VITALS):
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Patient vitals records are not available yet. Run the latest POS migration and retry."
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to record patient vitals: {str(e)}"
        )


# ===============================================
# STAFF PROFILE MANAGEMENT ENDPOINTS
# ===============================================

@router.post("/staff", response_model=StaffProfileResponse)
async def create_staff_profile(
    staff_data: StaffProfileCreate,
    current_user=Depends(CurrentUser())
):
    """Create a new staff profile with PIN authentication"""
    try:
        # Only business owners and outlet admins can create staff profiles
        if current_user.get("role") not in ["business_owner", "outlet_admin", "super_admin"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only business owners and outlet admins can create staff profiles"
            )

        staff_profile = await StaffService.create_staff_profile(
            parent_account_id=current_user["id"],
            staff_data=staff_data
        )

        return staff_profile

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating staff profile: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create staff profile: {str(e)}"
        )


@router.get("/staff", response_model=StaffProfileListResponse)
async def get_staff_profiles(
    outlet_id: Optional[str] = Query(None, description="Filter by outlet"),
    active_only: bool = Query(True, description="Show only active staff"),
    current_user=Depends(CurrentUser())
):
    """Get staff profiles for the current user's account"""
    try:
        profiles = await StaffService.get_staff_profiles(
            parent_account_id=current_user["id"],
            outlet_id=outlet_id,
            active_only=active_only
        )

        return StaffProfileListResponse(
            profiles=profiles,
            total=len(profiles)
        )

    except Exception as e:
        logger.error(f"Error fetching staff profiles: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch staff profiles: {str(e)}"
        )


@router.get("/staff/{profile_id}", response_model=StaffProfileResponse)
async def get_staff_profile(
    profile_id: str,
    current_user=Depends(CurrentUser())
):
    """Get a specific staff profile"""
    try:
        profile = await StaffService.get_staff_profile(profile_id)

        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Staff profile not found"
            )

        # Ensure the profile belongs to the current user or they're a super admin
        if (profile.parent_account_id != current_user["id"] and
            current_user.get("role") != "super_admin"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this staff profile"
            )

        return profile

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching staff profile: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch staff profile: {str(e)}"
        )


@router.put("/staff/{profile_id}", response_model=StaffProfileResponse)
async def update_staff_profile(
    profile_id: str,
    update_data: StaffProfileUpdate,
    current_user=Depends(CurrentUser())
):
    """Update a staff profile"""
    try:
        # Check if profile exists and belongs to current user
        profile = await StaffService.get_staff_profile(profile_id)

        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Staff profile not found"
            )

        if (profile.parent_account_id != current_user["id"] and
            current_user.get("role") != "super_admin"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this staff profile"
            )

        updated_profile = await StaffService.update_staff_profile(profile_id, update_data)

        if not updated_profile:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to update staff profile"
            )

        return updated_profile

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating staff profile: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update staff profile: {str(e)}"
        )


@router.delete("/staff/{profile_id}")
async def delete_staff_profile(
    profile_id: str,
    current_user=Depends(CurrentUser())
):
    """Delete (deactivate) a staff profile"""
    try:
        # Check if profile exists and belongs to current user
        profile = await StaffService.get_staff_profile(profile_id)

        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Staff profile not found"
            )

        if (profile.parent_account_id != current_user["id"] and
            current_user.get("role") != "super_admin"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this staff profile"
            )

        success = await StaffService.delete_staff_profile(profile_id)

        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to delete staff profile"
            )

        return {"message": "Staff profile deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting staff profile: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete staff profile: {str(e)}"
        )


@router.post("/staff/reset-attempts/{profile_id}")
async def reset_failed_attempts(
    profile_id: str,
    current_user=Depends(CurrentUser())
):
    """Reset failed login attempts for a staff profile"""
    try:
        # Check if profile exists and belongs to current user
        profile = await StaffService.get_staff_profile(profile_id)

        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Staff profile not found"
            )

        if (profile.parent_account_id != current_user["id"] and
            current_user.get("role") != "super_admin"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this staff profile"
            )

        success = await StaffService.reset_failed_attempts(profile_id)

        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to reset failed attempts"
            )

        return {"message": "Failed login attempts reset successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error resetting failed attempts: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to reset failed attempts: {str(e)}"
        )


# ===============================================
# PIN AUTHENTICATION ENDPOINTS
# ===============================================

@router.post("/auth/pin", response_model=StaffAuthResponse)
async def authenticate_with_pin(auth_data: StaffPinAuth):
    """Authenticate staff member with PIN"""
    try:
        auth_result = await StaffService.authenticate_staff(
            auth_data.staff_code,
            auth_data.pin,
            auth_data.outlet_id
        )

        if not auth_result:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid staff code or PIN, or account is locked"
            )

        return StaffAuthResponse(
            staff_profile=StaffProfileResponse(**auth_result['profile']),
            session_token=auth_result['session_token'],
            expires_at=auth_result['expires_at']
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error authenticating with PIN: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication failed"
        )


# ===============================================
# RECEIPT SETTINGS ENDPOINTS
# ===============================================

def _normalize_receipt_settings_row(row: Dict[str, Any], outlet_id: str) -> Dict[str, Any]:
    """
    Ensure receipt settings row has all required fields for ReceiptSettingsResponse.
    This prevents 500s if the DB row is missing columns or contains NULLs.
    """
    now = datetime.utcnow().isoformat()
    # Use existing timestamps if present; otherwise default.
    created_at = row.get('created_at') or now
    updated_at = row.get('updated_at') or now

    return {
        'id': row.get('id') or str(uuid.uuid4()),
        'outlet_id': row.get('outlet_id') or outlet_id,
        'header_text': row.get('header_text'),
        'footer_text': row.get('footer_text'),
        'logo_url': row.get('logo_url'),
        'show_qr_code': True if row.get('show_qr_code') is None else row.get('show_qr_code'),
        'show_customer_points': True if row.get('show_customer_points') is None else row.get('show_customer_points'),
        'show_tax_breakdown': True if row.get('show_tax_breakdown') is None else row.get('show_tax_breakdown'),
        'receipt_width': row.get('receipt_width') or 58,
        'font_size': row.get('font_size') or 'normal',
        'created_at': created_at,
        'updated_at': updated_at,
    }

@router.get("/receipt-settings/{outlet_id}", response_model=ReceiptSettingsResponse)
async def get_receipt_settings(
    outlet_id: str,
    current_user=Depends(CurrentUser())
):
    """Get receipt customization settings for outlet"""
    try:
        supabase = get_supabase_admin()
        
        # Try to get existing settings
        result = supabase.table(Tables.RECEIPT_SETTINGS)\
            .select('*')\
            .eq('outlet_id', outlet_id)\
            .execute()
        
        if result.data and len(result.data) > 0:
            settings_data = _normalize_receipt_settings_row(result.data[0], outlet_id)
            return ReceiptSettingsResponse(**settings_data)
        
        # Return default settings if none exist
        default_settings = _normalize_receipt_settings_row({}, outlet_id)
        return ReceiptSettingsResponse(**default_settings)
        
    except Exception as e:
        logger.error(f"Error fetching receipt settings: {e}")
        # Helpful hint if the table isn't deployed yet
        if "receipt_settings" in str(e) and ("does not exist" in str(e) or "42P01" in str(e)):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="receipt_settings table is missing in the database. Create it in Supabase, then retry."
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch receipt settings: {str(e)}"
        )

@router.put("/receipt-settings/{outlet_id}", response_model=ReceiptSettingsResponse)
async def update_receipt_settings(
    outlet_id: str,
    settings_update: ReceiptSettingsUpdate,
    x_pos_staff_session: Optional[str] = Header(None, alias="X-POS-Staff-Session"),
    current_user=Depends(CurrentUser())
):
    """Update receipt customization settings for outlet"""
    try:
        supabase = get_supabase_admin()
        _require_manager_role(supabase, current_user, outlet_id, x_pos_staff_session)
        
        # Check if settings exist
        existing = supabase.table(Tables.RECEIPT_SETTINGS)\
            .select('id')\
            .eq('outlet_id', outlet_id)\
            .execute()
        
        update_data = {
            'outlet_id': outlet_id,
            'updated_at': datetime.utcnow().isoformat()
        }
        
        # Only include fields that are provided (not None)
        if settings_update.header_text is not None:
            update_data['header_text'] = settings_update.header_text
        if settings_update.footer_text is not None:
            update_data['footer_text'] = settings_update.footer_text
        if settings_update.logo_url is not None:
            update_data['logo_url'] = settings_update.logo_url
        if settings_update.show_qr_code is not None:
            update_data['show_qr_code'] = settings_update.show_qr_code
        if settings_update.show_customer_points is not None:
            update_data['show_customer_points'] = settings_update.show_customer_points
        if settings_update.show_tax_breakdown is not None:
            update_data['show_tax_breakdown'] = settings_update.show_tax_breakdown
        if settings_update.receipt_width is not None:
            update_data['receipt_width'] = settings_update.receipt_width
        if settings_update.font_size is not None:
            update_data['font_size'] = settings_update.font_size
        
        if existing.data and len(existing.data) > 0:
            # Update existing
            result = supabase.table(Tables.RECEIPT_SETTINGS)\
                .update(update_data)\
                .eq('outlet_id', outlet_id)\
                .execute()
        else:
            # Create new
            update_data['id'] = str(uuid.uuid4())
            update_data['created_at'] = datetime.utcnow().isoformat()
            # Set defaults for fields not provided
            if 'show_qr_code' not in update_data:
                update_data['show_qr_code'] = True
            if 'show_customer_points' not in update_data:
                update_data['show_customer_points'] = True
            if 'show_tax_breakdown' not in update_data:
                update_data['show_tax_breakdown'] = True
            if 'receipt_width' not in update_data:
                update_data['receipt_width'] = 58
            if 'font_size' not in update_data:
                update_data['font_size'] = 'normal'
            
            result = supabase.table(Tables.RECEIPT_SETTINGS)\
                .insert(update_data)\
                .execute()
        
        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to save receipt settings"
            )
        
        saved = _normalize_receipt_settings_row(result.data[0], outlet_id)
        return ReceiptSettingsResponse(**saved)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating receipt settings: {e}")
        if "receipt_settings" in str(e) and ("does not exist" in str(e) or "42P01" in str(e)):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="receipt_settings table is missing in the database. Create it in Supabase, then retry."
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update receipt settings: {str(e)}"
        )


# ===============================================
# OUTLET BUSINESS INFO ENDPOINTS (for Settings sync)
# ===============================================

@router.get("/outlets/{outlet_id}")
async def get_outlet_info(
    outlet_id: str,
    current_user=Depends(CurrentUser())
):
    """Get outlet business information (name, address, phone, etc.)"""
    try:
        supabase = get_supabase_admin()
        
        result = supabase.table(Tables.OUTLETS)\
            .select('*')\
            .eq('id', outlet_id)\
            .execute()
        
        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Outlet not found"
            )
        
        return result.data[0]
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching outlet info: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch outlet info: {str(e)}"
        )

@router.put("/outlets/{outlet_id}")
async def update_outlet_info(
    outlet_id: str,
    outlet_data: Dict[str, Any],
    x_pos_staff_session: Optional[str] = Header(None, alias="X-POS-Staff-Session"),
    current_user=Depends(CurrentUser())
):
    """Update outlet business information (address, phone, email, website, etc.)"""
    try:
        supabase = get_supabase_admin()
        _require_manager_role(supabase, current_user, outlet_id, x_pos_staff_session)
        
        # Only allow updating specific fields for business info
        allowed_fields = ['name', 'phone', 'email', 'website', 'address']
        update_data = {
            'updated_at': datetime.utcnow().isoformat()
        }
        
        for field in allowed_fields:
            if field in outlet_data:
                update_data[field] = outlet_data[field]
        
        result = supabase.table(Tables.OUTLETS)\
            .update(update_data)\
            .eq('id', outlet_id)\
            .execute()
        
        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Outlet not found"
            )
        
        return result.data[0]
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating outlet info: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update outlet info: {str(e)}"
        )


@router.get("/staff/outlet/{outlet_id}", response_model=StaffProfileListResponse)
async def get_outlet_staff(outlet_id: str):
    """Get all active staff for an outlet (public endpoint for POS systems)"""
    try:
        profiles = await StaffService.get_staff_by_outlet(outlet_id)

        return StaffProfileListResponse(
            profiles=profiles,
            total=len(profiles)
        )

    except Exception as e:
        logger.error(f"Error fetching outlet staff: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch outlet staff: {str(e)}"
        )
