"""
Anomaly detection endpoints
"""

from fastapi import APIRouter, HTTPException, status, Depends, Query
from typing import Optional, Dict, Any
from app.schemas.anomaly import (
    AnomalyCreate, AnomalyUpdate, AnomalyResponse, AnomalyListResponse,
    AnomalyStatsResponse, AnomalyDetectionRequest, AnomalyDetectionResult,
    AnomalyResolutionRequest, AnomalyResolutionResponse, AnomalySearchRequest,
    AnomalySearchResponse, AnomalyTrendResponse
)
from app.services.anomaly_service import anomaly_service
from app.core.security import require_auth, get_user_outlet_id, require_permissions

router = APIRouter()


@router.post("/", response_model=AnomalyResponse, status_code=status.HTTP_201_CREATED)
async def create_anomaly(
    anomaly_data: AnomalyCreate,
    current_user: Dict[str, Any] = Depends(require_permissions(["manage_anomalies"]))
):
    """
    Create a new anomaly record
    
    Creates a new anomaly record for the current user's outlet
    """
    try:
        outlet_id = get_user_outlet_id(current_user)
        anomaly = await anomaly_service.create_anomaly(anomaly_data, outlet_id)
        return anomaly
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create anomaly"
        )


@router.get("/", response_model=AnomalyListResponse)
async def get_anomalies(
    page: int = Query(1, ge=1, description="Page number"),
    size: int = Query(20, ge=1, le=100, description="Page size"),
    type: Optional[str] = Query(None, description="Filter by anomaly type"),
    severity: Optional[str] = Query(None, description="Filter by severity"),
    resolved: Optional[bool] = Query(None, description="Filter by resolution status"),
    current_user: Dict[str, Any] = Depends(require_permissions(["view_anomalies"]))
):
    """
    Get anomalies with pagination and filtering
    
    Returns a paginated list of anomalies for the current user's outlet
    """
    try:
        outlet_id = get_user_outlet_id(current_user)
        result = await anomaly_service.get_anomalies(
            outlet_id=outlet_id,
            page=page,
            size=size,
            anomaly_type=type,
            severity=severity,
            resolved=resolved
        )
        return AnomalyListResponse(**result)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get anomalies"
        )


@router.get("/{anomaly_id}", response_model=AnomalyResponse)
async def get_anomaly(
    anomaly_id: str,
    current_user: Dict[str, Any] = Depends(require_permissions(["view_anomalies"]))
):
    """
    Get a specific anomaly by ID
    
    Returns anomaly details for the specified anomaly
    """
    try:
        outlet_id = get_user_outlet_id(current_user)
        anomaly = await anomaly_service.get_anomaly(anomaly_id, outlet_id)
        return anomaly
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get anomaly"
        )


@router.put("/{anomaly_id}", response_model=AnomalyResponse)
async def update_anomaly(
    anomaly_id: str,
    anomaly_data: AnomalyUpdate,
    current_user: Dict[str, Any] = Depends(require_permissions(["manage_anomalies"]))
):
    """
    Update an anomaly
    
    Updates anomaly information for the specified anomaly
    """
    try:
        outlet_id = get_user_outlet_id(current_user)
        anomaly = await anomaly_service.update_anomaly(anomaly_id, anomaly_data, outlet_id)
        return anomaly
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update anomaly"
        )


@router.delete("/{anomaly_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_anomaly(
    anomaly_id: str,
    current_user: Dict[str, Any] = Depends(require_permissions(["manage_anomalies"]))
):
    """
    Delete an anomaly
    
    Permanently deletes the specified anomaly
    """
    try:
        outlet_id = get_user_outlet_id(current_user)
        await anomaly_service.delete_anomaly(anomaly_id, outlet_id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete anomaly"
        )


@router.post("/detect", response_model=AnomalyDetectionResult)
async def detect_anomalies(
    detection_request: AnomalyDetectionRequest,
    current_user: Dict[str, Any] = Depends(require_permissions(["view_anomalies"]))
):
    """
    Detect anomalies for a specific entity
    
    Analyzes the specified entity for potential anomalies and returns detection results
    """
    try:
        outlet_id = get_user_outlet_id(current_user)
        result = await anomaly_service.detect_anomalies(detection_request, outlet_id)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to detect anomalies"
        )


@router.post("/{anomaly_id}/resolve", response_model=AnomalyResolutionResponse)
async def resolve_anomaly(
    anomaly_id: str,
    resolution_data: AnomalyResolutionRequest,
    current_user: Dict[str, Any] = Depends(require_permissions(["manage_anomalies"]))
):
    """
    Resolve an anomaly
    
    Marks an anomaly as resolved with optional resolution notes
    """
    try:
        outlet_id = get_user_outlet_id(current_user)
        result = await anomaly_service.resolve_anomaly(
            anomaly_id, resolution_data, outlet_id, current_user["id"]
        )
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to resolve anomaly"
        )


@router.get("/stats/overview", response_model=AnomalyStatsResponse)
async def get_anomaly_stats(
    current_user: Dict[str, Any] = Depends(require_permissions(["view_anomalies"]))
):
    """
    Get anomaly statistics overview
    
    Returns summary statistics for all anomalies in the current outlet
    """
    try:
        outlet_id = get_user_outlet_id(current_user)
        stats = await anomaly_service.get_anomaly_stats(outlet_id)
        return stats
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get anomaly statistics"
        )


@router.get("/trends/analysis", response_model=AnomalyTrendResponse)
async def get_anomaly_trends(
    days: int = Query(30, ge=1, le=365, description="Number of days to analyze"),
    current_user: Dict[str, Any] = Depends(require_permissions(["view_anomalies"]))
):
    """
    Get anomaly trend analysis
    
    Returns trend data for anomalies over the specified period
    """
    try:
        outlet_id = get_user_outlet_id(current_user)
        trends = await anomaly_service.get_anomaly_trends(outlet_id, days)
        return trends
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get anomaly trends"
        )


@router.post("/search", response_model=AnomalySearchResponse)
async def search_anomalies(
    search_request: AnomalySearchRequest,
    current_user: Dict[str, Any] = Depends(require_permissions(["view_anomalies"]))
):
    """
    Search anomalies with advanced filters
    
    Performs advanced search across anomalies with multiple filters
    """
    try:
        outlet_id = get_user_outlet_id(current_user)
        result = await anomaly_service.search_anomalies(search_request, outlet_id)
        return AnomalySearchResponse(**result)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to search anomalies"
        )


@router.get("/critical/alerts")
async def get_critical_anomalies(
    limit: int = Query(10, ge=1, le=50, description="Maximum number of critical anomalies"),
    current_user: Dict[str, Any] = Depends(require_permissions(["view_anomalies"]))
):
    """
    Get critical anomalies requiring immediate attention
    
    Returns unresolved critical and high-severity anomalies
    """
    try:
        outlet_id = get_user_outlet_id(current_user)
        
        # Get critical and high severity unresolved anomalies
        critical_result = await anomaly_service.get_anomalies(
            outlet_id=outlet_id,
            page=1,
            size=limit,
            severity="critical",
            resolved=False
        )
        
        high_result = await anomaly_service.get_anomalies(
            outlet_id=outlet_id,
            page=1,
            size=limit,
            severity="high",
            resolved=False
        )
        
        # Combine and sort by detected_at
        all_critical = critical_result["items"] + high_result["items"]
        all_critical.sort(key=lambda x: x.detected_at, reverse=True)
        
        return {
            "critical_anomalies": all_critical[:limit],
            "total_critical": len(all_critical),
            "requires_attention": len(all_critical) > 0
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get critical anomalies"
        )


@router.get("/dashboard/summary")
async def get_anomaly_dashboard(
    current_user: Dict[str, Any] = Depends(require_permissions(["view_anomalies"]))
):
    """
    Get anomaly dashboard summary
    
    Returns comprehensive dashboard data for anomaly management
    """
    try:
        outlet_id = get_user_outlet_id(current_user)
        
        # Get stats
        stats = await anomaly_service.get_anomaly_stats(outlet_id)
        
        # Get recent anomalies
        recent_result = await anomaly_service.get_anomalies(
            outlet_id=outlet_id,
            page=1,
            size=10,
            resolved=False
        )
        
        # Get critical anomalies
        critical_result = await anomaly_service.get_anomalies(
            outlet_id=outlet_id,
            page=1,
            size=5,
            severity="critical",
            resolved=False
        )
        
        # Get trends
        trends = await anomaly_service.get_anomaly_trends(outlet_id, 30)
        
        return {
            "stats": stats,
            "recent_anomalies": recent_result["items"],
            "critical_anomalies": critical_result["items"],
            "trends": trends,
            "alerts": [],  # Mock alerts
            "recommendations": []  # Mock recommendations
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get anomaly dashboard"
        )


@router.post("/bulk-resolve")
async def bulk_resolve_anomalies(
    anomaly_ids: list[str],
    resolution_data: AnomalyResolutionRequest,
    current_user: Dict[str, Any] = Depends(require_permissions(["manage_anomalies"]))
):
    """
    Bulk resolve multiple anomalies
    
    Resolves multiple anomalies with the same resolution data
    """
    try:
        outlet_id = get_user_outlet_id(current_user)
        resolved_anomalies = []
        
        for anomaly_id in anomaly_ids:
            try:
                result = await anomaly_service.resolve_anomaly(
                    anomaly_id, resolution_data, outlet_id, current_user["id"]
                )
                resolved_anomalies.append(result)
            except HTTPException as e:
                if e.status_code == 404:
                    continue  # Skip non-existent anomalies
                raise
        
        return {
            "resolved_count": len(resolved_anomalies),
            "total_requested": len(anomaly_ids),
            "resolved_anomalies": resolved_anomalies
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to bulk resolve anomalies"
        )




