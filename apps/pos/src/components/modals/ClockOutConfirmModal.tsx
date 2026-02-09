import React from 'react';
import { LogOut, User, X } from 'lucide-react';

interface ClockOutConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  staffName: string;
}

const ClockOutConfirmModal: React.FC<ClockOutConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  staffName
}) => {
  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg border border-gray-200 shadow-lg max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-center">
              <LogOut className="w-5 h-5 text-gray-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Clock Out</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-50 rounded-lg transition-colors border border-gray-200"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          <div className="flex items-center space-x-4 mb-6">
            <div className="w-12 h-12 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-center">
              <User className="w-6 h-6 text-gray-600" />
            </div>
            <div>
              <p className="text-gray-900 font-medium">{staffName}</p>
              <p className="text-sm text-gray-500">Staff Member</p>
            </div>
          </div>

          <p className="text-gray-700 mb-6">
            Are you sure you want to clock out? This will end your current session and return to the authentication screen.
          </p>

          {/* Actions */}
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Clock Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClockOutConfirmModal;