import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Lock, ArrowRight, Chrome } from 'lucide-react';
import { authService } from '@/lib/auth';
import { useOutlet } from '@/contexts/OutletContext';

interface LoginFormProps {
  onSuccess?: () => void;
  onSwitchToSignup?: () => void;
}

const LoginForm: React.FC<LoginFormProps> = ({ onSuccess, onSwitchToSignup }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setCurrentUser, setUserOutlets, setCurrentOutlet } = useOutlet();

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
        
        // Get user's outlets
        const { data: outlets, error: outletsError } = await authService.getUserOutlets(user.id);
        
        if (outlets && !outletsError) {
          setUserOutlets(outlets);
          
          // Set first outlet as current
          if (outlets.length > 0) {
            setCurrentOutlet(outlets[0]);
          }
        }

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
        
        // Get user's outlets
        const { data: outlets, error: outletsError } = await authService.getUserOutlets(user.id);
        
        if (outlets && !outletsError) {
          setUserOutlets(outlets);
          
          // Set first outlet as current
          if (outlets.length > 0) {
            setCurrentOutlet(outlets[0]);
          }
        }

        onSuccess?.();
      }
    } catch (err) {
      setError('Google sign-in failed');
      console.error('Google sign-in error:', err);
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left side - Brand/Marketing */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary to-primary/80"></div>
        <div className="relative z-10 flex flex-col justify-center px-16 py-24">
          <div className="mb-12">
            <Link to="/" className="text-3xl font-light text-primary-foreground tracking-tight">
              Compazz
            </Link>
          </div>
          <div className="max-w-md">
            <h1 className="text-4xl font-light text-primary-foreground mb-6 leading-tight">
              Welcome back to your financial command center
            </h1>
            <p className="text-lg text-primary-foreground/80 font-light leading-relaxed">
              Access your dashboard, manage outlets, and get insights that drive your business forward.
            </p>
          </div>
          <div className="mt-16 space-y-4">
            <div className="flex items-center text-primary-foreground/60">
              <div className="w-2 h-2 bg-primary-foreground/40 rounded-full mr-4"></div>
              <span className="font-light">Trusted by 1200+ businesses</span>
            </div>
            <div className="flex items-center text-primary-foreground/60">
              <div className="w-2 h-2 bg-primary-foreground/40 rounded-full mr-4"></div>
              <span className="font-light">99.9% uptime guarantee</span>
            </div>
            <div className="flex items-center text-primary-foreground/60">
              <div className="w-2 h-2 bg-primary-foreground/40 rounded-full mr-4"></div>
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
            <Link to="/" className="text-3xl font-light text-foreground tracking-tight">
              Compazz
            </Link>
          </div>

          {/* Header */}
          <div className="text-center lg:text-left">
            <h2 className="text-3xl lg:text-4xl font-light text-foreground mb-3 tracking-tight">
              Sign in to your account
            </h2>
            <p className="text-muted-foreground font-light">
              Access your business management platform
            </p>
          </div>

          {/* Google Sign In */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isGoogleLoading || isLoading}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 border border-border rounded-lg text-foreground bg-background hover:bg-accent transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGoogleLoading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-foreground"></div>
            ) : (
              <Chrome className="w-5 h-5" />
            )}
            {isGoogleLoading ? 'Signing in...' : 'Continue with Google'}
          </button>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-background text-muted-foreground font-light">or continue with email</span>
            </div>
          </div>

          {/* Email Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-5">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-foreground mb-2">
                  Email address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pl-12 pr-4 py-4 border border-border rounded-lg text-foreground placeholder-muted-foreground bg-background focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 font-light"
                    placeholder="Enter your email"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-foreground mb-2">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-12 pr-4 py-4 border border-border rounded-lg text-foreground placeholder-muted-foreground bg-background focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 font-light"
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
              className="w-full btn-primary py-4 text-lg font-medium group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-foreground mr-3"></div>
                  Signing in...
                </div>
              ) : (
                <div className="flex items-center justify-center">
                  Sign in
                  <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                </div>
              )}
            </button>

            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={() => email && authService.resetPassword(email)}
                className="font-medium text-primary hover:text-primary/80 transition-colors"
              >
                Forgot password?
              </button>
              <button
                type="button"
                onClick={onSwitchToSignup}
                className="font-medium text-primary hover:text-primary/80 transition-colors"
              >
                Create account
              </button>
            </div>
          </form>

          {/* Footer */}
          <div className="text-center text-xs text-muted-foreground font-light">
            By continuing, you agree to our{' '}
            <Link to="/terms" className="text-primary hover:text-primary/80">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link to="/privacy" className="text-primary hover:text-primary/80">
              Privacy Policy
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;