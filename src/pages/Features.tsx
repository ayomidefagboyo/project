import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Scan, 
  Building2, 
  BarChart3, 
  Shield, 
  Smartphone, 
  Zap,
  Users,
  Receipt,
  TrendingUp,
  FileText,
  Camera,
  Brain,
  Clock,
  CheckCircle,
  ArrowRight
} from 'lucide-react';

const Features: React.FC = () => {
  const features = [
    {
      icon: <Scan className="w-8 h-8" />,
      title: "AI-Powered Invoice Scanning",
      description: "Scan physical invoices with your phone. Our AI extracts data with 95% accuracy using advanced OCR and GPT-4.",
      benefits: ["Instant data extraction", "Mobile-first scanning", "99.9% accuracy guaranteed"]
    },
    {
      icon: <Building2 className="w-8 h-8" />,
      title: "Multi-Outlet Management",
      description: "Manage finances across all your locations from one unified dashboard. Perfect for restaurant chains, retail stores, and franchises.",
      benefits: ["Centralized control", "Outlet-specific insights", "Consolidated reporting"]
    },
    {
      icon: <BarChart3 className="w-8 h-8" />,
      title: "Real-Time Analytics",
      description: "Get instant insights into your business performance with live dashboards, trend analysis, and predictive forecasting.",
      benefits: ["Live performance metrics", "Trend identification", "Predictive insights"]
    },
    {
      icon: <Receipt className="w-8 h-8" />,
      title: "End-of-Day Reporting",
      description: "Streamlined EOD processes with automatic reconciliation, variance detection, and compliance reporting.",
      benefits: ["Automated reconciliation", "Variance alerts", "Compliance ready"]
    },
    {
      icon: <Users className="w-8 h-8" />,
      title: "Team Collaboration",
      description: "Role-based access control ensures the right people see the right data. From managers to accountants to business owners.",
      benefits: ["Role-based permissions", "Secure access", "Audit trails"]
    },
    {
      icon: <Smartphone className="w-8 h-8" />,
      title: "Mobile-First Design",
      description: "Built for mobile from the ground up. Your team can manage finances on the go, anywhere, anytime.",
      benefits: ["Native mobile experience", "Offline capabilities", "Touch-optimized interface"]
    }
  ];

  const aiFeatures = [
    {
      icon: <Camera className="w-12 h-12" />,
      title: "Computer Vision OCR",
      description: "Advanced optical character recognition extracts data from invoices, receipts, and documents with incredible accuracy.",
      tech: "Powered by Google Cloud Vision"
    },
    {
      icon: <Brain className="w-12 h-12" />,
      title: "GPT-4 Data Processing",
      description: "OpenAI's most advanced language model structures and validates extracted data, ensuring consistency and accuracy.",
      tech: "Powered by OpenAI GPT-4"
    },
    {
      icon: <TrendingUp className="w-12 h-12" />,
      title: "Predictive Analytics",
      description: "Machine learning algorithms analyze patterns to predict trends, detect anomalies, and recommend optimizations.",
      tech: "Built-in ML Models"
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
              <Link to="/features" className="text-foreground font-medium transition-colors">Features</Link>
              <Link to="/pricing" className="text-muted-foreground hover:text-foreground font-medium transition-colors">Pricing</Link>
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
        <div className="container-width">
          <div className="text-center">
            <div className="inline-flex items-center px-4 py-2 bg-accent border border-border rounded-full text-sm font-medium mb-8">
              <Zap className="w-4 h-4 mr-2 text-accent-foreground" />
              Powered by AI & Machine Learning
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold text-foreground mb-6 leading-[1.1] text-balance">
              Features built for
              <span className="block">modern businesses</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed text-balance">
              Every tool you need to manage multi-outlet finances, powered by cutting-edge AI and designed for the mobile-first world.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/dashboard" className="btn-primary px-8 py-3.5 text-lg group">
                Start Free Trial
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link to="/pricing" className="btn-secondary px-8 py-3.5 text-lg">
                View Pricing
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="section-padding bg-background">
        <div className="container-width">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-semibold text-foreground mb-6 text-balance">
              Everything you need, nothing you don't
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto text-balance">
              Built by finance professionals for finance professionals. Every feature serves a real business need.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="card p-8">
                <div className="w-16 h-16 bg-accent rounded-xl flex items-center justify-center mb-6">
                  <div className="text-accent-foreground">
                    {feature.icon}
                  </div>
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-4">{feature.title}</h3>
                <p className="text-muted-foreground mb-6 leading-relaxed">{feature.description}</p>
                <ul className="space-y-3">
                  {feature.benefits.map((benefit, idx) => (
                    <li key={idx} className="flex items-center text-sm text-muted-foreground">
                      <CheckCircle className="w-4 h-4 text-emerald-500 mr-3 flex-shrink-0" />
                      {benefit}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI & Technology Section */}
      <section className="section-padding bg-muted/30">
        <div className="container-width">
          <div className="text-center mb-16">
            <div className="inline-flex items-center px-4 py-2 bg-accent border border-border rounded-full text-sm font-medium mb-8">
              <Brain className="w-4 h-4 mr-2 text-accent-foreground" />
              AI-Powered Technology
            </div>
            <h2 className="text-3xl md:text-4xl font-semibold text-foreground mb-6 text-balance">
              The intelligence behind Compazz
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto text-balance">
              We leverage the latest advances in AI to make financial management effortless and accurate.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {aiFeatures.map((aiFeature, index) => (
              <div key={index} className="card p-8">
                <div className="text-accent-foreground mb-6">
                  {aiFeature.icon}
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-4">{aiFeature.title}</h3>
                <p className="text-muted-foreground mb-4 leading-relaxed">
                  {aiFeature.description}
                </p>
                <div className="text-sm text-muted-foreground/70">{aiFeature.tech}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="section-padding bg-primary text-primary-foreground">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-semibold mb-8 text-balance">
            Ready to transform your business?
          </h2>
          <p className="text-lg text-primary-foreground/80 mb-12 max-w-2xl mx-auto text-balance">
            Join thousands of businesses already using Compazz to streamline their financial operations.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/dashboard" className="bg-primary-foreground text-primary px-8 py-3.5 rounded-lg font-semibold text-lg hover:bg-primary-foreground/90 transition-all group">
              Start Free Trial
              <ArrowRight className="ml-2 h-5 w-5 inline transition-transform group-hover:translate-x-1" />
            </Link>
            <Link to="/pricing" className="border-2 border-primary-foreground/20 text-primary-foreground px-8 py-3.5 rounded-lg font-medium text-lg hover:bg-primary-foreground/10 transition-all">
              View Pricing
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

export default Features;