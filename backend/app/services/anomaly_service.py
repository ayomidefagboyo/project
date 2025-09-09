"""
Anomaly detection service for handling business intelligence and risk analysis
"""

from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from fastapi import HTTPException, status
from app.core.database import get_supabase_admin, Tables
from app.schemas.anomaly import (
    AnomalyCreate, AnomalyUpdate, AnomalyResponse, AnomalyListResponse,
    AnomalyStatsResponse, AnomalyDetectionRequest, AnomalyDetectionResult,
    AnomalyResolutionRequest, AnomalyResolutionResponse, AnomalySearchRequest,
    AnomalySearchResponse, AnomalyTrendResponse, AnomalyType, AnomalySeverity
)
import logging
import random

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
            # Prepare anomaly data
            anomaly_dict = anomaly_data.dict()
            anomaly_dict.update({
                "outlet_id": outlet_id,
                "detected_at": datetime.now().isoformat()
            })
            
            # Insert anomaly
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
            # Build query
            query = self.supabase.table(Tables.ANOMALIES).select("*", count="exact")
            query = query.eq("outlet_id", outlet_id)
            
            # Apply filters
            if anomaly_type:
                query = query.eq("type", anomaly_type)
            if severity:
                query = query.eq("severity", severity)
            if resolved is not None:
                query = query.eq("resolved", resolved)
            
            # Apply pagination
            offset = (page - 1) * size
            query = query.range(offset, offset + size - 1)
            
            # Order by detected_at descending
            query = query.order("detected_at", desc=True)
            
            # Execute query
            response = query.execute()
            
            anomalies = [AnomalyResponse(**anomaly) for anomaly in response.data]
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
            # Check if anomaly exists
            existing = await self.get_anomaly(anomaly_id, outlet_id)
            
            # Prepare update data (only include non-None values)
            update_dict = {k: v for k, v in anomaly_data.dict().items() if v is not None}
            
            if not update_dict:
                return existing
            
            # Update anomaly
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
            # Check if anomaly exists
            await self.get_anomaly(anomaly_id, outlet_id)
            
            # Delete anomaly
            response = self.supabase.table(Tables.ANOMALIES).delete().eq("id", anomaly_id).eq("outlet_id", outlet_id).execute()
            
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
        """Detect anomalies for a specific entity"""
        try:
            anomalies = []
            risk_score = 0.0
            recommendations = []
            
            # Simulate anomaly detection based on entity type
            if detection_request.entity_type == "payment":
                result = await self._analyze_payment_anomalies(outlet_id, detection_request.entity_id)
                anomalies.extend(result["anomalies"])
                risk_score += result["risk_score"]
                recommendations.extend(result["recommendations"])
            
            elif detection_request.entity_type == "invoice":
                result = await self._analyze_invoice_anomalies(outlet_id, detection_request.entity_id)
                anomalies.extend(result["anomalies"])
                risk_score += result["risk_score"]
                recommendations.extend(result["recommendations"])
            
            elif detection_request.entity_type == "eod_report":
                result = await self._analyze_eod_anomalies(outlet_id, detection_request.entity_id)
                anomalies.extend(result["anomalies"])
                risk_score += result["risk_score"]
                recommendations.extend(result["recommendations"])
            
            # Normalize risk score
            risk_score = min(100.0, risk_score)
            
            return AnomalyDetectionResult(
                anomalies=anomalies,
                risk_score=risk_score,
                recommendations=recommendations,
                detection_time=datetime.now(),
                confidence=85.0  # Mock confidence score
            )
            
        except Exception as e:
            logger.error(f"Error detecting anomalies: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to detect anomalies"
            )
    
    async def resolve_anomaly(self, anomaly_id: str, resolution_data: AnomalyResolutionRequest, outlet_id: str, user_id: str) -> AnomalyResolutionResponse:
        """Resolve an anomaly"""
        try:
            # Check if anomaly exists
            anomaly = await self.get_anomaly(anomaly_id, outlet_id)
            
            # Prepare update data
            update_data = {
                "resolved": resolution_data.resolved,
                "resolved_by": user_id,
                "resolved_at": datetime.now().isoformat(),
                "resolution_notes": resolution_data.resolution_notes
            }
            
            # Update anomaly
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
            # Get all anomalies for the outlet
            response = self.supabase.table(Tables.ANOMALIES).select("*").eq("outlet_id", outlet_id).execute()
            
            anomalies = response.data or []
            
            # Calculate statistics
            total_anomalies = len(anomalies)
            unresolved_anomalies = sum(1 for a in anomalies if not a.get("resolved", False))
            critical_anomalies = sum(1 for a in anomalies if a.get("severity") == "critical")
            
            # Calculate risk score based on unresolved anomalies
            risk_score = min(100.0, (unresolved_anomalies / max(1, total_anomalies)) * 100)
            
            # Distribution by type
            type_distribution = {}
            for anomaly in anomalies:
                anomaly_type = anomaly.get("type", "unknown")
                type_distribution[anomaly_type] = type_distribution.get(anomaly_type, 0) + 1
            
            # Distribution by severity
            severity_distribution = {}
            for anomaly in anomalies:
                severity = anomaly.get("severity", "unknown")
                severity_distribution[severity] = severity_distribution.get(severity, 0) + 1
            
            # Resolution rate
            resolved_count = sum(1 for a in anomalies if a.get("resolved", False))
            resolution_rate = (resolved_count / total_anomalies * 100) if total_anomalies > 0 else 0
            
            # Average resolution time (mock calculation)
            resolved_anomalies = [a for a in anomalies if a.get("resolved", False) and a.get("resolved_at")]
            avg_resolution_time = 24.0  # Mock: 24 hours average
            
            return AnomalyStatsResponse(
                total_anomalies=total_anomalies,
                unresolved_anomalies=unresolved_anomalies,
                risk_score=round(risk_score, 2),
                anomalies_by_type=type_distribution,
                anomalies_by_severity=severity_distribution,
                resolution_rate=round(resolution_rate, 2),
                average_resolution_time=avg_resolution_time,
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
            # Build query
            query = self.supabase.table(Tables.ANOMALIES).select("*", count="exact")
            query = query.eq("outlet_id", outlet_id)
            
            # Apply filters
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
            
            # Execute query
            response = query.execute()
            
            anomalies = [AnomalyResponse(**anomaly) for anomaly in response.data]
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
        """Get anomaly trend data"""
        try:
            # Get anomalies for the specified period
            end_date = datetime.now()
            start_date = end_date - timedelta(days=days)
            
            response = self.supabase.table(Tables.ANOMALIES).select("*").eq("outlet_id", outlet_id).gte("detected_at", start_date.isoformat()).execute()
            
            anomalies = response.data or []
            
            # Generate daily counts (mock data for demonstration)
            daily_counts = []
            for i in range(days):
                date = (start_date + timedelta(days=i)).date()
                count = random.randint(0, 5)  # Mock daily count
                daily_counts.append({"date": date.isoformat(), "count": count})
            
            # Generate weekly trend (mock data)
            weekly_trend = []
            for i in range(0, days, 7):
                week_start = (start_date + timedelta(days=i)).date()
                count = random.randint(5, 20)  # Mock weekly count
                weekly_trend.append({"week": week_start.isoformat(), "count": count})
            
            # Generate monthly trend (mock data)
            monthly_trend = []
            for i in range(0, days, 30):
                month_start = (start_date + timedelta(days=i)).date()
                count = random.randint(20, 80)  # Mock monthly count
                monthly_trend.append({"month": month_start.isoformat(), "count": count})
            
            # Generate severity trend (mock data)
            severity_trend = {
                "critical": [{"date": (start_date + timedelta(days=i)).date().isoformat(), "count": random.randint(0, 2)} for i in range(0, days, 7)],
                "high": [{"date": (start_date + timedelta(days=i)).date().isoformat(), "count": random.randint(0, 5)} for i in range(0, days, 7)],
                "medium": [{"date": (start_date + timedelta(days=i)).date().isoformat(), "count": random.randint(0, 10)} for i in range(0, days, 7)],
                "low": [{"date": (start_date + timedelta(days=i)).date().isoformat(), "count": random.randint(0, 15)} for i in range(0, days, 7)]
            }
            
            # Generate type trend (mock data)
            type_trend = {
                "duplicate_payment": [{"date": (start_date + timedelta(days=i)).date().isoformat(), "count": random.randint(0, 3)} for i in range(0, days, 7)],
                "price_spike": [{"date": (start_date + timedelta(days=i)).date().isoformat(), "count": random.randint(0, 2)} for i in range(0, days, 7)],
                "cash_variance": [{"date": (start_date + timedelta(days=i)).date().isoformat(), "count": random.randint(0, 4)} for i in range(0, days, 7)],
                "low_margin": [{"date": (start_date + timedelta(days=i)).date().isoformat(), "count": random.randint(0, 3)} for i in range(0, days, 7)]
            }
            
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
        """Analyze payment-related anomalies (mock implementation)"""
        anomalies = []
        risk_score = 0.0
        recommendations = []
        
        # Mock payment anomaly detection
        if random.random() > 0.7:  # 30% chance of detecting an anomaly
            anomaly = AnomalyResponse(
                id=f"anomaly_{payment_id}_{int(datetime.now().timestamp())}",
                outlet_id=outlet_id,
                type=AnomalyType.DUPLICATE_PAYMENT,
                related_entity="payment",
                related_id=payment_id,
                description="Potential duplicate payment detected",
                severity=AnomalySeverity.MEDIUM,
                detected_at=datetime.now(),
                resolved=False,
                ai_confidence=85.0,
                created_at=datetime.now(),
                updated_at=datetime.now()
            )
            anomalies.append(anomaly)
            risk_score += 30.0
            recommendations.append("Review payment history for duplicates")
        
        return {
            "anomalies": anomalies,
            "risk_score": risk_score,
            "recommendations": recommendations
        }
    
    async def _analyze_invoice_anomalies(self, outlet_id: str, invoice_id: str) -> Dict[str, Any]:
        """Analyze invoice-related anomalies (mock implementation)"""
        anomalies = []
        risk_score = 0.0
        recommendations = []
        
        # Mock invoice anomaly detection
        if random.random() > 0.8:  # 20% chance of detecting an anomaly
            anomaly = AnomalyResponse(
                id=f"anomaly_{invoice_id}_{int(datetime.now().timestamp())}",
                outlet_id=outlet_id,
                type=AnomalyType.PRICE_SPIKE,
                related_entity="invoice",
                related_id=invoice_id,
                description="Unusual price increase detected",
                severity=AnomalySeverity.HIGH,
                detected_at=datetime.now(),
                resolved=False,
                ai_confidence=90.0,
                created_at=datetime.now(),
                updated_at=datetime.now()
            )
            anomalies.append(anomaly)
            risk_score += 40.0
            recommendations.append("Verify vendor pricing and negotiate if needed")
        
        return {
            "anomalies": anomalies,
            "risk_score": risk_score,
            "recommendations": recommendations
        }
    
    async def _analyze_eod_anomalies(self, outlet_id: str, eod_id: str) -> Dict[str, Any]:
        """Analyze EOD report-related anomalies (mock implementation)"""
        anomalies = []
        risk_score = 0.0
        recommendations = []
        
        # Mock EOD anomaly detection
        if random.random() > 0.6:  # 40% chance of detecting an anomaly
            anomaly = AnomalyResponse(
                id=f"anomaly_{eod_id}_{int(datetime.now().timestamp())}",
                outlet_id=outlet_id,
                type=AnomalyType.CASH_VARIANCE,
                related_entity="eod_report",
                related_id=eod_id,
                description="Significant cash variance detected",
                severity=AnomalySeverity.HIGH,
                detected_at=datetime.now(),
                resolved=False,
                ai_confidence=88.0,
                created_at=datetime.now(),
                updated_at=datetime.now()
            )
            anomalies.append(anomaly)
            risk_score += 35.0
            recommendations.append("Investigate cash handling procedures")
        
        return {
            "anomalies": anomalies,
            "risk_score": risk_score,
            "recommendations": recommendations
        }


# Create service instance
anomaly_service = AnomalyService()



