import React, { useState } from 'react';
import { User, Hash } from 'lucide-react';

interface SimplePinEntryProps {
  onAuthenticated: () => void;
}

const SimplePinEntry: React.FC<SimplePinEntryProps> = ({ onAuthenticated }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const handlePinInput = (digit: string) => {
    if (pin.length < 6) {
      setPin(prev => prev + digit);
      setError('');
    }
  };

  const handlePinDelete = () => {
    setPin(prev => prev.slice(0, -1));
    setError('');
  };

  const handleLogin = () => {
    if (pin === '123456') {
      // Store simple auth state
      localStorage.setItem('pos_authenticated', 'true');
      localStorage.setItem('pos_user', JSON.stringify({
        name: 'Admin',
        role: 'manager',
        loginTime: new Date().toISOString()
      }));
      onAuthenticated();
    } else {
      setError('Invalid PIN. Use: 123456');
      setPin('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key >= '0' && e.key <= '9') {
      handlePinInput(e.key);
    } else if (e.key === 'Backspace') {
      handlePinDelete();
    } else if (e.key === 'Enter' && pin.length === 6) {
      handleLogin();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">POS System</h1>
          <p className="text-gray-600 mt-2">Enter your PIN to continue</p>
        </div>

        {/* PIN Display */}
        <div className="flex justify-center space-x-3 mb-6">
          {[...Array(6)].map((_, index) => (
            <div
              key={index}
              className={`w-12 h-12 border-2 rounded-lg flex items-center justify-center text-xl font-medium ${
                pin.length > index
                  ? 'border-blue-500 bg-blue-50 text-blue-600'
                  : 'border-gray-200 bg-gray-50'
              }`}
            >
              {pin.length > index ? '•' : ''}
            </div>
          ))}
        </div>

        {/* Error Display */}
        {error && (
          <div className="text-center mb-4">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        {/* PIN Pad */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              onClick={() => handlePinInput(num.toString())}
              className="h-14 bg-gray-100 hover:bg-gray-200 rounded-lg font-semibold text-lg transition-colors"
            >
              {num}
            </button>
          ))}
          <button
            onClick={handlePinDelete}
            className="h-14 bg-gray-100 hover:bg-gray-200 rounded-lg font-semibold text-lg transition-colors"
          >
            ⌫
          </button>
          <button
            onClick={() => handlePinInput('0')}
            className="h-14 bg-gray-100 hover:bg-gray-200 rounded-lg font-semibold text-lg transition-colors"
          >
            0
          </button>
          <button
            onClick={handleLogin}
            disabled={pin.length !== 6}
            className="h-14 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-colors"
          >
            ✓
          </button>
        </div>

        {/* Instructions */}
        <div className="text-center">
          <p className="text-sm text-gray-500">
            Default PIN: <span className="font-mono font-bold">123456</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SimplePinEntry;