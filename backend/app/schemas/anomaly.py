"""
Pydantic schemas for anomaly detection data validation
"""

from pydantic import BaseModel, Field, validator
from typing import Optional, Dict, Any, List
from datetime import datetime
from enum import Enum


class AnomalyType(str, Enum):
    """Anomaly type enumeration"""
    DUPLICATE_PAYMENT = "duplicate_payment"
    OVERPAYMENT = "overpayment"
    UNDERPAYMENT = "underpayment"
    MISSING_INFORMATION = "missing_information"
    PRICE_SPIKE = "price_spike"
    UNUSUAL_PATTERN = "unusual_pattern"
    CASH_VARIANCE = "cash_variance"
    LOW_MARGIN = "low_margin"
    SUSPICIOUS_ACTIVITY = "suspicious_activity"
    DATA_INCONSISTENCY = "data_inconsistency"


class AnomalySeverity(str, Enum):
    """Anomaly severity enumeration"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class AnomalyBase(BaseModel):
    """Base anomaly schema with common fields"""
    type: AnomalyType = Field(..., description="Type of anomaly")
    related_entity: str = Field(..., max_length=100, description="Related entity type")
    related_id: str = Field(..., max_length=100, description="Related entity ID")
    description: str = Field(..., max_length=1000, description="Anomaly description")
    severity: AnomalySeverity = Field(..., description="Anomaly severity level")
    ai_confidence: Optional[float] = Field(None, ge=0, le=100, description="AI confidence score")

    @validator('description')
    def validate_description(cls, v):
        if not v or not v.strip():
            raise ValueError('Description cannot be empty')
        return v.strip()


class AnomalyCreate(AnomalyBase):
    """Schema for creating a new anomaly"""
    pass


class AnomalyUpdate(BaseModel):
    """Schema for updating an anomaly"""
    description: Optional[str] = Field(None, max_length=1000)
    severity: Optional[AnomalySeverity] = None
    resolved: Optional[bool] = None
    resolution_notes: Optional[str] = Field(None, max_length=1000)
    ai_confidence: Optional[float] = Field(None, ge=0, le=100)

    @validator('description')
    def validate_description(cls, v):
        if v is not None and (not v or not v.strip()):
            raise ValueError('Description cannot be empty')
        return v.strip() if v else None


class AnomalyResponse(AnomalyBase):
    """Schema for anomaly response"""
    id: str = Field(..., description="Anomaly unique identifier")
    outlet_id: str = Field(..., description="Outlet identifier")
    detected_at: datetime = Field(..., description="Detection timestamp")
    resolved: bool = Field(False, description="Whether anomaly is resolved")
    resolved_by: Optional[str] = Field(None, description="User who resolved the anomaly")
    resolved_at: Optional[datetime] = Field(None, description="Resolution timestamp")
    resolution_notes: Optional[str] = Field(None, description="Resolution notes")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")

    class Config:
        from_attributes = True


class AnomalyListResponse(BaseModel):
    """Schema for anomaly list response with pagination"""
    items: List[AnomalyResponse] = Field(..., description="List of anomalies")
    total: int = Field(..., description="Total number of anomalies")
    page: int = Field(..., description="Current page number")
    size: int = Field(..., description="Page size")
    pages: int = Field(..., description="Total number of pages")


class AnomalyStatsResponse(BaseModel):
    """Schema for anomaly statistics response"""
    total_anomalies: int = Field(..., description="Total number of anomalies")
    unresolved_anomalies: int = Field(..., description="Number of unresolved anomalies")
    risk_score: float = Field(..., ge=0, le=100, description="Overall risk score")
    anomalies_by_type: Dict[str, int] = Field(..., description="Distribution by type")
    anomalies_by_severity: Dict[str, int] = Field(..., description="Distribution by severity")
    resolution_rate: float = Field(..., ge=0, le=100, description="Resolution rate percentage")
    average_resolution_time: Optional[float] = Field(None, description="Average resolution time in hours")
    critical_anomalies: int = Field(..., description="Number of critical anomalies")


class AnomalyDetectionRequest(BaseModel):
    """Schema for anomaly detection request"""
    entity_type: str = Field(..., description="Type of entity to analyze")
    entity_id: str = Field(..., description="ID of entity to analyze")
    force_detection: bool = Field(False, description="Force detection even if recently analyzed")


class AnomalyDetectionResult(BaseModel):
    """Schema for anomaly detection result"""
    anomalies: List[AnomalyResponse] = Field(..., description="Detected anomalies")
    risk_score: float = Field(..., ge=0, le=100, description="Overall risk score")
    recommendations: List[str] = Field(..., description="AI recommendations")
    detection_time: datetime = Field(..., description="Detection timestamp")
    confidence: float = Field(..., ge=0, le=100, description="Detection confidence")


class AnomalyResolutionRequest(BaseModel):
    """Schema for anomaly resolution request"""
    resolved: bool = Field(True, description="Whether to resolve or mark as false positive")
    resolution_notes: Optional[str] = Field(None, max_length=1000, description="Resolution notes")
    false_positive: bool = Field(False, description="Whether this is a false positive")


class AnomalyResolutionResponse(BaseModel):
    """Schema for anomaly resolution response"""
    anomaly_id: str = Field(..., description="Anomaly ID")
    resolved: bool = Field(..., description="Resolution status")
    resolved_by: str = Field(..., description="User who resolved the anomaly")
    resolved_at: datetime = Field(..., description="Resolution timestamp")
    resolution_notes: Optional[str] = Field(None, description="Resolution notes")


class AnomalySearchRequest(BaseModel):
    """Schema for anomaly search request"""
    type: Optional[AnomalyType] = Field(None, description="Filter by anomaly type")
    severity: Optional[AnomalySeverity] = Field(None, description="Filter by severity")
    resolved: Optional[bool] = Field(None, description="Filter by resolution status")
    related_entity: Optional[str] = Field(None, description="Filter by related entity type")
    date_from: Optional[datetime] = Field(None, description="Filter by detection date from")
    date_to: Optional[datetime] = Field(None, description="Filter by detection date to")
    min_confidence: Optional[float] = Field(None, ge=0, le=100, description="Minimum AI confidence")
    limit: int = Field(10, ge=1, le=100, description="Maximum number of results")


class AnomalySearchResponse(BaseModel):
    """Schema for anomaly search response"""
    items: List[AnomalyResponse] = Field(..., description="Search results")
    total: int = Field(..., description="Total number of results")
    query: Dict[str, Any] = Field(..., description="Search query used")


class AnomalyTrendResponse(BaseModel):
    """Schema for anomaly trend response"""
    daily_counts: List[Dict[str, Any]] = Field(..., description="Daily anomaly counts")
    weekly_trend: List[Dict[str, Any]] = Field(..., description="Weekly trend data")
    monthly_trend: List[Dict[str, Any]] = Field(..., description="Monthly trend data")
    severity_trend: Dict[str, List[Dict[str, Any]]] = Field(..., description="Trend by severity")
    type_trend: Dict[str, List[Dict[str, Any]]] = Field(..., description="Trend by type")


class AnomalyAlert(BaseModel):
    """Schema for anomaly alert"""
    id: str = Field(..., description="Alert unique identifier")
    anomaly_id: str = Field(..., description="Related anomaly ID")
    alert_type: str = Field(..., description="Type of alert")
    message: str = Field(..., description="Alert message")
    severity: AnomalySeverity = Field(..., description="Alert severity")
    created_at: datetime = Field(..., description="Alert creation timestamp")
    acknowledged: bool = Field(False, description="Whether alert is acknowledged")
    acknowledged_by: Optional[str] = Field(None, description="User who acknowledged")
    acknowledged_at: Optional[datetime] = Field(None, description="Acknowledgment timestamp")


class AnomalyRecommendation(BaseModel):
    """Schema for anomaly recommendation"""
    id: str = Field(..., description="Recommendation unique identifier")
    anomaly_id: str = Field(..., description="Related anomaly ID")
    recommendation_type: str = Field(..., description="Type of recommendation")
    title: str = Field(..., description="Recommendation title")
    description: str = Field(..., description="Recommendation description")
    priority: str = Field(..., description="Recommendation priority")
    estimated_impact: str = Field(..., description="Estimated impact")
    implementation_steps: List[str] = Field(..., description="Implementation steps")
    created_at: datetime = Field(..., description="Creation timestamp")
    implemented: bool = Field(False, description="Whether recommendation is implemented")
    implemented_by: Optional[str] = Field(None, description="User who implemented")
    implemented_at: Optional[datetime] = Field(None, description="Implementation timestamp")


class AnomalyDashboardResponse(BaseModel):
    """Schema for anomaly dashboard response"""
    stats: AnomalyStatsResponse = Field(..., description="Anomaly statistics")
    recent_anomalies: List[AnomalyResponse] = Field(..., description="Recent anomalies")
    critical_anomalies: List[AnomalyResponse] = Field(..., description="Critical anomalies")
    trends: AnomalyTrendResponse = Field(..., description="Trend data")
    alerts: List[AnomalyAlert] = Field(..., description="Active alerts")
    recommendations: List[AnomalyRecommendation] = Field(..., description="Active recommendations")















