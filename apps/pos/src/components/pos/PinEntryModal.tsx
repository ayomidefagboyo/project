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
  onForceReload?: () => void;
}

const PinEntryModal: React.FC<PinEntryModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  staffProfiles,
  onManagerLogin,
  onForceReload
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
    <div className="fixed inset-0 bg-white z-50 flex">
      <div
        className="bg-white w-full h-full flex flex-col"
        onKeyDown={handleKeyPress}
        tabIndex={-1}
      >
        {/* Premium Minimalist Header */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-gray-100">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-center">
              <Hash className="w-6 h-6 text-gray-600" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Staff Authentication</h1>
              <p className="text-sm text-gray-500 mt-1">Select your profile and enter PIN</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-3 hover:bg-gray-50 rounded-lg transition-colors border border-gray-200"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="flex-1 p-8 overflow-y-auto">
          {/* Premium Staff Selection */}
          {!selectedStaffId ? (
            <div className="h-full flex flex-col">
              <h3 className="text-xl font-semibold text-gray-900 mb-8 text-center">Select Your Profile</h3>
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto">
                {staffProfiles.filter(s => s.is_active).map((staff) => (
                  <button
                    key={staff.id}
                    onClick={() => handleStaffSelect(staff.id)}
                    className="flex flex-col items-center space-y-3 p-6 bg-white border border-gray-200 rounded-lg hover:border-blue-500 hover:shadow-sm text-center transition-all duration-200"
                  >
                    <div className="w-16 h-16 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-center">
                      <User className="w-8 h-8 text-gray-600" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900 text-lg">{staff.display_name}</div>
                      <div className="text-sm text-gray-500 capitalize">
                        {staff.role.replace('_', ' ')}
                      </div>
                    </div>
                    {staff.failed_login_attempts > 0 && (
                      <div className="flex items-center space-x-1 px-2 py-1 bg-red-50 border border-red-200 rounded text-xs text-red-600">
                        <AlertCircle className="w-3 h-3" />
                        <span>Locked</span>
                      </div>
                    )}
                  </button>
                ))}
              </div>

              {staffProfiles.filter(s => s.is_active).length === 0 && (
                <div className="text-center py-8">
                  <User className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-500">No active staff profiles found</p>
                  <p className="text-sm text-gray-400">Contact your manager to set up staff access</p>

                  <div className="mt-6">
                    <button
                      onClick={() => {
                        if (onForceReload) {
                          onForceReload();
                        }
                      }}
                      className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                    >
                      Refresh Profiles
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Premium PIN Entry */
            <div>
              {/* Selected Staff - Minimalist Design */}
              <div className="flex items-center space-x-4 mb-8 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <div className="w-10 h-10 bg-white border border-gray-200 rounded-lg flex items-center justify-center">
                  <User className="w-5 h-5 text-gray-600" />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{selectedStaff?.display_name}</div>
                  <div className="text-sm text-gray-500 capitalize">{selectedStaff?.role?.replace('_', ' ')}</div>
                </div>
                <button
                  onClick={() => setSelectedStaffId('')}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white rounded-lg transition-colors border border-gray-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Premium Error Display */}
              {error && (
                <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center text-red-700">
                    <AlertCircle className="w-4 h-4 mr-2" />
                    <span className="text-sm font-medium">{error}</span>
                  </div>
                </div>
              )}

              {/* Premium PIN Display */}
              <div className="flex flex-col items-center mb-8">
                <label className="block text-xl font-semibold text-gray-900 mb-6 text-center">
                  Enter Your PIN
                </label>
                <div className="flex justify-center space-x-3 mb-6">
                  {[...Array(6)].map((_, index) => (
                    <div
                      key={index}
                      className={`w-12 h-12 border-2 rounded-lg flex items-center justify-center text-xl font-medium transition-all duration-200 ${
                        pin.length > index
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 bg-white'
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

              {/* Premium Touch PIN Pad */}
              <div className="grid grid-cols-3 gap-4 mb-8 max-w-xs mx-auto">
                {pinPadNumbers.map((num, index) => (
                  <button
                    key={index}
                    onClick={() => typeof num === 'number' && handlePinInput(num)}
                    disabled={typeof num !== 'number'}
                    className={`h-14 w-14 rounded-lg text-lg font-medium transition-all duration-200 ${
                      typeof num === 'number'
                        ? 'bg-white border border-gray-200 hover:border-blue-500 hover:bg-blue-50 text-gray-900'
                        : 'invisible'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>

              {/* Premium Action Buttons */}
              <div className="flex space-x-3 max-w-lg mx-auto">
                <button
                  onClick={handlePinClear}
                  className="flex-1 flex items-center justify-center py-3 px-4 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-all duration-200 font-medium"
                >
                  <Delete className="w-4 h-4 mr-2" />
                  Clear
                </button>

                <button
                  onClick={handlePinDelete}
                  className="flex items-center justify-center px-4 py-3 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-all duration-200"
                >
                  <Delete className="w-4 h-4" />
                </button>

                <button
                  onClick={handleLogin}
                  disabled={pin.length !== 6 || isAuthenticating}
                  className="flex-1 flex items-center justify-center py-3 px-6 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {isAuthenticating ? (
                    <>
                      <Loader className="w-4 h-4 mr-2 animate-spin" />
                      Authenticating...
                    </>
                  ) : (
                    'Sign In'
                  )}
                </button>
              </div>

              {/* Premium Attempts Warning */}
              {attemptsRemaining !== null && attemptsRemaining <= 2 && attemptsRemaining > 0 && (
                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-center text-amber-700">
                    <AlertCircle className="w-4 h-4 mr-2" />
                    <span className="text-sm">
                      {attemptsRemaining} attempt{attemptsRemaining !== 1 ? 's' : ''} remaining
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Premium Footer */}
        <div className="px-8 py-4 border-t border-gray-100 bg-gray-50 space-y-3">
          {/* Manager Login Button */}
          {onManagerLogin && (
            <div className="text-center">
              <button
                onClick={onManagerLogin}
                className="px-4 py-2 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 border border-blue-200 rounded-lg font-medium transition-colors"
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
