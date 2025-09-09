/**
 * OCR service using FastAPI backend
 */

import { apiClient } from './apiClient';

export interface OCRExtractedData {
  vendor_name?: string;
  invoice_number?: string;
  invoice_date?: string;
  due_date?: string;
  total_amount?: number;
  tax_amount?: number;
  subtotal?: number;
  currency?: string;
  line_items?: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    total: number;
  }>;
  vendor_address?: string;
  vendor_phone?: string;
  vendor_email?: string;
  payment_terms?: string;
  notes?: string;
}

export interface OCRProcessingRequest {
  file_url: string;
  document_type?: 'invoice' | 'receipt' | 'contract' | 'other';
  processing_options?: {
    extract_tables?: boolean;
    extract_line_items?: boolean;
    confidence_threshold?: number;
    language?: string;
  };
}

export interface OCRProcessingResponse {
  id: string;
  status: 'processing' | 'completed' | 'failed';
  extracted_data?: OCRExtractedData;
  confidence_score?: number;
  processing_time?: number;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface FileUploadResponse {
  file_id: string;
  file_url: string;
  file_name: string;
  file_size: number;
  file_type: string;
  upload_status: 'success' | 'failed';
  error_message?: string;
}

export interface OCRStatsResponse {
  data: {
    total_processed: number;
    successful_extractions: number;
    failed_extractions: number;
    average_confidence: number;
    average_processing_time: number;
    documents_by_type: Record<string, number>;
    recent_activity: Array<{
      date: string;
      processed: number;
      successful: number;
    }>;
  } | null;
  error: string | null;
}

class OCRService {
  // Upload file and process with OCR
  async uploadAndProcessFile(
    file: File,
    documentType: 'invoice' | 'receipt' | 'contract' | 'other' = 'invoice',
    processingOptions?: {
      extract_tables?: boolean;
      extract_line_items?: boolean;
      confidence_threshold?: number;
      language?: string;
    }
  ): Promise<{ data: OCRProcessingResponse | null; error: string | null }> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('document_type', documentType);
      
      if (processingOptions) {
        formData.append('processing_options', JSON.stringify(processingOptions));
      }

      const response = await apiClient.uploadFile('/ocr/upload-and-process', formData);
      
      if (response.error) {
        return { data: null, error: response.error };
      }

      return { 
        data: response.data, 
        error: null 
      };
    } catch (error) {
      console.error('Upload and process file error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to upload and process file' 
      };
    }
  }

  // Process existing file with OCR
  async processDocument(
    fileUrl: string,
    documentType: 'invoice' | 'receipt' | 'contract' | 'other' = 'invoice',
    processingOptions?: {
      extract_tables?: boolean;
      extract_line_items?: boolean;
      confidence_threshold?: number;
      language?: string;
    }
  ): Promise<{ data: OCRProcessingResponse | null; error: string | null }> {
    try {
      const requestData: OCRProcessingRequest = {
        file_url: fileUrl,
        document_type: documentType,
        processing_options: processingOptions
      };

      const response = await apiClient.post('/ocr/process', requestData);
      
      if (response.error) {
        return { data: null, error: response.error };
      }

      return { 
        data: response.data, 
        error: null 
      };
    } catch (error) {
      console.error('Process document error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to process document' 
      };
    }
  }

  // Get OCR processing status
  async getProcessingStatus(processingId: string): Promise<{ data: OCRProcessingResponse | null; error: string | null }> {
    try {
      const response = await apiClient.get(`/ocr/status/${processingId}`);
      
      if (response.error) {
        return { data: null, error: response.error };
      }

      return { 
        data: response.data, 
        error: null 
      };
    } catch (error) {
      console.error('Get processing status error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to get processing status' 
      };
    }
  }

  // Get OCR processing results
  async getProcessingResults(processingId: string): Promise<{ data: OCRProcessingResponse | null; error: string | null }> {
    try {
      const response = await apiClient.get(`/ocr/results/${processingId}`);
      
      if (response.error) {
        return { data: null, error: response.error };
      }

      return { 
        data: response.data, 
        error: null 
      };
    } catch (error) {
      console.error('Get processing results error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to get processing results' 
      };
    }
  }

  // List all OCR processing jobs
  async listProcessingJobs(
    page: number = 1,
    size: number = 20,
    status?: 'processing' | 'completed' | 'failed',
    document_type?: string
  ): Promise<{ data: OCRProcessingResponse[] | null; error: string | null }> {
    try {
      const params: any = { page, size };
      if (status) params.status = status;
      if (document_type) params.document_type = document_type;

      const response = await apiClient.get('/ocr/jobs', params);
      
      if (response.error) {
        return { data: null, error: response.error };
      }

      return { 
        data: response.data?.items || [], 
        error: null 
      };
    } catch (error) {
      console.error('List processing jobs error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to list processing jobs' 
      };
    }
  }

  // Delete OCR processing job
  async deleteProcessingJob(processingId: string): Promise<{ error: string | null }> {
    try {
      const response = await apiClient.delete(`/ocr/jobs/${processingId}`);
      
      if (response.error) {
        return { error: response.error };
      }

      return { error: null };
    } catch (error) {
      console.error('Delete processing job error:', error);
      return { 
        error: error instanceof Error ? error.message : 'Failed to delete processing job' 
      };
    }
  }

  // Get OCR statistics
  async getOCRStats(): Promise<OCRStatsResponse> {
    try {
      const response = await apiClient.get('/ocr/stats/overview');
      
      if (response.error) {
        return { data: null, error: response.error };
      }

      return { 
        data: response.data, 
        error: null 
      };
    } catch (error) {
      console.error('Get OCR stats error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to get OCR statistics' 
      };
    }
  }

  // Validate extracted data
  async validateExtractedData(
    processingId: string,
    validatedData: Partial<OCRExtractedData>
  ): Promise<{ data: OCRProcessingResponse | null; error: string | null }> {
    try {
      const response = await apiClient.post(`/ocr/validate/${processingId}`, validatedData);
      
      if (response.error) {
        return { data: null, error: response.error };
      }

      return { 
        data: response.data, 
        error: null 
      };
    } catch (error) {
      console.error('Validate extracted data error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to validate extracted data' 
      };
    }
  }

  // Retry failed OCR processing
  async retryProcessing(processingId: string): Promise<{ data: OCRProcessingResponse | null; error: string | null }> {
    try {
      const response = await apiClient.post(`/ocr/retry/${processingId}`);
      
      if (response.error) {
        return { data: null, error: response.error };
      }

      return { 
        data: response.data, 
        error: null 
      };
    } catch (error) {
      console.error('Retry processing error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to retry processing' 
      };
    }
  }

  // Get supported file types
  async getSupportedFileTypes(): Promise<{ data: string[] | null; error: string | null }> {
    try {
      const response = await apiClient.get('/ocr/supported-types');
      
      if (response.error) {
        return { data: null, error: response.error };
      }

      return { 
        data: response.data?.supported_types || [], 
        error: null 
      };
    } catch (error) {
      console.error('Get supported file types error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to get supported file types' 
      };
    }
  }

  // Check file size limits
  async getFileSizeLimits(): Promise<{ data: { max_size: number; max_size_mb: number } | null; error: string | null }> {
    try {
      const response = await apiClient.get('/ocr/file-limits');
      
      if (response.error) {
        return { data: null, error: response.error };
      }

      return { 
        data: response.data, 
        error: null 
      };
    } catch (error) {
      console.error('Get file size limits error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to get file size limits' 
      };
    }
  }
}

// Create singleton instance
export const ocrService = new OCRService();

// Export types
export type { 
  OCRExtractedData, 
  OCRProcessingRequest, 
  OCRProcessingResponse, 
  FileUploadResponse, 
  OCRStatsResponse 
};



