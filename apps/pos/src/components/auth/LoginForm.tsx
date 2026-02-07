import React, { useState } from 'react';
import { Mail, Lock, ArrowRight, Chrome } from 'lucide-react';
import { authService } from '@/lib/auth';
import { useOutlet } from '@/contexts/OutletContext';

interface LoginFormProps {
  onSuccess?: () => void;
  onSwitchToSignup?: () => void;
  isModal?: boolean;
}

const LoginForm: React.FC<LoginFormProps> = ({ onSuccess, onSwitchToSignup, isModal = false }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setCurrentUser, setUserOutlets, setCurrentOutlet } = useOutlet();

  // Helper function to handle email changes with storage
  const handleEmailChange = (value: string) => {
    setEmail(value);
    // Store email in localStorage for smart routing if it's a valid email
    if (value.includes('@')) {
      localStorage.setItem('last_signup_email', value.toLowerCase());
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const { user, error: authError } = await authService.signIn({ email, password });

      if (authError) {
        setError(authError);
        return;
      }

      if (user) {
        setCurrentUser(user);
        onSuccess?.();
      }
    } catch (err) {
      setError('An unexpected error occurred');
      console.error('Login error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    setError(null);

    try {
      const { user, error: authError } = await authService.signInWithGoogle();

      if (authError) {
        setError(authError);
        return;
      }

      if (user) {
        setCurrentUser(user);
        onSuccess?.();
      }
    } catch (err) {
      setError('Google authentication failed');
      console.error('Google authentication error:', err);
    } finally {
      setIsGoogleLoading(false);
    }
  };

  // Modal version for POS
  if (isModal) {
    return (
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Manager Login
          </h2>
          <p className="text-gray-600">
            Sign in to access staff management
          </p>
        </div>

        {/* Google Sign In */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={isGoogleLoading || isLoading}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isGoogleLoading ? (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-700"></div>
          ) : (
            <Chrome className="w-5 h-5" />
          )}
          {isGoogleLoading ? 'Authenticating...' : 'Continue with Google'}
        </button>

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-white text-gray-500">or continue with email</span>
          </div>
        </div>

        {/* Email Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-gray-400" />
              </div>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => handleEmailChange(e.target.value)}
                className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter your email"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-400" />
              </div>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter your password"
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || isGoogleLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Signing in...
              </div>
            ) : (
              <div className="flex items-center justify-center">
                Sign in
                <ArrowRight className="ml-2 h-5 w-5" />
              </div>
            )}
          </button>

          <div className="flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={() => email && authService.resetPassword(email)}
              className="font-medium text-blue-600 hover:text-blue-500"
            >
              Forgot password?
            </button>
            {onSwitchToSignup && (
              <button
                type="button"
                onClick={onSwitchToSignup}
                className="font-medium text-blue-600 hover:text-blue-500"
              >
                Create account
              </button>
            )}
          </div>
        </form>
      </div>
    );
  }

  // Full page version (copied from dashboard)
  return (
    <div className="flex min-h-screen">
      {/* Left side - Brand/Marketing */}
      <div className="hidden lg:flex lg:w-1/2 bg-blue-600 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-blue-800"></div>
        <div className="relative z-10 flex flex-col justify-center px-16 py-24">
          <div className="mb-12">
            <div className="text-3xl font-light text-white tracking-tight">
              Compazz
            </div>
          </div>
          <div className="max-w-md">
            <h1 className="text-4xl font-light text-white mb-6 leading-tight">
              Welcome back to your POS system
            </h1>
            <p className="text-lg text-blue-100 font-light leading-relaxed">
              Access your dashboard, manage staff, and control your business operations.
            </p>
          </div>
          <div className="mt-16 space-y-4">
            <div className="flex items-center text-blue-200">
              <div className="w-2 h-2 bg-blue-300 rounded-full mr-4"></div>
              <span className="font-light">Trusted by 1200+ businesses</span>
            </div>
            <div className="flex items-center text-blue-200">
              <div className="w-2 h-2 bg-blue-300 rounded-full mr-4"></div>
              <span className="font-light">99.9% uptime guarantee</span>
            </div>
            <div className="flex items-center text-blue-200">
              <div className="w-2 h-2 bg-blue-300 rounded-full mr-4"></div>
              <span className="font-light">Enterprise-grade security</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-24">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile logo */}
          <div className="lg:hidden text-center">
            <div className="text-3xl font-light text-gray-900 tracking-tight">
              Compazz
            </div>
          </div>

          {/* Header */}
          <div className="text-center lg:text-left">
            <h2 className="text-3xl lg:text-4xl font-light text-gray-900 mb-3 tracking-tight">
              Sign in to your account
            </h2>
            <p className="text-gray-600 font-light">
              Access your business management platform
            </p>
          </div>

          {/* Google Sign In */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isGoogleLoading || isLoading}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGoogleLoading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-700"></div>
            ) : (
              <Chrome className="w-5 h-5" />
            )}
            {isGoogleLoading ? 'Authenticating...' : 'Continue with Google'}
          </button>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-gray-500 font-light">or continue with email</span>
            </div>
          </div>

          {/* Email Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-5">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-900 mb-2">
                  Email address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => handleEmailChange(e.target.value)}
                    className="block w-full pl-12 pr-4 py-4 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 font-light"
                    placeholder="Enter your email"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-900 mb-2">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-12 pr-4 py-4 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 font-light"
                    placeholder="Enter your password"
                  />
                </div>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800 text-sm font-light">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || isGoogleLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 px-6 rounded-lg text-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                  Signing in...
                </div>
              ) : (
                <div className="flex items-center justify-center">
                  Sign in
                  <ArrowRight className="ml-2 h-5 w-5" />
                </div>
              )}
            </button>

            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={() => email && authService.resetPassword(email)}
                className="font-medium text-blue-600 hover:text-blue-500 transition-colors"
              >
                Forgot password?
              </button>
              {onSwitchToSignup && (
                <button
                  type="button"
                  onClick={onSwitchToSignup}
                  className="font-medium text-blue-600 hover:text-blue-500 transition-colors"
                >
                  Create account
                </button>
              )}
            </div>
          </form>

          {/* Footer */}
          <div className="text-center text-xs text-gray-500 font-light">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;