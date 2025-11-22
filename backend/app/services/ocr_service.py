"""
OCR service for handling document processing and data extraction
"""

import base64
import json
import time
from typing import Dict, Any, Optional
from datetime import datetime
from fastapi import HTTPException, status
from app.core.config import settings
from app.schemas.ocr import (
    OCRProcessingRequest, OCRProcessingResponse, OCRExtractedData, OCRStatus,
    OCRStatsResponse, OCRReviewRequest, OCRReviewResponse
)
import logging
import httpx
import openai

logger = logging.getLogger(__name__)


class OCRService:
    """OCR service class for document processing"""
    
    def __init__(self):
        self.google_vision_api_key = getattr(settings, 'GOOGLE_VISION_API_KEY', None)
        self.google_vision_url = "https://vision.googleapis.com/v1/images:annotate"
        self.openai_api_key = getattr(settings, 'OPENAI_API_KEY', None)
        if self.openai_api_key:
            openai.api_key = self.openai_api_key
    
    async def process_document(self, request: OCRProcessingRequest) -> OCRProcessingResponse:
        """Process a document with OCR"""
        start_time = time.time()
        
        try:
            # Initialize response
            ocr_id = f"ocr_{int(time.time())}_{hash(request.file_url) % 10000}"
            
            # Download and process the file
            if request.enable_google_vision and self.google_vision_api_key:
                # Use Google Vision API
                ocr_result = await self._process_with_google_vision(request.file_url)
            else:
                # Use fallback OCR (placeholder for Tesseract integration)
                ocr_result = await self._process_with_fallback(request.file_url)
            
            processing_time = time.time() - start_time
            
            if ocr_result.get("error"):
                return OCRProcessingResponse(
                    id=ocr_id,
                    file_url=request.file_url,
                    status=OCRStatus.FAILED,
                    extracted_data=OCRExtractedData(),
                    confidence=0.0,
                    error_message=ocr_result["error"],
                    processing_time=processing_time,
                    created_at=datetime.now(),
                    completed_at=datetime.now()
                )
            
            # Extract structured data
            extracted_data = await self._extract_invoice_data(ocr_result["text"])
            
            # Calculate confidence and determine status
            confidence = ocr_result.get("confidence", 0.0)
            needs_review = confidence < 70 or not self._has_required_fields(extracted_data)
            
            status = OCRStatus.MANUAL_REVIEW if needs_review else OCRStatus.COMPLETED
            
            return OCRProcessingResponse(
                id=ocr_id,
                file_url=request.file_url,
                status=status,
                extracted_data=extracted_data,
                confidence=confidence,
                raw_text=ocr_result["text"],
                processing_time=processing_time,
                created_at=datetime.now(),
                completed_at=datetime.now()
            )
            
        except Exception as e:
            logger.error(f"Error processing document: {e}")
            return OCRProcessingResponse(
                id=f"ocr_error_{int(time.time())}",
                file_url=request.file_url,
                status=OCRStatus.FAILED,
                extracted_data=OCRExtractedData(),
                confidence=0.0,
                error_message=str(e),
                processing_time=time.time() - start_time,
                created_at=datetime.now(),
                completed_at=datetime.now()
            )
    
    async def _process_with_google_vision(self, file_url: str) -> Dict[str, Any]:
        """Process image with Google Vision API"""
        try:
            # Download image and convert to base64
            async with httpx.AsyncClient() as client:
                response = await client.get(file_url)
                response.raise_for_status()
                image_data = base64.b64encode(response.content).decode('utf-8')
            
            # Prepare Google Vision API request
            payload = {
                "requests": [
                    {
                        "image": {
                            "content": image_data
                        },
                        "features": [
                            {
                                "type": "TEXT_DETECTION",
                                "maxResults": 1
                            }
                        ]
                    }
                ]
            }
            
            # Make API request
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.google_vision_url}?key={self.google_vision_api_key}",
                    json=payload,
                    headers={"Content-Type": "application/json"}
                )
                response.raise_for_status()
                result = response.json()
            
            # Extract text from response
            if "responses" in result and result["responses"]:
                text_annotations = result["responses"][0].get("textAnnotations", [])
                if text_annotations:
                    text = text_annotations[0].get("description", "")
                    # Calculate confidence based on text length and structure
                    confidence = min(95.0, max(30.0, len(text) * 0.5))
                    return {"text": text, "confidence": confidence}
            
            return {"text": "", "confidence": 0.0, "error": "No text detected"}
            
        except Exception as e:
            logger.error(f"Google Vision API error: {e}")
            return {"text": "", "confidence": 0.0, "error": str(e)}
    
    async def _process_with_fallback(self, file_url: str) -> Dict[str, Any]:
        """Fallback OCR processing (placeholder for Tesseract integration)"""
        # This is a placeholder for Tesseract.js or other OCR solutions
        # In a real implementation, you would integrate with Tesseract or similar
        
        return {
            "text": "Fallback OCR processing not implemented",
            "confidence": 50.0,
            "error": "Google Vision API not available and fallback OCR not implemented"
        }
    
    async def _extract_invoice_data(self, text: str) -> OCRExtractedData:
        """Extract structured data from OCR text using OpenAI GPT-4"""
        extracted_data = OCRExtractedData()
        
        if not text:
            return extracted_data
        
        # Try OpenAI extraction first
        if self.openai_api_key:
            try:
                openai_result = await self._extract_with_openai(text)
                if openai_result:
                    return openai_result
            except Exception as e:
                logger.warning(f"OpenAI extraction failed, falling back to regex: {e}")
        
        # Fallback to regex-based extraction
        return self._extract_with_regex(text)
    
    async def _extract_with_openai(self, text: str) -> Optional[OCRExtractedData]:
        """Use OpenAI GPT-4 to extract structured invoice data"""
        try:
            prompt = f"""
            Extract the following information from this invoice text. Return only a JSON object with these exact fields:
            
            {{
                "vendor_name": "company/vendor name",
                "vendor_email": "email if found",
                "vendor_phone": "phone if found",
                "vendor_address": "address if found",
                "invoice_number": "invoice/bill number",
                "invoice_date": "invoice date (YYYY-MM-DD format)",
                "due_date": "due date (YYYY-MM-DD format)",
                "total_amount": numeric_value_only,
                "tax_amount": numeric_value_only,
                "subtotal": numeric_value_only,
                "currency": "currency code (USD, EUR, etc.)",
                "payment_terms": "payment terms if found",
                "line_items": [
                    {{
                        "description": "item description",
                        "quantity": numeric_value,
                        "unit_price": numeric_value,
                        "total": numeric_value
                    }}
                ]
            }}
            
            Invoice text:
            {text}
            
            Return only the JSON object, no other text.
            """
            
            client = openai.OpenAI(api_key=self.openai_api_key)
            response = client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": "You are an expert invoice data extraction system. Extract data accurately and return only valid JSON."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.1,
                max_tokens=1000
            )
            
            result_text = response.choices[0].message.content.strip()
            
            # Parse JSON response
            import json
            try:
                result_data = json.loads(result_text)
            except json.JSONDecodeError:
                # Try to extract JSON from response if it's wrapped in other text
                import re
                json_match = re.search(r'\{.*\}', result_text, re.DOTALL)
                if json_match:
                    result_data = json.loads(json_match.group())
                else:
                    raise ValueError("No valid JSON found in response")
            
            # Convert to OCRExtractedData
            extracted_data = OCRExtractedData(
                vendor_name=result_data.get("vendor_name"),
                vendor_email=result_data.get("vendor_email"),
                vendor_phone=result_data.get("vendor_phone"),
                vendor_address=result_data.get("vendor_address"),
                invoice_number=result_data.get("invoice_number"),
                invoice_date=result_data.get("invoice_date"),
                due_date=result_data.get("due_date"),
                total_amount=result_data.get("total_amount"),
                tax_amount=result_data.get("tax_amount"),
                subtotal=result_data.get("subtotal"),
                currency=result_data.get("currency"),
                payment_terms=result_data.get("payment_terms"),
                line_items=result_data.get("line_items", [])
            )
            
            return extracted_data
            
        except Exception as e:
            logger.error(f"OpenAI extraction error: {e}")
            return None
    
    def _extract_with_regex(self, text: str) -> OCRExtractedData:
        """Fallback regex-based extraction"""
        import re
        extracted_data = OCRExtractedData()
        
        # Convert text to lowercase for pattern matching
        text_lower = text.lower()
        
        # Extract vendor name (look for common patterns)
        vendor_patterns = [
            r"vendor[:\s]+([^\n\r]+)",
            r"supplier[:\s]+([^\n\r]+)",
            r"from[:\s]+([^\n\r]+)",
            r"bill to[:\s]+([^\n\r]+)"
        ]
        
        for pattern in vendor_patterns:
            match = re.search(pattern, text_lower)
            if match:
                extracted_data.vendor_name = match.group(1).strip().title()
                break
        
        # Extract phone number
        phone_pattern = r"(\+?[\d\s\-\(\)]{10,})"
        phone_match = re.search(phone_pattern, text)
        if phone_match:
            extracted_data.vendor_phone = phone_match.group(1).strip()
        
        # Extract amounts
        amount_patterns = [
            r"total[:\s]*\$?([\d,]+\.?\d*)",
            r"amount[:\s]*\$?([\d,]+\.?\d*)",
            r"sum[:\s]*\$?([\d,]+\.?\d*)",
            r"\$([\d,]+\.?\d*)"
        ]
        
        for pattern in amount_patterns:
            match = re.search(pattern, text_lower)
            if match:
                try:
                    amount_str = match.group(1).replace(",", "")
                    amount = float(amount_str)
                    if not extracted_data.amount or amount > extracted_data.amount:
                        extracted_data.amount = amount
                        extracted_data.total_amount = amount
                except ValueError:
                    continue
        
        # Extract tax amount
        tax_patterns = [
            r"tax[:\s]*\$?([\d,]+\.?\d*)",
            r"vat[:\s]*\$?([\d,]+\.?\d*)",
            r"gst[:\s]*\$?([\d,]+\.?\d*)"
        ]
        
        for pattern in tax_patterns:
            match = re.search(pattern, text_lower)
            if match:
                try:
                    tax_str = match.group(1).replace(",", "")
                    extracted_data.tax_amount = float(tax_str)
                    break
                except ValueError:
                    continue
        
        # Extract date
        date_patterns = [
            r"(\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4})",
            r"(\d{4}[/\-]\d{1,2}[/\-]\d{1,2})",
            r"(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[\s,]*\d{1,2}[\s,]*\d{2,4}"
        ]
        
        for pattern in date_patterns:
            match = re.search(pattern, text_lower)
            if match:
                try:
                    date_str = match.group(1)
                    # Try to parse the date
                    from dateutil import parser
                    extracted_data.date = parser.parse(date_str)
                    break
                except:
                    continue
        
        # Extract account number
        account_patterns = [
            r"account[:\s]*([\d\-]+)",
            r"acc[:\s]*([\d\-]+)",
            r"acct[:\s]*([\d\-]+)"
        ]
        
        for pattern in account_patterns:
            match = re.search(pattern, text_lower)
            if match:
                extracted_data.account_number = match.group(1).strip()
                break
        
        # Extract bank name
        bank_patterns = [
            r"bank[:\s]+([^\n\r]+)",
            r"financial[:\s]+([^\n\r]+)"
        ]
        
        for pattern in bank_patterns:
            match = re.search(pattern, text_lower)
            if match:
                extracted_data.bank_name = match.group(1).strip().title()
                break
        
        # Extract invoice number
        invoice_patterns = [
            r"invoice[:\s]*#?([^\n\r\s]+)",
            r"inv[:\s]*#?([^\n\r\s]+)",
            r"bill[:\s]*#?([^\n\r\s]+)"
        ]
        
        for pattern in invoice_patterns:
            match = re.search(pattern, text_lower)
            if match:
                extracted_data.invoice_number = match.group(1).strip()
                break
        
        # Extract description (first few lines after common headers)
        description_patterns = [
            r"description[:\s]*([^\n\r]+(?:\n[^\n\r]+)*)",
            r"items?[:\s]*([^\n\r]+(?:\n[^\n\r]+)*)",
            r"goods[:\s]*([^\n\r]+(?:\n[^\n\r]+)*)"
        ]
        
        for pattern in description_patterns:
            match = re.search(pattern, text_lower)
            if match:
                extracted_data.description = match.group(1).strip()
                break
        
        return extracted_data
    
    def _has_required_fields(self, data: OCRExtractedData) -> bool:
        """Check if extracted data has required fields"""
        required_fields = [
            data.vendor_name,
            data.amount,
            data.date
        ]
        return all(field is not None for field in required_fields)
    
    async def review_ocr_result(self, review_request: OCRReviewRequest, user_id: str) -> OCRReviewResponse:
        """Review and approve/reject OCR result"""
        try:
            # In a real implementation, you would update the database with the review
            # For now, we'll return a mock response
            
            final_data = review_request.corrected_data or OCRExtractedData()
            final_status = OCRStatus.COMPLETED if review_request.approved else OCRStatus.FAILED
            
            return OCRReviewResponse(
                ocr_id=review_request.ocr_id,
                status=final_status,
                final_data=final_data,
                reviewed_by=user_id,
                reviewed_at=datetime.now(),
                review_notes=review_request.review_notes
            )
            
        except Exception as e:
            logger.error(f"Error reviewing OCR result: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to review OCR result"
            )
    
    async def get_ocr_stats(self, outlet_id: str) -> OCRStatsResponse:
        """Get OCR processing statistics"""
        try:
            # In a real implementation, you would query the database for OCR statistics
            # For now, we'll return mock data
            
            return OCRStatsResponse(
                total_processed=100,
                successful_extractions=85,
                manual_reviews=10,
                failed_extractions=5,
                average_confidence=78.5,
                average_processing_time=2.3,
                status_distribution={
                    "completed": 85,
                    "manual_review": 10,
                    "failed": 5
                }
            )
            
        except Exception as e:
            logger.error(f"Error getting OCR stats: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to get OCR statistics"
            )


# Create service instance
ocr_service = OCRService()















