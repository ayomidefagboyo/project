import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Calendar, Clock, User, Share2, BookOpen, TrendingUp, Zap, Brain, ChevronRight, CheckCircle, Camera, Target, Building2, BarChart3, Smartphone } from 'lucide-react';

const AIRevolutionizingFinance: React.FC = () => {
  const tableOfContents = [
    { id: "introduction", title: "The Financial Management Revolution" },
    { id: "ai-bookkeeping", title: "AI-Powered Automated Bookkeeping" },
    { id: "predictive-analytics", title: "Predictive Financial Analytics" },
    { id: "expense-management", title: "Smart Expense Management" },
    { id: "cash-flow", title: "AI-Driven Cash Flow Forecasting" },
    { id: "fraud-detection", title: "Automated Fraud Detection" },
    { id: "implementation", title: "How to Implement AI in Your Business" },
    { id: "future-trends", title: "Future of AI in Finance" },
    { id: "conclusion", title: "Getting Started Today" }
  ];

  const keyBenefits = [
    "95% reduction in manual data entry tasks",
    "80% faster month-end closing processes",
    "70% improvement in financial forecasting accuracy",
    "60% reduction in accounting errors",
    "Real-time financial insights and reporting"
  ];

  const aiTools = [
    {
      category: "Invoice Processing",
      description: "OCR and NLP extract data from invoices with 99%+ accuracy",
      impact: "Saves 15-20 hours per week",
      icon: Camera
    },
    {
      category: "Expense Categorization",
      description: "Machine learning automatically categorizes transactions",
      impact: "Reduces errors by 85%",
      icon: Target
    },
    {
      category: "Cash Flow Prediction",
      description: "Predictive models forecast cash flow 12 months ahead",
      impact: "Improves planning accuracy by 70%",
      icon: TrendingUp
    },
    {
      category: "Anomaly Detection",
      description: "AI identifies unusual transactions and potential fraud",
      impact: "Prevents 90% of financial discrepancies",
      icon: Zap
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-b border-gray-100 z-50">
        <nav className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center">
              <Link to="/" className="flex items-center">
                <div className="flex items-center space-x-3">
                  <img 
                    src="/logo-icon.svg" 
                    alt="Compazz Logo" 
                    className="w-8 h-8"
                  />
                  <span className="text-xl font-bold text-gray-900 tracking-tight">Compazz</span>
                </div>
              </Link>
            </div>
            <div className="hidden md:flex items-center space-x-12">
              <Link to="/features" className="text-gray-500 hover:text-gray-900 font-medium text-sm transition-colors">Features</Link>
              <Link to="/pricing" className="text-gray-500 hover:text-gray-900 font-medium text-sm transition-colors">Pricing</Link>
              <Link to="/about" className="text-gray-500 hover:text-gray-900 font-medium text-sm transition-colors">About</Link>
              <Link to="/blog" className="text-gray-900 font-medium text-sm">Blog</Link>
            </div>
            <div className="flex items-center space-x-4">
              <Link to="/auth" className="text-gray-500 hover:text-gray-900 font-medium text-sm transition-colors">Sign In</Link>
              <Link to="/dashboard" className="bg-gray-900 text-white px-6 py-2.5 rounded-xl font-medium text-sm hover:bg-gray-800 transition-all duration-200">
                Get Started
              </Link>
            </div>
          </div>
        </nav>
      </header>

      <article className="pt-32">
        <div className="max-w-4xl mx-auto px-6 lg:px-8">
          {/* Breadcrumb */}
          <nav className="flex items-center space-x-3 text-sm text-gray-500 mb-12">
            <Link to="/blog" className="hover:text-gray-900 flex items-center transition-colors">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Blog
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span>AI & Technology</span>
          </nav>

          {/* Article Header */}
          <header className="mb-16 text-center max-w-3xl mx-auto">
            <div className="flex items-center justify-center mb-8">
              <span className="bg-gray-900 text-white text-xs font-medium px-4 py-2 rounded-full">
                AI & Technology
              </span>
            </div>
            
            <h1 className="text-5xl lg:text-6xl font-light text-gray-900 mb-8 leading-tight tracking-tight">
              How AI is Revolutionizing Small Business Finance Management
            </h1>
            
            <p className="text-xl text-gray-600 mb-10 leading-relaxed font-light">
              Discover how artificial intelligence and machine learning are transforming the way small and medium businesses handle their finances, from automated bookkeeping to predictive analytics that drive better business decisions.
            </p>

            <div className="flex items-center justify-center space-x-8 text-sm text-gray-500 py-6 border-t border-b border-gray-200">
              <div className="flex items-center space-x-2">
                <User className="w-4 h-4" />
                <span>Sarah Chen</span>
              </div>
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4" />
                <span>March 15, 2024</span>
              </div>
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4" />
                <span>8 min read</span>
              </div>
              <button className="flex items-center text-gray-500 hover:text-gray-900 transition-colors">
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </button>
            </div>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-16">
            {/* Table of Contents */}
            <aside className="lg:col-span-1">
              <div className="sticky top-32 bg-white rounded-2xl p-8 border border-gray-100">
                <div className="flex items-center mb-6">
                  <BookOpen className="w-5 h-5 text-gray-400 mr-2" />
                  <h3 className="font-medium text-gray-900 text-sm">Contents</h3>
                </div>
                <nav className="space-y-2">
                  {tableOfContents.map((item, index) => (
                    <a
                      key={index}
                      href={`#${item.id}`}
                      className="block text-sm text-gray-500 hover:text-gray-900 transition-colors py-2 font-light"
                    >
                      {item.title}
                    </a>
                  ))}
                </nav>
              </div>
            </aside>

            {/* Main Content */}
            <div className="lg:col-span-4 space-y-16">
              <section id="introduction" className="bg-white rounded-2xl p-10 border border-gray-100">
                <h2 className="text-3xl font-light text-gray-900 mb-8 tracking-tight">The Financial Management Revolution</h2>
                <div className="prose prose-lg max-w-none font-light text-gray-700 leading-relaxed space-y-6">
                  <p>
                    Small and medium businesses (SMBs) are experiencing a financial management revolution. What once required hours of manual data entry, complex spreadsheets, and endless reconciliation is now being automated through artificial intelligence and machine learning technologies.
                  </p>
                  <p>
                    According to recent studies, businesses implementing AI-powered financial management systems see an average of <strong className="text-gray-900">40% reduction in time spent on financial tasks</strong> and <strong className="text-gray-900">65% improvement in accuracy</strong>. This isn't just about efficiency—it's about transforming how businesses understand and manage their finances.
                  </p>
                </div>
                
                <div className="mt-10 bg-gray-50 rounded-xl p-8">
                  <h4 className="font-medium text-gray-900 mb-6 text-sm">Key Benefits of AI in Finance</h4>
                  <div className="space-y-4">
                    {keyBenefits.map((benefit, index) => (
                      <div key={index} className="flex items-start space-x-3">
                        <CheckCircle className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                        <span className="text-gray-700 text-sm font-light">{benefit}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <section id="ai-bookkeeping" className="bg-white rounded-2xl p-10 border border-gray-100">
                <div className="flex items-center mb-8">
                  <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mr-4">
                    <Brain className="w-6 h-6 text-purple-600" />
                  </div>
                  <h2 className="text-3xl font-light text-gray-900 tracking-tight">AI-Powered Automated Bookkeeping</h2>
                </div>
                
                <div className="prose prose-lg max-w-none font-light text-gray-700 leading-relaxed space-y-6">
                  <p>
                    Traditional bookkeeping involves manual data entry from receipts, invoices, and bank statements. AI-powered systems use Optical Character Recognition (OCR) and Natural Language Processing (NLP) to automatically extract, categorize, and record financial data.
                  </p>
                </div>

                <div className="mt-10">
                  <h3 className="text-xl font-medium text-gray-900 mb-6">How AI Bookkeeping Works:</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {aiTools.map((tool, index) => {
                      const IconComponent = tool.icon;
                      return (
                        <div key={index} className="bg-gray-50 rounded-xl p-6">
                          <div className="flex items-center mb-4">
                            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center mr-3">
                              <IconComponent className="w-5 h-5 text-gray-600" />
                            </div>
                            <h4 className="font-medium text-gray-900 text-sm">{tool.category}</h4>
                          </div>
                          <p className="text-gray-600 text-sm font-light mb-3">{tool.description}</p>
                          <div className="text-gray-900 text-xs font-medium">{tool.impact}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-10 bg-blue-50 rounded-xl p-8 border border-blue-100">
                  <h4 className="font-medium text-blue-900 mb-3 text-sm">Real-World Example: Restaurant Chain</h4>
                  <p className="text-blue-800 text-sm font-light leading-relaxed">
                    A restaurant chain with 8 locations reduced their bookkeeping time from 25 hours per week to just 3 hours by implementing AI-powered invoice scanning. The system automatically processes supplier invoices, categorizes food costs vs. equipment purchases, and flags unusual spending patterns.
                  </p>
                </div>
              </section>

              {/* CTA Section */}
              <section className="bg-gray-900 rounded-3xl p-12 text-white text-center">
                <h3 className="text-3xl font-light mb-6 tracking-tight">Ready to Transform Your Business?</h3>
                <p className="text-lg text-gray-300 mb-8 font-light leading-relaxed max-w-2xl mx-auto">
                  Join thousands of businesses already using AI-powered financial management to streamline their operations and make better decisions.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Link 
                    to="/dashboard" 
                    className="bg-white text-gray-900 px-8 py-4 rounded-xl font-medium text-sm hover:bg-gray-100 transition-colors"
                  >
                    Start Free Trial
                  </Link>
                  <Link 
                    to="/features" 
                    className="border border-white text-white px-8 py-4 rounded-xl font-medium text-sm hover:bg-white hover:text-gray-900 transition-colors"
                  >
                    See AI Features
                  </Link>
                </div>
                <p className="text-sm text-gray-400 mt-4 font-light">
                  No credit card required • 14-day free trial • Setup in minutes
                </p>
              </section>
            </div>
          </div>
        </div>
      </article>

      {/* Related Articles */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <h3 className="text-2xl font-light text-gray-900 mb-12 text-center tracking-tight">Related Articles</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <article className="bg-gray-50 rounded-2xl p-8 hover:bg-white hover:shadow-lg hover:shadow-gray-100/50 transition-all duration-300 group border border-gray-100">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-6">
                <Building2 className="w-6 h-6 text-blue-600" />
              </div>
              <h4 className="text-lg font-light text-gray-900 mb-3 group-hover:text-gray-600 transition-colors">
                5 Ways Multi-Location Businesses Can Streamline Financial Operations
              </h4>
              <p className="text-gray-600 text-sm font-light mb-4 leading-relaxed">
                Learn proven strategies to centralize financial management across multiple outlets.
              </p>
              <Link to="/blog/streamline-multi-location-finance" className="text-gray-900 font-medium text-sm hover:text-gray-600 transition-colors">
                Read More →
              </Link>
            </article>

            <article className="bg-gray-50 rounded-2xl p-8 hover:bg-white hover:shadow-lg hover:shadow-gray-100/50 transition-all duration-300 group border border-gray-100">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mb-6">
                <BarChart3 className="w-6 h-6 text-green-600" />
              </div>
              <h4 className="text-lg font-light text-gray-900 mb-3 group-hover:text-gray-600 transition-colors">
                The ROI of Automated Invoice Processing
              </h4>
              <p className="text-gray-600 text-sm font-light mb-4 leading-relaxed">
                See how businesses reduce invoice processing time by 90% with automation.
              </p>
              <Link to="/blog/automated-invoice-processing-roi" className="text-gray-900 font-medium text-sm hover:text-gray-600 transition-colors">
                Read More →
              </Link>
            </article>

            <article className="bg-gray-50 rounded-2xl p-8 hover:bg-white hover:shadow-lg hover:shadow-gray-100/50 transition-all duration-300 group border border-gray-100">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-6">
                <Smartphone className="w-6 h-6 text-purple-600" />
              </div>
              <h4 className="text-lg font-light text-gray-900 mb-3 group-hover:text-gray-600 transition-colors">
                Mobile-First Financial Management: Why It Matters
              </h4>
              <p className="text-gray-600 text-sm font-light mb-4 leading-relaxed">
                Explore why mobile-first design is crucial for modern financial management.
              </p>
              <Link to="/blog/mobile-first-financial-management" className="text-gray-900 font-medium text-sm hover:text-gray-600 transition-colors">
                Read More →
              </Link>
            </article>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
            <div>
              <div className="text-xl font-medium mb-6 tracking-tight">Compazz</div>
              <p className="text-gray-400 font-light leading-relaxed text-sm">
                AI-powered financial management for modern businesses.
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-6 text-sm">Product</h4>
              <ul className="space-y-3 text-gray-400 text-sm font-light">
                <li><Link to="/features" className="hover:text-white transition-colors">Features</Link></li>
                <li><Link to="/pricing" className="hover:text-white transition-colors">Pricing</Link></li>
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
          </div>
          <div className="border-t border-gray-800 mt-12 pt-8 text-center text-gray-400 text-sm font-light">
            <p>&copy; 2024 Compazz. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default AIRevolutionizingFinance;