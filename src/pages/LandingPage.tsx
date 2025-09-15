import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Building2,
  Smartphone,
  Receipt,
  TrendingUp,
  Shield,
  Check,
  Star,
  ArrowRight,
  ChevronDown,
  Loader2,
  TrendingDown,
  DollarSign
} from 'lucide-react';
import { paymentPlans } from '@/lib/stripe';
import stripeService from '@/lib/stripeService';
import { currencyService, type CurrencyInfo } from '@/lib/currencyService';
import { trackEvent, trackUserJourney } from '@/lib/posthog';
import LegalModal from '@/components/modals/LegalModal';
import PublicHeader from '@/components/layout/PublicHeader';

const LandingPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Track landing page visit
  useEffect(() => {
    trackUserJourney('landing', {
      path: location.pathname,
      search: location.search,
      referrer: document.referrer
    });
  }, [location]);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [isAnnual, setIsAnnual] = useState(false);
  const [currency, setCurrency] = useState<CurrencyInfo>(currencyService.getCurrentCurrency());
  const [legalModal, setLegalModal] = useState<{ isOpen: boolean; type: 'privacy' | 'terms' | 'cookies' | null }>({
    isOpen: false,
    type: null
  });

  // Handle subscription checkout
  const handleSubscribe = async (planId: string) => {
    setLoadingPlan(planId);

    // Track CTA click
    trackEvent('cta_clicked', {
      plan_id: planId,
      cta_location: 'pricing_section',
      is_annual: isAnnual,
      currency: currency.code
    });

    try {
      // Always go to signup first, then Stripe trial setup after account creation
      navigate(`/auth?mode=signup&plan=${planId}&trial=true`);
    } catch (error) {
      console.error('Error navigating to signup:', error);
      navigate(`/auth?mode=signup&plan=${planId}&trial=true`);
    } finally {
      setLoadingPlan(null);
    }
  };

  // Handle legal modal opening
  const openLegalModal = (type: 'privacy' | 'terms' | 'cookies') => {
    setLegalModal({ isOpen: true, type });
  };

  const closeLegalModal = () => {
    setLegalModal({ isOpen: false, type: null });
  };

  // Convert GBP prices to user's local currency for display
  const convertFromGBP = (gbpPrice: number): number => {
    // Conversion rates from GBP to other currencies
    const conversionRates: Record<string, number> = {
      'GBP': 1,
      'USD': 1.27,
      'EUR': 1.17,
      'CAD': 1.71,
      'NGN': 2070,
      'KES': 165,
      'GHS': 19.2,
      'ZAR': 23.1,
      'AUD': 1.91,
      'JPY': 191,
      'INR': 106,
      'BRL': 7.3,
      'MXN': 25.7,
      'CNY': 9.2,
      'RUB': 124,
      'TRY': 43.2,
      'EGP': 62.4
    };

    const rate = conversionRates[currency.code] || conversionRates['USD'];
    return Math.round(gbpPrice * rate);
  };

  // Format price with currency (converted from GBP)
  const formatPrice = (planId: string, isAnnual: boolean = false): string => {
    const plan = paymentPlans[planId as keyof typeof paymentPlans];
    if (!plan) return '';

    let price = convertFromGBP(plan.priceGBP);

    // Apply annual discount (20% off)
    if (isAnnual) {
      price = Math.round(price * 0.8);
    }

    return currencyService.formatCurrency(price, { minimumFractionDigits: 0 });
  };

  // Initialize currency detection on page load
  useEffect(() => {
    const initializeCurrency = async () => {
      try {
        const detectedCurrency = await currencyService.initializeCurrency();
        setCurrency(detectedCurrency);
      } catch {
        console.log('Currency detection failed, using default USD');
      }
    };

    initializeCurrency();
  }, []);

  // Scroll to top when navigating to landing page
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Handle hash navigation (e.g., /#features, /#pricing)
  useEffect(() => {
    if (location.hash) {
      const element = document.getElementById(location.hash.substring(1));
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      }
    }
  }, [location.hash]);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const faqData = [
    {
      question: "Can I cancel my subscription anytime?",
      answer: "Yes, you can cancel your subscription at any time. There are no long-term contracts or cancellation fees. You'll continue to have access to your data even after cancellation."
    },
    {
      question: "Is there a free trial available?",
      answer: "Yes! We offer a 7-day free trial with full access to all features. You can cancel anytime during the trial period."
    },
    {
      question: "How secure is my financial data?",
      answer: "Your data is protected with bank-level security including 256-bit SSL encryption, regular security audits, and compliance with financial data protection standards."
    },
    {
      question: "Do you offer refunds?",
      answer: "We offer a 30-day money-back guarantee. If you're not satisfied with Compazz within the first 30 days, we'll provide a full refund, no questions asked."
    }
  ];
  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicHeader />

      {/* Hero Section */}
      <section className="pt-24 section-padding bg-gradient-to-br from-accent/30 to-secondary/50">
        <div className="container-width">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            {/* Left side - Content */}
            <div>
              {/* Social Proof */}
              <div className="inline-flex items-center px-4 py-2 bg-accent border border-border rounded-full text-sm font-medium mb-8">
                <div className="w-2 h-2 bg-emerald-500 rounded-full mr-2"></div>
                1200+ active businesses trust Compazz
              </div>
              
              {/* Main Heading */}
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold text-foreground mb-6 leading-[1.1] text-balance">
                Financial management that actually works
              </h1>
              
              {/* Subheading */}
              <p className="text-lg text-muted-foreground mb-10 leading-relaxed max-w-lg">
                Stop losing money to poor financial tracking. Compazz helps businesses track expenses, manage invoices, and make data-driven decisions with confidence.
              </p>
              
              {/* CTAs */}
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex flex-col items-center sm:items-start">
                  <button
                    onClick={() => handleSubscribe('business')}
                    disabled={loadingPlan === 'business'}
                    className="btn-primary px-8 py-3.5 text-lg group disabled:opacity-50"
                  >
                    {loadingPlan === 'business' ? (
                      <>
                        <Loader2 className="mr-2 w-5 h-5 animate-spin" />
                        Launching App...
                      </>
                    ) : (
                      'Launch App'
                    )}
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </button>
                </div>
              </div>
            </div>
            
            {/* Right side - Product Screenshot */}
            <div className="relative">
              <div className="card p-8 shadow-xl">
                <div className="bg-muted/50 rounded-lg h-80 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-accent rounded-xl flex items-center justify-center mx-auto mb-4">
                      <Receipt className="h-8 w-8 text-accent-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">OCR AI Technology</h3>
                    <p className="text-muted-foreground">Instant document intelligence</p>
                  </div>
                </div>
              </div>
              {/* Subtle floating elements */}
              <div className="absolute -top-4 -right-4 w-20 h-20 bg-accent rounded-full opacity-60"></div>
              <div className="absolute -bottom-4 -left-4 w-16 h-16 bg-secondary rounded-full opacity-60"></div>
            </div>
          </div>
        </div>
      </section>


      {/* Benefits Section */}
      <section id="features" className="section-padding bg-muted/30">
        <div className="container-width">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-semibold text-foreground mb-6 text-balance">
              Everything you need to manage your finances
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto text-balance">
              Comprehensive tools for invoice management, expense tracking, and financial reporting.
            </p>
          </div>
          
          {/* Bento Box Layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Large card - top left */}
            <div className="lg:col-span-2 card p-8">
              <div className="w-16 h-16 bg-accent rounded-xl flex items-center justify-center mb-6">
                <BarChart3 className="h-8 w-8 text-accent-foreground" />
              </div>
              <h3 className="text-2xl font-semibold text-foreground mb-4">Real-time Financial Insights</h3>
              <p className="text-muted-foreground text-lg leading-relaxed">
                See exactly where your money is going with beautiful dashboards that update in real-time. 
                Make informed decisions based on actual data, not guesswork.
              </p>
            </div>
            
            {/* Medium card - top right */}
            <div className="card p-8">
              <div className="w-16 h-16 bg-accent rounded-xl flex items-center justify-center mb-6">
                <Building2 className="h-8 w-8 text-accent-foreground" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-4">Multi-Outlet Management</h3>
              <p className="text-muted-foreground leading-relaxed">
                Manage all your business locations from one dashboard. Compare performance and consolidate reporting.
              </p>
            </div>
            
            {/* Medium card - middle left */}
            <div className="card p-8">
              <div className="w-16 h-16 bg-accent rounded-xl flex items-center justify-center mb-6">
                <Smartphone className="h-8 w-8 text-accent-foreground" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-4">Mobile-First Design</h3>
              <p className="text-muted-foreground leading-relaxed">
                Your team can manage finances anywhere with our intuitive mobile interface.
              </p>
            </div>
            
            {/* Large card - middle right */}
            <div className="lg:col-span-2 card p-8">
              <div className="w-16 h-16 bg-accent rounded-xl flex items-center justify-center mb-6">
                <Receipt className="h-8 w-8 text-accent-foreground" />
              </div>
              <h3 className="text-2xl font-semibold text-foreground mb-4">Smart Receipt Scanning</h3>
              <p className="text-muted-foreground text-lg leading-relaxed mb-4">
                Transform receipt photos into expense reports instantly with our AI-powered scanning technology.
                Eliminate manual data entry and reduce errors by up to 90%.
              </p>
              <ul className="text-muted-foreground space-y-2">
                <li className="flex items-start">
                  <div className="w-1.5 h-1.5 bg-accent-foreground rounded-full mt-2 mr-3 flex-shrink-0"></div>
                  Advanced photo scanning with 95%+ accuracy
                </li>
                <li className="flex items-start">
                  <div className="w-1.5 h-1.5 bg-accent-foreground rounded-full mt-2 mr-3 flex-shrink-0"></div>
                  Real-time receipt scanning with confidence scoring
                </li>
                <li className="flex items-start">
                  <div className="w-1.5 h-1.5 bg-accent-foreground rounded-full mt-2 mr-3 flex-shrink-0"></div>
                  Automatic data extraction: vendor name, amount, date, description
                </li>
                <li className="flex items-start">
                  <div className="w-1.5 h-1.5 bg-accent-foreground rounded-full mt-2 mr-3 flex-shrink-0"></div>
                  Multi-format support with 10MB file limit
                </li>
                <li className="flex items-start">
                  <div className="w-1.5 h-1.5 bg-accent-foreground rounded-full mt-2 mr-3 flex-shrink-0"></div>
                  Smart categorization and expense validation
                </li>
                <li className="flex items-start">
                  <div className="w-1.5 h-1.5 bg-accent-foreground rounded-full mt-2 mr-3 flex-shrink-0"></div>
                  Mobile-first experience with camera integration
                </li>
              </ul>
            </div>
            
            {/* Medium card - bottom left */}
            <div className="card p-8">
              <div className="w-16 h-16 bg-accent rounded-xl flex items-center justify-center mb-6">
                <TrendingUp className="h-8 w-8 text-accent-foreground" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-4">End-of-Day Reports</h3>
              <p className="text-muted-foreground leading-relaxed">
                Generate comprehensive daily reports with photo attachments and comments.
              </p>
            </div>
            
            {/* Medium card - bottom right */}
            <div className="card p-8">
              <div className="w-16 h-16 bg-accent rounded-xl flex items-center justify-center mb-6">
                <Shield className="h-8 w-8 text-accent-foreground" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-4">Enterprise Security</h3>
              <p className="text-muted-foreground leading-relaxed">
                Bank-level security with role-based access control and data encryption.
              </p>
            </div>
          </div>
        </div>
      </section>


      {/* How it works Section */}
      <section id="how-it-works" className="section-padding bg-background">
        <div className="container-width">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-semibold text-foreground mb-6 text-balance">
              How it works?
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto text-balance">
              Get started with Compazz in 3 simple steps. No complex setup required.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div className="text-center">
              <div className="w-16 h-16 bg-accent rounded-xl flex items-center justify-center mx-auto mb-6 border border-border">
                <span className="text-2xl font-semibold text-accent-foreground">1</span>
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-4">Sign Up & Connect</h3>
              <p className="text-muted-foreground leading-relaxed">
                Create your account and connect your business outlets. Set up takes less than 5 minutes.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-accent rounded-xl flex items-center justify-center mx-auto mb-6 border border-border">
                <span className="text-2xl font-semibold text-accent-foreground">2</span>
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-4">Start Tracking</h3>
              <p className="text-muted-foreground leading-relaxed">
                Begin recording expenses, creating invoices, and generating daily reports with our mobile app.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-accent rounded-xl flex items-center justify-center mx-auto mb-6 border border-border">
                <span className="text-2xl font-semibold text-accent-foreground">3</span>
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-4">Make Better Decisions</h3>
              <p className="text-muted-foreground leading-relaxed">
                Use real-time insights and reports to make data-driven financial decisions for your business.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="section-padding bg-background">
        <div className="container-width">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-semibold text-foreground mb-6 text-balance">
              Simple, transparent pricing
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto text-balance mb-8">
              Start with a 7-day free trial. Choose the plan that fits your business needs.
            </p>
            
            {/* Billing Toggle */}
            <div className="flex items-center justify-center mb-8">
              <div className="bg-muted rounded-full p-1 flex items-center">
                <button
                  onClick={() => setIsAnnual(false)}
                  className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
                    !isAnnual 
                      ? 'bg-background text-foreground shadow-sm' 
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setIsAnnual(true)}
                  className={`px-6 py-2 rounded-full text-sm font-medium transition-all flex items-center space-x-2 ${
                    isAnnual 
                      ? 'bg-background text-foreground shadow-sm' 
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <span>Annual</span>
                  <div className="flex items-center space-x-1">
                    <TrendingDown className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs text-emerald-600 font-semibold">Save 20%</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col md:flex-row justify-center items-end md:items-stretch gap-8 max-w-5xl mx-auto">
            {/* Basic Plan - Decoy */}
            <div className="card p-8 hover:shadow-lg transition-all duration-300 md:w-80 opacity-90">
              <h3 className="text-2xl font-semibold text-foreground mb-2">Startup</h3>
              <div className="text-4xl font-semibold text-foreground mb-2 transition-all duration-500 ease-in-out">
                <span className="inline-block transition-all duration-500 ease-in-out transform">
                  {formatPrice('startup', isAnnual).replace(/\.00$/, '')}
                </span>
                <span className="text-lg text-muted-foreground transition-all duration-300">
                  /month
                </span>
              </div>
              <div className={`transition-all duration-300 ease-in-out ${
                isAnnual ? 'opacity-100 max-h-8 mb-2' : 'opacity-0 max-h-0 mb-0'
              }`}>
                <p className="text-sm text-emerald-600">
                  <span className="line-through text-muted-foreground">{formatPrice('startup', false)}</span> Save 20%/year
                </p>
              </div>
              <p className="text-sm text-muted-foreground mb-6">Good for getting started</p>
              <button
                onClick={() => handleSubscribe('startup')}
                disabled={loadingPlan === 'startup'}
                className="btn-secondary w-full py-3 mb-8 flex items-center justify-center"
              >
                {loadingPlan === 'startup' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Try Startup Free'
                )}
              </button>
              <ul className="space-y-4">
                <li className="flex items-center text-muted-foreground">
                  <Check className="w-5 h-5 text-emerald-500 mr-3 flex-shrink-0" />
                  For single outlet businesses
                </li>
                <li className="flex items-center text-muted-foreground">
                  <Check className="w-5 h-5 text-emerald-500 mr-3 flex-shrink-0" />
                  Basic reporting and analytics
                </li>
                <li className="flex items-center text-muted-foreground">
                  <Check className="w-5 h-5 text-emerald-500 mr-3 flex-shrink-0" />
                  automated financial insights
                </li>
                <li className="flex items-center text-muted-foreground">
                  <Check className="w-5 h-5 text-emerald-500 mr-3 flex-shrink-0" />
                  Email support
                </li>
              </ul>
            </div>
            
            {/* Pro Plan - Most Popular - Centered and Elevated */}
            <div className="card p-8 relative shadow-2xl border-primary/30 bg-gradient-to-br from-background to-primary/5 hover:shadow-2xl transition-all duration-300 md:w-96 md:scale-105 md:-mt-4">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10">
                <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white px-6 py-2 rounded-full text-sm font-semibold shadow-lg pulse-glow">
                  Most Popular
                </div>
              </div>
              <div className="absolute -top-2 -left-2 -right-2 -bottom-2 bg-gradient-to-br from-primary/20 to-emerald-500/20 rounded-xl -z-10 transition-all duration-300"></div>
              
              <h3 className="text-2xl font-semibold text-foreground mb-2 mt-2">Business</h3>
              <div className="flex items-baseline mb-2">
                <span className="text-5xl font-bold text-foreground transition-all duration-500 ease-in-out transform inline-block">
                  {formatPrice('business', isAnnual).replace(/\.00$/, '')}
                </span>
                <span className="text-lg text-muted-foreground ml-1 transition-all duration-300">/month</span>
              </div>
              <div className="flex items-center mb-6 min-h-[32px]">
                <span className="text-sm text-emerald-600 font-medium bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded-full mr-2">7-day free trial</span>
                <div className={`transition-all duration-300 ease-in-out ${
                  isAnnual ? 'opacity-100 scale-100 translate-x-0' : 'opacity-0 scale-95 translate-x-2'
                }`}>
                  <span className="text-xs text-emerald-600 font-semibold whitespace-nowrap">Save $120/year</span>
                </div>
              </div>
              <button
                onClick={() => handleSubscribe('business')}
                disabled={loadingPlan === 'business'}
                className="btn-primary w-full py-4 mb-8 text-lg font-semibold shadow-lg flex items-center justify-center"
              >
                {loadingPlan === 'business' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Try Business Free'
                )}
              </button>
              <ul className="space-y-4">
                <li className="flex items-center text-foreground font-medium">
                  <Check className="w-5 h-5 text-emerald-500 mr-3 flex-shrink-0" />
                  Everything in Startup plus:
                </li>
                <li className="flex items-center text-muted-foreground">
                  <Check className="w-5 h-5 text-emerald-500 mr-3 flex-shrink-0" />
                  Up to 5 outlets
                </li>
                <li className="flex items-center text-muted-foreground">
                  <Check className="w-5 h-5 text-emerald-500 mr-3 flex-shrink-0" />
                  Advanced analytics & insights
                </li>
                <li className="flex items-center text-muted-foreground">
                  <Check className="w-5 h-5 text-emerald-500 mr-3 flex-shrink-0" />
                Auto audit of end of day reports and invoices
                </li>
                <li className="flex items-center text-muted-foreground">
                  <Check className="w-5 h-5 text-emerald-500 mr-3 flex-shrink-0" />
                  Custom reports & exports
                </li>
                <li className="flex items-center text-muted-foreground">
                  <Check className="w-5 h-5 text-emerald-500 mr-3 flex-shrink-0" />
                  Team collaboration tools
                </li>
                <li className="flex items-center text-muted-foreground">
                  <Check className="w-5 h-5 text-emerald-500 mr-3 flex-shrink-0" />
                  Smart receipt photo scanning (95%+ accuracy)
                </li>
                <li className="flex items-center text-muted-foreground">
                  <Check className="w-5 h-5 text-emerald-500 mr-3 flex-shrink-0" />
                  Instant receipt scanning & automatic data capture
                </li>
                <li className="flex items-center text-muted-foreground">
                  <Check className="w-5 h-5 text-emerald-500 mr-3 flex-shrink-0" />
                  Automatic expense sorting & validation
                </li>
                <li className="flex items-center text-muted-foreground">
                  <Check className="w-5 h-5 text-emerald-500 mr-3 flex-shrink-0" />
                  Camera app & support for all receipt formats
                </li>
              </ul>
            </div>
            
            {/* Enterprise Plan */}
            <div className="card p-8 hover:shadow-lg transition-all md:w-80 opacity-90">
              <h3 className="text-2xl font-semibold text-foreground mb-2">Enterprise</h3>
              <div className="flex items-baseline mb-2">
                <span className="text-4xl font-semibold text-foreground transition-all duration-500 ease-in-out transform inline-block">
                  {formatPrice('enterprise', isAnnual).replace(/\.00$/, '')}
                </span>
                <span className="text-lg text-muted-foreground ml-1 transition-all duration-300">/month</span>
              </div>
              <div className={`transition-all duration-300 ease-in-out ${isAnnual ? 'opacity-100 max-h-8 mb-2' : 'opacity-0 max-h-0 mb-0'}`}>
                <p className="text-sm text-emerald-600 transform transition-all duration-300 ease-in-out">
                  <span className="line-through text-muted-foreground">{formatPrice('enterprise', false)}</span> Save 20%/year
                </p>
              </div>
              <p className="text-sm text-muted-foreground mb-6">For large operations</p>
              <button
                onClick={() => handleSubscribe('enterprise')}
                disabled={loadingPlan === 'enterprise'}
                className="btn-secondary w-full py-3 mb-8 flex items-center justify-center"
              >
                {loadingPlan === 'enterprise' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Try Enterprise Free'
                )}
              </button>
              <ul className="space-y-4">
                <li className="flex items-center text-muted-foreground">
                  <Check className="w-5 h-5 text-emerald-500 mr-3 flex-shrink-0" />
                  Everything in Business plus:
                </li>
                <li className="flex items-center text-muted-foreground">
                  <Check className="w-5 h-5 text-emerald-500 mr-3 flex-shrink-0" />
                  Unlimited outlets
                </li>
                <li className="flex items-center text-muted-foreground">
                  <Check className="w-5 h-5 text-emerald-500 mr-3 flex-shrink-0" />
                  API access & integrations
                </li>
                <li className="flex items-center text-muted-foreground">
                  <Check className="w-5 h-5 text-emerald-500 mr-3 flex-shrink-0" />
                  White-label options
                </li>
                <li className="flex items-center text-muted-foreground">
                  <Check className="w-5 h-5 text-emerald-500 mr-3 flex-shrink-0" />
                  Dedicated account manager
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="section-padding bg-muted/30">
        <div className="container-width">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-semibold text-foreground mb-6 text-balance">
              Loved by people worldwide
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto text-balance">
              See what our customers say about Compazz
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="card p-8">
              <div className="flex items-center mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 text-amber-400 fill-current" />
                ))}
              </div>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                "Compazz transformed how we manage our finances. The real-time insights helped us cut costs by 30% in just 3 months."
              </p>
              <div className="flex items-center">
                <div className="w-12 h-12 bg-accent rounded-full flex items-center justify-center mr-4">
                  <span className="text-accent-foreground font-semibold">SM</span>
                </div>
                <div>
                  <div className="font-semibold text-foreground">Sarah Martinez</div>
                  <div className="text-muted-foreground text-sm">CEO, Retail Chain</div>
                </div>
              </div>
            </div>
            
            <div className="card p-8">
              <div className="flex items-center mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 text-amber-400 fill-current" />
                ))}
              </div>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                "The mobile app is incredible. My team can track expenses on the go, and the daily reports are so easy to generate."
              </p>
              <div className="flex items-center">
                <div className="w-12 h-12 bg-accent rounded-full flex items-center justify-center mr-4">
                  <span className="text-accent-foreground font-semibold">DJ</span>
                </div>
                <div>
                  <div className="font-semibold text-foreground">David Johnson</div>
                  <div className="text-muted-foreground text-sm">Operations Manager</div>
                </div>
              </div>
            </div>
            
            <div className="card p-8">
              <div className="flex items-center mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 text-amber-400 fill-current" />
                ))}
              </div>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                "Finally, a financial tool that actually makes sense. The multi-outlet management saved us hours every week."
              </p>
              <div className="flex items-center">
                <div className="w-12 h-12 bg-accent rounded-full flex items-center justify-center mr-4">
                  <span className="text-accent-foreground font-semibold">AL</span>
                </div>
                <div>
                  <div className="font-semibold text-foreground">Alex Lee</div>
                  <div className="text-muted-foreground text-sm">Finance Director</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="section-padding bg-background">
        <div className="max-w-4xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-semibold text-foreground mb-6 text-balance">
              Frequently Asked Questions
            </h2>
            <p className="text-lg text-muted-foreground text-balance">
              Address some major questions to help people make the final call
            </p>
          </div>
          
          <div className="space-y-4">
            {faqData.map((faq, index) => (
              <div key={index} className="bg-muted/30 rounded-xl border border-border overflow-hidden">
                <button
                  onClick={() => toggleFaq(index)}
                  className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-muted/50 transition-colors"
                >
                  <h3 className="text-lg font-semibold text-foreground">{faq.question}</h3>
                  <ChevronDown 
                    className={`w-5 h-5 text-muted-foreground transition-transform ${
                      openFaq === index ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {openFaq === index && (
                  <div className="px-6 pb-4 border-t border-border/50">
                    <p className="text-muted-foreground leading-relaxed pt-4">
                      {faq.answer}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Financial Calculators Section */}
      <section className="section-padding bg-background">
        <div className="container-width">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-semibold text-foreground mb-6 text-balance">
              Free Financial Calculators
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto text-balance">
              Make data-driven financial decisions with our suite of professional calculators.
              Get instant insights for ROI, cash flow, break-even analysis, and more.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
            {/* ROI Calculator */}
            <div className="card p-6 hover:shadow-lg transition-all group">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-emerald-600" />
                </div>
                <span className="text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded-full">
                  12K+ searches/mo
                </span>
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">ROI Calculator</h3>
              <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                Calculate return on investment with annualized returns and performance benchmarks.
              </p>
              <Link
                to="/calculators/roi"
                className="inline-flex items-center text-sm font-medium text-primary hover:text-primary/80 transition-colors group-hover:translate-x-1 transform"
              >
                Try Calculator <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </div>

            {/* Break-Even Calculator */}
            <div className="card p-6 hover:shadow-lg transition-all group">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                  <BarChart3 className="h-6 w-6 text-blue-600" />
                </div>
                <span className="text-xs text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-full">
                  8K+ searches/mo
                </span>
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Break-Even Calculator</h3>
              <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                Determine units needed to break even and analyze contribution margins.
              </p>
              <Link
                to="/calculators/break-even"
                className="inline-flex items-center text-sm font-medium text-primary hover:text-primary/80 transition-colors group-hover:translate-x-1 transform"
              >
                Try Calculator <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </div>

            {/* Cash Flow Calculator */}
            <div className="card p-6 hover:shadow-lg transition-all group">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-purple-600" />
                </div>
                <span className="text-xs text-purple-600 bg-purple-50 dark:bg-purple-900/20 px-2 py-1 rounded-full">
                  6K+ searches/mo
                </span>
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Cash Flow Calculator</h3>
              <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                Project monthly cash flows and identify potential shortfalls in advance.
              </p>
              <Link
                to="/calculators/cash-flow"
                className="inline-flex items-center text-sm font-medium text-primary hover:text-primary/80 transition-colors group-hover:translate-x-1 transform"
              >
                Try Calculator <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="text-center">
            <Link
              to="/calculators"
              className="btn-secondary inline-flex items-center space-x-2 px-6 py-3"
            >
              <span>View All Calculators</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="section-padding bg-primary text-primary-foreground">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-semibold mb-8 text-balance">
            Ready to stop losing money to poor financial tracking?
          </h2>
          <p className="text-lg text-primary-foreground/80 mb-12 max-w-2xl mx-auto text-balance">
            Join 1200+ businesses already using Compazz to streamline their finances and make better decisions.
          </p>
          <div className="flex flex-col gap-6 justify-center items-center">
            <button
              onClick={() => handleSubscribe('business')}
              disabled={loadingPlan === 'business'}
              className="bg-primary-foreground text-primary px-8 py-3.5 rounded-lg font-semibold text-lg hover:bg-primary-foreground/90 transition-all group disabled:opacity-50"
            >
              {loadingPlan === 'business' ? (
                <>
                  <Loader2 className="mr-2 w-5 h-5 animate-spin" />
                  Starting Free Trial...
                </>
              ) : (
                'Get 7 Days Free → No Credit Card'
              )}
              <ArrowRight className="ml-2 h-5 w-5 inline transition-transform group-hover:translate-x-1" />
            </button>
            <div className="flex items-center space-x-6 text-sm text-primary-foreground/80">
              <span className="flex items-center">
                <Check className="w-4 h-4 text-emerald-400 mr-2" />
                No setup fees
              </span>
              <span className="flex items-center">
                <Check className="w-4 h-4 text-emerald-400 mr-2" />
                Cancel anytime
              </span>
              <span className="flex items-center">
                <Check className="w-4 h-4 text-emerald-400 mr-2" />
                30-day money back
              </span>
            </div>
            <a 
              href="#how-it-works" 
              className="border-2 border-primary-foreground/20 text-primary-foreground px-8 py-3.5 rounded-lg font-medium text-lg hover:bg-primary-foreground/10 transition-all"
            >
              See How It Works
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-12">
            <div>
              <div className="text-xl font-medium mb-6 tracking-tight">Compazz</div>
              <p className="text-gray-400 font-light leading-relaxed text-sm mb-6">
                AI-powered financial management for modern businesses.
              </p>
              <div className="flex space-x-4">
                <a href="https://twitter.com/compazz" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">
                  <span className="sr-only">Twitter</span>
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84"></path>
                  </svg>
                </a>
                <a href="https://linkedin.com/company/compazz" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">
                  <span className="sr-only">LinkedIn</span>
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"></path>
                  </svg>
                </a>
                <a href="https://github.com/compazz" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">
                  <span className="sr-only">GitHub</span>
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"></path>
                  </svg>
                </a>
              </div>
            </div>
            <div>
              <h4 className="font-medium mb-6 text-sm">Product</h4>
              <ul className="space-y-3 text-gray-400 text-sm font-light">
                <li><button onClick={() => scrollToSection('features')} className="hover:text-white transition-colors">Features</button></li>
                <li><button onClick={() => scrollToSection('pricing')} className="hover:text-white transition-colors">Pricing</button></li>
                <li><Link to="/docs" className="hover:text-white transition-colors">Documentation</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-6 text-sm">Company</h4>
              <ul className="space-y-3 text-gray-400 text-sm font-light">
                <li><Link to="/about" className="hover:text-white transition-colors">About</Link></li>
                <li><Link to="/blog" className="hover:text-white transition-colors">Blog</Link></li>
                <li><Link to="/careers" className="hover:text-white transition-colors">Careers</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-6 text-sm">Support</h4>
              <ul className="space-y-3 text-gray-400 text-sm font-light">
                <li><a href="mailto:support@compazz.com" className="hover:text-white transition-colors">Contact</a></li>
                <li><Link to="/help" className="hover:text-white transition-colors">Help Center</Link></li>
                <li><Link to="/status" className="hover:text-white transition-colors">Status</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-6 text-sm">Legal</h4>
              <ul className="space-y-3 text-gray-400 text-sm font-light">
                <li><button onClick={() => openLegalModal('privacy')} className="hover:text-white transition-colors">Privacy Policy</button></li>
                <li><button onClick={() => openLegalModal('terms')} className="hover:text-white transition-colors">Terms of Service</button></li>
                <li><button onClick={() => openLegalModal('cookies')} className="hover:text-white transition-colors">Cookie Policy</button></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-12 pt-8">
            <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
              <p className="text-gray-400 text-sm font-light">&copy; 2024 Compazz. All rights reserved.</p>
              <div className="flex flex-wrap justify-center md:justify-end items-center space-x-6 text-xs text-gray-400">
                <button onClick={() => openLegalModal('privacy')} className="hover:text-white transition-colors">Privacy Policy</button>
                <button onClick={() => openLegalModal('terms')} className="hover:text-white transition-colors">Terms of Service</button>
                <button onClick={() => openLegalModal('cookies')} className="hover:text-white transition-colors">Cookie Policy</button>
                <Link to="/refund" className="hover:text-white transition-colors">Refund Policy</Link>
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* Legal Modal */}
      {legalModal.isOpen && legalModal.type && (
        <LegalModal
          isOpen={legalModal.isOpen}
          onClose={closeLegalModal}
          type={legalModal.type}
        />
      )}
    </div>
  );
};

export default LandingPage;
