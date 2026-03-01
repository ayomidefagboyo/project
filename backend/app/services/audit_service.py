"""
Shared audit helpers for consistent actor attribution and rollout-safe inserts.
"""

from __future__ import annotations

from datetime import datetime
import re
import uuid
from typing import Any, Dict, Optional

from app.core.database import Tables

_AUDIT_OPTIONAL_COLUMNS = {"staff_profile_id", "actor_type", "actor_role", "auth_source"}


def _extract_missing_column_name(exc: Exception) -> Optional[str]:
    message = str(exc or "")
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


def _is_audit_user_fk_error(exc: Exception) -> bool:
    message = str(exc or "")
    lowered = message.lower()
    return (
        "audit_entries_user_id_fkey" in lowered
        or ("key (user_id)=" in lowered and 'is not present in table "users"' in lowered)
    )


def _is_audit_staff_profile_fk_error(exc: Exception) -> bool:
    message = str(exc or "")
    lowered = message.lower()
    return (
        "audit_entries_staff_profile_id_fkey" in lowered
        or ("key (staff_profile_id)=" in lowered and 'is not present in table "staff_profiles"' in lowered)
    )


def build_audit_actor(user: Optional[Dict[str, Any]], fallback_name: str = "Unknown") -> Dict[str, Optional[str]]:
    source_user = user or {}
    user_id = str(
        source_user.get("user_id")
        or source_user.get("id")
        or ""
    ).strip() or None
    user_name = str(
        source_user.get("user_name")
        or source_user.get("staff_profile_name")
        or source_user.get("name")
        or source_user.get("email")
        or fallback_name
    ).strip() or fallback_name
    staff_profile_id = str(source_user.get("staff_profile_id") or "").strip() or None
    actor_role = str(
        source_user.get("actor_role")
        or source_user.get("staff_role")
        or source_user.get("role")
        or ""
    ).strip() or None
    declared_actor_type = str(source_user.get("actor_type") or "").strip() or None
    auth_source = str(source_user.get("auth_source") or "").strip() or None

    if declared_actor_type:
        actor_type = declared_actor_type
    elif staff_profile_id:
        actor_type = "staff_profile"
    elif user_id:
        actor_type = "user"
    else:
        actor_type = "system"

    if not auth_source:
        auth_source = "staff_session" if staff_profile_id else ("api_user" if user_id else "system")

    return {
        "user_id": user_id,
        "user_name": user_name,
        "staff_profile_id": staff_profile_id,
        "actor_type": actor_type,
        "actor_role": actor_role,
        "auth_source": auth_source,
    }


def insert_audit_entry(
    supabase,
    *,
    outlet_id: str,
    action: str,
    entity_type: str,
    entity_id: str,
    details: str,
    user_id: Optional[str] = None,
    user_name: Optional[str] = None,
    staff_profile_id: Optional[str] = None,
    actor_type: Optional[str] = None,
    actor_role: Optional[str] = None,
    auth_source: Optional[str] = None,
) -> None:
    payload: Dict[str, Any] = {
        "id": str(uuid.uuid4()),
        "outlet_id": str(outlet_id or "").strip(),
        "user_id": str(user_id or "").strip() or None,
        "user_name": str(user_name or "").strip() or "Unknown",
        "action": str(action or "").strip(),
        "entity_type": str(entity_type or "").strip(),
        "entity_id": str(entity_id or "").strip(),
        "details": str(details or "").strip(),
        "timestamp": datetime.utcnow().isoformat(),
        "staff_profile_id": str(staff_profile_id or "").strip() or None,
        "actor_type": str(actor_type or "").strip() or None,
        "actor_role": str(actor_role or "").strip() or None,
        "auth_source": str(auth_source or "").strip() or None,
    }

    if not payload["actor_type"]:
        payload["actor_type"] = (
            "staff_profile" if payload.get("staff_profile_id")
            else ("user" if payload.get("user_id") else "system")
        )

    for _ in range(8):
        try:
            supabase.table(Tables.AUDIT_ENTRIES).insert(payload).execute()
            return
        except Exception as audit_error:
            missing_column = _extract_missing_column_name(audit_error)
            if missing_column and missing_column in _AUDIT_OPTIONAL_COLUMNS and missing_column in payload:
                payload.pop(missing_column, None)
                continue

            if payload.get("user_id") and _is_audit_user_fk_error(audit_error):
                payload["user_id"] = None
                if "actor_type" in payload:
                    payload["actor_type"] = "staff_profile" if payload.get("staff_profile_id") else "system"
                continue

            if payload.get("staff_profile_id") and _is_audit_staff_profile_fk_error(audit_error):
                payload["staff_profile_id"] = None
                if "actor_type" in payload:
                    payload["actor_type"] = "user" if payload.get("user_id") else "system"
                continue

            raise
