import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Calendar, Clock, User, Share2, BookOpen, Shield, ChevronRight, CheckCircle, Lock, Eye, AlertTriangle, Key, Database, Smartphone } from 'lucide-react';

const FinancialDataSecurity: React.FC = () => {
  const tableOfContents = [
    { id: "introduction", title: "The Critical Importance of Financial Data Security" },
    { id: "threat-landscape", title: "Understanding the Threat Landscape" },
    { id: "compliance", title: "Regulatory Compliance Requirements" },
    { id: "best-practices", title: "Security Best Practices" },
    { id: "access-control", title: "Access Control and User Management" },
    { id: "data-encryption", title: "Data Encryption and Protection" },
    { id: "monitoring", title: "Monitoring and Incident Response" },
    { id: "training", title: "Employee Training and Awareness" },
    { id: "implementation", title: "Implementation Roadmap" }
  ];

  const securityThreats = [
    {
      threat: "Data Breaches",
      impact: "$4.45M average cost per breach",
      description: "Unauthorized access to sensitive financial information",
      likelihood: "High"
    },
    {
      threat: "Ransomware Attacks",
      impact: "$1.85M average ransom + downtime",
      description: "Malicious encryption of financial systems and data",
      likelihood: "Very High"
    },
    {
      threat: "Insider Threats",
      impact: "$4.90M average cost per incident",
      description: "Malicious or negligent actions by employees",
      likelihood: "Medium"
    },
    {
      threat: "Phishing Attacks",
      impact: "$4.65M average cost per incident",
      description: "Social engineering to steal credentials",
      likelihood: "Very High"
    }
  ];

  const securityLayers = [
    {
      layer: "Network Security",
      description: "Firewalls, VPNs, and network segmentation",
      measures: ["Next-generation firewalls", "VPN access controls", "Network monitoring", "Intrusion detection"],
      icon: Shield,
      color: "blue"
    },
    {
      layer: "Data Encryption",
      description: "Encryption at rest and in transit",
      measures: ["AES-256 encryption", "TLS 1.3 protocols", "Key management", "Database encryption"],
      icon: Lock,
      color: "green"
    },
    {
      layer: "Access Control",
      description: "Identity and access management",
      measures: ["Multi-factor authentication", "Role-based access", "Single sign-on", "Regular access reviews"],
      icon: Key,
      color: "purple"
    },
    {
      layer: "Monitoring & Response",
      description: "Continuous monitoring and incident response",
      measures: ["Security information and event management", "Real-time alerts", "Incident response plan", "Regular security audits"],
      icon: Eye,
      color: "orange"
    }
  ];

  const complianceFrameworks = [
    { framework: "SOC 2 Type II", description: "Security, availability, processing integrity controls", required: "Recommended" },
    { framework: "PCI DSS", description: "Payment card industry data security standard", required: "Required if processing cards" },
    { framework: "GDPR", description: "General data protection regulation", required: "Required for EU customers" },
    { framework: "CCPA", description: "California consumer privacy act", required: "Required for CA residents" }
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
            <span>Security & Compliance</span>
          </nav>

          {/* Article Header */}
          <header className="mb-16 text-center max-w-3xl mx-auto">
            <div className="flex items-center justify-center mb-8">
              <span className="bg-red-100 text-red-800 text-xs font-medium px-4 py-2 rounded-full mr-3">
                Security
              </span>
              <span className="bg-gray-100 text-gray-800 text-xs font-medium px-4 py-2 rounded-full">
                Data Protection
              </span>
            </div>
            
            <h1 className="text-5xl lg:text-6xl font-light text-gray-900 mb-8 leading-tight tracking-tight">
              Security Best Practices for Financial Data Management
            </h1>
            
            <p className="text-xl text-gray-600 mb-10 leading-relaxed font-light">
              Learn essential security measures to protect sensitive financial data in multi-outlet business environments. A comprehensive guide to compliance, risk management, and security implementation.
            </p>

            <div className="flex items-center justify-center space-x-8 text-sm text-gray-500 py-6 border-t border-b border-gray-200">
              <div className="flex items-center space-x-2">
                <User className="w-4 h-4" />
                <span>Marcus Rodriguez</span>
              </div>
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4" />
                <span>March 3, 2024</span>
              </div>
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4" />
                <span>6 min read</span>
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
                <h2 className="text-3xl font-light text-gray-900 mb-8 tracking-tight">The Critical Importance of Financial Data Security</h2>
                <div className="prose prose-lg max-w-none font-light text-gray-700 leading-relaxed space-y-6">
                  <p>
                    Financial data is among the most sensitive information any business handles. For multi-location businesses, the challenge is exponentially greater—you're not just protecting one set of financial records, but financial data across multiple outlets, each potentially with different access needs and security challenges.
                  </p>
                  <p>
                    A single data breach can cost businesses an average of <strong>$4.45 million</strong>, but for businesses handling financial data, the costs can be much higher due to regulatory fines, legal fees, and long-term reputation damage.
                  </p>
                </div>
                
                <div className="mt-10 bg-red-50 rounded-xl p-8 border border-red-100">
                  <h4 className="font-medium text-red-900 mb-6 text-sm">Why Financial Data is Targeted</h4>
                  <div className="space-y-4">
                    <div className="flex items-start space-x-3">
                      <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                      <span className="text-red-800 text-sm font-light">High value on dark web markets (bank details, credit cards, financial records)</span>
                    </div>
                    <div className="flex items-start space-x-3">
                      <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                      <span className="text-red-800 text-sm font-light">Enables identity theft and financial fraud</span>
                    </div>
                    <div className="flex items-start space-x-3">
                      <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                      <span className="text-red-800 text-sm font-light">Can be used for business intelligence and competitive advantage</span>
                    </div>
                  </div>
                </div>
              </section>

              <section id="threat-landscape" className="bg-white rounded-2xl p-10 border border-gray-100">
                <div className="flex items-center mb-8">
                  <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center mr-4">
                    <AlertTriangle className="w-6 h-6 text-orange-600" />
                  </div>
                  <h2 className="text-3xl font-light text-gray-900 tracking-tight">Understanding the Threat Landscape</h2>
                </div>
                
                <div className="prose prose-lg max-w-none font-light text-gray-700 leading-relaxed space-y-6 mb-10">
                  <p>
                    Understanding the specific threats facing your financial data is the first step in building effective defenses. Here are the most common and costly threats businesses face today.
                  </p>
                </div>

                <div className="space-y-6">
                  {securityThreats.map((threat, index) => (
                    <div key={index} className="border border-gray-200 rounded-xl p-6">
                      <div className="flex justify-between items-start mb-3">
                        <h4 className="font-medium text-gray-900">{threat.threat}</h4>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          threat.likelihood === 'Very High' ? 'bg-red-100 text-red-800' :
                          threat.likelihood === 'High' ? 'bg-orange-100 text-orange-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {threat.likelihood} Risk
                        </span>
                      </div>
                      <p className="text-gray-600 text-sm font-light mb-3">{threat.description}</p>
                      <div className="text-red-600 text-sm font-medium">{threat.impact}</div>
                    </div>
                  ))}
                </div>
              </section>

              <section id="best-practices" className="bg-white rounded-2xl p-10 border border-gray-100">
                <div className="flex items-center mb-8">
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mr-4">
                    <Shield className="w-6 h-6 text-green-600" />
                  </div>
                  <h2 className="text-3xl font-light text-gray-900 tracking-tight">Security Best Practices</h2>
                </div>
                
                <div className="prose prose-lg max-w-none font-light text-gray-700 leading-relaxed space-y-6 mb-10">
                  <p>
                    Effective financial data security requires a layered approach, with multiple security controls working together to protect your data at every level.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {securityLayers.map((layer, index) => {
                    const IconComponent = layer.icon;
                    const colorClasses = {
                      blue: "bg-blue-100 text-blue-600",
                      green: "bg-green-100 text-green-600", 
                      purple: "bg-purple-100 text-purple-600",
                      orange: "bg-orange-100 text-orange-600"
                    };
                    
                    return (
                      <div key={index} className="border border-gray-200 rounded-xl p-6">
                        <div className="flex items-center mb-4">
                          <div className={`w-10 h-10 ${colorClasses[layer.color as keyof typeof colorClasses]} rounded-lg flex items-center justify-center mr-3`}>
                            <IconComponent className="w-5 h-5" />
                          </div>
                          <h4 className="font-medium text-gray-900 text-sm">{layer.layer}</h4>
                        </div>
                        <p className="text-gray-600 text-sm font-light mb-4">{layer.description}</p>
                        <ul className="space-y-1">
                          {layer.measures.map((measure, measureIndex) => (
                            <li key={measureIndex} className="flex items-center text-gray-600 text-xs">
                              <CheckCircle className="w-3 h-3 text-gray-400 mr-2 flex-shrink-0" />
                              {measure}
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section id="compliance" className="bg-white rounded-2xl p-10 border border-gray-100">
                <h2 className="text-3xl font-light text-gray-900 mb-8 tracking-tight">Regulatory Compliance Requirements</h2>
                <div className="prose prose-lg max-w-none font-light text-gray-700 leading-relaxed space-y-6 mb-10">
                  <p>
                    Financial data is subject to numerous regulatory requirements. Compliance isn't just about avoiding fines—it's about implementing proven security frameworks that protect your business and customers.
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-gray-200 rounded-lg">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="border border-gray-200 px-6 py-4 text-left font-medium text-gray-900">Framework</th>
                        <th className="border border-gray-200 px-6 py-4 text-left font-medium text-gray-900">Description</th>
                        <th className="border border-gray-200 px-6 py-4 text-left font-medium text-gray-900">Applicability</th>
                      </tr>
                    </thead>
                    <tbody>
                      {complianceFrameworks.map((framework, index) => (
                        <tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                          <td className="border border-gray-200 px-6 py-4 font-medium text-gray-900">{framework.framework}</td>
                          <td className="border border-gray-200 px-6 py-4 text-gray-700 text-sm">{framework.description}</td>
                          <td className="border border-gray-200 px-6 py-4 text-gray-700 text-sm">{framework.required}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section id="implementation" className="bg-white rounded-2xl p-10 border border-gray-100">
                <h2 className="text-3xl font-light text-gray-900 mb-8 tracking-tight">Implementation Roadmap</h2>
                <div className="prose prose-lg max-w-none font-light text-gray-700 leading-relaxed space-y-6 mb-10">
                  <p>
                    Implementing comprehensive financial data security requires a systematic approach. Here's a practical roadmap for building robust security controls.
                  </p>
                </div>

                <div className="space-y-8">
                  <div className="border-l-4 border-red-500 pl-6">
                    <h3 className="text-xl font-medium text-gray-900 mb-3">Phase 1: Immediate Actions (Week 1)</h3>
                    <ul className="space-y-2 text-gray-600 font-light">
                      <li>• Enable multi-factor authentication on all financial systems</li>
                      <li>• Conduct security audit of current access permissions</li>
                      <li>• Implement automatic screen locks and session timeouts</li>
                      <li>• Review and update password policies</li>
                    </ul>
                  </div>
                  
                  <div className="border-l-4 border-orange-500 pl-6">
                    <h3 className="text-xl font-medium text-gray-900 mb-3">Phase 2: Foundation Building (Weeks 2-4)</h3>
                    <ul className="space-y-2 text-gray-600 font-light">
                      <li>• Implement data encryption at rest and in transit</li>
                      <li>• Set up network segmentation and firewalls</li>
                      <li>• Deploy endpoint detection and response tools</li>
                      <li>• Establish backup and disaster recovery procedures</li>
                    </ul>
                  </div>
                  
                  <div className="border-l-4 border-green-500 pl-6">
                    <h3 className="text-xl font-medium text-gray-900 mb-3">Phase 3: Advanced Security (Months 2-3)</h3>
                    <ul className="space-y-2 text-gray-600 font-light">
                      <li>• Implement security information and event management (SIEM)</li>
                      <li>• Conduct penetration testing and vulnerability assessments</li>
                      <li>• Develop incident response and business continuity plans</li>
                      <li>• Establish regular security training programs</li>
                    </ul>
                  </div>
                </div>
              </section>

              {/* CTA Section */}
              <section className="bg-gray-900 rounded-3xl p-12 text-white text-center">
                <h3 className="text-3xl font-light mb-6 tracking-tight">Secure Your Financial Data Today</h3>
                <p className="text-lg text-gray-300 mb-8 font-light leading-relaxed max-w-2xl mx-auto">
                  Get enterprise-grade security for your financial data with built-in compliance controls, advanced encryption, and continuous monitoring.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Link 
                    to="/dashboard" 
                    className="bg-white text-gray-900 px-8 py-4 rounded-xl font-medium text-sm hover:bg-gray-100 transition-colors"
                  >
                    Start Secure Trial
                  </Link>
                  <Link 
                    to="/#features" 
                    className="border border-white text-white px-8 py-4 rounded-xl font-medium text-sm hover:bg-white hover:text-gray-900 transition-colors"
                  >
                    See Security Features
                  </Link>
                </div>
                <p className="text-sm text-gray-400 mt-4 font-light">
                  SOC 2 compliant • End-to-end encryption • Regular security audits
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
                <Database className="w-6 h-6 text-blue-600" />
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
                <Lock className="w-6 h-6 text-purple-600" />
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

export default FinancialDataSecurity;
