import React from 'react';
import { Link } from 'react-router-dom';
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
  ChevronDown
} from 'lucide-react';

const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navbar */}
      <header className="fixed top-0 left-0 right-0 bg-background/95 backdrop-blur-md border-b border-border z-50">
        <nav className="container-width px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <img src="/logo.svg" alt="Compazz" className="h-8" />
            </div>
            <div className="hidden md:flex items-center space-x-8">
              <Link to="/features" className="text-muted-foreground hover:text-foreground font-medium transition-colors">Features</Link>
              <Link to="/pricing" className="text-muted-foreground hover:text-foreground font-medium transition-colors">Pricing</Link>
              <Link to="/about" className="text-muted-foreground hover:text-foreground font-medium transition-colors">About</Link>
              <Link to="/blog" className="text-muted-foreground hover:text-foreground font-medium transition-colors">Blog</Link>
            </div>
            <div className="flex items-center space-x-4">
              <Link 
                to="/auth" 
                className="text-muted-foreground hover:text-foreground font-medium transition-colors"
              >
                Sign In
              </Link>
              <Link 
                to="/dashboard" 
                className="btn-primary px-6 py-2.5"
              >
                Get Started
              </Link>
            </div>
          </div>
        </nav>
      </header>

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
                Stop losing money to poor financial tracking. Compazz helps businesses track expenses, 
                manage invoices, and make data-driven decisions with confidence.
              </p>
              
              {/* CTAs */}
              <div className="flex flex-col sm:flex-row gap-4">
                <Link 
                  to="/dashboard" 
                  className="btn-primary px-8 py-3.5 text-lg group"
                >
                  Start Free Trial
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
                <a 
                  href="#features" 
                  className="btn-secondary px-8 py-3.5 text-lg"
                >
                  See How It Works
                </a>
              </div>
            </div>
            
            {/* Right side - Product Screenshot */}
            <div className="relative">
              <div className="card p-8 shadow-xl">
                <div className="bg-muted/50 rounded-lg h-80 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-accent rounded-xl flex items-center justify-center mx-auto mb-4">
                      <BarChart3 className="h-8 w-8 text-accent-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">Dashboard Preview</h3>
                    <p className="text-muted-foreground">Real-time financial insights</p>
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

      {/* Partners Section */}
      <section className="py-12 bg-background border-b border-border">
        <div className="container-width px-6 lg:px-8">
          <p className="text-center text-muted-foreground text-sm font-medium mb-8">Trusted by employees at:</p>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-8 items-center justify-items-center">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center opacity-60 hover:opacity-100 transition-opacity">
                <span className="text-muted-foreground font-medium text-xs">Logo</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section id="features" className="section-padding bg-muted/30">
        <div className="container-width">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-semibold text-foreground mb-6 text-balance">
              Focus on how it helps you, not what features it has
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto text-balance">
              Stop losing money to poor financial tracking. Here's how Compazz helps your business thrive.
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
              <h3 className="text-2xl font-semibold text-foreground mb-4">Smart Invoice Management</h3>
              <p className="text-muted-foreground text-lg leading-relaxed">
                Create, send, and track invoices automatically. Get paid faster with integrated payment processing 
                and automated reminders. Never lose track of outstanding payments again.
              </p>
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
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto text-balance">
              Choose the plan that fits your business needs. All plans include core features.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Starter Plan */}
            <div className="card p-8 hover:shadow-lg transition-all">
              <h3 className="text-2xl font-semibold text-foreground mb-2">Starter</h3>
              <div className="text-4xl font-semibold text-foreground mb-6">$29<span className="text-lg text-muted-foreground">/month</span></div>
              <Link 
                to="/dashboard" 
                className="btn-primary w-full py-3 mb-8"
              >
                Get Started
              </Link>
              <ul className="space-y-4">
                <li className="flex items-center text-muted-foreground">
                  <Check className="w-5 h-5 text-emerald-500 mr-3 flex-shrink-0" />
                  Up to 2 outlets
                </li>
                <li className="flex items-center text-muted-foreground">
                  <Check className="w-5 h-5 text-emerald-500 mr-3 flex-shrink-0" />
                  Basic reporting
                </li>
                <li className="flex items-center text-muted-foreground">
                  <Check className="w-5 h-5 text-emerald-500 mr-3 flex-shrink-0" />
                  Mobile app access
                </li>
                <li className="flex items-center text-muted-foreground">
                  <Check className="w-5 h-5 text-emerald-500 mr-3 flex-shrink-0" />
                  Email support
                </li>
                <li className="flex items-center text-muted-foreground">
                  <Check className="w-5 h-5 text-emerald-500 mr-3 flex-shrink-0" />
                  Basic analytics
                </li>
              </ul>
            </div>
            
            {/* Pro Plan - Most Popular */}
            <div className="card p-8 relative shadow-lg border-primary/20 hover:shadow-xl transition-all">
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <span className="bg-primary text-primary-foreground px-4 py-1.5 rounded-full text-sm font-medium">Most Popular</span>
              </div>
              <h3 className="text-2xl font-semibold text-foreground mb-2">Pro</h3>
              <div className="text-4xl font-semibold text-foreground mb-6">$79<span className="text-lg text-muted-foreground">/month</span></div>
              <Link 
                to="/dashboard" 
                className="btn-primary w-full py-3 mb-8"
              >
                Get Started
              </Link>
              <ul className="space-y-4">
                <li className="flex items-center text-muted-foreground">
                  <Check className="w-5 h-5 text-emerald-500 mr-3 flex-shrink-0" />
                  Everything as Starter plus:
                </li>
                <li className="flex items-center text-muted-foreground">
                  <Check className="w-5 h-5 text-emerald-500 mr-3 flex-shrink-0" />
                  Up to 10 outlets
                </li>
                <li className="flex items-center text-muted-foreground">
                  <Check className="w-5 h-5 text-emerald-500 mr-3 flex-shrink-0" />
                  Advanced analytics
                </li>
                <li className="flex items-center text-muted-foreground">
                  <Check className="w-5 h-5 text-emerald-500 mr-3 flex-shrink-0" />
                  Priority support
                </li>
                <li className="flex items-center text-muted-foreground">
                  <Check className="w-5 h-5 text-emerald-500 mr-3 flex-shrink-0" />
                  Custom reports
                </li>
              </ul>
            </div>
            
            {/* Advanced Plan */}
            <div className="card p-8 hover:shadow-lg transition-all">
              <h3 className="text-2xl font-semibold text-foreground mb-2">Advanced</h3>
              <div className="text-4xl font-semibold text-foreground mb-6">$149<span className="text-lg text-muted-foreground">/month</span></div>
              <Link 
                to="/dashboard" 
                className="btn-primary w-full py-3 mb-8"
              >
                Get Started
              </Link>
              <ul className="space-y-4">
                <li className="flex items-center text-muted-foreground">
                  <Check className="w-5 h-5 text-emerald-500 mr-3 flex-shrink-0" />
                  Everything in Pro plus:
                </li>
                <li className="flex items-center text-muted-foreground">
                  <Check className="w-5 h-5 text-emerald-500 mr-3 flex-shrink-0" />
                  Unlimited outlets
                </li>
                <li className="flex items-center text-muted-foreground">
                  <Check className="w-5 h-5 text-emerald-500 mr-3 flex-shrink-0" />
                  API access
                </li>
                <li className="flex items-center text-muted-foreground">
                  <Check className="w-5 h-5 text-emerald-500 mr-3 flex-shrink-0" />
                  White-label options
                </li>
                <li className="flex items-center text-muted-foreground">
                  <Check className="w-5 h-5 text-emerald-500 mr-3 flex-shrink-0" />
                  Dedicated support
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
            <div className="bg-muted/30 rounded-xl p-6 border border-border">
              <h3 className="text-lg font-semibold text-foreground mb-3">Can I cancel my subscription anytime?</h3>
              <p className="text-muted-foreground leading-relaxed">
                Yes, you can cancel your subscription at any time. There are no long-term contracts or cancellation fees. 
                You'll continue to have access to your data even after cancellation.
              </p>
            </div>
            
            <div className="bg-muted/30 rounded-xl p-6 border border-border">
              <h3 className="text-lg font-semibold text-foreground mb-3">Is there a free trial available?</h3>
              <p className="text-muted-foreground leading-relaxed">
                Yes! We offer a 14-day free trial with full access to all features. No credit card required to start your trial.
              </p>
            </div>
            
            <div className="bg-muted/30 rounded-xl p-6 border border-border">
              <h3 className="text-lg font-semibold text-foreground mb-3">How secure is my financial data?</h3>
              <p className="text-muted-foreground leading-relaxed">
                Your data is protected with bank-level security including 256-bit SSL encryption, regular security audits, 
                and compliance with financial data protection standards.
              </p>
            </div>
            
            <div className="bg-muted/30 rounded-xl p-6 border border-border">
              <h3 className="text-lg font-semibold text-foreground mb-3">Do you offer refunds?</h3>
              <p className="text-muted-foreground leading-relaxed">
                We offer a 30-day money-back guarantee. If you're not satisfied with Compazz within the first 30 days, 
                we'll provide a full refund, no questions asked.
              </p>
            </div>
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
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link 
              to="/dashboard" 
              className="bg-primary-foreground text-primary px-8 py-3.5 rounded-lg font-semibold text-lg hover:bg-primary-foreground/90 transition-all group"
            >
              Start Free Trial
              <ArrowRight className="ml-2 h-5 w-5 inline transition-transform group-hover:translate-x-1" />
            </Link>
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
      <footer className="bg-primary text-primary-foreground py-16">
        <div className="container-width px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center mb-6">
                <img src="/logo-white.svg" alt="Compazz" className="h-8" />
              </div>
              <p className="text-primary-foreground/70 mb-6 leading-relaxed">
                The complete financial management platform for modern businesses.
              </p>
              <div className="flex space-x-4">
                <a href="#" className="text-primary-foreground/70 hover:text-primary-foreground transition-colors">Twitter</a>
                <a href="#" className="text-primary-foreground/70 hover:text-primary-foreground transition-colors">LinkedIn</a>
                <a href="#" className="text-primary-foreground/70 hover:text-primary-foreground transition-colors">GitHub</a>
              </div>
            </div>
            <div>
              <h4 className="text-primary-foreground font-semibold mb-6 text-lg">Product</h4>
              <ul className="space-y-3">
                <li><a href="#features" className="text-primary-foreground/70 hover:text-primary-foreground transition-colors">Features</a></li>
                <li><a href="#pricing" className="text-primary-foreground/70 hover:text-primary-foreground transition-colors">Pricing</a></li>
                <li><a href="#how-it-works" className="text-primary-foreground/70 hover:text-primary-foreground transition-colors">How it works</a></li>
                <li><a href="#" className="text-primary-foreground/70 hover:text-primary-foreground transition-colors">API</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-primary-foreground font-semibold mb-6 text-lg">Resources</h4>
              <ul className="space-y-3">
                <li><a href="#" className="text-primary-foreground/70 hover:text-primary-foreground transition-colors">Documentation</a></li>
                <li><a href="#" className="text-primary-foreground/70 hover:text-primary-foreground transition-colors">Guides</a></li>
                <li><a href="#" className="text-primary-foreground/70 hover:text-primary-foreground transition-colors">Blog</a></li>
                <li><a href="#" className="text-primary-foreground/70 hover:text-primary-foreground transition-colors">Support</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-primary-foreground font-semibold mb-6 text-lg">Legal</h4>
              <ul className="space-y-3">
                <li><a href="#" className="text-primary-foreground/70 hover:text-primary-foreground transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="text-primary-foreground/70 hover:text-primary-foreground transition-colors">Terms of Service</a></li>
                <li><a href="#" className="text-primary-foreground/70 hover:text-primary-foreground transition-colors">Cookie Policy</a></li>
                <li><a href="#" className="text-primary-foreground/70 hover:text-primary-foreground transition-colors">Contact</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-primary-foreground/20 mt-12 pt-8 text-center">
            <p className="text-primary-foreground/50">&copy; 2024 Compazz. All rights reserved. Built with care for modern businesses.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
