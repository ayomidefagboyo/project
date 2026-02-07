import React, { useState, useRef, useEffect } from 'react';
import { X, Hash, Delete, User, AlertCircle, Loader } from 'lucide-react';
import { staffService } from '@/lib/staffService';
import type { StaffProfile, StaffAuthResponse } from '@/types';
import { useOutlet } from '@/contexts/OutletContext';

interface PinEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (staffAuth: StaffAuthResponse) => void;
  staffProfiles: StaffProfile[];
  onManagerLogin?: () => void;
}

const PinEntryModal: React.FC<PinEntryModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  staffProfiles,
  onManagerLogin
}) => {
  const { currentOutlet } = useOutlet();
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [pin, setPin] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState('');
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);

  const pinInputRef = useRef<HTMLInputElement>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setPin('');
      setSelectedStaffId('');
      setError('');
      setAttemptsRemaining(null);
    }
  }, [isOpen]);

  // Focus pin input when staff is selected
  useEffect(() => {
    if (selectedStaffId && pinInputRef.current) {
      pinInputRef.current.focus();
    }
  }, [selectedStaffId]);

  // PIN pad numbers
  const pinPadNumbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, ''];

  const selectedStaff = staffProfiles.find(s => s.id === selectedStaffId);

  const handleStaffSelect = (staffId: string) => {
    setSelectedStaffId(staffId);
    setPin('');
    setError('');
    setAttemptsRemaining(null);
  };

  const handlePinInput = (digit: number | string) => {
    if (typeof digit === 'number' && pin.length < 6) {
      setPin(prev => prev + digit.toString());
      setError('');
    }
  };

  const handlePinDelete = () => {
    setPin(prev => prev.slice(0, -1));
    setError('');
  };

  const handlePinClear = () => {
    setPin('');
    setError('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key >= '0' && e.key <= '9') {
      handlePinInput(parseInt(e.key));
    } else if (e.key === 'Backspace') {
      handlePinDelete();
    } else if (e.key === 'Enter' && pin.length === 6) {
      handleLogin();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const handleLogin = async () => {
    if (!selectedStaffId || !currentOutlet?.id || pin.length !== 6) {
      setError('Please enter a complete 6-digit PIN');
      return;
    }

    const selectedStaffProfile = staffProfiles.find(s => s.id === selectedStaffId);
    if (!selectedStaffProfile) {
      setError('Selected staff not found');
      return;
    }

    setIsAuthenticating(true);
    setError('');

    try {
      const authResponse = await staffService.authenticateWithPin({
        staff_code: selectedStaffProfile.staff_code,
        pin,
        outlet_id: currentOutlet.id
      });

      onSuccess(authResponse);

    } catch (error: any) {
      console.error('PIN authentication failed:', error);

      if (error.message?.includes('locked') || error.message?.includes('attempts')) {
        setError('Account locked due to too many failed attempts');
        setAttemptsRemaining(0);
      } else if (error.message?.includes('Invalid')) {
        // Get updated profile to show attempts remaining
        const updatedProfile = selectedStaff;
        if (updatedProfile) {
          const remaining = Math.max(0, 5 - (updatedProfile.failed_login_attempts + 1));
          setAttemptsRemaining(remaining);
          setError(`Invalid PIN. ${remaining} attempts remaining.`);
        } else {
          setError('Invalid staff code or PIN');
        }
      } else {
        setError('Login failed. Please try again.');
      }

      setPin('');
    } finally {
      setIsAuthenticating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div
        className="bg-white rounded-lg shadow-lg w-full max-w-md"
        onKeyDown={handleKeyPress}
        tabIndex={-1}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center space-x-3">
            <Hash className="w-6 h-6 text-blue-600" />
            <h2 className="text-lg font-bold text-gray-900">Staff Login</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {/* Staff Selection */}
          {!selectedStaffId ? (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">Select Staff Member</h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {staffProfiles.filter(s => s.is_active).map((staff) => (
                  <button
                    key={staff.id}
                    onClick={() => handleStaffSelect(staff.id)}
                    className="w-full flex items-center space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 text-left"
                  >
                    <User className="w-8 h-8 text-gray-400" />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{staff.display_name}</div>
                      <div className="text-sm text-gray-500">
                        {staff.role}
                      </div>
                    </div>
                    {staff.failed_login_attempts > 0 && (
                      <AlertCircle className="w-4 h-4 text-amber-500" />
                    )}
                  </button>
                ))}
              </div>

              {staffProfiles.filter(s => s.is_active).length === 0 && (
                <div className="text-center py-8">
                  <User className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-500">No active staff profiles found</p>
                  <p className="text-sm text-gray-400">Contact your manager to set up staff access</p>
                </div>
              )}
            </div>
          ) : (
            /* PIN Entry */
            <div>
              {/* Selected Staff */}
              <div className="flex items-center space-x-3 mb-6 p-3 bg-gray-50 rounded-lg">
                <User className="w-8 h-8 text-gray-600" />
                <div>
                  <div className="font-medium text-gray-900">{selectedStaff?.display_name}</div>
                  <div className="text-sm text-gray-500">{selectedStaff?.role}</div>
                </div>
                <button
                  onClick={() => setSelectedStaffId('')}
                  className="ml-auto text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Error Display */}
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center text-red-800">
                    <AlertCircle className="w-4 h-4 mr-2" />
                    <span className="text-sm">{error}</span>
                  </div>
                </div>
              )}

              {/* PIN Display */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Enter 6-digit PIN
                </label>
                <div className="flex justify-center space-x-2 mb-4">
                  {[...Array(6)].map((_, index) => (
                    <div
                      key={index}
                      className={`w-12 h-12 border-2 rounded-lg flex items-center justify-center text-xl font-bold ${
                        pin.length > index
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-300 bg-white'
                      }`}
                    >
                      {pin.length > index ? '●' : ''}
                    </div>
                  ))}
                </div>

                {/* Hidden input for keyboard entry */}
                <input
                  ref={pinInputRef}
                  type="password"
                  value={pin}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setPin(value);
                    setError('');
                  }}
                  className="sr-only"
                  maxLength={6}
                  autoComplete="off"
                />
              </div>

              {/* PIN Pad */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                {pinPadNumbers.map((num, index) => (
                  <button
                    key={index}
                    onClick={() => typeof num === 'number' && handlePinInput(num)}
                    disabled={typeof num !== 'number'}
                    className={`h-14 rounded-lg text-xl font-bold transition-colors ${
                      typeof num === 'number'
                        ? 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                        : 'invisible'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3">
                <button
                  onClick={handlePinClear}
                  className="flex-1 flex items-center justify-center py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Clear
                </button>

                <button
                  onClick={handlePinDelete}
                  className="flex items-center justify-center px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <Delete className="w-5 h-5" />
                </button>

                <button
                  onClick={handleLogin}
                  disabled={pin.length !== 6 || isAuthenticating}
                  className="flex-1 flex items-center justify-center py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isAuthenticating ? (
                    <>
                      <Loader className="w-4 h-4 mr-2 animate-spin" />
                      Logging in...
                    </>
                  ) : (
                    'Login'
                  )}
                </button>
              </div>

              {/* Attempts Warning */}
              {attemptsRemaining !== null && attemptsRemaining <= 2 && attemptsRemaining > 0 && (
                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-center text-amber-800">
                    <AlertCircle className="w-4 h-4 mr-2" />
                    <span className="text-sm">
                      Warning: Only {attemptsRemaining} attempt{attemptsRemaining !== 1 ? 's' : ''} remaining
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Manager Login & Keyboard Shortcut Info */}
        <div className="px-6 pb-4 space-y-3">
          {/* Manager Login Button */}
          {onManagerLogin && (
            <div className="text-center">
              <button
                onClick={onManagerLogin}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium underline"
              >
                Manager Login
              </button>
            </div>
          )}

          {/* Keyboard Shortcuts */}
          <div className="text-xs text-gray-500 text-center">
            Use number keys to enter PIN • Press Enter to login • ESC to close
          </div>
        </div>
      </div>
    </div>
  );
};

export default PinEntryModal;