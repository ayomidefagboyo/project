import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Lock, User, Building, Chrome, ArrowRight, Check, Star } from 'lucide-react';
import { paymentPlans } from '@/lib/stripe';
import { authService } from '@/lib/auth';
import { useOutlet } from '@/contexts/OutletContext';
import stripeService from '@/lib/stripeService';
import LegalModal from '@/components/modals/LegalModal';
import { trackEvent, trackUserJourney, trackTrialEvent, identifyUser, trackFormInteraction, trackError, trackPerformance } from '@/lib/posthog';

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
  const [legalModal, setLegalModal] = useState<{ isOpen: boolean; type: 'privacy' | 'terms' | null }>({
    isOpen: false,
    type: null
  });
  const { setCurrentUser, setUserOutlets, setCurrentOutlet } = useOutlet();

  const openLegalModal = (type: 'privacy' | 'terms') => {
    setLegalModal({ isOpen: true, type });
  };

  const closeLegalModal = () => {
    setLegalModal({ isOpen: false, type: null });
  };

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

    // Track form submission start
    const startTime = Date.now();
    trackFormInteraction('owner_signup', 'started', 6, {
      has_trial: isTrial,
      selected_plan: selectedPlan
    });

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      // Track validation error
      trackError('validation', 'Password mismatch', {
        form: 'owner_signup',
        field: 'confirmPassword'
      });
      trackFormInteraction('owner_signup', 'abandoned', 6, {
        error_type: 'validation',
        error_field: 'password_confirmation'
      });
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long');
      setIsLoading(false);
      return;
    }


    try {
      const { user, error: authError } = await authService.signUpOwner({
        email: formData.email,
        password: formData.password,
        name: formData.name,
        companyName: formData.companyName, // Optional
      });

      if (authError) {
        setError(authError);
        return;
      }

      if (user) {
        setCurrentUser(user);
        
        // Track successful signup
        trackEvent('user_signup', {
          user_id: user.id,
          has_trial: isTrial,
          selected_plan: selectedPlan,
          signup_method: 'email'
        });

        // Identify user in PostHog
        identifyUser(user.id, {
          name: formData.name,
          email: formData.email,
          signup_date: new Date().toISOString(),
          is_trial: isTrial,
          plan_id: selectedPlan
        });

        // Track user journey progression
        trackUserJourney('signup', {
          user_id: user.id,
          is_trial: isTrial,
          plan_id: selectedPlan
        });

        // Get user's outlets (should be just the one they created)
        const { data: outlets, error: outletsError } = await authService.getUserOutlets(user.id);

        if (outlets && !outletsError) {
          setUserOutlets(outlets);

          // Set the created outlet as current
          if (outlets.length > 0) {
            setCurrentOutlet(outlets[0]);
          }
        }

        // If trial signup, redirect to Stripe trial setup
        if (isTrial && selectedPlan) {
          const successUrl = `${window.location.origin}/dashboard?payment=success&trial=true`;
          const cancelUrl = `${window.location.origin}/dashboard?payment=cancelled`;

          try {
            // Track trial start
            trackTrialEvent('started', selectedPlan);

            const response = await stripeService.createSubscriptionCheckout(
              selectedPlan,
              successUrl,
              cancelUrl,
              7 // 7-day free trial
            );

            await stripeService.redirectToCheckout((response as any).sessionId);
            return; // Don't call onSuccess, let Stripe handle the redirect
          } catch (error) {
            console.error('Error creating Stripe trial:', error);
            // Track trial start failure
            trackEvent('trial_start_failed', {
              user_id: user.id,
              plan_id: selectedPlan,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
            // Fallback to dashboard without Stripe trial
            onSuccess?.();
          }
        } else {
          onSuccess?.();
        }

        // Track successful form completion and performance
        const endTime = Date.now();
        const duration = endTime - startTime;
        trackFormInteraction('owner_signup', 'completed', 6, {
          user_id: user.id,
          duration_ms: duration,
          has_trial: isTrial
        });
        trackPerformance('user_signup', duration, true, {
          user_id: user.id,
          plan_id: selectedPlan,
          has_trial: isTrial
        });
      }
    } catch (err) {
      const endTime = Date.now();
      const duration = endTime - startTime;

      setError('An unexpected error occurred');
      console.error('Owner signup error:', err);

      // Track signup error and performance
      trackError('auth', 'Signup failed', {
        error: err instanceof Error ? err.message : 'Unknown error',
        duration_ms: duration
      });
      trackPerformance('user_signup', duration, false, {
        error: err instanceof Error ? err.message : 'Unknown error'
      });
      trackFormInteraction('owner_signup', 'abandoned', 6, {
        error_type: 'api',
        duration_ms: duration
      });
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

        // If trial signup, redirect to Stripe trial setup
        if (isTrial && selectedPlan) {
          const successUrl = `${window.location.origin}/dashboard?payment=success&trial=true`;
          const cancelUrl = `${window.location.origin}/dashboard?payment=cancelled`;

          try {
            // Track trial start
            trackTrialEvent('started', selectedPlan);

            const response = await stripeService.createSubscriptionCheckout(
              selectedPlan,
              successUrl,
              cancelUrl,
              7 // 7-day free trial
            );

            await stripeService.redirectToCheckout((response as any).sessionId);
            return; // Don't call onSuccess, let Stripe handle the redirect
          } catch (error) {
            console.error('Error creating Stripe trial:', error);
            // Track trial start failure
            trackEvent('trial_start_failed', {
              user_id: user.id,
              plan_id: selectedPlan,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
            // Fallback to dashboard without Stripe trial
            onSuccess?.();
          }
        } else {
          onSuccess?.();
        }
      }
    } catch (err) {
      setError('Google authentication failed');
      console.error('Google authentication error:', err);
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
                <span className="font-light">Free 7-day trial</span>
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
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-primary-foreground/10 rounded-lg p-4 flex-1">
                  <p className="text-primary-foreground/80 text-sm font-light italic leading-relaxed">
                    "As a CPA firm, we need precision. Compazz caught inconsistencies in our expense tracking that manual reviews missed. It's like having an AI auditor that never sleeps."
                  </p>
                  <p className="text-primary-foreground/60 text-xs mt-3 font-medium">- James Rodriguez, Rodriguez & Associates CPA</p>
                </div>
                <div className="bg-primary-foreground/10 rounded-lg p-4 flex-1">
                  <p className="text-primary-foreground/80 text-sm font-light italic leading-relaxed">
                    "Our SaaS startup burned through £15K in 'mystery expenses' before Compazz. Now I can see exactly where every pound goes and our runway calculations are spot-on."
                  </p>
                  <p className="text-primary-foreground/60 text-xs mt-3 font-medium">- Alex Thompson, TechFlow Solutions (YC S23)</p>
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
            {isGoogleLoading ? 'Authenticating...' : 'Continue with Google'}
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

              <div>
                <label htmlFor="companyName" className="block text-sm font-medium text-foreground mb-2">
                  Company Name <span className="text-muted-foreground">(optional)</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Building className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <input
                    id="companyName"
                    name="companyName"
                    type="text"
                    value={formData.companyName}
                    onChange={handleChange}
                    className="block w-full pl-12 pr-4 py-3 border border-border rounded-lg text-foreground placeholder-muted-foreground bg-background focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 font-light"
                    placeholder="Your company (can be added later)"
                  />
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
            <button 
              type="button"
              onClick={() => openLegalModal('terms')}
              className="text-primary hover:text-primary/80 underline"
            >
              Terms of Service
            </button>{' '}
            and{' '}
            <button 
              type="button"
              onClick={() => openLegalModal('privacy')}
              className="text-primary hover:text-primary/80 underline"
            >
              Privacy Policy
            </button>
          </div>
        </div>
      </div>

      {/* Legal Modal */}
      <LegalModal
        isOpen={legalModal.isOpen}
        onClose={closeLegalModal}
        type={legalModal.type || 'privacy'}
      />
    </div>
  );
};

export default OwnerSignupForm;