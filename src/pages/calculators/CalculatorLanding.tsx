import React from 'react';
import { Link } from 'react-router-dom';
import {
  Calculator,
  TrendingUp,
  DollarSign,
  BarChart3,
  Package,
  ArrowRight,
  Zap,
  Clock,
  Users,
  Target
} from 'lucide-react';
import PublicHeader from '@/components/layout/PublicHeader';
import SEOHead from '@/components/seo/SEOHead';

const CalculatorLanding: React.FC = () => {
  const calculators = [
    {
      id: 'roi',
      title: 'ROI Calculator',
      description: 'Calculate return on investment for business decisions, equipment purchases, and marketing campaigns.',
      icon: <TrendingUp className="w-8 h-8 text-blue-600" />,
      path: '/calculators/roi',
      searches: '12K+ monthly searches',
      timesSaved: '4-6 hours per analysis',
      difficulty: 'Medium Competition'
    },
    {
      id: 'break-even',
      title: 'Break-Even Calculator',
      description: 'Determine how many units you need to sell to break even and start making profit.',
      icon: <BarChart3 className="w-8 h-8 text-green-600" />,
      path: '/calculators/break-even',
      searches: '8K+ monthly searches',
      timesSaved: '3-4 hours per analysis',
      difficulty: 'Low Competition'
    },
    {
      id: 'cash-flow',
      title: 'Cash Flow Calculator',
      description: 'Project your monthly cash flows and identify potential shortfalls before they happen.',
      icon: <DollarSign className="w-8 h-8 text-purple-600" />,
      path: '/calculators/cash-flow',
      searches: '6K+ monthly searches',
      timesSaved: '2-3 hours per forecast',
      difficulty: 'Medium Competition'
    },
    {
      id: 'profit-margin',
      title: 'Profit Margin Calculator',
      description: 'Calculate gross, operating, and net profit margins to understand your business profitability.',
      icon: <Target className="w-8 h-8 text-red-600" />,
      path: '/calculators/profit-margin',
      searches: '10K+ monthly searches',
      timesSaved: '2-3 hours per analysis',
      difficulty: 'Medium Competition'
    },
    {
      id: 'inventory-turnover',
      title: 'Inventory Turnover Calculator',
      description: 'Optimize your inventory levels and reduce carrying costs with turnover analysis.',
      icon: <Package className="w-8 h-8 text-orange-600" />,
      path: '/calculators/inventory-turnover',
      searches: '4K+ monthly searches',
      timesSaved: '1-2 hours per analysis',
      difficulty: 'Low Competition'
    }
  ];

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "Free Financial Calculators by Compazz",
    "description": "Professional business financial calculators for ROI, break-even analysis, cash flow, profit margins, and inventory turnover. Free tools to make data-driven financial decisions.",
    "url": "https://compazz.app/calculators",
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
    },
    "featureList": [
      "ROI Calculator",
      "Break-Even Calculator",
      "Cash Flow Calculator",
      "Profit Margin Calculator",
      "Inventory Turnover Calculator"
    ]
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SEOHead
        title="Free Financial Calculators"
        description="Professional business financial calculators for ROI, break-even analysis, cash flow, profit margins, and inventory turnover. Free tools to make data-driven financial decisions for small businesses."
        keywords="financial calculators, ROI calculator, break-even calculator, cash flow calculator, profit margin calculator, inventory turnover calculator, business financial tools, free calculators"
        canonical="/calculators"
        structuredData={structuredData}
      />
      <PublicHeader />

      {/* Hero Section */}
      <section className="pt-24 pb-12 bg-gradient-to-br from-accent/30 to-secondary/50">
        <div className="container-width">
          <div className="text-center mb-8">
            <h1 className="text-4xl md:text-5xl font-semibold text-foreground mb-6 text-balance">
              Free Financial Calculators
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto text-balance">
              Professional business calculators to help you make data-driven financial decisions
            </p>
          </div>
        </div>
      </section>

      {/* Calculator Grid */}
      <section className="py-8 bg-background">
        <div className="container-width">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
            {calculators.map((calc) => (
              <div key={calc.id} className="card p-8 hover:shadow-lg transition-all group">
                <div className="flex items-center justify-between mb-6">
                  <div className="w-16 h-16 bg-accent rounded-xl flex items-center justify-center">
                    {calc.icon}
                  </div>
                  <span className="text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded-full">
                    {calc.searches}
                  </span>
                </div>

                <h3 className="text-xl font-semibold text-foreground mb-4">{calc.title}</h3>
                <p className="text-muted-foreground leading-relaxed mb-6">
                  {calc.description}
                </p>

                <Link
                  to={calc.path}
                  className="inline-flex items-center text-sm font-medium text-primary hover:text-primary/80 transition-colors group-hover:translate-x-1 transform"
                >
                  Try Calculator <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </div>
            ))}
          </div>

          {/* CTA Section */}
          <div className="text-center mt-16">
            <h2 className="text-2xl font-semibold text-foreground mb-4">
              Ready for Complete Financial Management?
            </h2>
            <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
              Get OCR invoice processing, multi-location management, and AI-powered insights with Compazz
            </p>
            <Link
              to="/auth?mode=signup"
              className="btn-primary inline-flex items-center space-x-2 px-6 py-3"
            >
              <span>Get Started Free</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default CalculatorLanding;