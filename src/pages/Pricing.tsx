import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, X, Zap, Building2, Crown, Star, ArrowRight, Users, Calculator } from 'lucide-react';

const Pricing: React.FC = () => {
  const [isYearly, setIsYearly] = useState(false);

  const plans = [
    {
      name: "Starter",
      icon: <Zap className="w-6 h-6" />,
      description: "Perfect for single-location businesses",
      monthlyPrice: 29,
      yearlyPrice: 290,
      features: [
        "1 outlet",
        "Up to 3 team members",
        "AI invoice scanning (100/month)",
        "Basic analytics",
        "Email support",
        "Mobile app access",
        "Standard security"
      ],
      notIncluded: [
        "Advanced analytics",
        "Multi-outlet management",
        "Priority support",
        "Custom integrations"
      ],
      cta: "Start Free Trial",
      popular: false
    },
    {
      name: "Professional",
      icon: <Building2 className="w-6 h-6" />,
      description: "Built for growing multi-location businesses",
      monthlyPrice: 89,
      yearlyPrice: 890,
      features: [
        "Up to 10 outlets",
        "Unlimited team members",
        "AI invoice scanning (1,000/month)",
        "Advanced analytics & reporting",
        "Priority email & chat support",
        "Advanced role management",
        "Data export & API access",
        "Custom workflows"
      ],
      notIncluded: [
        "White-label options",
        "Dedicated account manager",
        "Custom integrations"
      ],
      cta: "Start Free Trial",
      popular: true
    },
    {
      name: "Enterprise",
      icon: <Crown className="w-6 h-6" />,
      description: "For large organizations with complex needs",
      monthlyPrice: 299,
      yearlyPrice: 2990,
      features: [
        "Unlimited outlets",
        "Unlimited team members",
        "Unlimited AI scanning",
        "Advanced analytics & BI",
        "24/7 priority support",
        "Dedicated account manager",
        "Custom integrations",
        "White-label options",
        "Advanced security & compliance",
        "Custom training & onboarding"
      ],
      notIncluded: [],
      cta: "Contact Sales",
      popular: false
    }
  ];

  const faqs = [
    {
      question: "How does the free trial work?",
      answer: "Start with a 14-day free trial. No credit card required. Test all features and see how Compazz works for your business."
    },
    {
      question: "Can I change plans anytime?",
      answer: "Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately, and we'll prorate any billing adjustments."
    },
    {
      question: "What happens to my data if I cancel?",
      answer: "Your data remains accessible for 30 days after cancellation. You can export all your data during this period."
    },
    {
      question: "Do you offer custom enterprise plans?",
      answer: "Yes, we work with large organizations to create custom plans that fit their specific needs and requirements."
    },
    {
      question: "Is there a setup fee?",
      answer: "No setup fees. We help you get started for free, including data migration from your existing systems."
    }
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navbar */}
      <header className="fixed top-0 left-0 right-0 bg-background/95 backdrop-blur-md border-b border-border z-50">
        <nav className="container-width px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link to="/" className="flex items-center">
                <img src="/logo.svg" alt="Compazz" className="h-8" />
              </Link>
            </div>
            <div className="hidden md:flex items-center space-x-8">
              <Link to="/features" className="text-muted-foreground hover:text-foreground font-medium transition-colors">Features</Link>
              <Link to="/pricing" className="text-foreground font-medium transition-colors">Pricing</Link>
              <Link to="/about" className="text-muted-foreground hover:text-foreground font-medium transition-colors">About</Link>
              <Link to="/blog" className="text-muted-foreground hover:text-foreground font-medium transition-colors">Blog</Link>
            </div>
            <div className="flex items-center space-x-4">
              <Link to="/auth" className="text-muted-foreground hover:text-foreground font-medium transition-colors">
                Sign In
              </Link>
              <Link to="/dashboard" className="btn-primary px-6 py-2.5">
                Get Started
              </Link>
            </div>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="pt-24 section-padding bg-gradient-to-br from-accent/30 to-secondary/50">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center px-4 py-2 bg-accent border border-border rounded-full text-sm font-medium mb-8">
            <Calculator className="w-4 h-4 mr-2 text-accent-foreground" />
            Simple, transparent pricing
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold text-foreground mb-6 leading-[1.1] text-balance">
            Choose the plan that
            <span className="block">fits your business</span>
          </h1>
          <p className="text-lg text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed text-balance">
            Start with a 14-day free trial. No credit card required. Upgrade or downgrade anytime.
          </p>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center mb-8">
            <span className={`mr-3 ${!isYearly ? 'text-foreground' : 'text-muted-foreground'}`}>Monthly</span>
            <button
              onClick={() => setIsYearly(!isYearly)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                isYearly ? 'bg-primary' : 'bg-muted'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
                  isYearly ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <span className={`ml-3 ${isYearly ? 'text-foreground' : 'text-muted-foreground'}`}>
              Yearly
              <span className="ml-2 text-xs bg-accent text-accent-foreground px-2 py-1 rounded-full">Save 20%</span>
            </span>
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="section-padding bg-background">
        <div className="container-width">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {plans.map((plan, index) => (
              <div
                key={index}
                className={`card p-8 relative ${
                  plan.popular 
                    ? 'shadow-lg border-primary/20' 
                    : ''
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span className="bg-primary text-primary-foreground px-4 py-1.5 rounded-full text-sm font-medium">
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="flex items-center mb-4">
                  <div className="w-12 h-12 bg-accent rounded-xl flex items-center justify-center mr-4">
                    <div className="text-accent-foreground">
                      {plan.icon}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-foreground">{plan.name}</h3>
                    <p className="text-muted-foreground text-sm">{plan.description}</p>
                  </div>
                </div>

                <div className="mb-6">
                  <div className="flex items-baseline">
                    <span className="text-4xl font-semibold text-foreground">
                      ${isYearly ? Math.floor(plan.yearlyPrice / 12) : plan.monthlyPrice}
                    </span>
                    <span className="text-muted-foreground ml-1">/month</span>
                  </div>
                  {isYearly && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Billed annually (${plan.yearlyPrice})
                    </p>
                  )}
                </div>

                <Link
                  to={plan.cta === "Contact Sales" ? "/contact" : "/dashboard"}
                  className={`w-full mb-8 py-3 px-6 rounded-lg font-medium text-center transition-all inline-block ${
                    plan.popular
                      ? 'btn-primary'
                      : 'btn-secondary'
                  }`}
                >
                  {plan.cta}
                </Link>

                <div className="space-y-4">
                  <h4 className="font-semibold text-foreground text-sm">Everything in {plan.name}:</h4>
                  <ul className="space-y-3">
                    {plan.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-center text-sm">
                        <Check className="w-4 h-4 text-emerald-500 mr-3 flex-shrink-0" />
                        <span className="text-muted-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {plan.notIncluded.length > 0 && (
                    <ul className="space-y-3 pt-4 border-t border-border">
                      {plan.notIncluded.map((feature, featureIndex) => (
                        <li key={featureIndex} className="flex items-center text-sm">
                          <X className="w-4 h-4 text-muted-foreground/50 mr-3 flex-shrink-0" />
                          <span className="text-muted-foreground/70">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="section-padding bg-muted/30">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-semibold text-foreground mb-6 text-balance">
              Frequently Asked Questions
            </h2>
            <p className="text-lg text-muted-foreground text-balance">
              Everything you need to know about our pricing and plans
            </p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div key={index} className="card p-6">
                <h3 className="text-lg font-semibold text-foreground mb-3">{faq.question}</h3>
                <p className="text-muted-foreground leading-relaxed">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="section-padding bg-primary text-primary-foreground">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-semibold mb-8 text-balance">
            Ready to get started?
          </h2>
          <p className="text-lg text-primary-foreground/80 mb-12 max-w-2xl mx-auto text-balance">
            Join thousands of businesses already using Compazz to streamline their financial operations. Start your free trial today.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/dashboard" className="bg-primary-foreground text-primary px-8 py-3.5 rounded-lg font-semibold text-lg hover:bg-primary-foreground/90 transition-all group">
              Start Free Trial
              <ArrowRight className="ml-2 h-5 w-5 inline transition-transform group-hover:translate-x-1" />
            </Link>
            <Link to="/contact" className="border-2 border-primary-foreground/20 text-primary-foreground px-8 py-3.5 rounded-lg font-medium text-lg hover:bg-primary-foreground/10 transition-all">
              Contact Sales
            </Link>
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
                AI-powered financial management for modern businesses.
              </p>
            </div>
            <div>
              <h4 className="text-primary-foreground font-semibold mb-6 text-lg">Product</h4>
              <ul className="space-y-3">
                <li><Link to="/features" className="text-primary-foreground/70 hover:text-primary-foreground transition-colors">Features</Link></li>
                <li><Link to="/pricing" className="text-primary-foreground/70 hover:text-primary-foreground transition-colors">Pricing</Link></li>
                <li><Link to="/docs" className="text-primary-foreground/70 hover:text-primary-foreground transition-colors">Documentation</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-primary-foreground font-semibold mb-6 text-lg">Company</h4>
              <ul className="space-y-3">
                <li><Link to="/about" className="text-primary-foreground/70 hover:text-primary-foreground transition-colors">About</Link></li>
                <li><Link to="/blog" className="text-primary-foreground/70 hover:text-primary-foreground transition-colors">Blog</Link></li>
                <li><Link to="/careers" className="text-primary-foreground/70 hover:text-primary-foreground transition-colors">Careers</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-primary-foreground font-semibold mb-6 text-lg">Support</h4>
              <ul className="space-y-3">
                <li><a href="mailto:support@compazz.com" className="text-primary-foreground/70 hover:text-primary-foreground transition-colors">Contact</a></li>
                <li><Link to="/help" className="text-primary-foreground/70 hover:text-primary-foreground transition-colors">Help Center</Link></li>
                <li><Link to="/status" className="text-primary-foreground/70 hover:text-primary-foreground transition-colors">Status</Link></li>
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

export default Pricing;