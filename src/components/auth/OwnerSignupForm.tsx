import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Lock, User, Chrome, ArrowRight, Check, Star } from 'lucide-react';
import { paymentPlans } from '@/lib/stripe';
import { authService } from '@/lib/auth';
import { useOutlet } from '@/contexts/OutletContext';

interface OwnerSignupFormProps {
  onSuccess?: () => void;
  onSwitchToLogin?: () => void;
  selectedPlan?: string | null;
  isTrial?: boolean;
}

const OwnerSignupForm: React.FC<OwnerSignupFormProps> = ({ onSuccess, onSwitchToLogin, selectedPlan, isTrial }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    companyName: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setCurrentUser, setUserOutlets, setCurrentOutlet } = useOutlet();


  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long');
      setIsLoading(false);
      return;
    }

    if (!formData.companyName.trim()) {
      setError('Company name is required');
      setIsLoading(false);
      return;
    }

    try {
      const { user, error: authError } = await authService.signUpOwner({
        email: formData.email,
        password: formData.password,
        name: formData.name,
        companyName: formData.companyName,
      });

      if (authError) {
        setError(authError);
        return;
      }

      if (user) {
        setCurrentUser(user);
        
        // Get user's outlets (should be just the one they created)
        const { data: outlets, error: outletsError } = await authService.getUserOutlets(user.id);
        
        if (outlets && !outletsError) {
          setUserOutlets(outlets);
          
          // Set the created outlet as current
          if (outlets.length > 0) {
            setCurrentOutlet(outlets[0]);
          }
        }

        onSuccess?.();
      }
    } catch (err) {
      setError('An unexpected error occurred');
      console.error('Owner signup error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
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
      setError('Google sign-up failed');
      console.error('Google sign-up error:', err);
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Left side - Brand/Marketing */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary to-primary/80"></div>
        <div className="relative z-10 flex flex-col justify-center px-12 py-8">
          <div className="mb-12">
            <Link to="/" className="text-3xl font-light text-primary-foreground tracking-tight">
              Compazz
            </Link>
          </div>
          <div className="max-w-md">
            <h1 className="text-4xl font-light text-primary-foreground mb-6 leading-tight">
              Start your financial transformation today
            </h1>
            <p className="text-lg text-primary-foreground/80 font-light leading-relaxed mb-8">
              Join thousands of businesses streamlining their finances with AI-powered management.
            </p>
            <div className="space-y-4 mb-8">
              <div className="flex items-center text-primary-foreground/60">
                <div className="w-2 h-2 bg-primary-foreground/40 rounded-full mr-4"></div>
                <span className="font-light">Free 14-day trial</span>
              </div>
              <div className="flex items-center text-primary-foreground/60">
                <div className="w-2 h-2 bg-primary-foreground/40 rounded-full mr-4"></div>
                <span className="font-light">No credit card required</span>
              </div>
              <div className="flex items-center text-primary-foreground/60">
                <div className="w-2 h-2 bg-primary-foreground/40 rounded-full mr-4"></div>
                <span className="font-light">Setup in under 5 minutes</span>
              </div>
            </div>

            {/* Reviews Section */}
            <div className="space-y-4">
              <div className="flex items-center space-x-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star key={star} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                ))}
                <span className="ml-2 text-primary-foreground/80 font-light">4.8/5 from 280+ businesses</span>
              </div>
              <div className="space-y-3">
                <div className="bg-primary-foreground/10 rounded-lg p-4">
                  <p className="text-primary-foreground/80 text-sm font-light italic">
                    "We were losing £3K monthly to inventory shrinkage until Compazz's anomaly detection flagged suspicious patterns. Now our evening staff knows we're watching - shrinkage dropped 80%."
                  </p>
                  <p className="text-primary-foreground/60 text-xs mt-2">- Marcus Chen, Convenience Store Chain (4 locations)</p>
                </div>
                <div className="bg-primary-foreground/10 rounded-lg p-4">
                  <p className="text-primary-foreground/80 text-sm font-light italic">
                    "My accountant used to take 3 days to reconcile our books. With Compazz, everything's automated - I get real-time insights and caught a supplier double-billing us £800 last month."
                  </p>
                  <p className="text-primary-foreground/60 text-xs mt-2">- Priya Sharma, Beauty Salon & Spa</p>
                </div>
                <div className="bg-primary-foreground/10 rounded-lg p-4">
                  <p className="text-primary-foreground/80 text-sm font-light italic">
                    "The AI told us Tuesday lunch sales were 40% higher when we played jazz vs pop music. Small insight, but it's boosting our weekly revenue by £200+."
                  </p>
                  <p className="text-primary-foreground/60 text-xs mt-2">- David Okafor, Coffee Roastery & Cafe</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Signup Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-8 overflow-y-auto">
        <div className="w-full max-w-lg space-y-6">
          {/* Mobile logo */}
          <div className="lg:hidden text-center">
            <Link to="/" className="text-3xl font-light text-foreground tracking-tight">
              Compazz
            </Link>
          </div>

          {/* Header */}
          <div className="text-center lg:text-left">
            <h2 className="text-2xl lg:text-3xl font-light text-foreground mb-2 tracking-tight">
              Create your business account
            </h2>
            <p className="text-muted-foreground font-light text-sm">
              Set up your company and start managing finances like never before
            </p>
          </div>


          {/* Google Sign Up */}
          <button
            type="button"
            onClick={handleGoogleSignUp}
            disabled={isGoogleLoading || isLoading}
            className="w-full flex items-center justify-center gap-3 px-6 py-3 border border-border rounded-lg text-foreground bg-background hover:bg-accent transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGoogleLoading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-foreground"></div>
            ) : (
              <Chrome className="w-5 h-5" />
            )}
            {isGoogleLoading ? 'Creating account...' : 'Continue with Google'}
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
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-foreground mb-2">
                    Name
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <User className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <input
                      id="name"
                      name="name"
                      type="text"
                      required
                      value={formData.name}
                      onChange={handleChange}
                      className="block w-full pl-12 pr-4 py-3 border border-border rounded-lg text-foreground placeholder-muted-foreground bg-background focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 font-light"
                      placeholder="Your full name"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-foreground mb-2">
                    Email Address
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
                      value={formData.email}
                      onChange={handleChange}
                      className="block w-full pl-12 pr-4 py-3 border border-border rounded-lg text-foreground placeholder-muted-foreground bg-background focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 font-light"
                      placeholder="your@email.com"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="companyName" className="block text-sm font-medium text-foreground mb-2">
                    Company Name
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Building className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <input
                      id="companyName"
                      name="companyName"
                      type="text"
                      required
                      value={formData.companyName}
                      onChange={handleChange}
                      className="block w-full pl-12 pr-4 py-3 border border-border rounded-lg text-foreground placeholder-muted-foreground bg-background focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 font-light"
                      placeholder="Your company"
                    />
                  </div>
                </div>

              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                      autoComplete="new-password"
                      required
                      value={formData.password}
                      onChange={handleChange}
                      className="block w-full pl-12 pr-4 py-3 border border-border rounded-lg text-foreground placeholder-muted-foreground bg-background focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 font-light"
                      placeholder="Create password"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-foreground mb-2">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      autoComplete="new-password"
                      required
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      className="block w-full pl-12 pr-4 py-3 border border-border rounded-lg text-foreground placeholder-muted-foreground bg-background focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 font-light"
                      placeholder="Confirm password"
                    />
                  </div>
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
              className="w-full btn-primary py-3 text-lg font-medium group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-foreground mr-3"></div>
                  Creating account...
                </div>
              ) : (
                <div className="flex items-center justify-center">
                  Create Account
                  <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                </div>
              )}
            </button>

            <div className="text-center text-sm">
              <button
                type="button"
                onClick={onSwitchToLogin}
                className="font-medium text-primary hover:text-primary/80 transition-colors"
              >
                Already have an account? Sign in
              </button>
            </div>
          </form>

          {/* Footer */}
          <div className="text-center text-xs text-muted-foreground font-light">
            By creating an account, you agree to our{' '}
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

export default OwnerSignupForm;