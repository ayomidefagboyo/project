import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Calendar, Clock, User, Share2, BookOpen, BarChart3, ChevronRight, CheckCircle, TrendingUp, DollarSign, Users, PieChart, Target } from 'lucide-react';

const FinancialAnalyticsRestaurants: React.FC = () => {
  const tableOfContents = [
    { id: "introduction", title: "Why Analytics Matter for Restaurants" },
    { id: "key-metrics", title: "Essential Financial Metrics" },
    { id: "revenue-analytics", title: "Revenue Performance Analytics" },
    { id: "cost-management", title: "Cost Management Metrics" },
    { id: "profitability", title: "Profitability Analysis" },
    { id: "benchmarking", title: "Industry Benchmarking" },
    { id: "implementation", title: "Implementation Guide" },
    { id: "tools", title: "Analytics Tools and Platforms" },
    { id: "conclusion", title: "Taking Action" }
  ];

  const keyMetrics = [
    {
      category: "Revenue Metrics",
      metrics: [
        "Sales per Square Foot",
        "Average Transaction Value",
        "Customer Lifetime Value",
        "Revenue per Available Seat Hour (RevPASH)"
      ],
      icon: DollarSign,
      color: "green"
    },
    {
      category: "Cost Metrics",
      metrics: [
        "Food Cost Percentage",
        "Labor Cost Percentage",
        "Prime Cost (Food + Labor)",
        "Cost per Customer Acquisition"
      ],
      icon: PieChart,
      color: "blue"
    },
    {
      category: "Operational Metrics",
      metrics: [
        "Table Turnover Rate",
        "Kitchen Efficiency Score",
        "Inventory Turnover",
        "Waste Percentage"
      ],
      icon: BarChart3,
      color: "purple"
    },
    {
      category: "Profitability Metrics",
      metrics: [
        "Gross Profit Margin",
        "EBITDA",
        "Net Profit Margin",
        "Return on Investment (ROI)"
      ],
      icon: TrendingUp,
      color: "orange"
    }
  ];

  const industryBenchmarks = [
    { metric: "Food Cost %", excellent: "28-32%", average: "33-35%", poor: "36%+" },
    { metric: "Labor Cost %", excellent: "25-30%", average: "31-35%", poor: "36%+" },
    { metric: "Prime Cost %", excellent: "55-60%", average: "61-65%", poor: "66%+" },
    { metric: "Net Profit Margin", excellent: "6-9%", average: "3-5%", poor: "0-2%" }
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
            <span>Analytics & Restaurants</span>
          </nav>

          {/* Article Header */}
          <header className="mb-16 text-center max-w-3xl mx-auto">
            <div className="flex items-center justify-center mb-8">
              <span className="bg-orange-100 text-orange-800 text-xs font-medium px-4 py-2 rounded-full mr-3">
                Analytics
              </span>
              <span className="bg-red-100 text-red-800 text-xs font-medium px-4 py-2 rounded-full">
                Restaurants
              </span>
            </div>
            
            <h1 className="text-5xl lg:text-6xl font-light text-gray-900 mb-8 leading-tight tracking-tight">
              Understanding Financial Analytics for Restaurant Chains
            </h1>
            
            <p className="text-xl text-gray-600 mb-10 leading-relaxed font-light">
              A comprehensive guide to key financial metrics and analytics that restaurant chains should track for better decision making, improved profitability, and sustainable growth.
            </p>

            <div className="flex items-center justify-center space-x-8 text-sm text-gray-500 py-6 border-t border-b border-gray-200">
              <div className="flex items-center space-x-2">
                <User className="w-4 h-4" />
                <span>Sarah Chen</span>
              </div>
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4" />
                <span>March 5, 2024</span>
              </div>
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4" />
                <span>7 min read</span>
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
                <h2 className="text-3xl font-light text-gray-900 mb-8 tracking-tight">Why Analytics Matter for Restaurants</h2>
                <div className="prose prose-lg max-w-none font-light text-gray-700 leading-relaxed space-y-6">
                  <p>
                    Restaurant chains operate on notoriously thin margins, typically between 3-5% net profit. In such a competitive landscape, data-driven decision making isn't just helpful—it's essential for survival and growth.
                  </p>
                  <p>
                    Financial analytics provide restaurant owners and managers with the insights needed to optimize operations, reduce costs, increase revenue, and make informed strategic decisions. Without proper analytics, restaurants are essentially flying blind, making decisions based on gut feeling rather than data.
                  </p>
                </div>
                
                <div className="mt-10 bg-orange-50 rounded-xl p-8">
                  <h4 className="font-medium text-orange-900 mb-6 text-sm">The Cost of Not Using Analytics</h4>
                  <div className="space-y-4">
                    <div className="flex items-start space-x-3">
                      <Target className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
                      <span className="text-orange-800 text-sm font-light">Restaurants without analytics are 40% more likely to fail within 5 years</span>
                    </div>
                    <div className="flex items-start space-x-3">
                      <Target className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
                      <span className="text-orange-800 text-sm font-light">Average 15-20% higher food costs due to poor inventory management</span>
                    </div>
                    <div className="flex items-start space-x-3">
                      <Target className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
                      <span className="text-orange-800 text-sm font-light">Missed revenue opportunities worth 10-25% of total sales</span>
                    </div>
                  </div>
                </div>
              </section>

              <section id="key-metrics" className="bg-white rounded-2xl p-10 border border-gray-100">
                <div className="flex items-center mb-8">
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mr-4">
                    <BarChart3 className="w-6 h-6 text-blue-600" />
                  </div>
                  <h2 className="text-3xl font-light text-gray-900 tracking-tight">Essential Financial Metrics</h2>
                </div>
                
                <div className="prose prose-lg max-w-none font-light text-gray-700 leading-relaxed space-y-6 mb-10">
                  <p>
                    Restaurant financial analytics can be overwhelming with dozens of potential metrics to track. Here are the essential metrics every restaurant chain should monitor, organized by category.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {keyMetrics.map((category, index) => {
                    const IconComponent = category.icon;
                    const colorClasses = {
                      green: "bg-green-100 text-green-600",
                      blue: "bg-blue-100 text-blue-600", 
                      purple: "bg-purple-100 text-purple-600",
                      orange: "bg-orange-100 text-orange-600"
                    };
                    
                    return (
                      <div key={index} className="border border-gray-200 rounded-xl p-6">
                        <div className="flex items-center mb-4">
                          <div className={`w-10 h-10 ${colorClasses[category.color as keyof typeof colorClasses]} rounded-lg flex items-center justify-center mr-3`}>
                            <IconComponent className="w-5 h-5" />
                          </div>
                          <h4 className="font-medium text-gray-900 text-sm">{category.category}</h4>
                        </div>
                        <ul className="space-y-2">
                          {category.metrics.map((metric, metricIndex) => (
                            <li key={metricIndex} className="flex items-center text-gray-600 text-sm">
                              <CheckCircle className="w-4 h-4 text-gray-400 mr-2 flex-shrink-0" />
                              {metric}
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section id="benchmarking" className="bg-white rounded-2xl p-10 border border-gray-100">
                <h2 className="text-3xl font-light text-gray-900 mb-8 tracking-tight">Industry Benchmarking</h2>
                <div className="prose prose-lg max-w-none font-light text-gray-700 leading-relaxed space-y-6 mb-10">
                  <p>
                    Understanding how your restaurant performs compared to industry benchmarks is crucial for identifying areas of improvement and setting realistic goals.
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-gray-200 rounded-lg">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="border border-gray-200 px-6 py-4 text-left font-medium text-gray-900">Metric</th>
                        <th className="border border-gray-200 px-6 py-4 text-left font-medium text-green-700">Excellent</th>
                        <th className="border border-gray-200 px-6 py-4 text-left font-medium text-yellow-700">Average</th>
                        <th className="border border-gray-200 px-6 py-4 text-left font-medium text-red-700">Needs Improvement</th>
                      </tr>
                    </thead>
                    <tbody>
                      {industryBenchmarks.map((benchmark, index) => (
                        <tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                          <td className="border border-gray-200 px-6 py-4 font-medium text-gray-900">{benchmark.metric}</td>
                          <td className="border border-gray-200 px-6 py-4 text-green-700">{benchmark.excellent}</td>
                          <td className="border border-gray-200 px-6 py-4 text-yellow-700">{benchmark.average}</td>
                          <td className="border border-gray-200 px-6 py-4 text-red-700">{benchmark.poor}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-8 bg-blue-50 border-l-4 border-blue-500 p-6">
                  <h4 className="font-medium text-blue-900 mb-3 text-sm">Pro Tip: Context Matters</h4>
                  <p className="text-blue-800 text-sm font-light leading-relaxed">
                    These benchmarks vary by restaurant type, location, and concept. Fine dining restaurants typically have higher food costs but also higher margins, while fast-casual concepts focus more on speed and efficiency metrics. Always compare yourself to similar restaurant concepts in your market.
                  </p>
                </div>
              </section>

              <section id="implementation" className="bg-white rounded-2xl p-10 border border-gray-100">
                <h2 className="text-3xl font-light text-gray-900 mb-8 tracking-tight">Implementation Guide</h2>
                <div className="prose prose-lg max-w-none font-light text-gray-700 leading-relaxed space-y-6 mb-10">
                  <p>
                    Implementing financial analytics doesn't have to be overwhelming. Start with the most impactful metrics and gradually expand your analytics capabilities.
                  </p>
                </div>

                <div className="space-y-8">
                  <div className="border-l-4 border-green-500 pl-6">
                    <h3 className="text-xl font-medium text-gray-900 mb-3">Week 1-2: Foundation Metrics</h3>
                    <ul className="space-y-2 text-gray-600 font-light">
                      <li>• Set up daily sales tracking by location</li>
                      <li>• Implement food cost percentage monitoring</li>
                      <li>• Track labor cost percentage</li>
                      <li>• Calculate prime cost (food + labor)</li>
                    </ul>
                  </div>
                  
                  <div className="border-l-4 border-blue-500 pl-6">
                    <h3 className="text-xl font-medium text-gray-900 mb-3">Week 3-4: Operational Metrics</h3>
                    <ul className="space-y-2 text-gray-600 font-light">
                      <li>• Monitor table turnover rates</li>
                      <li>• Track average transaction values</li>
                      <li>• Measure inventory turnover</li>
                      <li>• Calculate sales per square foot</li>
                    </ul>
                  </div>
                  
                  <div className="border-l-4 border-purple-500 pl-6">
                    <h3 className="text-xl font-medium text-gray-900 mb-3">Month 2+: Advanced Analytics</h3>
                    <ul className="space-y-2 text-gray-600 font-light">
                      <li>• Customer lifetime value analysis</li>
                      <li>• Menu engineering and profitability analysis</li>
                      <li>• Predictive analytics for demand forecasting</li>
                      <li>• Cross-location performance benchmarking</li>
                    </ul>
                  </div>
                </div>
              </section>

              {/* CTA Section */}
              <section className="bg-gray-900 rounded-3xl p-12 text-white text-center">
                <h3 className="text-3xl font-light mb-6 tracking-tight">Start Tracking Your Restaurant Analytics Today</h3>
                <p className="text-lg text-gray-300 mb-8 font-light leading-relaxed max-w-2xl mx-auto">
                  Get comprehensive financial analytics designed specifically for restaurant chains, with industry benchmarks and automated reporting.
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
                    See Restaurant Features
                  </Link>
                </div>
                <p className="text-sm text-gray-400 mt-4 font-light">
                  Built for restaurants • Industry benchmarks included • Setup in minutes
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
                <Users className="w-6 h-6 text-blue-600" />
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
                <TrendingUp className="w-6 h-6 text-purple-600" />
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

export default FinancialAnalyticsRestaurants;
