import React, { useState, useEffect } from 'react';
import { Monitor, Store, CheckCircle, AlertCircle, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useOutlet } from '@/contexts/OutletContext';
import AuthWrapper from '../auth/AuthWrapper';

interface TerminalConfig {
  outlet_id: string;
  outlet_name: string;
  initialized_by: string;
  initialized_at: string;
}

interface TerminalSetupProps {
  onSetupComplete: (config: TerminalConfig) => void;
}

const TerminalSetup: React.FC<TerminalSetupProps> = ({ onSetupComplete }) => {
  const navigate = useNavigate();
  const { currentUser, userOutlets, isLoading, setCurrentUser, setUserOutlets } = useOutlet();
  const [selectedOutletId, setSelectedOutletId] = useState<string>('');
  const [isConfirming, setIsConfirming] = useState(false);

  const formatOutletAddress = (address: unknown): string => {
    if (!address) return 'Not provided';
    if (typeof address === 'string') {
      const trimmed = address.trim();
      return trimmed.length > 0 ? trimmed : 'Not provided';
    }

    if (typeof address === 'object') {
      const addressObj = address as Record<string, unknown>;
      const parts = [
        addressObj.street,
        addressObj.city,
        addressObj.state,
        addressObj.zip,
        addressObj.country,
      ]
        .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
        .map((part) => part.trim());

      if (parts.length > 0) {
        return parts.join(', ');
      }
    }

    return 'Not provided';
  };

  const handleLogout = async () => {
    try {
      // Import supabase dynamically to avoid circular dependency
      const { supabase } = await import('@/lib/supabase');
      await supabase.auth.signOut();

      // Clear local state
      setCurrentUser(null);
      setUserOutlets([]);

      // Clear any stored tokens
      localStorage.removeItem('auth_token');

      // Navigate to auth page
      navigate('/auth');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Auto-select if only one outlet
  useEffect(() => {
    if (userOutlets.length === 1) {
      setSelectedOutletId(userOutlets[0].id);
    }
  }, [userOutlets]);

  const handleSetupComplete = () => {
    if (!currentUser || !selectedOutletId) return;

    const selectedOutlet = userOutlets.find(o => o.id === selectedOutletId);
    if (!selectedOutlet) return;

    const config: TerminalConfig = {
      outlet_id: selectedOutletId,
      outlet_name: selectedOutlet.name,
      initialized_by: currentUser.email,
      initialized_at: new Date().toISOString(),
    };

    // Store terminal configuration
    localStorage.setItem('pos_terminal_config', JSON.stringify(config));

    onSetupComplete(config);
  };

  // Show auth wrapper if not authenticated
  if (!currentUser) {
    return (
      <AuthWrapper
        onAuthSuccess={() => {
          // Will trigger re-render with currentUser populated
        }}
      />
    );
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading outlets...</p>
        </div>
      </div>
    );
  }

  // Show no outlets message
  if (userOutlets.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            No Outlets Found
          </h1>

          <p className="text-gray-600 mb-6">
            Your account doesn't have access to any outlets. Please contact your administrator or create an outlet from the admin dashboard.
          </p>

          <button
            onClick={() => window.location.href = 'http://localhost:5173'}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Open Admin Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Monitor className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">POS Terminal Setup</h1>
          <p className="text-gray-600 mt-2">Initialize this terminal for your outlet</p>
        </div>

        {/* User Info */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Authenticated as</p>
                <p className="text-sm text-gray-600">{currentUser.email}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>

        {/* Outlet Selection */}
        <div className="mb-8">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Select Outlet for This Terminal
          </label>
          <div className="space-y-3">
            {userOutlets.map((outlet) => (
              <div
                key={outlet.id}
                className={`
                  relative rounded-lg border-2 p-4 cursor-pointer transition-all
                  ${selectedOutletId === outlet.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                  }
                `}
                onClick={() => setSelectedOutletId(outlet.id)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                    <Store className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">{outlet.name}</h3>
                    <p className="text-sm text-gray-600">{formatOutletAddress(outlet.address)}</p>
                  </div>
                </div>

                {selectedOutletId === outlet.id && (
                  <div className="absolute top-4 right-4">
                    <CheckCircle className="w-5 h-5 text-blue-600" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Warning Message */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-yellow-800">Important</h4>
              <p className="text-sm text-yellow-700 mt-1">
                This terminal will be locked to the selected outlet. Staff will use PINs to clock in and operate this terminal.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <button
            onClick={handleLogout}
            className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
          <button
            onClick={() => setIsConfirming(true)}
            disabled={!selectedOutletId}
            className="flex-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            Initialize Terminal
          </button>
        </div>

        {/* Confirmation Modal */}
        {isConfirming && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Confirm Terminal Setup
              </h3>
              <p className="text-gray-600 mb-6">
                Are you sure you want to initialize this terminal for{' '}
                <span className="font-semibold">
                  {userOutlets.find(o => o.id === selectedOutletId)?.name}
                </span>?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setIsConfirming(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSetupComplete}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TerminalSetup;
