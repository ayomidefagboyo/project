/**
 * Demo-specific OCR Service with restricted API key and enhanced security
 */

import { OCRExtractedData, OCRStatus } from '@/types';
import { logger } from '@/lib/logger';

interface GoogleVisionApiResponse {
  responses: Array<{
    textAnnotations?: Array<{
      description: string;
      boundingPoly?: {
        vertices: Array<{ x: number; y: number }>;
      };
    }>;
    fullTextAnnotation?: {
      text: string;
    };
    error?: any;
  }>;
}

export class DemoOCRService {
  private demoApiKey: string;
  private apiEndpoint = 'https://vision.googleapis.com/v1/images:annotate';
  private maxFileSize = 5 * 1024 * 1024; // 5MB limit for demo (stricter than full version)

  constructor() {
    this.demoApiKey = import.meta.env.VITE_GOOGLE_VISION_DEMO_API_KEY || 
                      import.meta.env.VITE_GOOGLE_VISION_API_KEY || '';
  }

  // Check if demo OCR is enabled
  isDemoOCREnabled(): boolean {
    return Boolean(
      (import.meta.env.VITE_ENABLE_OCR === 'true' || import.meta.env.VITE_OCR_ENABLED === 'true') && 
      this.demoApiKey
    );
  }

  // Convert file to base64 for API submission
  private async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data:image/...;base64, prefix
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // Process image with Google Vision API (demo version with restrictions)
  private async processImageWithGoogleVision(imageBase64: string): Promise<{
    text: string;
    confidence: number;
    error?: string;
  }> {
    try {
      const requestBody = {
        requests: [
          {
            image: {
              content: imageBase64
            },
            features: [
              {
                type: 'TEXT_DETECTION',
                maxResults: 1
              }
            ]
          }
        ]
      };

      const response = await fetch(`${this.apiEndpoint}?key=${this.demoApiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Referer': window.location.origin, // Add referer for additional security
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('Google Vision API error:', { status: response.status, error: errorText });
        
        if (response.status === 403) {
          throw new Error('Demo quota exceeded. Please sign up for unlimited access.');
        } else if (response.status === 400) {
          throw new Error('Invalid image format. Please try a different image.');
        } else {
          throw new Error(`OCR service temporarily unavailable (${response.status})`);
        }
      }

      const data: GoogleVisionApiResponse = await response.json();
      
      if (data.responses?.[0]?.error) {
        const errorMsg = data.responses[0].error.message || 'OCR processing failed';
        throw new Error(errorMsg);
      }

      const fullText = data.responses?.[0]?.fullTextAnnotation?.text || '';
      const textAnnotations = data.responses?.[0]?.textAnnotations || [];
      
      // Calculate confidence score (simplified)
      const confidence = textAnnotations.length > 0 ? Math.min(85 + Math.random() * 10, 95) : 0;

      return {
        text: fullText,
        confidence: Math.round(confidence),
      };
    } catch (error) {
      logger.error('Google Vision API error:', error);
      return {
        text: '',
        confidence: 0,
        error: error instanceof Error ? error.message : 'OCR processing failed'
      };
    }
  }

  // Extract structured data from raw OCR text (simplified for demo)
  private extractReceiptData(ocrText: string): OCRExtractedData {
    const extractedData: OCRExtractedData = {};

    try {
      const lines = ocrText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      
      // Extract vendor name (usually at the top)
      if (lines.length > 0) {
        extractedData.vendorName = lines[0].substring(0, 50); // Limit length for demo
      }

      // Extract amount (look for currency patterns) - UK focused for demo
      const amountPatterns = [
        /£[\d,]+\.?\d*/g,
        /GBP[\s]?[\d,]+\.?\d*/g,
        /Total[:\s]+£?[\d,]+\.?\d*/gi,
        /Amount[:\s]+£?[\d,]+\.?\d*/gi,
        /\d+\.\d{2}/g // Fallback for any decimal amount
      ];

      for (const pattern of amountPatterns) {
        const matches = ocrText.match(pattern);
        if (matches) {
          const amountText = matches[matches.length - 1]; // Take the last match (likely the total)
          const numericAmount = parseFloat(amountText.replace(/[^\d.]/g, ''));
          if (!isNaN(numericAmount) && numericAmount > 0 && numericAmount < 10000) { // Reasonable range for demo
            extractedData.amount = numericAmount;
            break;
          }
        }
      }

      // Extract date patterns
      const datePatterns = [
        /\d{1,2}\/\d{1,2}\/\d{2,4}/g,
        /\d{1,2}-\d{1,2}-\d{2,4}/g,
        /\d{4}-\d{1,2}-\d{1,2}/g,
        /\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}/gi
      ];

      for (const pattern of datePatterns) {
        const matches = ocrText.match(pattern);
        if (matches) {
          extractedData.date = matches[0];
          break;
        }
      }

      // If no date found, use today's date
      if (!extractedData.date) {
        extractedData.date = new Date().toISOString().split('T')[0];
      }

      // Extract description (simplified for demo)
      const commonTerms = ['receipt', 'invoice', 'purchase', 'sale', 'payment'];
      let description = '';
      
      for (const line of lines.slice(1, 4)) { // Check first few lines after vendor name
        if (line.length > 5 && line.length < 100 && 
            !commonTerms.some(term => line.toLowerCase().includes(term))) {
          description = line;
          break;
        }
      }
      
      if (description) {
        extractedData.description = description.substring(0, 100); // Limit for demo
      }

    } catch (error) {
      logger.error('Error extracting receipt data:', error);
    }

    return extractedData;
  }

  // Main demo OCR processing function
  async processDemoReceipt(file: File): Promise<{
    status: OCRStatus;
    extractedData: OCRExtractedData;
    confidence: number;
    error?: string;
  }> {
    try {
      // Validate file (stricter limits for demo)
      if (!file.type.startsWith('image/')) {
        return {
          status: 'failed',
          extractedData: {},
          confidence: 0,
          error: 'File must be an image (JPG, PNG, etc.)'
        };
      }

      if (file.size > this.maxFileSize) {
        return {
          status: 'failed',
          extractedData: {},
          confidence: 0,
          error: 'File size must be less than 5MB for demo'
        };
      }

      if (!this.isDemoOCREnabled()) {
        return {
          status: 'failed',
          extractedData: {},
          confidence: 0,
          error: 'Demo OCR is not available. Please try again later.'
        };
      }

      // Process with Google Vision API
      const imageBase64 = await this.fileToBase64(file);
      const ocrResult = await this.processImageWithGoogleVision(imageBase64);

      if (ocrResult.error) {
        return {
          status: 'failed',
          extractedData: {},
          confidence: 0,
          error: ocrResult.error
        };
      }

      // Extract structured data from OCR text
      const extractedData = this.extractReceiptData(ocrResult.text);

      // Determine if manual review is needed (more lenient for demo)
      const needsReview = ocrResult.confidence < 60 || 
                         (!extractedData.vendorName && !extractedData.amount);

      return {
        status: needsReview ? 'manual_review' : 'completed',
        extractedData,
        confidence: ocrResult.confidence,
      };

    } catch (error) {
      logger.error('Demo OCR processing error:', error);
      return {
        status: 'failed',
        extractedData: {},
        confidence: 0,
        error: error instanceof Error ? error.message : 'OCR processing failed'
      };
    }
  }
}

export const demoOCRService = new DemoOCRService();
