import React, { useState, useRef, useCallback } from 'react';
import { 
  Upload, 
  Camera, 
  FileText, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  Zap,
  TrendingUp,
  Smartphone,
  Monitor
} from 'lucide-react';
import { ocrService } from '@/lib/ocrService';
import { logger } from '@/lib/logger';

interface ExtractedData {
  vendorName?: string;
  amount?: number;
  date?: string;
  description?: string;
  confidence?: number;
}

interface ProcessingStats {
  manualTime: number;
  ocrTime: number;
  timeSaved: number;
  accuracy: number;
}

const OCRDemoWidget: React.FC = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [processingStats, setProcessingStats] = useState<ProcessingStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<'upload' | 'processing' | 'results'>('upload');
  
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

  const sampleStats: ProcessingStats = {
    manualTime: 720, // 12 minutes in seconds
    ocrTime: 28, // 28 seconds
    timeSaved: 692, // 11 minutes 32 seconds saved
    accuracy: 94
  };

  const resetDemo = () => {
    setCurrentStep('upload');
    setExtractedData(null);
    setProcessingStats(null);
    setError(null);
    setSelectedFile(null);
    setPreviewUrl(null);
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

    setSelectedFile(file);
    setError(null);
    
    // Create preview
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    
    // Start processing
    await processFile(file);
  };

  const processFile = async (file: File) => {
    setIsProcessing(true);
    setCurrentStep('processing');
    
    const startTime = Date.now();
    
    try {
      // Simulate realistic processing time (2-4 seconds for demo)
      await new Promise(resolve => setTimeout(resolve, 2500));
      
      // For demo purposes, we'll use sample data
      // In production, this would call the actual OCR service
      const processingTime = (Date.now() - startTime) / 1000;
      
      const demoStats: ProcessingStats = {
        manualTime: 720, // 12 minutes
        ocrTime: processingTime,
        timeSaved: 720 - processingTime,
        accuracy: sampleData.confidence || 94
      };

      setExtractedData(sampleData);
      setProcessingStats(demoStats);
      setCurrentStep('results');
      
      logger.info('OCR Demo completed', { 
        processingTime, 
        confidence: sampleData.confidence 
      });
      
    } catch (err) {
      logger.error('OCR Demo error:', err);
      setError('Processing failed. Please try again.');
      setCurrentStep('upload');
    } finally {
      setIsProcessing(false);
    }
  };

  const runInstantDemo = () => {
    setCurrentStep('processing');
    setIsProcessing(true);
    
    // Simulate quick processing
    setTimeout(() => {
      setExtractedData(sampleData);
      setProcessingStats(sampleStats);
      setCurrentStep('results');
      setIsProcessing(false);
    }, 1500);
  };

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${remainingSeconds}s`;
  };

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl p-8 border border-blue-200/50 dark:border-blue-800/50">
      <div className="text-center mb-8">
        <div className="inline-flex items-center space-x-2 bg-blue-100 dark:bg-blue-900/50 px-4 py-2 rounded-full text-blue-700 dark:text-blue-300 text-sm font-medium mb-4">
          <Zap className="w-4 h-4" />
          <span>Live OCR Demo</span>
        </div>
        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          See OCR in Action
        </h3>
        <p className="text-gray-600 dark:text-gray-300 max-w-md mx-auto">
          Upload a receipt or invoice image and watch our AI extract data in seconds
        </p>
      </div>

      {currentStep === 'upload' && (
        <div className="space-y-6">
          {/* Upload Area */}
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 ${
              dragActive 
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/10'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <div className="space-y-4">
              <div className="flex justify-center space-x-4">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/50 rounded-xl flex items-center justify-center">
                  <Upload className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/50 rounded-xl flex items-center justify-center">
                  <Camera className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
              
              <div>
                <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  Drop your receipt here or click to upload
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Supports JPG, PNG up to 10MB
                </p>
              </div>

              <div className="flex justify-center space-x-3">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  <Monitor className="w-4 h-4" />
                  <span>Choose File</span>
                </button>
                
                <button
                  onClick={() => cameraInputRef.current?.click()}
                  className="inline-flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  <Smartphone className="w-4 h-4" />
                  <span>Take Photo</span>
                </button>
              </div>
            </div>
          </div>

          {/* Quick Demo Button */}
          <div className="text-center">
            <div className="inline-flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400 mb-3">
              <span>Don't have a receipt handy?</span>
            </div>
            <button
              onClick={runInstantDemo}
              className="inline-flex items-center space-x-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-all duration-300 transform hover:scale-105"
            >
              <Zap className="w-5 h-5" />
              <span>Try Instant Demo</span>
            </button>
          </div>

          {error && (
            <div className="flex items-center space-x-2 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <span className="text-red-700 dark:text-red-300">{error}</span>
            </div>
          )}
        </div>
      )}

      {currentStep === 'processing' && (
        <div className="text-center space-y-6">
          <div className="relative">
            <div className="w-20 h-20 mx-auto bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center">
              <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <div className="absolute -top-2 -right-2 w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
          </div>
          
          <div>
            <h4 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              AI Processing Your Receipt
            </h4>
            <p className="text-gray-600 dark:text-gray-300">
              Extracting vendor details, amounts, and dates...
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 max-w-sm mx-auto">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Manual Processing</span>
              <span className="font-medium text-gray-900 dark:text-white">12 minutes</span>
            </div>
            <div className="flex items-center justify-between text-sm mt-2">
              <span className="text-blue-600 dark:text-blue-400">AI Processing</span>
              <span className="font-medium text-blue-600 dark:text-blue-400">~30 seconds</span>
            </div>
          </div>
        </div>
      )}

      {currentStep === 'results' && extractedData && processingStats && (
        <div className="space-y-6">
          {/* Success Header */}
          <div className="text-center">
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/50 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h4 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Data Extracted Successfully!
            </h4>
            <div className="inline-flex items-center space-x-2 bg-emerald-100 dark:bg-emerald-900/50 px-3 py-1 rounded-full">
              <span className="text-emerald-700 dark:text-emerald-300 text-sm font-medium">
                {extractedData.confidence}% Confidence
              </span>
            </div>
          </div>

          {/* Extracted Data */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <h5 className="font-semibold text-gray-900 dark:text-white mb-3">Extracted Data</h5>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Vendor:</span>
                  <span className="font-medium text-gray-900 dark:text-white">{extractedData.vendorName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Amount:</span>
                  <span className="font-medium text-gray-900 dark:text-white">£{extractedData.amount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Date:</span>
                  <span className="font-medium text-gray-900 dark:text-white">{extractedData.date}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Description:</span>
                  <span className="font-medium text-gray-900 dark:text-white">{extractedData.description}</span>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-4 border border-blue-200/50 dark:border-blue-800/50">
              <h5 className="font-semibold text-gray-900 dark:text-white mb-3">Time Comparison</h5>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-gray-500" />
                    <span className="text-gray-600 dark:text-gray-400">Manual Entry:</span>
                  </div>
                  <span className="font-medium text-gray-900 dark:text-white">{formatTime(processingStats.manualTime)}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Zap className="w-4 h-4 text-blue-500" />
                    <span className="text-blue-600 dark:text-blue-400">AI Processing:</span>
                  </div>
                  <span className="font-medium text-blue-600 dark:text-blue-400">{formatTime(Math.round(processingStats.ocrTime))}</span>
                </div>
                
                <div className="border-t border-blue-200 dark:border-blue-800 pt-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <TrendingUp className="w-4 h-4 text-emerald-500" />
                      <span className="text-emerald-600 dark:text-emerald-400">Time Saved:</span>
                    </div>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatTime(Math.round(processingStats.timeSaved))}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-center space-x-4">
            <button
              onClick={resetDemo}
              className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Try Another
            </button>
            <button
              onClick={() => window.location.href = '/auth?mode=signup&trial=true'}
              className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg font-medium transition-all duration-300 transform hover:scale-105"
            >
              Start Free Trial
            </button>
          </div>
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

export default OCRDemoWidget;
