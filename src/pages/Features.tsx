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
  CheckCircle
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

  const integrations = [
    { name: "Supabase", logo: "🔗" },
    { name: "OpenAI GPT-4", logo: "🤖" },
    { name: "Google Vision", logo: "👁️" },
    { name: "Vercel", logo: "▲" }
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 bg-white/95 backdrop-blur-md border-b border-gray-200 z-50">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link to="/" className="flex items-center">
                <span className="text-2xl font-bold text-blue-600">Compazz</span>
              </Link>
            </div>
            <div className="hidden md:flex items-center space-x-8">
              <Link to="/features" className="text-blue-600 font-medium">Features</Link>
              <Link to="/pricing" className="text-gray-600 hover:text-gray-900 font-medium">Pricing</Link>
              <Link to="/about" className="text-gray-600 hover:text-gray-900 font-medium">About</Link>
              <Link to="/blog" className="text-gray-600 hover:text-gray-900 font-medium">Blog</Link>
              <Link to="/docs" className="text-gray-600 hover:text-gray-900 font-medium">Docs</Link>
            </div>
            <div className="flex items-center space-x-4">
              <Link to="/auth" className="text-gray-600 hover:text-gray-900 font-medium">Sign In</Link>
              <Link to="/dashboard" className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors">
                Get Started
              </Link>
            </div>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center px-4 py-2 bg-blue-100 text-blue-800 rounded-full text-sm font-medium mb-6">
            <Zap className="w-4 h-4 mr-2" />
            Powered by AI & Machine Learning
          </div>
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
            Features built for
            <span className="text-blue-600 block">modern businesses</span>
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
            Every tool you need to manage multi-outlet finances, powered by cutting-edge AI and designed for the mobile-first world.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/dashboard" className="bg-blue-600 text-white px-8 py-4 rounded-lg text-lg font-medium hover:bg-blue-700 transition-colors">
              Start Free Trial
            </Link>
            <Link to="/pricing" className="border-2 border-gray-300 text-gray-700 px-8 py-4 rounded-lg text-lg font-medium hover:border-gray-400 transition-colors">
              View Pricing
            </Link>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Everything you need, nothing you don't</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Built by finance professionals for finance professionals. Every feature serves a real business need.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="bg-white border border-gray-200 rounded-xl p-8 hover:shadow-lg transition-shadow">
                <div className="text-blue-600 mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">{feature.title}</h3>
                <p className="text-gray-600 mb-6">{feature.description}</p>
                <ul className="space-y-2">
                  {feature.benefits.map((benefit, idx) => (
                    <li key={idx} className="flex items-center text-sm text-gray-600">
                      <CheckCircle className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" />
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
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center px-4 py-2 bg-purple-100 text-purple-800 rounded-full text-sm font-medium mb-6">
              <Brain className="w-4 h-4 mr-2" />
              AI-Powered Technology
            </div>
            <h2 className="text-4xl font-bold text-gray-900 mb-4">The intelligence behind Compazz</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              We leverage the latest advances in AI to make financial management effortless and accurate.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="bg-white rounded-xl p-8 shadow-sm">
              <Camera className="w-12 h-12 text-blue-600 mb-4" />
              <h3 className="text-xl font-semibold mb-3">Computer Vision OCR</h3>
              <p className="text-gray-600 mb-4">
                Advanced optical character recognition extracts data from invoices, receipts, and documents with incredible accuracy.
              </p>
              <div className="text-sm text-gray-500">Powered by Google Cloud Vision</div>
            </div>

            <div className="bg-white rounded-xl p-8 shadow-sm">
              <Brain className="w-12 h-12 text-purple-600 mb-4" />
              <h3 className="text-xl font-semibold mb-3">GPT-4 Data Processing</h3>
              <p className="text-gray-600 mb-4">
                OpenAI's most advanced language model structures and validates extracted data, ensuring consistency and accuracy.
              </p>
              <div className="text-sm text-gray-500">Powered by OpenAI GPT-4</div>
            </div>

            <div className="bg-white rounded-xl p-8 shadow-sm">
              <TrendingUp className="w-12 h-12 text-green-600 mb-4" />
              <h3 className="text-xl font-semibold mb-3">Predictive Analytics</h3>
              <p className="text-gray-600 mb-4">
                Machine learning algorithms analyze patterns to predict trends, detect anomalies, and recommend optimizations.
              </p>
              <div className="text-sm text-gray-500">Built-in ML Models</div>
            </div>
          </div>
        </div>
      </section>

      {/* Integrations */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h3 className="text-2xl font-semibold text-gray-900 mb-8">Built with industry-leading technology</h3>
          <div className="flex justify-center items-center space-x-12 opacity-60">
            {integrations.map((integration, index) => (
              <div key={index} className="flex items-center space-x-2">
                <span className="text-2xl">{integration.logo}</span>
                <span className="font-medium">{integration.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-blue-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold text-white mb-6">
            Ready to transform your business?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Join thousands of businesses already using Compazz to streamline their financial operations.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/dashboard" className="bg-white text-blue-600 px-8 py-4 rounded-lg text-lg font-medium hover:bg-gray-100 transition-colors">
              Start Free Trial
            </Link>
            <Link to="/pricing" className="border-2 border-white text-white px-8 py-4 rounded-lg text-lg font-medium hover:bg-white hover:text-blue-600 transition-colors">
              View Pricing
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="text-2xl font-bold text-blue-400 mb-4">Compazz</div>
              <p className="text-gray-400">
                AI-powered financial management for modern businesses.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-gray-400">
                <li><Link to="/features" className="hover:text-white">Features</Link></li>
                <li><Link to="/pricing" className="hover:text-white">Pricing</Link></li>
                <li><Link to="/docs" className="hover:text-white">Documentation</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-gray-400">
                <li><Link to="/about" className="hover:text-white">About</Link></li>
                <li><Link to="/blog" className="hover:text-white">Blog</Link></li>
                <li><Link to="/careers" className="hover:text-white">Careers</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="mailto:support@compazz.com" className="hover:text-white">Contact</a></li>
                <li><Link to="/help" className="hover:text-white">Help Center</Link></li>
                <li><Link to="/status" className="hover:text-white">Status</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2024 Compazz. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Features;