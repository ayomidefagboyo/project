"""
Anomaly detection service for handling business intelligence and risk analysis
"""

from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from fastapi import HTTPException, status
from app.core.database import get_supabase_admin, Tables
from app.schemas.anomaly import (
    AnomalyCreate, AnomalyUpdate, AnomalyResponse,
    AnomalyStatsResponse, AnomalyDetectionRequest, AnomalyDetectionResult,
    AnomalyResolutionRequest, AnomalyResolutionResponse, AnomalySearchRequest,
    AnomalyTrendResponse, AnomalyType, AnomalySeverity
)
import logging
import math
import json
from uuid import uuid4

logger = logging.getLogger(__name__)


class AnomalyService:
    """Anomaly detection service class"""

    def __init__(self):
        self._supabase = None

    @property
    def supabase(self):
        if self._supabase is None:
            self._supabase = get_supabase_admin()
        return self._supabase

    async def create_anomaly(self, anomaly_data: AnomalyCreate, outlet_id: str) -> AnomalyResponse:
        """Create a new anomaly record"""
        try:
            anomaly_dict = anomaly_data.dict()
            anomaly_dict.update({
                "outlet_id": outlet_id,
                "detected_at": datetime.now().isoformat()
            })

            response = self.supabase.table(Tables.ANOMALIES).insert(anomaly_dict).execute()

            if not response.data:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Failed to create anomaly"
                )

            anomaly = response.data[0]
            return AnomalyResponse(**anomaly)

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error creating anomaly: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create anomaly"
            )

    async def get_anomalies(
        self,
        outlet_id: str,
        page: int = 1,
        size: int = 20,
        anomaly_type: Optional[str] = None,
        severity: Optional[str] = None,
        resolved: Optional[bool] = None
    ) -> Dict[str, Any]:
        """Get anomalies with pagination and filtering"""
        try:
            query = self.supabase.table(Tables.ANOMALIES).select("*", count="exact")
            query = query.eq("outlet_id", outlet_id)

            if anomaly_type:
                query = query.eq("type", anomaly_type)
            if severity:
                query = query.eq("severity", severity)
            if resolved is not None:
                query = query.eq("resolved", resolved)

            offset = (page - 1) * size
            query = query.range(offset, offset + size - 1)
            query = query.order("detected_at", desc=True)

            response = query.execute()

            anomalies = [AnomalyResponse(**anomaly) for anomaly in (response.data or [])]
            total = response.count or 0
            pages = (total + size - 1) // size

            return {
                "items": anomalies,
                "total": total,
                "page": page,
                "size": size,
                "pages": pages
            }

        except Exception as e:
            logger.error(f"Error getting anomalies: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to get anomalies"
            )

    async def get_anomaly(self, anomaly_id: str, outlet_id: str) -> AnomalyResponse:
        """Get a specific anomaly"""
        try:
            response = self.supabase.table(Tables.ANOMALIES).select("*").eq("id", anomaly_id).eq("outlet_id", outlet_id).execute()

            if not response.data:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Anomaly not found"
                )

            anomaly = response.data[0]
            return AnomalyResponse(**anomaly)

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error getting anomaly: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to get anomaly"
            )

    async def update_anomaly(self, anomaly_id: str, anomaly_data: AnomalyUpdate, outlet_id: str) -> AnomalyResponse:
        """Update an anomaly"""
        try:
            existing = await self.get_anomaly(anomaly_id, outlet_id)
            update_dict = {k: v for k, v in anomaly_data.dict().items() if v is not None}

            if not update_dict:
                return existing

            response = self.supabase.table(Tables.ANOMALIES).update(update_dict).eq("id", anomaly_id).eq("outlet_id", outlet_id).execute()

            if not response.data:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Failed to update anomaly"
                )

            anomaly = response.data[0]
            return AnomalyResponse(**anomaly)

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error updating anomaly: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update anomaly"
            )

    async def delete_anomaly(self, anomaly_id: str, outlet_id: str) -> bool:
        """Delete an anomaly"""
        try:
            await self.get_anomaly(anomaly_id, outlet_id)
            self.supabase.table(Tables.ANOMALIES).delete().eq("id", anomaly_id).eq("outlet_id", outlet_id).execute()
            return True

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error deleting anomaly: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to delete anomaly"
            )

    async def detect_anomalies(self, detection_request: AnomalyDetectionRequest, outlet_id: str) -> AnomalyDetectionResult:
        """Detect anomalies for a specific entity using deterministic risk rules."""
        try:
            anomalies: List[AnomalyResponse] = []
            risk_score = 0.0
            recommendations: List[str] = []

            entity_type = (detection_request.entity_type or "").strip().lower()
            entity_id = detection_request.entity_id

            if entity_type in {"payment", "payments"}:
                result = await self._analyze_payment_anomalies(outlet_id, entity_id)
                anomalies.extend(result["anomalies"])
                risk_score += result["risk_score"]
                recommendations.extend(result["recommendations"])

            elif entity_type in {"invoice", "invoices"}:
                result = await self._analyze_invoice_anomalies(outlet_id, entity_id)
                anomalies.extend(result["anomalies"])
                risk_score += result["risk_score"]
                recommendations.extend(result["recommendations"])

            elif entity_type in {"eod_report", "eod", "daily_report"}:
                result = await self._analyze_eod_anomalies(outlet_id, entity_id)
                anomalies.extend(result["anomalies"])
                risk_score += result["risk_score"]
                recommendations.extend(result["recommendations"])

            elif entity_type in {"inventory", "stock", "product", "inventory_item"}:
                result = await self._analyze_inventory_anomalies(outlet_id, entity_id)
                anomalies.extend(result["anomalies"])
                risk_score += result["risk_score"]
                recommendations.extend(result["recommendations"])

            else:
                recommendations.append(
                    f"Unsupported entity_type '{entity_type}'. Supported: payment, invoice, eod_report, inventory."
                )

            risk_score = min(100.0, risk_score)
            anomalies = self._dedupe_detected_anomalies(anomalies)
            self._persist_detected_anomalies(
                outlet_id=outlet_id,
                anomalies=anomalies,
                force_detection=bool(detection_request.force_detection),
            )
            recommendations = self._dedupe_recommendations(recommendations)

            if anomalies:
                confidence = round(
                    sum(float(a.ai_confidence or 0.0) for a in anomalies) / len(anomalies),
                    2,
                )
                confidence = max(50.0, min(100.0, confidence))
            else:
                confidence = 80.0

            reasoning_summary = self._build_detection_summary(entity_type, anomalies, risk_score)

            return AnomalyDetectionResult(
                anomalies=anomalies,
                risk_score=risk_score,
                recommendations=recommendations,
                reasoning_summary=reasoning_summary,
                detection_time=datetime.now(),
                confidence=confidence,
            )

        except Exception as e:
            logger.error(f"Error detecting anomalies: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to detect anomalies"
            )

    def _dedupe_detected_anomalies(self, anomalies: List[AnomalyResponse]) -> List[AnomalyResponse]:
        """Drop duplicate anomaly signatures produced in a single detection run."""
        deduped: List[AnomalyResponse] = []
        seen: set[str] = set()

        for anomaly in anomalies:
            anomaly_type = anomaly.type.value if hasattr(anomaly.type, "value") else str(anomaly.type)
            signature = "|".join([
                str(anomaly_type or "").lower(),
                str(anomaly.related_entity or "").lower(),
                str(anomaly.related_id or "").lower(),
                str(anomaly.description or "").strip().lower(),
            ])
            if signature in seen:
                continue
            seen.add(signature)
            deduped.append(anomaly)

        return deduped

    def _persist_detected_anomalies(
        self,
        outlet_id: str,
        anomalies: List[AnomalyResponse],
        force_detection: bool = False,
    ) -> None:
        """Persist detected anomalies to DB so dashboard alerts/stats reflect auto detection."""
        if not anomalies:
            return

        now = datetime.now()
        duplicate_window_start = (now - timedelta(hours=24)).isoformat()

        for anomaly in anomalies:
            row = self._anomaly_to_insert_row(anomaly)
            anomaly_type = str(row.get("type") or "").strip()
            related_entity = str(row.get("related_entity") or "").strip()
            related_id = str(row.get("related_id") or "").strip()
            description = str(row.get("description") or "").strip()

            if not (anomaly_type and related_entity and related_id and description):
                continue

            if not force_detection:
                try:
                    existing = self.supabase.table(Tables.ANOMALIES).select(
                        "id,description"
                    ).eq("outlet_id", outlet_id)\
                        .eq("type", anomaly_type)\
                        .eq("related_entity", related_entity)\
                        .eq("related_id", related_id)\
                        .eq("resolved", False)\
                        .gte("detected_at", duplicate_window_start)\
                        .limit(20)\
                        .execute()

                    if any(
                        str(item.get("description") or "").strip().lower() == description.lower()
                        for item in (existing.data or [])
                    ):
                        continue
                except Exception as dedupe_error:
                    logger.warning("Anomaly dedupe check failed; continuing with insert: %s", dedupe_error)

            try:
                self.supabase.table(Tables.ANOMALIES).insert(row).execute()
            except Exception as insert_error:
                logger.warning(
                    "Failed to persist detected anomaly %s/%s (%s): %s",
                    related_entity,
                    related_id,
                    anomaly_type,
                    insert_error,
                )

    def _anomaly_to_insert_row(self, anomaly: AnomalyResponse) -> Dict[str, Any]:
        """Serialize anomaly response model to DB insert row with JSON-safe primitive values."""
        if hasattr(anomaly, "model_dump"):
            row = anomaly.model_dump(mode="json")
        else:
            row = anomaly.dict()

        # Handle enum-like fields when model_dump(mode="json") is not available.
        for key in ("type", "severity"):
            value = row.get(key)
            if hasattr(value, "value"):
                row[key] = value.value

        for key in ("detected_at", "created_at", "updated_at", "resolved_at"):
            value = row.get(key)
            if isinstance(value, datetime):
                row[key] = value.isoformat()

        row["outlet_id"] = str(row.get("outlet_id") or "")
        row["related_id"] = str(row.get("related_id") or "")
        row["related_entity"] = str(row.get("related_entity") or "")
        row["description"] = str(row.get("description") or "")
        row["id"] = str(row.get("id") or f"anomaly_{uuid4()}")
        row["resolved"] = bool(row.get("resolved", False))

        return row

    async def resolve_anomaly(
        self,
        anomaly_id: str,
        resolution_data: AnomalyResolutionRequest,
        outlet_id: str,
        user_id: str
    ) -> AnomalyResolutionResponse:
        """Resolve an anomaly"""
        try:
            await self.get_anomaly(anomaly_id, outlet_id)

            update_data = {
                "resolved": resolution_data.resolved,
                "resolved_by": user_id,
                "resolved_at": datetime.now().isoformat(),
                "resolution_notes": resolution_data.resolution_notes
            }

            response = self.supabase.table(Tables.ANOMALIES).update(update_data).eq("id", anomaly_id).eq("outlet_id", outlet_id).execute()

            if not response.data:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Failed to resolve anomaly"
                )

            return AnomalyResolutionResponse(
                anomaly_id=anomaly_id,
                resolved=resolution_data.resolved,
                resolved_by=user_id,
                resolved_at=datetime.now(),
                resolution_notes=resolution_data.resolution_notes
            )

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error resolving anomaly: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to resolve anomaly"
            )

    async def get_anomaly_stats(self, outlet_id: str) -> AnomalyStatsResponse:
        """Get anomaly statistics"""
        try:
            response = self.supabase.table(Tables.ANOMALIES).select("*").eq("outlet_id", outlet_id).execute()
            anomalies = response.data or []

            total_anomalies = len(anomalies)
            unresolved_anomalies = sum(1 for a in anomalies if not a.get("resolved", False))
            critical_anomalies = sum(1 for a in anomalies if a.get("severity") == "critical")
            risk_score = min(100.0, (unresolved_anomalies / max(1, total_anomalies)) * 100)

            type_distribution: Dict[str, int] = {}
            severity_distribution: Dict[str, int] = {}

            for anomaly in anomalies:
                anomaly_type = anomaly.get("type", "unknown")
                severity = anomaly.get("severity", "unknown")
                type_distribution[anomaly_type] = type_distribution.get(anomaly_type, 0) + 1
                severity_distribution[severity] = severity_distribution.get(severity, 0) + 1

            resolved_count = sum(1 for a in anomalies if a.get("resolved", False))
            resolution_rate = (resolved_count / total_anomalies * 100) if total_anomalies > 0 else 0

            resolution_hours: List[float] = []
            for anomaly in anomalies:
                if not anomaly.get("resolved"):
                    continue
                detected_at = self._safe_datetime(anomaly.get("detected_at"))
                resolved_at = self._safe_datetime(anomaly.get("resolved_at"))
                if detected_at and resolved_at and resolved_at >= detected_at:
                    resolution_hours.append((resolved_at - detected_at).total_seconds() / 3600)

            average_resolution_time = (
                round(sum(resolution_hours) / len(resolution_hours), 2)
                if resolution_hours
                else None
            )

            return AnomalyStatsResponse(
                total_anomalies=total_anomalies,
                unresolved_anomalies=unresolved_anomalies,
                risk_score=round(risk_score, 2),
                anomalies_by_type=type_distribution,
                anomalies_by_severity=severity_distribution,
                resolution_rate=round(resolution_rate, 2),
                average_resolution_time=average_resolution_time,
                critical_anomalies=critical_anomalies
            )

        except Exception as e:
            logger.error(f"Error getting anomaly stats: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to get anomaly statistics"
            )

    async def search_anomalies(self, search_request: AnomalySearchRequest, outlet_id: str) -> Dict[str, Any]:
        """Search anomalies with advanced filters"""
        try:
            query = self.supabase.table(Tables.ANOMALIES).select("*", count="exact")
            query = query.eq("outlet_id", outlet_id)

            if search_request.type:
                query = query.eq("type", search_request.type.value)
            if search_request.severity:
                query = query.eq("severity", search_request.severity.value)
            if search_request.resolved is not None:
                query = query.eq("resolved", search_request.resolved)
            if search_request.related_entity:
                query = query.eq("related_entity", search_request.related_entity)
            if search_request.date_from:
                query = query.gte("detected_at", search_request.date_from.isoformat())
            if search_request.date_to:
                query = query.lte("detected_at", search_request.date_to.isoformat())
            if search_request.min_confidence:
                query = query.gte("ai_confidence", search_request.min_confidence)

            query = query.limit(search_request.limit)
            query = query.order("detected_at", desc=True)

            response = query.execute()

            anomalies = [AnomalyResponse(**anomaly) for anomaly in (response.data or [])]
            total = response.count or 0

            return {
                "items": anomalies,
                "total": total,
                "query": search_request.dict()
            }

        except Exception as e:
            logger.error(f"Error searching anomalies: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to search anomalies"
            )

    async def get_anomaly_trends(self, outlet_id: str, days: int = 30) -> AnomalyTrendResponse:
        """Get anomaly trend data based on recorded anomalies (no random generation)."""
        try:
            end_date = datetime.now()
            start_date = end_date - timedelta(days=days - 1)

            response = self.supabase.table(Tables.ANOMALIES).select("*")\
                .eq("outlet_id", outlet_id)\
                .gte("detected_at", start_date.isoformat())\
                .execute()

            anomalies = response.data or []

            # Daily counts for requested window
            daily_keys: List[str] = []
            daily_counts_map: Dict[str, int] = {}
            for i in range(days):
                day = (start_date + timedelta(days=i)).date().isoformat()
                daily_keys.append(day)
                daily_counts_map[day] = 0

            # Weekly/monthly and segmented trends
            weekly_counts: Dict[str, int] = {}
            monthly_counts: Dict[str, int] = {}
            severity_weekly: Dict[str, Dict[str, int]] = {
                severity.value: {} for severity in AnomalySeverity
            }
            type_weekly: Dict[str, Dict[str, int]] = {
                anomaly_type.value: {} for anomaly_type in AnomalyType
            }

            for anomaly in anomalies:
                detected_at = self._safe_datetime(anomaly.get("detected_at"))
                if not detected_at:
                    continue

                day_key = detected_at.date().isoformat()
                if day_key in daily_counts_map:
                    daily_counts_map[day_key] += 1

                week_key = self._week_start_iso(detected_at)
                weekly_counts[week_key] = weekly_counts.get(week_key, 0) + 1

                month_key = detected_at.strftime("%Y-%m")
                monthly_counts[month_key] = monthly_counts.get(month_key, 0) + 1

                sev_key = str(anomaly.get("severity") or "").lower()
                if sev_key in severity_weekly:
                    bucket = severity_weekly[sev_key]
                    bucket[week_key] = bucket.get(week_key, 0) + 1

                type_key = str(anomaly.get("type") or "").lower()
                if type_key in type_weekly:
                    bucket = type_weekly[type_key]
                    bucket[week_key] = bucket.get(week_key, 0) + 1

            daily_counts = [{"date": day, "count": daily_counts_map[day]} for day in daily_keys]

            sorted_weeks = sorted(weekly_counts.keys())
            weekly_trend = [{"week": week, "count": weekly_counts[week]} for week in sorted_weeks]

            sorted_months = sorted(monthly_counts.keys())
            monthly_trend = [{"month": month, "count": monthly_counts[month]} for month in sorted_months]

            severity_trend: Dict[str, List[Dict[str, Any]]] = {}
            for severity, buckets in severity_weekly.items():
                severity_trend[severity] = [
                    {"week": week, "count": buckets.get(week, 0)}
                    for week in sorted_weeks
                ]

            type_trend: Dict[str, List[Dict[str, Any]]] = {}
            for anomaly_type, buckets in type_weekly.items():
                type_trend[anomaly_type] = [
                    {"week": week, "count": buckets.get(week, 0)}
                    for week in sorted_weeks
                ]

            return AnomalyTrendResponse(
                daily_counts=daily_counts,
                weekly_trend=weekly_trend,
                monthly_trend=monthly_trend,
                severity_trend=severity_trend,
                type_trend=type_trend
            )

        except Exception as e:
            logger.error(f"Error getting anomaly trends: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to get anomaly trends"
            )

    async def _analyze_payment_anomalies(self, outlet_id: str, payment_id: str) -> Dict[str, Any]:
        """Analyze payment-related anomalies using deterministic fraud/theft risk rules."""
        anomalies: List[AnomalyResponse] = []
        risk_score = 0.0
        recommendations: List[str] = []

        payment_result = self.supabase.table(Tables.PAYMENTS).select("*")\
            .eq("id", payment_id).eq("outlet_id", outlet_id).limit(1).execute()
        payment_rows = payment_result.data or []

        if not payment_rows:
            recommendations.append("Payment record not found for anomaly analysis.")
            return {"anomalies": anomalies, "risk_score": risk_score, "recommendations": recommendations}

        payment = payment_rows[0]
        amount = self._safe_float(payment.get("amount"))
        vendor_id = payment.get("vendor_id")
        invoice_id = payment.get("invoice_id")
        payment_time = self._safe_datetime(payment.get("payment_date")) or self._safe_datetime(payment.get("created_at")) or datetime.now()

        history_result = self.supabase.table(Tables.PAYMENTS).select(
            "id,amount,vendor_id,invoice_id,payment_method,status,payment_date,created_at,reference_number"
        ).eq("outlet_id", outlet_id).neq("id", payment_id).order("created_at", desc=True).limit(500).execute()
        history = history_result.data or []

        vendor_history = [
            row for row in history
            if vendor_id and row.get("vendor_id") == vendor_id
        ]
        vendor_amounts = [
            self._safe_float(row.get("amount"))
            for row in vendor_history
            if self._safe_float(row.get("amount")) > 0
        ]

        vendor_median = self._median(vendor_amounts)
        vendor_std = self._stddev(vendor_amounts)

        # Rule 1: Duplicate-payment fingerprint (common leakage pattern)
        duplicate_candidates = []
        for row in history:
            candidate_amount = self._safe_float(row.get("amount"))
            if candidate_amount <= 0:
                continue
            if abs(candidate_amount - amount) > max(0.01, amount * 0.005):
                continue

            same_vendor = bool(vendor_id and row.get("vendor_id") == vendor_id)
            same_invoice = bool(invoice_id and row.get("invoice_id") == invoice_id)
            if not (same_vendor or same_invoice):
                continue

            candidate_time = self._safe_datetime(row.get("payment_date")) or self._safe_datetime(row.get("created_at"))
            hours_apart = self._hours_apart(payment_time, candidate_time)
            if hours_apart <= 72:
                duplicate_candidates.append((row, same_vendor, same_invoice, hours_apart))

        if duplicate_candidates:
            strongest = sorted(
                duplicate_candidates,
                key=lambda item: (
                    0 if item[2] else 1,  # same invoice first
                    0 if item[1] else 1,  # same vendor first
                    item[3],              # closest time first
                ),
            )[0]
            candidate, same_vendor, same_invoice, hours_apart = strongest

            confidence = 95.0 if (same_invoice and hours_apart <= 24) else 88.0 if same_vendor else 80.0
            severity = AnomalySeverity.CRITICAL if (same_invoice and hours_apart <= 12) else AnomalySeverity.HIGH

            signals = [
                f"same amount pattern (current={amount:,.2f}, prior={self._safe_float(candidate.get('amount')):,.2f})",
                f"time distance {hours_apart:.1f}h",
                "same invoice linkage" if same_invoice else "same vendor linkage",
            ]

            anomalies.append(self._build_detected_anomaly(
                outlet_id=outlet_id,
                anomaly_type=AnomalyType.DUPLICATE_PAYMENT,
                related_entity="payment",
                related_id=payment_id,
                description="Potential duplicate payment behavior detected.",
                severity=severity,
                ai_confidence=confidence,
                reasoning_summary="AI flagged duplicate-payment risk based on amount/time/entity fingerprints.",
                signals=signals,
            ))
            risk_score += 38.0 if severity == AnomalySeverity.CRITICAL else 30.0
            recommendations.append("Lock and review matching payment records before approving settlement.")

        # Rule 2: Vendor baseline outlier (theft/fraud indicator)
        if amount > 0 and len(vendor_amounts) >= 5 and vendor_median > 0:
            ratio = amount / vendor_median
            z_score = (amount - vendor_median) / vendor_std if vendor_std > 0 else 0.0
            is_strong_outlier = ratio >= 2.5 and (z_score >= 2.0 or ratio >= 4.0)

            if is_strong_outlier:
                severity = AnomalySeverity.HIGH if ratio >= 4.0 or z_score >= 3.0 else AnomalySeverity.MEDIUM
                confidence = min(97.0, 70.0 + min(ratio * 8.0, 20.0) + min(max(z_score, 0.0) * 4.0, 12.0))

                signals = [
                    f"amount ratio vs vendor median: {ratio:.2f}x",
                    f"vendor median={vendor_median:,.2f}",
                ]
                if vendor_std > 0:
                    signals.append(f"z-score={z_score:.2f}")

                anomalies.append(self._build_detected_anomaly(
                    outlet_id=outlet_id,
                    anomaly_type=AnomalyType.SUSPICIOUS_ACTIVITY,
                    related_entity="payment",
                    related_id=payment_id,
                    description="Payment amount is materially outside vendor baseline behavior.",
                    severity=severity,
                    ai_confidence=confidence,
                    reasoning_summary="AI identified outlier payment behavior relative to historical vendor baseline.",
                    signals=signals,
                ))
                risk_score += 25.0 if severity == AnomalySeverity.HIGH else 16.0
                recommendations.append("Require manager verification and source-document check for this payment.")

        # Rule 3: High-value payment with weak traceability
        high_value_threshold = max(100000.0, vendor_median * 2.0 if vendor_median > 0 else 100000.0)
        missing_traceability = not payment.get("reference_number") and not payment.get("invoice_id")

        if amount >= high_value_threshold and missing_traceability:
            confidence = min(92.0, 72.0 + min((amount / max(high_value_threshold, 1.0)) * 8.0, 12.0))
            anomalies.append(self._build_detected_anomaly(
                outlet_id=outlet_id,
                anomaly_type=AnomalyType.SUSPICIOUS_ACTIVITY,
                related_entity="payment",
                related_id=payment_id,
                description="High-value payment lacks invoice/reference traceability.",
                severity=AnomalySeverity.MEDIUM,
                ai_confidence=confidence,
                reasoning_summary="AI flagged elevated leakage risk due to high value with missing traceability links.",
                signals=[
                    f"amount={amount:,.2f}",
                    "missing invoice_id",
                    "missing reference_number",
                ],
            ))
            risk_score += 12.0
            recommendations.append("Enforce reference number or linked invoice before marking payment final.")

        # Rule 4: Future-dated record inconsistency
        if payment_time > (datetime.now() + timedelta(days=1)):
            anomalies.append(self._build_detected_anomaly(
                outlet_id=outlet_id,
                anomaly_type=AnomalyType.DATA_INCONSISTENCY,
                related_entity="payment",
                related_id=payment_id,
                description="Payment date is in the future beyond allowed tolerance.",
                severity=AnomalySeverity.LOW,
                ai_confidence=78.0,
                reasoning_summary="AI flagged temporal inconsistency in payment date.",
                signals=[f"payment_date={payment_time.isoformat()}"],
            ))
            risk_score += 5.0
            recommendations.append("Correct payment date if this was entered prematurely.")

        return {
            "anomalies": anomalies,
            "risk_score": risk_score,
            "recommendations": recommendations,
        }

    async def _analyze_invoice_anomalies(self, outlet_id: str, invoice_id: str) -> Dict[str, Any]:
        """Analyze invoice-related anomalies with deterministic anti-theft/fraud logic."""
        anomalies: List[AnomalyResponse] = []
        risk_score = 0.0
        recommendations: List[str] = []

        invoice_result = self.supabase.table(Tables.INVOICES).select("*")\
            .eq("id", invoice_id).eq("outlet_id", outlet_id).limit(1).execute()
        invoice_rows = invoice_result.data or []

        if not invoice_rows:
            recommendations.append("Invoice record not found for anomaly analysis.")
            return {"anomalies": anomalies, "risk_score": risk_score, "recommendations": recommendations}

        invoice = invoice_rows[0]
        vendor_id = invoice.get("vendor_id")
        invoice_number = str(invoice.get("invoice_number") or "").strip()
        total_amount = self._first_numeric(invoice, ["total", "total_amount", "amount"], default=0.0)
        invoice_time = (
            self._safe_datetime(invoice.get("invoice_date"))
            or self._safe_datetime(invoice.get("issue_date"))
            or self._safe_datetime(invoice.get("date"))
            or self._safe_datetime(invoice.get("created_at"))
            or datetime.now()
        )
        due_time = self._safe_datetime(invoice.get("due_date"))

        history_result = self.supabase.table(Tables.INVOICES).select(
            "id,vendor_id,invoice_number,total,total_amount,amount,status,invoice_date,issue_date,due_date,created_at"
        ).eq("outlet_id", outlet_id).neq("id", invoice_id).order("created_at", desc=True).limit(500).execute()
        history = history_result.data or []

        same_vendor_history = [
            row for row in history
            if vendor_id and row.get("vendor_id") == vendor_id
        ]
        vendor_totals = [
            self._first_numeric(row, ["total", "total_amount", "amount"], default=0.0)
            for row in same_vendor_history
            if self._first_numeric(row, ["total", "total_amount", "amount"], default=0.0) > 0
        ]

        vendor_median = self._median(vendor_totals)
        vendor_std = self._stddev(vendor_totals)

        # Rule 1: Duplicate invoice-number fingerprint
        if invoice_number and vendor_id:
            duplicates = [
                row for row in same_vendor_history
                if str(row.get("invoice_number") or "").strip().lower() == invoice_number.lower()
            ]
            if duplicates:
                anomalies.append(self._build_detected_anomaly(
                    outlet_id=outlet_id,
                    anomaly_type=AnomalyType.DATA_INCONSISTENCY,
                    related_entity="invoice",
                    related_id=invoice_id,
                    description="Duplicate invoice number detected for the same vendor.",
                    severity=AnomalySeverity.HIGH,
                    ai_confidence=94.0,
                    reasoning_summary="AI matched invoice fingerprint against historical records and found duplicate numbering.",
                    signals=[
                        f"invoice_number={invoice_number}",
                        f"duplicate_count={len(duplicates)}",
                        f"vendor_id={vendor_id}",
                    ],
                ))
                risk_score += 30.0
                recommendations.append("Hold invoice approval and confirm document authenticity with vendor.")

        # Rule 2: Vendor baseline price spike
        if total_amount > 0 and len(vendor_totals) >= 5 and vendor_median > 0:
            ratio = total_amount / vendor_median
            z_score = (total_amount - vendor_median) / vendor_std if vendor_std > 0 else 0.0
            if ratio >= 2.2 and (z_score >= 2.0 or ratio >= 3.5):
                severity = AnomalySeverity.HIGH if ratio >= 3.5 or z_score >= 3.0 else AnomalySeverity.MEDIUM
                confidence = min(97.0, 68.0 + min(ratio * 9.0, 22.0) + min(max(z_score, 0.0) * 4.0, 10.0))

                anomalies.append(self._build_detected_anomaly(
                    outlet_id=outlet_id,
                    anomaly_type=AnomalyType.PRICE_SPIKE,
                    related_entity="invoice",
                    related_id=invoice_id,
                    description="Invoice value is significantly above vendor historical baseline.",
                    severity=severity,
                    ai_confidence=confidence,
                    reasoning_summary="AI detected a pricing outlier against this vendor's historical invoice distribution.",
                    signals=[
                        f"ratio_vs_median={ratio:.2f}x",
                        f"vendor_median={vendor_median:,.2f}",
                        *( [f"z_score={z_score:.2f}"] if vendor_std > 0 else [] ),
                    ],
                ))
                risk_score += 24.0 if severity == AnomalySeverity.HIGH else 16.0
                recommendations.append("Validate unit prices/quantities and request vendor reconfirmation.")

        # Rule 3: Missing critical fields
        missing_fields: List[str] = []
        if not invoice_number:
            missing_fields.append("invoice_number")
        if not vendor_id:
            missing_fields.append("vendor_id")
        if total_amount <= 0:
            missing_fields.append("total_amount")
        if not invoice_time:
            missing_fields.append("invoice_date")

        if missing_fields:
            severity = AnomalySeverity.MEDIUM if len(missing_fields) >= 2 else AnomalySeverity.LOW
            confidence = min(95.0, 75.0 + len(missing_fields) * 6.0)
            anomalies.append(self._build_detected_anomaly(
                outlet_id=outlet_id,
                anomaly_type=AnomalyType.MISSING_INFORMATION,
                related_entity="invoice",
                related_id=invoice_id,
                description="Invoice is missing required fields for safe approval.",
                severity=severity,
                ai_confidence=confidence,
                reasoning_summary="AI found mandatory accounting controls missing from the invoice payload.",
                signals=[f"missing={', '.join(missing_fields)}"],
            ))
            risk_score += 10.0 if severity == AnomalySeverity.MEDIUM else 4.0
            recommendations.append("Complete missing invoice fields before posting or payment.")

        # Rule 4: Date inconsistency
        if due_time and invoice_time and due_time < invoice_time:
            anomalies.append(self._build_detected_anomaly(
                outlet_id=outlet_id,
                anomaly_type=AnomalyType.DATA_INCONSISTENCY,
                related_entity="invoice",
                related_id=invoice_id,
                description="Invoice due date is earlier than invoice date.",
                severity=AnomalySeverity.LOW,
                ai_confidence=82.0,
                reasoning_summary="AI flagged invalid invoice chronology.",
                signals=[
                    f"invoice_date={invoice_time.date().isoformat()}",
                    f"due_date={due_time.date().isoformat()}",
                ],
            ))
            risk_score += 4.0
            recommendations.append("Correct invoice due date chronology.")

        # Rule 5: First-time high-value vendor invoice
        if vendor_id and len(same_vendor_history) == 0 and total_amount >= 250000:
            anomalies.append(self._build_detected_anomaly(
                outlet_id=outlet_id,
                anomaly_type=AnomalyType.SUSPICIOUS_ACTIVITY,
                related_entity="invoice",
                related_id=invoice_id,
                description="High-value invoice from vendor with no historical relationship.",
                severity=AnomalySeverity.MEDIUM,
                ai_confidence=84.0,
                reasoning_summary="AI flagged elevated fraud/leakage risk for first-time high-value vendor transaction.",
                signals=[
                    f"invoice_total={total_amount:,.2f}",
                    "vendor history depth=0",
                ],
            ))
            risk_score += 12.0
            recommendations.append("Require secondary approval and vendor KYC verification for first-time high-value invoice.")

        return {
            "anomalies": anomalies,
            "risk_score": risk_score,
            "recommendations": recommendations,
        }

    async def _analyze_eod_anomalies(self, outlet_id: str, eod_id: str) -> Dict[str, Any]:
        """Analyze EOD report anomalies for theft/leakage signatures."""
        anomalies: List[AnomalyResponse] = []
        risk_score = 0.0
        recommendations: List[str] = []

        report_result = self.supabase.table(Tables.EOD).select("*")\
            .eq("id", eod_id).eq("outlet_id", outlet_id).limit(1).execute()
        report_rows = report_result.data or []

        if not report_rows:
            recommendations.append("EOD report not found for anomaly analysis.")
            return {"anomalies": anomalies, "risk_score": risk_score, "recommendations": recommendations}

        report = report_rows[0]
        report_date = self._safe_datetime(report.get("date")) or self._safe_datetime(report.get("created_at")) or datetime.now()

        total_sales = self._first_numeric(report, ["total_sales"], default=0.0)
        cash_sales = self._first_numeric(report, ["sales_cash"], default=0.0)
        cash_variance = self._first_numeric(report, ["cash_variance"], default=0.0)
        gross_margin_percent = self._first_numeric(report, ["gross_margin_percent"], default=0.0)

        abs_variance = abs(cash_variance)
        variance_ratio = abs_variance / max(total_sales, 1.0)

        # Rule 1: Cash variance severity
        if abs_variance >= max(500.0, total_sales * 0.02):
            if variance_ratio >= 0.12 or abs_variance >= 100000:
                severity = AnomalySeverity.CRITICAL
            elif variance_ratio >= 0.07 or abs_variance >= 50000:
                severity = AnomalySeverity.HIGH
            else:
                severity = AnomalySeverity.MEDIUM

            confidence = min(98.0, 65.0 + min(variance_ratio * 250.0, 25.0) + (5.0 if abs_variance >= 50000 else 0.0))

            anomalies.append(self._build_detected_anomaly(
                outlet_id=outlet_id,
                anomaly_type=AnomalyType.CASH_VARIANCE,
                related_entity="eod_report",
                related_id=eod_id,
                description="Material cash variance detected in EOD reconciliation.",
                severity=severity,
                ai_confidence=confidence,
                reasoning_summary="AI detected reconciliation variance above expected operational tolerance.",
                signals=[
                    f"cash_variance={cash_variance:,.2f}",
                    f"variance_ratio={variance_ratio:.2%}",
                    f"total_sales={total_sales:,.2f}",
                ],
            ))
            risk_score += 36.0 if severity == AnomalySeverity.CRITICAL else 24.0 if severity == AnomalySeverity.HIGH else 12.0
            recommendations.append("Run drawer recount and review all void/discount activities before closing period.")

        # Rule 2: Low margin warning
        if total_sales >= 10000 and gross_margin_percent <= 5.0:
            severity = AnomalySeverity.HIGH if gross_margin_percent <= 0 else AnomalySeverity.MEDIUM
            confidence = min(94.0, 72.0 + max(0.0, (5.0 - gross_margin_percent) * 4.0))

            anomalies.append(self._build_detected_anomaly(
                outlet_id=outlet_id,
                anomaly_type=AnomalyType.LOW_MARGIN,
                related_entity="eod_report",
                related_id=eod_id,
                description="Gross margin is materially below healthy threshold.",
                severity=severity,
                ai_confidence=confidence,
                reasoning_summary="AI detected margin compression that may indicate pricing leakage or stock shrinkage.",
                signals=[
                    f"gross_margin_percent={gross_margin_percent:.2f}",
                    f"total_sales={total_sales:,.2f}",
                ],
            ))
            risk_score += 18.0 if severity == AnomalySeverity.HIGH else 10.0
            recommendations.append("Review pricing overrides, cost postings, and potential stock shrinkage.")

        # Baseline from recent EOD reports
        history_query = self.supabase.table(Tables.EOD).select("id,date,total_sales,sales_cash,cash_variance")\
            .eq("outlet_id", outlet_id).neq("id", eod_id).order("date", desc=True).limit(30)
        if report_date:
            history_query = history_query.lt("date", report_date.date().isoformat())
        history_rows = (history_query.execute().data or [])

        historical_sales = [self._first_numeric(row, ["total_sales"], default=0.0) for row in history_rows]
        historical_sales = [value for value in historical_sales if value > 0]

        historical_cash_ratios: List[float] = []
        for row in history_rows:
            h_sales = self._first_numeric(row, ["total_sales"], default=0.0)
            h_cash = self._first_numeric(row, ["sales_cash"], default=0.0)
            if h_sales > 0:
                historical_cash_ratios.append(h_cash / h_sales)

        # Rule 3: Unusual cash-heavy day (skimming risk)
        if total_sales > 0:
            cash_ratio = cash_sales / total_sales
            baseline_cash_ratio = self._median(historical_cash_ratios)

            is_cash_spike = (
                cash_ratio >= 0.90
                and (
                    (baseline_cash_ratio > 0 and (cash_ratio - baseline_cash_ratio) >= 0.20)
                    or (baseline_cash_ratio == 0 and cash_ratio >= 0.95)
                )
            )

            if is_cash_spike:
                confidence = min(95.0, 70.0 + min((cash_ratio - baseline_cash_ratio) * 80.0, 18.0))
                anomalies.append(self._build_detected_anomaly(
                    outlet_id=outlet_id,
                    anomaly_type=AnomalyType.SUSPICIOUS_ACTIVITY,
                    related_entity="eod_report",
                    related_id=eod_id,
                    description="Cash sales concentration is abnormally high versus baseline.",
                    severity=AnomalySeverity.HIGH,
                    ai_confidence=confidence,
                    reasoning_summary="AI detected an unusual shift toward cash, a known leakage/theft risk pattern.",
                    signals=[
                        f"cash_ratio={cash_ratio:.2%}",
                        f"baseline_cash_ratio={baseline_cash_ratio:.2%}",
                    ],
                ))
                risk_score += 20.0
                recommendations.append("Audit cash-only sales and compare with POS transaction-level evidence.")

        # Rule 4: Sudden sales collapse with variance (possible unrecorded sales)
        if historical_sales:
            median_sales = self._median(historical_sales)
            if median_sales > 0 and total_sales < median_sales * 0.45 and abs_variance >= max(1000.0, total_sales * 0.03):
                severity = AnomalySeverity.HIGH if total_sales < median_sales * 0.30 else AnomalySeverity.MEDIUM
                confidence = min(93.0, 68.0 + min(((median_sales - total_sales) / median_sales) * 40.0, 20.0))

                anomalies.append(self._build_detected_anomaly(
                    outlet_id=outlet_id,
                    anomaly_type=AnomalyType.UNUSUAL_PATTERN,
                    related_entity="eod_report",
                    related_id=eod_id,
                    description="Sales dropped sharply against historical baseline while cash variance remained elevated.",
                    severity=severity,
                    ai_confidence=confidence,
                    reasoning_summary="AI identified a correlated pattern of sales suppression plus reconciliation mismatch.",
                    signals=[
                        f"current_sales={total_sales:,.2f}",
                        f"median_sales={median_sales:,.2f}",
                        f"cash_variance={cash_variance:,.2f}",
                    ],
                ))
                risk_score += 16.0 if severity == AnomalySeverity.HIGH else 10.0
                recommendations.append("Cross-check inventory movement and transaction voids for potential under-recorded sales.")

        return {
            "anomalies": anomalies,
            "risk_score": risk_score,
            "recommendations": recommendations,
        }

    async def _analyze_inventory_anomalies(self, outlet_id: str, entity_id: str) -> Dict[str, Any]:
        """Analyze inventory theft/leakage patterns from stock movements and product state."""
        target = str(entity_id or "").strip()
        if not target:
            return {
                "anomalies": [],
                "risk_score": 0.0,
                "recommendations": ["Provide a product ID/SKU/barcode or 'outlet' as entity_id."],
            }

        if target.lower() in {"outlet", "all", "*"} or target == outlet_id:
            return await self._analyze_outlet_inventory_anomalies(outlet_id)

        product = self._resolve_inventory_product(outlet_id, target)
        if not product:
            return {
                "anomalies": [],
                "risk_score": 0.0,
                "recommendations": [
                    f"No product found for '{target}'. Use product ID, SKU, barcode, or entity_id='outlet'."
                ],
            }

        product_id = str(product.get("id") or "")
        product_name = str(product.get("name") or product.get("sku") or "Product")
        category = str(product.get("category") or "uncategorized")
        current_qty = self._safe_int(product.get("quantity_on_hand"))

        movements = self._load_stock_movements(
            outlet_id=outlet_id,
            product_id=product_id,
            since=datetime.now() - timedelta(days=90),
            limit=2000,
        )

        anomalies: List[AnomalyResponse] = []
        risk_score = 0.0
        recommendations: List[str] = []

        # Rule 1: Sales while quantity_before is already zero/negative (oversell pattern).
        oversell_events = []
        oversell_qty = 0
        for row in movements:
            movement_type = str(row.get("movement_type") or "").lower()
            quantity_change = self._safe_int(row.get("quantity_change"))
            quantity_before = self._safe_int(row.get("quantity_before"))
            if movement_type == "sale" and quantity_change < 0 and quantity_before <= 0:
                oversell_events.append(row)
                oversell_qty += abs(quantity_change)

        if oversell_events:
            event_count = len(oversell_events)
            severity = (
                AnomalySeverity.CRITICAL
                if event_count >= 3 or oversell_qty >= 12
                else AnomalySeverity.HIGH
            )
            confidence = min(98.0, 80.0 + min(event_count * 4.0, 12.0) + min(oversell_qty * 1.5, 8.0))
            anomalies.append(self._build_detected_anomaly(
                outlet_id=outlet_id,
                anomaly_type=AnomalyType.SUSPICIOUS_ACTIVITY,
                related_entity="inventory",
                related_id=product_id,
                description=f"{product_name}: sales were posted while stock level was already zero.",
                severity=severity,
                ai_confidence=confidence,
                reasoning_summary=(
                    "AI detected overselling from zero stock, a classic leakage signal "
                    "where items may leave shelves outside controlled stock flow."
                ),
                signals=[
                    f"product={product_name}",
                    f"category={category}",
                    f"oversell_events={event_count}",
                    f"oversell_qty={oversell_qty}",
                    f"current_qty={current_qty}",
                ],
            ))
            risk_score += 35.0 if severity == AnomalySeverity.CRITICAL else 24.0
            recommendations.append(
                "Enforce manager override for sales when on-hand is zero and require immediate cycle count."
            )

        # Rule 2: Movement arithmetic mismatch (potential manual tampering / broken audit trail).
        bad_math = []
        for row in movements:
            quantity_before = self._safe_int(row.get("quantity_before"))
            quantity_after = self._safe_int(row.get("quantity_after"))
            quantity_change = self._safe_int(row.get("quantity_change"))
            if (quantity_before + quantity_change) != quantity_after:
                bad_math.append(row)

        if bad_math:
            anomalies.append(self._build_detected_anomaly(
                outlet_id=outlet_id,
                anomaly_type=AnomalyType.DATA_INCONSISTENCY,
                related_entity="inventory",
                related_id=product_id,
                description=f"{product_name}: stock movement history has arithmetic inconsistencies.",
                severity=AnomalySeverity.HIGH,
                ai_confidence=min(98.0, 85.0 + min(len(bad_math) * 2.0, 10.0)),
                reasoning_summary=(
                    "AI found movement records where quantity_before + quantity_change != quantity_after, "
                    "which indicates possible data tampering or integration defects."
                ),
                signals=[
                    f"product={product_name}",
                    f"inconsistent_rows={len(bad_math)}",
                ],
            ))
            risk_score += 18.0
            recommendations.append(
                "Investigate stock movement audit trail and lock manual edits until reconciliation is completed."
            )

        # Rule 3: Negative adjustments disproportionately high versus sales.
        negative_adjustments = []
        negative_adjustment_qty = 0
        missing_reason_count = 0
        sales_qty = 0

        for row in movements:
            movement_type = str(row.get("movement_type") or "").lower()
            quantity_change = self._safe_int(row.get("quantity_change"))
            if movement_type == "sale" and quantity_change < 0:
                sales_qty += abs(quantity_change)
            if movement_type == "adjustment" and quantity_change < 0:
                negative_adjustments.append(row)
                negative_adjustment_qty += abs(quantity_change)
                reason_text = self._extract_reason_text(row.get("notes")).strip().lower()
                if not reason_text or reason_text in {"na", "n/a", "none", "unknown"}:
                    missing_reason_count += 1

        if negative_adjustments:
            baseline_sales = max(1, sales_qty)
            adjustment_ratio = negative_adjustment_qty / baseline_sales
            weak_reason_ratio = missing_reason_count / max(1, len(negative_adjustments))
            is_risky_adjustment = (
                negative_adjustment_qty >= 8
                and (adjustment_ratio >= 0.25 or weak_reason_ratio >= 0.5)
            )

            if is_risky_adjustment:
                severity = (
                    AnomalySeverity.HIGH
                    if adjustment_ratio >= 0.45 or weak_reason_ratio >= 0.7
                    else AnomalySeverity.MEDIUM
                )
                confidence = min(
                    96.0,
                    70.0 + min(adjustment_ratio * 25.0, 15.0) + min(weak_reason_ratio * 20.0, 11.0),
                )
                anomalies.append(self._build_detected_anomaly(
                    outlet_id=outlet_id,
                    anomaly_type=AnomalyType.SUSPICIOUS_ACTIVITY,
                    related_entity="inventory",
                    related_id=product_id,
                    description=f"{product_name}: excessive negative stock adjustments detected.",
                    severity=severity,
                    ai_confidence=confidence,
                    reasoning_summary=(
                        "AI detected a shrinkage pattern where manual/stocktake reductions are too large "
                        "relative to legitimate sales flow."
                    ),
                    signals=[
                        f"product={product_name}",
                        f"neg_adjust_qty={negative_adjustment_qty}",
                        f"sales_qty={sales_qty}",
                        f"adjustment_ratio={adjustment_ratio:.2f}",
                        f"missing_reason_ratio={weak_reason_ratio:.2f}",
                    ],
                ))
                risk_score += 22.0 if severity == AnomalySeverity.HIGH else 14.0
                recommendations.append(
                    "Require dual approval for negative adjustments and mandatory shrinkage reason codes."
                )

        # Rule 4: Stockout toggling (drop to zero then quick positive adjustment/receive).
        toggles = 0
        sorted_movements = sorted(
            movements,
            key=lambda row: self._safe_datetime(row.get("movement_date")) or datetime.min,
        )
        for index, row in enumerate(sorted_movements):
            quantity_after = self._safe_int(row.get("quantity_after"))
            quantity_change = self._safe_int(row.get("quantity_change"))
            current_time = self._safe_datetime(row.get("movement_date"))
            if quantity_after != 0 or quantity_change >= 0 or current_time is None:
                continue

            window_end = current_time + timedelta(hours=72)
            for candidate in sorted_movements[index + 1:]:
                candidate_time = self._safe_datetime(candidate.get("movement_date"))
                if candidate_time is None:
                    continue
                if candidate_time > window_end:
                    break
                candidate_change = self._safe_int(candidate.get("quantity_change"))
                candidate_type = str(candidate.get("movement_type") or "").lower()
                if candidate_change > 0 and candidate_type in {"adjustment", "receive", "transfer_in"}:
                    toggles += 1
                    break

        if toggles >= 2:
            anomalies.append(self._build_detected_anomaly(
                outlet_id=outlet_id,
                anomaly_type=AnomalyType.UNUSUAL_PATTERN,
                related_entity="inventory",
                related_id=product_id,
                description=f"{product_name}: repeated stockout-to-restock toggling in short windows.",
                severity=AnomalySeverity.MEDIUM,
                ai_confidence=min(94.0, 74.0 + min(toggles * 6.0, 16.0)),
                reasoning_summary=(
                    "AI flagged repeated transitions from zero stock to quick restock, "
                    "a known signal of off-books sales or delayed stock posting."
                ),
                signals=[
                    f"product={product_name}",
                    f"toggle_count={toggles}",
                    f"window=72h",
                ],
            ))
            risk_score += 10.0
            recommendations.append(
                "Run surprise shelf count and verify that restock source documents exist for each rapid restock event."
            )

        # Rule 5: Product is zero on hand without recent sales trail.
        if current_qty == 0 and sales_qty == 0 and negative_adjustment_qty >= 5:
            anomalies.append(self._build_detected_anomaly(
                outlet_id=outlet_id,
                anomaly_type=AnomalyType.SUSPICIOUS_ACTIVITY,
                related_entity="inventory",
                related_id=product_id,
                description=f"{product_name}: out-of-stock state appears to come from adjustments, not sales.",
                severity=AnomalySeverity.MEDIUM,
                ai_confidence=82.0,
                reasoning_summary=(
                    "AI observed stock depletion without matching sales activity, "
                    "which can indicate shrinkage, internal diversion, or receiving/reporting gaps."
                ),
                signals=[
                    f"product={product_name}",
                    f"current_qty={current_qty}",
                    f"sales_qty_90d={sales_qty}",
                    f"neg_adjust_qty_90d={negative_adjustment_qty}",
                ],
            ))
            risk_score += 11.0
            recommendations.append(
                "Investigate receiving records, wastage logs, and staff handling for this SKU."
            )

        recommendations = self._dedupe_recommendations(recommendations)
        return {
            "anomalies": anomalies,
            "risk_score": min(100.0, risk_score),
            "recommendations": recommendations,
        }

    async def _analyze_outlet_inventory_anomalies(self, outlet_id: str) -> Dict[str, Any]:
        """Outlet-wide inventory theft patterns for supermarkets/pharmacies."""
        anomalies: List[AnomalyResponse] = []
        risk_score = 0.0
        recommendations: List[str] = []

        products_result = self.supabase.table(Tables.POS_PRODUCTS).select(
            "id,name,sku,category,quantity_on_hand,is_active"
        ).eq("outlet_id", outlet_id).limit(5000).execute()
        products = products_result.data or []
        if not products:
            return {
                "anomalies": [],
                "risk_score": 0.0,
                "recommendations": ["No products found for outlet inventory anomaly analysis."],
            }

        active_products = [row for row in products if bool(row.get("is_active", True))]
        out_of_stock = [row for row in active_products if self._safe_int(row.get("quantity_on_hand")) <= 0]
        out_of_stock_ratio = len(out_of_stock) / max(1, len(active_products))
        product_map = {str(row.get("id")): row for row in products if row.get("id")}

        movements = self._load_stock_movements(
            outlet_id=outlet_id,
            since=datetime.now() - timedelta(days=30),
            limit=5000,
        )

        oversell_events = []
        negative_adjustment_qty = 0
        sales_qty = 0
        adjustment_by_category: Dict[str, int] = {}

        for row in movements:
            movement_type = str(row.get("movement_type") or "").lower()
            quantity_change = self._safe_int(row.get("quantity_change"))
            quantity_before = self._safe_int(row.get("quantity_before"))
            product_id = str(row.get("product_id") or "")
            product_meta = product_map.get(product_id, {})
            category = str(product_meta.get("category") or "uncategorized").strip() or "uncategorized"

            if movement_type == "sale" and quantity_change < 0:
                sales_qty += abs(quantity_change)
                if quantity_before <= 0:
                    oversell_events.append(row)

            if movement_type == "adjustment" and quantity_change < 0:
                shrink_qty = abs(quantity_change)
                negative_adjustment_qty += shrink_qty
                adjustment_by_category[category] = adjustment_by_category.get(category, 0) + shrink_qty

        if out_of_stock_ratio >= 0.30:
            severity = AnomalySeverity.HIGH if out_of_stock_ratio >= 0.45 else AnomalySeverity.MEDIUM
            anomalies.append(self._build_detected_anomaly(
                outlet_id=outlet_id,
                anomaly_type=AnomalyType.UNUSUAL_PATTERN,
                related_entity="inventory",
                related_id=outlet_id,
                description="Outlet has an unusually high out-of-stock ratio on active products.",
                severity=severity,
                ai_confidence=min(94.0, 70.0 + min(out_of_stock_ratio * 40.0, 20.0)),
                reasoning_summary=(
                    "AI detected broad stock availability stress. In Nigerian retail this often correlates "
                    "with shrinkage, receiving delays, and transfer leakages."
                ),
                signals=[
                    f"active_products={len(active_products)}",
                    f"out_of_stock_products={len(out_of_stock)}",
                    f"out_of_stock_ratio={out_of_stock_ratio:.2%}",
                ],
            ))
            risk_score += 18.0 if severity == AnomalySeverity.HIGH else 10.0
            recommendations.append(
                "Start department-by-department cycle counts and enforce same-day posting for all goods received."
            )

        if oversell_events:
            oversell_by_product: Dict[str, int] = {}
            for row in oversell_events:
                product_id = str(row.get("product_id") or "unknown")
                oversell_by_product[product_id] = oversell_by_product.get(product_id, 0) + abs(self._safe_int(row.get("quantity_change")))

            top_products = sorted(
                oversell_by_product.items(),
                key=lambda item: item[1],
                reverse=True,
            )[:5]
            top_labels = []
            for product_id, qty in top_products:
                meta = product_map.get(product_id, {})
                label = str(meta.get("name") or meta.get("sku") or product_id)
                top_labels.append(f"{label}:{qty}")

            anomalies.append(self._build_detected_anomaly(
                outlet_id=outlet_id,
                anomaly_type=AnomalyType.SUSPICIOUS_ACTIVITY,
                related_entity="inventory",
                related_id=outlet_id,
                description="Sales are being posted for items already at zero stock.",
                severity=AnomalySeverity.CRITICAL if len(oversell_events) >= 10 else AnomalySeverity.HIGH,
                ai_confidence=min(98.0, 78.0 + min(len(oversell_events) * 1.5, 15.0)),
                reasoning_summary=(
                    "AI detected stockout sales leakage pattern across multiple SKUs."
                ),
                signals=[
                    f"oversell_events={len(oversell_events)}",
                    f"top_products={', '.join(top_labels) if top_labels else 'n/a'}",
                ],
            ))
            risk_score += 30.0 if len(oversell_events) >= 10 else 22.0
            recommendations.append(
                "Hard-block sales when quantity_before is zero unless manager-approved emergency override is captured."
            )

        adjustment_ratio = negative_adjustment_qty / max(1, sales_qty)
        if negative_adjustment_qty >= 50 and adjustment_ratio >= 0.15:
            dominant_category = None
            dominant_share = 0.0
            if adjustment_by_category:
                dominant_category, dominant_qty = max(adjustment_by_category.items(), key=lambda item: item[1])
                dominant_share = dominant_qty / max(1, negative_adjustment_qty)

            anomalies.append(self._build_detected_anomaly(
                outlet_id=outlet_id,
                anomaly_type=AnomalyType.SUSPICIOUS_ACTIVITY,
                related_entity="inventory",
                related_id=outlet_id,
                description="Negative stock adjustments are materially high versus sales volume.",
                severity=AnomalySeverity.HIGH if adjustment_ratio >= 0.25 else AnomalySeverity.MEDIUM,
                ai_confidence=min(96.0, 72.0 + min(adjustment_ratio * 35.0, 18.0)),
                reasoning_summary=(
                    "AI detected shrinkage-like adjustment behavior; this is a common internal-loss signature in supermarkets."
                ),
                signals=[
                    f"negative_adjustment_qty={negative_adjustment_qty}",
                    f"sales_qty={sales_qty}",
                    f"adjustment_ratio={adjustment_ratio:.2f}",
                    *( [f"dominant_category={dominant_category}", f"dominant_share={dominant_share:.2%}"] if dominant_category else [] ),
                ],
            ))
            risk_score += 18.0
            recommendations.append(
                "Require manager+supervisor dual sign-off for shrinkage adjustments in high-risk departments."
            )

        recommendations = self._dedupe_recommendations(recommendations)
        return {
            "anomalies": anomalies,
            "risk_score": min(100.0, risk_score),
            "recommendations": recommendations,
        }

    def _resolve_inventory_product(self, outlet_id: str, entity_id: str) -> Optional[Dict[str, Any]]:
        """Resolve inventory target by product ID, SKU, or barcode."""
        target = str(entity_id or "").strip()
        if not target:
            return None

        # 1) Product ID exact match
        result = self.supabase.table(Tables.POS_PRODUCTS).select(
            "id,name,sku,barcode,category,quantity_on_hand,is_active"
        ).eq("outlet_id", outlet_id).eq("id", target).limit(1).execute()
        if result.data:
            return result.data[0]

        # 2) SKU exact match
        result = self.supabase.table(Tables.POS_PRODUCTS).select(
            "id,name,sku,barcode,category,quantity_on_hand,is_active"
        ).eq("outlet_id", outlet_id).eq("sku", target).limit(1).execute()
        if result.data:
            return result.data[0]

        # 3) Barcode exact match
        result = self.supabase.table(Tables.POS_PRODUCTS).select(
            "id,name,sku,barcode,category,quantity_on_hand,is_active"
        ).eq("outlet_id", outlet_id).eq("barcode", target).limit(1).execute()
        if result.data:
            return result.data[0]

        return None

    def _load_stock_movements(
        self,
        outlet_id: str,
        product_id: Optional[str] = None,
        since: Optional[datetime] = None,
        limit: int = 1000,
    ) -> List[Dict[str, Any]]:
        """Load stock movements with compatibility fallback for table naming drift."""
        table_candidates = ["pos_stock_movements", Tables.STOCK_MOVEMENTS]
        last_error: Optional[Exception] = None

        for table_name in table_candidates:
            try:
                query = self.supabase.table(table_name).select("*").eq("outlet_id", outlet_id)
                if product_id:
                    query = query.eq("product_id", product_id)
                if since:
                    query = query.gte("movement_date", since.isoformat())
                query = query.order("movement_date", desc=True).limit(limit)
                response = query.execute()
                return response.data or []
            except Exception as exc:
                last_error = exc
                continue

        if last_error:
            logger.warning("Unable to load stock movements for anomaly analysis: %s", last_error)
        return []

    def _build_detected_anomaly(
        self,
        outlet_id: str,
        anomaly_type: AnomalyType,
        related_entity: str,
        related_id: str,
        description: str,
        severity: AnomalySeverity,
        ai_confidence: float,
        reasoning_summary: str,
        signals: Optional[List[str]] = None,
    ) -> AnomalyResponse:
        now = datetime.now()
        return AnomalyResponse(
            id=f"anomaly_{uuid4()}",
            outlet_id=outlet_id,
            type=anomaly_type,
            related_entity=related_entity,
            related_id=str(related_id),
            description=description,
            severity=severity,
            ai_confidence=round(max(0.0, min(100.0, ai_confidence)), 2),
            ai_reasoning=self._compose_reasoning(reasoning_summary, signals or []),
            detected_at=now,
            resolved=False,
            resolved_by=None,
            resolved_at=None,
            resolution_notes=None,
            created_at=now,
            updated_at=now,
        )

    def _build_detection_summary(self, entity_type: str, anomalies: List[AnomalyResponse], risk_score: float) -> str:
        if not anomalies:
            return (
                f"No high-risk anomaly signals detected for {entity_type}. "
                "AI checks were executed against historical baselines and consistency rules."
            )

        severity_counts: Dict[str, int] = {}
        for anomaly in anomalies:
            key = anomaly.severity.value if hasattr(anomaly.severity, "value") else str(anomaly.severity)
            severity_counts[key] = severity_counts.get(key, 0) + 1

        severity_summary = ", ".join(
            f"{count} {severity}" for severity, count in sorted(severity_counts.items(), key=lambda item: item[0])
        )
        return (
            f"AI detected {len(anomalies)} anomaly signal(s) for {entity_type} "
            f"({severity_summary}). Aggregate risk score: {risk_score:.2f}/100."
        )

    def _compose_reasoning(self, summary: str, signals: List[str]) -> str:
        if not signals:
            return summary
        return f"{summary} Signals: " + "; ".join(signals)

    def _safe_float(self, value: Any, default: float = 0.0) -> float:
        if value is None:
            return default
        if isinstance(value, bool):
            return default
        try:
            return float(value)
        except (TypeError, ValueError):
            return default

    def _safe_int(self, value: Any, default: int = 0) -> int:
        if value is None:
            return default
        if isinstance(value, bool):
            return default
        try:
            return int(float(value))
        except (TypeError, ValueError):
            return default

    def _extract_reason_text(self, notes: Any) -> str:
        """Extract human-readable reason text from notes payload."""
        if notes is None:
            return ""

        if isinstance(notes, dict):
            reason = str(notes.get("reason") or "").strip()
            extra = str(notes.get("notes") or "").strip()
            return f"{reason} {extra}".strip()

        raw = str(notes).strip()
        if not raw:
            return ""

        if raw.startswith("{") or raw.startswith("["):
            try:
                parsed = json.loads(raw)
                if isinstance(parsed, dict):
                    reason = str(parsed.get("reason") or "").strip()
                    extra = str(parsed.get("notes") or "").strip()
                    return f"{reason} {extra}".strip()
            except Exception:
                return raw

        return raw

    def _safe_datetime(self, value: Any) -> Optional[datetime]:
        if value is None:
            return None
        if isinstance(value, datetime):
            return value

        raw = str(value).strip()
        if not raw:
            return None

        # Normalize ISO Z format for datetime.fromisoformat
        if raw.endswith("Z"):
            raw = raw[:-1] + "+00:00"

        try:
            return datetime.fromisoformat(raw)
        except ValueError:
            return None

    def _first_numeric(self, row: Dict[str, Any], keys: List[str], default: float = 0.0) -> float:
        for key in keys:
            if key in row and row.get(key) is not None:
                return self._safe_float(row.get(key), default=default)
        return default

    def _hours_apart(self, left: Optional[datetime], right: Optional[datetime]) -> float:
        if not left or not right:
            return 1e9
        return abs((left - right).total_seconds()) / 3600.0

    def _median(self, values: List[float]) -> float:
        clean = sorted(v for v in values if isinstance(v, (int, float)) and not math.isnan(v))
        n = len(clean)
        if n == 0:
            return 0.0
        mid = n // 2
        if n % 2 == 1:
            return float(clean[mid])
        return float((clean[mid - 1] + clean[mid]) / 2.0)

    def _stddev(self, values: List[float]) -> float:
        clean = [v for v in values if isinstance(v, (int, float)) and not math.isnan(v)]
        n = len(clean)
        if n < 2:
            return 0.0
        mean = sum(clean) / n
        variance = sum((v - mean) ** 2 for v in clean) / (n - 1)
        return math.sqrt(max(variance, 0.0))

    def _week_start_iso(self, dt: datetime) -> str:
        week_start = dt.date() - timedelta(days=dt.weekday())
        return week_start.isoformat()

    def _dedupe_recommendations(self, recommendations: List[str]) -> List[str]:
        seen = set()
        result = []
        for recommendation in recommendations:
            text = (recommendation or "").strip()
            if not text:
                continue
            key = text.lower()
            if key in seen:
                continue
            seen.add(key)
            result.append(text)
        return result


# Create service instance
anomaly_service = AnomalyService()
