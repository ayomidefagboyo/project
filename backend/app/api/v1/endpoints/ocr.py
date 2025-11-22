"""
OCR and file upload endpoints
"""

from fastapi import APIRouter, HTTPException, status, Depends, UploadFile, File, Form
from typing import Optional, Dict, Any, List
from app.schemas.ocr import (
    OCRProcessingRequest, OCRProcessingResponse, OCRStatsResponse,
    OCRReviewRequest, OCRReviewResponse, FileUploadResponse, FileListResponse,
    FileSearchRequest, FileSearchResponse
)
from app.services.ocr_service import ocr_service
from app.core.security import require_auth, get_user_outlet_id, require_permissions
from app.core.database import get_supabase_admin, Tables
import uuid
import time

router = APIRouter()


@router.post("/process", response_model=OCRProcessingResponse)
async def process_document_ocr(
    file_url: str = Form(..., description="URL of the file to process"),
    file_type: str = Form(..., description="Type of file (image/pdf)"),
    enable_google_vision: bool = Form(True, description="Whether to use Google Vision API"),
    extract_invoice_data: bool = Form(True, description="Whether to extract invoice-specific data"),
    current_user: Dict[str, Any] = Depends(require_permissions(["manage_invoices"]))
):
    """
    Process a document with OCR
    
    Extracts text and structured data from uploaded documents
    """
    try:
        request = OCRProcessingRequest(
            file_url=file_url,
            file_type=file_type,
            enable_google_vision=enable_google_vision,
            extract_invoice_data=extract_invoice_data
        )
        
        result = await ocr_service.process_document(request)
        return result
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process document: {str(e)}"
        )


@router.post("/upload", response_model=FileUploadResponse)
async def upload_file(
    file: UploadFile = File(..., description="File to upload"),
    bucket: str = Form("invoices", description="Storage bucket name"),
    enable_ocr: bool = Form(False, description="Whether to enable OCR processing"),
    current_user: Dict[str, Any] = Depends(require_permissions(["manage_invoices"]))
):
    """
    Upload a file to storage
    
    Uploads a file to Supabase Storage and optionally processes it with OCR
    """
    try:
        outlet_id = get_user_outlet_id(current_user)
        
        # Validate file
        if not file.filename:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No file provided"
            )
        
        # Generate unique file path
        file_ext = file.filename.split('.')[-1] if '.' in file.filename else ''
        file_id = str(uuid.uuid4())
        file_name = f"{file_id}.{file_ext}" if file_ext else file_id
        file_path = f"{outlet_id}/{file_name}"
        
        # Read file content
        file_content = await file.read()
        file_size = len(file_content)
        
        # Upload to Supabase Storage
        supabase = get_supabase_admin()
        upload_result = supabase.storage.from_(bucket).upload(
            file_path, 
            file_content,
            file_options={
                "content-type": file.content_type or "application/octet-stream"
            }
        )
        
        if upload_result.get("error"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to upload file: {upload_result['error']}"
            )
        
        # Get public URL
        public_url_result = supabase.storage.from_(bucket).get_public_url(file_path)
        public_url = public_url_result.get("publicURL")
        
        if not public_url:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to get public URL"
            )
        
        # Create file record in database
        file_record = {
            "id": file_id,
            "outlet_id": outlet_id,
            "file_name": file.filename,
            "file_path": file_path,
            "file_url": public_url,
            "original_file_url": public_url,
            "file_size": file_size,
            "file_type": file.content_type or "application/octet-stream",
            "bucket": bucket,
            "uploaded_by": current_user["id"]
        }
        
        supabase.table(Tables.FILES).insert(file_record).execute()
        
        # Process OCR if enabled
        ocr_processing_id = None
        if enable_ocr and file.content_type and file.content_type.startswith('image/'):
            ocr_request = OCRProcessingRequest(
                file_url=public_url,
                file_type=file.content_type,
                enable_google_vision=True,
                extract_invoice_data=True
            )
            ocr_result = await ocr_service.process_document(ocr_request)
            ocr_processing_id = ocr_result.id
        
        return FileUploadResponse(
            file_id=file_id,
            file_url=public_url,
            original_file_url=public_url,
            file_name=file.filename,
            file_size=file_size,
            file_type=file.content_type or "application/octet-stream",
            bucket=bucket,
            ocr_processing_id=ocr_processing_id,
            created_at=time.time()
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload file: {str(e)}"
        )


@router.get("/files", response_model=FileListResponse)
async def get_files(
    page: int = 1,
    size: int = 20,
    bucket: Optional[str] = None,
    file_type: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(require_permissions(["view_invoices"]))
):
    """
    Get uploaded files with pagination
    
    Returns a paginated list of uploaded files
    """
    try:
        outlet_id = get_user_outlet_id(current_user)
        supabase = get_supabase_admin()
        
        # Build query
        query = supabase.table(Tables.FILES).select("*", count="exact")
        query = query.eq("outlet_id", outlet_id)
        
        if bucket:
            query = query.eq("bucket", bucket)
        
        if file_type:
            query = query.like("file_type", f"{file_type}%")
        
        # Apply pagination
        offset = (page - 1) * size
        query = query.range(offset, offset + size - 1)
        
        # Execute query
        response = query.execute()
        
        files = []
        for file_data in response.data or []:
            files.append(FileUploadResponse(
                file_id=file_data["id"],
                file_url=file_data["file_url"],
                original_file_url=file_data["original_file_url"],
                file_name=file_data["file_name"],
                file_size=file_data["file_size"],
                file_type=file_data["file_type"],
                bucket=file_data["bucket"],
                ocr_processing_id=file_data.get("ocr_processing_id"),
                created_at=file_data["created_at"]
            ))
        
        total = response.count or 0
        pages = (total + size - 1) // size
        
        return FileListResponse(
            files=files,
            total=total,
            page=page,
            size=size,
            pages=pages
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get files: {str(e)}"
        )


@router.post("/review", response_model=OCRReviewResponse)
async def review_ocr_result(
    review_request: OCRReviewRequest,
    current_user: Dict[str, Any] = Depends(require_permissions(["manage_invoices"]))
):
    """
    Review OCR processing result
    
    Approve or reject OCR extracted data with optional corrections
    """
    try:
        result = await ocr_service.review_ocr_result(review_request, current_user["id"])
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to review OCR result: {str(e)}"
        )


@router.get("/stats", response_model=OCRStatsResponse)
async def get_ocr_stats(
    current_user: Dict[str, Any] = Depends(require_permissions(["view_invoices"]))
):
    """
    Get OCR processing statistics
    
    Returns statistics about OCR processing performance
    """
    try:
        outlet_id = get_user_outlet_id(current_user)
        stats = await ocr_service.get_ocr_stats(outlet_id)
        return stats
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get OCR statistics: {str(e)}"
        )


@router.post("/search", response_model=FileSearchResponse)
async def search_files(
    search_request: FileSearchRequest,
    current_user: Dict[str, Any] = Depends(require_permissions(["view_invoices"]))
):
    """
    Search uploaded files
    
    Performs a text search across file names and metadata
    """
    try:
        outlet_id = get_user_outlet_id(current_user)
        supabase = get_supabase_admin()
        
        # Build search query
        query = supabase.table(Tables.FILES).select("*", count="exact")
        query = query.eq("outlet_id", outlet_id)
        
        if search_request.query:
            query = query.ilike("file_name", f"%{search_request.query}%")
        
        if search_request.file_type:
            query = query.like("file_type", f"{search_request.file_type}%")
        
        if search_request.bucket:
            query = query.eq("bucket", search_request.bucket)
        
        if search_request.date_from:
            query = query.gte("created_at", search_request.date_from.isoformat())
        
        if search_request.date_to:
            query = query.lte("created_at", search_request.date_to.isoformat())
        
        query = query.limit(search_request.limit)
        
        # Execute query
        response = query.execute()
        
        files = []
        for file_data in response.data or []:
            files.append(FileUploadResponse(
                file_id=file_data["id"],
                file_url=file_data["file_url"],
                original_file_url=file_data["original_file_url"],
                file_name=file_data["file_name"],
                file_size=file_data["file_size"],
                file_type=file_data["file_type"],
                bucket=file_data["bucket"],
                ocr_processing_id=file_data.get("ocr_processing_id"),
                created_at=file_data["created_at"]
            ))
        
        total = response.count or 0
        
        return FileSearchResponse(
            items=files,
            query=search_request.query,
            total=total
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to search files: {str(e)}"
        )


@router.delete("/files/{file_id}")
async def delete_file(
    file_id: str,
    current_user: Dict[str, Any] = Depends(require_permissions(["manage_invoices"]))
):
    """
    Delete an uploaded file
    
    Removes the file from storage and database
    """
    try:
        outlet_id = get_user_outlet_id(current_user)
        supabase = get_supabase_admin()
        
        # Get file record
        file_response = supabase.table(Tables.FILES).select("*").eq("id", file_id).eq("outlet_id", outlet_id).execute()
        
        if not file_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="File not found"
            )
        
        file_data = file_response.data[0]
        
        # Delete from storage
        delete_result = supabase.storage.from_(file_data["bucket"]).remove([file_data["file_path"]])
        
        if delete_result.get("error"):
            logger.warning(f"Failed to delete file from storage: {delete_result['error']}")
        
        # Delete from database
        supabase.table(Tables.FILES).delete().eq("id", file_id).eq("outlet_id", outlet_id).execute()
        
        return {"message": "File deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete file: {str(e)}"
        )















