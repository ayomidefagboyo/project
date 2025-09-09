import React, { useState, useEffect } from 'react';
import { X, CheckCircle, AlertCircle, XCircle, Info } from 'lucide-react';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  onClose: () => void;
  isVisible: boolean;
}

const Toast: React.FC<ToastProps> = ({
  message,
  type = 'info',
  duration = 4000,
  onClose,
  isVisible
}) => {
  useEffect(() => {
    if (isVisible && duration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [isVisible, duration, onClose]);

  const getToastStyles = () => {
    switch (type) {
      case 'success':
        return 'bg-green-100 border-green-300 text-green-800 shadow-lg backdrop-blur-sm dark:bg-green-800 dark:border-green-600 dark:text-green-100';
      case 'error':
        return 'bg-red-100 border-red-300 text-red-800 shadow-lg backdrop-blur-sm dark:bg-red-800 dark:border-red-600 dark:text-red-100';
      case 'warning':
        return 'bg-yellow-100 border-yellow-300 text-yellow-800 shadow-lg backdrop-blur-sm dark:bg-yellow-800 dark:border-yellow-600 dark:text-yellow-100';
      default:
        return 'bg-blue-100 border-blue-300 text-blue-800 shadow-lg backdrop-blur-sm dark:bg-blue-800 dark:border-blue-600 dark:text-blue-100';
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-300" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-600 dark:text-red-300" />;
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-300" />;
      default:
        return <Info className="h-5 w-5 text-blue-600 dark:text-blue-300" />;
    }
  };

  if (!isVisible) return null;

  return (
    <div className={`fixed top-4 right-4 z-50 transform transition-all duration-300 ease-in-out ${
      isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
    }`}>
      <div className={`
        min-w-80 max-w-md w-full border-2 rounded-xl shadow-2xl p-4 flex items-center gap-3
        ${getToastStyles()}
      `}>
        {getIcon()}
        <p className="flex-1 text-sm font-semibold">{message}</p>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-gray-100 transition-colors flex-shrink-0"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default Toast;