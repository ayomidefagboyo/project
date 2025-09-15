import { LucideIcon, Brain, Building2, BarChart3, Smartphone, TrendingUp, Shield, Sun, Calculator, DollarSign, Target, Gauge, PieChart, TrendingDown, Users, Briefcase, ShoppingCart, Zap } from 'lucide-react';

export interface BlogPost {
  id: string;
  title: string;
  excerpt: string;
  content?: string;
  author: string;
  date: string;
  readTime: string;
  icon: LucideIcon;
  tags: string[];
  slug: string;
  category: string;
  featured?: boolean;
  seoKeywords?: string[];
  metaDescription?: string;
}

export interface BlogCategory {
  id: string;
  name: string;
  count: number;
  description?: string;
}

export const blogCategories: BlogCategory[] = [
  { id: 'all', name: 'All Posts', count: 25 },
  { id: 'calculators', name: 'Financial Calculators', count: 8, description: 'Guides and insights on financial calculation tools' },
  { id: 'ai-tech', name: 'AI & Technology', count: 6, description: 'AI-powered finance and automation' },
  { id: 'finance-tips', name: 'Finance Tips', count: 5, description: 'Practical financial management advice' },
  { id: 'case-studies', name: 'Case Studies', count: 3, description: 'Real-world success stories' },
  { id: 'comparisons', name: 'Product Comparisons', count: 3, description: 'Compare financial tools and software' }
];

export const blogPosts: BlogPost[] = [
  // Existing Articles
  {
    id: '1',
    title: "How AI is Revolutionizing Small Business Finance Management",
    excerpt: "Discover how artificial intelligence and machine learning are transforming the way small and medium businesses handle their finances, from automated bookkeeping to predictive analytics.",
    author: "Sarah Chen",
    date: "March 15, 2024",
    readTime: "8 min read",
    icon: Brain,
    tags: ["AI", "Finance", "Technology", "Automation"],
    slug: "ai-revolutionizing-finance",
    category: "ai-tech",
    featured: true,
    seoKeywords: ["AI finance", "automated bookkeeping", "machine learning finance", "small business AI"],
    metaDescription: "Learn how AI and machine learning are transforming small business finance through automated bookkeeping, predictive analytics, and smart expense management."
  },
  {
    id: '2',
    title: "5 Ways Multi-Location Businesses Can Streamline Financial Operations",
    excerpt: "Learn proven strategies to centralize financial management across multiple outlets while maintaining operational efficiency.",
    author: "Marcus Rodriguez",
    date: "March 12, 2024",
    readTime: "6 min read",
    icon: Building2,
    tags: ["Multi-Location", "Operations", "Finance", "Efficiency"],
    slug: "streamline-multi-location-finance",
    category: "finance-tips",
    seoKeywords: ["multi-location finance", "centralized financial management", "business operations"],
    metaDescription: "Streamline financial operations across multiple business locations with these proven strategies for centralized management and improved efficiency."
  },
  {
    id: '3',
    title: "The ROI of Automated Invoice Processing: A Case Study",
    excerpt: "See how Bloom Restaurants reduced their invoice processing time by 90% and improved accuracy to 99.5% with automation.",
    author: "Emily Watson",
    date: "March 10, 2024",
    readTime: "5 min read",
    icon: BarChart3,
    tags: ["Automation", "Case Study", "ROI", "Invoicing"],
    slug: "automated-invoice-processing-roi",
    category: "case-studies",
    seoKeywords: ["automated invoice processing", "invoice automation ROI", "restaurant finance automation"],
    metaDescription: "Real case study showing 90% time reduction and 99.5% accuracy improvement with automated invoice processing for restaurants."
  },
  {
    id: '4',
    title: "Mobile-First Financial Management: Why It Matters",
    excerpt: "Explore why mobile-first design is crucial for modern financial management and how it improves team productivity.",
    author: "Alex Chen",
    date: "March 8, 2024",
    readTime: "4 min read",
    icon: Smartphone,
    tags: ["Mobile", "UX", "Productivity", "Finance"],
    slug: "mobile-first-financial-management",
    category: "ai-tech",
    seoKeywords: ["mobile financial management", "mobile-first finance", "financial app design"],
    metaDescription: "Discover why mobile-first design is essential for modern financial management and how it boosts team productivity."
  },
  {
    id: '5',
    title: "Understanding Financial Analytics for Restaurant Chains",
    excerpt: "A comprehensive guide to key financial metrics and analytics that restaurant chains should track for better decision making.",
    author: "Sarah Chen",
    date: "March 5, 2024",
    readTime: "7 min read",
    icon: TrendingUp,
    tags: ["Analytics", "Restaurants", "Metrics", "KPIs"],
    slug: "financial-analytics-restaurants",
    category: "finance-tips",
    seoKeywords: ["restaurant financial analytics", "restaurant KPIs", "food service metrics"],
    metaDescription: "Complete guide to financial analytics and key metrics that restaurant chains need to track for better business decisions."
  },
  {
    id: '6',
    title: "Security Best Practices for Financial Data Management",
    excerpt: "Learn essential security measures to protect sensitive financial data in multi-outlet business environments.",
    author: "Marcus Rodriguez",
    date: "March 3, 2024",
    readTime: "6 min read",
    icon: Shield,
    tags: ["Security", "Data Protection", "Compliance", "Privacy"],
    slug: "financial-data-security",
    category: "finance-tips",
    seoKeywords: ["financial data security", "business data protection", "financial compliance"],
    metaDescription: "Essential security best practices to protect sensitive financial data in multi-outlet business environments."
  },
  {
    id: '7',
    title: "The Future of End-of-Day Reporting: Trends and Predictions",
    excerpt: "Explore emerging trends in EOD reporting and how technology is making financial reconciliation faster and more accurate.",
    author: "Emily Watson",
    date: "March 1, 2024",
    readTime: "5 min read",
    icon: Sun,
    tags: ["EOD", "Future", "Trends", "Reporting"],
    slug: "future-eod-reporting",
    category: "ai-tech",
    seoKeywords: ["end of day reporting", "financial reconciliation", "automated reporting"],
    metaDescription: "Explore the future of end-of-day reporting and how technology is revolutionizing financial reconciliation processes."
  },

  // NEW CALCULATOR-FOCUSED ARTICLES
  {
    id: '8',
    title: "ROI Calculator Guide: How to Measure Business Investment Returns",
    excerpt: "Master the art of calculating return on investment with our comprehensive guide. Learn formulas, examples, and best practices for evaluating business investments.",
    author: "David Kumar",
    date: "February 28, 2024",
    readTime: "6 min read",
    icon: Calculator,
    tags: ["ROI", "Calculator", "Investment", "Finance"],
    slug: "roi-calculator-guide",
    category: "calculators",
    seoKeywords: ["ROI calculator", "return on investment calculator", "investment analysis", "ROI formula"],
    metaDescription: "Complete guide to ROI calculations with formulas, examples, and our free ROI calculator tool. Learn to measure business investment returns effectively."
  },
  {
    id: '9',
    title: "Break-Even Analysis: Complete Guide with Calculator",
    excerpt: "Learn how to perform break-even analysis for your business. Understand fixed costs, variable costs, and find your break-even point with our free calculator.",
    author: "Jennifer Liu",
    date: "February 25, 2024",
    readTime: "7 min read",
    icon: Target,
    tags: ["Break-Even", "Calculator", "Business Planning", "Costs"],
    slug: "break-even-analysis-calculator-guide",
    category: "calculators",
    seoKeywords: ["break even calculator", "break even analysis", "business break even point", "fixed costs variable costs"],
    metaDescription: "Master break-even analysis with our comprehensive guide and free calculator. Learn to calculate your business break-even point effectively."
  },
  {
    id: '10',
    title: "Cash Flow Calculator: Predict and Manage Your Business Cash Flow",
    excerpt: "Optimize your business cash flow with predictive calculations. Learn to forecast cash inflows, outflows, and maintain healthy working capital.",
    author: "Michael Torres",
    date: "February 22, 2024",
    readTime: "5 min read",
    icon: DollarSign,
    tags: ["Cash Flow", "Calculator", "Working Capital", "Forecasting"],
    slug: "cash-flow-calculator-business-guide",
    category: "calculators",
    seoKeywords: ["cash flow calculator", "business cash flow", "cash flow forecasting", "working capital management"],
    metaDescription: "Use our free cash flow calculator to predict and manage your business cash flow. Learn cash flow forecasting best practices."
  },
  {
    id: '11',
    title: "Profit Margin Calculator: Maximize Your Business Profitability",
    excerpt: "Calculate and optimize your profit margins with our comprehensive guide. Learn gross margin, net margin, and operating margin calculations.",
    author: "Lisa Park",
    date: "February 20, 2024",
    readTime: "6 min read",
    icon: PieChart,
    tags: ["Profit Margin", "Calculator", "Profitability", "Pricing"],
    slug: "profit-margin-calculator-guide",
    category: "calculators",
    seoKeywords: ["profit margin calculator", "gross margin calculator", "net profit margin", "business profitability"],
    metaDescription: "Calculate and optimize profit margins with our free calculator. Learn gross, net, and operating margin formulas and best practices."
  },
  {
    id: '12',
    title: "Inventory Turnover Calculator: Optimize Your Stock Management",
    excerpt: "Improve inventory efficiency with accurate turnover calculations. Learn to balance stock levels, reduce carrying costs, and boost cash flow.",
    author: "Robert Chang",
    date: "February 18, 2024",
    readTime: "5 min read",
    icon: Gauge,
    tags: ["Inventory", "Calculator", "Stock Management", "Efficiency"],
    slug: "inventory-turnover-calculator-guide",
    category: "calculators",
    seoKeywords: ["inventory turnover calculator", "inventory turnover ratio", "stock management", "inventory optimization"],
    metaDescription: "Optimize inventory management with our free turnover calculator. Learn to improve stock efficiency and reduce carrying costs."
  },

  // TOP 10 SEO ARTICLES
  {
    id: '13',
    title: "Top 10 Financial KPIs Every Business Owner Should Track",
    excerpt: "Discover the most important financial metrics that drive business success. From revenue growth to cash conversion cycle, master the KPIs that matter.",
    author: "Sarah Chen",
    date: "February 15, 2024",
    readTime: "8 min read",
    icon: BarChart3,
    tags: ["KPIs", "Metrics", "Top 10", "Finance"],
    slug: "top-10-financial-kpis-business-owners",
    category: "finance-tips",
    seoKeywords: ["financial KPIs", "business metrics", "key performance indicators", "financial tracking"],
    metaDescription: "Essential guide to the top 10 financial KPIs every business owner must track for success. Learn key metrics and how to measure them."
  },
  {
    id: '14',
    title: "Top 10 Common Financial Mistakes Small Businesses Make",
    excerpt: "Avoid costly financial pitfalls with our guide to the most common mistakes small businesses make and how to prevent them.",
    author: "Marcus Rodriguez",
    date: "February 12, 2024",
    readTime: "7 min read",
    icon: TrendingDown,
    tags: ["Mistakes", "Small Business", "Top 10", "Finance"],
    slug: "top-10-financial-mistakes-small-businesses",
    category: "finance-tips",
    seoKeywords: ["small business financial mistakes", "common accounting errors", "business finance tips"],
    metaDescription: "Avoid the top 10 financial mistakes that hurt small businesses. Learn common pitfalls and how to prevent costly errors."
  },
  {
    id: '15',
    title: "Top 10 Financial Management Tools for Small Businesses",
    excerpt: "Compare the best financial management software and tools for small businesses. Find the perfect solution for your accounting and finance needs.",
    author: "Emily Watson",
    date: "February 10, 2024",
    readTime: "9 min read",
    icon: Briefcase,
    tags: ["Tools", "Software", "Top 10", "Comparison"],
    slug: "top-10-financial-management-tools-small-business",
    category: "comparisons",
    seoKeywords: ["financial management software", "accounting tools", "small business finance software", "financial tools comparison"],
    metaDescription: "Compare the top 10 financial management tools for small businesses. Find the best accounting software for your business needs."
  },

  // PRODUCT COMPARISON ARTICLES
  {
    id: '16',
    title: "Compazz vs QuickBooks: Which is Better for Multi-Location Businesses?",
    excerpt: "Detailed comparison of Compazz and QuickBooks for businesses with multiple locations. Compare features, pricing, and capabilities.",
    author: "Alex Chen",
    date: "February 8, 2024",
    readTime: "6 min read",
    icon: Users,
    tags: ["Comparison", "QuickBooks", "Multi-Location", "Software"],
    slug: "compazz-vs-quickbooks-multi-location-comparison",
    category: "comparisons",
    seoKeywords: ["Compazz vs QuickBooks", "multi-location accounting software", "restaurant finance software comparison"],
    metaDescription: "Compare Compazz vs QuickBooks for multi-location businesses. See which accounting software better serves restaurants and retail chains."
  },
  {
    id: '17',
    title: "Compazz vs Xero: AI-Powered vs Traditional Accounting",
    excerpt: "Compare Compazz's AI-powered features with Xero's traditional approach. See which platform offers better automation and insights.",
    author: "Jennifer Liu",
    date: "February 5, 2024",
    readTime: "7 min read",
    icon: Brain,
    tags: ["Comparison", "Xero", "AI", "Automation"],
    slug: "compazz-vs-xero-ai-powered-accounting-comparison",
    category: "comparisons",
    seoKeywords: ["Compazz vs Xero", "AI accounting software", "automated bookkeeping comparison"],
    metaDescription: "Compare Compazz's AI-powered accounting with Xero's traditional features. See which offers better automation and financial insights."
  },
  {
    id: '18',
    title: "Best Restaurant POS Systems with Financial Management Integration",
    excerpt: "Compare leading POS systems that integrate seamlessly with financial management. Find the perfect solution for your restaurant business.",
    author: "David Kumar",
    date: "February 3, 2024",
    readTime: "8 min read",
    icon: ShoppingCart,
    tags: ["POS", "Restaurant", "Integration", "Comparison"],
    slug: "best-restaurant-pos-financial-management-integration",
    category: "comparisons",
    seoKeywords: ["restaurant POS systems", "POS financial integration", "restaurant management software"],
    metaDescription: "Compare the best restaurant POS systems with financial management integration. Find integrated solutions for your restaurant business."
  },

  // ADDITIONAL SEO-FOCUSED ARTICLES
  {
    id: '19',
    title: "Complete Guide to Restaurant Financial Management in 2024",
    excerpt: "Everything restaurant owners need to know about financial management, from cost control to profit optimization and cash flow management.",
    author: "Michael Torres",
    date: "January 30, 2024",
    readTime: "10 min read",
    icon: Building2,
    tags: ["Restaurant", "Financial Management", "Guide", "2024"],
    slug: "complete-restaurant-financial-management-guide-2024",
    category: "finance-tips",
    seoKeywords: ["restaurant financial management", "restaurant accounting", "food service finance", "restaurant profit optimization"],
    metaDescription: "Complete 2024 guide to restaurant financial management. Learn cost control, profit optimization, and cash flow management for restaurants."
  },
  {
    id: '20',
    title: "How to Automate Your Business Finances: Step-by-Step Guide",
    excerpt: "Transform your financial processes with automation. Learn which tasks to automate first and how to implement financial automation successfully.",
    author: "Lisa Park",
    date: "January 28, 2024",
    readTime: "7 min read",
    icon: Zap,
    tags: ["Automation", "Finance", "Guide", "Digital Transformation"],
    slug: "automate-business-finances-step-by-step-guide",
    category: "ai-tech",
    seoKeywords: ["financial automation", "automate business finances", "automated accounting", "finance process automation"],
    metaDescription: "Step-by-step guide to automating your business finances. Learn which financial processes to automate first for maximum impact."
  }
];

export const getFeaturedPost = (): BlogPost => {
  return blogPosts.find(post => post.featured) || blogPosts[0];
};

export const getPostsByCategory = (categoryId: string): BlogPost[] => {
  if (categoryId === 'all') return blogPosts;
  return blogPosts.filter(post => post.category === categoryId);
};

export const getPostBySlug = (slug: string): BlogPost | undefined => {
  return blogPosts.find(post => post.slug === slug);
};

export const getRelatedPosts = (currentPostId: string, limit: number = 3): BlogPost[] => {
  const currentPost = blogPosts.find(post => post.id === currentPostId);
  if (!currentPost) return [];

  return blogPosts
    .filter(post => post.id !== currentPostId && post.category === currentPost.category)
    .slice(0, limit);
};