import React, { useState, useRef, useCallback } from 'react';
import { 
  Upload, 
  Camera, 
  CheckCircle, 
  AlertCircle,
  Zap,
  Clock,
  Smartphone,
  Monitor
} from 'lucide-react';
import { logger } from '@/lib/logger';
import { demoOCRService } from '@/lib/demoOCRService';
import { demoRateLimiter } from '@/lib/demoRateLimiter';

interface ExtractedData {
  vendorName?: string;
  amount?: number;
  date?: string;
  description?: string;
  confidence?: number;
}

const CompactOCRDemo: React.FC = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [currentStep, setCurrentStep] = useState<'upload' | 'processing' | 'results'>('upload');
  const [usageStats, setUsageStats] = useState(demoRateLimiter.getUsageStats());
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Sample demo data for instant demo
  const sampleData: ExtractedData = {
    vendorName: "Tesco Express",
    amount: 47.85,
    date: "2024-01-15",
    description: "Groceries and supplies",
    confidence: 94
  };

  const resetDemo = () => {
    setCurrentStep('upload');
    setExtractedData(null);
    setError(null);
    setIsProcessing(false);
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = async (file: File) => {
    // Validate file
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (JPG, PNG, etc.)');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB');
      return;
    }

    // Check rate limit
    const rateLimitCheck = demoRateLimiter.checkRateLimit();
    if (!rateLimitCheck.allowed) {
      setError(rateLimitCheck.reason || 'Rate limit exceeded');
      return;
    }

    setError(null);
    await processFile(file);
    
    // Update usage stats after processing
    setUsageStats(demoRateLimiter.getUsageStats());
  };

  const processFile = async (file: File) => {
    setIsProcessing(true);
    setCurrentStep('processing');
    
    try {
      // Check if demo OCR is enabled
      if (!demoOCRService.isDemoOCREnabled()) {
        logger.info('Demo OCR not enabled, using sample data');
        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 1500));
        setExtractedData(sampleData);
        setCurrentStep('results');
        return;
      }

      // Process with demo OCR service (restricted API key)
      const result = await demoOCRService.processDemoReceipt(file);
      
      if (result.error) {
        throw new Error(result.error);
      }

      // Convert OCR result to our interface
      const extractedData: ExtractedData = {
        vendorName: result.extractedData.vendorName || 'Unknown Vendor',
        amount: result.extractedData.amount || 0,
        date: result.extractedData.date || new Date().toISOString().split('T')[0],
        description: result.extractedData.description || 'Receipt',
        confidence: result.confidence
      };

      setExtractedData(extractedData);
      setCurrentStep('results');
      
      logger.info('OCR processing completed', { 
        confidence: result.confidence,
        status: result.status
      });
      
    } catch (err) {
      logger.error('OCR processing error:', err);
      setError(err instanceof Error ? err.message : 'Processing failed. Please try again.');
      setCurrentStep('upload');
    } finally {
      setIsProcessing(false);
    }
  };

  const runInstantDemo = () => {
    setCurrentStep('processing');
    setIsProcessing(true);
    
    // Quick processing for instant demo
    setTimeout(() => {
      setExtractedData(sampleData);
      setCurrentStep('results');
      setIsProcessing(false);
    }, 1200);
  };

  if (currentStep === 'processing') {
    return (
      <div className="text-center py-6">
        <div className="relative mb-4">
          <div className="w-12 h-12 mx-auto bg-emerald-100 dark:bg-emerald-900/50 rounded-full flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
          <div className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
            <Zap className="w-3 h-3 text-white" />
          </div>
        </div>
        
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
          AI Processing...
        </h4>
        <p className="text-xs text-gray-600 dark:text-gray-400">
          Extracting data from your receipt
        </p>
      </div>
    );
  }

  if (currentStep === 'results' && extractedData) {
    return (
      <div className="space-y-3">
        {/* Success Header */}
        <div className="text-center">
          <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/50 rounded-full flex items-center justify-center mx-auto mb-2">
            <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="flex items-center justify-center space-x-2 text-xs">
            <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
            <span className="text-emerald-700 dark:text-emerald-300 font-medium">
              {extractedData.confidence}% Confidence
            </span>
          </div>
        </div>

        {/* Extracted Data */}
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-gray-600 dark:text-gray-400">Vendor:</span>
              <span className="font-medium text-gray-900 dark:text-white">{extractedData.vendorName}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-600 dark:text-gray-400">Amount:</span>
              <span className="font-medium text-gray-900 dark:text-white">£{extractedData.amount}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-600 dark:text-gray-400">Date:</span>
              <span className="font-medium text-gray-900 dark:text-white">{extractedData.date}</span>
            </div>
          </div>
        </div>

        {/* Time Saved */}
        <div className="bg-gradient-to-r from-blue-50 to-emerald-50 dark:from-blue-900/20 dark:to-emerald-900/20 rounded-lg p-2 border border-blue-200/50 dark:border-blue-800/50">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center space-x-1">
              <Clock className="w-3 h-3 text-gray-500" />
              <span className="text-gray-600 dark:text-gray-400">Saved:</span>
            </div>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">11m 30s</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-2">
          <button
            onClick={resetDemo}
            className="flex-1 px-3 py-2 text-xs border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Try Another
          </button>
          <button
            onClick={() => window.location.href = '/auth?mode=signup&trial=true'}
            className="flex-1 px-3 py-2 text-xs bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-700 hover:to-blue-700 text-white rounded-lg font-medium transition-all duration-300"
          >
            Start Trial
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Upload Area */}
      <div
        className={`border-2 border-dashed rounded-lg p-4 text-center transition-all duration-300 cursor-pointer ${
          dragActive 
            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' 
            : 'border-gray-300 dark:border-gray-600 hover:border-emerald-400 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <div className="space-y-2">
          <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-900/50 rounded-lg flex items-center justify-center mx-auto">
            <Upload className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          
          <div>
            <p className="text-xs font-medium text-gray-900 dark:text-white mb-1">
              Drop receipt or click to upload
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              JPG, PNG up to 10MB
            </p>
          </div>

          <div className="flex justify-center space-x-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center space-x-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 px-2 py-1 rounded text-xs transition-colors"
            >
              <Monitor className="w-3 h-3" />
              <span>File</span>
            </button>
            
            <button
              onClick={() => cameraInputRef.current?.click()}
              className="inline-flex items-center space-x-1 bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-900/50 dark:hover:bg-emerald-900/70 text-emerald-700 dark:text-emerald-300 px-2 py-1 rounded text-xs transition-colors"
            >
              <Smartphone className="w-3 h-3" />
              <span>Camera</span>
            </button>
          </div>
        </div>
      </div>

      {/* Usage Stats */}
      <div className="text-center">
        <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
          Demo: {usageStats.hourlyUsed}/{usageStats.hourlyLimit} hourly • {usageStats.dailyUsed}/{usageStats.dailyLimit} daily
        </div>
        <button
          onClick={runInstantDemo}
          className="text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 underline transition-colors"
        >
          Try instant demo
        </button>
      </div>

      {error && (
        <div className="flex items-center space-x-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-500" />
          <span className="text-red-700 dark:text-red-300 text-xs">{error}</span>
        </div>
      )}

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileInput}
        className="hidden"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileInput}
        className="hidden"
      />
    </div>
  );
};

export default CompactOCRDemo;
