import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, Image, X, AlertCircle, CheckCircle, Eye } from 'lucide-react';
import { ocrService } from '@/lib/ocrService';
import { supabase } from '@/lib/supabase';
import { OCRExtractedData, OCRStatus } from '@/types';

interface FileUploadProps {
  onFileUploaded: (fileUrl: string, originalFileUrl: string, ocrData?: OCRExtractedData, ocrStatus?: OCRStatus, confidence?: number) => void;
  accept?: Record<string, string[]>;
  maxFiles?: number;
  maxSize?: number;
  enableOCR?: boolean;
  bucket?: string;
  className?: string;
}

interface UploadedFile {
  file: File;
  preview: string;
  uploading: boolean;
  uploaded: boolean;
  error?: string;
  ocrProcessing?: boolean;
  ocrCompleted?: boolean;
  ocrData?: OCRExtractedData;
  ocrConfidence?: number;
  fileUrl?: string;
}

const FileUpload: React.FC<FileUploadProps> = ({
  onFileUploaded,
  accept = {
    'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
    'application/pdf': ['.pdf']
  },
  maxFiles = 5,
  maxSize = 10 * 1024 * 1024, // 10MB
  enableOCR = false,
  bucket = 'invoices',
  className = ''
}) => {
  const [files, setFiles] = useState<UploadedFile[]>([]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      uploading: false,
      uploaded: false,
      ocrProcessing: false,
      ocrCompleted: false
    }));

    setFiles(prev => [...prev.slice(0, maxFiles - newFiles.length), ...newFiles]);

    // Auto-upload files
    newFiles.forEach(uploadedFile => {
      uploadFile(uploadedFile);
    });
  }, [maxFiles]);

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop,
    accept,
    maxFiles,
    maxSize,
    multiple: maxFiles > 1
  });

  const uploadFile = async (uploadedFile: UploadedFile) => {
    try {
      // Update state to show uploading
      setFiles(prev => prev.map(f => 
        f === uploadedFile ? { ...f, uploading: true } : f
      ));

      // Generate unique file path
      const fileExt = uploadedFile.file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${bucket}/${fileName}`;

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(filePath, uploadedFile.file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        throw error;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

      // Update state with uploaded file URL
      setFiles(prev => prev.map(f => 
        f === uploadedFile ? { 
          ...f, 
          uploading: false, 
          uploaded: true, 
          fileUrl: publicUrl 
        } : f
      ));

      // Process OCR if enabled and file is an image
      if (enableOCR && uploadedFile.file.type.startsWith('image/')) {
        await processOCR(uploadedFile, publicUrl);
      } else {
        // No OCR, just return the file URLs
        onFileUploaded(publicUrl, publicUrl);
      }

    } catch (error) {
      console.error('File upload error:', error);
      setFiles(prev => prev.map(f => 
        f === uploadedFile ? { 
          ...f, 
          uploading: false, 
          error: error instanceof Error ? error.message : 'Upload failed' 
        } : f
      ));
    }
  };

  const processOCR = async (uploadedFile: UploadedFile, fileUrl: string) => {
    try {
      // Update state to show OCR processing
      setFiles(prev => prev.map(f => 
        f === uploadedFile ? { ...f, ocrProcessing: true } : f
      ));

      // Process with OCR service
      const ocrResult = await ocrService.processInvoiceImage(uploadedFile.file);

      // Update state with OCR results
      setFiles(prev => prev.map(f => 
        f === uploadedFile ? { 
          ...f, 
          ocrProcessing: false,
          ocrCompleted: true,
          ocrData: ocrResult.extractedData,
          ocrConfidence: ocrResult.confidence
        } : f
      ));

      // Call callback with all data
      onFileUploaded(
        fileUrl, 
        fileUrl, 
        ocrResult.extractedData, 
        ocrResult.status,
        ocrResult.confidence
      );

    } catch (error) {
      console.error('OCR processing error:', error);
      setFiles(prev => prev.map(f => 
        f === uploadedFile ? { 
          ...f, 
          ocrProcessing: false,
          error: error instanceof Error ? error.message : 'OCR processing failed'
        } : f
      ));

      // Still call callback with file URL only
      onFileUploaded(fileUrl, fileUrl);
    }
  };

  const removeFile = (fileToRemove: UploadedFile) => {
    setFiles(prev => {
      // Revoke object URL to free memory
      URL.revokeObjectURL(fileToRemove.preview);
      return prev.filter(f => f !== fileToRemove);
    });
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) {
      return Image;
    } else if (file.type === 'application/pdf') {
      return FileText;
    }
    return FileText;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          isDragActive 
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
        }`}
      >
        <input {...getInputProps()} />
        <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
        {isDragActive ? (
          <p className="text-blue-600 dark:text-blue-400 font-medium">
            Drop the files here...
          </p>
        ) : (
          <div>
            <p className="text-gray-600 dark:text-gray-400 font-medium mb-2">
              Drop files here or click to upload
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500">
              Supports: {Object.values(accept).flat().join(', ')}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">
              Max {maxFiles} file{maxFiles > 1 ? 's' : ''}, up to {formatFileSize(maxSize)} each
            </p>
          </div>
        )}
      </div>

      {/* File Rejections */}
      {fileRejections.length > 0 && (
        <div className="space-y-2">
          {fileRejections.map(({ file, errors }) => (
            <div key={file.name} className="flex items-center p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <AlertCircle className="h-5 w-5 text-red-500 mr-3" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-800 dark:text-red-400">
                  {file.name}
                </p>
                <p className="text-xs text-red-600 dark:text-red-500">
                  {errors.map(e => e.message).join(', ')}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Uploaded Files */}
      {files.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white">
            Uploaded Files ({files.length})
          </h4>
          <div className="space-y-2">
            {files.map((uploadedFile, index) => {
              const FileIcon = getFileIcon(uploadedFile.file);
              
              return (
                <div key={index} className="flex items-center p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <FileIcon className="h-8 w-8 text-gray-400 mr-3" />
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {uploadedFile.file.name}
                      </p>
                      <button
                        onClick={() => removeFile(uploadedFile)}
                        className="ml-2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {formatFileSize(uploadedFile.file.size)}
                      </p>
                      
                      <div className="flex items-center space-x-2">
                        {uploadedFile.uploading && (
                          <div className="flex items-center text-xs text-blue-600 dark:text-blue-400">
                            <div className="animate-spin rounded-full h-3 w-3 border border-blue-600 border-t-transparent mr-1"></div>
                            Uploading...
                          </div>
                        )}
                        
                        {uploadedFile.uploaded && !uploadedFile.error && (
                          <div className="flex items-center text-xs text-green-600 dark:text-green-400">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Uploaded
                          </div>
                        )}
                        
                        {uploadedFile.ocrProcessing && (
                          <div className="flex items-center text-xs text-purple-600 dark:text-purple-400">
                            <div className="animate-spin rounded-full h-3 w-3 border border-purple-600 border-t-transparent mr-1"></div>
                            Processing OCR...
                          </div>
                        )}
                        
                        {uploadedFile.ocrCompleted && uploadedFile.ocrData && (
                          <div className="flex items-center text-xs text-green-600 dark:text-green-400">
                            <Eye className="h-3 w-3 mr-1" />
                            OCR Complete ({uploadedFile.ocrConfidence}%)
                          </div>
                        )}
                        
                        {uploadedFile.error && (
                          <div className="flex items-center text-xs text-red-600 dark:text-red-400">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Error
                          </div>
                        )}
                      </div>
                    </div>

                    {uploadedFile.error && (
                      <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                        {uploadedFile.error}
                      </p>
                    )}

                    {/* OCR Results Preview */}
                    {uploadedFile.ocrCompleted && uploadedFile.ocrData && Object.keys(uploadedFile.ocrData).length > 0 && (
                      <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded text-xs">
                        <p className="text-green-800 dark:text-green-400 font-medium mb-1">
                          Extracted Data:
                        </p>
                        <div className="text-green-700 dark:text-green-500 space-y-1">
                          {uploadedFile.ocrData.vendorName && (
                            <div>Vendor: {uploadedFile.ocrData.vendorName}</div>
                          )}
                          {uploadedFile.ocrData.amount && (
                            <div>Amount: ${uploadedFile.ocrData.amount}</div>
                          )}
                          {uploadedFile.ocrData.date && (
                            <div>Date: {uploadedFile.ocrData.date}</div>
                          )}
                          {uploadedFile.ocrData.invoiceNumber && (
                            <div>Invoice #: {uploadedFile.ocrData.invoiceNumber}</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* File Preview */}
                  {uploadedFile.file.type.startsWith('image/') && (
                    <img
                      src={uploadedFile.preview}
                      alt="Preview"
                      className="h-16 w-16 object-cover rounded ml-3"
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUpload;