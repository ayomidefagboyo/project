import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Download,
  Mail,
  Share2,
  Calculator,
  CheckCircle,
  X
} from 'lucide-react';
import PublicHeader from '@/components/layout/PublicHeader';
import SEOHead from '@/components/seo/SEOHead';

interface CalculatorLayoutProps {
  title: string;
  description: string;
  children: React.ReactNode;
  results?: {
    title: string;
    value: string | number;
    subtitle?: string;
    insights?: string[];
  };
  onExportPDF?: () => void;
  onExportExcel?: () => void;
  keywords?: string;
  canonical?: string;
}

const CalculatorLayout: React.FC<CalculatorLayoutProps> = ({
  title,
  description,
  children,
  results,
  onExportPDF,
  onExportExcel,
  keywords,
  canonical
}) => {
  const [showEmailCapture, setShowEmailCapture] = useState(false);
  const [email, setEmail] = useState('');
  const [emailSubmitted, setEmailSubmitted] = useState(false);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    try {
      // Here you would integrate with your email service
      console.log('Capturing email for advanced calculations:', email);

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));

      setEmailSubmitted(true);
      setTimeout(() => {
        setShowEmailCapture(false);
        setEmailSubmitted(false);
        setEmail('');
      }, 2000);
    } catch (error) {
      console.error('Email capture error:', error);
    }
  };

  const shareCalculator = () => {
    if (navigator.share) {
      navigator.share({
        title: `${title} - Free Business Calculator`,
        text: description,
        url: window.location.href,
      });
    } else {
      // Fallback to copying URL to clipboard
      navigator.clipboard.writeText(window.location.href);
      // You could show a toast here
    }
  };

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": title,
    "description": description,
    "url": canonical ? `https://compazz.app${canonical}` : undefined,
    "applicationCategory": "BusinessApplication",
    "operatingSystem": "Web Browser",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD"
    },
    "publisher": {
      "@type": "Organization",
      "name": "Compazz",
      "url": "https://compazz.app"
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SEOHead
        title={title}
        description={description}
        keywords={keywords}
        canonical={canonical}
        structuredData={structuredData}
      />
      <PublicHeader />

      {/* Calculator Header */}
      <div className="bg-background border-b border-border pt-16">
        <div className="container-width">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link
                to="/calculators"
                className="flex items-center text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="w-5 h-5 mr-2" />
                Back to Calculators
              </Link>
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={shareCalculator}
                className="flex items-center px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white border border-gray-300 dark:border-gray-600 rounded-lg hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
              >
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </button>

              {results && (
                <div className="flex items-center space-x-2">
                  {onExportPDF && (
                    <button
                      onClick={onExportPDF}
                      className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      PDF
                    </button>
                  )}
                  {onExportExcel && (
                    <button
                      onClick={onExportExcel}
                      className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Excel
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="mt-6">
            <div className="flex items-center mb-4">
              <Calculator className="w-8 h-8 text-primary mr-3" />
              <h1 className="text-3xl font-semibold text-foreground">
                {title}
              </h1>
            </div>
            <p className="text-lg text-muted-foreground max-w-3xl">
              {description}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container-width py-6">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Calculator Form */}
          <div className="lg:col-span-2">
            <div className="card p-8">
              {children}
            </div>
          </div>

          {/* Results & Actions */}
          <div className="space-y-6">
            {/* Results Card */}
            {results && (
              <div className="card p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">
                  {results.title}
                </h3>

                <div className="text-center py-6">
                  <div className="text-4xl font-bold text-primary mb-2">
                    {results.value}
                  </div>
                  {results.subtitle && (
                    <div className="text-muted-foreground text-sm">
                      {results.subtitle}
                    </div>
                  )}
                </div>

                {results.insights && results.insights.length > 0 && (
                  <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-600">
                    <h4 className="font-medium text-gray-900 dark:text-white mb-3">Key Insights:</h4>
                    <ul className="space-y-2">
                      {results.insights.map((insight, index) => (
                        <li key={index} className="flex items-start text-sm text-gray-600 dark:text-gray-300">
                          <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                          {insight}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Email Capture Card */}
            <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800">
              <div className="flex items-center mb-4">
                <Mail className="w-6 h-6 text-blue-600 mr-3" />
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  Get Advanced Calculations
                </h3>
              </div>

              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                Save your results and get advanced financial analysis, scenario planning, and actionable recommendations.
              </p>

              {!showEmailCapture ? (
                <button
                  onClick={() => setShowEmailCapture(true)}
                  className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  Get Free Advanced Analysis
                </button>
              ) : (
                <form onSubmit={handleEmailSubmit} className="space-y-3">
                  {!emailSubmitted ? (
                    <>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Enter your email address"
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        required
                      />
                      <div className="flex space-x-2">
                        <button
                          type="submit"
                          className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                        >
                          Send Analysis
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowEmailCapture(false)}
                          className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-4">
                      <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
                      <p className="text-green-700 dark:text-green-400 font-medium">
                        Analysis sent to your email!
                      </p>
                    </div>
                  )}
                </form>
              )}
            </div>

            {/* Upgrade CTA */}
            <div className="bg-gradient-to-br from-purple-600 to-blue-600 text-white rounded-xl p-6">
              <h3 className="font-semibold mb-2">Need More Financial Tools?</h3>
              <p className="text-sm text-purple-100 mb-4">
                Get OCR invoice processing, multi-location management, and AI-powered insights.
              </p>
              <Link
                to="/pricing"
                className="inline-block w-full text-center bg-white/20 hover:bg-white/30 py-2 px-4 rounded-lg font-medium transition-colors"
              >
                View Full Platform
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalculatorLayout;