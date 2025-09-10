import React from 'react';
import { Link } from 'react-router-dom';

const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 bg-black/80 backdrop-blur-md border-b border-gray-800 z-50">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <img src="/logo-white.svg" alt="Compazz" className="h-8" />
            </div>
            <div className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-gray-300 hover:text-white font-medium">Features</a>
              <a href="#pricing" className="text-gray-300 hover:text-white font-medium">Pricing</a>
              <a href="#docs" className="text-gray-300 hover:text-white font-medium">Docs</a>
              <a href="#about" className="text-gray-300 hover:text-white font-medium">About</a>
            </div>
            <div className="flex items-center space-x-4">
              <Link 
                to="/auth" 
                className="text-gray-300 hover:text-white font-medium"
              >
                Sign In
              </Link>
              <Link 
                to="/dashboard" 
                className="bg-white text-black px-4 py-2 rounded-lg font-medium hover:bg-gray-100 transition-colors"
              >
                Get Started
              </Link>
            </div>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 bg-black text-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <h1 className="text-5xl md:text-7xl font-black mb-8 leading-tight tracking-tight">
            How businesses manage their finances
          </h1>
          <p className="text-xl md:text-2xl mb-12 text-gray-300 max-w-4xl mx-auto leading-relaxed">
            The complete financial management platform that helps businesses track expenses, 
            manage invoices, generate reports, and make data-driven decisions with confidence.
          </p>
          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
            <Link 
              to="/dashboard" 
              className="bg-white text-black px-8 py-4 rounded-lg font-bold text-lg hover:bg-gray-100 transition-all transform hover:scale-105"
            >
              Get Started - Free
            </Link>
            <a 
              href="#features" 
              className="text-gray-300 hover:text-white font-medium text-lg transition-colors"
            >
              See How It Works →
            </a>
          </div>
        </div>
        
        {/* Background elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
              Everything you need to manage your finances
            </h2>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              From expense tracking to end-of-day reports, Compazz provides all the tools 
              modern businesses need to stay financially healthy.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-gray-800 p-8 rounded-xl border border-gray-700 hover:border-gray-600 transition-all hover:transform hover:scale-105">
              <div className="w-12 h-12 bg-purple-500 rounded-lg flex items-center justify-center mb-6">
                <span className="text-2xl">📊</span>
              </div>
              <h3 className="text-xl font-bold text-white mb-4">Real-time Analytics</h3>
              <p className="text-gray-300">
                Get instant insights into your financial performance with beautiful dashboards 
                and customizable reports that update in real-time.
              </p>
            </div>
            
            <div className="bg-gray-800 p-8 rounded-xl border border-gray-700 hover:border-gray-600 transition-all hover:transform hover:scale-105">
              <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center mb-6">
                <span className="text-2xl">🏪</span>
              </div>
              <h3 className="text-xl font-bold text-white mb-4">Multi-Outlet Management</h3>
              <p className="text-gray-300">
                Manage multiple business locations from a single dashboard. Track performance, 
                compare outlets, and consolidate reporting effortlessly.
              </p>
            </div>
            
            <div className="bg-gray-800 p-8 rounded-xl border border-gray-700 hover:border-gray-600 transition-all hover:transform hover:scale-105">
              <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center mb-6">
                <span className="text-2xl">📱</span>
              </div>
              <h3 className="text-xl font-bold text-white mb-4">Mobile-First Design</h3>
              <p className="text-gray-300">
                Built for mobile devices with intuitive interfaces. Your team can manage 
                finances on-the-go with our responsive design.
              </p>
            </div>
            
            <div className="bg-gray-800 p-8 rounded-xl border border-gray-700 hover:border-gray-600 transition-all hover:transform hover:scale-105">
              <div className="w-12 h-12 bg-yellow-500 rounded-lg flex items-center justify-center mb-6">
                <span className="text-2xl">🧾</span>
              </div>
              <h3 className="text-xl font-bold text-white mb-4">Smart Invoice Management</h3>
              <p className="text-gray-300">
                Create, send, and track invoices automatically. Get paid faster with 
                integrated payment processing and automated reminders.
              </p>
            </div>
            
            <div className="bg-gray-800 p-8 rounded-xl border border-gray-700 hover:border-gray-600 transition-all hover:transform hover:scale-105">
              <div className="w-12 h-12 bg-red-500 rounded-lg flex items-center justify-center mb-6">
                <span className="text-2xl">📈</span>
              </div>
              <h3 className="text-xl font-bold text-white mb-4">End-of-Day Reports</h3>
              <p className="text-gray-300">
                Generate comprehensive daily reports with photo attachments and comments. 
                Perfect for retail and service businesses.
              </p>
            </div>
            
            <div className="bg-gray-800 p-8 rounded-xl border border-gray-700 hover:border-gray-600 transition-all hover:transform hover:scale-105">
              <div className="w-12 h-12 bg-indigo-500 rounded-lg flex items-center justify-center mb-6">
                <span className="text-2xl">🔒</span>
              </div>
              <h3 className="text-xl font-bold text-white mb-4">Enterprise Security</h3>
              <p className="text-gray-300">
                Bank-level security with role-based access control, data encryption, 
                and compliance with financial regulations.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 bg-black text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-4xl md:text-5xl font-black mb-2 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">10+</div>
              <div className="text-gray-300 font-medium">Financial Tools</div>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-black mb-2 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">99.9%</div>
              <div className="text-gray-300 font-medium">Uptime</div>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-black mb-2 text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-400">24/7</div>
              <div className="text-gray-300 font-medium">Support</div>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-black mb-2 text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-400">1000+</div>
              <div className="text-gray-300 font-medium">Happy Businesses</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gray-900 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl md:text-5xl font-black mb-6">
            Ready to transform your financial management?
          </h2>
          <p className="text-xl text-gray-300 mb-12 max-w-2xl mx-auto">
            Join thousands of businesses already using Compazz to streamline their finances and make better decisions.
          </p>
          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
            <Link 
              to="/dashboard" 
              className="bg-white text-black px-8 py-4 rounded-lg font-bold text-lg hover:bg-gray-100 transition-all transform hover:scale-105"
            >
              Start Your Free Trial
            </Link>
            <a 
              href="#features" 
              className="text-gray-300 hover:text-white font-medium text-lg transition-colors"
            >
              Learn More →
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black text-gray-400 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h4 className="text-white font-bold mb-6 text-lg">Product</h4>
              <ul className="space-y-3">
                <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#integrations" className="hover:text-white transition-colors">Integrations</a></li>
                <li><a href="#api" className="hover:text-white transition-colors">API</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-bold mb-6 text-lg">Resources</h4>
              <ul className="space-y-3">
                <li><a href="#docs" className="hover:text-white transition-colors">Documentation</a></li>
                <li><a href="#guides" className="hover:text-white transition-colors">Guides</a></li>
                <li><a href="#blog" className="hover:text-white transition-colors">Blog</a></li>
                <li><a href="#support" className="hover:text-white transition-colors">Support</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-bold mb-6 text-lg">Company</h4>
              <ul className="space-y-3">
                <li><a href="#about" className="hover:text-white transition-colors">About</a></li>
                <li><a href="#careers" className="hover:text-white transition-colors">Careers</a></li>
                <li><a href="#contact" className="hover:text-white transition-colors">Contact</a></li>
                <li><a href="#privacy" className="hover:text-white transition-colors">Privacy</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-bold mb-6 text-lg">Connect</h4>
              <ul className="space-y-3">
                <li><a href="#twitter" className="hover:text-white transition-colors">Twitter</a></li>
                <li><a href="#linkedin" className="hover:text-white transition-colors">LinkedIn</a></li>
                <li><a href="#github" className="hover:text-white transition-colors">GitHub</a></li>
                <li><a href="#discord" className="hover:text-white transition-colors">Discord</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-12 pt-8 text-center">
            <p className="text-gray-500">&copy; 2024 Compazz. All rights reserved. Built with ❤️ for modern businesses.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
