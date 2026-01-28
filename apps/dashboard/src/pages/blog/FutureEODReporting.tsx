import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Calendar, Clock, User, Share2, Book, Sun, ChevronRight, CheckCircle, TrendingUp, Brain, Zap, Camera, Smartphone, Cloud } from 'lucide-react';

const FutureEODReporting: React.FC = () => {
  const tableOfContents = [
    { id: "introduction", title: "The Evolution of EOD Reporting" },
    { id: "current-challenges", title: "Current EOD Challenges" },
    { id: "emerging-technologies", title: "Emerging Technologies" },
    { id: "ai-automation", title: "AI-Powered Automation" },
    { id: "real-time-reporting", title: "Real-Time vs End-of-Day" },
    { id: "mobile-integration", title: "Mobile and IoT Integration" },
    { id: "predictive-analytics", title: "Predictive Analytics" },
    { id: "implementation", title: "Implementation Roadmap" },
    { id: "future-vision", title: "The Future Vision" }
  ];

  const currentChallenges = [
    {
      challenge: "Manual Data Collection",
      impact: "2-4 hours daily per location",
      description: "Staff manually counting cash, reconciling registers, and entering data"
    },
    {
      challenge: "Delayed Reporting",
      impact: "Next-day availability",
      description: "Reports not available until the following business day"
    },
    {
      challenge: "Data Accuracy Issues",
      impact: "15-20% error rate",
      description: "Human errors in counting, calculation, and data entry"
    },
    {
      challenge: "Inconsistent Processes",
      impact: "Variable quality",
      description: "Different procedures across locations and staff members"
    }
  ];

  const emergingTechnologies = [
    {
      technology: "Computer Vision",
      description: "AI-powered image recognition for cash counting and inventory",
      impact: "95% reduction in counting time",
      timeline: "Available now",
      icon: Camera,
      color: "blue"
    },
    {
      technology: "IoT Sensors",
      description: "Smart scales, cash drawers, and inventory sensors",
      impact: "Real-time data capture",
      timeline: "2024-2025",
      icon: Zap,
      color: "green"
    },
    {
      technology: "Machine Learning",
      description: "Predictive analytics and anomaly detection",
      impact: "Proactive issue identification",
      timeline: "Available now",
      icon: Brain,
      color: "purple"
    },
    {
      technology: "Blockchain Integration",
      description: "Immutable transaction records and audit trails",
      impact: "Enhanced security & compliance",
      timeline: "2025-2026",
      icon: Cloud,
      color: "orange"
    }
  ];

  const futureFeatures = [
    "Automated cash counting with computer vision",
    "Real-time inventory tracking with IoT sensors",
    "AI-powered anomaly detection and alerts",
    "Voice-activated reporting and data entry",
    "Predictive cash flow forecasting",
    "Automated compliance reporting",
    "Cross-location performance benchmarking",
    "Integrated fraud detection systems"
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
            <span>EOD & Future Trends</span>
          </nav>

          {/* Article Header */}
          <header className="mb-16 text-center max-w-3xl mx-auto">
            <div className="flex items-center justify-center mb-8">
              <span className="bg-yellow-100 text-yellow-800 text-xs font-medium px-4 py-2 rounded-full mr-3">
                EOD Reporting
              </span>
              <span className="bg-blue-100 text-blue-800 text-xs font-medium px-4 py-2 rounded-full">
                Future Trends
              </span>
            </div>
            
            <h1 className="text-5xl lg:text-6xl font-light text-gray-900 mb-8 leading-tight tracking-tight">
              The Future of End-of-Day Reporting: Trends and Predictions
            </h1>
            
            <p className="text-xl text-gray-600 mb-10 leading-relaxed font-light">
              Explore emerging trends in EOD reporting and how technology is making financial reconciliation faster, more accurate, and increasingly automated for modern businesses.
            </p>

            <div className="flex items-center justify-center space-x-8 text-sm text-gray-500 py-6 border-t border-b border-gray-200">
              <div className="flex items-center space-x-2">
                <User className="w-4 h-4" />
                <span>Emily Watson</span>
              </div>
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4" />
                <span>March 1, 2024</span>
              </div>
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4" />
                <span>5 min read</span>
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
                  <Book className="w-5 h-5 text-gray-400 mr-2" />
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
                <h2 className="text-3xl font-light text-gray-900 mb-8 tracking-tight">The Evolution of EOD Reporting</h2>
                <div className="prose prose-lg max-w-none font-light text-gray-700 leading-relaxed space-y-6">
                  <p>
                    End-of-day (EOD) reporting has been a cornerstone of retail and hospitality operations for decades. From handwritten ledgers to digital spreadsheets, the fundamental process has remained largely unchanged: count cash, reconcile transactions, and prepare reports for the next day.
                  </p>
                  <p>
                    But we're standing at the threshold of a revolution. Emerging technologies like artificial intelligence, computer vision, and IoT sensors are transforming EOD reporting from a time-consuming manual process into an automated, real-time operation that provides unprecedented insights and accuracy.
                  </p>
                </div>
                
                <div className="mt-10 bg-blue-50 rounded-xl p-8">
                  <h4 className="font-medium text-blue-900 mb-6 text-sm">The Transformation Timeline</h4>
                  <div className="space-y-4">
                    <div className="flex items-center space-x-4">
                      <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
                      <span className="text-blue-800 text-sm font-light"><strong>1990s-2000s:</strong> Paper-based manual counting and reporting</span>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
                      <span className="text-blue-800 text-sm font-light"><strong>2000s-2010s:</strong> Digital POS systems with basic reporting</span>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
                      <span className="text-blue-800 text-sm font-light"><strong>2010s-2020s:</strong> Cloud-based systems with mobile access</span>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="w-3 h-3 bg-green-600 rounded-full"></div>
                      <span className="text-green-800 text-sm font-light"><strong>2020s-2030s:</strong> AI-powered automation and real-time reporting</span>
                    </div>
                  </div>
                </div>
              </section>

              <section id="current-challenges" className="bg-white rounded-2xl p-10 border border-gray-100">
                <div className="flex items-center mb-8">
                  <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center mr-4">
                    <Sun className="w-6 h-6 text-red-600" />
                  </div>
                  <h2 className="text-3xl font-light text-gray-900 tracking-tight">Current EOD Challenges</h2>
                </div>
                
                <div className="prose prose-lg max-w-none font-light text-gray-700 leading-relaxed space-y-6 mb-10">
                  <p>
                    Despite technological advances, most businesses still struggle with traditional EOD reporting challenges that impact efficiency, accuracy, and decision-making speed.
                  </p>
                </div>

                <div className="space-y-6">
                  {currentChallenges.map((challenge, index) => (
                    <div key={index} className="border border-gray-200 rounded-xl p-6">
                      <div className="flex justify-between items-start mb-3">
                        <h4 className="font-medium text-gray-900">{challenge.challenge}</h4>
                        <span className="text-red-600 text-sm font-medium">{challenge.impact}</span>
                      </div>
                      <p className="text-gray-600 text-sm font-light">{challenge.description}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-10 bg-yellow-50 border-l-4 border-yellow-500 p-6">
                  <h4 className="font-medium text-yellow-900 mb-3 text-sm">The Hidden Cost of Manual EOD</h4>
                  <p className="text-yellow-800 text-sm font-light leading-relaxed">
                    A typical restaurant spends 2-4 hours daily on EOD processes across all locations. For a 5-location chain, this represents 50-100 hours weekly of staff time that could be better spent on customer service, training, or strategic activities. At $15/hour, this equals $39,000-$78,000 annually in labor costs alone.
                  </p>
                </div>
              </section>

              <section id="emerging-technologies" className="bg-white rounded-2xl p-10 border border-gray-100">
                <div className="flex items-center mb-8">
                  <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mr-4">
                    <TrendingUp className="w-6 h-6 text-purple-600" />
                  </div>
                  <h2 className="text-3xl font-light text-gray-900 tracking-tight">Emerging Technologies</h2>
                </div>
                
                <div className="prose prose-lg max-w-none font-light text-gray-700 leading-relaxed space-y-6 mb-10">
                  <p>
                    The future of EOD reporting is being shaped by several breakthrough technologies that are moving from experimental to mainstream adoption.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {emergingTechnologies.map((tech, index) => {
                    const IconComponent = tech.icon;
                    const colorClasses = {
                      blue: "bg-blue-100 text-blue-600",
                      green: "bg-green-100 text-green-600", 
                      purple: "bg-purple-100 text-purple-600",
                      orange: "bg-orange-100 text-orange-600"
                    };
                    
                    return (
                      <div key={index} className="border border-gray-200 rounded-xl p-6">
                        <div className="flex items-center mb-4">
                          <div className={`w-10 h-10 ${colorClasses[tech.color as keyof typeof colorClasses]} rounded-lg flex items-center justify-center mr-3`}>
                            <IconComponent className="w-5 h-5" />
                          </div>
                          <h4 className="font-medium text-gray-900 text-sm">{tech.technology}</h4>
                        </div>
                        <p className="text-gray-600 text-sm font-light mb-3">{tech.description}</p>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-green-600 font-medium">{tech.impact}</span>
                          <span className="text-gray-500">{tech.timeline}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section id="ai-automation" className="bg-white rounded-2xl p-10 border border-gray-100">
                <h2 className="text-3xl font-light text-gray-900 mb-8 tracking-tight">AI-Powered Automation</h2>
                <div className="prose prose-lg max-w-none font-light text-gray-700 leading-relaxed space-y-6 mb-10">
                  <p>
                    Artificial intelligence is the game-changer for EOD reporting. AI systems can automate complex reconciliation tasks, detect anomalies, and generate insights that would take human operators hours to discover.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
                  <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-8">
                    <h4 className="font-medium text-gray-900 mb-4">Current AI Capabilities</h4>
                    <ul className="space-y-3">
                      <li className="flex items-center text-gray-700 text-sm">
                        <CheckCircle className="w-4 h-4 text-green-500 mr-3 flex-shrink-0" />
                        Automated transaction categorization
                      </li>
                      <li className="flex items-center text-gray-700 text-sm">
                        <CheckCircle className="w-4 h-4 text-green-500 mr-3 flex-shrink-0" />
                        Anomaly detection and alerts
                      </li>
                      <li className="flex items-center text-gray-700 text-sm">
                        <CheckCircle className="w-4 h-4 text-green-500 mr-3 flex-shrink-0" />
                        Pattern recognition for fraud prevention
                      </li>
                      <li className="flex items-center text-gray-700 text-sm">
                        <CheckCircle className="w-4 h-4 text-green-500 mr-3 flex-shrink-0" />
                        Predictive cash flow forecasting
                      </li>
                    </ul>
                  </div>

                  <div className="bg-gradient-to-br from-green-50 to-blue-50 rounded-xl p-8">
                    <h4 className="font-medium text-gray-900 mb-4">Future AI Features (2025-2027)</h4>
                    <ul className="space-y-3">
                      <li className="flex items-center text-gray-700 text-sm">
                        <TrendingUp className="w-4 h-4 text-blue-500 mr-3 flex-shrink-0" />
                        Natural language reporting queries
                      </li>
                      <li className="flex items-center text-gray-700 text-sm">
                        <TrendingUp className="w-4 h-4 text-blue-500 mr-3 flex-shrink-0" />
                        Autonomous problem resolution
                      </li>
                      <li className="flex items-center text-gray-700 text-sm">
                        <TrendingUp className="w-4 h-4 text-blue-500 mr-3 flex-shrink-0" />
                        Intelligent inventory optimization
                      </li>
                      <li className="flex items-center text-gray-700 text-sm">
                        <TrendingUp className="w-4 h-4 text-blue-500 mr-3 flex-shrink-0" />
                        Advanced behavioral analytics
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="bg-green-50 border-l-4 border-green-500 p-6">
                  <h4 className="font-medium text-green-900 mb-3 text-sm">Real-World Example: Smart Cash Counting</h4>
                  <p className="text-green-800 text-sm font-light leading-relaxed">
                    A coffee chain in Seattle is piloting computer vision systems that can count cash drawers with 99.8% accuracy in under 30 seconds. The system photographs bills and coins, uses AI to identify denominations and quantities, and automatically reconciles against POS data. Early results show 95% reduction in counting time and elimination of human counting errors.
                  </p>
                </div>
              </section>

              <section id="future-vision" className="bg-white rounded-2xl p-10 border border-gray-100">
                <h2 className="text-3xl font-light text-gray-900 mb-8 tracking-tight">The Future Vision</h2>
                <div className="prose prose-lg max-w-none font-light text-gray-700 leading-relaxed space-y-6 mb-10">
                  <p>
                    Imagine walking into your restaurant at closing time and finding that EOD reporting is already complete. Cash has been automatically counted, transactions reconciled, discrepancies flagged, and tomorrow's cash flow forecast updated. This isn't science fiction—it's the near future of EOD reporting.
                  </p>
                </div>

                <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-8 text-white mb-10">
                  <h4 className="font-medium mb-6">Future EOD Reporting Features</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {futureFeatures.map((feature, index) => (
                      <div key={index} className="flex items-center text-white text-sm">
                        <CheckCircle className="w-4 h-4 mr-3 flex-shrink-0" />
                        {feature}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-8">
                  <div className="border-l-4 border-blue-500 pl-6">
                    <h3 className="text-xl font-medium text-gray-900 mb-3">2024-2025: Foundation Phase</h3>
                    <p className="text-gray-600 font-light mb-2">Basic AI automation and computer vision become mainstream</p>
                    <ul className="space-y-1 text-gray-600 text-sm font-light">
                      <li>• Automated cash counting systems</li>
                      <li>• Real-time transaction monitoring</li>
                      <li>• Basic anomaly detection</li>
                    </ul>
                  </div>
                  
                  <div className="border-l-4 border-green-500 pl-6">
                    <h3 className="text-xl font-medium text-gray-900 mb-3">2025-2027: Intelligence Phase</h3>
                    <p className="text-gray-600 font-light mb-2">Advanced AI and predictive analytics integration</p>
                    <ul className="space-y-1 text-gray-600 text-sm font-light">
                      <li>• Predictive cash flow forecasting</li>
                      <li>• Intelligent fraud detection</li>
                      <li>• Autonomous problem resolution</li>
                    </ul>
                  </div>
                  
                  <div className="border-l-4 border-purple-500 pl-6">
                    <h3 className="text-xl font-medium text-gray-900 mb-3">2027+: Autonomous Phase</h3>
                    <p className="text-gray-600 font-light mb-2">Fully autonomous EOD processes with minimal human intervention</p>
                    <ul className="space-y-1 text-gray-600 text-sm font-light">
                      <li>• Complete process automation</li>
                      <li>• Self-optimizing systems</li>
                      <li>• Integrated business intelligence</li>
                    </ul>
                  </div>
                </div>
              </section>

              {/* CTA Section */}
              <section className="bg-gray-900 rounded-3xl p-12 text-white text-center">
                <h3 className="text-3xl font-light mb-6 tracking-tight">Experience the Future of EOD Reporting Today</h3>
                <p className="text-lg text-gray-300 mb-8 font-light leading-relaxed max-w-2xl mx-auto">
                  Get started with next-generation EOD reporting featuring AI automation, real-time insights, and intelligent anomaly detection.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Link 
                    to="/dashboard" 
                    className="bg-white text-gray-900 px-8 py-4 rounded-xl font-medium text-sm hover:bg-gray-100 transition-colors"
                  >
                    Start Free Trial
                  </Link>
                  <Link 
                    to="/#features" 
                    className="border border-white text-white px-8 py-4 rounded-xl font-medium text-sm hover:bg-white hover:text-gray-900 transition-colors"
                  >
                    See EOD Features
                  </Link>
                </div>
                <p className="text-sm text-gray-400 mt-4 font-light">
                  AI-powered automation • Real-time reporting • Setup in minutes
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
                <Brain className="w-6 h-6 text-blue-600" />
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
                <Smartphone className="w-6 h-6 text-green-600" />
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

            <article className="bg-gray-50 rounded-2xl p-8 hover:bg-white hover:shadow-lg hover:shadow-gray-100/50 transition-all duration-300 group border border-gray-100">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-6">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
              <h4 className="text-lg font-light text-gray-900 mb-3 group-hover:text-gray-600 transition-colors">
                Understanding Financial Analytics for Restaurant Chains
              </h4>
              <p className="text-gray-600 text-sm font-light mb-4 leading-relaxed">
                A comprehensive guide to key financial metrics for restaurants.
              </p>
              <Link to="/blog/financial-analytics-restaurants" className="text-gray-900 font-medium text-sm hover:text-gray-600 transition-colors">
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

export default FutureEODReporting;
