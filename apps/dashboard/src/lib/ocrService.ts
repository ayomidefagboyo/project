import { OCRExtractedData, OCRStatus } from '@/types';

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
  }>;
}

export class OCRService {
  private apiKey: string;
  private apiEndpoint = 'https://vision.googleapis.com/v1/images:annotate';

  constructor() {
    this.apiKey = import.meta.env.VITE_GOOGLE_VISION_API_KEY || '';
  }

  // Check if OCR is enabled and configured
  isOCREnabled(): boolean {
    return Boolean(
      import.meta.env.VITE_ENABLE_OCR === 'true' && 
      this.apiKey && 
      import.meta.env.VITE_OCR_ENABLED === 'true'
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

  // Process image with Google Vision API
  async processImageWithGoogleVision(imageBase64: string): Promise<{
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

      const response = await fetch(`${this.apiEndpoint}?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`Google Vision API error: ${response.statusText}`);
      }

      const data: GoogleVisionApiResponse = await response.json();
      
      if (data.responses?.[0]?.error) {
        throw new Error(data.responses[0].error as any);
      }

      const fullText = data.responses?.[0]?.fullTextAnnotation?.text || '';
      const textAnnotations = data.responses?.[0]?.textAnnotations || [];
      
      // Calculate confidence score (simplified)
      const confidence = textAnnotations.length > 0 ? 85 : 0;

      return {
        text: fullText,
        confidence,
      };
    } catch (error) {
      console.error('Google Vision API error:', error);
      return {
        text: '',
        confidence: 0,
        error: error instanceof Error ? error.message : 'OCR processing failed'
      };
    }
  }

  // Fallback OCR using browser-based Tesseract.js (would need to be added as dependency)
  async processImageWithTesseract(file: File): Promise<{
    text: string;
    confidence: number;
    error?: string;
  }> {
    try {
      // This would require installing tesseract.js
      // For now, return a mock response
      console.log('Tesseract.js processing would happen here');
      
      return {
        text: 'Tesseract.js not implemented yet',
        confidence: 0,
        error: 'Tesseract.js integration pending'
      };
    } catch (error) {
      return {
        text: '',
        confidence: 0,
        error: error instanceof Error ? error.message : 'Tesseract OCR failed'
      };
    }
  }

  // Extract structured data from raw OCR text
  extractInvoiceData(ocrText: string): OCRExtractedData {
    const extractedData: OCRExtractedData = {};

    try {
      const lines = ocrText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      
      // Extract vendor name (usually at the top)
      if (lines.length > 0) {
        extractedData.vendorName = lines[0];
      }

      // Extract amount (look for currency patterns)
      const amountPatterns = [
        /\$[\d,]+\.?\d*/g,
        /NGN[\s]?[\d,]+\.?\d*/g,
        /₦[\d,]+\.?\d*/g,
        /Total[:\s]+\$?[\d,]+\.?\d*/gi,
        /Amount[:\s]+\$?[\d,]+\.?\d*/gi
      ];

      for (const pattern of amountPatterns) {
        const matches = ocrText.match(pattern);
        if (matches) {
          const amountText = matches[matches.length - 1]; // Take the last match (likely the total)
          const numericAmount = parseFloat(amountText.replace(/[^\d.]/g, ''));
          if (!isNaN(numericAmount) && numericAmount > 0) {
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

      // Extract phone number
      const phonePattern = /(\+?\d{1,4}[\s-]?)?\(?\d{3,4}\)?[\s-]?\d{3,4}[\s-]?\d{3,4}/g;
      const phoneMatches = ocrText.match(phonePattern);
      if (phoneMatches) {
        extractedData.vendorPhone = phoneMatches[0];
      }

      // Extract account number (look for numeric sequences)
      const accountPatterns = [
        /Account[:\s]+(\d{10,})/gi,
        /A\/C[:\s]+(\d{10,})/gi,
        /\b\d{10,}\b/g
      ];

      for (const pattern of accountPatterns) {
        const matches = ocrText.match(pattern);
        if (matches) {
          if (pattern.source.includes('Account') || pattern.source.includes('A\/C')) {
            const match = pattern.exec(ocrText);
            if (match && match[1]) {
              extractedData.accountNumber = match[1];
              break;
            }
          } else {
            // For generic number pattern, take the longest sequence
            const numbers = matches.sort((a, b) => b.length - a.length);
            if (numbers[0] && numbers[0].length >= 10) {
              extractedData.accountNumber = numbers[0];
              break;
            }
          }
        }
      }

      // Extract bank name (common Nigerian banks)
      const bankNames = [
        'Access Bank', 'GTBank', 'Guarantee Trust Bank', 'UBA', 'United Bank for Africa',
        'Zenith Bank', 'First Bank', 'Fidelity Bank', 'Union Bank', 'Sterling Bank',
        'Stanbic IBTC', 'Ecobank', 'Heritage Bank', 'Keystone Bank', 'Polaris Bank',
        'Wema Bank', 'FCMB', 'First City Monument Bank', 'Diamond Bank', 'Skye Bank'
      ];

      for (const bankName of bankNames) {
        if (ocrText.toLowerCase().includes(bankName.toLowerCase())) {
          extractedData.bankName = bankName;
          break;
        }
      }

      // Extract invoice number
      const invoicePatterns = [
        /Invoice[:\s#]+([A-Z0-9-]+)/gi,
        /INV[:\s#]+([A-Z0-9-]+)/gi,
        /Receipt[:\s#]+([A-Z0-9-]+)/gi,
        /#([A-Z0-9-]{3,})/g
      ];

      for (const pattern of invoicePatterns) {
        const match = pattern.exec(ocrText);
        if (match && match[1]) {
          extractedData.invoiceNumber = match[1];
          break;
        }
      }

      // Extract line items (simplified)
      const itemLines = lines.filter(line => {
        // Look for lines that might contain item descriptions with prices
        return line.includes('$') || line.includes('₦') || /\d+\.\d{2}/.test(line);
      });

      if (itemLines.length > 0) {
        extractedData.lineItems = itemLines.map(line => ({
          description: line.replace(/[\d$₦,.]+/g, '').trim(),
          quantity: 1, // Default quantity
          unitPrice: 0, // Would need more sophisticated parsing
          total: 0
        })).filter(item => item.description.length > 0);
      }

    } catch (error) {
      console.error('Error extracting invoice data:', error);
    }

    return extractedData;
  }

  // Main OCR processing function
  async processInvoiceImage(file: File): Promise<{
    status: OCRStatus;
    extractedData: OCRExtractedData;
    confidence: number;
    error?: string;
  }> {
    try {
      // Validate file
      if (!file.type.startsWith('image/')) {
        return {
          status: 'failed',
          extractedData: {},
          confidence: 0,
          error: 'File must be an image'
        };
      }

      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        return {
          status: 'failed',
          extractedData: {},
          confidence: 0,
          error: 'File size must be less than 10MB'
        };
      }

      let ocrResult: { text: string; confidence: number; error?: string };

      if (this.isOCREnabled()) {
        // Use Google Vision API
        const imageBase64 = await this.fileToBase64(file);
        ocrResult = await this.processImageWithGoogleVision(imageBase64);
      } else {
        // Fallback to Tesseract.js (if implemented)
        ocrResult = await this.processImageWithTesseract(file);
      }

      if (ocrResult.error) {
        return {
          status: 'failed',
          extractedData: {},
          confidence: 0,
          error: ocrResult.error
        };
      }

      // Extract structured data from OCR text
      const extractedData = this.extractInvoiceData(ocrResult.text);

      // Determine if manual review is needed
      const needsReview = ocrResult.confidence < 70 || 
                         !extractedData.vendorName || 
                         !extractedData.amount ||
                         !extractedData.date;

      return {
        status: needsReview ? 'manual_review' : 'completed',
        extractedData,
        confidence: ocrResult.confidence,
      };

    } catch (error) {
      console.error('OCR processing error:', error);
      return {
        status: 'failed',
        extractedData: {},
        confidence: 0,
        error: error instanceof Error ? error.message : 'OCR processing failed'
      };
    }
  }

  // Process expense receipt (similar to invoice but with different extraction patterns)
  async processExpenseReceipt(file: File): Promise<{
    status: OCRStatus;
    extractedData: {
      vendorName?: string;
      amount?: number;
      date?: string;
      category?: string;
      description?: string;
    };
    confidence: number;
    error?: string;
  }> {
    const invoiceResult = await this.processInvoiceImage(file);
    
    // For expenses, we might want to categorize automatically
    const expenseCategories = [
      'fuel', 'transport', 'utilities', 'office supplies', 'marketing',
      'repairs', 'maintenance', 'food', 'accommodation', 'professional services'
    ];

    let suggestedCategory = 'general';
    const extractedText = JSON.stringify(invoiceResult.extractedData).toLowerCase();

    for (const category of expenseCategories) {
      if (extractedText.includes(category)) {
        suggestedCategory = category;
        break;
      }
    }

    return {
      status: invoiceResult.status,
      extractedData: {
        vendorName: invoiceResult.extractedData.vendorName,
        amount: invoiceResult.extractedData.amount,
        date: invoiceResult.extractedData.date,
        category: suggestedCategory,
        description: invoiceResult.extractedData.description || invoiceResult.extractedData.vendorName
      },
      confidence: invoiceResult.confidence,
      error: invoiceResult.error
    };
  }
}

export const ocrService = new OCRService();