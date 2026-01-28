import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Calendar, Clock, User, Share2, BookOpen, Smartphone, ChevronRight, CheckCircle, TrendingUp, Shield, Zap, Users, Monitor, Tablet } from 'lucide-react';

const MobileFirstFinancialManagement: React.FC = () => {
  const tableOfContents = [
    { id: "introduction", title: "The Mobile-First Imperative" },
    { id: "current-state", title: "Current State of Mobile Finance" },
    { id: "benefits", title: "Benefits of Mobile-First Design" },
    { id: "key-features", title: "Essential Mobile Features" },
    { id: "implementation", title: "Implementation Strategy" },
    { id: "security", title: "Mobile Security Considerations" },
    { id: "case-studies", title: "Real-World Success Stories" },
    { id: "future-trends", title: "Future of Mobile Finance" },
    { id: "conclusion", title: "Getting Started" }
  ];

  const mobileStats = [
    { stat: "73%", description: "of business owners use mobile devices for financial tasks" },
    { stat: "4.2x", description: "faster task completion with mobile-optimized interfaces" },
    { stat: "89%", description: "reduction in data entry errors with mobile-first design" },
    { stat: "65%", description: "increase in team productivity with mobile access" }
  ];

  const keyFeatures = [
    {
      feature: "Touch-Optimized Interface",
      description: "Large buttons, swipe gestures, and intuitive navigation designed for mobile screens",
      impact: "40% faster navigation",
      icon: Smartphone
    },
    {
      feature: "Offline Capability",
      description: "Continue working even without internet connection, sync when reconnected",
      impact: "100% uptime reliability",
      icon: Shield
    },
    {
      feature: "Real-Time Notifications",
      description: "Push notifications for approvals, alerts, and important financial events",
      impact: "50% faster response times",
      icon: Zap
    },
    {
      feature: "Voice Input",
      description: "Voice-to-text for expense descriptions and notes while on the go",
      impact: "60% faster data entry",
      icon: Users
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
                  <div className="w-8 h-8 bg-gradient-to-tr from-gray-900 to-gray-700 rounded-lg flex items-center justify-center">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                  </div>
                  <span className="text-xl font-bold text-gray-900 tracking-tight">Compazz</span>
                </div>
              </Link>
            </div>
            <div className="hidden md:flex items-center space-x-12">
              <Link to="/#features" className="text-gray-500 hover:text-gray-900 font-medium text-sm transition-colors">Features</Link>
              <Link to="/#pricing" className="text-gray-500 hover:text-gray-900 font-medium text-sm transition-colors">Pricing</Link>
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
            <span>Mobile & UX</span>
          </nav>

          {/* Article Header */}
          <header className="mb-16 text-center max-w-3xl mx-auto">
            <div className="flex items-center justify-center mb-8">
              <span className="bg-purple-100 text-purple-800 text-xs font-medium px-4 py-2 rounded-full mr-3">
                Mobile
              </span>
              <span className="bg-blue-100 text-blue-800 text-xs font-medium px-4 py-2 rounded-full">
                UX Design
              </span>
            </div>
            
            <h1 className="text-5xl lg:text-6xl font-light text-gray-900 mb-8 leading-tight tracking-tight">
              Mobile-First Financial Management: Why It Matters
            </h1>
            
            <p className="text-xl text-gray-600 mb-10 leading-relaxed font-light">
              Explore why mobile-first design is crucial for modern financial management and how it improves team productivity, accuracy, and business agility in today's fast-paced environment.
            </p>

            <div className="flex items-center justify-center space-x-8 text-sm text-gray-500 py-6 border-t border-b border-gray-200">
              <div className="flex items-center space-x-2">
                <User className="w-4 h-4" />
                <span>Alex Chen</span>
              </div>
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4" />
                <span>March 8, 2024</span>
              </div>
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4" />
                <span>4 min read</span>
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
                <h2 className="text-3xl font-light text-gray-900 mb-8 tracking-tight">The Mobile-First Imperative</h2>
                <div className="prose prose-lg max-w-none font-light text-gray-700 leading-relaxed space-y-6">
                  <p>
                    In today's business environment, mobility isn't just a convenience—it's a necessity. Business owners, managers, and financial teams need access to critical financial information whether they're at their desk, visiting a remote location, or traveling between meetings.
                  </p>
                  <p>
                    Traditional financial management systems were built for desktop computers in office environments. But modern businesses operate differently. Teams are distributed, decisions need to be made quickly, and financial data needs to be accessible from anywhere at any time.
                  </p>
                </div>
                
                <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {mobileStats.map((stat, index) => (
                    <div key={index} className="text-center bg-gray-50 rounded-xl p-6">
                      <div className="text-3xl font-light text-purple-600 mb-2">{stat.stat}</div>
                      <div className="text-gray-600 text-sm font-light">{stat.description}</div>
                    </div>
                  ))}
                </div>
              </section>

              <section id="benefits" className="bg-white rounded-2xl p-10 border border-gray-100">
                <div className="flex items-center mb-8">
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mr-4">
                    <TrendingUp className="w-6 h-6 text-green-600" />
                  </div>
                  <h2 className="text-3xl font-light text-gray-900 tracking-tight">Benefits of Mobile-First Design</h2>
                </div>
                
                <div className="prose prose-lg max-w-none font-light text-gray-700 leading-relaxed space-y-6">
                  <p>
                    Mobile-first financial management transforms how teams work, improving both efficiency and accuracy while enabling real-time decision-making.
                  </p>
                </div>

                <div className="mt-10">
                  <h3 className="text-xl font-medium text-gray-900 mb-6">Key Benefits:</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {keyFeatures.map((feature, index) => {
                      const IconComponent = feature.icon;
                      return (
                        <div key={index} className="bg-gray-50 rounded-xl p-6">
                          <div className="flex items-center mb-4">
                            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center mr-3">
                              <IconComponent className="w-5 h-5 text-gray-600" />
                            </div>
                            <h4 className="font-medium text-gray-900 text-sm">{feature.feature}</h4>
                          </div>
                          <p className="text-gray-600 text-sm font-light mb-3">{feature.description}</p>
                          <div className="text-green-600 text-xs font-medium">{feature.impact}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>

              <section id="implementation" className="bg-white rounded-2xl p-10 border border-gray-100">
                <h2 className="text-3xl font-light text-gray-900 mb-8 tracking-tight">Implementation Strategy</h2>
                <div className="prose prose-lg max-w-none font-light text-gray-700 leading-relaxed space-y-6">
                  <p>
                    Implementing mobile-first financial management requires careful planning and a phased approach to ensure user adoption and system reliability.
                  </p>
                </div>

                <div className="mt-10 space-y-8">
                  <div className="border-l-4 border-blue-500 pl-6">
                    <h3 className="text-xl font-medium text-gray-900 mb-3">Phase 1: Core Mobile Features</h3>
                    <ul className="space-y-2 text-gray-600 font-light">
                      <li>• Responsive dashboard with key metrics</li>
                      <li>• Mobile expense entry and photo capture</li>
                      <li>• Basic approval workflows</li>
                      <li>• Real-time notifications</li>
                    </ul>
                  </div>
                  
                  <div className="border-l-4 border-green-500 pl-6">
                    <h3 className="text-xl font-medium text-gray-900 mb-3">Phase 2: Advanced Functionality</h3>
                    <ul className="space-y-2 text-gray-600 font-light">
                      <li>• Offline data synchronization</li>
                      <li>• Voice input and dictation</li>
                      <li>• Advanced reporting and analytics</li>
                      <li>• Multi-location management</li>
                    </ul>
                  </div>
                  
                  <div className="border-l-4 border-purple-500 pl-6">
                    <h3 className="text-xl font-medium text-gray-900 mb-3">Phase 3: AI and Automation</h3>
                    <ul className="space-y-2 text-gray-600 font-light">
                      <li>• AI-powered expense categorization</li>
                      <li>• Predictive analytics and insights</li>
                      <li>• Automated workflow optimization</li>
                      <li>• Smart recommendations</li>
                    </ul>
                  </div>
                </div>
              </section>

              {/* CTA Section */}
              <section className="bg-gray-900 rounded-3xl p-12 text-white text-center">
                <h3 className="text-3xl font-light mb-6 tracking-tight">Experience Mobile-First Finance Management</h3>
                <p className="text-lg text-gray-300 mb-8 font-light leading-relaxed max-w-2xl mx-auto">
                  See how mobile-first design can transform your financial operations with our fully responsive platform designed for modern businesses.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Link 
                    to="/dashboard" 
                    className="bg-white text-gray-900 px-8 py-4 rounded-xl font-medium text-sm hover:bg-gray-100 transition-colors"
                  >
                    Try Mobile Demo
                  </Link>
                  <Link 
                    to="/#features" 
                    className="border border-white text-white px-8 py-4 rounded-xl font-medium text-sm hover:bg-white hover:text-gray-900 transition-colors"
                  >
                    See Mobile Features
                  </Link>
                </div>
                <p className="text-sm text-gray-400 mt-4 font-light">
                  Works perfectly on phones, tablets, and desktop • No app download required
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
                <Monitor className="w-6 h-6 text-blue-600" />
              </div>
              <h4 className="text-lg font-light text-gray-900 mb-3 group-hover:text-gray-600 transition-colors">
                How AI is Revolutionizing Small Business Finance Management
              </h4>
              <p className="text-gray-600 text-sm font-light mb-4 leading-relaxed">
                Discover how AI and machine learning are transforming financial management.
              </p>
              <Link to="/blog/ai-revolutionizing-finance" className="text-gray-900 font-medium text-sm hover:text-gray-600 transition-colors">
                Read More →
              </Link>
            </article>

            <article className="bg-gray-50 rounded-2xl p-8 hover:bg-white hover:shadow-lg hover:shadow-gray-100/50 transition-all duration-300 group border border-gray-100">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mb-6">
                <Tablet className="w-6 h-6 text-green-600" />
              </div>
              <h4 className="text-lg font-light text-gray-900 mb-3 group-hover:text-gray-600 transition-colors">
                5 Ways Multi-Location Businesses Can Streamline Financial Operations
              </h4>
              <p className="text-gray-600 text-sm font-light mb-4 leading-relaxed">
                Learn strategies to centralize financial management across multiple outlets.
              </p>
              <Link to="/blog/streamline-multi-location-finance" className="text-gray-900 font-medium text-sm hover:text-gray-600 transition-colors">
                Read More →
              </Link>
            </article>

            <article className="bg-gray-50 rounded-2xl p-8 hover:bg-white hover:shadow-lg hover:shadow-gray-100/50 transition-all duration-300 group border border-gray-100">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-6">
                <Shield className="w-6 h-6 text-purple-600" />
              </div>
              <h4 className="text-lg font-light text-gray-900 mb-3 group-hover:text-gray-600 transition-colors">
                Security Best Practices for Financial Data Management
              </h4>
              <p className="text-gray-600 text-sm font-light mb-4 leading-relaxed">
                Learn essential security measures to protect sensitive financial data.
              </p>
              <Link to="/blog/financial-data-security" className="text-gray-900 font-medium text-sm hover:text-gray-600 transition-colors">
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

export default MobileFirstFinancialManagement;
