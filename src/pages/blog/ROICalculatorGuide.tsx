import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Calendar, Clock, User, Share2, Calculator, TrendingUp, DollarSign, Target, CheckCircle, ArrowRight } from 'lucide-react';
import { Helmet } from 'react-helmet-async';

const ROICalculatorGuide: React.FC = () => {
  const tableOfContents = [
    { id: "what-is-roi", title: "What is Return on Investment (ROI)?" },
    { id: "roi-formula", title: "ROI Formula and Calculation" },
    { id: "roi-calculator", title: "Using Our ROI Calculator" },
    { id: "roi-examples", title: "Real-World ROI Examples" },
    { id: "roi-best-practices", title: "ROI Calculation Best Practices" },
    { id: "roi-limitations", title: "Understanding ROI Limitations" },
    { id: "advanced-roi", title: "Advanced ROI Metrics" },
    { id: "roi-tools", title: "ROI Analysis Tools" }
  ];

  const roiExamples = [
    {
      scenario: "Marketing Campaign",
      investment: "$5,000",
      revenue: "$15,000",
      roi: "200%",
      description: "A digital marketing campaign that generated 3x return"
    },
    {
      scenario: "Equipment Purchase",
      investment: "$10,000",
      revenue: "$13,500",
      roi: "35%",
      description: "New machinery that increased production efficiency"
    },
    {
      scenario: "Training Program",
      investment: "$2,000",
      revenue: "$8,000",
      roi: "300%",
      description: "Employee training that improved productivity"
    },
    {
      scenario: "Software Implementation",
      investment: "$3,000",
      revenue: "$7,500",
      roi: "150%",
      description: "Automation software that reduced manual work"
    }
  ];

  const roiMetrics = [
    {
      metric: "Simple ROI",
      formula: "(Gain - Cost) / Cost × 100",
      useCase: "Basic investment evaluation"
    },
    {
      metric: "Annualized ROI",
      formula: "[(Ending Value / Beginning Value)^(1/Years)] - 1",
      useCase: "Comparing investments over different time periods"
    },
    {
      metric: "Risk-Adjusted ROI",
      formula: "ROI / Risk Factor",
      useCase: "Accounting for investment risk"
    }
  ];

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": "ROI Calculator Guide: How to Measure Business Investment Returns",
    "description": "Master the art of calculating return on investment with our comprehensive guide. Learn formulas, examples, and best practices for evaluating business investments.",
    "author": {
      "@type": "Person",
      "name": "David Kumar"
    },
    "datePublished": "2024-02-28",
    "dateModified": "2024-02-28",
    "publisher": {
      "@type": "Organization",
      "name": "Compazz",
      "logo": {
        "@type": "ImageObject",
        "url": "https://compazz.app/logo.png"
      }
    },
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": "https://compazz.app/blog/roi-calculator-guide"
    }
  };

  return (
    <>
      <Helmet>
        <title>ROI Calculator Guide: How to Measure Business Investment Returns | Compazz</title>
        <meta name="description" content="Master ROI calculations with our comprehensive guide and free calculator. Learn formulas, examples, and best practices for measuring business investment returns." />
        <meta name="keywords" content="ROI calculator, return on investment calculator, investment analysis, ROI formula, business ROI, calculate ROI, investment returns" />
        <link rel="canonical" href="https://compazz.app/blog/roi-calculator-guide" />

        {/* Open Graph */}
        <meta property="og:title" content="ROI Calculator Guide: How to Measure Business Investment Returns" />
        <meta property="og:description" content="Master ROI calculations with our comprehensive guide and free calculator. Learn formulas, examples, and best practices." />
        <meta property="og:url" content="https://compazz.app/blog/roi-calculator-guide" />
        <meta property="og:type" content="article" />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="ROI Calculator Guide: How to Measure Business Investment Returns" />
        <meta name="twitter:description" content="Master ROI calculations with our comprehensive guide and free calculator." />

        {/* Structured Data */}
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      </Helmet>

      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="fixed top-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-b border-gray-100 z-50">
          <nav className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="flex justify-between items-center h-20">
              <div className="flex items-center">
                <Link to="/" className="flex items-center">
                  <span className="text-2xl font-medium text-gray-900 tracking-tight">Compazz</span>
                </Link>
              </div>
              <div className="hidden md:flex items-center space-x-12">
                <Link to="/#features" className="text-gray-500 hover:text-gray-900 font-medium text-sm transition-colors">Features</Link>
                <Link to="/#pricing" className="text-gray-500 hover:text-gray-900 font-medium text-sm transition-colors">Pricing</Link>
                <Link to="/calculators" className="text-gray-500 hover:text-gray-900 font-medium text-sm transition-colors">Calculators</Link>
                <Link to="/blog" className="text-gray-500 hover:text-gray-900 font-medium text-sm transition-colors">Blog</Link>
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

        {/* Back to Blog */}
        <div className="pt-32 pb-8">
          <div className="max-w-4xl mx-auto px-6 lg:px-8">
            <Link
              to="/blog"
              className="inline-flex items-center text-gray-500 hover:text-gray-900 transition-colors group text-sm font-medium"
            >
              <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
              Back to Blog
            </Link>
          </div>
        </div>

        {/* Article Header */}
        <article className="max-w-4xl mx-auto px-6 lg:px-8 pb-24">
          <header className="mb-12">
            <div className="flex items-center space-x-6 text-sm text-gray-500 mb-6">
              <div className="flex items-center space-x-2">
                <User className="w-4 h-4" />
                <span>David Kumar</span>
              </div>
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4" />
                <span>February 28, 2024</span>
              </div>
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4" />
                <span>6 min read</span>
              </div>
            </div>

            <h1 className="text-4xl lg:text-5xl font-light text-gray-900 mb-6 leading-tight tracking-tight">
              ROI Calculator Guide: How to Measure Business Investment Returns
            </h1>

            <p className="text-xl text-gray-600 leading-relaxed font-light mb-8">
              Master the art of calculating return on investment with our comprehensive guide. Learn formulas, examples, and best practices for evaluating business investments.
            </p>

            <div className="flex items-center justify-between py-6 border-t border-b border-gray-200">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
                  <Calculator className="w-6 h-6 text-gray-400" />
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-900">Free ROI Calculator</span>
                  <p className="text-xs text-gray-500">Calculate your investment returns instantly</p>
                </div>
              </div>

              <Link
                to="/calculators/roi"
                className="bg-gray-900 text-white px-6 py-3 rounded-xl font-medium text-sm hover:bg-gray-800 transition-all duration-200"
              >
                Try Calculator
              </Link>
            </div>
          </header>

          {/* Table of Contents */}
          <div className="bg-gray-100 rounded-2xl p-8 mb-12">
            <h2 className="text-lg font-medium text-gray-900 mb-6 flex items-center">
              <span className="w-6 h-6 bg-gray-900 text-white rounded-lg flex items-center justify-center text-xs mr-3">
                📋
              </span>
              Table of Contents
            </h2>
            <ul className="space-y-3">
              {tableOfContents.map((item, index) => (
                <li key={index}>
                  <a
                    href={`#${item.id}`}
                    className="text-gray-600 hover:text-gray-900 transition-colors text-sm font-light flex items-center"
                  >
                    <span className="w-6 h-6 text-xs text-gray-400 mr-3">{index + 1}.</span>
                    {item.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Article Content */}
          <div className="prose prose-lg max-w-none">
            <section id="what-is-roi" className="mb-12">
              <h2 className="text-3xl font-light text-gray-900 mb-6">What is Return on Investment (ROI)?</h2>
              <p className="text-gray-600 leading-relaxed font-light mb-6">
                Return on Investment (ROI) is a fundamental financial metric that measures the efficiency and profitability of an investment. It tells you how much money you've gained or lost relative to the amount you initially invested.
              </p>
              <p className="text-gray-600 leading-relaxed font-light mb-6">
                ROI is expressed as a percentage and is one of the most widely used metrics for evaluating business decisions, from marketing campaigns to equipment purchases, software implementations, and strategic initiatives.
              </p>
              <div className="bg-blue-50 border-l-4 border-blue-400 p-6 my-8">
                <h3 className="text-lg font-medium text-blue-900 mb-2">Why ROI Matters</h3>
                <ul className="text-blue-800 space-y-2 text-sm">
                  <li>• Helps prioritize investments and resource allocation</li>
                  <li>• Enables comparison between different investment opportunities</li>
                  <li>• Provides objective measurement of business performance</li>
                  <li>• Supports data-driven decision making</li>
                </ul>
              </div>
            </section>

            <section id="roi-formula" className="mb-12">
              <h2 className="text-3xl font-light text-gray-900 mb-6">ROI Formula and Calculation</h2>
              <p className="text-gray-600 leading-relaxed font-light mb-6">
                The basic ROI formula is straightforward:
              </p>

              <div className="bg-gray-900 text-white p-8 rounded-2xl mb-8 text-center">
                <div className="text-2xl font-light mb-4">ROI = (Gain from Investment - Cost of Investment) / Cost of Investment × 100</div>
                <div className="text-sm text-gray-300">Or simplified as: (Revenue - Investment) / Investment × 100</div>
              </div>

              <h3 className="text-xl font-medium text-gray-900 mb-4">Step-by-Step Calculation</h3>
              <ol className="space-y-4 text-gray-600">
                <li className="flex items-start">
                  <span className="bg-gray-900 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs mr-4 mt-1">1</span>
                  <div>
                    <strong>Identify the total cost of investment:</strong> Include all expenses related to the investment (initial cost, implementation, training, maintenance).
                  </div>
                </li>
                <li className="flex items-start">
                  <span className="bg-gray-900 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs mr-4 mt-1">2</span>
                  <div>
                    <strong>Calculate the total gain:</strong> Measure all benefits received from the investment (increased revenue, cost savings, productivity gains).
                  </div>
                </li>
                <li className="flex items-start">
                  <span className="bg-gray-900 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs mr-4 mt-1">3</span>
                  <div>
                    <strong>Apply the formula:</strong> Subtract investment cost from total gain, divide by investment cost, multiply by 100.
                  </div>
                </li>
              </ol>
            </section>

            <section id="roi-calculator" className="mb-12">
              <h2 className="text-3xl font-light text-gray-900 mb-6">Using Our ROI Calculator</h2>
              <p className="text-gray-600 leading-relaxed font-light mb-6">
                Our free ROI calculator simplifies the process of calculating return on investment. Simply input your investment amount and the returns you've received, and get instant results.
              </p>

              <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-2xl p-8 mb-8">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Calculator Features</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span className="text-gray-700">Instant ROI calculation</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span className="text-gray-700">Multiple time period support</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span className="text-gray-700">Visual results display</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span className="text-gray-700">Comparison tools</span>
                  </div>
                </div>

                <Link
                  to="/calculators/roi"
                  className="inline-flex items-center bg-gray-900 text-white px-6 py-3 rounded-xl font-medium text-sm hover:bg-gray-800 transition-all duration-200 mt-6"
                >
                  Calculate ROI Now
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </div>
            </section>

            <section id="roi-examples" className="mb-12">
              <h2 className="text-3xl font-light text-gray-900 mb-6">Real-World ROI Examples</h2>
              <p className="text-gray-600 leading-relaxed font-light mb-8">
                Here are practical examples of ROI calculations across different business scenarios:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {roiExamples.map((example, index) => (
                  <div key={index} className="bg-white border border-gray-200 rounded-xl p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-3">{example.scenario}</h3>
                    <div className="space-y-2 text-sm mb-4">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Investment:</span>
                        <span className="font-medium">{example.investment}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Revenue Generated:</span>
                        <span className="font-medium">{example.revenue}</span>
                      </div>
                      <div className="flex justify-between border-t pt-2">
                        <span className="text-gray-600">ROI:</span>
                        <span className="font-bold text-green-600">{example.roi}</span>
                      </div>
                    </div>
                    <p className="text-gray-600 text-sm">{example.description}</p>
                  </div>
                ))}
              </div>
            </section>

            <section id="roi-best-practices" className="mb-12">
              <h2 className="text-3xl font-light text-gray-900 mb-6">ROI Calculation Best Practices</h2>
              <div className="space-y-6">
                <div className="border-l-4 border-green-400 pl-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Include All Costs</h3>
                  <p className="text-gray-600">Don't forget hidden costs like training, implementation time, ongoing maintenance, and opportunity costs.</p>
                </div>
                <div className="border-l-4 border-blue-400 pl-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Consider Time Period</h3>
                  <p className="text-gray-600">ROI should be calculated over a meaningful time period. Short-term ROI may not reflect long-term value.</p>
                </div>
                <div className="border-l-4 border-purple-400 pl-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Account for Risk</h3>
                  <p className="text-gray-600">Higher ROI often comes with higher risk. Consider risk-adjusted returns for better decision-making.</p>
                </div>
                <div className="border-l-4 border-orange-400 pl-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Use Consistent Metrics</h3>
                  <p className="text-gray-600">When comparing investments, ensure you're using the same calculation method and time periods.</p>
                </div>
              </div>
            </section>

            <section id="advanced-roi" className="mb-12">
              <h2 className="text-3xl font-light text-gray-900 mb-6">Advanced ROI Metrics</h2>
              <p className="text-gray-600 leading-relaxed font-light mb-6">
                While basic ROI is useful, advanced metrics provide deeper insights:
              </p>

              <div className="space-y-4">
                {roiMetrics.map((metric, index) => (
                  <div key={index} className="bg-gray-50 rounded-xl p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-2">{metric.metric}</h3>
                    <div className="bg-white p-4 rounded-lg mb-3 font-mono text-sm">
                      {metric.formula}
                    </div>
                    <p className="text-gray-600 text-sm">{metric.useCase}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Call to Action */}
          <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-2xl p-8 mt-16 text-center">
            <h2 className="text-2xl font-light text-white mb-4">Ready to Calculate Your ROI?</h2>
            <p className="text-gray-300 mb-6 font-light">
              Use our free ROI calculator to evaluate your business investments and make data-driven decisions.
            </p>
            <Link
              to="/calculators/roi"
              className="inline-flex items-center bg-white text-gray-900 px-8 py-4 rounded-xl font-medium hover:bg-gray-100 transition-all duration-200"
            >
              Start Calculating
              <Calculator className="w-5 h-5 ml-2" />
            </Link>
          </div>

          {/* Related Articles */}
          <div className="mt-16">
            <h3 className="text-2xl font-light text-gray-900 mb-8">Related Articles</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Link to="/blog/break-even-analysis-calculator-guide" className="group">
                <div className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-all duration-200">
                  <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mb-4">
                    <Target className="w-6 h-6 text-gray-400" />
                  </div>
                  <h4 className="text-lg font-medium text-gray-900 mb-2 group-hover:text-gray-600">Break-Even Analysis Guide</h4>
                  <p className="text-gray-600 text-sm">Learn to calculate your business break-even point effectively.</p>
                </div>
              </Link>
              <Link to="/blog/profit-margin-calculator-guide" className="group">
                <div className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-all duration-200">
                  <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mb-4">
                    <TrendingUp className="w-6 h-6 text-gray-400" />
                  </div>
                  <h4 className="text-lg font-medium text-gray-900 mb-2 group-hover:text-gray-600">Profit Margin Calculator</h4>
                  <p className="text-gray-600 text-sm">Optimize your business profitability with margin analysis.</p>
                </div>
              </Link>
            </div>
          </div>
        </article>
      </div>
    </>
  );
};

export default ROICalculatorGuide;